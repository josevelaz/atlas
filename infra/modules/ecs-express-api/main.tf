# ---------------------------------------------------------------------------
# Data
# ---------------------------------------------------------------------------

data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

locals {
  account_id = data.aws_caller_identity.current.account_id
  region     = data.aws_region.current.region

  # Secret ARN prefix for this environment (wildcard for IAM policies)
  env_secret_arn_prefix = "arn:aws:secretsmanager:${local.region}:${local.account_id}:secret:hay/${var.env}/*"
}

# ---------------------------------------------------------------------------
# CloudWatch Log Group
# ---------------------------------------------------------------------------

resource "aws_cloudwatch_log_group" "api" {
  name              = "/hay/${var.env}/api"
  retention_in_days = var.log_retention_days

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-api-logs"
  })
}

# ---------------------------------------------------------------------------
# IAM — ECS Task Execution Role
# Allows ECS to pull images from ECR and write logs to CloudWatch.
# ---------------------------------------------------------------------------

data "aws_iam_policy_document" "task_execution_assume" {
  statement {
    sid     = "AllowECSTasksAssume"
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "task_execution" {
  name               = "${var.name_prefix}-api-exec-role"
  assume_role_policy = data.aws_iam_policy_document.task_execution_assume.json

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-api-exec-role"
  })
}

# Attach the AWS-managed policy for ECR pull + CloudWatch Logs
resource "aws_iam_role_policy_attachment" "task_execution_managed" {
  role       = aws_iam_role.task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Allow execution role to read secrets for injection at task startup
data "aws_iam_policy_document" "task_execution_secrets" {
  statement {
    sid    = "AllowReadSecretsForInjection"
    effect = "Allow"

    actions = [
      "secretsmanager:GetSecretValue",
    ]

    resources = [local.env_secret_arn_prefix]
  }
}

resource "aws_iam_policy" "task_execution_secrets" {
  name        = "${var.name_prefix}-api-exec-secrets"
  description = "Allows ECS task execution role to read hay/${var.env}/* secrets for container injection."
  policy      = data.aws_iam_policy_document.task_execution_secrets.json

  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "task_execution_secrets" {
  role       = aws_iam_role.task_execution.name
  policy_arn = aws_iam_policy.task_execution_secrets.arn
}

# ---------------------------------------------------------------------------
# IAM — ECS Infrastructure Role
# Required by ECS Express to manage the service infrastructure (VPC, ENIs, etc.)
# ---------------------------------------------------------------------------

data "aws_iam_policy_document" "infrastructure_assume" {
  statement {
    sid     = "AllowECSInfrastructureAssume"
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "infrastructure" {
  name               = "${var.name_prefix}-api-infra-role"
  assume_role_policy = data.aws_iam_policy_document.infrastructure_assume.json

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-api-infra-role"
  })
}

# Attach the AWS-managed policy for ECS infrastructure management
resource "aws_iam_role_policy_attachment" "infrastructure_managed" {
  role       = aws_iam_role.infrastructure.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSInfrastructureRolePolicyForVolumes"
}

# ---------------------------------------------------------------------------
# IAM — ECS Task Role
# Runtime permissions for the application container.
# ---------------------------------------------------------------------------

data "aws_iam_policy_document" "task_assume" {
  statement {
    sid     = "AllowECSTasksAssume"
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "task" {
  name               = "${var.name_prefix}-api-task-role"
  assume_role_policy = data.aws_iam_policy_document.task_assume.json

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-api-task-role"
  })
}

data "aws_iam_policy_document" "task_permissions" {
  # Secrets Manager — read env secrets at runtime
  statement {
    sid    = "AllowReadEnvSecrets"
    effect = "Allow"

    actions = [
      "secretsmanager:GetSecretValue",
      "secretsmanager:DescribeSecret",
    ]

    resources = [local.env_secret_arn_prefix]
  }

  # ElastiCache — IAM auth connect
  statement {
    sid    = "AllowElastiCacheConnect"
    effect = "Allow"

    actions = ["elasticache:Connect"]

    resources = [var.cache_arn]
  }

  # S3 — object CRUD on the app bucket
  statement {
    sid    = "AllowS3ObjectAccess"
    effect = "Allow"

    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
    ]

    resources = ["${var.s3_bucket_arn}/*"]
  }

  # ECR — authorization token (account-level, no resource restriction)
  statement {
    sid    = "AllowECRAuthToken"
    effect = "Allow"

    actions = ["ecr:GetAuthorizationToken"]

    resources = ["*"]
  }

  # ECR — image pull permissions
  statement {
    sid    = "AllowECRImagePull"
    effect = "Allow"

    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:GetDownloadUrlForLayer",
      "ecr:BatchGetImage",
    ]

    resources = ["arn:aws:ecr:${local.region}:${local.account_id}:repository/*"]
  }
}

resource "aws_iam_policy" "task_permissions" {
  name        = "${var.name_prefix}-api-task-policy"
  description = "Runtime permissions for the ${var.name_prefix} API ECS task."
  policy      = data.aws_iam_policy_document.task_permissions.json

  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "task_permissions" {
  role       = aws_iam_role.task.name
  policy_arn = aws_iam_policy.task_permissions.arn
}

# ---------------------------------------------------------------------------
# ECS Cluster
# ---------------------------------------------------------------------------

resource "aws_ecs_cluster" "this" {
  name = "${var.name_prefix}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-cluster"
  })
}

# ---------------------------------------------------------------------------
# ECS Express Gateway Service
#
# Uses aws_ecs_express_gateway_service (not aws_ecs_service).
# ECS Express is a serverless container runtime — no task definition needed.
# The .on.aws URL is derived from the service_name output:
#   https://<service_name>.ecs.<region>.on.aws
#
# Note: health_check and log_configuration are not supported in
# primary_container for this resource type. Health checking is handled
# by the ECS Express control plane via the container_port liveness probe.
# ---------------------------------------------------------------------------

resource "aws_ecs_express_gateway_service" "api" {
  cluster                 = aws_ecs_cluster.this.arn
  infrastructure_role_arn = aws_iam_role.infrastructure.arn
  execution_role_arn      = aws_iam_role.task_execution.arn
  task_role_arn           = aws_iam_role.task.arn

  primary_container {
    image          = var.image_uri
    container_port = var.container_port

    # Plain environment variables
    environment {
      name  = "REDIS_HOST"
      value = var.redis_host
    }

    environment {
      name  = "REDIS_PORT"
      value = tostring(var.redis_port)
    }

    environment {
      name  = "REDIS_TLS"
      value = "true"
    }

    environment {
      name  = "REDIS_KEY_PREFIX"
      value = var.redis_key_prefix
    }

    environment {
      name  = "S3_BUCKET"
      value = var.s3_bucket
    }

    environment {
      name  = "S3_REGION"
      value = var.s3_region
    }

    environment {
      name  = "NODE_ENV"
      value = "production"
    }

    environment {
      name  = "HAY_ENV"
      value = var.env
    }

    # Secrets injected from Secrets Manager at task startup
    secret {
      name       = "BETTER_AUTH_SECRET"
      value_from = "arn:aws:secretsmanager:${local.region}:${local.account_id}:secret:hay/${var.env}/BETTER_AUTH_SECRET"
    }

    secret {
      name       = "TURSO_AUTH_TOKEN"
      value_from = "arn:aws:secretsmanager:${local.region}:${local.account_id}:secret:hay/${var.env}/TURSO_AUTH_TOKEN"
    }

    secret {
      name       = "TURSO_DATABASE_URL"
      value_from = "arn:aws:secretsmanager:${local.region}:${local.account_id}:secret:hay/${var.env}/TURSO_DATABASE_URL"
    }
  }

  # Task sizing
  cpu    = var.cpu
  memory = var.memory

  # Network configuration
  network_configuration {
    subnets         = var.subnet_ids
    security_groups = var.security_group_ids
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-api"
  })

  depends_on = [
    aws_iam_role_policy_attachment.task_execution_managed,
    aws_iam_role_policy_attachment.task_execution_secrets,
    aws_iam_role_policy_attachment.task_permissions,
    aws_iam_role_policy_attachment.infrastructure_managed,
    aws_cloudwatch_log_group.api,
  ]
}

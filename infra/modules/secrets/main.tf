# ---------------------------------------------------------------------------
# Secrets Manager — name/ARN placeholders only
#
# Terraform creates the secret containers (names + ARNs) but NEVER sets
# secret_string or secret_binary. Actual values are seeded out-of-band via:
#   - The protected GitHub Actions seed workflow
#   - Manual seeding through the AWS Console or AWS CLI
#
# KMS: AWS-managed key (aws/secretsmanager) is used for all secrets.
# CMK deferral: A customer-managed KMS key (CMK) was evaluated and deferred.
# Rationale: AWS-managed keys satisfy encryption-at-rest requirements for the
# current threat model. A CMK would add key rotation management overhead and
# cross-account sharing complexity without material security benefit at this
# stage. Revisit when compliance requirements (SOC 2, HIPAA, etc.) mandate it.
# ---------------------------------------------------------------------------

locals {
  # Canonical secret names under the hay/{env}/ prefix
  secret_names = {
    better_auth_secret = "hay/${var.env}/BETTER_AUTH_SECRET"
    turso_auth_token   = "hay/${var.env}/TURSO_AUTH_TOKEN"
    turso_database_url = "hay/${var.env}/TURSO_DATABASE_URL"
    cors_allowed_origins = "hay/${var.env}/CORS_ALLOWED_ORIGINS"
    better_auth_url    = "hay/${var.env}/BETTER_AUTH_URL"
  }
}

# ---------------------------------------------------------------------------
# Secret containers — name/ARN placeholders, no values
# ---------------------------------------------------------------------------

resource "aws_secretsmanager_secret" "better_auth_secret" {
  name        = local.secret_names.better_auth_secret
  description = "Better Auth secret key for signing sessions and tokens (${var.env})."

  # AWS-managed KMS key — no kms_key_id means aws/secretsmanager is used
  recovery_window_in_days = 7

  tags = merge(var.tags, {
    Secret = local.secret_names.better_auth_secret
  })
}

resource "aws_secretsmanager_secret" "turso_auth_token" {
  name        = local.secret_names.turso_auth_token
  description = "Turso database auth token for the ${var.env} environment."

  recovery_window_in_days = 7

  tags = merge(var.tags, {
    Secret = local.secret_names.turso_auth_token
  })
}

resource "aws_secretsmanager_secret" "turso_database_url" {
  name        = local.secret_names.turso_database_url
  description = "Turso database URL for the ${var.env} environment."

  recovery_window_in_days = 7

  tags = merge(var.tags, {
    Secret = local.secret_names.turso_database_url
  })
}

resource "aws_secretsmanager_secret" "cors_allowed_origins" {
  name        = local.secret_names.cors_allowed_origins
  description = "Comma-separated list of CORS-allowed origins for the ${var.env} API."

  recovery_window_in_days = 7

  tags = merge(var.tags, {
    Secret = local.secret_names.cors_allowed_origins
  })
}

resource "aws_secretsmanager_secret" "better_auth_url" {
  name        = local.secret_names.better_auth_url
  description = "Public HTTPS URL of the Better Auth server for the ${var.env} environment."

  recovery_window_in_days = 7

  tags = merge(var.tags, {
    Secret = local.secret_names.better_auth_url
  })
}

# ---------------------------------------------------------------------------
# Data source — ECS task role (must already exist; created by the ECS module)
# ---------------------------------------------------------------------------

data "aws_iam_role" "ecs_task" {
  name = var.ecs_task_role_name
}

# ---------------------------------------------------------------------------
# IAM policy — allow ECS task role to read hay/{env}/* secrets only
# ---------------------------------------------------------------------------

data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

locals {
  account_id = data.aws_caller_identity.current.account_id
  region     = data.aws_region.current.region

  # ARN prefix for all secrets in this environment
  env_secret_arn_prefix = "arn:aws:secretsmanager:${local.region}:${local.account_id}:secret:hay/${var.env}/*"

  # ARN prefixes for long-lived envs — used in preview deny policy
  staging_secret_arn_prefix    = "arn:aws:secretsmanager:${local.region}:${local.account_id}:secret:hay/staging/*"
  production_secret_arn_prefix = "arn:aws:secretsmanager:${local.region}:${local.account_id}:secret:hay/production/*"
}

data "aws_iam_policy_document" "ecs_read_secrets" {
  # Allow: read secrets scoped to this environment only
  statement {
    sid    = "AllowReadEnvSecrets"
    effect = "Allow"

    actions = [
      "secretsmanager:GetSecretValue",
      "secretsmanager:DescribeSecret",
    ]

    resources = [local.env_secret_arn_prefix]
  }

  # Deny: preview roles must never access staging or production secrets.
  # This explicit Deny overrides any Allow that might be granted elsewhere.
  dynamic "statement" {
    for_each = var.is_preview ? [1] : []

    content {
      sid    = "DenyProductionAndStagingSecrets"
      effect = "Deny"

      actions = [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret",
        "secretsmanager:ListSecretVersionIds",
      ]

      resources = [
        local.staging_secret_arn_prefix,
        local.production_secret_arn_prefix,
      ]
    }
  }
}

resource "aws_iam_policy" "ecs_read_secrets" {
  name        = "hay-${var.env}-ecs-read-secrets"
  description = "Allows the ECS task role to read hay/${var.env}/* secrets from Secrets Manager."
  policy      = data.aws_iam_policy_document.ecs_read_secrets.json

  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "ecs_read_secrets" {
  role       = data.aws_iam_role.ecs_task.name
  policy_arn = aws_iam_policy.ecs_read_secrets.arn
}

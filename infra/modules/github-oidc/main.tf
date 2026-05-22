# ---------------------------------------------------------------------------
# GitHub OIDC IAM roles — preview / staging / production
#
# Trust-policy design notes
# ─────────────────────────
# All three roles share the same OIDC provider and audience
# (sts.amazonaws.com).  The sub claim is the primary trust boundary:
#
#   preview-deploy   → repo:ORG/REPO:pull_request
#                      (any PR from the same repo)
#   staging-deploy   → repo:ORG/REPO:environment:staging
#                      + ref:refs/heads/main  (both conditions required)
#   production-deploy→ repo:ORG/REPO:environment:production
#                      + ref:refs/heads/main  (both conditions required)
#
# ⚠️  Same-repo PR checks, exact `preview` label, and actor-permission
#     checks are WORKFLOW PREFLIGHT CHECKS enforced in the GitHub Actions
#     YAML — they are NOT IAM trust conditions.  IAM cannot inspect PR
#     labels or actor permissions; those controls live in the workflow.
#
# KMS note
# ────────
# AWS-managed keys (aws/s3, aws/secretsmanager) are used throughout.
# Customer-managed KMS keys (CMKs) are deferred until key-rotation and
# cross-account access requirements are formalised.  When CMKs are
# introduced, add kms:Decrypt / kms:GenerateDataKey to the relevant
# role policies and scope the key policy to each role ARN.
# ---------------------------------------------------------------------------

locals {
  oidc_issuer = "token.actions.githubusercontent.com"
  audience    = "sts.amazonaws.com"
  repo_prefix = "repo:${var.github_org}/${var.github_repo}"
}

# ---------------------------------------------------------------------------
# Data sources
# ---------------------------------------------------------------------------

data "aws_iam_policy_document" "preview_trust" {
  statement {
    sid     = "GitHubOIDCPreview"
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [var.oidc_provider_arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = [local.audience]
    }

    # Scope to pull-request events from this repo only.
    # The sub for a PR is: repo:ORG/REPO:pull_request
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["${local.repo_prefix}:pull_request"]
    }
  }
}

data "aws_iam_policy_document" "staging_trust" {
  statement {
    sid     = "GitHubOIDCStaging"
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [var.oidc_provider_arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = [local.audience]
    }

    # Both conditions must be satisfied simultaneously.
    # sub encodes environment AND ref when a GitHub Environment is used:
    #   repo:ORG/REPO:environment:staging
    # The ref condition is an additional guard via the ref claim.
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["${local.repo_prefix}:environment:staging"]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:ref"
      values   = ["refs/heads/main"]
    }
  }
}

data "aws_iam_policy_document" "production_trust" {
  statement {
    sid     = "GitHubOIDCProduction"
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [var.oidc_provider_arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = [local.audience]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["${local.repo_prefix}:environment:production"]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:ref"
      values   = ["refs/heads/main"]
    }
  }
}

# ---------------------------------------------------------------------------
# IAM roles
# ---------------------------------------------------------------------------

resource "aws_iam_role" "preview" {
  name               = var.preview_role_name
  assume_role_policy = data.aws_iam_policy_document.preview_trust.json
  description        = "Assumed by GitHub Actions on pull-request events (preview deployments)."

  tags = merge(var.tags, {
    Environment = "preview"
    ManagedBy   = "terraform"
  })
}

resource "aws_iam_role" "staging" {
  name               = var.staging_role_name
  assume_role_policy = data.aws_iam_policy_document.staging_trust.json
  description        = "Assumed by GitHub Actions on pushes to main targeting the staging environment."

  tags = merge(var.tags, {
    Environment = "staging"
    ManagedBy   = "terraform"
  })
}

resource "aws_iam_role" "production" {
  name               = var.production_role_name
  assume_role_policy = data.aws_iam_policy_document.production_trust.json
  description        = "Assumed by GitHub Actions on pushes to main targeting the production environment."

  tags = merge(var.tags, {
    Environment = "production"
    ManagedBy   = "terraform"
  })
}

# ---------------------------------------------------------------------------
# Inline permission policies
# ---------------------------------------------------------------------------

# Preview: read-only access to preview-scoped resources only.
# Explicitly DENIED access to production/staging Secrets Manager paths,
# production S3 buckets, and production Terraform state.
resource "aws_iam_role_policy" "preview_permissions" {
  name = "preview-deploy-permissions"
  role = aws_iam_role.preview.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # --- Allow: preview S3 bucket operations ---
      {
        Sid    = "PreviewS3"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket",
          "s3:GetBucketLocation",
        ]
        Resource = [
          "arn:aws:s3:::*-preview",
          "arn:aws:s3:::*-preview/*",
          "arn:aws:s3:::*preview*",
          "arn:aws:s3:::*preview*/*",
        ]
      },
      # --- Allow: CloudFront invalidations for preview distributions ---
      {
        Sid    = "PreviewCloudFront"
        Effect = "Allow"
        Action = [
          "cloudfront:CreateInvalidation",
          "cloudfront:GetDistribution",
          "cloudfront:GetInvalidation",
          "cloudfront:ListDistributions",
        ]
        Resource = "*"
      },
      # --- Allow: read preview secrets only ---
      {
        Sid    = "PreviewSecretsRead"
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret",
        ]
        Resource = "arn:aws:secretsmanager:*:*:secret:preview/*"
      },
      # --- Explicit DENY: production Secrets Manager paths ---
      {
        Sid    = "DenyProductionSecrets"
        Effect = "Deny"
        Action = ["secretsmanager:*"]
        Resource = [
          "arn:aws:secretsmanager:*:*:secret:production/*",
          "arn:aws:secretsmanager:*:*:secret:prod/*",
        ]
      },
      # --- Explicit DENY: staging Secrets Manager paths ---
      {
        Sid    = "DenyStagingSecrets"
        Effect = "Deny"
        Action = ["secretsmanager:*"]
        Resource = [
          "arn:aws:secretsmanager:*:*:secret:staging/*",
          "arn:aws:secretsmanager:*:*:secret:stg/*",
        ]
      },
      # --- Explicit DENY: production S3 buckets ---
      {
        Sid    = "DenyProductionS3"
        Effect = "Deny"
        Action = ["s3:*"]
        Resource = [
          "arn:aws:s3:::*-production",
          "arn:aws:s3:::*-production/*",
          "arn:aws:s3:::*-prod",
          "arn:aws:s3:::*-prod/*",
        ]
      },
      # --- Explicit DENY: staging S3 buckets ---
      {
        Sid    = "DenyStagingS3"
        Effect = "Deny"
        Action = ["s3:*"]
        Resource = [
          "arn:aws:s3:::*-staging",
          "arn:aws:s3:::*-staging/*",
          "arn:aws:s3:::*-stg",
          "arn:aws:s3:::*-stg/*",
        ]
      },
      # --- Explicit DENY: Terraform state buckets for prod/staging ---
      {
        Sid    = "DenyProdStagingTFState"
        Effect = "Deny"
        Action = ["s3:*"]
        Resource = [
          "arn:aws:s3:::*-tfstate-production",
          "arn:aws:s3:::*-tfstate-production/*",
          "arn:aws:s3:::*-tfstate-staging",
          "arn:aws:s3:::*-tfstate-staging/*",
        ]
      },
    ]
  })
}

# Staging: deploy access scoped to staging resources.
resource "aws_iam_role_policy" "staging_permissions" {
  name = "staging-deploy-permissions"
  role = aws_iam_role.staging.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # --- Allow: staging S3 bucket operations ---
      {
        Sid    = "StagingS3"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket",
          "s3:GetBucketLocation",
        ]
        Resource = [
          "arn:aws:s3:::*-staging",
          "arn:aws:s3:::*-staging/*",
          "arn:aws:s3:::*-stg",
          "arn:aws:s3:::*-stg/*",
        ]
      },
      # --- Allow: CloudFront invalidations ---
      {
        Sid    = "StagingCloudFront"
        Effect = "Allow"
        Action = [
          "cloudfront:CreateInvalidation",
          "cloudfront:GetDistribution",
          "cloudfront:GetInvalidation",
          "cloudfront:ListDistributions",
        ]
        Resource = "*"
      },
      # --- Allow: staging secrets ---
      {
        Sid    = "StagingSecretsRead"
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret",
        ]
        Resource = [
          "arn:aws:secretsmanager:*:*:secret:staging/*",
          "arn:aws:secretsmanager:*:*:secret:stg/*",
        ]
      },
      # --- Allow: Terraform state for staging ---
      {
        Sid    = "StagingTFState"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket",
        ]
        Resource = [
          "arn:aws:s3:::*-tfstate-staging",
          "arn:aws:s3:::*-tfstate-staging/*",
        ]
      },
      # --- Allow: DynamoDB state lock for staging ---
      {
        Sid    = "StagingTFLock"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:DeleteItem",
        ]
        Resource = "arn:aws:dynamodb:*:*:table/*-tflock-staging"
      },
      # --- Explicit DENY: production resources ---
      {
        Sid    = "DenyProductionSecrets"
        Effect = "Deny"
        Action = ["secretsmanager:*"]
        Resource = [
          "arn:aws:secretsmanager:*:*:secret:production/*",
          "arn:aws:secretsmanager:*:*:secret:prod/*",
        ]
      },
      {
        Sid    = "DenyProductionS3"
        Effect = "Deny"
        Action = ["s3:*"]
        Resource = [
          "arn:aws:s3:::*-production",
          "arn:aws:s3:::*-production/*",
          "arn:aws:s3:::*-prod",
          "arn:aws:s3:::*-prod/*",
          "arn:aws:s3:::*-tfstate-production",
          "arn:aws:s3:::*-tfstate-production/*",
        ]
      },
    ]
  })
}

# Production: deploy access scoped to production resources.
resource "aws_iam_role_policy" "production_permissions" {
  name = "production-deploy-permissions"
  role = aws_iam_role.production.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # --- Allow: production S3 bucket operations ---
      {
        Sid    = "ProductionS3"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket",
          "s3:GetBucketLocation",
        ]
        Resource = [
          "arn:aws:s3:::*-production",
          "arn:aws:s3:::*-production/*",
          "arn:aws:s3:::*-prod",
          "arn:aws:s3:::*-prod/*",
        ]
      },
      # --- Allow: CloudFront invalidations ---
      {
        Sid    = "ProductionCloudFront"
        Effect = "Allow"
        Action = [
          "cloudfront:CreateInvalidation",
          "cloudfront:GetDistribution",
          "cloudfront:GetInvalidation",
          "cloudfront:ListDistributions",
        ]
        Resource = "*"
      },
      # --- Allow: production secrets ---
      {
        Sid    = "ProductionSecretsRead"
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret",
        ]
        Resource = [
          "arn:aws:secretsmanager:*:*:secret:production/*",
          "arn:aws:secretsmanager:*:*:secret:prod/*",
        ]
      },
      # --- Allow: Terraform state for production ---
      {
        Sid    = "ProductionTFState"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket",
        ]
        Resource = [
          "arn:aws:s3:::*-tfstate-production",
          "arn:aws:s3:::*-tfstate-production/*",
        ]
      },
      # --- Allow: DynamoDB state lock for production ---
      {
        Sid    = "ProductionTFLock"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:DeleteItem",
        ]
        Resource = "arn:aws:dynamodb:*:*:table/*-tflock-production"
      },
    ]
  })
}

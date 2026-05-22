# ---------------------------------------------------------------------------
# Preview environment stack (per-PR ephemeral)
#
# State key pattern: preview/pr-{pr_number}/terraform.tfstate
#
# Module call order:
#   1. data sources          — read shared VPC/subnets/SGs (staging remote state)
#                              and Redis (aws_elasticache_serverless_cache data source)
#   2. turso                 — per-PR Turso database
#   3. static_spa            — per-PR CloudFront distribution with S3 prefix
#                              (must precede ecs_api so bucket ARN is available)
#   4. ecs_api               — per-PR ECS Express API service (creates task role)
#   5. secrets               — per-PR secret placeholders + ECS task role read policy
#
# Shared resources (read-only, NOT re-created):
#   - VPC / subnets / security groups  → staging remote state
#   - Redis endpoint / ARN             → aws_elasticache_serverless_cache data source
#   - S3 bucket (hay-web-nonprod)      → static_spa module (bucket_name input)
#
# Per-preview resources (created and destroyed per PR):
#   - Turso database: hay-preview-pr-{pr_number}
#   - ECS Express API service + IAM roles + CloudWatch log group (7-day retention)
#   - CloudFront distribution with previews/pr-{pr_number}/ prefix
#   - Secrets Manager placeholders under hay/preview-pr-{pr_number}/
#
# is_preview = true adds an explicit Deny on hay/staging/* and hay/production/*
# so preview task roles can never read long-lived environment secrets even if
# an Allow is accidentally granted elsewhere.
# ---------------------------------------------------------------------------

locals {
  # secrets_env must match ^[a-z][a-z0-9-]*$ (secrets module validation)
  secrets_env = "preview-pr-${var.pr_number}"
  name_prefix = "hay-preview-pr-${var.pr_number}"
}

# ---------------------------------------------------------------------------
# Remote state — staging (shared nonprod VPC / subnets / security groups)
# ---------------------------------------------------------------------------

data "terraform_remote_state" "staging" {
  backend = "s3"

  config = {
    bucket       = var.staging_state_bucket
    key          = "env/staging/terraform.tfstate"
    region       = "us-east-1"
    use_lockfile = true
  }
}

# ---------------------------------------------------------------------------
# Data source — shared nonprod Redis (ElastiCache Serverless)
#
# The staging Redis cache is named "hay-staging-cache" (set by the redis module
# using name_prefix = "hay-staging"). Previews reuse this cache and isolate
# data via REDIS_KEY_PREFIX = "preview:pr-{pr_number}:".
# ---------------------------------------------------------------------------

data "aws_elasticache_serverless_cache" "staging" {
  name = "hay-staging-cache"
}

# ---------------------------------------------------------------------------
# Turso database — preview (per-PR, ephemeral)
#
# Named hay-preview-pr-{pr_number}. Destroyed when the PR is torn down via
# `terraform destroy` on this stack.
#
# The shared preview group (var.turso_group_name, default: "hay-preview") must
# already exist. Create it once with:
#   turso group create hay-preview --location iad
#
# Auth token is NOT managed here — see infra/README.md § Turso token rotation.
# ---------------------------------------------------------------------------

module "turso" {
  source = "../modules/turso"

  database_name = "hay-preview-pr-${var.pr_number}"
  group_name    = var.turso_group_name
}

# ---------------------------------------------------------------------------
# Static SPA — preview
#
# Shares the nonprod bucket (hay-web-nonprod) with a per-PR prefix.
# CloudFront distribution is created per-PR and destroyed with the stack.
# Must be declared before ecs_api so the bucket name/ARN are available.
# ---------------------------------------------------------------------------

module "static_spa" {
  source = "../modules/static-spa"

  environment   = "preview"
  bucket_name   = "hay-web-nonprod"
  s3_key_prefix = "previews/pr-${var.pr_number}/"

  tags = {
    Project     = "hay"
    Environment = "preview"
    PR          = tostring(var.pr_number)
    ManagedBy   = "terraform"
  }
}

# ---------------------------------------------------------------------------
# ECS Express API — preview
#
# Reuses staging VPC/subnets/SGs (via remote state) and Redis (via data source).
# Redis is namespaced via REDIS_KEY_PREFIX to isolate per-PR data.
# ---------------------------------------------------------------------------

module "ecs_api" {
  source = "../modules/ecs-express-api"

  name_prefix = local.name_prefix
  env         = local.secrets_env
  image_uri   = var.api_image_uri

  vpc_id             = data.terraform_remote_state.staging.outputs.vpc_id
  subnet_ids         = data.terraform_remote_state.staging.outputs.private_subnet_ids
  security_group_ids = [data.terraform_remote_state.staging.outputs.ecs_security_group_id]

  # Shared Redis — namespaced by PR number
  redis_host       = data.aws_elasticache_serverless_cache.staging.endpoint.address
  redis_port       = data.aws_elasticache_serverless_cache.staging.endpoint.port
  redis_key_prefix = "preview:pr-${var.pr_number}:"

  # Shared S3 bucket — scoped to the preview prefix
  s3_bucket     = module.static_spa.s3_bucket_name
  s3_bucket_arn = module.static_spa.s3_bucket_arn
  s3_region     = "us-east-1"

  cache_arn = data.aws_elasticache_serverless_cache.staging.arn

  # Preview: 7-day log retention, minimal sizing
  log_retention_days = 7
  cpu                = 256
  memory             = 512
  desired_count      = 1
  is_preview         = true

  tags = {
    Project     = "hay"
    Environment = "preview"
    PR          = tostring(var.pr_number)
    ManagedBy   = "terraform"
  }
}

# ---------------------------------------------------------------------------
# Secrets — preview
#
# Creates Secrets Manager placeholder ARNs under hay/preview-pr-{pr_number}/.
# Attaches a read policy to the ECS task role created by ecs_api.
# is_preview = true adds an explicit Deny on hay/staging/* and hay/production/*.
# ---------------------------------------------------------------------------

module "secrets" {
  source = "../modules/secrets"

  env                = local.secrets_env
  ecs_task_role_name = module.ecs_api.task_role_name
  is_preview         = true

  tags = {
    Environment = "preview"
    PR          = tostring(var.pr_number)
    ManagedBy   = "terraform"
    Project     = "hay"
  }
}

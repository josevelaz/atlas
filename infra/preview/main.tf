# ---------------------------------------------------------------------------
# Preview environment stack (per-PR ephemeral)
#
# Each PR gets its own state key: infra/previews/pr-<number>/terraform.tfstate
#
# is_preview = true adds an explicit Deny on hay/staging/* and hay/production/*
# so preview task roles can never read long-lived environment secrets even if
# an Allow is accidentally granted elsewhere.
# ---------------------------------------------------------------------------

module "secrets" {
  source = "../modules/secrets"

  env                = var.env
  ecs_task_role_name = var.ecs_task_role_name
  is_preview         = true

  tags = {
    Environment = var.env
    ManagedBy   = "terraform"
    Project     = "hay"
    PR          = var.pr_number
  }
}

# ---------------------------------------------------------------------------
# Static SPA — preview
# Shares the nonprod bucket (hay-web-nonprod) with a per-PR prefix.
# ---------------------------------------------------------------------------
module "static_spa" {
  source = "../modules/static-spa"

  environment   = var.env
  bucket_name   = "hay-web-nonprod"
  s3_key_prefix = "previews/pr-${var.pr_number}/"

  tags = {
    Project     = "hay"
    Environment = var.env
    ManagedBy   = "terraform"
    PR          = var.pr_number
  }
}

# ---------------------------------------------------------------------------
# CloudWatch log group — API (task 4.12)
# ---------------------------------------------------------------------------

resource "aws_cloudwatch_log_group" "api" {
  name              = "/hay/preview/pr-${var.pr_number}/api"
  retention_in_days = 7

  tags = {
    Environment = "preview"
    PR          = var.pr_number
    ManagedBy   = "terraform"
  }
}

# ---------------------------------------------------------------------------
# Turso database — preview (per-PR, ephemeral)
#
# Named hay-preview-pr-<number>. Destroyed when the PR is torn down via
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

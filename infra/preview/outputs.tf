# ---------------------------------------------------------------------------
# Preview stack outputs
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# API
# ---------------------------------------------------------------------------

output "api_url" {
  description = "ECS Express .on.aws URL for the preview API. Use as the API base URL in the preview environment."
  value       = module.ecs_api.api_url
}

# ---------------------------------------------------------------------------
# Static SPA / CloudFront
# ---------------------------------------------------------------------------

output "cloudfront_domain_name" {
  description = "Preview CloudFront distribution domain name (e.g. d1234abcd.cloudfront.net)."
  value       = module.static_spa.cloudfront_domain_name
}

output "cloudfront_distribution_id" {
  description = "Preview CloudFront distribution ID — pass to `aws cloudfront create-invalidation` after each deploy."
  value       = module.static_spa.cloudfront_distribution_id
}

output "spa_s3_bucket_name" {
  description = "Preview SPA S3 bucket name (shared nonprod bucket)."
  value       = module.static_spa.s3_bucket_name
}

output "spa_s3_key_prefix" {
  description = "Preview SPA S3 key prefix (e.g. 'previews/pr-42/')."
  value       = module.static_spa.s3_key_prefix
}

# ---------------------------------------------------------------------------
# Turso
# ---------------------------------------------------------------------------

output "turso_database_name" {
  description = "Preview Turso database name (hay-preview-pr-{pr_number})."
  value       = module.turso.database_name
}

output "turso_database_url" {
  description = "Preview Turso libSQL connection URL. Seed this into Secrets Manager (hay/preview-pr-{pr_number}/TURSO_DATABASE_URL) — do NOT use directly in application config."
  value       = module.turso.database_url
}

# ---------------------------------------------------------------------------
# Secrets
# ---------------------------------------------------------------------------

output "secret_arns" {
  description = "Map of logical secret name → ARN for this preview environment."
  value       = module.secrets.secret_arns
}

output "secret_names" {
  description = "Map of logical secret name → Secrets Manager path for this preview environment."
  value       = module.secrets.secret_names
}

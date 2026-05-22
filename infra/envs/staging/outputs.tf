# ---------------------------------------------------------------------------
# Secrets outputs (staging)
# ---------------------------------------------------------------------------

output "secret_arns" {
  description = "Map of logical secret name → ARN for the staging environment."
  value       = module.secrets.secret_arns
}

output "secret_names" {
  description = "Map of logical secret name → Secrets Manager path for the staging environment."
  value       = module.secrets.secret_names
}

# ---------------------------------------------------------------------------
# DNS / ACM outputs (staging)
# ---------------------------------------------------------------------------

output "app_fqdn" {
  description = "Staging web app FQDN (app.<staging_zone_name>)."
  value       = module.dns_acm.app_fqdn
}

output "acm_certificate_arn" {
  description = "ARN of the validated ACM certificate for the staging CloudFront distribution."
  value       = module.dns_acm.certificate_arn
}

output "route53_zone_id" {
  description = "Staging Route 53 hosted zone ID."
  value       = module.dns_acm.zone_id
}

# ---------------------------------------------------------------------------
# Static SPA outputs (staging)
# ---------------------------------------------------------------------------

output "cloudfront_distribution_id" {
  description = "Staging CloudFront distribution ID — pass to `aws cloudfront create-invalidation` after each deploy."
  value       = module.static_spa.cloudfront_distribution_id
}

output "cloudfront_domain_name" {
  description = "Staging CloudFront distribution domain name."
  value       = module.static_spa.cloudfront_domain_name
}

output "spa_s3_bucket_name" {
  description = "Staging SPA S3 bucket name."
  value       = module.static_spa.s3_bucket_name
}

output "spa_s3_key_prefix" {
  description = "Staging SPA S3 key prefix."
  value       = module.static_spa.s3_key_prefix
}

# ---------------------------------------------------------------------------
# Turso outputs (staging)
# ---------------------------------------------------------------------------

output "turso_database_name" {
  description = "Staging Turso database name."
  value       = module.turso.database_name
}

output "turso_database_url" {
  description = "Staging Turso libSQL connection URL. Seed this into Secrets Manager (hay/staging/TURSO_DATABASE_URL) — do NOT use directly in application config."
  value       = module.turso.database_url
}

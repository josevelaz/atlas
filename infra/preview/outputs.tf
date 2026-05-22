output "secret_arns" {
  description = "Map of logical secret name → ARN for this preview environment."
  value       = module.secrets.secret_arns
}

output "secret_names" {
  description = "Map of logical secret name → Secrets Manager path for this preview environment."
  value       = module.secrets.secret_names
}

# ---------------------------------------------------------------------------
# Static SPA outputs (preview)
# ---------------------------------------------------------------------------

output "cloudfront_distribution_id" {
  description = "Preview CloudFront distribution ID — pass to `aws cloudfront create-invalidation` after each deploy."
  value       = module.static_spa.cloudfront_distribution_id
}

output "cloudfront_domain_name" {
  description = "Preview CloudFront distribution domain name."
  value       = module.static_spa.cloudfront_domain_name
}

output "spa_s3_bucket_name" {
  description = "Preview SPA S3 bucket name."
  value       = module.static_spa.s3_bucket_name
}

output "spa_s3_key_prefix" {
  description = "Preview SPA S3 key prefix (e.g. 'previews/pr-42/')."
  value       = module.static_spa.s3_key_prefix
}

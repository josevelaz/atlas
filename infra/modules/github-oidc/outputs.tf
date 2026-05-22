output "preview_role_arn" {
  description = "ARN of the preview-deploy IAM role. Store as a GitHub Actions variable (not secret) — it is not sensitive."
  value       = aws_iam_role.preview.arn
}

output "staging_role_arn" {
  description = "ARN of the staging-deploy IAM role. Store as a GitHub Actions variable or secret."
  value       = aws_iam_role.staging.arn
}

output "production_role_arn" {
  description = "ARN of the production-deploy IAM role. Store as a GitHub Actions secret."
  value       = aws_iam_role.production.arn
  sensitive   = true
}

output "preview_role_name" {
  description = "Name of the preview-deploy IAM role."
  value       = aws_iam_role.preview.name
}

output "staging_role_name" {
  description = "Name of the staging-deploy IAM role."
  value       = aws_iam_role.staging.name
}

output "production_role_name" {
  description = "Name of the production-deploy IAM role."
  value       = aws_iam_role.production.name
}

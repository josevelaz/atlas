output "bucket_name" {
  description = "S3 bucket name — use in backend config blocks."
  value       = module.remote_state.bucket_name
}

output "bucket_arn" {
  description = "S3 bucket ARN."
  value       = module.remote_state.bucket_arn
}

output "aws_region" {
  description = "AWS region — use in backend config blocks."
  value       = module.remote_state.aws_region
}

output "ecr_repository_url" {
  description = "Full URI of the ECR repository — use in docker push and image references."
  value       = module.ecr.repository_url
}

output "ecr_repository_arn" {
  description = "ARN of the ECR repository — use in IAM policy resources."
  value       = module.ecr.repository_arn
}

output "ecr_registry_id" {
  description = "Registry ID (AWS account ID) that owns the ECR repository."
  value       = module.ecr.registry_id
}

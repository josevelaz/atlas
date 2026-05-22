output "repository_url" {
  description = "Full URI of the ECR repository (used in docker push / image references)."
  value       = aws_ecr_repository.this.repository_url
}

output "repository_arn" {
  description = "ARN of the ECR repository."
  value       = aws_ecr_repository.this.arn
}

output "registry_id" {
  description = "Registry ID (AWS account ID) that owns the repository."
  value       = aws_ecr_repository.this.registry_id
}

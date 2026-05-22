# ---------------------------------------------------------------------------
# ECS Express API module outputs
# ---------------------------------------------------------------------------

output "api_url" {
  description = "ECS Express generated .on.aws URL for the API service. Constructed from service_name: https://<service_name>.ecs.<region>.on.aws"
  # ECS Express does not expose the URL as a direct attribute — construct it from service_name.
  # The service_name is the auto-generated identifier assigned by ECS Express.
  value = "https://${aws_ecs_express_gateway_service.api.service_name}.ecs.${data.aws_region.current.region}.on.aws"
}

output "service_arn" {
  description = "ARN of the ECS Express Gateway service."
  value       = aws_ecs_express_gateway_service.api.service_arn
}

output "service_name" {
  description = "Auto-generated ECS Express service name (used to construct the .on.aws URL)."
  value       = aws_ecs_express_gateway_service.api.service_name
}

output "task_role_arn" {
  description = "ARN of the ECS task IAM role (runtime permissions)."
  value       = aws_iam_role.task.arn
}

output "task_role_name" {
  description = "Name of the ECS task IAM role (for attaching additional policies, e.g. from the secrets module)."
  value       = aws_iam_role.task.name
}

output "task_execution_role_arn" {
  description = "ARN of the ECS task execution IAM role (ECR pull + CloudWatch Logs)."
  value       = aws_iam_role.task_execution.arn
}

output "infrastructure_role_arn" {
  description = "ARN of the ECS infrastructure IAM role."
  value       = aws_iam_role.infrastructure.arn
}

output "log_group_name" {
  description = "CloudWatch log group name for the API container."
  value       = aws_cloudwatch_log_group.api.name
}

output "log_group_arn" {
  description = "CloudWatch log group ARN."
  value       = aws_cloudwatch_log_group.api.arn
}

output "cluster_arn" {
  description = "ARN of the ECS cluster."
  value       = aws_ecs_cluster.this.arn
}

output "cluster_name" {
  description = "Name of the ECS cluster."
  value       = aws_ecs_cluster.this.name
}

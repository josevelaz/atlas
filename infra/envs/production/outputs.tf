output "vpc_id" {
  description = "Production VPC ID."
  value       = module.network.vpc_id
}

output "public_subnet_ids" {
  description = "Production public subnet IDs."
  value       = module.network.public_subnet_ids
}

output "private_subnet_ids" {
  description = "Production private subnet IDs."
  value       = module.network.private_subnet_ids
}

output "ecs_security_group_id" {
  description = "Production ECS security group ID."
  value       = module.network.ecs_security_group_id
}

output "redis_security_group_id" {
  description = "Production Redis security group ID."
  value       = module.network.redis_security_group_id
}

output "api_url" {
  description = "ECS Express .on.aws URL for the production API. Use as VITE_API_URL / API base URL."
  value       = module.ecs_api.api_url
}

output "api_task_role_arn" {
  description = "ARN of the production API ECS task role."
  value       = module.ecs_api.task_role_arn
}

output "api_log_group_name" {
  description = "CloudWatch log group name for the production API."
  value       = module.ecs_api.log_group_name
}

output "app_fqdn" {
  description = "Production web app FQDN (app.<prod_zone_name>)."
  value       = module.dns_acm.app_fqdn
}

output "acm_certificate_arn" {
  description = "ARN of the validated ACM certificate for the production CloudFront distribution."
  value       = module.dns_acm.certificate_arn
}

output "route53_zone_id" {
  description = "Production Route 53 hosted zone ID."
  value       = module.dns_acm.zone_id
}

# ---------------------------------------------------------------------------
# Redis / Valkey module outputs
# ---------------------------------------------------------------------------
# Consumers (ECS task definitions, app config) should use these outputs.
# Auth is IAM-only — no token outputs exist by design.
#
# ECS task role requirement (wire in task 4.11):
#   elasticache:Connect on aws_elasticache_serverless_cache.this ARN

output "primary_endpoint" {
  description = "Valkey TLS endpoint hostname (no port). Use with port output to build the connection URL."
  value       = aws_elasticache_serverless_cache.this.endpoint[0].address
}

output "port" {
  description = "Valkey TLS port (always 6379 for ElastiCache Serverless)."
  value       = aws_elasticache_serverless_cache.this.endpoint[0].port
}

output "tls_enabled" {
  description = "Always true — ElastiCache Serverless enforces TLS in transit."
  value       = true
}

output "cache_arn" {
  description = "ARN of the ElastiCache Serverless cache. Grant elasticache:Connect on this ARN in the ECS task role (task 4.11)."
  value       = aws_elasticache_serverless_cache.this.arn
}

output "security_group_id" {
  description = "Security group ID attached to the ElastiCache Serverless cache (may be the network module's SG or one created by this module)."
  value       = local.sg_id
}

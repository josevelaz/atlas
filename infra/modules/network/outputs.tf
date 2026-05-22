output "vpc_id" {
  description = "ID of the VPC."
  value       = aws_vpc.this.id
}

output "public_subnet_ids" {
  description = "List of public subnet IDs (one per AZ)."
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "List of private subnet IDs (one per AZ)."
  value       = aws_subnet.private[*].id
}

output "ecs_security_group_id" {
  description = "Security group ID for ECS tasks."
  value       = aws_security_group.ecs.id
}

output "redis_security_group_id" {
  description = "Security group ID for Redis (ElastiCache). Accepts inbound only from ECS SG."
  value       = aws_security_group.redis.id
}

output "vpc_cidr" {
  description = "CIDR block of the VPC."
  value       = aws_vpc.this.cidr_block
}

variable "name_prefix" {
  description = "Short identifier prepended to every resource name (e.g. 'hay-prod', 'hay-staging')."
  type        = string
}

variable "vpc_id" {
  description = "VPC ID where the ElastiCache Serverless cache will be deployed."
  type        = string
}

variable "subnet_ids" {
  description = "Private subnet IDs for the ElastiCache Serverless cache (minimum 2 AZs)."
  type        = list(string)
}

variable "ecs_security_group_id" {
  description = "Security group ID of the ECS tasks — only this SG is allowed inbound on port 6379."
  type        = string
}

variable "redis_security_group_id" {
  description = <<-EOT
    Optional: pre-existing security group ID to attach to the ElastiCache Serverless cache.
    When provided, the module skips creating its own SG and uses this one instead.
    Leave null to have the module create and manage its own security group.
  EOT
  type        = string
  default     = null
}

variable "max_ecpu_per_second" {
  description = "Maximum eCPU per second for the serverless cache (controls throughput scaling)."
  type        = number
  default     = 5000
}

variable "max_storage_gb" {
  description = "Maximum data storage in GB for the serverless cache."
  type        = number
  default     = 5
}

variable "snapshot_retention_days" {
  description = "Number of daily snapshots to retain (0 = disabled)."
  type        = number
  default     = 1

  validation {
    condition     = var.snapshot_retention_days >= 0 && var.snapshot_retention_days <= 35
    error_message = "snapshot_retention_days must be between 0 and 35."
  }
}

variable "tags" {
  description = "Tags to apply to all resources."
  type        = map(string)
  default     = {}
}

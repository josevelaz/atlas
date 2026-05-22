# ---------------------------------------------------------------------------
# Required
# ---------------------------------------------------------------------------

variable "name_prefix" {
  description = "Short identifier prepended to every resource name (e.g. 'hay-staging', 'hay-prod')."
  type        = string
}

variable "env" {
  description = "Environment name used in secret paths and log group names (e.g. 'staging', 'production', 'preview-pr-42')."
  type        = string
}

variable "image_uri" {
  description = "Full ECR image URI including tag (e.g. '123456789.dkr.ecr.us-east-1.amazonaws.com/hay-server:abc1234')."
  type        = string
}

variable "vpc_id" {
  description = "VPC ID where the ECS Express service will be deployed."
  type        = string
}

variable "subnet_ids" {
  description = "Private subnet IDs for the ECS Express service (minimum 2 AZs recommended)."
  type        = list(string)
}

variable "security_group_ids" {
  description = "Security group IDs to attach to the ECS Express service tasks."
  type        = list(string)
}

variable "redis_host" {
  description = "ElastiCache Serverless primary endpoint hostname (no port)."
  type        = string
}

variable "redis_port" {
  description = "ElastiCache Serverless port (typically 6379)."
  type        = number
  default     = 6379
}

variable "redis_key_prefix" {
  description = "Key prefix for Redis namespacing (e.g. 'hay:staging:')."
  type        = string
}

variable "s3_bucket" {
  description = "Name of the S3 bucket the API uses for object storage."
  type        = string
}

variable "s3_bucket_arn" {
  description = "ARN of the S3 bucket (used for IAM policy)."
  type        = string
}

variable "s3_region" {
  description = "AWS region where the S3 bucket lives."
  type        = string
}

variable "cache_arn" {
  description = "ARN of the ElastiCache Serverless cache (for elasticache:Connect IAM permission)."
  type        = string
}

# ---------------------------------------------------------------------------
# Optional / tuning
# ---------------------------------------------------------------------------

variable "container_port" {
  description = "Port the container listens on."
  type        = number
  default     = 3000
}

variable "cpu" {
  description = "vCPU units for the ECS Express task (1024 = 1 vCPU)."
  type        = number
  default     = 512
}

variable "memory" {
  description = "Memory in MiB for the ECS Express task."
  type        = number
  default     = 1024
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days (30 for prod/staging, 7 for preview)."
  type        = number
  default     = 30

  validation {
    condition     = contains([1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1096, 1827, 2192, 2557, 2922, 3288, 3653], var.log_retention_days)
    error_message = "log_retention_days must be a valid CloudWatch retention value."
  }
}

variable "desired_count" {
  description = "Number of ECS task instances to run."
  type        = number
  default     = 1
}

variable "is_preview" {
  description = "When true, applies preview-specific settings (shorter log retention, etc.)."
  type        = bool
  default     = false
}

variable "tags" {
  description = "Tags applied to all resources created by this module."
  type        = map(string)
  default     = {}
}

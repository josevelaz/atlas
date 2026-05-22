variable "bucket_name" {
  description = "Name of the S3 bucket to create for Terraform remote state."
  type        = string
}

variable "ecr_repository_name" {
  description = "Name of the ECR repository for server images (shared across all environments)."
  type        = string
  default     = "hay-server"
}

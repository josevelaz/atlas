variable "pr_number" {
  description = "Pull request number. Used in resource names, tags, S3 prefix, Redis key prefix, and the state key (preview/pr-{pr_number}/terraform.tfstate)."
  type        = number

  validation {
    condition     = var.pr_number > 0
    error_message = "pr_number must be a positive integer."
  }
}

variable "api_image_uri" {
  description = "Full ECR image URI including tag (e.g. '123456789.dkr.ecr.us-east-1.amazonaws.com/hay-server:abc1234'). Set via TF_VAR_api_image_uri in CI."
  type        = string
}

variable "turso_group_name" {
  description = "Name of the existing Turso group to create preview databases in. The group must already exist — create it once with: turso group create hay-preview --location iad"
  type        = string
  default     = "hay-preview"
}

variable "staging_state_bucket" {
  description = "S3 bucket holding the staging Terraform state (used to read shared network and Redis outputs via terraform_remote_state)."
  type        = string
  default     = "hay-terraform-state"
}

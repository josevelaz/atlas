variable "github_org" {
  description = "GitHub organisation or user that owns the repository (e.g. 'josevelaz')."
  type        = string
}

variable "github_repo" {
  description = "GitHub repository name without the org prefix (e.g. 'hay')."
  type        = string
}

variable "oidc_provider_arn" {
  description = <<-EOT
    ARN of the GitHub Actions OIDC provider in this AWS account.
    Pass the ARN from the bootstrap stack so the provider is created once
    and shared across all roles.
  EOT
  type        = string
}

variable "preview_role_name" {
  description = "IAM role name for preview (PR) deployments."
  type        = string
  default     = "preview-deploy"
}

variable "staging_role_name" {
  description = "IAM role name for staging deployments."
  type        = string
  default     = "staging-deploy"
}

variable "production_role_name" {
  description = "IAM role name for production deployments."
  type        = string
  default     = "production-deploy"
}

variable "tags" {
  description = "Tags applied to all IAM resources created by this module."
  type        = map(string)
  default     = {}
}

variable "env" {
  description = "Environment name used in secret path prefix (e.g. 'staging', 'production', 'preview')."
  type        = string

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]*$", var.env))
    error_message = "env must be lowercase alphanumeric with optional hyphens, starting with a letter."
  }
}

variable "ecs_task_role_name" {
  description = "Name of the ECS task IAM role that will be granted GetSecretValue on hay/{env}/* secrets."
  type        = string
}

variable "is_preview" {
  description = "When true, the ECS task role is explicitly DENIED access to hay/production/* and hay/staging/* secrets."
  type        = bool
  default     = false
}

variable "tags" {
  description = "Tags applied to all resources created by this module."
  type        = map(string)
  default     = {}
}

variable "env" {
  description = "Preview environment name, typically 'preview-pr-<number>' (e.g. 'preview-pr-42')."
  type        = string

  validation {
    condition     = can(regex("^preview-pr-[0-9]+$", var.env))
    error_message = "env must match 'preview-pr-<number>' (e.g. 'preview-pr-42')."
  }
}

variable "pr_number" {
  description = "Pull request number. Used as a tag and in the state key."
  type        = string
}

variable "ecs_task_role_name" {
  description = "Name of the ECS task IAM role for this preview environment."
  type        = string
}

variable "turso_group_name" {
  description = "Name of the existing Turso group to create preview databases in. The group must already exist — create it once with: turso group create hay-preview --location iad"
  type        = string
  default     = "hay-preview"
}

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

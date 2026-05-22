variable "database_name" {
  description = "Name of the Turso database. Must contain only lowercase letters, numbers, and dashes. Max 64 characters."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$|^[a-z0-9]$", var.database_name))
    error_message = "database_name must contain only lowercase letters, numbers, and dashes, and be between 1 and 64 characters."
  }
}

variable "group_name" {
  description = "Name of the Turso group where the database will be created. The group must already exist in the Turso organisation."
  type        = string
}

variable "size_limit" {
  description = "Maximum database size. Accepts values with units, e.g. '256mb', '1gb'. Leave null for the Turso plan default."
  type        = string
  default     = null
}

variable "is_production" {
  description = "When true, uses the production CIDR (10.0.0.0/16); nonprod uses 10.1.0.0/16."
  type        = bool
}

variable "name_prefix" {
  description = "Short identifier prepended to every resource name (e.g. 'hay-prod', 'hay-staging')."
  type        = string
}

variable "az_count" {
  description = "Number of Availability Zones to spread subnets across (minimum 2)."
  type        = number
  default     = 2

  validation {
    condition     = var.az_count >= 2
    error_message = "az_count must be at least 2 for high availability."
  }
}

variable "tags" {
  description = "Additional tags to merge onto all resources in this module."
  type        = map(string)
  default     = {}
}

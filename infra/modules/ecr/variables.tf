variable "name" {
  description = "ECR repository name."
  type        = string
}

variable "max_tagged_images" {
  description = "Number of tagged images to retain. Oldest tagged images beyond this count are expired."
  type        = number
  default     = 30
}

variable "untagged_expiry_days" {
  description = "Days after which untagged images are expired."
  type        = number
  default     = 1
}

variable "tags" {
  description = "Tags to apply to the ECR repository."
  type        = map(string)
  default     = {}
}

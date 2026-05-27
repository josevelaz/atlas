variable "bucket_name" {
  description = "Name of the S3 bucket used for Terraform remote state."
  type        = string
}

variable "kms_key_arn" {
  description = "ARN of the customer-managed KMS key used to encrypt Terraform state objects."
  type        = string
}

variable "tags" {
  description = "Tags to apply to all resources."
  type        = map(string)
  default     = {}
}

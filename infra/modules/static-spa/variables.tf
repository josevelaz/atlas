# ---------------------------------------------------------------------------
# Required
# ---------------------------------------------------------------------------

variable "environment" {
  description = "Deployment environment name (e.g. 'production', 'staging', 'preview')."
  type        = string
}

variable "bucket_name" {
  description = "Name of the S3 bucket that holds the SPA assets."
  type        = string
}

# ---------------------------------------------------------------------------
# Optional — prefix strategy
# ---------------------------------------------------------------------------

variable "s3_key_prefix" {
  description = <<-EOT
    Optional S3 key prefix for this deployment (e.g. 'staging/' or 'previews/pr-42/').
    Leave empty for production, which owns the bucket root.
    Must end with '/' when non-empty.
  EOT
  type    = string
  default = ""

  validation {
    condition     = var.s3_key_prefix == "" || endswith(var.s3_key_prefix, "/")
    error_message = "s3_key_prefix must be empty or end with '/'."
  }
}

# ---------------------------------------------------------------------------
# Optional — CloudFront
# ---------------------------------------------------------------------------

variable "aliases" {
  description = "Alternate domain names (CNAMEs) for the CloudFront distribution. Requires acm_certificate_arn."
  type        = list(string)
  default     = []
}

variable "acm_certificate_arn" {
  description = "ARN of an ACM certificate in us-east-1 for the custom domain aliases. Required when aliases is non-empty."
  type        = string
  default     = null
}

variable "price_class" {
  description = "CloudFront price class. PriceClass_100 = US/EU only (cheapest)."
  type        = string
  default     = "PriceClass_100"

  validation {
    condition     = contains(["PriceClass_100", "PriceClass_200", "PriceClass_All"], var.price_class)
    error_message = "price_class must be one of PriceClass_100, PriceClass_200, or PriceClass_All."
  }
}

# ---------------------------------------------------------------------------
# Optional — tagging
# ---------------------------------------------------------------------------

variable "tags" {
  description = "Tags applied to all resources created by this module."
  type        = map(string)
  default     = {}
}

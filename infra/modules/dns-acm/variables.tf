# ---------------------------------------------------------------------------
# Required
# ---------------------------------------------------------------------------

variable "zone_name" {
  description = "The Route 53 hosted zone name (e.g. \"hay.example.com\"). Must already exist in the account."
  type        = string
}

variable "cloudfront_domain_name" {
  description = "The CloudFront distribution domain name to point app.<zone_name> at (output from the static-spa module)."
  type        = string
}

# ---------------------------------------------------------------------------
# Optional
# ---------------------------------------------------------------------------

variable "name_prefix" {
  description = "Short prefix used in resource Name tags (e.g. \"hay-staging\")."
  type        = string
  default     = "hay"
}

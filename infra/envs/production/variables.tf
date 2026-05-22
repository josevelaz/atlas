variable "api_image_uri" {
  description = "Full ECR image URI for the API container (e.g. '123456789.dkr.ecr.us-east-1.amazonaws.com/hay-server:abc1234'). Set via TF_VAR_api_image_uri in CI."
  type        = string
}

variable "prod_zone_name" {
  description = "Route 53 hosted zone name for the production environment (e.g. \"hay.example.com\"). The zone must already exist in the AWS account."
  type        = string
}

variable "prod_cloudfront_domain_name" {
  description = <<-EOT
    CloudFront distribution domain name for the production SPA (e.g. "d5678efgh.cloudfront.net").
    Set this to the cloudfront_domain_name output after the first apply of static_spa,
    then re-apply so the dns_acm Route 53 ALIAS record points to CloudFront.
    Leave empty string on the initial bootstrap apply.
  EOT
  type    = string
  default = ""
}

variable "prod_acm_certificate_arn" {
  description = <<-EOT
    ARN of the validated ACM certificate for app.<prod_zone_name>.
    Set this to the acm_certificate_arn output after dns_acm is applied,
    then re-apply so static_spa attaches the cert + alias to CloudFront.
    Leave null on the initial bootstrap apply.
  EOT
  type    = string
  default = null
}

variable "turso_group_name" {
  description = "Name of the existing Turso group to create the production database in (e.g. 'hay-prod'). The group must already exist — create it with: turso group create hay-prod --location iad"
  type        = string
  default     = "hay-prod"
}

variable "api_image_uri" {
  description = "Full ECR image URI for the API container (e.g. '123456789.dkr.ecr.us-east-1.amazonaws.com/hay-server:abc1234'). Set via TF_VAR_api_image_uri in CI."
  type        = string
}

variable "staging_zone_name" {
  description = "Route 53 hosted zone name for the staging environment (e.g. \"staging.hay.example.com\"). The zone must already exist in the AWS account."
  type        = string
}

variable "ecs_task_role_name" {
  description = "Name of the ECS task IAM role created by the ECS module. Must exist before applying the secrets module."
  type        = string
  default     = "hay-staging-ecs-task"
}

variable "staging_cloudfront_domain_name" {
  description = <<-EOT
    CloudFront distribution domain name for the staging SPA (e.g. "d1234abcd.cloudfront.net").
    Set this to the cloudfront_domain_name output after the first apply of static_spa,
    then re-apply so the dns_acm Route 53 ALIAS record points to CloudFront.
    Leave empty string on the initial bootstrap apply.
  EOT
  type        = string
  default     = ""
}

variable "staging_acm_certificate_arn" {
  description = <<-EOT
    ARN of the validated ACM certificate for app.<staging_zone_name>.
    Set this to the acm_certificate_arn output after dns_acm is applied,
    then re-apply so static_spa attaches the cert + alias to CloudFront.
    Leave null on the initial bootstrap apply.
  EOT
  type    = string
  default = null
}

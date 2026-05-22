variable "api_image_uri" {
  description = "Full ECR image URI for the API container (e.g. '123456789.dkr.ecr.us-east-1.amazonaws.com/hay-server:abc1234'). Set via TF_VAR_api_image_uri in CI."
  type        = string
}

variable "prod_zone_name" {
  description = "Route 53 hosted zone name for the production environment (e.g. \"hay.example.com\"). The zone must already exist in the AWS account."
  type        = string
}

variable "prod_cloudfront_domain_name" {
  description = "CloudFront distribution domain name for the production SPA (output from the static-spa module, e.g. \"d5678efgh.cloudfront.net\")."
  type        = string
}

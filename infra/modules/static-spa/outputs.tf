# ---------------------------------------------------------------------------
# Outputs — consumed by env stacks and CI/CD invalidation hooks
# ---------------------------------------------------------------------------

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID. Pass to `aws cloudfront create-invalidation` after each deploy."
  value       = aws_cloudfront_distribution.this.id
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name (e.g. d1234abcd.cloudfront.net)."
  value       = aws_cloudfront_distribution.this.domain_name
}

output "s3_bucket_name" {
  description = "Name of the S3 bucket holding the SPA assets."
  value       = aws_s3_bucket.this.id
}

output "s3_key_prefix" {
  description = "S3 key prefix for this deployment (empty string for production bucket root)."
  value       = var.s3_key_prefix
}

output "s3_bucket_arn" {
  description = "ARN of the S3 bucket (useful for scoped IAM deploy-role policies)."
  value       = aws_s3_bucket.this.arn
}

output "cloudfront_arn" {
  description = "ARN of the CloudFront distribution (useful for scoped IAM deploy-role policies)."
  value       = aws_cloudfront_distribution.this.arn
}

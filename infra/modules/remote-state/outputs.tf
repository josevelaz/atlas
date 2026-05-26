output "bucket_name" {
  description = "Name of the S3 state bucket."
  value       = aws_s3_bucket.state.bucket
}

output "bucket_arn" {
  description = "ARN of the S3 state bucket."
  value       = aws_s3_bucket.state.arn
}

output "aws_region" {
  description = "AWS region where the state bucket resides."
  value       = aws_s3_bucket.state.region
}

# ---------------------------------------------------------------------------
# Outputs
# ---------------------------------------------------------------------------

output "certificate_arn" {
  description = "ARN of the validated ACM certificate for app.<zone_name>. Pass this to the static-spa module's CloudFront distribution."
  value       = aws_acm_certificate_validation.app.certificate_arn
}

output "app_fqdn" {
  description = "The fully-qualified domain name served by CloudFront (e.g. app.hay.example.com)."
  value       = local.app_fqdn
}

output "zone_id" {
  description = "Route 53 hosted zone ID (useful for adding additional records in the env stack)."
  value       = data.aws_route53_zone.this.zone_id
}

# ---------------------------------------------------------------------------
# Deferred — API custom domain
# ---------------------------------------------------------------------------
# API clients currently use the ECS Express Lambda Function URL (.on.aws).
# When a custom api.<zone_name> domain is needed, add a second dns-acm module
# call (or extend this module) with a separate ACM cert + Route 53 ALIAS.
# No api.<zone_name> records or ACM certs are created by this module.

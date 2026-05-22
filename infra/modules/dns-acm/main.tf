# ---------------------------------------------------------------------------
# Provider alias — ACM certificates for CloudFront MUST be in us-east-1
# regardless of the caller's default region.
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Locals
# ---------------------------------------------------------------------------

locals {
  app_fqdn = "app.${var.zone_name}"
}

# ---------------------------------------------------------------------------
# Data — look up the existing Route 53 hosted zone (do NOT create it)
# ---------------------------------------------------------------------------

data "aws_route53_zone" "this" {
  name         = var.zone_name
  private_zone = false
}

# ---------------------------------------------------------------------------
# ACM certificate — must live in us-east-1 for CloudFront
# ---------------------------------------------------------------------------

resource "aws_acm_certificate" "app" {
  provider = aws.us_east_1

  domain_name       = local.app_fqdn
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-acm-app"
  })
}

# ---------------------------------------------------------------------------
# Route 53 DNS validation records
# ---------------------------------------------------------------------------

resource "aws_route53_record" "acm_validation" {
  for_each = {
    for dvo in aws_acm_certificate.app.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      type   = dvo.resource_record_type
      record = dvo.resource_record_value
    }
  }

  zone_id = data.aws_route53_zone.this.zone_id
  name    = each.value.name
  type    = each.value.type
  ttl     = 60
  records = [each.value.record]

  allow_overwrite = true
}

# ---------------------------------------------------------------------------
# ACM certificate validation — waits for DNS propagation
# ---------------------------------------------------------------------------

resource "aws_acm_certificate_validation" "app" {
  provider = aws.us_east_1

  certificate_arn         = aws_acm_certificate.app.arn
  validation_record_fqdns = [for r in aws_route53_record.acm_validation : r.fqdn]
}

# ---------------------------------------------------------------------------
# Route 53 ALIAS record — app.<zone> → CloudFront distribution
#
# NOTE: API custom domains are intentionally deferred.
# API clients use the ECS Express Lambda Function URL (.on.aws) directly.
# No api.<zone> records or ACM certs are created here.
# ---------------------------------------------------------------------------

resource "aws_route53_record" "app" {
  zone_id = data.aws_route53_zone.this.zone_id
  name    = local.app_fqdn
  type    = "A"

  alias {
    name                   = var.cloudfront_domain_name
    zone_id                = "Z2FDTNDATAQYW2" # CloudFront hosted zone ID (constant for all distributions)
    evaluate_target_health = false
  }
}

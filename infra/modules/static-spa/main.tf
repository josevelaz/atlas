# ---------------------------------------------------------------------------
# Locals
# ---------------------------------------------------------------------------

locals {
  # Normalise prefix: strip trailing slash for use in OAC path conditions.
  # An empty prefix means the distribution owns the bucket root.
  prefix_stripped = trimsuffix(var.s3_key_prefix, "/")

  # S3 origin path: CloudFront prepends this to every request before hitting S3.
  # Must start with '/' or be empty.
  origin_path = local.prefix_stripped != "" ? "/${local.prefix_stripped}" : ""

  # Unique logical ID for the S3 origin inside this distribution.
  origin_id = "s3-${var.bucket_name}"

  # Viewer protocol policy — HTTPS only everywhere.
  viewer_protocol_policy = "redirect-to-https"

  common_tags = merge(var.tags, {
    Environment = var.environment
    ManagedBy   = "terraform"
    Module      = "static-spa"
  })
}

# ---------------------------------------------------------------------------
# S3 Bucket
# ---------------------------------------------------------------------------

resource "aws_s3_bucket" "this" {
  bucket = var.bucket_name

  tags = local.common_tags
}

resource "aws_s3_bucket_versioning" "this" {
  bucket = aws_s3_bucket.this.id

  versioning_configuration {
    # Enabled for production; suspended for nonprod to avoid storage costs.
    status = var.environment == "production" ? "Enabled" : "Suspended"
  }
}

# Block ALL public access — objects are served exclusively via CloudFront OAC.
resource "aws_s3_bucket_public_access_block" "this" {
  bucket = aws_s3_bucket.this.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Enforce TLS-only access at the bucket level.
resource "aws_s3_bucket_policy" "this" {
  bucket = aws_s3_bucket.this.id

  # Depends on the public-access block being applied first so Terraform
  # doesn't race against the block when setting the policy.
  depends_on = [aws_s3_bucket_public_access_block.this]

  policy = data.aws_iam_policy_document.bucket_policy.json
}

data "aws_iam_policy_document" "bucket_policy" {
  # Allow CloudFront OAC to read objects under the scoped prefix.
  statement {
    sid    = "AllowCloudFrontOACRead"
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    actions = ["s3:GetObject"]

    # Scope to the prefix when one is configured; otherwise allow the full bucket.
    resources = local.prefix_stripped != "" ? [
      "${aws_s3_bucket.this.arn}/${local.prefix_stripped}/*"
    ] : ["${aws_s3_bucket.this.arn}/*"]

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.this.arn]
    }
  }

  # Deny any non-TLS request to the bucket.
  statement {
    sid    = "DenyNonTLS"
    effect = "Deny"

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    actions = ["s3:*"]

    resources = [
      aws_s3_bucket.this.arn,
      "${aws_s3_bucket.this.arn}/*",
    ]

    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

# ---------------------------------------------------------------------------
# CloudFront Origin Access Control (OAC)
# ---------------------------------------------------------------------------

resource "aws_cloudfront_origin_access_control" "this" {
  name                              = "${var.environment}-spa-oac"
  description                       = "OAC for ${var.environment} SPA — bucket ${var.bucket_name}"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# ---------------------------------------------------------------------------
# CloudFront Cache Policies
# ---------------------------------------------------------------------------

# Hashed assets (assets/*): cache for 1 year, immutable.
resource "aws_cloudfront_cache_policy" "hashed_assets" {
  name        = "${var.environment}-spa-hashed-assets"
  comment     = "1-year TTL for content-hashed SPA assets (${var.environment})"
  default_ttl = 31536000 # 1 year
  max_ttl     = 31536000
  min_ttl     = 31536000

  parameters_in_cache_key_and_forwarded_to_origin {
    cookies_config {
      cookie_behavior = "none"
    }
    headers_config {
      header_behavior = "none"
    }
    query_strings_config {
      query_string_behavior = "none"
    }
    enable_accept_encoding_brotli = true
    enable_accept_encoding_gzip   = true
  }
}

# index.html: no-cache so new deployments are picked up immediately.
resource "aws_cloudfront_cache_policy" "no_cache" {
  name        = "${var.environment}-spa-no-cache"
  comment     = "No-cache for index.html (${var.environment})"
  default_ttl = 0
  max_ttl     = 0
  min_ttl     = 0

  parameters_in_cache_key_and_forwarded_to_origin {
    cookies_config {
      cookie_behavior = "none"
    }
    headers_config {
      header_behavior = "none"
    }
    query_strings_config {
      query_string_behavior = "none"
    }
    enable_accept_encoding_brotli = true
    enable_accept_encoding_gzip   = true
  }
}

# ---------------------------------------------------------------------------
# CloudFront Distribution
# ---------------------------------------------------------------------------

resource "aws_cloudfront_distribution" "this" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "${var.environment} SPA — ${var.bucket_name}"
  default_root_object = "index.html"
  price_class         = var.price_class

  # Custom domain aliases (optional — requires ACM cert in us-east-1).
  aliases = var.aliases

  # ---- Origin: private S3 bucket via OAC ----
  origin {
    domain_name              = aws_s3_bucket.this.bucket_regional_domain_name
    origin_id                = local.origin_id
    origin_path              = local.origin_path
    origin_access_control_id = aws_cloudfront_origin_access_control.this.id
  }

  # ---- Default cache behaviour: index.html (no-cache) ----
  default_cache_behavior {
    target_origin_id       = local.origin_id
    viewer_protocol_policy = local.viewer_protocol_policy
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true
    cache_policy_id        = aws_cloudfront_cache_policy.no_cache.id
  }

  # ---- Ordered cache behaviour: hashed assets (1-year TTL) ----
  ordered_cache_behavior {
    path_pattern           = "assets/*"
    target_origin_id       = local.origin_id
    viewer_protocol_policy = local.viewer_protocol_policy
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true
    cache_policy_id        = aws_cloudfront_cache_policy.hashed_assets.id
  }

  # ---- SPA routing: 403/404 → /index.html with 200 ----
  # S3 returns 403 (not 404) for missing keys when the bucket is private.
  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  # ---- TLS ----
  dynamic "viewer_certificate" {
    for_each = length(var.aliases) > 0 && var.acm_certificate_arn != null ? [1] : []
    content {
      acm_certificate_arn      = var.acm_certificate_arn
      ssl_support_method       = "sni-only"
      minimum_protocol_version = "TLSv1.2_2021"
    }
  }

  dynamic "viewer_certificate" {
    for_each = length(var.aliases) == 0 || var.acm_certificate_arn == null ? [1] : []
    content {
      cloudfront_default_certificate = true
    }
  }

  # ---- Geo restrictions (none) ----
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  tags = local.common_tags

  # The bucket policy references the distribution ARN, so the distribution
  # must be created before the policy is applied.
  depends_on = [
    aws_cloudfront_origin_access_control.this,
    aws_cloudfront_cache_policy.hashed_assets,
    aws_cloudfront_cache_policy.no_cache,
  ]
}

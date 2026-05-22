# ---------------------------------------------------------------------------
# Example S3 backend configuration (native locking — no DynamoDB required).
# Copy the block below into a backend.tf (or uncomment here) and fill in your
# bucket/region before running `terraform init`.
#
# terraform {
#   backend "s3" {
#     bucket       = "hay-terraform-state"
#     key          = "env/production/terraform.tfstate"
#     region       = "us-east-1"
#     use_lockfile = true   # S3 native locking (Terraform >= 1.10)
#   }
# }
# ---------------------------------------------------------------------------

terraform {
  required_version = ">= 1.9.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 6.43.0"
    }
    turso = {
      source  = "turso-community/turso"
      version = ">= 0.2.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"

  default_tags {
    tags = {
      app        = "hay"
      env        = "production"
      managed-by = "terraform"
      owner      = "platform"
    }
  }
}

# Alias required by the dns-acm module (ACM certs must be in us-east-1 for CloudFront).
# Since this stack already targets us-east-1, the alias simply mirrors the default provider.
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = {
      app        = "hay"
      env        = "production"
      managed-by = "terraform"
      owner      = "platform"
    }
  }
}

provider "turso" {}

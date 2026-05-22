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
}

# Alias required by the dns-acm module (ACM certs must be in us-east-1 for CloudFront).
# Since this stack already targets us-east-1, the alias simply mirrors the default provider.
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

# ---------------------------------------------------------------------------
# Example S3 backend configuration (native locking — no DynamoDB required).
# Copy the block below into a backend.tf (or uncomment here) and fill in your
# bucket/region before running `terraform init`.
#
# terraform {
#   backend "s3" {
#     bucket       = "hay-terraform-state"
#     key          = "preview/pr-${var.pr_number}/terraform.tfstate"
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

  # Preview-specific default tags.
  # pr-number and ttl are set here so every resource in the preview stack
  # is discoverable by the tag-based cleanup job without any per-resource wiring.
  # The actual values are injected at plan/apply time via TF_VAR_pr_number.
  default_tags {
    tags = {
      app        = "hay"
      env        = "preview"
      managed-by = "terraform"
      owner      = "platform"
      ttl        = "cleanup"
    }
  }
}

provider "turso" {}

terraform {
  required_version = ">= 1.9.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 6.43.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"

  default_tags {
    tags = {
      app        = "hay"
      env        = "global"
      managed-by = "terraform"
      owner      = "platform"
    }
  }
}

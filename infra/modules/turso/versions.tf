terraform {
  required_version = ">= 1.9.0"

  required_providers {
    turso = {
      source  = "turso-community/turso"
      version = ">= 0.2.0"
    }
  }
}

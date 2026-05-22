terraform {
  # Bootstrap stack intentionally uses local backend.
  # After first apply, migrate state to the bucket it creates:
  #   terraform init -migrate-state
  backend "local" {}
}

module "remote_state" {
  source = "../modules/remote-state"

  bucket_name = var.bucket_name

  tags = {
    Project   = "hay"
    ManagedBy = "terraform"
    Stack     = "bootstrap"
  }
}

# ECR repository — shared across all environments.
# Images are pushed by GitHub Actions (see IAM notes below) and pulled by ECS tasks.
#
# GitHub Actions push role requires the following permissions on this repository:
#   - ecr:GetAuthorizationToken          (on "*")
#   - ecr:BatchCheckLayerAvailability    (on repository ARN)
#   - ecr:InitiateLayerUpload            (on repository ARN)
#   - ecr:UploadLayerPart                (on repository ARN)
#   - ecr:CompleteLayerUpload            (on repository ARN)
#   - ecr:PutImage                       (on repository ARN)
# Actual IAM policy attachment is wired in task 4.3 (github-oidc / deploy role).
module "ecr" {
  source = "../modules/ecr"

  name = var.ecr_repository_name

  tags = {
    Project   = "hay"
    ManagedBy = "terraform"
    Stack     = "bootstrap"
  }
}

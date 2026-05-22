# ---------------------------------------------------------------------------
# GitHub Actions OIDC provider
#
# Created once in the bootstrap stack and shared by all three deploy roles.
# The thumbprint list is the SHA-1 fingerprint of the GitHub OIDC root CA.
# AWS validates the OIDC token signature independently of this thumbprint
# for well-known providers (GitHub is on the allow-list), but the thumbprint
# is still required by the API.
#
# Audience: sts.amazonaws.com
# This is the AWS-recommended audience for OIDC federation with IAM.
# ---------------------------------------------------------------------------

resource "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"

  # AWS-recommended audience for GitHub OIDC → IAM federation.
  client_id_list = ["sts.amazonaws.com"]

  # SHA-1 thumbprint of the GitHub OIDC root CA certificate.
  # GitHub rotated this in 2023; the value below is current as of 2026-05.
  # Re-verify with:
  #   openssl s_client -connect token.actions.githubusercontent.com:443 \
  #     -showcerts </dev/null 2>/dev/null \
  #     | openssl x509 -fingerprint -noout -sha1
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]

  tags = {
    ManagedBy = "terraform"
    Purpose   = "github-actions-oidc"
  }
}

# ---------------------------------------------------------------------------
# Deploy roles (module)
# ---------------------------------------------------------------------------

module "github_oidc_roles" {
  source = "../modules/github-oidc"

  github_org        = "josevelaz"
  github_repo       = "hay"
  oidc_provider_arn = aws_iam_openid_connect_provider.github.arn

  preview_role_name    = "preview-deploy"
  staging_role_name    = "staging-deploy"
  production_role_name = "production-deploy"

  tags = {
    ManagedBy = "terraform"
    Repo      = "josevelaz/hay"
  }
}

# ---------------------------------------------------------------------------
# Bootstrap stack outputs
#
# Role ARNs are the primary consumer-facing outputs — store them as GitHub
# Actions secrets/variables after the first `terraform apply`.
#
# Usage in a GitHub Actions workflow:
#
#   - uses: aws-actions/configure-aws-credentials@v4
#     with:
#       role-to-assume: ${{ vars.PREVIEW_DEPLOY_ROLE_ARN }}
#       aws-region: us-east-1
# ---------------------------------------------------------------------------

output "github_oidc_provider_arn" {
  description = "ARN of the GitHub Actions OIDC provider. Reference this when adding new roles outside this module."
  value       = aws_iam_openid_connect_provider.github.arn
}

output "preview_deploy_role_arn" {
  description = "ARN for the preview-deploy role. Store as GitHub Actions variable PREVIEW_DEPLOY_ROLE_ARN."
  value       = module.github_oidc_roles.preview_role_arn
}

output "staging_deploy_role_arn" {
  description = "ARN for the staging-deploy role. Store as GitHub Actions variable STAGING_DEPLOY_ROLE_ARN."
  value       = module.github_oidc_roles.staging_role_arn
}

output "production_deploy_role_arn" {
  description = "ARN for the production-deploy role. Store as GitHub Actions secret PRODUCTION_DEPLOY_ROLE_ARN."
  value       = module.github_oidc_roles.production_role_arn
  sensitive   = true
}

# ---------------------------------------------------------------------------
# Secret ARN outputs — consumed by the ECS task definition module to inject
# secrets as environment variables via the ECS secrets injection mechanism.
# ---------------------------------------------------------------------------

output "secret_arns" {
  description = "Map of logical secret name → ARN. Pass to the ECS task definition secrets block."
  value = {
    better_auth_secret   = aws_secretsmanager_secret.better_auth_secret.arn
    turso_auth_token     = aws_secretsmanager_secret.turso_auth_token.arn
    turso_database_url   = aws_secretsmanager_secret.turso_database_url.arn
    cors_allowed_origins = aws_secretsmanager_secret.cors_allowed_origins.arn
    better_auth_url      = aws_secretsmanager_secret.better_auth_url.arn
  }
}

output "secret_names" {
  description = "Map of logical secret name → Secrets Manager path. Useful for seeding scripts."
  value = {
    better_auth_secret   = aws_secretsmanager_secret.better_auth_secret.name
    turso_auth_token     = aws_secretsmanager_secret.turso_auth_token.name
    turso_database_url   = aws_secretsmanager_secret.turso_database_url.name
    cors_allowed_origins = aws_secretsmanager_secret.cors_allowed_origins.name
    better_auth_url      = aws_secretsmanager_secret.better_auth_url.name
  }
}

output "ecs_read_secrets_policy_arn" {
  description = "ARN of the IAM policy granting the ECS task role read access to hay/{env}/* secrets."
  value       = aws_iam_policy.ecs_read_secrets.arn
}

# ---------------------------------------------------------------------------
# Turso database module
#
# Creates a single Turso database inside an existing group.
#
# IMPORTANT — auth tokens are NOT managed here:
#   Turso auth tokens cannot be created or rotated through Terraform without
#   embedding the token value in Terraform state, which is a security risk.
#   Tokens must be created out-of-band (see README.md § Turso token rotation)
#   and stored in AWS Secrets Manager manually or via the seed workflow.
#
# The database URL (libsql://<hostname>) is exposed as an output so callers
# can write it to Secrets Manager using the secrets module.
# ---------------------------------------------------------------------------

resource "turso_database" "this" {
  name  = var.database_name
  group = var.group_name

  # Optional size cap — omit the attribute entirely when null so the Turso
  # plan default applies (avoids a spurious diff on every plan).
  size_limit = var.size_limit
}

output "database_name" {
  description = "The Turso database name."
  value       = turso_database.this.name
}

output "database_url" {
  description = "libSQL connection URL for the database (libsql://<hostname>). Store this in Secrets Manager — do NOT embed it in application config directly."
  value       = "libsql://${turso_database.this.database.hostname}"
}

output "hostname" {
  description = "Raw DNS hostname of the database (without the libsql:// scheme). Useful when constructing custom connection strings."
  value       = turso_database.this.database.hostname
}

output "database_id" {
  description = "Turso database UUID."
  value       = turso_database.this.database.db_id
}

output "primary_region" {
  description = "Primary region location code for the group this database belongs to."
  value       = turso_database.this.database.primary_region
}

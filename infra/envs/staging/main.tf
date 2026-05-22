# ---------------------------------------------------------------------------
# Staging environment stack
#
# Module call order:
#   1. network    — VPC, subnets, security groups
#   2. redis      — ElastiCache Serverless cluster
#   3. ecs_api    — ECS Express Gateway service (creates task role)
#   4. secrets    — secret name/ARN placeholders + ECS task role read policy
#   5. dns_acm    — Route 53 + ACM certificate
#   6. static_spa — S3 + CloudFront for the web SPA
#   7. turso      — Turso database (auth token managed out-of-band)
#
# The secrets module requires the ECS task role to already exist.
# ecs_api creates the role; secrets attaches the read policy to it.
#
# Tagging strategy:
#   Required tags (app, env, managed-by, owner) are applied via provider
#   default_tags in versions.tf — no per-resource repetition needed.
#   Module tags = {} passes an empty map; modules merge it with Name tags.
# ---------------------------------------------------------------------------

module "network" {
  source = "../../modules/network"

  name_prefix   = "hay-staging"
  is_production = false
  tags          = {}
}

module "redis" {
  source = "../../modules/redis"

  name_prefix             = "hay-staging"
  vpc_id                  = module.network.vpc_id
  subnet_ids              = module.network.private_subnet_ids
  ecs_security_group_id   = module.network.ecs_security_group_id
  redis_security_group_id = module.network.redis_security_group_id

  # Nonprod: minimal capacity, 1-day snapshot retention
  max_ecpu_per_second     = 5000
  max_storage_gb          = 5
  snapshot_retention_days = 1

  tags = {}
}

module "ecs_api" {
  source = "../../modules/ecs-express-api"

  name_prefix = "hay-staging"
  env         = "staging"
  image_uri   = var.api_image_uri

  vpc_id             = module.network.vpc_id
  subnet_ids         = module.network.private_subnet_ids
  security_group_ids = [module.network.ecs_security_group_id]

  redis_host       = module.redis.primary_endpoint
  redis_port       = module.redis.port
  redis_key_prefix = "hay:staging:"

  s3_bucket     = module.static_spa.s3_bucket_name
  s3_bucket_arn = module.static_spa.s3_bucket_arn
  s3_region     = "us-east-1"

  cache_arn = module.redis.cache_arn

  # Staging: 30-day log retention
  log_retention_days = 30
  is_preview         = false

  tags = {}
}

module "secrets" {
  source = "../../modules/secrets"

  env                = "staging"
  ecs_task_role_name = module.ecs_api.task_role_name
  is_preview         = false

  tags = {}
}

module "dns_acm" {
  source = "../../modules/dns-acm"

  zone_name              = var.staging_zone_name
  cloudfront_domain_name = module.static_spa.cloudfront_domain_name
  name_prefix            = "hay-staging"
  tags                   = {}

  providers = {
    aws.us_east_1 = aws.us_east_1
  }
}

# ---------------------------------------------------------------------------
# Static SPA — staging
# Shares the nonprod bucket (hay-web-nonprod) with a 'staging/' prefix.
# ---------------------------------------------------------------------------
module "static_spa" {
  source = "../../modules/static-spa"

  environment   = "staging"
  bucket_name   = "hay-web-nonprod"
  s3_key_prefix = "staging/"

  tags = {}
}

# ---------------------------------------------------------------------------
# Turso database — staging
#
# The group (var.turso_group_name) must already exist in the Turso organisation
# before applying this stack. Create it once with:
#   turso group create hay-staging --location iad
#
# Auth token is NOT managed here — see infra/README.md § Turso token rotation.
# ---------------------------------------------------------------------------
module "turso" {
  source = "../../modules/turso"

  database_name = "hay-staging"
  group_name    = var.turso_group_name
}

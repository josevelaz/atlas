# ---------------------------------------------------------------------------
# Security Group — Redis / Valkey
# ---------------------------------------------------------------------------
# When var.redis_security_group_id is provided (e.g. from the network module),
# the module reuses that SG and skips creating its own.
# When null, the module creates and fully manages its own SG.
#
# The SG accepts inbound on 6379 only from the ECS task security group.

locals {
  # Resolve which SG ID to attach to the cache
  sg_id = var.redis_security_group_id != null ? var.redis_security_group_id : aws_security_group.redis[0].id
}

resource "aws_security_group" "redis" {
  count = var.redis_security_group_id == null ? 1 : 0

  name        = "${var.name_prefix}-redis"
  description = "ElastiCache Serverless (Valkey) — inbound from ECS tasks only"
  vpc_id      = var.vpc_id

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-redis"
  })
}

resource "aws_vpc_security_group_ingress_rule" "redis_from_ecs" {
  count = var.redis_security_group_id == null ? 1 : 0

  security_group_id            = aws_security_group.redis[0].id
  description                  = "Allow Valkey TLS from ECS task security group"
  from_port                    = 6379
  to_port                      = 6379
  ip_protocol                  = "tcp"
  referenced_security_group_id = var.ecs_security_group_id

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-redis-from-ecs"
  })
}

# ---------------------------------------------------------------------------
# ElastiCache Serverless Cache — Valkey engine
# ---------------------------------------------------------------------------
# IAM authentication is the ONLY auth mechanism.
# TLS is always enabled on ElastiCache Serverless (non-configurable, enforced).
# No auth tokens, no Secrets Manager entries for tokens.
#
# NOTE: ECS task role must have elasticache:Connect on this cache ARN.
#       Wire this permission in the ECS/IAM module (task 4.11).

resource "aws_elasticache_serverless_cache" "this" {
  engine = "valkey"
  name   = "${var.name_prefix}-cache"

  # Capacity limits — serverless scales within these bounds
  cache_usage_limits {
    ecpu_per_second {
      maximum = var.max_ecpu_per_second
    }
    data_storage {
      maximum = var.max_storage_gb
      unit    = "GB"
    }
  }

  # Network placement
  subnet_ids         = var.subnet_ids
  security_group_ids = [local.sg_id]

  # Durability
  snapshot_retention_limit = var.snapshot_retention_days

  # TLS is always enabled on ElastiCache Serverless — no explicit flag needed.
  # IAM authentication is enabled by default on Valkey serverless caches.
  # Do NOT set any auth_token or user_group_id — IAM-only auth.

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-cache"
  })
}

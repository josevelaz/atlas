# ---------------------------------------------------------------------------
# Data
# ---------------------------------------------------------------------------

data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  vpc_cidr = var.is_production ? "10.0.0.0/16" : "10.1.0.0/16"

  # Slice to the requested AZ count
  azs = slice(data.aws_availability_zones.available.names, 0, var.az_count)

  # Carve /24 subnets out of the /16
  # Public:  10.x.0.0/24, 10.x.1.0/24, …
  # Private: 10.x.10.0/24, 10.x.11.0/24, …
  public_cidrs  = [for i in range(var.az_count) : cidrsubnet(local.vpc_cidr, 8, i)]
  private_cidrs = [for i in range(var.az_count) : cidrsubnet(local.vpc_cidr, 8, i + 10)]
}

# ---------------------------------------------------------------------------
# VPC
# ---------------------------------------------------------------------------

resource "aws_vpc" "this" {
  cidr_block           = local.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name = "${var.name_prefix}-vpc"
  }
}

# ---------------------------------------------------------------------------
# Internet Gateway
# ---------------------------------------------------------------------------

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id

  tags = {
    Name = "${var.name_prefix}-igw"
  }
}

# ---------------------------------------------------------------------------
# Public subnets
# ---------------------------------------------------------------------------

resource "aws_subnet" "public" {
  count = var.az_count

  vpc_id                  = aws_vpc.this.id
  cidr_block              = local.public_cidrs[count.index]
  availability_zone       = local.azs[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name = "${var.name_prefix}-public-${local.azs[count.index]}"
    Tier = "public"
  }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.this.id
  }

  tags = {
    Name = "${var.name_prefix}-rt-public"
  }
}

resource "aws_route_table_association" "public" {
  count = var.az_count

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# ---------------------------------------------------------------------------
# NAT Gateway (one per AZ for HA; single for nonprod to save cost)
# ---------------------------------------------------------------------------

resource "aws_eip" "nat" {
  count  = var.is_production ? var.az_count : 1
  domain = "vpc"

  tags = {
    Name = "${var.name_prefix}-eip-nat-${count.index}"
  }
}

resource "aws_nat_gateway" "this" {
  count = var.is_production ? var.az_count : 1

  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  tags = {
    Name = "${var.name_prefix}-nat-${count.index}"
  }

  depends_on = [aws_internet_gateway.this]
}

# ---------------------------------------------------------------------------
# Private subnets
# ---------------------------------------------------------------------------

resource "aws_subnet" "private" {
  count = var.az_count

  vpc_id            = aws_vpc.this.id
  cidr_block        = local.private_cidrs[count.index]
  availability_zone = local.azs[count.index]

  tags = {
    Name = "${var.name_prefix}-private-${local.azs[count.index]}"
    Tier = "private"
  }
}

resource "aws_route_table" "private" {
  # One route table per NAT GW; nonprod reuses the single NAT for all AZs
  count = var.is_production ? var.az_count : 1

  vpc_id = aws_vpc.this.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.this[count.index].id
  }

  tags = {
    Name = "${var.name_prefix}-rt-private-${count.index}"
  }
}

resource "aws_route_table_association" "private" {
  count = var.az_count

  subnet_id = aws_subnet.private[count.index].id
  # Prod: each AZ gets its own RT; nonprod: all AZs share RT index 0
  route_table_id = var.is_production ? aws_route_table.private[count.index].id : aws_route_table.private[0].id
}

# ---------------------------------------------------------------------------
# Security Groups
# ---------------------------------------------------------------------------

resource "aws_security_group" "ecs" {
  name        = "${var.name_prefix}-ecs-sg"
  description = "Allow outbound traffic from ECS tasks; inbound from ALB (added by consumers)."
  vpc_id      = aws_vpc.this.id

  egress {
    description = "Allow all outbound (ECR pulls, API calls, etc.)"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.name_prefix}-ecs-sg"
  }
}

resource "aws_security_group" "redis" {
  name        = "${var.name_prefix}-redis-sg"
  description = "Allow Redis port only from ECS security group."
  vpc_id      = aws_vpc.this.id

  ingress {
    description     = "Redis from ECS tasks"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]
  }

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.name_prefix}-redis-sg"
  }
}

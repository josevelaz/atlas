resource "aws_ecr_repository" "this" {
  name                 = var.name
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = var.tags
}

resource "aws_ecr_lifecycle_policy" "this" {
  repository = aws_ecr_repository.this.name

  policy = jsonencode({
    rules = [
      {
        # Rule 1: expire untagged images after 1 day
        rulePriority = 1
        description  = "Expire untagged images after ${var.untagged_expiry_days} day(s)"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = var.untagged_expiry_days
        }
        action = {
          type = "expire"
        }
      },
      {
        # Rule 2: keep only the last N tagged images
        rulePriority = 2
        description  = "Keep last ${var.max_tagged_images} tagged images"
        selection = {
          tagStatus   = "tagged"
          tagPatternList = ["*"]
          countType   = "imageCountMoreThan"
          countNumber = var.max_tagged_images
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

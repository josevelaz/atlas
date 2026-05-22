# Decision Record: ECS Express API Custom Domain Spike

Date: 2026-05-22
Status: Decided
Task: 0.5/108 — ECS Express API Custom Domain Spike

## Decision

**Defer API custom domains. Use ECS Express generated `.on.aws` URL initially. Switch to raw ECS/ALB only if/when API custom domains become required.**

The Phase 0 outcome is to keep ECS Express as the initial API deployment path and expose the generated service endpoint from Terraform outputs. Initial staging, production, and preview clients use that generated `.on.aws` URL rather than `api.<zone>`.

The plan must switch the API service to raw ECS/ALB Terraform only if `api.staging.example.com`, `api.<prod-zone>`, or another HTTPS custom API domain becomes required and must be safely/fully Terraform-managed.

ECS Express can expose a generated service endpoint, and Terraform exposes that endpoint through `ingress_paths[*].endpoint`, but neither the ECS Express API nor Terraform's `aws_ecs_express_gateway_service` resource exposes the underlying ALB ARN, ALB hosted zone ID, listener ARN, target group ARN, or certificate configuration needed for first-class Route53/ACM/ALB custom-domain management.

## Findings

### 1. Can a custom domain be attached to an ECS Express service endpoint in a fully Terraform-managed, drift-safe way?

**No — not as a first-class HTTPS custom domain.**

ECS Express is intentionally an abstraction over managed infrastructure. AWS documents `CreateExpressGatewayService` as creating an Express service that automatically provisions and configures **Application Load Balancers, target groups, security groups, and auto-scaling policies**. The API takes application-level fields such as container image, port, health check, network configuration, scaling target, roles, and tags; it does **not** take a custom domain, ACM certificate ARN, listener ARN, listener certificate, or hosted zone input.

Terraform mirrors this abstraction. `aws_ecs_express_gateway_service` manages the Express service and exposes only service-level values plus `ingress_paths`; it does not expose the underlying ALB/listener resources required for safe custom-domain ownership.

Therefore, a Terraform configuration cannot model the full desired state for:

- ACM certificate validation and attachment to the generated listener.
- Route53 alias target hosted zone ID for the generated ALB.
- ALB listener rules/certificates owned by Terraform without reaching behind ECS Express.

### 2. Exact mechanisms available

#### Route53 alias to generated ALB

**Not safely available from `aws_ecs_express_gateway_service`.**

Route53 alias records to an ALB require the ALB DNS name and hosted zone ID. ECS Express/Terraform exposes an ingress endpoint string, but not the ALB ARN or canonical hosted zone ID. Without those outputs, a clean Terraform alias record cannot be built directly from the Express resource.

One could attempt discovery by tags/names using `aws_lb` data sources, but that relies on implementation details of ECS Express-managed resources and is not a stable ownership boundary.

#### CNAME to generated endpoint

**Technically possible for a non-zone-apex DNS name if the endpoint is DNS-like, but not sufficient for a safe HTTPS API custom domain.**

`aws_ecs_express_gateway_service.ingress_paths[*].endpoint` can be referenced by Terraform, so a subdomain CNAME such as `api.staging.example.com CNAME <generated-endpoint>` may be mechanically possible.

However, CNAME only changes DNS. It does not attach `api.staging.example.com` to the ALB listener or certificate. For HTTPS, clients send SNI/Host as `api.staging.example.com`; the Express-managed listener would need a certificate valid for that name. ECS Express exposes no certificate/custom-domain input, so this is expected to fail TLS validation unless AWS separately provides custom-domain support outside the documented/visible API surface.

CNAME may be acceptable only for a temporary HTTP-only endpoint or for clients that deliberately use the generated hostname, neither of which satisfies normal production/staging API custom-domain expectations.

#### ALB listener rule modification

**Possible only by modifying ECS Express-managed resources out-of-band; not recommended.**

Because ECS Express manages the ALB/listeners/target groups through the infrastructure role, directly managing those same resources with Terraform creates split ownership. ECS Express updates/deletions can change, replace, or remove those resources, and Terraform would not have a stable parent resource graph from the Express service to the ALB/listener/certificate.

#### Other mechanisms

No documented ECS Express API/Terraform mechanism was found for:

- `custom_domain_name`
- `certificate_arn`
- `listener_arn`
- `load_balancer_arn`
- `load_balancer_dns_name`
- `load_balancer_zone_id`
- `target_group_arn`

If AWS later adds these fields to ECS Express or the Terraform provider, the decision can be revisited.

### 3. Does `aws_ecs_express_gateway_service` expose generated ALB/listener values?

**No.**

Terraform AWS Provider v6.33.0 documents these exported attributes for `aws_ecs_express_gateway_service`:

- `current_deployment`
- `ingress_paths`
- `service_arn`
- `service_revision_arn`
- `tags_all`

The provider's resource model defines `ingress_paths` as a list of objects with only:

- `access_type`
- `endpoint`

It does **not** expose:

- ALB ARN
- ALB DNS name as a load-balancer-specific attribute
- ALB canonical hosted zone ID
- listener ARN
- listener certificate ARN
- target group ARN

So Terraform can reference the generated ingress endpoint string, but cannot safely configure Route53 alias/ACM/listener resources around the generated ALB.

### 4. Risk of modifying underlying ECS Express-managed resources directly in Terraform

**High drift/conflict risk.**

AWS describes ECS Express as automatically provisioning and managing ALBs, target groups, security groups, and auto-scaling policies. The required `infrastructureRoleArn` grants ECS permission to create and manage those resources on behalf of the service. AWS also documents `DeleteExpressGatewayService` as deleting the Express service and removing all associated AWS resources including the ALB, target groups, security groups, and auto-scaling policies.

Managing those same ALB/listener/certificate resources directly in Terraform would create two controllers for one set of resources:

1. ECS Express, via the infrastructure role and Express service lifecycle.
2. Terraform, via explicit `aws_lb_listener`, `aws_lb_listener_certificate`, `aws_route53_record`, etc.

Expected failure modes:

- Terraform drift after ECS Express update/revision/deploy replaces or mutates managed resources.
- ECS Express deploy/delete removing resources Terraform still references.
- Terraform listener/certificate changes being overwritten or invalidated by ECS Express.
- Import/discovery hacks depending on undocumented tags/naming conventions.
- Hard-to-debug outage risk if Express recreates listeners or certificates during service updates.

This violates the intended ownership boundary of the Express abstraction.

### 5. Recommendation among options a-d

Selected for Phase 0: **d. Defer API custom domain** and use the ECS Express generated `.on.aws` endpoint initially.

Future path if API custom domains become required: **c. Switch API to raw ECS/ALB Terraform for full domain control.**

Option outcomes:

- **a. Keep ECS Express + Route53 alias to generated endpoint** — rejected because the resource does not expose ALB hosted zone ID/listener/cert details needed for a safe alias + HTTPS setup.
- **b. Keep ECS Express + CNAME to generated endpoint** — rejected for the API custom-domain requirement because DNS CNAME alone does not attach a valid TLS certificate or listener configuration for `api.staging.example.com`.
- **d. Defer API custom domain** — accepted for the initial deployment because the product can use the generated ECS Express endpoint temporarily.

## Implementation implication

Proceed with ECS Express for the initial API service and expose the generated `.on.aws` endpoint as the API URL Terraform output. Do not create `api.<zone>` DNS records, ACM certificates, CNAMEs, Route53 aliases, or out-of-band listener/certificate changes for the initial deployment.

If API custom domains become required later, switch to raw ECS/ALB Terraform for the API service:

- `aws_ecs_service` / task definition / target group
- `aws_lb`, `aws_lb_listener`, `aws_lb_listener_rule` as needed
- `aws_acm_certificate` + DNS validation
- `aws_route53_record` alias to ALB using `aws_lb.dns_name` and `aws_lb.zone_id`
- Explicit security groups, autoscaling, and health checks

The raw ECS/ALB path is the documented future path for API custom domains, not the current Phase 0 decision.

## Evidence / Sources

- AWS ECS API Reference — `CreateExpressGatewayService`: states that Express service creates managed infrastructure including ALBs, target groups, security groups, and auto-scaling policies; request fields do not include custom domain/certificate/listener fields.  
  https://docs.aws.amazon.com/AmazonECS/latest/APIReference/API_CreateExpressGatewayService.html

- AWS ECS API Reference — `DescribeExpressGatewayService`: response returns service details and `activeConfigurations[*].ingressPaths[*].endpoint`, but not ALB/listener/certificate ARNs or hosted zone IDs.  
  https://docs.aws.amazon.com/AmazonECS/latest/APIReference/API_DescribeExpressGatewayService.html

- AWS ECS API Reference — `IngressPathSummary`: ingress path contains only `accessType` and `endpoint`.  
  https://docs.aws.amazon.com/AmazonECS/latest/APIReference/API_IngressPathSummary.html

- AWS ECS API Reference — `DeleteExpressGatewayService`: deleting an Express service removes associated AWS resources including ALB, target groups, security groups, and auto-scaling policies.  
  https://docs.aws.amazon.com/AmazonECS/latest/APIReference/API_DeleteExpressGatewayService.html

- Terraform AWS Provider v6.33.0 — `aws_ecs_express_gateway_service`: exported attributes are `current_deployment`, `ingress_paths`, `service_arn`, `service_revision_arn`, and `tags_all`; no ALB/listener/certificate outputs.  
  https://github.com/hashicorp/terraform-provider-aws/blob/v6.33.0/website/docs/r/ecs_express_gateway_service.html.markdown

- Terraform AWS Provider v6.33.0 source — `ingressPathSummaryModel` contains only `access_type` and `endpoint`.  
  https://github.com/hashicorp/terraform-provider-aws/blob/v6.33.0/internal/service/ecs/express_gateway_service.go

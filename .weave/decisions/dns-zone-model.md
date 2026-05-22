# DNS zone model

## Decision

Terraform models production and staging DNS with required hosted zone variables:

- `prod_zone_name`
- `staging_zone_name`

These variables have no defaults. Exact hosted zone names are supplied at implementation time and are not hardcoded in the infrastructure configuration.

## Environment hostnames

Each environment uses a delegated Route 53 hosted zone, not the root domain. Hostnames are derived from the supplied zone name:

| Environment | Web hostname | API hostname |
| --- | --- | --- |
| Production | `app.<prod-zone>` | `api.<prod-zone>` |
| Staging | `app.<staging-zone>` | `api.<staging-zone>` |

The web frontend is served through CloudFront with an alias at `app.<zone>`.

The API hostname `api.<zone>` is reserved for future custom-domain use. Initially, the ECS Express API uses its generated `.on.aws` URL; API custom domain setup is deferred per the ECS Express custom domain spike decision.

Preview environments use generated CloudFront and ECS URLs only. They do not receive custom DNS names.

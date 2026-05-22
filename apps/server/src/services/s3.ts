import { S3Client } from "bun";
import { config } from "../config.ts";

// Build S3Client options. Credentials are intentionally omitted so Bun's S3Client
// falls back to the AWS SDK default credential provider chain:
//   1. AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY env vars (local dev / MinIO)
//   2. ECS task-role metadata endpoint (production)
//   3. EC2 instance profile, ~/.aws/credentials, etc.
//
// Only pass explicit credentials when the env vars are present (local dev / MinIO).
const credentialOverrides =
	config.S3_ACCESS_KEY_ID && config.S3_SECRET_ACCESS_KEY
		? {
				accessKeyId: config.S3_ACCESS_KEY_ID,
				secretAccessKey: config.S3_SECRET_ACCESS_KEY,
			}
		: {};

export const s3 = new S3Client({
	bucket: config.S3_BUCKET,
	region: config.S3_REGION,
	...(config.S3_ENDPOINT ? { endpoint: config.S3_ENDPOINT } : {}),
	...credentialOverrides,
});

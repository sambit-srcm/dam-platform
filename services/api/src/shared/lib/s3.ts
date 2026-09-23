import { S3Client } from '@aws-sdk/client-s3';
import { config } from '../../config.ts';

function client(endpoint: string) {
  return new S3Client({
    endpoint,
    region: 'us-east-1', // required by the SDK, ignored by MinIO
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.MINIO_ROOT_USER,
      secretAccessKey: config.MINIO_ROOT_PASSWORD,
    },
  });
}

// Server-side calls: create, list, complete, abort
export const s3 = client(
  `http://${config.MINIO_ENDPOINT}:${config.MINIO_API_PORT}`,
);

// Only for signing URLs the browser opens
export const s3Public = client(config.MINIO_PUBLIC_URL);

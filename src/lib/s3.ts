import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

// ── S3 client singleton ────────────────────────────────────────────────────────

// Lazy singleton — initialized on first use so Next.js build doesn't
// throw when AWS env vars aren't present at build time.
let _s3: S3Client | null = null;
export function getS3(): S3Client {
  if (!_s3) {
    if (!process.env.AWS_ACCESS_KEY_ID) throw new Error("AWS_ACCESS_KEY_ID is not set");
    if (!process.env.AWS_SECRET_ACCESS_KEY) throw new Error("AWS_SECRET_ACCESS_KEY is not set");
    if (!process.env.AWS_REGION) throw new Error("AWS_REGION is not set");
    _s3 = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
      // Newer AWS SDK versions auto-add x-amz-checksum-crc32 to signed
      // requests, which breaks browser presigned PUT (the XHR can't send it).
      // Only compute checksums when a command explicitly requires one.
      requestChecksumCalculation: "WHEN_REQUIRED",
    });
  }
  return _s3;
}

export const s3: S3Client = new Proxy({} as S3Client, {
  get(_t, prop) { return (getS3() as unknown as Record<string|symbol, unknown>)[prop]; },
});

export const S3_BUCKET = process.env.AWS_S3_BUCKET_NAME ?? "";

// ── Key helpers ────────────────────────────────────────────────────────────────

/**
 * Generate a unique storage key for a document upload.
 * Format: documents/{orgId}/{tenderId}/{uuid}.{ext}
 */
export function generateDocumentKey(
  orgId: string,
  tenderId: string,
  filename: string
): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "bin";
  const uuid = randomUUID();
  return `documents/${orgId}/${tenderId}/${uuid}.${ext}`;
}

/**
 * Generate the S3 key for processed document content.
 * Format: processed/{documentId}/content.json
 */
export function getProcessedContentKey(documentId: string): string {
  return `processed/${documentId}/content.json`;
}

/**
 * Generate the S3 key for exported proposals.
 * Format: exports/{orgId}/{proposalId}/{uuid}.{format}
 */
export function generateExportKey(
  orgId: string,
  proposalId: string,
  format: string
): string {
  const uuid = randomUUID();
  return `exports/${orgId}/${proposalId}/${uuid}.${format}`;
}

// ── Presigned URLs ─────────────────────────────────────────────────────────────

/**
 * Create a presigned URL for direct browser → S3 upload.
 * The file never passes through our server — better for large files.
 *
 * @param key      - S3 object key
 * @param mimeType - File MIME type (must match Content-Type header sent during upload)
 * @param expiresIn - Seconds until URL expires (default: 5 minutes)
 */
export async function createPresignedUploadUrl(
  key: string,
  mimeType: string,
  expiresIn = 300
): Promise<string> {
  // NOTE: do NOT sign extra headers (ServerSideEncryption, checksums) here —
  // the browser upload only sends Content-Type, so any other signed header
  // causes a SignatureDoesNotMatch 403. The bucket has default SSE-S3
  // encryption applied automatically at rest.
  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    ContentType: mimeType,
  });
  return getSignedUrl(s3, command, { expiresIn });
}

/**
 * Create a presigned URL for secure document download.
 * Default expiry: 15 minutes.
 */
export async function createPresignedDownloadUrl(
  key: string,
  filename?: string,
  expiresIn = 900
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    // Set Content-Disposition so browser downloads with original filename
    ResponseContentDisposition: filename
      ? `attachment; filename="${encodeURIComponent(filename)}"`
      : undefined,
  });
  return getSignedUrl(s3, command, { expiresIn });
}

// ── File operations ────────────────────────────────────────────────────────────

/**
 * Download a file from S3 and return it as a Buffer.
 * Used by the document processing pipeline.
 */
export async function downloadFromS3(key: string): Promise<Buffer> {
  const command = new GetObjectCommand({ Bucket: S3_BUCKET, Key: key });
  const response = await s3.send(command);

  if (!response.Body) throw new Error(`S3 object ${key} has no body`);

  const chunks: Uint8Array[] = [];
  // @ts-expect-error — S3 Body is a ReadableStream in AWS SDK v3
  for await (const chunk of response.Body) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * Upload a Buffer or string directly to S3.
 * Used by the processing pipeline to store extracted text.
 */
export async function uploadToS3(
  key: string,
  body: Buffer | string,
  contentType = "application/json"
): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
    ServerSideEncryption: "AES256",
  });
  await s3.send(command);
}

/**
 * Delete an object from S3.
 */
export async function deleteFromS3(key: string): Promise<void> {
  const command = new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key });
  await s3.send(command);
}

/**
 * Check if an object exists in S3.
 */
export async function existsInS3(key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

// ── Validation ─────────────────────────────────────────────────────────────────

export const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
]);

export const MIME_TO_EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/msword": "doc",
  "text/plain": "txt",
};

export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

export function validateFile(
  filename: string,
  mimeType: string,
  fileSizeBytes: number
): { valid: true } | { valid: false; error: string } {
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return {
      valid: false,
      error: `File type not supported. Allowed: PDF, DOCX, DOC, TXT`,
    };
  }
  if (fileSizeBytes > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds 50 MB limit`,
    };
  }
  return { valid: true };
}

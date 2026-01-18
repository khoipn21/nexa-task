import { randomUUID } from 'node:crypto'
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// Allowed MIME types for file uploads
export const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'application/x-rar-compressed',
  'text/plain',
  'text/csv',
])

// Max file size: 10MB
export const MAX_FILE_SIZE = 10 * 1024 * 1024

// S3 client - lazy initialization
let s3Client: S3Client | null = null

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: process.env.AWS_ACCESS_KEY_ID
        ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
          }
        : undefined,
    })
  }
  return s3Client
}

function getBucket(): string {
  return process.env.S3_BUCKET || 'nexa-task-uploads'
}

// Generate a unique storage key for a file
export function generateStorageKey(taskId: string, fileName: string): string {
  const ext = fileName.split('.').pop() || ''
  const uniqueId = randomUUID()
  const sanitizedName = fileName
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .substring(0, 100)
  return `attachments/${taskId}/${uniqueId}-${sanitizedName}`
}

// Validate MIME type
export function isValidMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.has(mimeType)
}

// Validate file size
export function isValidFileSize(size: number): boolean {
  return size > 0 && size <= MAX_FILE_SIZE
}

// Validate file by checking magic bytes (first few bytes of file)
export function validateFileMagicBytes(
  buffer: ArrayBuffer,
  declaredMimeType: string,
): boolean {
  const bytes = new Uint8Array(buffer.slice(0, 12))

  const signatures: Record<string, number[][]> = {
    'image/png': [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
    'image/jpeg': [[0xff, 0xd8, 0xff]],
    'image/gif': [
      [0x47, 0x49, 0x46, 0x38, 0x37, 0x61],
      [0x47, 0x49, 0x46, 0x38, 0x39, 0x61],
    ],
    'application/pdf': [[0x25, 0x50, 0x44, 0x46]],
    'application/zip': [[0x50, 0x4b, 0x03, 0x04]],
    'application/x-rar-compressed': [[0x52, 0x61, 0x72, 0x21]],
  }

  const expected = signatures[declaredMimeType]
  if (!expected) {
    // For types without signature validation (text files, office docs), allow
    return true
  }

  return expected.some((sig) => sig.every((byte, i) => bytes[i] === byte))
}

// Generate presigned URL for uploading a file
export async function getUploadPresignedUrl(
  key: string,
  mimeType: string,
  fileSize: number,
): Promise<{ uploadUrl: string; publicUrl: string }> {
  const client = getS3Client()
  const bucket = getBucket()

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: mimeType,
    ContentLength: fileSize,
  })

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 3600 })
  const publicUrl = `https://${bucket}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`

  return { uploadUrl, publicUrl }
}

// Generate presigned URL for downloading a file
export async function getDownloadPresignedUrl(key: string): Promise<string> {
  const client = getS3Client()
  const bucket = getBucket()

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  })

  return getSignedUrl(client, command, { expiresIn: 3600 })
}

// Delete a file from S3
export async function deleteFile(key: string): Promise<void> {
  const client = getS3Client()
  const bucket = getBucket()

  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  )
}

// Upload file directly to S3 (for server-side uploads)
export async function uploadFile(
  key: string,
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  const client = getS3Client()
  const bucket = getBucket()

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    }),
  )

  return `https://${bucket}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`
}

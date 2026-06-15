// S3 document storage — brief §4.8: "S3 document storage, per-client folders, encrypted at rest"
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

function getS3Client() {
  return new S3Client({ region: process.env.AWS_REGION ?? "us-east-1" })
}

function bucket() {
  const b = process.env.S3_DOCUMENTS_BUCKET
  if (!b) throw new Error("S3_DOCUMENTS_BUCKET is not set")
  return b
}

// documents/{orgId}/{clientId}/{category}/{timestamp}-{fileName}
export function buildS3Key(
  orgId: string,
  clientId: string,
  category: string,
  fileName: string
): string {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_")
  return `documents/${orgId}/${clientId}/${category}/${Date.now()}-${safe}`
}

export async function getPresignedPutUrl(
  s3Key: string,
  contentType: string,
  expiresIn = 300
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: bucket(),
    Key: s3Key,
    ContentType: contentType,
    ServerSideEncryption: "AES256",
  })
  return getSignedUrl(getS3Client(), command, { expiresIn })
}

export async function deleteObject(s3Key: string): Promise<void> {
  const command = new DeleteObjectCommand({ Bucket: bucket(), Key: s3Key })
  await getS3Client().send(command)
}

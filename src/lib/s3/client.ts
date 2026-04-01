import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

const BUCKET = process.env.AWS_S3_BUCKET || 'oracle-attachments-prod'

export async function getPresignedUploadUrl(
  s3Key: string,
  contentType: string,
  maxSize: number
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: s3Key,
    ContentType: contentType,
    ServerSideEncryption: 'AES256',
  })
  return getSignedUrl(s3, command, { expiresIn: 900 }) // 15 min
}

export async function getPresignedDownloadUrl(s3Key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: s3Key,
  })
  return getSignedUrl(s3, command, { expiresIn: 3600 }) // 1 hour
}

export async function getObjectBuffer(s3Key: string): Promise<Buffer> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: s3Key,
  })
  const response = await s3.send(command)
  const bytes = await response.Body!.transformToByteArray()
  return Buffer.from(bytes)
}

export async function deleteObject(s3Key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: s3Key,
  })
  await s3.send(command)
}

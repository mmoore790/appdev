import { randomUUID } from "crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

/**
 * Get file extension from content type or filename
 */
function getFileExtension(contentType: string, filename?: string): string {
  // Try to get extension from filename first
  if (filename) {
    const lastDot = filename.lastIndexOf('.');
    if (lastDot > 0) {
      return filename.substring(lastDot);
    }
  }

  // Fallback to content type mapping
  const contentTypeMap: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/svg+xml': '.svg',
  };

  return contentTypeMap[contentType.toLowerCase()] || '';
}

export async function uploadPublicFile(
  fileBuffer: Buffer,
  contentType: string,
  options?: { businessId?: number; folder?: string; filename?: string }
): Promise<string> {
  const {
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    R2_BUCKET_NAME,
    R2_ENDPOINT,
    R2_PUBLIC_URL,
  } = process.env;

  if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME || !R2_ENDPOINT || !R2_PUBLIC_URL) {
    throw new Error(
      "R2 storage environment variables are missing. Please set R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_ENDPOINT, and R2_PUBLIC_URL."
    );
  }

  // Generate file path with extension
  const folder = options?.folder || "uploads";
  const businessPart = options?.businessId ? `b${options.businessId}/` : "";
  const extension = getFileExtension(contentType, options?.filename);
  const fileName = `${randomUUID()}${extension}`;
  const key = `${folder}/${businessPart}${fileName}`;

  const s3Client = new S3Client({
    region: "auto",
    endpoint: R2_ENDPOINT.trim().replace(/\/$/, ""),
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });

  try {
    console.log(`Uploading file to R2: ${R2_BUCKET_NAME}/${key}`);
    console.log(`File size: ${fileBuffer.length} bytes, Content-Type: ${contentType}`);

    await s3Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType,
      })
    );

    const publicUrl = `${R2_PUBLIC_URL.trim().replace(/\/$/, "")}/${key}`;
    console.log(`File uploaded successfully: ${publicUrl}`);
    return publicUrl;
  } catch (error: any) {
    console.error("R2 upload error:", {
      message: error.message,
      bucket: R2_BUCKET_NAME,
      key,
    });
    throw new Error(`Failed to upload file: ${error.message || "Unknown error"}`);
  }
}

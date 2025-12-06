import { randomUUID } from "crypto";

export interface FileStorageConfig {
  supabaseUrl: string;
  supabaseKey: string;
  bucket: string;
}

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
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_ANON_KEY,
    SUPABASE_STORAGE_BUCKET,
  } = process.env;

  // Use service role key if available (for admin operations), otherwise use anon key
  const supabaseKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !supabaseKey || !SUPABASE_STORAGE_BUCKET) {
    throw new Error(
      "Supabase storage environment variables are missing. Please set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY), and SUPABASE_STORAGE_BUCKET."
    );
  }

  const config: FileStorageConfig = {
    supabaseUrl: SUPABASE_URL.replace(/\/$/, ""), // Remove trailing slash
    supabaseKey,
    bucket: SUPABASE_STORAGE_BUCKET,
  };

  // Generate file path with extension
  const folder = options?.folder || "uploads";
  const businessPart = options?.businessId ? `b${options.businessId}/` : "";
  const extension = getFileExtension(contentType, options?.filename);
  const fileName = `${randomUUID()}${extension}`;
  const filePath = `${folder}/${businessPart}${fileName}`;

  // Construct the upload URL
  const uploadUrl = `${config.supabaseUrl}/storage/v1/object/${config.bucket}/${filePath}`;

  try {
    console.log(`Uploading file to Supabase Storage: ${uploadUrl}`);
    console.log(`File size: ${fileBuffer.length} bytes, Content-Type: ${contentType}`);

    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.supabaseKey}`,
        "Content-Type": contentType,
        "x-upsert": "false", // Don't overwrite existing files
      },
      body: fileBuffer,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Failed to upload file: ${response.status} ${response.statusText}`;
      
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorJson.error || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }

      console.error("Supabase Storage upload error:", {
        status: response.status,
        statusText: response.statusText,
        error: errorMessage,
        bucket: config.bucket,
        filePath,
        url: uploadUrl,
      });

      throw new Error(errorMessage);
    }

    // Construct public URL
    const publicUrl = `${config.supabaseUrl}/storage/v1/object/public/${config.bucket}/${filePath}`;
    
    console.log(`File uploaded successfully: ${publicUrl}`);
    return publicUrl;
  } catch (error: any) {
    console.error("File upload error:", {
      message: error.message,
      bucket: config.bucket,
      filePath,
      url: uploadUrl,
    });
    throw new Error(`Failed to upload file: ${error.message || "Unknown error"}`);
  }
}



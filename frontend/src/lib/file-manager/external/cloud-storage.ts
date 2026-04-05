import axios from "axios";

export type CloudStorageType = "tencent_cos" | "aliyun_oss" | "aws_s3" | "qiniu_kodo";

export async function uploadToCloudStorage(
  uploadUrl: string,
  file: File | Blob,
  storageType: CloudStorageType,
  onProgress?: (progress: number) => void,
  contentType?: string
): Promise<void> {
  const headers: Record<string, string> = {
    "Content-Type": contentType || (file instanceof File ? file.type : "") || "application/octet-stream",
  };

  await axios.put(uploadUrl, file, {
    headers,
    onUploadProgress: progressEvent => {
      if (onProgress && progressEvent.total) {
        const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(progress);
      }
    },
  });
}

export async function uploadToCOS(
  uploadUrl: string,
  file: File | Blob,
  onProgress?: (progress: number) => void
): Promise<void> {
  return uploadToCloudStorage(uploadUrl, file, "tencent_cos", onProgress);
}

export async function uploadToOSS(
  uploadUrl: string,
  file: File | Blob,
  onProgress?: (progress: number) => void
): Promise<void> {
  return uploadToCloudStorage(uploadUrl, file, "aliyun_oss", onProgress);
}

export async function uploadToS3(
  uploadUrl: string,
  file: File | Blob,
  onProgress?: (progress: number) => void
): Promise<void> {
  return uploadToCloudStorage(uploadUrl, file, "aws_s3", onProgress);
}

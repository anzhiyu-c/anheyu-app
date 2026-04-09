import type { UploadItem } from "@/types/file-manager";
import { uploadChunkApi } from "@/lib/api/file-manager";
import { uploadChunkToOneDriveApi } from "@/lib/file-manager/external/onedrive";
import { uploadToCloudStorage } from "@/lib/file-manager/external/cloud-storage";

export async function uploadFileChunksWorker(item: UploadItem): Promise<void> {
  try {
    if (item.uploadMethod === "client") {
      if (!item.uploadUrl) {
        throw new Error("客户端直传模式需要有效的 upload_url。");
      }
      switch (item.storageType) {
        case "onedrive":
          await uploadOneDriveChunks(item);
          break;
        case "tencent_cos":
        case "aliyun_oss":
        case "aws_s3":
        case "qiniu_kodo":
          await uploadCloudStorageFile(item);
          break;
        default:
          throw new Error(`不支持的存储类型: ${item.storageType}`);
      }
      // 客户端直传需在调用方执行 finalize 后再置 success，避免未落库却显示成功
      return;
    }

    await uploadServerChunks(item);
    item.status = "success";
  } catch (error) {
    if (item.status !== "canceled") {
      throw error;
    }
  }
}

async function uploadOneDriveChunks(item: UploadItem): Promise<void> {
  if (!item.chunkSize || item.totalChunks === undefined) {
    throw new Error("OneDrive 分片上传前必须拥有有效的分片信息。");
  }
  if (item.uploadedChunks?.size === item.totalChunks) return;

  for (let i = 0; i < item.totalChunks; i++) {
    if (item.status === "canceled") return;
    if (item.uploadedChunks?.has(i)) continue;

    const start = i * item.chunkSize;
    const end = Math.min(start + item.chunkSize, item.size);
    const chunkBlob = item.file.slice(start, end);

    await uploadChunkToOneDriveApi(item.uploadUrl!, chunkBlob, start, end, item.size);

    item.uploadedChunks!.add(i);
    item.uploadedSize += chunkBlob.size;
    item.progress = Math.round((item.uploadedSize / item.size) * 100);
  }
}

async function uploadCloudStorageFile(item: UploadItem): Promise<void> {
  await uploadToCloudStorage(
    item.uploadUrl!,
    item.file,
    item.storageType as "tencent_cos" | "aliyun_oss" | "aws_s3" | "qiniu_kodo",
    progress => {
      item.progress = progress;
      item.uploadedSize = Math.round((progress / 100) * item.size);
    },
    item.contentType
  );
  item.uploadedSize = item.size;
  item.progress = 100;
}

async function uploadServerChunks(item: UploadItem): Promise<void> {
  if (!item.sessionId) {
    throw new Error("服务端中转模式需要有效的 sessionId。");
  }
  if (!item.chunkSize || item.totalChunks === undefined) {
    throw new Error("分片上传前必须拥有有效的分片信息。");
  }
  if (item.uploadedChunks?.size === item.totalChunks) return;

  for (let i = 0; i < item.totalChunks; i++) {
    if (item.status === "canceled") return;
    if (item.uploadedChunks?.has(i)) continue;

    const start = i * item.chunkSize;
    const end = Math.min(start + item.chunkSize, item.size);
    const chunkBlob = item.file.slice(start, end);
    const chunkRes = await uploadChunkApi(item.sessionId, i, chunkBlob);
    if (!chunkRes || chunkRes.code !== 200) {
      throw new Error(chunkRes?.message || `分片 ${i + 1} 上传失败`);
    }
    item.uploadedChunks!.add(i);
    item.uploadedSize += chunkBlob.size;
    item.progress = Math.round((item.uploadedSize / item.size) * 100);
  }
}

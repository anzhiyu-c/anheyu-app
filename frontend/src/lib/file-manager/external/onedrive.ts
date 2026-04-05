import axios from "axios";

/**
 * 客户端直传分片函数 (OneDrive)
 */
export async function uploadChunkToOneDriveApi(
  uploadUrl: string,
  chunkBlob: Blob,
  start: number,
  end: number,
  totalSize: number
): Promise<void> {
  const headers = {
    "Content-Length": chunkBlob.size.toString(),
    "Content-Range": `bytes ${start}-${end - 1}/${totalSize}`,
  };
  await axios.put(uploadUrl, chunkBlob, { headers });
}

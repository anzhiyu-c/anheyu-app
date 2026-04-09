/**
 * 为相册图片拼接 thumb/big 等处理参数。
 * 若 imageUrl 已带查询串，使用 & 追加，避免第二个 ? 破坏路径（尤其含中文已编码的地址）。
 */
export function buildAlbumImageWithParam(
  imageUrl: string | undefined | null,
  param: string | undefined | null
): string {
  const base = (imageUrl ?? "").trim();
  if (!base) return "";
  const p = (param ?? "").trim();
  if (!p) return base;
  return base.includes("?") ? `${base}&${p}` : `${base}?${p}`;
}

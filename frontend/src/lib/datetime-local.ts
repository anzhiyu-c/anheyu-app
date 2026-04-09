/**
 * 管理端 datetime-local 与 RFC3339（UTC）互转，按用户本地时区解析/展示。
 */

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** ISO / RFC3339 字符串转为 <input type="datetime-local"> 的 value */
export function isoStringToDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** datetime-local 字符串（YYYY-MM-DDTHH:mm）转为 RFC3339 UTC，供 API 使用 */
export function datetimeLocalToRFC3339(local: string): string | undefined {
  const t = local.trim();
  if (!t) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(t);
  if (!m) return undefined;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const day = Number(m[3]);
  const h = Number(m[4]);
  const mi = Number(m[5]);
  const d = new Date(y, mo, day, h, mi, 0, 0);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

/**
 * 从当前时刻起经过指定小时数后的本地日期时间（YYYY-MM-DDTHH:mm），
 * 与定时发布、HeroUI DatePicker 使用的格式一致；基于绝对时间毫秒加法，再按本地时区展示。
 */
export function datetimeLocalAfterHoursFromNow(hours: number): string {
  const d = new Date(Date.now() + hours * 3600000);
  return isoStringToDatetimeLocal(d.toISOString());
}

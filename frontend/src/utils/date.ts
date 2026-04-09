/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2026-02-02 16:53:35
 * @LastEditTime: 2026-02-07 11:38:41
 * @LastEditors: 安知鱼
 */
/**
 * 日期格式化工具函数
 * 统一的日期处理模块
 */

/**
 * 格式化日期为 YYYY-MM-DD 格式
 * @param dateString - 日期字符串
 * @returns 格式化后的日期字符串
 */
export function formatDate(dateString: string): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * 格式化日期为中文 locale 格式（如 "2024年1月15日"）
 * @param date - 日期字符串或 Date 对象
 * @returns 中文格式的日期字符串
 */
export function formatDateCN(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * 格式化日期为相对时间（如：3天前）
 * @param dateString - 日期字符串
 * @returns 相对时间字符串
 */
export function formatRelativeTime(dateString: string): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (seconds < 60) {
    return "刚刚";
  } else if (minutes < 60) {
    return `${minutes}分钟前`;
  } else if (hours < 24) {
    return `${hours}小时前`;
  } else if (days < 30) {
    return `${days}天前`;
  } else if (months < 12) {
    return `${months}个月前`;
  } else {
    return `${years}年前`;
  }
}

/**
 * 格式化日期时间为 { date: "YYYY-MM-DD", time: "HH:mm" }
 * @param dateStr - 日期字符串
 * @returns 拆分后的日期和时间
 */
export function formatDateTimeParts(dateStr: string): { date: string; time: string } {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return { date: "-", time: "" };
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return { date: `${year}-${month}-${day}`, time: `${hours}:${minutes}` };
}

/**
 * 格式化日期时间为中文 locale 字符串（如 "2024/01/15 14:30"）
 * @param dateStr - 日期字符串
 * @returns 格式化后的日期时间字符串
 */
export function formatDateTime(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

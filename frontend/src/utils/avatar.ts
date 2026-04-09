/**
 * 头像工具函数
 * 参考 anheyu-app 实现
 */

import md5 from "blueimp-md5";
import { toSameOriginMediaUrl } from "./same-origin-media-url";

export interface AvatarConfig {
  gravatarUrl?: string;
  defaultGravatarType?: string;
}

const DEFAULT_GRAVATAR_URL = "https://cravatar.cn";
const DEFAULT_GRAVATAR_TYPE = "identicon";

/**
 * 获取邮箱的 MD5 哈希值
 */
export function getEmailMd5(email: string): string {
  return md5(email.toLowerCase().trim());
}

/**
 * 构建 Gravatar URL
 */
export function buildGravatarUrl(emailOrMd5: string, config?: AvatarConfig, size = 80): string {
  const gravatarUrl = config?.gravatarUrl || DEFAULT_GRAVATAR_URL;
  const defaultType = config?.defaultGravatarType || DEFAULT_GRAVATAR_TYPE;

  // 判断是邮箱还是已经是 MD5
  const emailMd5 = emailOrMd5.includes("@") ? getEmailMd5(emailOrMd5) : emailOrMd5;

  const baseUrl = gravatarUrl.replace(/\/$/, "");
  return `${baseUrl}/avatar/${emailMd5}?s=${size}&d=${defaultType}`;
}

/**
 * 检查字符串是否是 QQ 号格式
 */
export function isQQNumber(str: string): boolean {
  return /^[1-9]\d{4,10}$/.test(str.trim());
}

/**
 * 获取 QQ 头像 URL
 */
export function getQQAvatarUrl(qqNumber: string, size = 80): string {
  return `https://thirdqq.qlogo.cn/g?b=sdk&nk=${qqNumber}&s=${size}`;
}

/**
 * 获取用户头像 URL
 * 优先级：自定义头像 > QQ头像 > Gravatar
 */
export function getUserAvatarUrl(
  user: {
    avatar?: string;
    email?: string;
    nickname?: string;
  },
  config?: AvatarConfig,
  size = 80
): string {
  // 1. 优先使用用户自定义头像（本站直链可能带生产域名，需压成相对路径以便本地/当前站点加载）
  if (user.avatar) {
    return toSameOriginMediaUrl(user.avatar);
  }

  // 2. 如果昵称是 QQ 号格式，尝试获取 QQ 头像
  if (user.nickname && isQQNumber(user.nickname)) {
    return getQQAvatarUrl(user.nickname.trim(), size);
  }

  // 3. 检查邮箱是否是 QQ 邮箱
  if (user.email) {
    const qqMatch = /^([1-9]\d{4,10})@qq\.com$/i.exec(user.email.trim());
    if (qqMatch) {
      return getQQAvatarUrl(qqMatch[1], size);
    }
  }

  // 4. 使用 Gravatar
  if (user.email) {
    return buildGravatarUrl(user.email, config, size);
  }

  // 5. 默认头像
  const gravatarUrl = config?.gravatarUrl || DEFAULT_GRAVATAR_URL;
  return `${gravatarUrl}/avatar/?s=${size}&d=${config?.defaultGravatarType || DEFAULT_GRAVATAR_TYPE}`;
}

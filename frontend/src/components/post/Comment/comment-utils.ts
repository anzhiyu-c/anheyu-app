import DOMPurify from "dompurify";
import { UAParser } from "ua-parser-js";
import type { Comment } from "@/lib/api/comment";

export interface CommentDisplayConfig {
  gravatarUrl: string;
  defaultGravatarType: string;
  masterTag: string;
  adminAvatarUrl?: string;
  showRegion?: boolean;
  showUA?: boolean;
}

export type CommentWithReplies = Comment & {
  _hasReplies?: boolean;
  _repliesCount?: number;
  _replies?: Comment[];
};

export function buildGravatarUrl(emailMd5: string, config: CommentDisplayConfig, size = 140): string {
  const baseUrl = config.gravatarUrl.replace(/\/$/, "");
  return `${baseUrl}/avatar/${emailMd5}?s=${size}&d=${config.defaultGravatarType}`;
}

export function getAvatarUrl(comment: Comment, config: CommentDisplayConfig): string {
  if (comment.avatar_url) {
    return comment.avatar_url;
  }

  if (comment.is_admin_comment && config.adminAvatarUrl) {
    return config.adminAvatarUrl;
  }

  if (comment.is_anonymous) {
    const baseUrl = config.gravatarUrl.replace(/\/$/, "");
    return `${baseUrl}/avatar/anonymous?s=140&d=mp&f=y`;
  }

  if (comment.qq_number) {
    return `https://thirdqq.qlogo.cn/g?b=sdk&nk=${comment.qq_number}&s=140`;
  }

  return buildGravatarUrl(comment.email_md5, config);
}

// formatRelativeTime 统一从 @/utils/date 导入
export { formatRelativeTime } from "@/utils/date";

export function normalizeWebsiteUrl(url?: string | null): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

export function extractQQFromEmail(email: string): string | null {
  const match = /^([1-9]\d{4,10})@qq\.com$/i.exec((email || "").trim());
  return match ? match[1] : null;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function isValidUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return true;
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    new URL(withProtocol);
    return true;
  } catch {
    return false;
  }
}

export function generateAnonymousNickname(): string {
  const adjectives = ["安静", "温柔", "清澈", "随机", "自由", "简单", "微风", "星光"];
  const nouns = ["访客", "旅人", "小鱼", "云朵", "星尘", "岛屿", "候鸟", "回声"];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const suffix = Math.floor(Math.random() * 900 + 100);
  return `${adj}${noun}${suffix}`;
}

export function sanitizeCommentHtml(html: string): string {
  if (!html) return "";
  if (typeof window === "undefined") return html;
  return DOMPurify.sanitize(html);
}

export function parseUserAgent(userAgent?: string | null): { os: string | null; browser: string | null } {
  if (!userAgent) return { os: null, browser: null };

  let uaString = userAgent;
  let platformVersion = "";
  const pvMatch = uaString.match(/\|PV:([^|]+)/);
  if (pvMatch) {
    platformVersion = pvMatch[1].replace(/"/g, "");
    uaString = uaString.replace(/\|PV:[^|]+/, "");
  }

  const parser = new UAParser(uaString);
  const result = parser.getResult();

  let osName = result.os.name || "";
  let osVersion = result.os.version || "";

  if (osName === "Windows" && platformVersion) {
    const versionNum = parseFloat(platformVersion);
    if (versionNum >= 13) {
      osName = "Windows";
      osVersion = "11";
    } else if (versionNum >= 10) {
      osName = "Windows";
      osVersion = "10";
    }
  }

  return {
    os: osName ? `${osName} ${osVersion}`.trim() : null,
    browser: result.browser.name ? `${result.browser.name} ${result.browser.version || ""}`.trim() : null,
  };
}

export function buildReplyChains(
  rootId: string,
  flatList: Comment[],
  options?: { preserveOrder?: boolean }
): CommentWithReplies[] {
  if (!flatList || flatList.length === 0) return [];

  const children = [...flatList];
  const childrenIds = new Set(children.map(child => child.id));
  const replyMap = new Map<string, Comment[]>();
  const chainHeads: Comment[] = [];

  children.forEach(child => {
    if (!child.reply_to_id || child.reply_to_id === rootId) {
      chainHeads.push(child);
      return;
    }
    if (childrenIds.has(child.reply_to_id)) {
      const list = replyMap.get(child.reply_to_id) || [];
      list.push(child);
      replyMap.set(child.reply_to_id, list);
    }
  });

  const calculateChainWeight = (comment: Comment): number => {
    const directReplies = replyMap.get(comment.id) || [];
    let weight = directReplies.length;
    directReplies.forEach(reply => {
      weight += calculateChainWeight(reply);
    });
    return weight;
  };

  const chainHeadsWithInfo = chainHeads.map(head => {
    const weight = calculateChainWeight(head);
    return {
      comment: head,
      weight,
      hasReplies: weight > 0,
      repliesCount: weight,
    };
  });

  if (!options?.preserveOrder) {
    chainHeadsWithInfo.sort((a, b) => {
      const timeA = new Date(a.comment.created_at).getTime();
      const timeB = new Date(b.comment.created_at).getTime();
      const weightDiff = Math.abs(a.weight - b.weight);
      if (weightDiff >= 5) {
        return b.weight - a.weight;
      }
      return timeB - timeA;
    });
  }

  const expandChain = (comment: Comment): Comment[] => {
    const result: Comment[] = [comment];
    const replies = replyMap.get(comment.id) || [];
    const sortedReplies = [...replies].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    sortedReplies.forEach(reply => {
      result.push(...expandChain(reply));
    });
    return result;
  };

  const sortedResult: CommentWithReplies[] = [];
  chainHeadsWithInfo.forEach(({ comment, hasReplies, repliesCount }) => {
    const chain = expandChain(comment);
    sortedResult.push({
      ...chain[0],
      _hasReplies: hasReplies,
      _repliesCount: repliesCount,
      _replies: chain.slice(1),
    });
  });

  return sortedResult;
}

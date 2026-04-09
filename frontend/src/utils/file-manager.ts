/**
 * 文件管理相关工具函数（对齐 anheyu-app）
 */

export const joinPath = (basePath: string, name: string): string => {
  if (!name) return basePath;
  if (basePath === "/") {
    return `/${name}`;
  }
  return `${basePath.replace(/\/$/, "")}/${name}`;
};

export const extractLogicalPathFromUri = (uri: string): string => {
  const prefix = "anzhiyu://my";
  if (uri.startsWith(prefix)) {
    const path = uri.substring(prefix.length);
    if (path === "" || path === "/") return "/";
    return path.startsWith("/") ? path : `/${path}`;
  }
  return uri;
};

export const buildFullUri = (logicalPath: string): string => {
  const prefix = "anzhiyu://my";
  const normalized = logicalPath.startsWith("/") ? logicalPath : `/${logicalPath}`;
  if (normalized === "/") {
    return `${prefix}/`;
  }
  return `${prefix}${normalized}`;
};

export const getFileExtension = (filename: string): string => {
  if (!filename || filename.lastIndexOf(".") === -1) {
    return "";
  }
  return filename.substring(filename.lastIndexOf(".") + 1).toLowerCase();
};

export const getFileFingerprint = (file: File): string => {
  return `file-${file.name}-${file.size}`;
};

export const getParentPath = (path: string): string => {
  if (!path || path === "/") {
    return "/";
  }
  const normalized = path.endsWith("/") ? path.slice(0, -1) : path;
  const lastSlash = normalized.lastIndexOf("/");
  if (lastSlash <= 0) return "/";
  return normalized.substring(0, lastSlash);
};

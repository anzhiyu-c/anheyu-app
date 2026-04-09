"use client";

import { FileType } from "@/types/file-manager";
import type { FileItem } from "@/types/file-manager";

/**
 * 文件扩展名到图标文件的映射表
 * 与 anheyu-app 的 useFileIcons.ts 保持一致
 */
const iconMap: Record<string, string> = {
  // 音频
  mp3: "file-mp3",
  wav: "file-music",
  flac: "file-music",
  aac: "file-music",
  ogg: "file-music",
  m4a: "file-music",

  // 视频
  mp4: "file-video",
  mov: "file-mov",
  avi: "file-avi",
  mkv: "file-video",
  wmv: "file-video",
  flv: "file-video",
  webm: "file-video",

  // 压缩包
  zip: "file-zip",
  rar: "file-rar",
  "7z": "file-zip",
  tar: "file-zip",
  gz: "file-zip",
  bz2: "file-zip",

  // 文档
  xls: "file-excel",
  xlsx: "file-excel",
  csv: "file-excel",
  ppt: "file-ppt",
  pptx: "file-ppt",
  txt: "file-txt",
  md: "file-txt",
  log: "file-txt",
  html: "file-html",
  htm: "file-html",
  css: "file-css",
  js: "file-js",
  ts: "file-js",
  json: "file-json",
  xml: "file-html",
  py: "file-python",
  vue: "vue",
  php: "file-php",
  sql: "file-sql",
  dll: "file-dll",

  // 图片
  png: "file-image",
  jpg: "file-image",
  jpeg: "file-image",
  gif: "file-gif",
  svg: "file-image",
  webp: "file-image",
  bmp: "file-image",
  ico: "file-image",
  avif: "file-image",

  // 可执行文件
  exe: "file-exe",
  msi: "file-exe",
  bat: "file-exe",
  sh: "file-exe",

  // 文档
  doc: "file-wps",
  docx: "file-wps",
  pdf: "file-pdf",
  psd: "file-psd",
};

/**
 * 文件图标组件 - 使用自定义 SVG 图标
 * 替代 react-icons 的线框图标，与 anheyu-app 保持视觉一致
 *
 * 通过 CSS className 控制实际显示尺寸，
 * width/height 属性仅为 Image 组件的内在尺寸提示
 */
function FileIcon({ name, className }: { name: string; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- SVG 图标无需 next/image 优化
    <img src={`/icons/${name}.svg`} alt="" className={className} draggable={false} />
  );
}

/**
 * 获取文件对应的图标组件
 * 返回一个 React 组件（函数式），可以传 className
 */
export function getFileIcon(file: FileItem): React.ComponentType<{ className?: string }> {
  if (file.type === FileType.Dir) {
    return function DirIcon({ className }: { className?: string }) {
      return <FileIcon name="file-dir" className={className} />;
    };
  }

  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const iconName = iconMap[ext] || "file-other";

  return function ExtIcon({ className }: { className?: string }) {
    return <FileIcon name={iconName} className={className} />;
  };
}

/**
 * 直接渲染文件图标
 */
export function renderFileIcon(file: FileItem, className?: string) {
  const Icon = getFileIcon(file);
  return <Icon className={className} />;
}

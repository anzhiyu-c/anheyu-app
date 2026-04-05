/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2026-01-30 16:51:16
 * @LastEditTime: 2026-01-31 14:30:00
 * @LastEditors: 安知鱼
 */
import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  turbopack: {
    // 固定 Turbopack 根目录，避免多 lockfile 场景下根目录误判
    root: __dirname,
  },
  output: "standalone",
  images: {
    unoptimized: true,
  },
  experimental: {
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },

  // 代理配置 - 客户端请求代理到 Go 后端
  async rewrites() {
    // 开发环境使用 BACKEND_URL，生产环境使用 API_URL（Docker 内部网络）
    const backendUrl = isDev
      ? process.env.BACKEND_URL || "http://localhost:8091"
      : process.env.API_URL || "http://anheyu:8091";

    return {
      // beforeFiles: 在检查 public 目录之前执行（API 等必须代理的路径）
      beforeFiles: [
        // API 代理
        {
          source: "/api/:path*",
          destination: `${backendUrl}/api/:path*`,
        },
        // 文件直链代理（后端路由在 /api/f/ 下，需带 /api 前缀）
        {
          source: "/f/:path*",
          destination: `${backendUrl}/api/f/:path*`,
        },
        // 缓存文件代理
        {
          source: "/needcache/:path*",
          destination: `${backendUrl}/needcache/:path*`,
        },
      ],
      // afterFiles: 先检查 public 目录，找不到才代理到 Go 后端
      // sitemap.xml / robots.txt 由 Next.js 元数据约定处理（src/app/sitemap.ts、robots.ts）
      // RSS Feed 由 Route Handler 处理（src/app/rss.xml/route.ts 等），运行时读取后端地址
      afterFiles: [
        // 静态文件代理（后端上传的图片等，优先使用 public 目录中的默认文件）
        {
          source: "/static/:path*",
          destination: `${backendUrl}/static/:path*`,
        },
      ],
      fallback: [],
    };
  },
};

export default nextConfig;

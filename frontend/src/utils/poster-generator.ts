/**
 * 海报生成工具函数
 * 与 anheyu-app 实现一致
 */

import QRCode from "qrcode";

/**
 * 海报生成配置
 */
export interface PosterConfig {
  title: string; // 文章标题
  description?: string; // 文章简介
  author: string; // 作者名称
  authorAvatar?: string; // 作者头像URL
  siteName?: string; // 站点名称
  siteSubtitle?: string; // 站点副标题
  articleUrl: string; // 文章URL
  coverImage?: string; // 文章封面图
  publishDate?: string; // 文章发布时间
}

/**
 * 与文章详情 PostHeader 一致：优先顶部大图 top_img_url，其次 cover_url。
 * 避免仅配置了头图时分享海报缺少主图。
 */
export function getPosterCoverImageUrl(article: {
  top_img_url?: string;
  cover_url?: string;
}): string | undefined {
  const raw = (article.top_img_url || article.cover_url || "").trim();
  return raw === "" ? undefined : raw;
}

function shouldSetCrossOriginForImageLoad(url: string): boolean {
  if (typeof window === "undefined") {
    return true;
  }
  if (url.startsWith("data:") || url.startsWith("blob:")) {
    return false;
  }
  try {
    const resolved = new URL(url, window.location.href);
    return resolved.origin !== window.location.origin;
  } catch {
    return true;
  }
}

/**
 * 加载图片（跨域资源需 anonymous 以便 canvas 导出；同源不设置，减少异常失败）
 */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (shouldSetCrossOriginForImageLoad(url)) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/**
 * 绘制圆形头像
 */
function drawCircleAvatar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  image: HTMLImageElement
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(image, x - radius, y - radius, radius * 2, radius * 2);
  ctx.restore();
}

/**
 * 文字换行处理
 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines?: number
): number {
  const words = text.split("");
  let line = "";
  let currentY = y;
  let lineCount = 1;

  for (let i = 0; i < words.length; i++) {
    const testLine = line + words[i];
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;

    if (testWidth > maxWidth && i > 0) {
      ctx.fillText(line, x, currentY);
      line = words[i];
      lineCount++;
      if (maxLines && lineCount >= maxLines) {
        let lastLine = line;
        while (ctx.measureText(lastLine + "...").width > maxWidth && lastLine.length > 0) {
          lastLine = lastLine.slice(0, -1);
        }
        ctx.fillText(lastLine + "...", x, currentY + lineHeight);
        return currentY + lineHeight;
      }
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line.length > 0) {
    ctx.fillText(line, x, currentY);
  }
  return currentY;
}

/**
 * 生成文章分享海报
 */
export async function generatePoster(config: PosterConfig): Promise<string> {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("无法创建 Canvas 上下文");
  }

  // 海报尺寸（竖版，适合手机分享）
  const width = 750;
  const height = 1000;
  canvas.width = width;
  canvas.height = height;

  // 背景色
  const bgColor = "#ffffff";
  const primaryColor = "#3b82f6";
  const textColor = "#1f2937";
  const secondaryTextColor = "#6b7280";

  // 绘制背景
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, width, height);

  // 绘制封面图（如果有）
  let coverY = 0;
  const coverHeight = 420;
  if (config.coverImage) {
    try {
      const coverImg = await loadImage(config.coverImage);
      const coverWidth = width;

      const imgAspectRatio = coverImg.width / coverImg.height;
      const targetAspectRatio = coverWidth / coverHeight;

      let sourceX = 0;
      let sourceY = 0;
      let sourceWidth = coverImg.width;
      let sourceHeight = coverImg.height;

      if (imgAspectRatio > targetAspectRatio) {
        sourceWidth = coverImg.height * targetAspectRatio;
        sourceX = (coverImg.width - sourceWidth) / 2;
      } else {
        sourceHeight = coverImg.width / targetAspectRatio;
        sourceY = (coverImg.height - sourceHeight) / 2;
      }

      ctx.drawImage(coverImg, sourceX, sourceY, sourceWidth, sourceHeight, 0, coverY, coverWidth, coverHeight);
      coverY += coverHeight;
    } catch (error) {
      console.warn("封面图加载失败，跳过:", error);
      const defaultCoverHeight = 80;
      const gradient = ctx.createLinearGradient(0, 0, width, defaultCoverHeight);
      gradient.addColorStop(0, primaryColor);
      gradient.addColorStop(1, "#60a5fa");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, defaultCoverHeight);
      coverY = defaultCoverHeight;
    }
  } else {
    const defaultCoverHeight = 80;
    const gradient = ctx.createLinearGradient(0, 0, width, defaultCoverHeight);
    gradient.addColorStop(0, primaryColor);
    gradient.addColorStop(1, "#60a5fa");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, defaultCoverHeight);
    coverY = defaultCoverHeight;
  }

  // 绘制内容区域背景
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, coverY, width, height - coverY);

  // 绘制标题
  ctx.fillStyle = textColor;
  ctx.font = "bold 48px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  const padding = 40;
  const titleX = padding;
  let titleY = coverY + 40;
  const titleMaxWidth = width - padding * 2;

  const titleLineHeight = 58;
  titleY = wrapText(ctx, config.title, titleX, titleY, titleMaxWidth, titleLineHeight) + 20;

  // 绘制文章简介
  let descY = titleY;
  const lineY = height - 200;

  if (config.description) {
    descY += 50;
    ctx.fillStyle = secondaryTextColor;
    ctx.font = "26px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    const lineHeight = 38;
    const descMaxWidth = titleMaxWidth;
    const descText = config.description;

    const availableHeight = lineY - descY - 50;
    const maxDescLines = Math.max(1, Math.floor(availableHeight / lineHeight));

    const finalDescY = wrapText(ctx, descText, titleX, descY, descMaxWidth, lineHeight, maxDescLines);
    descY = finalDescY + 16;
  }

  // 绘制底部装饰线
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, lineY);
  ctx.lineTo(width - padding, lineY);
  ctx.stroke();

  // 底部区域布局
  const qrCodeSize = 120;
  const bottomAvatarSize = 50;
  const bottomTextSpacing = 14;
  const bottomSectionSpacing = 40;

  ctx.font = "bold 26px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  const siteNameWidth = ctx.measureText(config.siteName || config.author).width;
  ctx.font = "18px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  const subtitleWidth = config.siteSubtitle ? ctx.measureText(config.siteSubtitle).width : 0;
  const leftTextWidth = Math.max(siteNameWidth, subtitleWidth);

  const bottomSectionWidth = bottomAvatarSize + bottomTextSpacing + leftTextWidth + bottomSectionSpacing + qrCodeSize;

  const bottomSectionStartX = (width - bottomSectionWidth) / 2;
  const qrCodeY = lineY + 20;

  const bottomAvatarX = bottomSectionStartX;
  const baseAvatarY = qrCodeY + (qrCodeSize - bottomAvatarSize) / 2;
  const bottomAvatarY = baseAvatarY + 13;

  const qrCodeX = bottomSectionStartX + bottomAvatarSize + bottomTextSpacing + leftTextWidth + bottomSectionSpacing;

  // 绘制头像
  if (config.authorAvatar) {
    try {
      const avatarImg = await loadImage(config.authorAvatar);
      drawCircleAvatar(
        ctx,
        bottomAvatarX + bottomAvatarSize / 2,
        bottomAvatarY + bottomAvatarSize / 2,
        bottomAvatarSize / 2,
        avatarImg
      );
    } catch (error) {
      console.warn("头像加载失败，使用默认样式:", error);
      ctx.fillStyle = primaryColor;
      ctx.beginPath();
      ctx.arc(
        bottomAvatarX + bottomAvatarSize / 2,
        bottomAvatarY + bottomAvatarSize / 2,
        bottomAvatarSize / 2,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
  }

  // 绘制站点名称和副标题
  const bottomTextX = bottomAvatarX + bottomAvatarSize + bottomTextSpacing;
  const originalAvatarCenterY = baseAvatarY + bottomAvatarSize / 2;
  const siteNameY = originalAvatarCenterY - 6;
  const subtitleY = originalAvatarCenterY + 28;

  ctx.fillStyle = textColor;
  ctx.font = "bold 26px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(config.siteName || config.author, bottomTextX, siteNameY);

  if (config.siteSubtitle) {
    ctx.fillStyle = secondaryTextColor;
    ctx.font = "18px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillText(config.siteSubtitle, bottomTextX, subtitleY);
  }

  // 生成二维码
  try {
    const qrCodeDataUrl = await QRCode.toDataURL(config.articleUrl, {
      width: qrCodeSize,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    });

    const qrImg = await loadImage(qrCodeDataUrl);
    ctx.drawImage(qrImg, qrCodeX, qrCodeY, qrCodeSize, qrCodeSize);
  } catch (error) {
    console.error("生成二维码失败:", error);
    throw new Error("生成二维码失败");
  }

  // 二维码下方提示文字
  ctx.fillStyle = secondaryTextColor;
  ctx.font = "18px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  const qrTextY = qrCodeY + qrCodeSize + 12;
  ctx.fillText("扫码查看文章", qrCodeX + qrCodeSize / 2, qrTextY);

  return canvas.toDataURL("image/png", 1.0);
}

/**
 * 下载海报
 */
export function downloadPoster(dataUrl: string, filename: string = "poster.png") {
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

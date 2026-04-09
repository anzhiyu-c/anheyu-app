"use client";

/**
 * @Description: 颜色提取逻辑 hook
 * @Author: 安知鱼
 * 1:1 移植自 anheyu-app composables/useColorExtraction.ts
 */
import { useState, useRef, useCallback } from "react";
import type { ColorCache } from "@/types/music";

export function useColorExtraction() {
  const [dominantColor, setDominantColor] = useState("var(--anzhiyu-main)");
  const colorCacheRef = useRef<ColorCache>({});
  const colorExtractionTimerRef = useRef<number | null>(null);
  const currentProcessingUrlRef = useRef<string | null>(null);
  const extractionRequestIdRef = useRef(0);

  // 使用 fetch + blob 的方式提取图片主色调
  const extractDominantColor = useCallback((imageUrl: string): Promise<string> => {
    return new Promise(resolve => {
      const defaultColor = "var(--anzhiyu-main)";

      if (!imageUrl || typeof imageUrl !== "string") {
        resolve(defaultColor);
        return;
      }

      // 检查缓存
      if (colorCacheRef.current[imageUrl]) {
        resolve(colorCacheRef.current[imageUrl]);
        return;
      }

      fetch(imageUrl)
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.blob();
        })
        .then(blob => {
          const blobUrl = URL.createObjectURL(blob);
          const img = new Image();
          let settled = false;
          let timeout: number | null = null;

          const finalize = (color: string) => {
            if (settled) return;
            settled = true;

            if (timeout !== null) {
              clearTimeout(timeout);
              timeout = null;
            }

            URL.revokeObjectURL(blobUrl);
            resolve(color);
          };

          timeout = window.setTimeout(() => {
            finalize(defaultColor);
          }, 5000);

          img.onload = () => {
            try {
              if (img.width === 0 || img.height === 0) {
                finalize(defaultColor);
                return;
              }

              const canvas = document.createElement("canvas");
              const ctx = canvas.getContext("2d");

              if (!ctx) {
                finalize(defaultColor);
                return;
              }

              const maxSize = 300;
              const scale = Math.min(maxSize / img.width, maxSize / img.height);

              canvas.width = Math.floor(img.width * scale);
              canvas.height = Math.floor(img.height * scale);

              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const data = imageData.data;

              const colorCounts: { [key: string]: number } = {};
              let validPixelCount = 0;

              const step = Math.max(1, Math.floor(data.length / (4 * 1000)));

              for (let i = 0; i < data.length; i += step * 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                const a = data[i + 3];

                if (a < 125) continue;

                validPixelCount++;

                const qr = Math.round(r / 32) * 32;
                const qg = Math.round(g / 32) * 32;
                const qb = Math.round(b / 32) * 32;

                const color = `${qr},${qg},${qb}`;
                colorCounts[color] = (colorCounts[color] || 0) + 1;
              }

              if (validPixelCount < 10) {
                finalize(defaultColor);
                return;
              }

              const isWhitishColor = (colorStr: string): boolean => {
                const [r, g, b] = colorStr.split(",").map(Number);
                return r > 200 && g > 200 && b > 200;
              };

              const calculateLuminance = (r: number, g: number, b: number): number => {
                const [rs, gs, bs] = [r, g, b].map(c => {
                  c = c / 255;
                  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
                });
                return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
              };

              const ensureDarkColor = (r: number, g: number, b: number) => {
                const luminance = calculateLuminance(r, g, b);

                if (luminance > 0.5) {
                  const darkeningFactor = 0.3;
                  return {
                    r: Math.floor(r * darkeningFactor),
                    g: Math.floor(g * darkeningFactor),
                    b: Math.floor(b * darkeningFactor),
                  };
                }

                if (luminance > 0.3) {
                  const darkeningFactor = 0.6;
                  return {
                    r: Math.floor(r * darkeningFactor),
                    g: Math.floor(g * darkeningFactor),
                    b: Math.floor(b * darkeningFactor),
                  };
                }

                return { r, g, b };
              };

              const sortedColors = Object.entries(colorCounts)
                .sort(([, a], [, b]) => b - a)
                .filter(([color]) => !isWhitishColor(color));

              let dominantColorStr = "";
              let maxCount = 0;

              if (sortedColors.length > 0) {
                [dominantColorStr, maxCount] = [sortedColors[0][0], sortedColors[0][1]];
              }

              if (dominantColorStr && maxCount > 0) {
                const [r, g, b] = dominantColorStr.split(",").map(Number);
                const clampedR = Math.min(255, r);
                const clampedG = Math.min(255, g);
                const clampedB = Math.min(255, b);

                const darkColor = ensureDarkColor(clampedR, clampedG, clampedB);

                const result = `rgba(${darkColor.r}, ${darkColor.g}, ${darkColor.b}, 1)`;

                colorCacheRef.current[imageUrl] = result;

                window.dispatchEvent(
                  new CustomEvent("colorExtracted", {
                    detail: {
                      imageUrl,
                      color: result,
                      imageElement: img,
                      blobUrl: blobUrl,
                      blob: blob,
                    },
                  })
                );

                finalize(result);
              } else {
                colorCacheRef.current[imageUrl] = defaultColor;

                window.dispatchEvent(
                  new CustomEvent("colorExtracted", {
                    detail: {
                      imageUrl,
                      color: defaultColor,
                      imageElement: img,
                      blobUrl: blobUrl,
                      blob: blob,
                    },
                  })
                );

                finalize(defaultColor);
              }
            } catch {
              finalize(defaultColor);
            }
          };

          img.onerror = () => {
            colorCacheRef.current[imageUrl] = defaultColor;

            window.dispatchEvent(
              new CustomEvent("colorExtracted", {
                detail: {
                  imageUrl,
                  color: defaultColor,
                  imageElement: null,
                  blobUrl: null,
                  blob: null,
                },
              })
            );

            finalize(defaultColor);
          };

          img.src = blobUrl;
        })
        .catch(error => {
          console.warn(`[COLOR_EXTRACTION] 图片获取失败 (${imageUrl}):`, error.message || error);

          colorCacheRef.current[imageUrl] = defaultColor;

          window.dispatchEvent(
            new CustomEvent("colorExtracted", {
              detail: {
                imageUrl,
                color: defaultColor,
                imageElement: null,
                blobUrl: null,
                blob: null,
                error: error.message || "网络错误或跨域限制",
              },
            })
          );

          resolve(defaultColor);
        });
    });
  }, []);

  // 提取并设置主色调
  const extractAndSetDominantColor = useCallback(
    async (imageUrl: string) => {
      const requestId = ++extractionRequestIdRef.current;

      if (currentProcessingUrlRef.current === imageUrl) {
        return;
      }

      // 检查缓存
      if (colorCacheRef.current[imageUrl]) {
        if (requestId === extractionRequestIdRef.current) {
          setDominantColor(colorCacheRef.current[imageUrl]);
        }

        window.dispatchEvent(
          new CustomEvent("colorExtracted", {
            detail: {
              imageUrl,
              color: colorCacheRef.current[imageUrl],
              imageElement: null,
              fromCache: true,
            },
          })
        );
        return;
      }

      if (colorExtractionTimerRef.current) {
        clearTimeout(colorExtractionTimerRef.current);
      }

      colorExtractionTimerRef.current = window.setTimeout(async () => {
        currentProcessingUrlRef.current = imageUrl;

        try {
          const color = await extractDominantColor(imageUrl);
          if (requestId === extractionRequestIdRef.current) {
            setDominantColor(color);
          }
        } catch {
          if (requestId === extractionRequestIdRef.current) {
            setDominantColor("var(--anzhiyu-main)");
          }
        } finally {
          if (currentProcessingUrlRef.current === imageUrl) {
            currentProcessingUrlRef.current = null;
          }
        }
      }, 100);
    },
    [extractDominantColor]
  );

  // 清理资源
  const cleanup = useCallback(() => {
    extractionRequestIdRef.current += 1;

    if (colorExtractionTimerRef.current) {
      clearTimeout(colorExtractionTimerRef.current);
      colorExtractionTimerRef.current = null;
    }

    currentProcessingUrlRef.current = null;
  }, []);

  // 重置为默认颜色
  const resetToDefaultColor = useCallback(() => {
    setDominantColor("var(--anzhiyu-main)");
  }, []);

  // 获取播放列表样式（基于主色调）
  const getPlaylistStyle = useCallback(() => {
    let color = dominantColor.startsWith("var(") ? "rgba(49, 194, 124, 1)" : dominantColor;

    if (color.startsWith("rgba(")) {
      const rgba = color.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*[\d.]+\)/);
      if (rgba) {
        const [, r, g, b] = rgba;
        color = `rgb(${r}, ${g}, ${b})`;
      }
    }

    const style: Record<string, string> = {
      background: `linear-gradient(135deg, ${color}dd 0%, ${color}bb 100%)`,
      backdropFilter: "blur(30px)",
      WebkitBackdropFilter: "blur(30px)",
    };

    if (color !== `rgb(49, 194, 124)`) {
      style.backgroundColor = color.replace("1)", "0.85)").replace("rgb(", "rgba(");
    } else {
      style.backgroundColor = "var(--anzhiyu-main)";
    }

    return style;
  }, [dominantColor]);

  return {
    dominantColor,
    extractDominantColor,
    extractAndSetDominantColor,
    getPlaylistStyle,
    resetToDefaultColor,
    cleanup,
  };
}

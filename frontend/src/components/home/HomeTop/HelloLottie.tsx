"use client";

import { useRef, useEffect, useState } from "react";
import styles from "./HelloLottie.module.css";

interface HelloLottieProps {
  width?: string;
  height?: string;
}

// 动态导入 lottie-web 精简版本
const loadLottie = async () => {
  try {
    // 导入精简版本（只支持 SVG）
    // @ts-expect-error - lottie_light.min.js 没有类型声明
    const lottieLight = await import("lottie-web/build/player/esm/lottie_light.min.js");
    return lottieLight.default || lottieLight;
  } catch {
    // 如果精简版本不可用，回退到完整版本
    try {
      const lottie = await import("lottie-web");
      return lottie.default;
    } catch (fallbackError) {
      console.error("Failed to load lottie-web:", fallbackError);
      return null;
    }
  }
};

// 获取 .lottie 文件路径
const getLottiePath = () => {
  return "/static/hello.lottie";
};

// 从 .lottie 文件中提取 JSON 动画数据
const extractLottieJson = async (lottiePath: string): Promise<unknown> => {
  try {
    // 动态导入 jszip
    const JSZip = (await import("jszip")).default;

    // 获取 .lottie 文件
    const response = await fetch(lottiePath);
    if (!response.ok) {
      throw new Error(`Failed to fetch .lottie file: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    // 读取 manifest.json
    const manifestFile = zip.file("manifest.json");
    if (!manifestFile) {
      throw new Error("manifest.json not found in .lottie file");
    }

    const manifestContent = await manifestFile.async("string");
    const manifest = JSON.parse(manifestContent);

    // 获取第一个动画的路径（根据 manifest 结构）
    let animationPath: string;
    if (manifest.animations && manifest.animations.length > 0) {
      const animationId = manifest.animations[0].id || manifest.animations[0];

      // 根据 manifest 版本判断路径格式
      if (manifest.version === "2" || zip.file(`a/${animationId}.json`)) {
        animationPath = `a/${animationId}.json`;
      } else {
        animationPath = `animations/${animationId}.json`;
      }
    } else {
      // 如果没有 manifest.animations，尝试查找所有可能的动画文件
      const animationFiles = Object.keys(zip.files).filter(
        name => (name.startsWith("animations/") || name.startsWith("a/")) && name.endsWith(".json")
      );
      if (animationFiles.length === 0) {
        throw new Error("No animation JSON found in .lottie file");
      }
      animationPath = animationFiles[0];
    }

    // 读取动画 JSON
    const animationFile = zip.file(animationPath);
    if (!animationFile) {
      throw new Error(`Animation file not found: ${animationPath}`);
    }

    const animationJson = await animationFile.async("string");
    return JSON.parse(animationJson);
  } catch (error) {
    console.error("Failed to extract JSON from .lottie file:", error);
    throw error;
  }
};

export function HelloLottie({ width = "100%", height = "100%" }: HelloLottieProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animationInstanceRef = useRef<unknown>(null);
  const loadingRef = useRef(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const initLottie = async () => {
      if (!containerRef.current) return;

      const lottie = await loadLottie();
      if (!lottie || !isMounted) {
        setIsLoading(false);
        return;
      }

      try {
        // 从 .lottie 文件中提取 JSON 动画数据
        const animationData = await extractLottieJson(getLottiePath());

        if (!isMounted) return;

        // 使用 lottie-web 加载动画
        const loadAnimation =
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (lottie as any).loadAnimation || (lottie as any).default?.loadAnimation || lottie;

        const instance = loadAnimation({
          container: containerRef.current,
          renderer: "svg",
          loop: false,
          autoplay: true,
          animationData,
        });

        animationInstanceRef.current = instance;

        const markLoaded = () => {
          loadingRef.current = false;
          setIsLoading(false);
        };

        // 监听加载完成事件
        instance.addEventListener("DOMLoaded", () => {
          if (isMounted) markLoaded();
        });

        instance.addEventListener("complete", () => {
          if (isMounted) markLoaded();
        });

        // 如果动画已经加载完成
        if (instance.isLoaded) {
          markLoaded();
        }

        instance.addEventListener("data_failed", () => {
          if (isMounted) markLoaded();
          console.error("Failed to load Lottie animation");
        });

        // 超时保护
        setTimeout(() => {
          if (isMounted && loadingRef.current) {
            markLoaded();
            console.warn("Lottie animation loading timeout");
          }
        }, 3000);
      } catch (error) {
        console.error("Error loading Lottie animation:", error);
        if (isMounted) {
          loadingRef.current = false;
          setIsLoading(false);
        }
      }
    };

    initLottie();

    return () => {
      isMounted = false;
      if (animationInstanceRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (animationInstanceRef.current as any).destroy?.();
        animationInstanceRef.current = null;
      }
    };
  }, []);

  return (
    <div className={styles.helloLottieContainer} style={{ width, height }}>
      <div ref={containerRef} className={styles.helloLottieAnimation} />
      {isLoading && (
        <div className={styles.helloLottieLoading}>
          <div className={styles.loadingSpinner} />
        </div>
      )}
    </div>
  );
}

/*
 * @Description: 首页 Hero 区域 - 高级设计版本
 * @Author: 安知鱼
 * @Date: 2026-01-30 16:55:49
 * @LastEditTime: 2026-01-31 14:00:00
 * @LastEditors: 安知鱼
 */
"use client";

import { useRef, useMemo } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Icon } from "@iconify/react";
import Link from "next/link";
import { Button } from "@/components/ui";
import { GlowingOrb, ParticleField } from "@/components/effects";
import { useSiteConfigStore } from "@/store/site-config-store";

export function Hero() {
  const containerRef = useRef<HTMLDivElement>(null);

  // 从 store 获取站点配置
  const siteConfig = useSiteConfigStore(state => state.siteConfig);

  // 站点名称
  const siteName = useMemo(() => {
    return siteConfig?.APP_NAME || "AnHeYu";
  }, [siteConfig?.APP_NAME]);

  // 副标题（用于描述区域显示）
  const subTitle = useMemo(() => {
    return siteConfig?.SUB_TITLE || "生活明朗，万物可爱";
  }, [siteConfig?.SUB_TITLE]);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  // 视差效果
  const titleY = useTransform(scrollYProgress, [0, 1], [0, 200]);
  const titleOpacity = useTransform(scrollYProgress, [0, 0.4], [1, 0]);
  const titleScale = useTransform(scrollYProgress, [0, 0.4], [1, 0.9]);
  const subtitleY = useTransform(scrollYProgress, [0, 1], [0, 150]);
  const subtitleOpacity = useTransform(scrollYProgress, [0, 0.3], [1, 0]);
  const bgScale = useTransform(scrollYProgress, [0, 1], [1, 1.2]);
  const bgOpacity = useTransform(scrollYProgress, [0, 0.5], [0.6, 0]);

  return (
    <section ref={containerRef} className="relative h-screen">
      {/* Sticky container */}
      <div className="sticky top-0 flex flex-col items-center justify-center h-screen overflow-hidden">
        {/* 粒子背景 */}
        <ParticleField count={25} className="opacity-60" />

        {/* 背景发光效果 */}
        <motion.div className="absolute inset-0 pointer-events-none" style={{ scale: bgScale, opacity: bgOpacity }}>
          <GlowingOrb
            size={800}
            color="primary"
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          />
          <GlowingOrb size={600} color="cyan" className="absolute top-1/4 -right-1/4 -translate-y-1/2" animate={true} />
          <GlowingOrb size={500} color="purple" className="absolute -bottom-1/4 -left-1/4" animate={true} />
        </motion.div>

        {/* 网格背景 */}
        <div className="absolute inset-0 grid-pattern opacity-40" />

        {/* Main content */}
        <div className="relative z-10 max-w-6xl px-4 mx-auto text-center sm:px-6 -mt-16">
          {/* Eyebrow */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            style={{ opacity: subtitleOpacity, y: subtitleY }}
            className="mb-6 sm:mb-8"
          >
            <span className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-medium tracking-widest sm:tracking-[0.15em] uppercase rounded-full bg-primary/10 text-primary border border-primary/20">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              Next Generation Blog Theme
            </span>
          </motion.div>

          {/* Main title - Apple style large typography */}
          <motion.div style={{ y: titleY, opacity: titleOpacity, scale: titleScale }}>
            <motion.h1
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.4 }}
              className="text-[clamp(2.5rem,8vw,6rem)] font-bold leading-[0.9] tracking-[-0.03em] mb-6"
            >
              <span className="gradient-text-brand">{siteName}</span>
            </motion.h1>
          </motion.div>

          {/* Subtitle - 副标题 */}
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            style={{ opacity: subtitleOpacity, y: subtitleY }}
            className="max-w-2xl px-2 mx-auto text-2xl font-medium leading-relaxed sm:text-3xl md:text-4xl text-foreground/80"
          >
            {subTitle}
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            style={{ opacity: subtitleOpacity }}
            className="flex flex-col items-center justify-center gap-3 px-4 mt-10 sm:gap-4 sm:mt-14 sm:flex-row sm:px-0"
          >
            <Link href="/archives">
              <Button
                size="lg"
                className="w-full sm:w-auto px-8 py-4 text-base font-medium rounded-full shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:scale-105 transition-all duration-300"
              >
                浏览文章
              </Button>
            </Link>
            <Link href="/about">
              <Button
                variant="outline"
                size="lg"
                className="w-full sm:w-auto px-8 py-4 text-base font-medium rounded-full border-foreground/20 hover:border-foreground/40 hover:bg-foreground/5 hover:scale-105 transition-all duration-300"
              >
                了解更多
              </Button>
            </Link>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          style={{ opacity: subtitleOpacity }}
          className="absolute -translate-x-1/2 bottom-24 left-1/2"
        >
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 0.8, repeat: Infinity, ease: "easeOut" }}
            className="cursor-pointer"
            onClick={() => window.scrollTo({ top: window.innerHeight, behavior: "smooth" })}
          >
            <Icon icon="fa6-solid:angles-down" className="w-6 h-6 text-muted-foreground/60" />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

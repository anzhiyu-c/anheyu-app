/**
 * 动态粒子背景组件
 * 在 Canvas 上绘制动态粒子网络效果
 */
"use client";

import { useRef, useEffect, memo } from "react";
import { useInViewport, usePrefersReducedMotion } from "./hooks";

interface ParticleFieldProps {
  /** 粒子数量 */
  count?: number;
  /** 额外的 className */
  className?: string;
}

/**
 * 动态粒子背景
 * 优化版本，只在视口内时运行
 */
export const ParticleField = memo(function ParticleField({ count = 30, className = "" }: ParticleFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isInView = useInViewport(canvasRef);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isInView || prefersReducedMotion) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();

    let resizeTimeout: NodeJS.Timeout;
    const throttledResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(resize, 100);
    };
    window.addEventListener("resize", throttledResize);

    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      opacity: number;
    }> = [];

    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2,
        size: Math.random() * 2 + 1,
        opacity: Math.random() * 0.4 + 0.1,
      });
    }

    let animationId: number;
    let lastTime = 0;
    const targetFPS = 30;
    const frameInterval = 1000 / targetFPS;

    const animate = (currentTime: number) => {
      animationId = requestAnimationFrame(animate);

      const deltaTime = currentTime - lastTime;
      if (deltaTime < frameInterval) return;
      lastTime = currentTime - (deltaTime % frameInterval);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p, i) => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        // 使用主题色
        ctx.fillStyle = `rgba(22, 59, 242, ${p.opacity})`;
        ctx.fill();

        const nearbyParticles = particles.slice(i + 1, i + 6);
        nearbyParticles.forEach(p2 => {
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < 14400) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(22, 59, 242, ${0.08 * (1 - Math.sqrt(distSq) / 120)})`;
            ctx.stroke();
          }
        });
      });
    };

    animationId = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", throttledResize);
      clearTimeout(resizeTimeout);
      cancelAnimationFrame(animationId);
    };
  }, [count, isInView, prefersReducedMotion]);

  return <canvas ref={canvasRef} className={`absolute inset-0 pointer-events-none ${className}`} />;
});

export default ParticleField;

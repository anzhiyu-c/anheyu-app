"use client";

import { Sun, Moon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { IconButton } from "@/components/ui";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function ThemeToggle({ className, size = "md" }: ThemeToggleProps) {
  const { isDark, toggleTheme, mounted } = useTheme();

  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6",
  };

  if (!mounted) {
    return (
      <IconButton className={cn("cursor-pointer", className)} aria-label="切换主题">
        <div className={sizeClasses[size]} />
      </IconButton>
    );
  }

  return (
    <IconButton
      onClick={toggleTheme}
      className={cn(
        "relative cursor-pointer",
        "hover:bg-primary-op-light active:scale-95",
        "transition-all duration-200",
        className
      )}
      aria-label={isDark ? "切换到浅色模式" : "切换到深色模式"}
    >
      <AnimatePresence mode="wait">
        {isDark ? (
          <motion.div
            key="sun"
            initial={{ opacity: 0, scale: 0.5, rotate: -90 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.5, rotate: 90 }}
            transition={{
              duration: 0.25,
              ease: [0.34, 1.56, 0.64, 1],
            }}
            className="flex items-center justify-center"
          >
            <Sun className={cn(sizeClasses[size], "text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.4)]")} />
          </motion.div>
        ) : (
          <motion.div
            key="moon"
            initial={{ opacity: 0, scale: 0.5, rotate: 90 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.5, rotate: -90 }}
            transition={{
              duration: 0.25,
              ease: [0.34, 1.56, 0.64, 1],
            }}
            className="flex items-center justify-center"
          >
            <Moon className={cn(sizeClasses[size], "text-slate-500 dark:text-slate-400")} />
          </motion.div>
        )}
      </AnimatePresence>
    </IconButton>
  );
}

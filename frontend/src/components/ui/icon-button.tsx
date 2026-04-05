"use client";

import { cn } from "@/lib/utils";
import type { ReactNode, ButtonHTMLAttributes } from "react";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "default" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
}

export function IconButton({ children, variant = "ghost", size = "md", className, ...props }: IconButtonProps) {
  const variantStyles = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90",
    ghost: "hover:bg-muted",
    outline: "border border-border hover:bg-muted",
  };

  const sizeStyles = {
    sm: "p-1.5",
    md: "p-2",
    lg: "p-3",
  };

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-lg transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

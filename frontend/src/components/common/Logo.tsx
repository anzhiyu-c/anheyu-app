import Link from "next/link";
import { cn } from "@/lib/utils";
import { siteConfig } from "@/config";

interface LogoProps {
  className?: string;
  href?: string;
}

export function Logo({ className, href = "/" }: LogoProps) {
  return (
    <Link href={href} className={cn("font-bold text-xl gradient-text", className)}>
      {siteConfig.name}
    </Link>
  );
}

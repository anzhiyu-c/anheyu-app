"use client";

import Image from "next/image";
import type { LinkItem } from "@/types/friends";

interface LinkCardProps {
  link: LinkItem;
}

export function LinkCard({ link }: LinkCardProps) {
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-xl border border-border bg-card p-4 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-primary/30"
    >
      <div className="flex items-center gap-3">
        {link.logo ? (
          <Image
            src={link.logo}
            alt={link.name}
            width={48}
            height={48}
            className="w-12 h-12 rounded-full object-cover border border-border shrink-0"
            unoptimized
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center text-primary font-bold text-lg shrink-0">
            {link.name[0]}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
            {link.name}
          </p>
          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{link.description || link.url}</p>
        </div>
      </div>
      {link.siteshot && (
        <div className="mt-3 rounded-lg overflow-hidden border border-border/50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={link.siteshot} alt={`${link.name} 截图`} className="w-full h-28 object-cover" loading="lazy" />
        </div>
      )}
    </a>
  );
}

interface LinkListItemProps {
  link: LinkItem;
}

export function LinkListItem({ link }: LinkListItemProps) {
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 transition-all duration-200 hover:border-primary/30 hover:bg-primary/5"
    >
      {link.logo ? (
        <Image
          src={link.logo}
          alt={link.name}
          width={36}
          height={36}
          className="w-9 h-9 rounded-full object-cover border border-border shrink-0"
          unoptimized
        />
      ) : (
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
          {link.name[0]}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
          {link.name}
        </p>
        <p className="text-xs text-muted-foreground truncate">{link.description || link.url}</p>
      </div>
    </a>
  );
}

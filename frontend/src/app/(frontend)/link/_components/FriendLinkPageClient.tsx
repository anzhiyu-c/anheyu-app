"use client";

import { useRef } from "react";
import { LinkTopBanner } from "./LinkTopBanner";
import { LinkListSection } from "./LinkListSection";
import { ApplyLink } from "./ApplyLink";
import { CommentSection } from "@/components/post/Comment";
import "../_styles/flink.scss";
import "../_styles/post-content.scss";

export function FriendLinkPageClient() {
  const applyRef = useRef<HTMLDivElement>(null);

  const handleScrollToApply = () => {
    if (applyRef.current) {
      const offset = 80;
      const top = applyRef.current.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: "smooth" });
    }
  };

  return (
    <div className="post-link-page">
      <LinkTopBanner onScrollToApply={handleScrollToApply} />

      <LinkListSection />

      <div ref={applyRef}>
        <ApplyLink />
      </div>

      <div className="link-comment-section" style={{ marginTop: "2rem" }}>
        <CommentSection targetTitle="友情链接" targetPath="/link" />
      </div>
    </div>
  );
}

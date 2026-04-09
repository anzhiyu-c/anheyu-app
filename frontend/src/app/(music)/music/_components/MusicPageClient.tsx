"use client";

import dynamic from "next/dynamic";

const MusicPageContent = dynamic(() => import("./MusicPageContent").then(mod => mod.MusicPageContent), { ssr: false });

export function MusicPageClient() {
  return <MusicPageContent />;
}

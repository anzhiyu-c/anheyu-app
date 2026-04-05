"use client";

import { Sidebar } from "@/components/home";
import { ArchiveList } from "./ArchiveList";

interface ArchivePageContentProps {
  year?: number;
  month?: number;
  page?: number;
}

export function ArchivePageContent({ year, month, page }: ArchivePageContentProps) {
  return (
    <div className="archive-page-content">
      <div className="content-inner">
        <div className="main-content">
          <ArchiveList year={year} month={month} page={page} />
        </div>
        <Sidebar />
      </div>
    </div>
  );
}

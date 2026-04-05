"use client";

export function AlbumSkeleton() {
  return (
    <div className="h-full flex flex-col overflow-hidden -m-4 lg:-m-8 animate-pulse">
      <div className="flex-1 min-h-0 flex flex-col mx-6 mt-5 mb-2 bg-card border border-border/60 rounded-xl overflow-hidden">
        {/* 头部 */}
        <div className="shrink-0 px-5 pt-4 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="h-6 w-28 bg-muted rounded-md" />
              <div className="h-3 w-48 bg-muted/40 rounded mt-2" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-9 w-24 bg-primary/20 rounded-lg" />
            </div>
          </div>
        </div>

        {/* 筛选栏 */}
        <div className="shrink-0 px-5 pb-3">
          <div className="flex items-center gap-3">
            <div className="h-8 w-28 bg-muted/30 rounded-lg" />
            <div className="ml-auto h-8 w-16 bg-muted/30 rounded-lg" />
          </div>
        </div>

        {/* 表格 */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden border-t border-border/40">
          <div className="h-10 border-b border-border/40 bg-muted/10" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-border/20">
              <div className="w-4 h-4 bg-muted/40 rounded" />
              <div className="w-16 h-16 bg-muted/30 rounded-lg" />
              <div className="flex-1">
                <div className="h-4 w-24 bg-muted/40 rounded" />
                <div className="h-3 w-40 bg-muted/20 rounded mt-1.5" />
              </div>
              <div className="h-4 w-28 bg-muted/20 rounded hidden sm:block" />
              <div className="flex flex-col gap-1">
                <div className="h-3 w-12 bg-muted/20 rounded" />
                <div className="h-3 w-12 bg-muted/20 rounded" />
              </div>
              <div className="h-4 w-20 bg-muted/20 rounded hidden md:block" />
              <div className="flex gap-1">
                <div className="w-7 h-7 bg-muted/20 rounded-full" />
                <div className="w-7 h-7 bg-muted/20 rounded-full" />
              </div>
            </div>
          ))}
        </div>

        {/* 分页 */}
        <div className="shrink-0 flex items-center justify-between px-5 py-3 border-t border-border/30">
          <div className="h-4 w-32 bg-muted/30 rounded" />
          <div className="flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="w-7 h-7 bg-muted/30 rounded" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

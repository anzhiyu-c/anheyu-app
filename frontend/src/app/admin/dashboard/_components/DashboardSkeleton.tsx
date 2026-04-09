// ==================== 加载骨架屏 ====================
export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* 欢迎区域骨架 */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-48 bg-muted rounded" />
          <div className="h-4 w-32 bg-muted rounded mt-2" />
        </div>
        <div className="h-10 w-24 bg-muted rounded-lg" />
      </div>

      {/* 统计卡片骨架 */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 bg-muted rounded-xl" />
        ))}
      </div>

      {/* 快捷操作骨架 */}
      <div className="h-24 bg-muted rounded-xl" />

      {/* 图表区域骨架 */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <div className="h-80 bg-muted rounded-xl" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 bg-muted rounded-xl" />
            ))}
          </div>
        </div>
        <div className="space-y-6">
          <div className="h-64 bg-muted rounded-xl" />
          <div className="h-32 bg-muted rounded-xl" />
        </div>
      </div>
    </div>
  );
}

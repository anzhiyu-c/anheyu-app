export default function AdminLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-32 bg-muted/50 rounded-lg" />
          <div className="h-4 w-48 bg-muted/30 rounded mt-2" />
        </div>
        <div className="h-9 w-24 bg-muted/50 rounded-lg" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 bg-card border border-border/50 rounded-xl" />
        ))}
      </div>
      <div className="h-64 bg-card border border-border/50 rounded-xl" />
    </div>
  );
}

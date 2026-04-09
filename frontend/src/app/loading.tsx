export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <svg
        className="h-10 w-10 animate-[spin_0.8s_linear_infinite]"
        viewBox="0 0 50 50"
        style={{ willChange: "transform" }}
      >
        <circle cx="25" cy="25" r="20" fill="none" stroke="currentColor" strokeWidth="4" className="text-primary/15" />
        <circle
          cx="25"
          cy="25"
          r="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray="80 125"
          className="text-primary"
        />
      </svg>
    </div>
  );
}

"use client";

export default function Error({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <button
        onClick={reset}
        className="px-6 py-3 rounded-lg border border-white/10 text-sm hover:border-white/30 transition-colors"
      >
        Reload
      </button>
    </div>
  );
}

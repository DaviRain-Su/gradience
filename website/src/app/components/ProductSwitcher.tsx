"use client";
import { useState, useRef, useEffect } from "react";

type Product = {
  name: string;
  description: string;
  href: string;
  devHref?: string;
  devOnly?: boolean;
};

function resolveHref(p: Product, isDev: boolean): string {
  if (isDev && p.devHref) return p.devHref;
  return p.href;
}

const PRODUCTS: Product[] = [
  {
    name: "AgentM",
    description: "Agent messaging",
    href: process.env.NEXT_PUBLIC_AGENTM_URL ?? "https://agentm.gradiences.xyz",
    devHref: "http://localhost:5200",
  },
  {
    name: "AgentM Pro",
    description: "Developer platform",
    href: process.env.NEXT_PUBLIC_AGENTM_PRO_URL ?? "https://pro.gradiences.xyz",
    devHref: "http://localhost:5300",
  },
  {
    name: "Docs",
    description: "Documentation",
    href: process.env.NEXT_PUBLIC_DOCS_URL ?? "https://docs.gradiences.xyz",
    devHref: "http://localhost:3001",
  },
  {
    name: "Arena",
    description: "Agent arena",
    href: "#",
    devHref: "http://localhost:5100",
    devOnly: true,
  },
];

export function ProductSwitcher() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isDev =
    typeof window !== "undefined" && window.location.hostname === "localhost";

  const visible = PRODUCTS.filter((p) => !p.devOnly || isDev);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Switch product"
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[var(--text-2)] hover:text-white hover:bg-white/5 transition-all duration-200"
      >
        {/* 3×3 grid icon */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <rect x="0" y="0" width="4" height="4" rx="1" />
          <rect x="5" y="0" width="4" height="4" rx="1" />
          <rect x="10" y="0" width="4" height="4" rx="1" />
          <rect x="0" y="5" width="4" height="4" rx="1" />
          <rect x="5" y="5" width="4" height="4" rx="1" />
          <rect x="10" y="5" width="4" height="4" rx="1" />
          <rect x="0" y="10" width="4" height="4" rx="1" />
          <rect x="5" y="10" width="4" height="4" rx="1" />
          <rect x="10" y="10" width="4" height="4" rx="1" />
        </svg>
        <span className="text-[12px] font-medium">Products</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-[var(--border)] bg-[var(--bg)]/95 backdrop-blur-xl shadow-2xl overflow-hidden z-50">
          <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-2)]/60 border-b border-[var(--border)]">
            Gradience Suite
          </div>
          {visible.map((p) => {
            const href = resolveHref(p, isDev);
            return (
              <a
                key={p.name}
                href={href}
                target={href.startsWith("http") ? "_blank" : undefined}
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 transition-colors duration-150 group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13px] font-medium text-white group-hover:text-white">
                      {p.name}
                    </span>
                    {p.devOnly && (
                      <span className="text-[9px] font-semibold uppercase tracking-wide text-amber-400/80 bg-amber-400/10 px-1 rounded">
                        dev
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-[var(--text-2)]/60 truncate">
                    {p.description}
                  </div>
                </div>
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="text-[var(--text-2)]/40 group-hover:text-[var(--text-2)] flex-shrink-0 transition-colors"
                  aria-hidden="true"
                >
                  <path d="M2 8L8 2M8 2H4M8 2V6" />
                </svg>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

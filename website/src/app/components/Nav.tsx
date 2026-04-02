"use client";
import { useState, useEffect } from "react";

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const agentmUrl = process.env.NEXT_PUBLIC_AGENTM_URL ?? "https://agentm.xyz";

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", h);
    return () => window.removeEventListener("scroll", h);
  }, []);

  return (
    <nav
      className={`fixed top-0 w-full z-50 transition-all duration-500 ${
        scrolled
          ? "bg-[var(--bg)]/80 backdrop-blur-2xl border-b border-[var(--border)]"
          : ""
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <a href="#" className="text-lg font-semibold tracking-tight">
          Gradience
        </a>
        <div className="hidden md:flex items-center gap-8 text-[13px] text-[var(--text-2)]">
          <a href="#get-started" className="hover:text-white transition-colors duration-200">Get Started</a>
          <a href="https://codeberg.org/gradiences/gradiences" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors duration-200">Source</a>
          <a
            href="https://codeberg.org/gradiences/gradiences/src/branch/main/protocol/WHITEPAPER.md"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-1.5 rounded-full border border-white/10 hover:border-white/25 hover:text-white transition-all duration-200"
          >
            Whitepaper
          </a>
          <a
            href={agentmUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-1.5 rounded-full bg-white text-[var(--bg)] font-semibold hover:opacity-90 transition-all duration-200"
          >
            Launch AgentM
          </a>
        </div>
      </div>
    </nav>
  );
}

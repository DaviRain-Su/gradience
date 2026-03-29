"use client";
import { useState, useEffect } from "react";

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", h);
    return () => window.removeEventListener("scroll", h);
  }, []);

  return (
    <nav
      className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        scrolled
          ? "bg-[var(--bg)]/90 backdrop-blur-xl border-b border-[var(--border)]"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <a href="#" className="text-xl font-semibold tracking-tight">
          <span className="gradient-text">Gradience</span>
        </a>
        <div className="flex items-center gap-8">
          <div className="hidden md:flex items-center gap-6 text-[13px] text-[var(--text-2)]">
            <a href="#protocol" className="hover:text-white transition-colors">Protocol</a>
            <a href="#economics" className="hover:text-white transition-colors">Economics</a>
            <a href="#architecture" className="hover:text-white transition-colors">Architecture</a>
            <a
              href="https://github.com/DaviRain-Su/gradience"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              GitHub
            </a>
          </div>
          <a
            href="https://github.com/DaviRain-Su/gradience/blob/main/whitepaper/gradience-en.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-full text-xs font-medium border border-[var(--accent)]/30 text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-all"
          >
            Read Whitepaper
          </a>
        </div>
      </div>
    </nav>
  );
}

"use client";
import { useState, useEffect } from "react";

export function Nav() {
  const [scrolled, setScrolled] = useState(false);

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
        <a
          href="#waitlist"
          className="md:hidden px-3 py-1.5 rounded-full bg-white text-[var(--bg)] text-xs font-semibold hover:opacity-90 transition-all duration-200"
        >
          Join Waitlist
        </a>
        <div className="hidden md:flex items-center gap-6 text-[13px] text-[var(--text-2)]">
          <a href="#get-started" className="hover:text-white transition-colors duration-200">About</a>
          <a
            href="/whitepaper.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-1.5 rounded-full border border-white/10 hover:border-white/25 hover:text-white transition-all duration-200"
          >
            Whitepaper
          </a>
          <a
            href="#waitlist"
            className="px-4 py-1.5 rounded-full bg-white text-[var(--bg)] font-semibold hover:opacity-90 transition-all duration-200"
          >
            Join Waitlist
          </a>
        </div>
      </div>
    </nav>
  );
}

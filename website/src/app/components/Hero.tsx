"use client";
import { AgentWorld } from "./AgentWorld";

export function Hero() {
  return (
    <section className="relative h-screen flex flex-col items-center justify-center overflow-hidden">
      {/* Agent World background */}
      <AgentWorld />

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-[var(--bg)] to-transparent" />

      {/* Content */}
      <div className="relative z-10 text-center px-6">
        <h1 className="text-[clamp(2.5rem,6vw,5rem)] font-bold tracking-tight leading-[1.1] mb-6">
          An open protocol for
          <br />
          the Agent economy
        </h1>
        <p className="text-lg text-[var(--text-2)] max-w-xl mx-auto leading-relaxed mb-10">
          Gradience is a decentralized AI Agent credit protocol.
          Agents compete on tasks, build verifiable on-chain reputation,
          and unlock credit — with no intermediaries.
        </p>

        <div className="flex items-center justify-center gap-4">
          <a
            href="#get-started"
            className="px-7 py-3.5 rounded-full bg-white text-[var(--bg)] text-sm font-semibold hover:shadow-[0_0_40px_rgba(139,92,246,0.25)] transition-all duration-500"
          >
            Get started
          </a>
          <a
            href="https://codeberg.org/gradiences/gradiences/src/branch/main/whitepaper/gradience-en.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="px-7 py-3.5 rounded-full border border-white/15 text-sm text-[var(--text-2)] hover:text-white hover:border-white/40 transition-all duration-300"
          >
            Read whitepaper
          </a>
        </div>
      </div>

      {/* Scroll hint */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
        <div className="w-5 h-8 rounded-full border border-white/15 flex items-start justify-center p-1.5">
          <div className="w-1 h-2 rounded-full bg-white/40 animate-bounce" />
        </div>
      </div>
    </section>
  );
}

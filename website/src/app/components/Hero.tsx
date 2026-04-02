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
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 mb-8">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-[var(--text-2)]">Services is the New Software</span>
        </div>

        <h1 className="text-[clamp(2.5rem,6vw,5rem)] font-bold tracking-tight leading-[1.1] mb-6">
          The Trustless Settlement Layer
          <br />
          for the Services Revolution
        </h1>
        <p className="text-lg text-[var(--text-2)] max-w-2xl mx-auto leading-relaxed mb-10">
          For every dollar spent on software, six are spent on services.
          Gradience enables AI Agents to exchange capabilities and settle value
          without trusted intermediaries — the infrastructure for the $1T+ services transformation.
        </p>

        <div className="flex items-center justify-center gap-4">
          <a
            href="#waitlist"
            className="px-7 py-3.5 rounded-full bg-white text-[var(--bg)] text-sm font-semibold hover:shadow-[0_0_40px_rgba(139,92,246,0.25)] transition-all duration-500"
          >
            Join waitlist
          </a>
          <a
            href="/whitepaper.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="px-7 py-3.5 rounded-full border border-white/15 text-sm text-[var(--text-2)] hover:text-white hover:border-white/40 transition-all duration-300"
          >
            Read whitepaper
          </a>
        </div>

        {/* Stats */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-2xl mx-auto">
          <div className="text-center">
            <div className="text-2xl font-bold text-white">3</div>
            <div className="text-xs text-[var(--text-3)] mt-1">Primitives</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-white">5%</div>
            <div className="text-xs text-[var(--text-3)] mt-1">Protocol Fee</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-white">~300</div>
            <div className="text-xs text-[var(--text-3)] mt-1">Lines of Code</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-white">0</div>
            <div className="text-xs text-[var(--text-3)] mt-1">Intermediaries</div>
          </div>
        </div>

        {/* Bitcoin Philosophy */}
        <div className="mt-12 max-w-xl mx-auto">
          <blockquote className="text-sm text-[var(--text-2)] italic border-l-2 border-[var(--violet)] pl-4">
            Bitcoin defined money with UTXO + Script + PoW.
            <br />
            Gradience defines Agent capability exchange with Escrow + Judge + Reputation.
          </blockquote>
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

export function Hero() {
  return (
    <section className="pt-32 pb-20 px-6">
      <div className="max-w-4xl mx-auto text-center">
        {/* One-liner */}
        <p className="text-[var(--color-accent)] text-sm font-mono tracking-wider uppercase mb-6">
          Peer-to-Peer Capability Settlement Protocol
        </p>

        {/* Title */}
        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight leading-tight mb-8">
          The{" "}
          <span className="text-[var(--color-accent)]">Bitcoin</span>{" "}
          of the AI Agent Economy
        </h1>

        {/* Subtitle */}
        <p className="text-xl text-[var(--color-text-dim)] max-w-2xl mx-auto leading-relaxed mb-12">
          Three primitives — Escrow, Judge, Reputation — define how AI Agents
          exchange capabilities and settle value. No intermediaries. No
          platform fees. ~300 lines of code.
        </p>

        {/* Formula */}
        <div className="inline-block border border-[var(--color-border)] rounded-lg px-8 py-4 bg-[var(--color-bg-card)] mb-12">
          <p className="font-mono text-lg">
            <span className="text-[var(--color-accent)]">Escrow</span>
            {" + "}
            <span className="text-[var(--color-accent)]">Judge</span>
            {" + "}
            <span className="text-[var(--color-accent)]">Reputation</span>
            {" = "}
            <span className="text-white font-bold">
              Trustless Capability Settlement
            </span>
          </p>
        </div>

        {/* CTA */}
        <div className="flex items-center justify-center gap-4">
          <a
            href="https://github.com/DaviRain-Su/gradience/blob/main/whitepaper/gradience-en.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 rounded-lg bg-[var(--color-accent)] text-white font-medium hover:bg-[var(--color-accent-light)] transition-colors"
          >
            Read Whitepaper
          </a>
          <a
            href="https://github.com/DaviRain-Su/agent-arena"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 rounded-lg border border-[var(--color-border)] text-[var(--color-text-dim)] hover:text-white hover:border-[var(--color-text-dim)] transition-colors"
          >
            View Code →
          </a>
        </div>
      </div>
    </section>
  );
}

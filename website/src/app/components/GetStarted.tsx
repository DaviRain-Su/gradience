export function GetStarted() {
  return (
    <section id="get-started" className="py-24 px-6">
      <div className="max-w-3xl mx-auto">
        {/* Quote */}
        <div className="mb-16 text-center">
          <blockquote className="text-xl md:text-2xl font-medium text-white leading-relaxed mb-4">
            "The next $1T company will be a software company masquerading as a services firm."
          </blockquote>
          <cite className="text-sm text-[var(--text-3)] not-italic">
            — Sequoia Capital, March 2026
          </cite>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
          <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-center">
            <div className="text-2xl font-bold text-white">$1T+</div>
            <div className="text-xs text-[var(--text-3)] mt-1">Services Market</div>
          </div>
          <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-center">
            <div className="text-2xl font-bold text-white">6:1</div>
            <div className="text-xs text-[var(--text-3)] mt-1">Services:Software Ratio</div>
          </div>
          <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-center">
            <div className="text-2xl font-bold text-white">5%</div>
            <div className="text-xs text-[var(--text-3)] mt-1">Protocol Fee</div>
          </div>
          <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-center">
            <div className="text-2xl font-bold text-white">~300</div>
            <div className="text-xs text-[var(--text-3)] mt-1">Lines of Code</div>
          </div>
        </div>

        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold tracking-tight mb-4">Get started with Gradience</h2>
          <p className="text-[var(--text-2)] text-sm leading-relaxed max-w-xl mx-auto">
            Gradience provides the trustless settlement layer for the Services Revolution.
            Bitcoin solved trustless money in 2009. Gradience solves trustless service exchange in 2026.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="https://codeberg.org/gradiences/gradiences/src/branch/main/protocol/WHITEPAPER.md"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm font-medium hover:border-white/20 transition-all text-center"
          >
            📄 White paper
          </a>
          <a
            href="https://codeberg.org/gradiences/agent-arena"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm font-medium hover:border-white/20 transition-all text-center"
          >
            💻 Source code
          </a>
          <a
            href="https://codeberg.org/gradiences/gradiences/src/branch/main/protocol/README-zh.md"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm font-medium hover:border-white/20 transition-all text-center"
          >
            📜 中文文档
          </a>
        </div>
      </div>
    </section>
  );
}

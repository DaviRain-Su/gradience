const modules = [
  { name: "Chain Hub", role: "Tooling", desc: "Unified entry to on-chain services" },
  { name: "Agent Me", role: "Entry", desc: "Your digital self — voice-first, memory, sovereignty" },
  { name: "Agent Social", role: "Discovery", desc: "Agent scouts first, connects humans when aligned" },
  { name: "A2A Protocol", role: "Network", desc: "Cross-agent identity, trust, and payment (planned)" },
];

export function Architecture() {
  return (
    <section id="architecture" className="py-20 px-6 border-t border-[var(--color-border)]">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-center text-sm font-mono text-[var(--color-accent)] tracking-wider uppercase mb-4">
          Architecture
        </h2>
        <p className="text-center text-3xl font-bold mb-12">
          Kernel + Modules
        </p>

        {/* Kernel */}
        <div className="border-2 border-[var(--color-accent)] rounded-2xl p-8 bg-[var(--color-bg-card)] mb-6 text-center">
          <div className="text-xs font-mono text-[var(--color-accent)] uppercase tracking-wider mb-2">
            Kernel
          </div>
          <h3 className="text-2xl font-bold mb-2">Agent Layer</h3>
          <p className="text-[var(--color-text-dim)] text-sm mb-4">
            Escrow + Judge + Reputation
          </p>
          <div className="flex items-center justify-center gap-6 text-xs text-[var(--color-text-dim)] font-mono">
            <span>~300 lines</span>
            <span className="text-[var(--color-border)]">·</span>
            <span>4 states</span>
            <span className="text-[var(--color-border)]">·</span>
            <span>5 transitions</span>
            <span className="text-[var(--color-border)]">·</span>
            <span>immutable fees</span>
          </div>
        </div>

        {/* Modules */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {modules.map((m) => (
            <div
              key={m.name}
              className="border border-[var(--color-border)] rounded-xl p-4 bg-[var(--color-bg-card)] hover:bg-[var(--color-bg-card-hover)] transition-colors text-center"
            >
              <div className="text-xs text-[var(--color-accent)] font-mono mb-1">
                {m.role}
              </div>
              <div className="font-bold text-sm mb-1">{m.name}</div>
              <div className="text-xs text-[var(--color-text-dim)]">{m.desc}</div>
            </div>
          ))}
        </div>

        <p className="text-center text-sm text-[var(--color-text-dim)] mt-8">
          The kernel depends on no module. Modules depend on the kernel.
        </p>
      </div>
    </section>
  );
}

"use client";

const modules = [
  { name: "Chain Hub", desc: "Unified on-chain tooling", color: "#0ea5e9", status: "Building" },
  { name: "Agent Me", desc: "Your digital self", color: "#8b5cf6", status: "Designed" },
  { name: "Agent Social", desc: "Agent-first discovery", color: "#10b981", status: "Designed" },
  { name: "A2A Protocol", desc: "Cross-agent network", color: "#f59e0b", status: "Planned" },
];

export function Architecture() {
  return (
    <section id="architecture" className="py-32 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-[var(--accent)] text-xs font-mono tracking-wider uppercase mb-4">
            Architecture
          </p>
          <h2 className="text-4xl font-bold tracking-tight">
            One kernel,
            <br />
            <span className="gradient-text">everything grows on top</span>
          </h2>
        </div>

        {/* Kernel */}
        <div className="relative mb-8">
          <div className="absolute -inset-2 bg-gradient-to-br from-[var(--accent)]/10 to-[var(--accent-2)]/10 rounded-3xl blur-xl" />
          <div className="relative border border-[var(--accent)]/20 rounded-2xl p-10 bg-[var(--bg-elevated)] text-center">
            <div className="text-[10px] font-mono text-[var(--accent)] uppercase tracking-[0.2em] mb-3">
              Kernel
            </div>
            <h3 className="text-3xl font-bold mb-2">Agent Layer</h3>
            <p className="text-[var(--text-2)] text-sm mb-6">
              Escrow + Judge + Reputation
            </p>
            <div className="flex items-center justify-center gap-8 text-xs text-[var(--text-3)] font-mono">
              <span>~300 lines</span>
              <span className="w-1 h-1 rounded-full bg-[var(--text-3)]/30" />
              <span>4 states</span>
              <span className="w-1 h-1 rounded-full bg-[var(--text-3)]/30" />
              <span>5 transitions</span>
              <span className="w-1 h-1 rounded-full bg-[var(--text-3)]/30" />
              <span>immutable fees</span>
            </div>
          </div>
        </div>

        {/* Connector lines */}
        <div className="flex justify-center mb-4">
          <div className="grid grid-cols-4 gap-4 w-full max-w-md">
            {[0,1,2,3].map(i => (
              <div key={i} className="flex justify-center">
                <div className="w-px h-8 bg-gradient-to-b from-white/10 to-white/5" />
              </div>
            ))}
          </div>
        </div>

        {/* Modules */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {modules.map((m) => (
            <div
              key={m.name}
              className="group border border-white/5 rounded-xl p-5 bg-[var(--bg-elevated)] hover:border-white/10 transition-all duration-300 text-center"
            >
              <div
                className="w-8 h-8 rounded-lg mx-auto mb-3 flex items-center justify-center"
                style={{ background: m.color + "15", border: `1px solid ${m.color}30` }}
              >
                <div className="w-2 h-2 rounded-full" style={{ background: m.color }} />
              </div>
              <div className="font-semibold text-sm mb-1">{m.name}</div>
              <div className="text-xs text-[var(--text-3)]">{m.desc}</div>
              <div className="text-[10px] text-[var(--text-3)]/60 mt-2 font-mono">{m.status}</div>
            </div>
          ))}
        </div>

        <p className="text-center text-sm text-[var(--text-3)] mt-8">
          The kernel depends on no module. Modules depend on the kernel.
        </p>
      </div>
    </section>
  );
}

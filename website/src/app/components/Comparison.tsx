const rows = [
  { dim: "States / Transitions", them: "6 / 8", us: "4 / 5" },
  { dim: "Task creation", them: "3 steps", us: "1 atomic op" },
  { dim: "Evaluation", them: "Binary", us: "0–100 score" },
  { dim: "Reputation", them: "External", us: "Built-in" },
  { dim: "Competition", them: "None", us: "Multi-agent" },
  { dim: "Extensions", them: "Hook system", us: "None (above)" },
  { dim: "Fee mutability", them: "Admin key", us: "Immutable" },
  { dim: "Permissions", them: "Whitelist", us: "Permissionless" },
  { dim: "Judge incentive", them: "Unspecified", us: "3% unconditional" },
];

export function Comparison() {
  return (
    <section className="py-20 px-6 border-t border-[var(--color-border)]">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-center text-sm font-mono text-[var(--color-accent)] tracking-wider uppercase mb-4">
          Protocol Comparison
        </h2>
        <p className="text-center text-3xl font-bold mb-2">
          Gradience vs ERC-8183
        </p>
        <p className="text-center text-[var(--color-text-dim)] mb-10 text-sm">
          ERC-8183 (Agentic Commerce) by Virtuals Protocol — the closest existing standard.
        </p>

        <div className="border border-[var(--color-border)] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-card)]">
                <th className="text-left px-5 py-3 text-[var(--color-text-dim)] font-normal">
                  Dimension
                </th>
                <th className="text-center px-5 py-3 text-[var(--color-text-dim)] font-normal">
                  ERC-8183
                </th>
                <th className="text-center px-5 py-3 text-[var(--color-accent)] font-bold">
                  Gradience
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={r.dim}
                  className={`border-b border-[var(--color-border)] ${
                    i % 2 === 0 ? "" : "bg-[var(--color-bg-card)]"
                  }`}
                >
                  <td className="px-5 py-3">{r.dim}</td>
                  <td className="px-5 py-3 text-center text-[var(--color-text-dim)]">
                    {r.them}
                  </td>
                  <td className="px-5 py-3 text-center font-medium text-white">
                    {r.us}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-center text-xs text-[var(--color-text-dim)] mt-4">
          Gradience leads on 9 of 11 dimensions.
        </p>
      </div>
    </section>
  );
}

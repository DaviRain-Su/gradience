export function Economics() {
  return (
    <section id="economics" className="py-20 px-6 border-t border-[var(--color-border)]">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-center text-sm font-mono text-[var(--color-accent)] tracking-wider uppercase mb-4">
          Economic Model
        </h2>
        <p className="text-center text-3xl font-bold mb-12">
          Judge = Miner
        </p>

        {/* Fee split visual */}
        <div className="max-w-md mx-auto mb-12">
          <div className="text-center text-sm text-[var(--color-text-dim)] mb-4">
            Every task&apos;s locked value splits on settlement:
          </div>
          <div className="space-y-3">
            {/* Agent bar */}
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Agent (winner) or Poster (refund)</span>
                <span className="font-mono text-[var(--color-accent)]">95%</span>
              </div>
              <div className="h-3 rounded-full bg-[var(--color-border)] overflow-hidden">
                <div className="h-full rounded-full bg-[var(--color-accent)]" style={{ width: "95%" }} />
              </div>
            </div>
            {/* Judge bar */}
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Judge — unconditional</span>
                <span className="font-mono text-[var(--color-accent)]">3%</span>
              </div>
              <div className="h-3 rounded-full bg-[var(--color-border)] overflow-hidden">
                <div className="h-full rounded-full bg-[var(--color-accent-light)]" style={{ width: "3%" }} />
              </div>
            </div>
            {/* Protocol bar */}
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Protocol Treasury</span>
                <span className="font-mono text-[var(--color-accent)]">2%</span>
              </div>
              <div className="h-3 rounded-full bg-[var(--color-border)] overflow-hidden">
                <div className="h-full rounded-full bg-[var(--color-accent)]/50" style={{ width: "2%" }} />
              </div>
            </div>
          </div>
          <p className="text-center text-xs text-[var(--color-text-dim)] mt-4">
            All rates are <strong className="text-[var(--color-text)]">immutable constants</strong>. Total: 5%.
          </p>
        </div>

        {/* Two columns: Judge logic + GAN */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Why unconditional */}
          <div className="border border-[var(--color-border)] rounded-xl p-6 bg-[var(--color-bg-card)]">
            <h3 className="font-bold mb-3">Why Judges are paid unconditionally</h3>
            <ul className="space-y-2 text-sm text-[var(--color-text-dim)]">
              <li>
                <span className="text-red-400">✗</span> Fee only on approval → bias toward always approving
              </li>
              <li>
                <span className="text-red-400">✗</span> Fee only on rejection → bias toward always rejecting
              </li>
              <li>
                <span className="text-green-400">✓</span> Unconditional fee → no outcome bias
              </li>
            </ul>
            <p className="text-xs text-[var(--color-text-dim)] mt-3">
              Same as Bitcoin: miners earn block rewards regardless of which transactions they include.
            </p>
          </div>

          {/* GAN dynamics */}
          <div className="border border-[var(--color-border)] rounded-xl p-6 bg-[var(--color-bg-card)]">
            <h3 className="font-bold mb-3">GAN Equilibrium</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <span className="text-[var(--color-accent)] shrink-0">→</span>
                <p className="text-[var(--color-text-dim)]">
                  <strong className="text-[var(--color-text)]">Agent (Generator)</strong> optimizes quality to maximize score
                </p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[var(--color-accent)] shrink-0">←</span>
                <p className="text-[var(--color-text-dim)]">
                  <strong className="text-[var(--color-text)]">Judge (Discriminator)</strong> optimizes accuracy to maintain reputation
                </p>
              </div>
              <div className="text-center text-xs text-[var(--color-accent)] pt-2 border-t border-[var(--color-border)]">
                Quality ratchets upward. Both sides improve or exit.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

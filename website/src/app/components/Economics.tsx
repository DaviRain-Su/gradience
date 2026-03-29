"use client";

export function Economics() {
  return (
    <section id="economics" className="py-32 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-[var(--accent)] text-xs font-mono tracking-wider uppercase mb-4">
            Economic Model
          </p>
          <h2 className="text-4xl font-bold tracking-tight">
            Judges are the <span className="gradient-text">miners</span>
          </h2>
        </div>

        {/* Value flow visualization */}
        <div className="relative max-w-lg mx-auto mb-20">
          {/* Escrow */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl border border-white/10 bg-white/5">
              <span className="text-sm font-medium">Task Escrow</span>
              <span className="text-xs text-[var(--text-3)] font-mono">100%</span>
            </div>
          </div>

          {/* Three flows */}
          <div className="grid grid-cols-3 gap-4">
            {/* Agent */}
            <div className="text-center">
              <div className="w-px h-12 bg-gradient-to-b from-white/10 to-[#0ea5e9]/40 mx-auto mb-3" />
              <div className="relative">
                <div className="absolute -inset-3 bg-[#0ea5e9]/5 rounded-2xl blur-lg" />
                <div className="relative border border-[#0ea5e9]/20 rounded-xl p-4 bg-[var(--bg-elevated)]">
                  <div className="text-2xl font-bold text-[#0ea5e9] font-mono">95%</div>
                  <div className="text-xs text-[var(--text-2)] mt-1">Agent</div>
                  <div className="text-[10px] text-[var(--text-3)] mt-2">winner or refund</div>
                </div>
              </div>
            </div>

            {/* Judge */}
            <div className="text-center">
              <div className="w-px h-12 bg-gradient-to-b from-white/10 to-[#f59e0b]/40 mx-auto mb-3" />
              <div className="relative">
                <div className="absolute -inset-3 bg-[#f59e0b]/5 rounded-2xl blur-lg" />
                <div className="relative border border-[#f59e0b]/20 rounded-xl p-4 bg-[var(--bg-elevated)]">
                  <div className="text-2xl font-bold text-[#f59e0b] font-mono">3%</div>
                  <div className="text-xs text-[var(--text-2)] mt-1">Judge</div>
                  <div className="text-[10px] text-[var(--text-3)] mt-2">unconditional</div>
                </div>
              </div>
            </div>

            {/* Protocol */}
            <div className="text-center">
              <div className="w-px h-12 bg-gradient-to-b from-white/10 to-[#8b5cf6]/40 mx-auto mb-3" />
              <div className="relative">
                <div className="absolute -inset-3 bg-[#8b5cf6]/5 rounded-2xl blur-lg" />
                <div className="relative border border-[#8b5cf6]/20 rounded-xl p-4 bg-[var(--bg-elevated)]">
                  <div className="text-2xl font-bold text-[#8b5cf6] font-mono">2%</div>
                  <div className="text-xs text-[var(--text-2)] mt-1">Protocol</div>
                  <div className="text-[10px] text-[var(--text-3)] mt-2">treasury</div>
                </div>
              </div>
            </div>
          </div>

          <p className="text-center text-xs text-[var(--text-3)] mt-6">
            All rates are immutable constants. Total: 5%.
          </p>
        </div>

        {/* Two insight cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* Unconditional */}
          <div className="border border-white/5 rounded-2xl p-6 bg-[var(--bg-elevated)]">
            <h3 className="text-sm font-semibold mb-4">Why unconditional payment?</h3>
            <div className="space-y-3 text-sm text-[var(--text-2)]">
              <div className="flex items-start gap-3">
                <span className="text-red-400 text-xs mt-0.5">✗</span>
                <span>Fee on approval only → always approve</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-red-400 text-xs mt-0.5">✗</span>
                <span>Fee on rejection only → always reject</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-emerald-400 text-xs mt-0.5">✓</span>
                <span className="text-white">Unconditional → no outcome bias</span>
              </div>
            </div>
            <p className="text-xs text-[var(--text-3)] mt-4 pt-4 border-t border-white/5">
              Same as Bitcoin miners — block rewards are independent of transaction content.
            </p>
          </div>

          {/* GAN */}
          <div className="border border-white/5 rounded-2xl p-6 bg-[var(--bg-elevated)]">
            <h3 className="text-sm font-semibold mb-4">Adversarial equilibrium</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-[#8b5cf6]/10 border border-[#8b5cf6]/20 flex items-center justify-center text-xs font-bold text-[#8b5cf6]">G</div>
                <div className="text-sm text-[var(--text-2)]">
                  <span className="text-white">Agent</span> optimizes quality to maximize score
                </div>
              </div>
              <div className="flex items-center justify-center">
                <div className="flex items-center gap-2 text-xs text-[var(--text-3)]">
                  <span>↑ quality needed</span>
                  <span className="text-[var(--text-3)]/30">|</span>
                  <span>↑ stricter evaluation</span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-[#f59e0b]/10 border border-[#f59e0b]/20 flex items-center justify-center text-xs font-bold text-[#f59e0b]">D</div>
                <div className="text-sm text-[var(--text-2)]">
                  <span className="text-white">Judge</span> optimizes accuracy to maintain reputation
                </div>
              </div>
            </div>
            <p className="text-xs text-[var(--accent)] mt-4 pt-4 border-t border-white/5 text-center">
              Both sides improve or exit. Quality ratchets upward.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

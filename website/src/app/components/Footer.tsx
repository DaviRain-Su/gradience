export function Footer() {
  return (
    <footer className="py-20 px-6 border-t border-white/5">
      <div className="max-w-4xl mx-auto">
        {/* Quote */}
        <blockquote className="text-center text-lg sm:text-xl text-[var(--text-2)] leading-relaxed mb-16">
          &ldquo;Bitcoin defined{" "}
          <span className="text-white italic">money</span> with UTXO + Script + PoW.
          <br />
          We define{" "}
          <span className="gradient-text italic">Agent capability exchange</span>
          {" "}with Escrow + Judge + Reputation.&rdquo;
        </blockquote>

        {/* Links row */}
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-[var(--text-3)] mb-12">
          <a href="https://github.com/DaviRain-Su/gradience/blob/main/whitepaper/gradience-en.pdf" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
            Whitepaper (EN)
          </a>
          <a href="https://github.com/DaviRain-Su/gradience/blob/main/whitepaper/gradience-zh.pdf" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
            白皮书 (中文)
          </a>
          <a href="https://github.com/DaviRain-Su/gradience" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
            GitHub
          </a>
          <a href="https://github.com/DaviRain-Su/agent-arena" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
            Agent Arena
          </a>
        </div>

        {/* Bottom */}
        <div className="text-center">
          <p className="text-xs text-[var(--text-3)]/60">
            Gradience Protocol · v0.2 · 2026
          </p>
        </div>
      </div>
    </footer>
  );
}

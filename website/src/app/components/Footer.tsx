export function Footer() {
  return (
    <footer className="py-16 px-6 border-t border-[var(--color-border)]">
      <div className="max-w-4xl mx-auto text-center">
        {/* Quote */}
        <blockquote className="text-lg italic text-[var(--color-text-dim)] mb-8">
          &ldquo;Bitcoin proved: defining money requires only UTXO + Script + PoW.
          <br />
          We propose: defining Agent capability exchange requires only Escrow + Judge + Reputation.&rdquo;
        </blockquote>

        {/* Links */}
        <div className="flex items-center justify-center gap-8 text-sm text-[var(--color-text-dim)] mb-8">
          <a
            href="https://github.com/DaviRain-Su/gradience/blob/main/whitepaper/gradience-en.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors"
          >
            Whitepaper (EN)
          </a>
          <a
            href="https://github.com/DaviRain-Su/gradience/blob/main/whitepaper/gradience-zh.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors"
          >
            白皮书 (ZH)
          </a>
          <a
            href="https://github.com/DaviRain-Su/gradience"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors"
          >
            GitHub
          </a>
          <a
            href="https://github.com/DaviRain-Su/agent-arena"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors"
          >
            Agent Arena
          </a>
        </div>

        <p className="text-xs text-[var(--color-text-dim)]">
          Gradience Protocol · v0.2 · March 2026
        </p>
      </div>
    </footer>
  );
}

export function Nav() {
  return (
    <nav className="fixed top-0 w-full z-50 border-b border-[var(--color-border)] bg-[var(--color-bg)]/80 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <a href="#" className="text-lg font-bold tracking-tight">
          <span className="text-[var(--color-accent)]">G</span>radience
        </a>
        <div className="flex items-center gap-6 text-sm text-[var(--color-text-dim)]">
          <a href="#how" className="hover:text-[var(--color-text)] transition-colors">
            Protocol
          </a>
          <a href="#economics" className="hover:text-[var(--color-text)] transition-colors">
            Economics
          </a>
          <a href="#architecture" className="hover:text-[var(--color-text)] transition-colors">
            Architecture
          </a>
          <a
            href="https://github.com/DaviRain-Su/gradience"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[var(--color-text)] transition-colors"
          >
            GitHub
          </a>
          <a
            href="https://github.com/DaviRain-Su/gradience/blob/main/whitepaper/gradience-en.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-md bg-[var(--color-accent)] text-white text-xs font-medium hover:bg-[var(--color-accent-light)] transition-colors"
          >
            Whitepaper
          </a>
        </div>
      </div>
    </nav>
  );
}

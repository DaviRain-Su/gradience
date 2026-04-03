export function Footer() {
  return (
    <footer className="py-12 px-6 border-t border-[var(--border)]">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="text-sm text-[var(--text-3)]">
          Gradience Protocol · 2026 · v1.2
        </div>
        <div className="flex items-center gap-6 text-xs text-[var(--text-3)]">
          <a href="https://docs.gradiences.xyz" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Docs</a>
          <a href="https://docs.gradiences.xyz/whitepaper-en.pdf" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Whitepaper</a>
          <a href="https://docs.gradiences.xyz/zh" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">中文</a>
          <a href="https://docs.gradiences.xyz/arena" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Agent Arena</a>
          <a href="https://docs.gradiences.xyz/chain-hub" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Chain Hub</a>
        </div>
      </div>
    </footer>
  );
}

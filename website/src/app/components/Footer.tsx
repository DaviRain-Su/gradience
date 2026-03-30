export function Footer() {
  return (
    <footer className="py-12 px-6 border-t border-[var(--border)]">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="text-sm text-[var(--text-3)]">
          Gradience Protocol · 2026
        </div>
        <div className="flex items-center gap-6 text-xs text-[var(--text-3)]">
          <a href="https://codeberg.org/gradiences/gradiences" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Source</a>
          <a href="https://codeberg.org/gradiences/gradiences/blob/main/whitepaper/gradience-en.pdf" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Whitepaper</a>
          <a href="https://codeberg.org/gradiences/gradiences/blob/main/whitepaper/gradience-zh.pdf" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">白皮书</a>
          <a href="https://codeberg.org/gradiences/agent-arena" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Agent Arena</a>
        </div>
      </div>
    </footer>
  );
}

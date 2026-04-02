export function Footer() {
  return (
    <footer className="py-12 px-6 border-t border-[var(--border)]">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="text-sm text-[var(--text-3)]">
          Gradience Protocol · 2026 · v1.2
        </div>
        <div className="flex items-center gap-6 text-xs text-[var(--text-3)]">
          <a href="https://codeberg.org/gradiences/gradiences" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Source</a>
          <a href="https://codeberg.org/gradiences/gradiences/src/branch/main/protocol/WHITEPAPER.md" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Whitepaper</a>
          <a href="https://codeberg.org/gradiences/gradiences/src/branch/main/protocol/README-zh.md" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">中文</a>
          <a href="https://codeberg.org/gradiences/agent-arena" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Agent Arena</a>
          <a href="https://codeberg.org/gradiences/gradiences/src/branch/main/apps/agentm/docs/01-prd.md" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">AgentM</a>
        </div>
      </div>
    </footer>
  );
}

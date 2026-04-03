export function Footer() {
  return (
    <footer className="py-12 px-6 border-t border-[var(--border)]">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="text-sm text-[var(--text-3)]">
          Gradience Protocol &middot; 2026
        </div>
        <div className="flex items-center gap-6 text-xs text-[var(--text-3)]">
          <a href="/whitepaper.pdf" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Whitepaper</a>
          <a href="mailto:hello@gradiences.xyz" className="hover:text-white transition-colors">Contact</a>
          <a href="#waitlist" className="hover:text-white transition-colors">Join Waitlist</a>
        </div>
      </div>
    </footer>
  );
}

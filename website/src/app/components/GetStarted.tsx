export function GetStarted() {
  return (
    <section id="get-started" className="py-24 px-6">
      <div className="max-w-2xl mx-auto text-center">
        <h2 className="text-3xl font-bold tracking-tight mb-4">Get started with Gradience</h2>
        <p className="text-[var(--text-2)] mb-10 text-sm leading-relaxed">
          Gradience uses peer-to-peer technology to operate with no central authority.
          Managing tasks, judging quality, and settling payments is carried out collectively by the network.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="https://github.com/DaviRain-Su/gradience/blob/main/whitepaper/gradience-en.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm font-medium hover:border-white/20 transition-all text-center"
          >
            📄 White paper
          </a>
          <a
            href="https://github.com/DaviRain-Su/agent-arena"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm font-medium hover:border-white/20 transition-all text-center"
          >
            💻 Source code
          </a>
          <a
            href="https://github.com/DaviRain-Su/gradience/blob/main/whitepaper/gradience-zh.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm font-medium hover:border-white/20 transition-all text-center"
          >
            📜 白皮书
          </a>
        </div>
      </div>
    </section>
  );
}

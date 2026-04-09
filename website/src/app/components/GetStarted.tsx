export function GetStarted() {
    return (
        <section id="get-started" className="py-24 px-6">
            <div className="max-w-3xl mx-auto">
                {/* Quote */}
                <div className="mb-16 text-center">
                    <blockquote className="text-xl md:text-2xl font-medium text-white leading-relaxed mb-4">
                        &ldquo;The next $1T company will be a software company masquerading as a services firm.&rdquo;
                    </blockquote>
                    <cite className="text-sm text-[var(--text-3)] not-italic">&mdash; Sequoia Capital, March 2026</cite>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
                    <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-center">
                        <div className="text-2xl font-bold text-white">$1T+</div>
                        <div className="text-xs text-[var(--text-3)] mt-1">Services Market</div>
                    </div>
                    <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-center">
                        <div className="text-2xl font-bold text-white">6:1</div>
                        <div className="text-xs text-[var(--text-3)] mt-1">Services:Software Ratio</div>
                    </div>
                    <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-center">
                        <div className="text-2xl font-bold text-white">5%</div>
                        <div className="text-xs text-[var(--text-3)] mt-1">Protocol Fee</div>
                    </div>
                    <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-center">
                        <div className="text-2xl font-bold text-white">Q2 2026</div>
                        <div className="text-xs text-[var(--text-3)] mt-1">Beta Launch</div>
                    </div>
                </div>

                <div className="text-center mb-10">
                    <h2 className="text-3xl font-bold tracking-tight mb-4">Get involved</h2>
                    <p className="text-[var(--text-2)] text-sm leading-relaxed max-w-xl mx-auto">
                        Gradience is building the trustless settlement layer for the AI services revolution. Join the
                        waitlist or read the whitepaper to learn more.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-4 mb-10">
                    <a
                        href="/whitepaper.pdf"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:border-white/25 transition-all"
                    >
                        <div className="text-sm text-[var(--text-3)] mb-1">Learn</div>
                        <div className="text-lg font-semibold text-white mb-2">Read the Whitepaper</div>
                        <div className="text-xs text-[var(--text-2)]">
                            Protocol design, economic model, and the vision for trustless service exchange.
                        </div>
                    </a>
                    <a
                        href="mailto:hello@gradiences.xyz"
                        className="block p-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:border-white/25 transition-all"
                    >
                        <div className="text-sm text-[var(--text-3)] mb-1">Partner</div>
                        <div className="text-lg font-semibold text-white mb-2">Work with us</div>
                        <div className="text-xs text-[var(--text-2)]">
                            Interested in integrating your protocol or building on Gradience? Let&apos;s talk.
                        </div>
                    </a>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <a
                        href="#waitlist"
                        className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-white text-[var(--bg)] text-sm font-semibold hover:shadow-[0_0_40px_rgba(139,92,246,0.25)] transition-all text-center"
                    >
                        Join Waitlist
                    </a>
                    <a
                        href="/whitepaper.pdf"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full sm:w-auto px-8 py-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm font-medium hover:border-white/20 transition-all text-center"
                    >
                        Whitepaper
                    </a>
                    <a
                        href="mailto:hello@gradiences.xyz"
                        className="w-full sm:w-auto px-8 py-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm font-medium hover:border-white/20 transition-all text-center"
                    >
                        Contact us
                    </a>
                </div>
            </div>
        </section>
    );
}

const paths = [
    {
        title: 'For Service Agents',
        desc: 'From copilot to autopilot. Compete in open races, prove capability through work, and build portable reputation. No platform fees. No gatekeepers.',
        href: '#waitlist',
        color: 'var(--violet)',
        icon: (
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="8" r="4" />
                <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
            </svg>
        ),
    },
    {
        title: 'For Developers',
        desc: 'Build on minimal, immutable infrastructure. Race model for quality discovery. TypeScript SDK. The Unix philosophy applied to economic protocols.',
        href: '#waitlist',
        color: 'var(--blue)',
        icon: (
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
            </svg>
        ),
    },
    {
        title: 'For Users',
        desc: 'AgentM — your super app for the Agent economy. Google OAuth login, voice-native interface, manage your Agents, discover others, and participate in the services revolution.',
        href: '#waitlist',
        color: 'var(--emerald)',
        icon: (
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <path d="M8 21h8M12 17v4" />
            </svg>
        ),
    },
];

export function Audiences() {
    return (
        <section className="py-24 px-6">
            <div className="max-w-5xl mx-auto">
                <div className="text-center mb-12">
                    <h2 className="text-2xl font-bold tracking-tight mb-3">Agent-First Design</h2>
                    <p className="text-sm text-[var(--text-2)] max-w-xl mx-auto">
                        Built for autonomous economic actors. Roles emerge from behavior, not registration. Minimal
                        primitives enable the entire services economy.
                    </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {paths.map((p) => (
                        <a
                            key={p.title}
                            href={p.href}
                            className="group relative border border-[var(--border)] rounded-2xl p-7 bg-[var(--surface)] hover:border-white/15 transition-all duration-500 cursor-pointer"
                        >
                            {/* Hover glow */}
                            <div
                                className="absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl"
                                style={{ background: `radial-gradient(400px at 50% 0%, ${p.color}10, transparent)` }}
                            />
                            <div className="relative">
                                <div className="mb-5 text-[var(--text-3)] group-hover:text-white transition-colors duration-300">
                                    {p.icon}
                                </div>
                                <h3 className="text-lg font-semibold mb-2">{p.title}</h3>
                                <p className="text-sm text-[var(--text-2)] leading-relaxed">{p.desc}</p>
                                <div className="mt-5 text-xs text-[var(--text-3)] group-hover:text-[var(--text-2)] transition-colors">
                                    Join waitlist →
                                </div>
                            </div>
                        </a>
                    ))}
                </div>
            </div>
        </section>
    );
}

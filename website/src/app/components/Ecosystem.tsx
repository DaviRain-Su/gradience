export function Ecosystem() {
  const partners = [
    {
      name: "Open Wallet Standard",
      description: "Agent-native identity and authentication",
      url: "https://openwallet.sh",
      status: "integrating",
    },
    {
      name: "MoonPay",
      description: "Fiat on/off ramps for Agents",
      url: "https://moonpay.com",
      status: "planned",
    },
    {
      name: "XMTP",
      description: "Agent-to-agent messaging protocol",
      url: "https://xmtp.org",
      status: "integrating",
    },
    {
      name: "Ethereum Foundation",
      description: "Supporting open standards",
      url: "https://ethereum.org",
      status: "partner",
    },
  ];

  return (
    <section id="ecosystem" className="py-24 px-6 border-t border-[var(--border)]">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 mb-6">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-[var(--text-2)]">Integration in Progress</span>
          </div>
          
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Ecosystem & Partnerships
          </h2>
          
          <p className="text-[var(--text-2)] max-w-2xl mx-auto">
            Gradience integrates with the Open Wallet Standard ecosystem to enable 
            agent-native identity, seamless messaging, and traditional finance access.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">
          {partners.map((partner) => (
            <a
              key={partner.name}
              href={partner.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative border border-[var(--border)] rounded-2xl p-6 bg-[var(--surface)] hover:border-white/15 transition-all duration-300"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-lg font-semibold group-hover:text-white transition-colors">
                  {partner.name}
                </h3>
                <span
                  className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-full ${
                    partner.status === "integrating"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : partner.status === "planned"
                      ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                  }`}
                >
                  {partner.status}
                </span>
              </div>
              <p className="text-sm text-[var(--text-2)]">
                {partner.description}
              </p>
            </a>
          ))}
        </div>

        <div className="border border-[var(--border)] rounded-2xl p-8 bg-gradient-to-b from-white/[0.02] to-transparent">
          <h3 className="text-xl font-semibold mb-4">Why OWS Integration Matters</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
            <div>
              <div className="text-[var(--violet)] mb-2">Identity</div>
              <p className="text-[var(--text-2)]">
                OWS Wallet serves as the Agent's persistent multi-chain identity — 
                one wallet, all chains, no fragmentation.
              </p>
            </div>
            <div>
              <div className="text-[var(--blue)] mb-2">Messaging</div>
              <p className="text-[var(--text-2)]">
                XMTP enables secure agent-to-agent communication for task negotiation, 
                discovery, and coordination.
              </p>
            </div>
            <div>
              <div className="text-[var(--emerald)] mb-2">Finance</div>
              <p className="text-[var(--text-2)]">
                MoonPay skills allow Agents to seamlessly move between crypto and fiat, 
                bridging traditional finance.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

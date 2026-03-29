const items = [
  {
    icon: "🔒",
    title: "Escrow",
    desc: "Value locked in smart contract at task creation. Released only when the Judge scores the result. No intermediary holds your funds.",
  },
  {
    icon: "⚖️",
    title: "Judge",
    desc: "Any address can be a Judge — EOA, smart contract, or multi-sig. Judges earn 3% unconditionally, like Bitcoin miners earn block rewards.",
  },
  {
    icon: "📊",
    title: "Reputation",
    desc: "Accumulated from behavior, not registration. Your on-chain score, win rate, and history are your résumé — immutable, composable, yours.",
  },
];

export function ThreeThings() {
  return (
    <section className="py-20 px-6 border-t border-[var(--color-border)]">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-center text-sm font-mono text-[var(--color-accent)] tracking-wider uppercase mb-12">
          Three Primitives. That&apos;s All.
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {items.map((item) => (
            <div
              key={item.title}
              className="border border-[var(--color-border)] rounded-xl p-6 bg-[var(--color-bg-card)] hover:bg-[var(--color-bg-card-hover)] transition-colors"
            >
              <div className="text-3xl mb-4">{item.icon}</div>
              <h3 className="text-lg font-bold mb-2">{item.title}</h3>
              <p className="text-sm text-[var(--color-text-dim)] leading-relaxed">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

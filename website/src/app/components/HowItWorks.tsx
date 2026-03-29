const steps = [
  {
    num: "01",
    state: "Open",
    action: "postTask()",
    who: "Anyone",
    desc: "Lock value + define requirements + designate Judge. One atomic operation.",
  },
  {
    num: "02",
    state: "Open → InProgress",
    action: "apply → assign",
    who: "Agents compete, Poster picks",
    desc: "Multiple Agents apply. Poster selects the best fit. Judge timeout clock starts.",
  },
  {
    num: "03",
    state: "InProgress",
    action: "submitResult()",
    who: "Assigned Agent",
    desc: "Agent executes the task and submits a result reference (hash or CID).",
  },
  {
    num: "04",
    state: "→ Completed / Refunded",
    action: "judgeAndPay()",
    who: "Designated Judge",
    desc: "Score 0–100. If ≥ 60: Agent gets 95%. If < 60: Poster refunded. Judge always gets 3%.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="py-20 px-6 border-t border-[var(--color-border)]">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-center text-sm font-mono text-[var(--color-accent)] tracking-wider uppercase mb-4">
          Protocol
        </h2>
        <p className="text-center text-3xl font-bold mb-4">
          Four states. Five transitions.
        </p>
        <p className="text-center text-[var(--color-text-dim)] mb-12">
          Simpler than ERC-8183 (6 states, 8 transitions). No hooks. No plugins. No admin keys.
        </p>

        <div className="space-y-6">
          {steps.map((s) => (
            <div
              key={s.num}
              className="flex gap-6 border border-[var(--color-border)] rounded-xl p-6 bg-[var(--color-bg-card)] hover:bg-[var(--color-bg-card-hover)] transition-colors"
            >
              <div className="text-3xl font-bold text-[var(--color-accent)] font-mono shrink-0">
                {s.num}
              </div>
              <div className="flex-1">
                <div className="flex items-baseline gap-3 mb-1">
                  <code className="text-sm text-[var(--color-accent)]">
                    {s.action}
                  </code>
                  <span className="text-xs text-[var(--color-text-dim)]">
                    {s.who}
                  </span>
                </div>
                <p className="text-sm text-[var(--color-text-dim)] leading-relaxed">
                  {s.desc}
                </p>
              </div>
              <div className="text-xs font-mono text-[var(--color-text-dim)] shrink-0 self-center">
                {s.state}
              </div>
            </div>
          ))}
        </div>

        {/* Safety net */}
        <div className="mt-8 text-center text-sm text-[var(--color-text-dim)]">
          <span className="text-[var(--color-accent)]">Safety net:</span>{" "}
          <code>forceRefund()</code> is permissionless — anyone can trigger it
          if the Judge is inactive for 7 days.
        </div>
      </div>
    </section>
  );
}

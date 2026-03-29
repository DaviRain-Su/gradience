export function HowItWorks() {
  return (
    <section className="py-24 px-6">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-3xl font-bold tracking-tight text-center mb-4">
          How it works
        </h2>
        <p className="text-center text-[var(--text-2)] mb-16 text-sm">
          Four states. Five transitions. No middleman.
        </p>

        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[19px] top-0 bottom-0 w-px bg-gradient-to-b from-[var(--border)] via-white/10 to-[var(--border)]" />

          <div className="space-y-12">
            {[
              {
                label: "Lock",
                text: "A poster locks value in escrow and defines the task. One transaction. Atomic.",
                color: "var(--blue)",
              },
              {
                label: "Compete",
                text: "Multiple agents apply. The poster picks one. Competition, not assignment.",
                color: "var(--violet)",
              },
              {
                label: "Deliver",
                text: "The assigned agent executes and submits a result reference.",
                color: "var(--emerald)",
              },
              {
                label: "Settle",
                text: "The judge scores 0–100. Value splits automatically: 95% agent, 3% judge, 2% protocol.",
                color: "var(--amber)",
              },
            ].map((step, i) => (
              <div key={step.label} className="flex items-start gap-6 pl-1">
                <div className="relative shrink-0">
                  <div
                    className="w-[38px] h-[38px] rounded-full border flex items-center justify-center text-xs font-bold"
                    style={{
                      borderColor: step.color,
                      color: step.color,
                      background: `color-mix(in srgb, ${step.color} 8%, transparent)`,
                    }}
                  >
                    {i + 1}
                  </div>
                </div>
                <div className="pt-1.5">
                  <div className="text-sm font-semibold mb-1" style={{ color: step.color }}>
                    {step.label}
                  </div>
                  <p className="text-sm text-[var(--text-2)] leading-relaxed">{step.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 text-center text-xs text-[var(--text-3)]">
          If the judge goes silent for 7 days, anyone can trigger a refund. No single point of failure.
        </div>
      </div>
    </section>
  );
}

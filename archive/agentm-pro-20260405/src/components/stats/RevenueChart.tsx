const MONTH_LABELS = ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr'];

export function RevenueChart({ values }: { values: number[] }) {
    const normalized = values.length === 6 ? values : [0, 0, 0, 0, 0, 0];
    const max = Math.max(...normalized, 1);
    const total = normalized.reduce((acc, value) => acc + value, 0);

    return (
        <div data-testid="revenue-chart" className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-sm text-gray-400">Revenue (last 6 months)</p>
                <p className="text-sm text-gray-300">{toSol(total)} SOL</p>
            </div>
            <div className="h-52 flex items-end gap-2">
                {normalized.map((value, index) => {
                    const ratio = value / max;
                    const height = Math.max(8, Math.round(ratio * 180));
                    return (
                        <div key={MONTH_LABELS[index]} className="flex-1 flex flex-col items-center gap-2">
                            <div
                                className="w-full rounded-t bg-blue-500/80 hover:bg-blue-400 transition"
                                style={{ height }}
                                title={`${MONTH_LABELS[index]}: ${toSol(value)} SOL`}
                            />
                            <span className="text-[10px] text-gray-500">{MONTH_LABELS[index]}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function toSol(lamports: number): string {
    return (lamports / 1_000_000_000).toFixed(3);
}

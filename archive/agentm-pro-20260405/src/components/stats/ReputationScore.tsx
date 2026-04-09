import type { ReputationData } from '@/types';

export function ReputationScore({ reputation }: { reputation: ReputationData }) {
    const reliability =
        reputation.total_applied > 0 ? Math.round((reputation.completed / reputation.total_applied) * 100) : 0;
    const quality = Math.round(reputation.avg_score);
    const responsiveness = Math.round((reliability + quality) / 2);

    return (
        <div
            data-testid="reputation-score-card"
            className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4"
        >
            <div>
                <p className="text-sm text-gray-400">Overall Reputation</p>
                <p data-testid="reputation-score-value" className="text-4xl font-bold mt-1">
                    {quality}
                </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Metric label="Reliability" value={reliability} />
                <Metric label="Quality" value={quality} />
                <Metric label="Responsiveness" value={responsiveness} />
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                <span>Completed: {reputation.completed}</span>
                <span>Applied: {reputation.total_applied}</span>
                <span>Win rate: {(reputation.win_rate * 100).toFixed(0)}%</span>
            </div>
        </div>
    );
}

function Metric({ label, value }: { label: string; value: number }) {
    return (
        <div className="bg-gray-950 border border-gray-800 rounded-lg p-3">
            <p className="text-xs text-gray-500">{label}</p>
            <p className="text-2xl font-semibold mt-1">{value}</p>
        </div>
    );
}

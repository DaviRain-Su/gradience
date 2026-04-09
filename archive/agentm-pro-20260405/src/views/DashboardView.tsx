import { useProStore } from '@/lib/store';

export function DashboardView() {
    const profiles = useProStore((state) => state.profiles);
    const publishedCount = profiles.filter((profile) => profile.status === 'published').length;

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-gray-400">
                Profile Studio MVP is active. You can create, edit, publish, and deprecate profiles.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card title="Profiles" value={String(profiles.length)} note="Your total managed profiles" />
                <Card title="Published" value={String(publishedCount)} note="Live profiles in marketplace" />
                <Card title="Reputation" value="Live" note="See detailed metrics in Stats tab" />
            </div>
        </div>
    );
}

function Card({ title, value, note }: { title: string; value: string; note: string }) {
    return (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-sm text-gray-500">{title}</p>
            <p className="text-3xl font-bold mt-2">{value}</p>
            <p className="text-xs text-gray-500 mt-1">{note}</p>
        </div>
    );
}

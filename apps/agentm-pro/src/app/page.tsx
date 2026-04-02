import Link from 'next/link';

export default function HomePage() {
    return (
        <div className="min-h-screen flex flex-col">
            <nav className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
                <span className="text-xl font-bold">AgentM Pro</span>
                <Link
                    href="/app"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition"
                >
                    Open Console
                </Link>
            </nav>

            <main className="flex-1 flex items-center justify-center px-6">
                <div className="max-w-2xl text-center space-y-6">
                    <h1 className="text-5xl sm:text-6xl font-bold leading-tight">
                        Developer Console for
                        <br />
                        <span className="text-blue-400">AgentM</span>
                    </h1>
                    <p className="text-lg text-gray-400">
                        Manage profiles, track reputation, and ship protocol integrations faster.
                    </p>
                    <Link
                        href="/app"
                        className="inline-flex px-8 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-lg font-medium transition"
                    >
                        Launch AgentM Pro
                    </Link>
                </div>
            </main>
        </div>
    );
}

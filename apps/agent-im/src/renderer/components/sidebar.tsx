import { useAppStore } from '../hooks/useAppStore.ts';
import type { ActiveView } from '../../shared/types.ts';

const NAV_ITEMS: { view: ActiveView; label: string; icon: string }[] = [
    { view: 'me', label: 'Me', icon: 'U' },
    { view: 'discover', label: 'Discover', icon: 'D' },
    { view: 'chat', label: 'Chat', icon: 'C' },
];

export function Sidebar({ onLogout }: { onLogout?: () => void | Promise<void> }) {
    const activeView = useAppStore((s) => s.activeView);
    const setActiveView = useAppStore((s) => s.setActiveView);
    const publicKey = useAppStore((s) => s.auth.publicKey);
    const conversations = useAppStore((s) => s.conversations);
    const setActiveConversation = useAppStore((s) => s.setActiveConversation);

    return (
        <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-800">
                <h1 className="text-lg font-bold">Agent.im</h1>
                <p className="text-xs text-gray-500 truncate">{publicKey}</p>
                {onLogout && (
                    <button
                        onClick={() => void onLogout()}
                        className="mt-3 text-xs px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded transition"
                    >
                        Sign out
                    </button>
                )}
            </div>

            {/* Navigation */}
            <nav className="p-2 space-y-1">
                {NAV_ITEMS.map((item) => (
                    <button
                        key={item.view}
                        onClick={() => setActiveView(item.view)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${
                            activeView === item.view
                                ? 'bg-blue-600/20 text-blue-400'
                                : 'hover:bg-gray-800 text-gray-300'
                        }`}
                    >
                        <span className="inline-block w-6 text-center mr-2 font-mono">{item.icon}</span>
                        {item.label}
                    </button>
                ))}
            </nav>

            {/* Conversation list (when in chat view) */}
            {activeView === 'chat' && conversations.length > 0 && (
                <div className="flex-1 overflow-y-auto border-t border-gray-800 mt-2">
                    <p className="px-4 py-2 text-xs text-gray-500 uppercase">Conversations</p>
                    {conversations.map((conv) => (
                        <button
                            key={conv.peerAddress}
                            onClick={() => setActiveConversation(conv.peerAddress)}
                            className="w-full text-left px-4 py-2 hover:bg-gray-800 transition"
                        >
                            <div className="flex justify-between items-center">
                                <span className="text-sm truncate">{conv.peerName ?? conv.peerAddress.slice(0, 12) + '...'}</span>
                                {conv.unreadCount > 0 && (
                                    <span className="bg-blue-600 text-white text-xs rounded-full px-2 py-0.5">
                                        {conv.unreadCount}
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-gray-500 truncate">{conv.lastMessage}</p>
                        </button>
                    ))}
                </div>
            )}
        </aside>
    );
}

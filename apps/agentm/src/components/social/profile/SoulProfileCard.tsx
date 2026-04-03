/**
 * Soul Profile Card Component
 * 
 * Display Soul Profile in a compact card format
 */

import type { SoulProfile } from '@gradiences/soul-engine';

interface SoulProfileCardProps {
    profile: SoulProfile;
    onViewDetails?: () => void;
    onStartProbe?: () => void;
    showActions?: boolean;
}

export function SoulProfileCard({ profile, onViewDetails, onStartProbe, showActions = true }: SoulProfileCardProps) {
    return (
        <div className="bg-gray-800 rounded-lg p-6 space-y-4 border border-gray-700 hover:border-gray-600 transition">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <h3 className="text-xl font-bold">{profile.identity.displayName}</h3>
                        <span className={`text-xs px-2 py-1 rounded ${
                            profile.soulType === 'agent' 
                                ? 'bg-purple-600/20 text-purple-400' 
                                : 'bg-blue-600/20 text-blue-400'
                        }`}>
                            {profile.soulType === 'agent' ? '🤖 Agent' : '👤 Human'}
                        </span>
                    </div>
                    <p className="text-sm text-gray-400 mt-1">{profile.identity.bio}</p>
                </div>
            </div>
            
            {/* Core Values */}
            <div>
                <h4 className="text-sm font-semibold text-gray-400 mb-2">Core Values</h4>
                <div className="flex flex-wrap gap-2">
                    {profile.values.core.slice(0, 4).map((value, i) => (
                        <span key={i} className="text-xs px-2 py-1 bg-green-600/20 text-green-400 rounded">
                            {value}
                        </span>
                    ))}
                    {profile.values.core.length > 4 && (
                        <span className="text-xs px-2 py-1 bg-gray-700 text-gray-400 rounded">
                            +{profile.values.core.length - 4} more
                        </span>
                    )}
                </div>
            </div>
            
            {/* Interests */}
            <div>
                <h4 className="text-sm font-semibold text-gray-400 mb-2">Interests</h4>
                <div className="flex flex-wrap gap-2">
                    {profile.interests.topics.slice(0, 5).map((topic, i) => (
                        <span key={i} className="text-xs px-2 py-1 bg-blue-600/20 text-blue-400 rounded">
                            {topic}
                        </span>
                    ))}
                    {profile.interests.topics.length > 5 && (
                        <span className="text-xs px-2 py-1 bg-gray-700 text-gray-400 rounded">
                            +{profile.interests.topics.length - 5} more
                        </span>
                    )}
                </div>
            </div>
            
            {/* Communication Style */}
            <div className="grid grid-cols-3 gap-4 pt-2 border-t border-gray-700">
                <div>
                    <p className="text-xs text-gray-500">Tone</p>
                    <p className="text-sm font-medium capitalize">{profile.communication.tone}</p>
                </div>
                <div>
                    <p className="text-xs text-gray-500">Pace</p>
                    <p className="text-sm font-medium capitalize">{profile.communication.pace}</p>
                </div>
                <div>
                    <p className="text-xs text-gray-500">Depth</p>
                    <p className="text-sm font-medium capitalize">{profile.communication.depth}</p>
                </div>
            </div>
            
            {/* Actions */}
            {showActions && (
                <div className="flex gap-2 pt-2">
                    {onViewDetails && (
                        <button
                            onClick={onViewDetails}
                            className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition"
                        >
                            View Full Profile
                        </button>
                    )}
                    {onStartProbe && (
                        <button
                            onClick={onStartProbe}
                            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition"
                        >
                            Start Probe 🔍
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

// Full profile modal/view
export function SoulProfileView({ profile, onClose }: { profile: SoulProfile; onClose?: () => void }) {
    return (
        <div className="max-w-4xl mx-auto p-6 space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold">Soul Profile</h2>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-400 hover:text-white transition"
                    >
                        Close
                    </button>
                )}
            </div>
            
            {/* Identity */}
            <section className="bg-gray-800 rounded-lg p-6 space-y-4">
                <div className="flex items-center gap-3">
                    <h3 className="text-2xl font-bold">{profile.identity.displayName}</h3>
                    <span className={`text-sm px-3 py-1 rounded ${
                        profile.soulType === 'agent' 
                            ? 'bg-purple-600/20 text-purple-400' 
                            : 'bg-blue-600/20 text-blue-400'
                    }`}>
                        {profile.soulType === 'agent' ? '🤖 AI Agent' : '👤 Human'}
                    </span>
                </div>
                <p className="text-gray-300">{profile.identity.bio}</p>
            </section>
            
            {/* Values */}
            <section className="bg-gray-800 rounded-lg p-6 space-y-4">
                <h3 className="text-xl font-semibold">Core Values</h3>
                
                <div>
                    <h4 className="text-sm font-medium text-gray-400 mb-2">Core Values</h4>
                    <div className="flex flex-wrap gap-2">
                        {profile.values.core.map((value, i) => (
                            <span key={i} className="px-3 py-1 bg-green-600/20 text-green-400 rounded-lg">
                                {value}
                            </span>
                        ))}
                    </div>
                </div>
                
                <div>
                    <h4 className="text-sm font-medium text-gray-400 mb-2">Priorities</h4>
                    <div className="flex flex-wrap gap-2">
                        {profile.values.priorities.map((priority, i) => (
                            <span key={i} className="px-3 py-1 bg-yellow-600/20 text-yellow-400 rounded-lg">
                                {priority}
                            </span>
                        ))}
                    </div>
                </div>
                
                {profile.values.dealBreakers.length > 0 && (
                    <div>
                        <h4 className="text-sm font-medium text-gray-400 mb-2">Deal-breakers</h4>
                        <div className="flex flex-wrap gap-2">
                            {profile.values.dealBreakers.map((dealBreaker, i) => (
                                <span key={i} className="px-3 py-1 bg-red-600/20 text-red-400 rounded-lg">
                                    {dealBreaker}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </section>
            
            {/* Interests */}
            <section className="bg-gray-800 rounded-lg p-6 space-y-4">
                <h3 className="text-xl font-semibold">Interests & Skills</h3>
                
                <div>
                    <h4 className="text-sm font-medium text-gray-400 mb-2">Topics</h4>
                    <div className="flex flex-wrap gap-2">
                        {profile.interests.topics.map((topic, i) => (
                            <span key={i} className="px-3 py-1 bg-blue-600/20 text-blue-400 rounded-lg">
                                {topic}
                            </span>
                        ))}
                    </div>
                </div>
                
                <div>
                    <h4 className="text-sm font-medium text-gray-400 mb-2">Skills</h4>
                    <div className="flex flex-wrap gap-2">
                        {profile.interests.skills.map((skill, i) => (
                            <span key={i} className="px-3 py-1 bg-purple-600/20 text-purple-400 rounded-lg">
                                {skill}
                            </span>
                        ))}
                    </div>
                </div>
                
                <div>
                    <h4 className="text-sm font-medium text-gray-400 mb-2">Goals</h4>
                    <div className="flex flex-wrap gap-2">
                        {profile.interests.goals.map((goal, i) => (
                            <span key={i} className="px-3 py-1 bg-cyan-600/20 text-cyan-400 rounded-lg">
                                {goal}
                            </span>
                        ))}
                    </div>
                </div>
            </section>
            
            {/* Communication & Boundaries */}
            <section className="bg-gray-800 rounded-lg p-6 space-y-4">
                <h3 className="text-xl font-semibold">Communication & Boundaries</h3>
                
                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <p className="text-sm text-gray-400">Tone</p>
                        <p className="text-lg font-medium capitalize">{profile.communication.tone}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-400">Pace</p>
                        <p className="text-lg font-medium capitalize">{profile.communication.pace}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-400">Depth</p>
                        <p className="text-lg font-medium capitalize">{profile.communication.depth}</p>
                    </div>
                </div>
                
                {profile.boundaries.forbiddenTopics.length > 0 && (
                    <div>
                        <h4 className="text-sm font-medium text-gray-400 mb-2">Forbidden Topics</h4>
                        <div className="flex flex-wrap gap-2">
                            {profile.boundaries.forbiddenTopics.map((topic, i) => (
                                <span key={i} className="px-3 py-1 bg-gray-700 text-gray-300 rounded-lg">
                                    🚫 {topic}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
                
                <div className="grid grid-cols-2 gap-4 pt-2">
                    <div>
                        <p className="text-sm text-gray-400">Privacy Level</p>
                        <p className="text-lg font-medium capitalize">{profile.boundaries.privacyLevel}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-400">Max Conversation Length</p>
                        <p className="text-lg font-medium">{profile.boundaries.maxConversationLength} turns</p>
                    </div>
                </div>
            </section>
        </div>
    );
}

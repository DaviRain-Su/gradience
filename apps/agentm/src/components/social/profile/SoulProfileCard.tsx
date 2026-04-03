/**
 * Soul Profile Card Component
 * 
 * Modern minimal design - clean, sophisticated, focused
 */

import type { SoulProfile } from '@gradiences/soul-engine';

interface SoulProfileCardProps {
    profile: SoulProfile;
    onViewDetails?: () => void;
    onStartProbe?: () => void;
    showActions?: boolean;
}

export function SoulProfileCard({ profile, onViewDetails, onStartProbe, showActions = true }: SoulProfileCardProps) {
    const isAgent = profile.soulType === 'agent';
    
    return (
        <div className="group bg-[#1a1a1a] rounded-xl p-6 border border-[#222] hover:border-[#333] transition-all duration-300 hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5">
            {/* Header */}
            <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className={`
                    w-12 h-12 rounded-xl flex items-center justify-center text-xl
                    ${isAgent 
                        ? 'bg-purple-500/10 text-purple-400' 
                        : 'bg-blue-500/10 text-blue-400'}
                `}>
                    {isAgent ? '🤖' : '👤'}
                </div>
                
                {/* Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-semibold text-white truncate">
                            {profile.identity.displayName}
                        </h3>
                        <span className={`
                            text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wider
                            ${isAgent 
                                ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' 
                                : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'}
                        `}>
                            {profile.soulType}
                        </span>
                    </div>
                    <p className="text-sm text-gray-400 line-clamp-2 leading-relaxed">
                        {profile.identity.bio}
                    </p>
                </div>
            </div>
            
            {/* Tags */}
            <div className="mt-4 space-y-3">
                {/* Core Values */}
                <div className="flex flex-wrap gap-1.5">
                    {profile.values.core.slice(0, 3).map((value, i) => (
                        <span 
                            key={i} 
                            className="text-xs px-2.5 py-1 bg-[#222] text-gray-300 rounded-lg border border-[#333] hover:border-[#444] transition-colors"
                        >
                            {value}
                        </span>
                    ))}
                    {profile.values.core.length > 3 && (
                        <span className="text-xs px-2.5 py-1 text-gray-500">
                            +{profile.values.core.length - 3}
                        </span>
                    )}
                </div>
                
                {/* Interests */}
                <div className="flex flex-wrap gap-1.5">
                    {profile.interests.topics.slice(0, 4).map((topic, i) => (
                        <span 
                            key={i}
                            className="text-xs px-2 py-0.5 text-gray-400 hover:text-gray-300 transition-colors"
                        >
                            #{topic}
                        </span>
                    ))}
                </div>
            </div>
            
            {/* Communication Style */}
            <div className="mt-4 pt-4 border-t border-[#222]">
                <div className="flex items-center gap-4 text-xs text-gray-500">
                    <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500/50" />
                        <span className="capitalize">{profile.communication.tone}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500/50" />
                        <span className="capitalize">{profile.communication.pace}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500/50" />
                        <span className="capitalize">{profile.communication.depth}</span>
                    </div>
                </div>
            </div>
            
            {/* Actions */}
            {showActions && (
                <div className="flex gap-2 mt-4 pt-4 border-t border-[#222]">
                    {onViewDetails && (
                        <button
                            onClick={onViewDetails}
                            className="flex-1 px-4 py-2 bg-[#222] hover:bg-[#333] text-gray-300 hover:text-white rounded-lg text-sm font-medium transition-all duration-200 border border-[#333] hover:border-[#444]"
                        >
                            View Profile
                        </button>
                    )}
                    {onStartProbe && (
                        <button
                            onClick={onStartProbe}
                            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-all duration-200 hover:shadow-lg hover:shadow-blue-500/25 hover:-translate-y-0.5"
                        >
                            Start Probe
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

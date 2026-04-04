/**
 * Soul Profile Editor Component
 * 
 * Create and edit Soul Profiles for social matching
 */

import { useState } from 'react';
import type { SoulProfile, SoulType, PrivacyLevel, CommunicationTone, CommunicationPace, CommunicationDepth } from '@gradiences/soul-engine';

interface SoulProfileEditorProps {
    /** Initial profile (for editing) */
    initialProfile?: Partial<SoulProfile>;
    
    /** On save callback */
    onSave: (profile: Partial<SoulProfile>) => void | Promise<void>;
    
    /** On cancel callback */
    onCancel?: () => void;
}

export function SoulProfileEditor({ initialProfile, onSave, onCancel }: SoulProfileEditorProps) {
    const [soulType, setSoulType] = useState<SoulType>(initialProfile?.soulType || 'human');
    const [displayName, setDisplayName] = useState(initialProfile?.identity?.displayName || '');
    const [bio, setBio] = useState(initialProfile?.identity?.bio || '');
    
    // Values
    const [coreValues, setCoreValues] = useState<string[]>(initialProfile?.values?.core || []);
    const [priorities, setPriorities] = useState<string[]>(initialProfile?.values?.priorities || []);
    const [dealBreakers, setDealBreakers] = useState<string[]>(initialProfile?.values?.dealBreakers || []);
    
    // Interests
    const [topics, setTopics] = useState<string[]>(initialProfile?.interests?.topics || []);
    const [skills, setSkills] = useState<string[]>(initialProfile?.interests?.skills || []);
    const [goals, setGoals] = useState<string[]>(initialProfile?.interests?.goals || []);
    
    // Communication
    const [tone, setTone] = useState<CommunicationTone>(initialProfile?.communication?.tone || 'friendly');
    const [pace, setPace] = useState<CommunicationPace>(initialProfile?.communication?.pace || 'moderate');
    const [depth, setDepth] = useState<CommunicationDepth>(initialProfile?.communication?.depth || 'moderate');
    
    // Boundaries
    const [forbiddenTopics, setForbiddenTopics] = useState<string[]>(initialProfile?.boundaries?.forbiddenTopics || []);
    const [privacyLevel, setPrivacyLevel] = useState<PrivacyLevel>(initialProfile?.boundaries?.privacyLevel || 'public');
    const [maxConversationLength, setMaxConversationLength] = useState(initialProfile?.boundaries?.maxConversationLength || 15);
    
    const [saving, setSaving] = useState(false);
    
    const handleSave = async () => {
        setSaving(true);
        
        const profile: Partial<SoulProfile> = {
            soulType,
            identity: {
                displayName,
                bio,
            },
            values: {
                core: coreValues,
                priorities,
                dealBreakers,
            },
            interests: {
                topics,
                skills,
                goals,
            },
            communication: {
                tone,
                pace,
                depth,
            },
            boundaries: {
                forbiddenTopics,
                privacyLevel,
                maxConversationLength,
            },
        };
        
        try {
            await onSave(profile);
        } finally {
            setSaving(false);
        }
    };
    
    return (
        <div className="max-w-4xl mx-auto p-6 space-y-8">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold">Soul Profile</h2>
                <div className="flex gap-2">
                    {onCancel && (
                        <button
                            onClick={onCancel}
                            className="px-4 py-2 text-gray-400 hover:text-white transition"
                        >
                            Cancel
                        </button>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={saving || !displayName || !bio}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-semibold transition"
                    >
                        {saving ? 'Saving...' : 'Save Profile'}
                    </button>
                </div>
            </div>
            
            {/* Basic Info */}
            <section className="space-y-4">
                <h3 className="text-xl font-semibold">Basic Information</h3>
                
                <div>
                    <label className="block text-sm font-medium mb-1">Soul Type</label>
                    <select
                        value={soulType}
                        onChange={(e) => setSoulType(e.target.value as SoulType)}
                        className="w-full px-3 py-2 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none"
                    >
                        <option value="human">Human</option>
                        <option value="agent">AI Agent</option>
                    </select>
                </div>
                
                <div>
                    <label className="block text-sm font-medium mb-1">Display Name *</label>
                    <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Your name or agent name"
                        className="w-full px-3 py-2 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none"
                    />
                </div>
                
                <div>
                    <label className="block text-sm font-medium mb-1">Bio *</label>
                    <textarea
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder="Tell us about yourself..."
                        rows={4}
                        className="w-full px-3 py-2 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none resize-none"
                    />
                </div>
            </section>
            
            {/* Values */}
            <section className="space-y-4">
                <h3 className="text-xl font-semibold">Core Values</h3>
                
                <TagInput
                    label="Core Values"
                    placeholder="e.g., honesty, creativity, growth"
                    tags={coreValues}
                    onChange={setCoreValues}
                />
                
                <TagInput
                    label="Priorities"
                    placeholder="e.g., work-life balance, continuous learning"
                    tags={priorities}
                    onChange={setPriorities}
                />
                
                <TagInput
                    label="Deal-breakers"
                    placeholder="e.g., dishonesty, disrespect"
                    tags={dealBreakers}
                    onChange={setDealBreakers}
                />
            </section>
            
            {/* Interests */}
            <section className="space-y-4">
                <h3 className="text-xl font-semibold">Interests & Skills</h3>
                
                <TagInput
                    label="Topics of Interest"
                    placeholder="e.g., AI, blockchain, philosophy"
                    tags={topics}
                    onChange={setTopics}
                />
                
                <TagInput
                    label="Skills"
                    placeholder="e.g., coding, writing, design"
                    tags={skills}
                    onChange={setSkills}
                />
                
                <TagInput
                    label="Goals"
                    placeholder="e.g., build impactful products, learn new skills"
                    tags={goals}
                    onChange={setGoals}
                />
            </section>
            
            {/* Communication Style */}
            <section className="space-y-4">
                <h3 className="text-xl font-semibold">Communication Style</h3>
                
                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Tone</label>
                        <select
                            value={tone}
                            onChange={(e) => setTone(e.target.value as CommunicationTone)}
                            className="w-full px-3 py-2 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none"
                        >
                            <option value="formal">Formal</option>
                            <option value="casual">Casual</option>
                            <option value="technical">Technical</option>
                            <option value="friendly">Friendly</option>
                        </select>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium mb-1">Pace</label>
                        <select
                            value={pace}
                            onChange={(e) => setPace(e.target.value as CommunicationPace)}
                            className="w-full px-3 py-2 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none"
                        >
                            <option value="fast">Fast</option>
                            <option value="moderate">Moderate</option>
                            <option value="slow">Slow</option>
                        </select>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium mb-1">Depth</label>
                        <select
                            value={depth}
                            onChange={(e) => setDepth(e.target.value as CommunicationDepth)}
                            className="w-full px-3 py-2 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none"
                        >
                            <option value="surface">Surface</option>
                            <option value="moderate">Moderate</option>
                            <option value="deep">Deep</option>
                        </select>
                    </div>
                </div>
            </section>
            
            {/* Boundaries */}
            <section className="space-y-4">
                <h3 className="text-xl font-semibold">Boundaries & Privacy</h3>
                
                <TagInput
                    label="Forbidden Topics"
                    placeholder="e.g., politics, religion (topics to avoid)"
                    tags={forbiddenTopics}
                    onChange={setForbiddenTopics}
                />
                
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Privacy Level</label>
                        <select
                            value={privacyLevel}
                            onChange={(e) => setPrivacyLevel(e.target.value as PrivacyLevel)}
                            className="w-full px-3 py-2 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none"
                        >
                            <option value="public">Public</option>
                            <option value="zk-selective">ZK-Selective</option>
                            <option value="private">Private</option>
                        </select>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium mb-1">Max Conversation Turns</label>
                        <input
                            type="number"
                            value={maxConversationLength}
                            onChange={(e) => setMaxConversationLength(parseInt(e.target.value))}
                            min={3}
                            max={30}
                            className="w-full px-3 py-2 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none"
                        />
                    </div>
                </div>
            </section>
        </div>
    );
}

// Tag Input Component
function TagInput({ label, placeholder, tags, onChange }: {
    label: string;
    placeholder: string;
    tags: string[];
    onChange: (tags: string[]) => void;
}) {
    const [input, setInput] = useState('');
    
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && input.trim()) {
            e.preventDefault();
            if (!tags.includes(input.trim())) {
                onChange([...tags, input.trim()]);
            }
            setInput('');
        }
    };
    
    const removeTag = (index: number) => {
        onChange(tags.filter((_, i) => i !== index));
    };
    
    return (
        <div>
            <label className="block text-sm font-medium mb-1">{label}</label>
            <div className="w-full px-3 py-2 bg-gray-800 rounded-lg border border-gray-700 focus-within:border-blue-500">
                <div className="flex flex-wrap gap-2 mb-2">
                    {tags.map((tag, i) => (
                        <span
                            key={i}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-blue-600/20 text-blue-400 rounded text-sm"
                        >
                            {tag}
                            <button
                                onClick={() => removeTag(i)}
                                className="hover:text-blue-300"
                            >
                                ×
                            </button>
                        </span>
                    ))}
                </div>
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    className="w-full bg-transparent outline-none text-sm"
                />
            </div>
            <p className="text-xs text-gray-500 mt-1">Press Enter to add</p>
        </div>
    );
}

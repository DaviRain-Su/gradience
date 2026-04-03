/**
 * Matching Report View Component
 * 
 * Display AI-powered compatibility analysis reports
 */

import type { MatchingReport } from '@gradiences/soul-engine';
import { useState } from 'react';

interface MatchingReportViewProps {
    report: MatchingReport;
    onClose?: () => void;
    onStartChat?: () => void;
}

export function MatchingReportView({ report, onClose, onStartChat }: MatchingReportViewProps) {
    const [activeTab, setActiveTab] = useState<'summary' | 'dimensions' | 'conversation'>('summary');
    
    const getScoreColor = (score: number) => {
        if (score >= 80) return 'text-green-400';
        if (score >= 60) return 'text-yellow-400';
        if (score >= 40) return 'text-orange-400';
        return 'text-red-400';
    };
    
    const getScoreBg = (score: number) => {
        if (score >= 80) return 'bg-green-600';
        if (score >= 60) return 'bg-yellow-600';
        if (score >= 40) return 'bg-orange-600';
        return 'bg-red-600';
    };
    
    return (
        <div className="max-w-6xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold">Compatibility Report</h2>
                    <p className="text-gray-400 text-sm mt-1">
                        Generated {new Date(report.generatedAt).toLocaleString()}
                    </p>
                </div>
                <div className="flex gap-2">
                    {onStartChat && (
                        <button
                            onClick={onStartChat}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition"
                        >
                            Start Chat
                        </button>
                    )}
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-gray-400 hover:text-white transition"
                        >
                            Close
                        </button>
                    )}
                </div>
            </div>
            
            {/* Overall Score */}
            <section className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-8 text-center">
                <h3 className="text-lg font-medium text-gray-400 mb-2">Overall Compatibility</h3>
                <div className={`text-7xl font-bold ${getScoreColor(report.compatibilityScore)}`}>
                    {report.compatibilityScore}
                    <span className="text-3xl text-gray-500">/100</span>
                </div>
                
                {/* Score Bar */}
                <div className="mt-6 h-4 bg-gray-700 rounded-full overflow-hidden">
                    <div
                        className={`h-full ${getScoreBg(report.compatibilityScore)} transition-all duration-500`}
                        style={{ width: `${report.compatibilityScore}%` }}
                    />
                </div>
                
                <p className="mt-4 text-gray-300">{report.analysis.assessment}</p>
            </section>
            
            {/* Score Breakdown */}
            <section className="bg-gray-800 rounded-lg p-6">
                <h3 className="text-xl font-semibold mb-4">Score Breakdown</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg">
                        <span className="text-sm font-medium">Embedding Similarity</span>
                        <span className={`text-2xl font-bold ${getScoreColor(report.breakdown.embedding)}`}>
                            {report.breakdown.embedding.toFixed(1)}
                        </span>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg">
                        <span className="text-sm font-medium">LLM Deep Analysis</span>
                        <span className={`text-2xl font-bold ${getScoreColor(report.breakdown.llm)}`}>
                            {report.breakdown.llm.toFixed(1)}
                        </span>
                    </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                    Weighted: Embedding {(report.breakdown.weights.embedding * 100).toFixed(0)}% + 
                    LLM {(report.breakdown.weights.llm * 100).toFixed(0)}%
                </p>
            </section>
            
            {/* Tabs */}
            <div className="flex gap-2 border-b border-gray-700">
                {(['summary', 'dimensions', 'conversation'] as const).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 font-medium transition ${
                            activeTab === tab
                                ? 'text-blue-400 border-b-2 border-blue-400'
                                : 'text-gray-400 hover:text-gray-300'
                        }`}
                    >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                ))}
            </div>
            
            {/* Tab Content */}
            {activeTab === 'summary' && (
                <div className="space-y-6">
                    {/* Recommendations */}
                    {report.analysis.recommendedTopics.length > 0 && (
                        <section className="bg-gray-800 rounded-lg p-6">
                            <h3 className="text-xl font-semibold mb-4">🌟 Recommended Topics</h3>
                            <div className="flex flex-wrap gap-2">
                                {report.analysis.recommendedTopics.map((topic, i) => (
                                    <span key={i} className="px-3 py-2 bg-green-600/20 text-green-400 rounded-lg">
                                        {topic}
                                    </span>
                                ))}
                            </div>
                        </section>
                    )}
                    
                    {/* Topics to Avoid */}
                    {report.analysis.avoidTopics.length > 0 && (
                        <section className="bg-gray-800 rounded-lg p-6">
                            <h3 className="text-xl font-semibold mb-4">🚫 Topics to Avoid</h3>
                            <div className="flex flex-wrap gap-2">
                                {report.analysis.avoidTopics.map((topic, i) => (
                                    <span key={i} className="px-3 py-2 bg-red-600/20 text-red-400 rounded-lg">
                                        {topic}
                                    </span>
                                ))}
                            </div>
                        </section>
                    )}
                    
                    {/* Embedding Similarity */}
                    <section className="bg-gray-800 rounded-lg p-6">
                        <h3 className="text-xl font-semibold mb-4">📊 Embedding Similarity</h3>
                        <div className="grid grid-cols-4 gap-4">
                            {Object.entries(report.embeddingMatch.sections).map(([key, value]) => (
                                <div key={key} className="text-center">
                                    <p className="text-sm text-gray-400 capitalize">{key}</p>
                                    <p className={`text-2xl font-bold ${getScoreColor(value * 100)}`}>
                                        {(value * 100).toFixed(1)}%
                                    </p>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            )}
            
            {activeTab === 'dimensions' && (
                <div className="space-y-6">
                    {Object.entries(report.analysis.dimensions).map(([key, dim]) => (
                        <DimensionCard key={key} dimension={dim} />
                    ))}
                </div>
            )}
            
            {activeTab === 'conversation' && (
                <div className="bg-gray-800 rounded-lg p-6">
                    <h3 className="text-xl font-semibold mb-4">Conversation Transcript</h3>
                    {report.sessionId ? (
                        <div className="space-y-3">
                            <p className="text-sm text-gray-400">Session ID: {report.sessionId}</p>
                            {/* Conversation messages would go here */}
                            <p className="text-gray-500 text-center py-8">
                                Conversation details not yet implemented
                            </p>
                        </div>
                    ) : (
                        <p className="text-gray-500 text-center py-8">
                            No probe conversation conducted yet
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}

// Dimension Analysis Card
function DimensionCard({ dimension }: { dimension: any }) {
    const getScoreColor = (score: number) => {
        if (score >= 80) return 'text-green-400';
        if (score >= 60) return 'text-yellow-400';
        if (score >= 40) return 'text-orange-400';
        return 'text-red-400';
    };
    
    const dimensionIcons: Record<string, string> = {
        values: '💎',
        tone: '💬',
        boundaries: '🛡️',
        interests: '🎯',
    };
    
    const dimensionNames: Record<string, string> = {
        values: 'Values Alignment',
        tone: 'Communication Style',
        boundaries: 'Boundary Respect',
        interests: 'Interest Overlap',
    };
    
    return (
        <section className="bg-gray-800 rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold flex items-center gap-2">
                    <span>{dimensionIcons[dimension.dimension]}</span>
                    {dimensionNames[dimension.dimension]}
                </h3>
                <span className={`text-3xl font-bold ${getScoreColor(dimension.score)}`}>
                    {dimension.score}
                </span>
            </div>
            
            <p className="text-gray-300">{dimension.summary}</p>
            
            {dimension.evidence.length > 0 && (
                <div>
                    <h4 className="text-sm font-semibold text-gray-400 mb-2">✅ Evidence</h4>
                    <ul className="space-y-1">
                        {dimension.evidence.map((item: string, i: number) => (
                            <li key={i} className="text-sm text-gray-300 flex gap-2">
                                <span className="text-green-400">•</span>
                                {item}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            
            {dimension.risks.length > 0 && (
                <div>
                    <h4 className="text-sm font-semibold text-gray-400 mb-2">⚠️ Risks</h4>
                    <ul className="space-y-1">
                        {dimension.risks.map((item: string, i: number) => (
                            <li key={i} className="text-sm text-gray-300 flex gap-2">
                                <span className="text-yellow-400">•</span>
                                {item}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            
            {dimension.suggestions.length > 0 && (
                <div>
                    <h4 className="text-sm font-semibold text-gray-400 mb-2">💡 Suggestions</h4>
                    <ul className="space-y-1">
                        {dimension.suggestions.map((item: string, i: number) => (
                            <li key={i} className="text-sm text-gray-300 flex gap-2">
                                <span className="text-blue-400">•</span>
                                {item}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </section>
    );
}

// Compact report card for lists
export function MatchingReportCard({ report, onClick }: { report: MatchingReport; onClick?: () => void }) {
    const getScoreColor = (score: number) => {
        if (score >= 80) return 'text-green-400';
        if (score >= 60) return 'text-yellow-400';
        if (score >= 40) return 'text-orange-400';
        return 'text-red-400';
    };
    
    return (
        <div
            onClick={onClick}
            className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-gray-600 cursor-pointer transition"
        >
            <div className="flex items-center justify-between mb-3">
                <div>
                    <h4 className="font-semibold">Compatibility Report</h4>
                    <p className="text-xs text-gray-500">
                        {new Date(report.generatedAt).toLocaleDateString()}
                    </p>
                </div>
                <div className={`text-3xl font-bold ${getScoreColor(report.compatibilityScore)}`}>
                    {report.compatibilityScore}
                </div>
            </div>
            
            <p className="text-sm text-gray-400 line-clamp-2">{report.analysis.assessment}</p>
            
            <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-gray-700">
                <div className="text-center">
                    <p className="text-xs text-gray-500">Values</p>
                    <p className={`text-sm font-bold ${getScoreColor(report.analysis.dimensions.values.score)}`}>
                        {report.analysis.dimensions.values.score}
                    </p>
                </div>
                <div className="text-center">
                    <p className="text-xs text-gray-500">Tone</p>
                    <p className={`text-sm font-bold ${getScoreColor(report.analysis.dimensions.tone.score)}`}>
                        {report.analysis.dimensions.tone.score}
                    </p>
                </div>
                <div className="text-center">
                    <p className="text-xs text-gray-500">Boundaries</p>
                    <p className={`text-sm font-bold ${getScoreColor(report.analysis.dimensions.boundaries.score)}`}>
                        {report.analysis.dimensions.boundaries.score}
                    </p>
                </div>
                <div className="text-center">
                    <p className="text-xs text-gray-500">Interests</p>
                    <p className={`text-sm font-bold ${getScoreColor(report.analysis.dimensions.interests.score)}`}>
                        {report.analysis.dimensions.interests.score}
                    </p>
                </div>
            </div>
        </div>
    );
}

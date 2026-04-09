/**
 * Loading States
 *
 * Beautiful loading animations following modern minimalism
 */

import React from 'react';

interface LoadingSpinnerProps {
    size?: 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
}

export function LoadingSpinner({ size = 'md', className = '' }: LoadingSpinnerProps) {
    const sizeClasses = {
        sm: 'w-4 h-4 border-2',
        md: 'w-6 h-6 border-2',
        lg: 'w-8 h-8 border-3',
        xl: 'w-12 h-12 border-4',
    };

    return (
        <div
            className={`
        ${sizeClasses[size]}
        border-gray-700 border-t-blue-500
        rounded-full animate-spin
        ${className}
      `}
        />
    );
}

interface LoadingDotsProps {
    className?: string;
}

export function LoadingDots({ className = '' }: LoadingDotsProps) {
    return (
        <div className={`flex items-center gap-1 ${className}`}>
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
    );
}

interface LoadingCardProps {
    className?: string;
}

export function LoadingCard({ className = '' }: LoadingCardProps) {
    return (
        <div className={`bg-[#1a1a1a] rounded-xl border border-[#222] p-6 ${className}`}>
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full shimmer" />
                <div className="flex-1 space-y-2">
                    <div className="h-4 w-1/3 rounded shimmer" />
                    <div className="h-3 w-1/2 rounded shimmer" />
                </div>
            </div>
            <div className="mt-4 space-y-2">
                <div className="h-3 w-full rounded shimmer" />
                <div className="h-3 w-5/6 rounded shimmer" />
                <div className="h-3 w-4/6 rounded shimmer" />
            </div>
        </div>
    );
}

interface LoadingAnalysisProps {
    progress?: number;
    stage?: string;
}

export function LoadingAnalysis({ progress = 0, stage = 'Analyzing...' }: LoadingAnalysisProps) {
    const stages = [
        'Generating embeddings...',
        'Computing similarities...',
        'Analyzing values alignment...',
        'Evaluating communication style...',
        'Assessing boundary respect...',
        'Measuring interest overlap...',
        'Synthesizing report...',
    ];

    const currentStageIndex = Math.floor((progress / 100) * stages.length);
    const currentStage = stages[Math.min(currentStageIndex, stages.length - 1)];

    return (
        <div className="flex flex-col items-center justify-center p-12 space-y-8">
            {/* Animated Rings */}
            <div className="relative w-32 h-32">
                <div
                    className="absolute inset-0 border-2 border-blue-500/20 rounded-full animate-ping"
                    style={{ animationDuration: '2s' }}
                />
                <div
                    className="absolute inset-2 border-2 border-purple-500/20 rounded-full animate-ping"
                    style={{ animationDuration: '2s', animationDelay: '0.3s' }}
                />
                <div
                    className="absolute inset-4 border-2 border-blue-500/30 rounded-full animate-spin"
                    style={{ animationDuration: '3s' }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-3xl font-bold text-gradient">{Math.round(progress)}%</span>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="w-64 space-y-3">
                <div className="h-1 bg-[#222] rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                    />
                </div>
                <p className="text-sm text-gray-400 text-center">{currentStage}</p>
            </div>

            {/* Analysis Steps */}
            <div className="flex gap-2">
                {stages.slice(0, 4).map((s, i) => (
                    <div
                        key={i}
                        className={`w-2 h-2 rounded-full transition-all duration-300 ${
                            i <= currentStageIndex ? 'bg-blue-500 scale-100' : 'bg-gray-700 scale-75'
                        }`}
                    />
                ))}
            </div>
        </div>
    );
}

interface SkeletonProps {
    className?: string;
    lines?: number;
}

export function SkeletonText({ className = '', lines = 3 }: SkeletonProps) {
    return (
        <div className={`space-y-2 ${className}`}>
            {Array.from({ length: lines }).map((_, i) => (
                <div key={i} className="h-4 rounded shimmer" style={{ width: `${100 - i * 15}%` }} />
            ))}
        </div>
    );
}

export function SkeletonCard({ className = '' }: { className?: string }) {
    return (
        <div className={`bg-[#1a1a1a] rounded-xl border border-[#222] p-6 space-y-4 ${className}`}>
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full shimmer" />
                <div className="flex-1 space-y-2">
                    <div className="h-5 w-1/3 rounded shimmer" />
                    <div className="h-3 w-1/4 rounded shimmer" />
                </div>
            </div>
            <SkeletonText lines={3} />
            <div className="flex gap-2 pt-2">
                <div className="h-8 w-20 rounded shimmer" />
                <div className="h-8 w-20 rounded shimmer" />
            </div>
        </div>
    );
}

interface EmptyStateProps {
    icon?: string;
    title: string;
    description: string;
    action?: {
        label: string;
        onClick: () => void;
    };
}

export function EmptyState({ icon = '🔍', title, description, action }: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center animate-fadeIn">
            <div className="text-6xl mb-6 opacity-50">{icon}</div>
            <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
            <p className="text-gray-400 max-w-md mb-6">{description}</p>
            {action && (
                <button
                    onClick={action.onClick}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all duration-200 hover:shadow-lg hover:shadow-blue-500/25"
                >
                    {action.label}
                </button>
            )}
        </div>
    );
}

interface ErrorStateProps {
    title?: string;
    message: string;
    onRetry?: () => void;
}

export function ErrorState({ title = 'Something went wrong', message, onRetry }: ErrorStateProps) {
    return (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
            <p className="text-gray-400 max-w-md mb-6">{message}</p>
            {onRetry && (
                <button
                    onClick={onRetry}
                    className="px-6 py-2.5 bg-[#222] hover:bg-[#333] text-white rounded-lg font-medium transition-all duration-200 border border-[#333]"
                >
                    Try Again
                </button>
            )}
        </div>
    );
}

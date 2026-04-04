'use client';

import { useState } from 'react';

interface PostComposerProps {
    onSubmit: (content: string, tags: string[]) => Promise<void>;
    disabled?: boolean;
}

export function PostComposer({ onSubmit, disabled = false }: PostComposerProps) {
    const [content, setContent] = useState('');
    const [submitting, setSubmitting] = useState(false);

    async function handleSubmit() {
        const trimmed = content.trim();
        if (!trimmed) return;

        // Extract hashtags from content
        const tags = Array.from(trimmed.matchAll(/#(\w+)/g), (m) => m[1]);

        setSubmitting(true);
        try {
            await onSubmit(trimmed, tags);
            setContent('');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div data-testid="post-composer" className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
            <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="What's your agent working on?"
                rows={3}
                maxLength={500}
                disabled={disabled || submitting}
                className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-sm resize-none focus:border-indigo-500 outline-none disabled:opacity-50"
            />
            <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">{content.length}/500</span>
                <button
                    onClick={handleSubmit}
                    disabled={disabled || submitting || !content.trim()}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
                >
                    {submitting ? 'Posting...' : 'Post'}
                </button>
            </div>
        </div>
    );
}

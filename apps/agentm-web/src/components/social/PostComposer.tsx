'use client';

import { useState } from 'react';

const colors = {
    bg: '#F3F3F8',
    surface: '#FFFFFF',
    ink: '#16161A',
    lavender: '#C6BBFF',
    lime: '#CDFF4D',
};

export interface PostComposerProps {
    onSubmit: (content: string, tags: string[]) => Promise<void>;
    disabled?: boolean;
    userAddress?: string | null;
}

export function PostComposer({ onSubmit, disabled = false, userAddress }: PostComposerProps) {
    const [content, setContent] = useState('');
    const [submitting, setSubmitting] = useState(false);

    async function handleSubmit() {
        const trimmed = content.trim();
        if (!trimmed || submitting) return;

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

    if (!userAddress) {
        return null;
    }

    return (
        <div
            style={{
                background: colors.surface,
                borderRadius: '24px',
                padding: '20px',
                border: `1.5px solid ${colors.ink}`,
            }}
        >
            <div style={{ display: 'flex', gap: '12px' }}>
                <div
                    style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '50%',
                        background: colors.lavender,
                        border: `1.5px solid ${colors.ink}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '18px',
                        flexShrink: 0,
                    }}
                >
                    👤
                </div>
                <div style={{ flex: 1 }}>
                    <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="What's happening?"
                        disabled={disabled || submitting}
                        maxLength={500}
                        style={{
                            width: '100%',
                            padding: '12px 16px',
                            borderRadius: '12px',
                            border: `1.5px solid ${colors.ink}`,
                            background: colors.bg,
                            fontSize: '14px',
                            resize: 'none',
                            minHeight: '80px',
                            fontFamily: 'inherit',
                            outline: 'none',
                            opacity: disabled || submitting ? 0.6 : 1,
                        }}
                    />
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginTop: '12px',
                        }}
                    >
                        <span
                            style={{
                                fontSize: '12px',
                                color: colors.ink,
                                opacity: 0.5,
                            }}
                        >
                            {content.length}/500
                        </span>
                        <button
                            onClick={handleSubmit}
                            disabled={disabled || submitting || !content.trim()}
                            style={{
                                padding: '10px 24px',
                                background: colors.ink,
                                color: colors.surface,
                                border: 'none',
                                borderRadius: '12px',
                                fontSize: '14px',
                                fontWeight: 600,
                                cursor: disabled || submitting || !content.trim() ? 'not-allowed' : 'pointer',
                                opacity: disabled || submitting || !content.trim() ? 0.5 : 1,
                                transition: 'opacity 0.2s ease',
                            }}
                        >
                            {submitting ? 'Posting...' : 'Post'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default PostComposer;

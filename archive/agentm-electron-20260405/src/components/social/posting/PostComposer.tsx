/**
 * PostComposer Component
 *
 * Rich text editor for composing post content. Supports auto-resize,
 * character limits, and basic text formatting hints.
 *
 * @module components/social/posting/PostComposer
 */

import { useRef, useCallback, useEffect } from 'react';

export interface PostComposerProps {
    /** Current content value */
    content: string;
    /** Callback when content changes */
    onChange: (content: string) => void;
    /** Placeholder text */
    placeholder?: string;
    /** Maximum character length */
    maxLength?: number;
    /** Whether the composer is disabled */
    disabled?: boolean;
    /** Minimum rows to display */
    minRows?: number;
    /** Maximum rows before scrolling */
    maxRows?: number;
    /** Optional additional CSS classes */
    className?: string;
    /** Auto-focus on mount */
    autoFocus?: boolean;
    /** Callback when Enter is pressed without Shift */
    onSubmit?: () => void;
}

/**
 * PostComposer - Rich text composition area
 *
 * Features:
 * - Auto-resizing textarea
 * - Character count tracking
 * - Basic formatting hints (hashtags, mentions)
 * - Submit on Enter (optional)
 */
export function PostComposer({
    content,
    onChange,
    placeholder = "What's happening?",
    maxLength = 2000,
    disabled = false,
    minRows = 3,
    maxRows = 10,
    className = '',
    autoFocus = false,
    onSubmit,
}: PostComposerProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-resize textarea based on content
    const adjustTextareaHeight = useCallback(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        // Reset height to calculate proper scrollHeight
        textarea.style.height = 'auto';

        // Calculate line height (approximate)
        const lineHeight = 24;
        const minHeight = minRows * lineHeight;
        const maxHeight = maxRows * lineHeight;

        // Set new height within bounds
        const newHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);
        textarea.style.height = `${newHeight}px`;
    }, [minRows, maxRows]);

    // Adjust height on content change
    useEffect(() => {
        adjustTextareaHeight();
    }, [content, adjustTextareaHeight]);

    // Auto-focus on mount if requested
    useEffect(() => {
        if (autoFocus && textareaRef.current) {
            textareaRef.current.focus();
        }
    }, [autoFocus]);

    const handleChange = useCallback(
        (e: React.ChangeEvent<HTMLTextAreaElement>) => {
            const newValue = e.target.value;

            // Enforce max length
            if (newValue.length <= maxLength) {
                onChange(newValue);
            }
        },
        [onChange, maxLength],
    );

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            // Submit on Enter without Shift (if handler provided)
            if (e.key === 'Enter' && !e.shiftKey && onSubmit) {
                e.preventDefault();
                onSubmit();
            }
        },
        [onSubmit],
    );

    // Highlight formatting in content
    const highlightContent = (text: string): React.ReactNode => {
        // Split by hashtags and mentions
        const parts = text.split(/(#\w+|@\w+)/g);

        return parts.map((part, index) => {
            if (part.startsWith('#')) {
                return (
                    <span key={index} className="text-blue-400">
                        {part}
                    </span>
                );
            }
            if (part.startsWith('@')) {
                return (
                    <span key={index} className="text-purple-400">
                        {part}
                    </span>
                );
            }
            return part;
        });
    };

    const isNearLimit = content.length > maxLength * 0.9;
    const isAtLimit = content.length >= maxLength;

    return (
        <div className={`relative ${className}`}>
            {/* Main textarea */}
            <textarea
                ref={textareaRef}
                value={content}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                disabled={disabled}
                rows={minRows}
                className={`
                    w-full bg-transparent text-gray-200 placeholder-gray-500
                    resize-none focus:outline-none
                    disabled:opacity-50 disabled:cursor-not-allowed
                    text-base leading-6
                `}
                style={{
                    minHeight: `${minRows * 24}px`,
                    maxHeight: `${maxRows * 24}px`,
                }}
            />

            {/* Formatting hints overlay (hidden, for future enhancement) */}
            {/* This could show a preview of hashtags/mentions styling */}

            {/* Toolbar with formatting hints */}
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-800/50">
                {/* Formatting tips */}
                <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                        <span className="text-blue-400">#</span>
                        <span>hashtags</span>
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="text-purple-400">@</span>
                        <span>mentions</span>
                    </span>
                </div>

                {/* Character counter */}
                <div className="flex items-center gap-2">
                    {isNearLimit && (
                        <div className="relative w-5 h-5">
                            <svg className="w-5 h-5 transform -rotate-90" viewBox="0 0 20 20">
                                <circle
                                    cx="10"
                                    cy="10"
                                    r="8"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    className="text-gray-700"
                                />
                                <circle
                                    cx="10"
                                    cy="10"
                                    r="8"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeDasharray={`${(content.length / maxLength) * 50.265} 50.265`}
                                    className={isAtLimit ? 'text-red-400' : 'text-yellow-400'}
                                />
                            </svg>
                        </div>
                    )}
                    <span
                        className={`text-xs ${
                            isAtLimit ? 'text-red-400' : isNearLimit ? 'text-yellow-400' : 'text-gray-500'
                        }`}
                    >
                        {maxLength - content.length}
                    </span>
                </div>
            </div>
        </div>
    );
}

export default PostComposer;

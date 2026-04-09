/**
 * CreatePost Component
 *
 * Main post creation container that orchestrates post composition,
 * media uploads, and post submission. Supports text, task, and achievement post types.
 *
 * @module components/social/posting/CreatePost
 */

import { useState, useCallback } from 'react';
import { PostComposer } from './PostComposer.tsx';
import { MediaUpload, type MediaFile } from './MediaUpload.tsx';

/** Post type variants */
export type PostType = 'text' | 'task' | 'achievement';

/** Post data structure */
export interface PostData {
    /** Unique post identifier */
    id: string;
    /** Post type */
    type: PostType;
    /** Post content text */
    content: string;
    /** Optional media attachments */
    media: MediaFile[];
    /** Task reference (for task posts) */
    taskId?: number;
    /** Achievement data (for achievement posts) */
    achievement?: {
        title: string;
        description: string;
        icon?: string;
    };
    /** Author address */
    author: string;
    /** Creation timestamp */
    createdAt: number;
}

export interface CreatePostProps {
    /** Author wallet/peer address */
    authorAddress: string;
    /** Callback when post is created */
    onPost: (post: PostData) => Promise<void>;
    /** Optional default post type */
    defaultType?: PostType;
    /** Optional placeholder text */
    placeholder?: string;
    /** Optional additional CSS classes */
    className?: string;
    /** Whether posting is disabled */
    disabled?: boolean;
    /** Optional task ID to attach (for task posts) */
    taskId?: number;
    /** Optional achievement to attach */
    achievement?: PostData['achievement'];
}

/**
 * CreatePost - Main post creation component
 *
 * Provides a complete post creation interface with support for:
 * - Text posts: Simple text content
 * - Task posts: Posts linked to arena tasks
 * - Achievement posts: Posts celebrating accomplishments
 */
export function CreatePost({
    authorAddress,
    onPost,
    defaultType = 'text',
    placeholder = 'Share an update with the network...',
    className = '',
    disabled = false,
    taskId,
    achievement,
}: CreatePostProps) {
    const [postType, setPostType] = useState<PostType>(defaultType);
    const [content, setContent] = useState('');
    const [media, setMedia] = useState<MediaFile[]>([]);
    const [isPosting, setIsPosting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showMediaUpload, setShowMediaUpload] = useState(false);

    const handleContentChange = useCallback((newContent: string) => {
        setContent(newContent);
        setError(null);
    }, []);

    const handleMediaAdd = useCallback((files: MediaFile[]) => {
        setMedia((prev) => [...prev, ...files].slice(0, 4)); // Max 4 media files
        setError(null);
    }, []);

    const handleMediaRemove = useCallback((fileId: string) => {
        setMedia((prev) => prev.filter((f) => f.id !== fileId));
    }, []);

    const handlePost = useCallback(async () => {
        const trimmedContent = content.trim();

        // Validation
        if (!trimmedContent && media.length === 0) {
            setError('Please add some content or media to your post');
            return;
        }

        if (trimmedContent.length > 2000) {
            setError('Post content must be 2000 characters or less');
            return;
        }

        setIsPosting(true);
        setError(null);

        try {
            const post: PostData = {
                id: crypto.randomUUID(),
                type: postType,
                content: trimmedContent,
                media,
                author: authorAddress,
                createdAt: Date.now(),
                ...(taskId && { taskId }),
                ...(achievement && { achievement }),
            };

            await onPost(post);

            // Reset form on success
            setContent('');
            setMedia([]);
            setShowMediaUpload(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create post');
        } finally {
            setIsPosting(false);
        }
    }, [content, media, postType, authorAddress, taskId, achievement, onPost]);

    const canPost = (content.trim().length > 0 || media.length > 0) && !isPosting && !disabled;

    const getPostTypeLabel = (type: PostType): string => {
        switch (type) {
            case 'task':
                return 'Task Update';
            case 'achievement':
                return 'Achievement';
            default:
                return 'Post';
        }
    };

    const getPostTypeIcon = (type: PostType): React.ReactNode => {
        switch (type) {
            case 'task':
                return (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                        />
                    </svg>
                );
            case 'achievement':
                return (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                        />
                    </svg>
                );
            default:
                return (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                    </svg>
                );
        }
    };

    return (
        <div className={`bg-gray-900 rounded-xl border border-gray-800 ${className}`}>
            {/* Post type selector */}
            <div className="flex items-center gap-2 px-4 pt-4 pb-2">
                {(['text', 'task', 'achievement'] as PostType[]).map((type) => (
                    <button
                        key={type}
                        onClick={() => setPostType(type)}
                        disabled={disabled}
                        className={`
                            flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition
                            ${
                                postType === type
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-300'
                            }
                            disabled:opacity-50 disabled:cursor-not-allowed
                        `}
                    >
                        {getPostTypeIcon(type)}
                        <span>{getPostTypeLabel(type)}</span>
                    </button>
                ))}
            </div>

            {/* Achievement badge preview */}
            {postType === 'achievement' && achievement && (
                <div className="mx-4 mb-2 p-3 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 rounded-lg border border-yellow-500/20">
                    <div className="flex items-center gap-2">
                        <span className="text-xl">{achievement.icon ?? '🏆'}</span>
                        <div>
                            <p className="text-sm font-medium text-yellow-400">{achievement.title}</p>
                            <p className="text-xs text-gray-400">{achievement.description}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Task reference preview */}
            {postType === 'task' && taskId && (
                <div className="mx-4 mb-2 p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                    <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                            />
                        </svg>
                        <span className="text-sm text-blue-400">Task #{taskId}</span>
                    </div>
                </div>
            )}

            {/* Post composer */}
            <div className="px-4 py-2">
                <PostComposer
                    content={content}
                    onChange={handleContentChange}
                    placeholder={placeholder}
                    disabled={disabled || isPosting}
                    maxLength={2000}
                />
            </div>

            {/* Media upload area */}
            {showMediaUpload && (
                <div className="px-4 pb-2">
                    <MediaUpload
                        files={media}
                        onAdd={handleMediaAdd}
                        onRemove={handleMediaRemove}
                        maxFiles={4}
                        disabled={disabled || isPosting}
                    />
                </div>
            )}

            {/* Media preview (when files are added) */}
            {media.length > 0 && !showMediaUpload && (
                <div className="px-4 pb-2">
                    <div className="flex flex-wrap gap-2">
                        {media.map((file) => (
                            <div key={file.id} className="relative w-16 h-16 rounded-lg overflow-hidden bg-gray-800">
                                {file.type === 'image' ? (
                                    <img src={file.previewUrl} alt={file.name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <svg
                                            className="w-6 h-6 text-gray-500"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                                            />
                                        </svg>
                                    </div>
                                )}
                                <button
                                    onClick={() => handleMediaRemove(file.id)}
                                    className="absolute top-0.5 right-0.5 w-5 h-5 bg-gray-900/80 rounded-full flex items-center justify-center text-gray-400 hover:text-white transition"
                                >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M6 18L18 6M6 6l12 12"
                                        />
                                    </svg>
                                </button>
                            </div>
                        ))}
                        <button
                            onClick={() => setShowMediaUpload(true)}
                            className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-700 flex items-center justify-center text-gray-500 hover:border-gray-600 hover:text-gray-400 transition"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}

            {/* Error message */}
            {error && (
                <div className="px-4 pb-2">
                    <p className="text-sm text-red-400">{error}</p>
                </div>
            )}

            {/* Actions bar */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
                <div className="flex items-center gap-2">
                    {/* Media toggle */}
                    <button
                        onClick={() => setShowMediaUpload(!showMediaUpload)}
                        disabled={disabled || isPosting}
                        className={`
                            p-2 rounded-lg transition
                            ${
                                showMediaUpload || media.length > 0
                                    ? 'bg-blue-600/20 text-blue-400'
                                    : 'bg-gray-800 text-gray-500 hover:bg-gray-700 hover:text-gray-400'
                            }
                            disabled:opacity-50 disabled:cursor-not-allowed
                        `}
                        title="Add media"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                        </svg>
                    </button>

                    {/* Character count */}
                    <span className={`text-xs ${content.length > 1800 ? 'text-yellow-400' : 'text-gray-500'}`}>
                        {content.length}/2000
                    </span>
                </div>

                {/* Post button */}
                <button
                    onClick={() => void handlePost()}
                    disabled={!canPost}
                    className={`
                        px-4 py-2 rounded-lg font-medium text-sm transition
                        ${
                            canPost
                                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                                : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                        }
                    `}
                >
                    {isPosting ? (
                        <span className="flex items-center gap-2">
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle
                                    className="opacity-25"
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                />
                                <path
                                    className="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                />
                            </svg>
                            Posting...
                        </span>
                    ) : (
                        `${getPostTypeLabel(postType)}`
                    )}
                </button>
            </div>
        </div>
    );
}

export default CreatePost;

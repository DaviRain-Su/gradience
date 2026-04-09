/**
 * MediaUpload Component
 *
 * Handles image and video file uploads with preview,
 * drag-and-drop support, and file validation.
 *
 * @module components/social/posting/MediaUpload
 */

import { useState, useRef, useCallback } from 'react';

/** Supported media types */
export type MediaType = 'image' | 'video';

/** Media file metadata */
export interface MediaFile {
    /** Unique file identifier */
    id: string;
    /** File name */
    name: string;
    /** Media type */
    type: MediaType;
    /** File size in bytes */
    size: number;
    /** MIME type */
    mimeType: string;
    /** Preview URL (blob URL for local preview) */
    previewUrl: string;
    /** Original File object */
    file: File;
}

export interface MediaUploadProps {
    /** Currently attached files */
    files: MediaFile[];
    /** Callback when files are added */
    onAdd: (files: MediaFile[]) => void;
    /** Callback when a file is removed */
    onRemove: (fileId: string) => void;
    /** Maximum number of files allowed */
    maxFiles?: number;
    /** Maximum file size in bytes (default: 10MB) */
    maxFileSize?: number;
    /** Whether upload is disabled */
    disabled?: boolean;
    /** Optional additional CSS classes */
    className?: string;
    /** Accepted file types */
    acceptedTypes?: string[];
}

/** Default accepted file types */
const DEFAULT_ACCEPTED_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/webm',
    'video/quicktime',
];

/** Default max file size: 10MB */
const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * MediaUpload - File upload component with preview
 *
 * Features:
 * - Drag and drop support
 * - Click to browse
 * - File type validation
 * - Size validation
 * - Preview thumbnails
 * - Remove individual files
 */
export function MediaUpload({
    files,
    onAdd,
    onRemove,
    maxFiles = 4,
    maxFileSize = DEFAULT_MAX_FILE_SIZE,
    disabled = false,
    className = '',
    acceptedTypes = DEFAULT_ACCEPTED_TYPES,
}: MediaUploadProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const canAddMore = files.length < maxFiles;

    const validateFile = useCallback(
        (file: File): string | null => {
            // Check file type
            if (!acceptedTypes.includes(file.type)) {
                return `File type "${file.type}" is not supported`;
            }

            // Check file size
            if (file.size > maxFileSize) {
                const sizeMB = (maxFileSize / (1024 * 1024)).toFixed(0);
                return `File size exceeds ${sizeMB}MB limit`;
            }

            return null;
        },
        [acceptedTypes, maxFileSize],
    );

    const processFiles = useCallback(
        (fileList: FileList | File[]) => {
            const newFiles: MediaFile[] = [];
            const errors: string[] = [];

            const filesToProcess = Array.from(fileList).slice(0, maxFiles - files.length);

            for (const file of filesToProcess) {
                const validationError = validateFile(file);

                if (validationError) {
                    errors.push(`${file.name}: ${validationError}`);
                    continue;
                }

                const mediaType: MediaType = file.type.startsWith('video/') ? 'video' : 'image';

                newFiles.push({
                    id: crypto.randomUUID(),
                    name: file.name,
                    type: mediaType,
                    size: file.size,
                    mimeType: file.type,
                    previewUrl: URL.createObjectURL(file),
                    file,
                });
            }

            if (errors.length > 0) {
                setError(errors.join('. '));
            } else {
                setError(null);
            }

            if (newFiles.length > 0) {
                onAdd(newFiles);
            }
        },
        [files.length, maxFiles, validateFile, onAdd],
    );

    const handleDragEnter = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            if (!disabled && canAddMore) {
                setIsDragging(true);
            }
        },
        [disabled, canAddMore],
    );

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);

            if (disabled || !canAddMore) return;

            const droppedFiles = e.dataTransfer.files;
            if (droppedFiles.length > 0) {
                processFiles(droppedFiles);
            }
        },
        [disabled, canAddMore, processFiles],
    );

    const handleFileSelect = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const selectedFiles = e.target.files;
            if (selectedFiles && selectedFiles.length > 0) {
                processFiles(selectedFiles);
            }

            // Reset input to allow selecting the same file again
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        },
        [processFiles],
    );

    const handleBrowseClick = useCallback(() => {
        if (!disabled && canAddMore) {
            fileInputRef.current?.click();
        }
    }, [disabled, canAddMore]);

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    return (
        <div className={`${className}`}>
            {/* Drop zone */}
            <div
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={handleBrowseClick}
                className={`
                    relative border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition
                    ${isDragging ? 'border-blue-500 bg-blue-500/10' : 'border-gray-700 hover:border-gray-600'}
                    ${disabled || !canAddMore ? 'opacity-50 cursor-not-allowed' : ''}
                `}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept={acceptedTypes.join(',')}
                    onChange={handleFileSelect}
                    disabled={disabled || !canAddMore}
                    className="hidden"
                />

                <div className="flex flex-col items-center gap-2">
                    <svg
                        className={`w-8 h-8 ${isDragging ? 'text-blue-400' : 'text-gray-500'}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                        />
                    </svg>

                    <div className="text-sm">
                        <span className="text-blue-400">Click to upload</span>
                        <span className="text-gray-500"> or drag and drop</span>
                    </div>

                    <p className="text-xs text-gray-500">
                        Images (JPEG, PNG, GIF, WebP) or Videos (MP4, WebM)
                        <br />
                        Max {formatFileSize(maxFileSize)} per file · {maxFiles - files.length} remaining
                    </p>
                </div>
            </div>

            {/* Error message */}
            {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

            {/* File previews */}
            {files.length > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                    {files.map((file) => (
                        <div key={file.id} className="relative group rounded-lg overflow-hidden bg-gray-800">
                            {/* Preview */}
                            {file.type === 'image' ? (
                                <img src={file.previewUrl} alt={file.name} className="w-full h-32 object-cover" />
                            ) : (
                                <div className="relative w-full h-32">
                                    <video src={file.previewUrl} className="w-full h-full object-cover" muted />
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                        <svg
                                            className="w-10 h-10 text-white/80"
                                            fill="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path d="M8 5v14l11-7z" />
                                        </svg>
                                    </div>
                                </div>
                            )}

                            {/* File info overlay */}
                            <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/70 to-transparent">
                                <p className="text-xs text-white truncate">{file.name}</p>
                                <p className="text-xs text-gray-400">{formatFileSize(file.size)}</p>
                            </div>

                            {/* Remove button */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onRemove(file.id);
                                }}
                                disabled={disabled}
                                className="absolute top-2 right-2 w-6 h-6 bg-gray-900/80 rounded-full flex items-center justify-center text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition disabled:opacity-50"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M6 18L18 6M6 6l12 12"
                                    />
                                </svg>
                            </button>

                            {/* Type badge */}
                            <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-gray-900/80 rounded text-xs text-gray-300">
                                {file.type === 'video' ? 'VIDEO' : 'IMAGE'}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default MediaUpload;

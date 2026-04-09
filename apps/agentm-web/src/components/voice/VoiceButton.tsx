'use client';

import { useVoice } from '@/hooks/useVoice';

// Project color palette
const colors = {
    bg: '#F3F3F8',
    surface: '#FFFFFF',
    ink: '#16161A',
    lavender: '#C6BBFF',
    lime: '#CDFF4D',
    coral: '#FF6B6B',
    gold: '#FFD700',
};

interface VoiceButtonProps {
    /** Called when speech is transcribed */
    onTranscript: (text: string) => void;
    /** Optional error handler */
    onError?: (error: Error) => void;
    /** Button size variant */
    size?: 'sm' | 'md' | 'lg';
    /** Optional className for additional styling */
    className?: string;
}

/**
 * Voice input button component
 *
 * Hold to record speech, release to transcribe.
 * Shows visual feedback during recording.
 *
 * @example
 * ```tsx
 * <VoiceButton
 *   onTranscript={(text) => setInputValue(text)}
 *   size="md"
 * />
 * ```
 */
export function VoiceButton({ onTranscript, onError, size = 'md', className }: VoiceButtonProps) {
    const { recording, supported, recognitionSupported, startRecording, stopRecording } = useVoice({
        onTranscript,
        onError,
    });

    const handleMouseDown = () => {
        if (!supported) return;
        startRecording();
    };

    const handleMouseUp = async () => {
        if (!recording) return;
        await stopRecording();
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        e.preventDefault();
        if (!supported) return;
        startRecording();
    };

    const handleTouchEnd = async (e: React.TouchEvent) => {
        e.preventDefault();
        if (!recording) return;
        await stopRecording();
    };

    // Size configurations
    const sizeStyles = {
        sm: { padding: '8px 12px', fontSize: '12px', iconSize: 14 },
        md: { padding: '10px 16px', fontSize: '14px', iconSize: 18 },
        lg: { padding: '12px 20px', fontSize: '16px', iconSize: 22 },
    };

    const currentSize = sizeStyles[size];

    // Get button styles based on state
    const getButtonStyles = (): React.CSSProperties => {
        if (recording) {
            return {
                background: colors.coral,
                color: colors.surface,
                border: `1.5px solid ${colors.ink}`,
                boxShadow: `0 0 0 4px ${colors.coral}40`,
                animation: 'pulse 1s ease-in-out infinite',
            };
        }

        if (!supported) {
            return {
                background: colors.bg,
                color: '#999',
                border: `1.5px dashed ${colors.ink}30`,
                cursor: 'not-allowed',
                opacity: 0.6,
            };
        }

        return {
            background: colors.lavender,
            color: colors.ink,
            border: `1.5px solid ${colors.ink}`,
            cursor: 'pointer',
        };
    };

    const buttonStyles: React.CSSProperties = {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        padding: currentSize.padding,
        borderRadius: '12px',
        fontSize: currentSize.fontSize,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        userSelect: 'none',
        transition: 'all 0.15s ease',
        ...getButtonStyles(),
    };

    // Mic icon SVG
    const MicIcon = () => (
        <svg
            width={currentSize.iconSize}
            height={currentSize.iconSize}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ flexShrink: 0 }}
        >
            <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" x2="12" y1="19" y2="22" />
        </svg>
    );

    // Warning icon for unsupported state
    const WarningIcon = () => (
        <svg
            width={currentSize.iconSize}
            height={currentSize.iconSize}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ flexShrink: 0 }}
        >
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <line x1="12" x2="12" y1="9" y2="13" />
            <line x1="12" x2="12.01" y1="17" y2="17" />
        </svg>
    );

    const getTitle = () => {
        if (!supported) {
            return 'Voice input not supported in this browser. Try Chrome or Edge.';
        }
        if (recording) {
            return 'Recording... Release to stop';
        }
        return 'Hold to speak';
    };

    return (
        <>
            <style jsx>{`
                @keyframes pulse {
                    0%,
                    100% {
                        opacity: 1;
                    }
                    50% {
                        opacity: 0.7;
                    }
                }
            `}</style>
            <button
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                disabled={!supported}
                style={buttonStyles}
                title={getTitle()}
                className={className}
                aria-label={recording ? 'Recording voice input' : 'Start voice input'}
                aria-pressed={recording}
            >
                {supported ? <MicIcon /> : <WarningIcon />}
                <span>{recording ? 'Listening...' : 'Voice'}</span>
            </button>
        </>
    );
}

/**
 * Simpler voice button with click-to-toggle behavior
 * instead of hold-to-record
 */
export function VoiceToggleButton({ onTranscript, onError, size = 'md', className }: VoiceButtonProps) {
    const { recording, supported, toggleRecording } = useVoice({
        onTranscript,
        onError,
    });

    const handleClick = async () => {
        await toggleRecording();
    };

    // Size configurations
    const sizeStyles = {
        sm: { padding: '8px', fontSize: '12px', iconSize: 16 },
        md: { padding: '10px', fontSize: '14px', iconSize: 20 },
        lg: { padding: '12px', fontSize: '16px', iconSize: 24 },
    };

    const currentSize = sizeStyles[size];

    // Get button styles based on state
    const getButtonStyles = (): React.CSSProperties => {
        if (recording) {
            return {
                background: colors.coral,
                color: colors.surface,
                border: `1.5px solid ${colors.ink}`,
                boxShadow: `0 0 0 4px ${colors.coral}40`,
                animation: 'pulse 1s ease-in-out infinite',
            };
        }

        if (!supported) {
            return {
                background: colors.bg,
                color: '#999',
                border: `1.5px dashed ${colors.ink}30`,
                cursor: 'not-allowed',
                opacity: 0.6,
            };
        }

        return {
            background: colors.surface,
            color: colors.ink,
            border: `1.5px solid ${colors.ink}`,
            cursor: 'pointer',
        };
    };

    const buttonStyles: React.CSSProperties = {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: currentSize.padding,
        borderRadius: '10px',
        fontSize: currentSize.fontSize,
        fontWeight: 600,
        transition: 'all 0.15s ease',
        ...getButtonStyles(),
    };

    // Mic icon SVG
    const MicIcon = () => (
        <svg
            width={currentSize.iconSize}
            height={currentSize.iconSize}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" x2="12" y1="19" y2="22" />
        </svg>
    );

    return (
        <>
            <style jsx>{`
                @keyframes pulse {
                    0%,
                    100% {
                        opacity: 1;
                    }
                    50% {
                        opacity: 0.7;
                    }
                }
            `}</style>
            <button
                onClick={handleClick}
                disabled={!supported}
                style={buttonStyles}
                title={supported ? (recording ? 'Click to stop' : 'Click to speak') : 'Voice not supported'}
                className={className}
                aria-label={recording ? 'Stop voice input' : 'Start voice input'}
                aria-pressed={recording}
            >
                <MicIcon />
            </button>
        </>
    );
}

export default VoiceButton;

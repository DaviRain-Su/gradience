import { useVoice } from '../hooks/useVoice.ts';

interface VoiceButtonProps {
    onTranscript: (text: string) => void;
}

export function VoiceButton({ onTranscript }: VoiceButtonProps) {
    const { recording, supported, provider, fallbackFrom, startRecording, stopAndTranscribe } = useVoice();

    const handleMouseDown = () => {
        startRecording();
    };

    const handleMouseUp = async () => {
        const text = await stopAndTranscribe();
        if (text.trim()) {
            onTranscript(text.trim());
        }
    };

    return (
        <button
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp} // Stop if mouse leaves button while held
            disabled={!supported}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition select-none ${
                recording
                    ? 'bg-red-600 text-white animate-pulse'
                    : supported
                      ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                      : 'bg-gray-800 text-gray-500 cursor-not-allowed'
            }`}
            title={
                !supported
                    ? 'Voice unavailable in current environment'
                    : fallbackFrom === 'whisper'
                      ? 'Whisper unavailable, using Web Speech fallback'
                      : 'Hold to speak'
            }
        >
            {recording ? 'Recording...' : provider === 'web_speech' ? 'Voice' : 'Voice Off'}
        </button>
    );
}

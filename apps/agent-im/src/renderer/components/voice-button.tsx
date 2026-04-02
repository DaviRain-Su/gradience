import { useVoice } from '../hooks/useVoice.ts';

interface VoiceButtonProps {
    onTranscript: (text: string) => void;
}

export function VoiceButton({ onTranscript }: VoiceButtonProps) {
    const { recording, supported, startRecording, stopAndTranscribe } = useVoice();

    if (!supported) return null; // Hide button if no speech API

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
            className={`px-3 py-2 rounded-lg text-sm font-medium transition select-none ${
                recording
                    ? 'bg-red-600 text-white animate-pulse'
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
            title="Hold to speak"
        >
            {recording ? 'Recording...' : 'Voice'}
        </button>
    );
}

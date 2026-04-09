import { useState, useCallback } from 'react';
import { createVoiceEngine, type VoiceEngine } from '../lib/voice-engine.ts';

let engineInstance: VoiceEngine | null = null;

function getEngine(): VoiceEngine {
    if (!engineInstance) {
        const voiceEngine = (import.meta as unknown as { env?: { VITE_VOICE_ENGINE?: string } }).env?.VITE_VOICE_ENGINE;
        engineInstance = createVoiceEngine({
            preferWhisper: voiceEngine === 'whisper',
        });
    }
    return engineInstance;
}

export function useVoice() {
    const [recording, setRecording] = useState(false);
    const [speaking, setSpeaking] = useState(false);
    const engine = getEngine();

    const startRecording = useCallback(() => {
        if (!engine.supported) return;
        engine.startRecording();
        setRecording(true);
    }, [engine]);

    const stopAndTranscribe = useCallback(async (): Promise<string> => {
        setRecording(false);
        return engine.stopAndTranscribe();
    }, [engine]);

    const speak = useCallback(
        async (text: string) => {
            setSpeaking(true);
            try {
                await engine.speak(text);
            } finally {
                setSpeaking(false);
            }
        },
        [engine],
    );

    const stopSpeaking = useCallback(() => {
        engine.stopSpeaking();
        setSpeaking(false);
    }, [engine]);

    return {
        recording,
        speaking,
        supported: engine.supported,
        provider: engine.provider,
        fallbackFrom: engine.fallbackFrom,
        startRecording,
        stopAndTranscribe,
        speak,
        stopSpeaking,
    };
}

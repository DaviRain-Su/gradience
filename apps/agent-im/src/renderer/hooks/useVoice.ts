import { useState, useRef, useCallback } from 'react';
import { createVoiceEngine, type VoiceEngine } from '../lib/voice-engine.ts';

let engineInstance: VoiceEngine | null = null;

function getEngine(): VoiceEngine {
    if (!engineInstance) {
        engineInstance = createVoiceEngine();
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

    const speak = useCallback(async (text: string) => {
        setSpeaking(true);
        try {
            await engine.speak(text);
        } finally {
            setSpeaking(false);
        }
    }, [engine]);

    const stopSpeaking = useCallback(() => {
        engine.stopSpeaking();
        setSpeaking(false);
    }, [engine]);

    return {
        recording,
        speaking,
        supported: engine.supported,
        startRecording,
        stopAndTranscribe,
        speak,
        stopSpeaking,
    };
}

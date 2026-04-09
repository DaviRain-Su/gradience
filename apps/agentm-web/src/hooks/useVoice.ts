'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import {
    getVoiceEngine,
    createVoiceEngine,
    isSpeechRecognitionSupported,
    isSpeechSynthesisSupported,
} from '@/lib/voice/voice-engine';

interface UseVoiceOptions {
    /** Called when speech recognition returns a transcript */
    onTranscript?: (text: string) => void;
    /** Called when an error occurs */
    onError?: (error: Error) => void;
    /** Language for speech recognition (default: 'en-US') */
    lang?: string;
}

interface UseVoiceReturn {
    /** Whether currently recording */
    recording: boolean;
    /** Whether currently speaking (TTS) */
    speaking: boolean;
    /** Whether voice features are supported in this browser */
    supported: boolean;
    /** Whether speech recognition is supported */
    recognitionSupported: boolean;
    /** Whether speech synthesis is supported */
    synthesisSupported: boolean;
    /** Start recording audio */
    startRecording: () => void;
    /** Stop recording and get transcript */
    stopRecording: () => Promise<string>;
    /** Toggle recording state */
    toggleRecording: () => Promise<string>;
    /** Speak text using TTS */
    speak: (text: string) => Promise<void>;
    /** Stop speaking */
    stopSpeaking: () => void;
}

/**
 * React hook for voice input/output using Web Speech API
 *
 * @example
 * ```tsx
 * const { recording, supported, startRecording, stopRecording, speak } = useVoice({
 *   onTranscript: (text) => console.log('You said:', text)
 * });
 * ```
 */
export function useVoice(options: UseVoiceOptions = {}): UseVoiceReturn {
    const { onTranscript, onError, lang = 'en-US' } = options;

    const [recording, setRecording] = useState(false);
    const [speaking, setSpeaking] = useState(false);
    const [supported, setSupported] = useState(false);
    const [recognitionSupported, setRecognitionSupported] = useState(false);
    const [synthesisSupported, setSynthesisSupported] = useState(false);

    const engineRef = useRef(getVoiceEngine());

    // Check support on mount (client-side only)
    useEffect(() => {
        setRecognitionSupported(isSpeechRecognitionSupported());
        setSynthesisSupported(isSpeechSynthesisSupported());
        setSupported(isSpeechRecognitionSupported() || isSpeechSynthesisSupported());
    }, []);

    const startRecording = useCallback(() => {
        if (!engineRef.current.supported) {
            onError?.(new Error('Speech recognition not supported in this browser'));
            return;
        }

        try {
            engineRef.current.startRecording();
            setRecording(true);
        } catch (err) {
            setRecording(false);
            onError?.(err instanceof Error ? err : new Error('Failed to start recording'));
        }
    }, [onError]);

    const stopRecording = useCallback(async (): Promise<string> => {
        if (!recording) return '';

        setRecording(false);

        try {
            const transcript = await engineRef.current.stopAndTranscribe();
            if (transcript.trim()) {
                onTranscript?.(transcript.trim());
            }
            return transcript.trim();
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to transcribe');
            onError?.(error);
            return '';
        }
    }, [recording, onTranscript, onError]);

    const toggleRecording = useCallback(async (): Promise<string> => {
        if (recording) {
            return stopRecording();
        } else {
            startRecording();
            return '';
        }
    }, [recording, startRecording, stopRecording]);

    const speak = useCallback(
        async (text: string): Promise<void> => {
            if (!text.trim()) return;

            setSpeaking(true);
            try {
                await engineRef.current.speak(text);
            } catch (err) {
                onError?.(err instanceof Error ? err : new Error('Failed to speak'));
            } finally {
                setSpeaking(false);
            }
        },
        [onError],
    );

    const stopSpeaking = useCallback(() => {
        engineRef.current.stopSpeaking();
        setSpeaking(false);
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (recording) {
                engineRef.current.stopAndTranscribe().catch(() => {});
            }
            engineRef.current.stopSpeaking();
        };
    }, [recording]);

    return {
        recording,
        speaking,
        supported,
        recognitionSupported,
        synthesisSupported,
        startRecording,
        stopRecording,
        toggleRecording,
        speak,
        stopSpeaking,
    };
}

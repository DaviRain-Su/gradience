/**
 * Voice engine — speech-to-text + text-to-speech.
 *
 * MVP: Web Speech API (browser built-in, zero dependencies)
 * Future: Whisper.cpp WASM for offline/higher-quality STT
 */

export interface VoiceEngine {
    readonly supported: boolean;
    startRecording(): void;
    stopAndTranscribe(): Promise<string>;
    speak(text: string): Promise<void>;
    stopSpeaking(): void;
    isRecording(): boolean;
}

interface SpeechRecognitionResultEvent {
    results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

interface SpeechRecognitionError {
    error: string;
}

interface SpeechRecognitionLike {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
    onerror: ((event: SpeechRecognitionError) => void) | null;
    onend: (() => void) | null;
    start(): void;
    stop(): void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;
type SpeechGlobals = typeof globalThis & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
};

/**
 * Web Speech API implementation.
 * Works in Chrome, Edge, Safari, and system webviews (Electrobun).
 */
export class WebSpeechVoiceEngine implements VoiceEngine {
    private recognition: SpeechRecognitionLike | null = null;
    private _isRecording = false;
    private _transcriptResolve: ((text: string) => void) | null = null;
    private _transcriptReject: ((err: Error) => void) | null = null;

    get supported(): boolean {
        const speechGlobals = globalThis as SpeechGlobals;
        return typeof speechGlobals.SpeechRecognition !== 'undefined' ||
               typeof speechGlobals.webkitSpeechRecognition !== 'undefined';
    }

    startRecording(): void {
        if (this._isRecording) return;
        if (!this.supported) return;

        const speechGlobals = globalThis as SpeechGlobals;
        const SpeechRecognitionCtor =
            speechGlobals.SpeechRecognition ?? speechGlobals.webkitSpeechRecognition;
        if (!SpeechRecognitionCtor) return;
        this.recognition = new SpeechRecognitionCtor();
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        this.recognition.lang = 'en-US';
        this._isRecording = true;
        this.recognition.start();
    }

    stopAndTranscribe(): Promise<string> {
        return new Promise((resolve, reject) => {
            if (!this.recognition || !this._isRecording) {
                resolve('');
                return;
            }

            this._transcriptResolve = resolve;
            this._transcriptReject = reject;

            this.recognition.onresult = (event: SpeechRecognitionResultEvent) => {
                const transcript = event.results[0]?.[0]?.transcript ?? '';
                this._isRecording = false;
                this._transcriptResolve?.(transcript);
                this._cleanup();
            };

            this.recognition.onerror = (event: SpeechRecognitionError) => {
                this._isRecording = false;
                this._transcriptReject?.(new Error(`Speech recognition error: ${event.error}`));
                this._cleanup();
            };

            this.recognition.onend = () => {
                if (this._isRecording) {
                    this._isRecording = false;
                    this._transcriptResolve?.('');
                    this._cleanup();
                }
            };

            this.recognition.stop();
        });
    }

    speak(text: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (typeof globalThis.speechSynthesis === 'undefined') {
                resolve(); // silently skip if not available
                return;
            }

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 1.0;
            utterance.pitch = 1.0;
            utterance.onend = () => resolve();
            utterance.onerror = (e) => reject(new Error(`TTS error: ${e.error}`));
            globalThis.speechSynthesis.speak(utterance);
        });
    }

    stopSpeaking(): void {
        if (typeof globalThis.speechSynthesis !== 'undefined') {
            globalThis.speechSynthesis.cancel();
        }
    }

    isRecording(): boolean {
        return this._isRecording;
    }

    private _cleanup(): void {
        this._transcriptResolve = null;
        this._transcriptReject = null;
        this.recognition = null;
    }
}

/**
 * Fallback engine when no speech APIs are available (Node.js tests, CI).
 * Returns empty strings, never crashes.
 */
export class NoopVoiceEngine implements VoiceEngine {
    get supported() { return false; }
    startRecording() {}
    async stopAndTranscribe() { return ''; }
    async speak(_text: string) {}
    stopSpeaking() {}
    isRecording() { return false; }
}

/**
 * Create the best available voice engine for the current environment.
 */
export function createVoiceEngine(): VoiceEngine {
    const speechGlobals = globalThis as SpeechGlobals;

    // Browser with Web Speech API
    if (
        typeof speechGlobals.SpeechRecognition !== 'undefined' ||
        typeof speechGlobals.webkitSpeechRecognition !== 'undefined'
    ) {
        return new WebSpeechVoiceEngine();
    }

    // Fallback (Node.js, unsupported browsers)
    return new NoopVoiceEngine();
}

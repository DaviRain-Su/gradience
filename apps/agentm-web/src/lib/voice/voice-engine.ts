/**
 * Voice engine for web — speech-to-text + text-to-speech.
 * Uses Web Speech API (browser built-in)
 */

export interface VoiceEngine {
  readonly provider: 'web_speech' | 'noop';
  readonly supported: boolean;
  startRecording(): void;
  stopAndTranscribe(): Promise<string>;
  speak(text: string): Promise<void>;
  stopSpeaking(): void;
  isRecording(): boolean;
}

interface SpeechRecognitionResultEvent {
  results: ArrayLike<ArrayLike<{ transcript: string; confidence: number }>>;
}

interface SpeechRecognitionError {
  error: string;
  message?: string;
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
  abort(): void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;
type SpeechGlobals = typeof globalThis & {
  SpeechRecognition?: SpeechRecognitionCtor;
  webkitSpeechRecognition?: SpeechRecognitionCtor;
};

/**
 * Check if Web Speech API is supported
 */
export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  const speechGlobals = globalThis as SpeechGlobals;
  return typeof speechGlobals.SpeechRecognition !== 'undefined' ||
         typeof speechGlobals.webkitSpeechRecognition !== 'undefined';
}

/**
 * Check if Speech Synthesis is supported
 */
export function isSpeechSynthesisSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return typeof globalThis.speechSynthesis !== 'undefined';
}

/**
 * Web Speech API implementation.
 * Works in Chrome, Edge, Safari (with varying support).
 */
export class WebSpeechVoiceEngine implements VoiceEngine {
  readonly provider = 'web_speech' as const;
  private recognition: SpeechRecognitionLike | null = null;
  private _isRecording = false;
  private _transcriptResolve: ((text: string) => void) | null = null;
  private _transcriptReject: ((err: Error) => void) | null = null;

  get supported(): boolean {
    return isSpeechRecognitionSupported();
  }

  startRecording(): void {
    if (this._isRecording) return;
    if (!this.supported) {
      console.warn('Speech recognition not supported in this browser');
      return;
    }

    const speechGlobals = globalThis as SpeechGlobals;
    const SpeechRecognitionCtor =
      speechGlobals.SpeechRecognition ?? speechGlobals.webkitSpeechRecognition;
    
    if (!SpeechRecognitionCtor) return;
    
    this.recognition = new SpeechRecognitionCtor();
    this.recognition.continuous = false;
    this.recognition.interimResults = false;
    this.recognition.lang = 'en-US';
    
    // Set up event handlers before starting
    this.recognition.onresult = (event: SpeechRecognitionResultEvent) => {
      const transcript = event.results[0]?.[0]?.transcript ?? '';
      this._isRecording = false;
      this._transcriptResolve?.(transcript);
      this._cleanup();
    };

    this.recognition.onerror = (event: SpeechRecognitionError) => {
      this._isRecording = false;
      // Don't reject on no-speech error, just return empty
      if (event.error === 'no-speech' || event.error === 'aborted') {
        this._transcriptResolve?.('');
      } else {
        this._transcriptReject?.(new Error(`Speech recognition error: ${event.error}`));
      }
      this._cleanup();
    };

    this.recognition.onend = () => {
      if (this._isRecording) {
        this._isRecording = false;
        this._transcriptResolve?.('');
        this._cleanup();
      }
    };

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

      this.recognition.stop();
    });
  }

  speak(text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!isSpeechSynthesisSupported()) {
        resolve(); // silently skip if not available
        return;
      }

      // Cancel any ongoing speech
      globalThis.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      utterance.lang = 'en-US';
      
      utterance.onend = () => resolve();
      utterance.onerror = (e: SpeechSynthesisErrorEvent) => {
        // Don't reject on cancellation
        if (e.error === 'canceled' || e.error === 'interrupted') {
          resolve();
        } else {
          reject(new Error(`TTS error: ${e.error}`));
        }
      };
      
      globalThis.speechSynthesis.speak(utterance);
    });
  }

  stopSpeaking(): void {
    if (isSpeechSynthesisSupported()) {
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
 * Fallback engine when no speech APIs are available.
 * Returns empty strings, never crashes.
 */
export class NoopVoiceEngine implements VoiceEngine {
  readonly provider = 'noop' as const;
  
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
  if (isSpeechRecognitionSupported()) {
    return new WebSpeechVoiceEngine();
  }
  return new NoopVoiceEngine();
}

// Singleton instance
let voiceEngineInstance: VoiceEngine | null = null;

/**
 * Get or create the singleton voice engine instance
 */
export function getVoiceEngine(): VoiceEngine {
  if (!voiceEngineInstance) {
    voiceEngineInstance = createVoiceEngine();
  }
  return voiceEngineInstance;
}

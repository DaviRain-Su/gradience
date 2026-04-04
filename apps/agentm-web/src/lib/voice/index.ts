/**
 * Voice module exports
 */

export {
  createVoiceEngine,
  getVoiceEngine,
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  WebSpeechVoiceEngine,
  NoopVoiceEngine,
} from './voice-engine';

export type { VoiceEngine } from './voice-engine';

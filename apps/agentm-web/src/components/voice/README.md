# Voice Components

Voice input components using Web Speech API for speech-to-text functionality.

## Components

### VoiceButton

Hold-to-record voice button. User holds the button to record speech and releases to transcribe.

```tsx
import { VoiceButton } from './voice/VoiceButton';

<VoiceButton
  onTranscript={(text) => setInputValue(text)}
  onError={(err) => console.error(err)}
  size="md"
/>
```

### VoiceToggleButton

Click-to-toggle voice button. Click once to start recording, click again to stop and transcribe.

```tsx
import { VoiceToggleButton } from './voice/VoiceButton';

<VoiceToggleButton
  onTranscript={(text) => setInputValue(text)}
  onError={(err) => console.error(err)}
  size="md"
/>
```

## Hooks

### useVoice

React hook for voice functionality.

```tsx
import { useVoice } from '@/hooks/useVoice';

const {
  recording,          // Whether currently recording
  speaking,           // Whether currently speaking (TTS)
  supported,          // Whether voice features are supported
  recognitionSupported, // Whether speech recognition is supported
  synthesisSupported,   // Whether speech synthesis is supported
  startRecording,     // Start recording
  stopRecording,      // Stop and get transcript
  toggleRecording,    // Toggle recording state
  speak,              // Speak text using TTS
  stopSpeaking,       // Stop speaking
} = useVoice({
  onTranscript: (text) => console.log('Transcribed:', text),
  onError: (err) => console.error('Error:', err),
});
```

## Browser Support

- **Chrome**: Full support (SpeechRecognition + SpeechSynthesis)
- **Edge**: Full support (SpeechRecognition + SpeechSynthesis)
- **Safari**: Partial support (SpeechSynthesis only, SpeechRecognition requires user gesture)
- **Firefox**: No SpeechRecognition support, SpeechSynthesis only

## Fallback Behavior

If the browser doesn't support Web Speech API, the components will:
- Show a disabled state with a warning icon
- Display a tooltip explaining the limitation
- Not crash or throw errors

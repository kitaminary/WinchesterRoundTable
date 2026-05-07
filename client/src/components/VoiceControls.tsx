import { Mic, MicOff, AlertCircle } from 'lucide-react';

interface VoiceControlsProps {
  micEnabled: boolean;
  isSpeaking: boolean;
  micError: string | null;
  onToggle: () => void;
}

export function VoiceControls({
  micEnabled,
  isSpeaking,
  micError,
  onToggle,
}: VoiceControlsProps) {
  return (
    <div className="voice-controls" onClick={onToggle}>
      <div className="voice-controls-main">
        <button
          className={`voice-button ${micEnabled ? 'active' : ''} ${isSpeaking ? 'speaking' : ''}`}
          aria-label={micEnabled ? 'Disable microphone' : 'Enable microphone'}
        >
          <div className="voice-button-inner">
            {micEnabled ? (
              <Mic className="voice-icon" />
            ) : (
              <MicOff className="voice-icon" />
            )}
          </div>
          {isSpeaking && <div className="voice-speaking-ring" />}
        </button>

        <div className="voice-info">
          <span className="voice-status">
            {micEnabled ? 'Microphone On' : 'Microphone Off'}
          </span>
          <span className="voice-hint">Press V to toggle mic</span>
        </div>
      </div>

      {micError && (
        <div className="voice-error">
          <AlertCircle className="error-icon" />
          <span>{micError}</span>
        </div>
      )}
    </div>
  );
}

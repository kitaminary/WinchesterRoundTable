import { useState, useCallback, useRef, useEffect } from 'react';
import { socket, getSocketId } from '../socket';
import type { User } from '../types';
import { useWakeLock } from './useWakeLock';

interface UseVoiceChatReturn {
  micEnabled: boolean;
  isSpeaking: boolean;
  micError: string | null;
  wakeLockActive: boolean;
  wakeLockUnsupported: boolean;
  toggleMic: () => Promise<void>;
  enableMic: () => Promise<void>;
  disableMic: () => void;
}

// Optional TURN relay. Set VITE_TURN_URL (+ _USERNAME / _CREDENTIAL) in .env to enable.
// Without TURN, peers behind strict NAT or mobile networks may fail to connect.
// If VITE_TURN_URL is empty the connection falls back to STUN-only.
const _TURN_URL = (import.meta.env.VITE_TURN_URL as string | undefined) || '';
const _TURN_USERNAME = (import.meta.env.VITE_TURN_USERNAME as string | undefined) || '';
const _TURN_CREDENTIAL = (import.meta.env.VITE_TURN_CREDENTIAL as string | undefined) || '';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    ...(_TURN_URL
      ? [{ urls: _TURN_URL, username: _TURN_USERNAME, credential: _TURN_CREDENTIAL }]
      : []),
  ],
};

const SPEAKING_THRESHOLD = 15;
const SPEAKING_CHECK_INTERVAL = 100;

export function useVoiceChat(
  users: User[],
  onMicStatusChange: (enabled: boolean) => void,
  onSpeakingStatusChange: (isSpeaking: boolean) => void
): UseVoiceChatReturn {
  const [micEnabled, setMicEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const { wakeLockActive, wakeLockUnsupported, requestWakeLock, releaseWakeLock } = useWakeLock();

  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteAudioRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const speakingIntervalRef = useRef<number | null>(null);
  const lastSpeakingRef = useRef(false);

  const getOtherUsers = useCallback(() => {
    const myId = getSocketId();
    return users.filter((u) => u.id !== myId && u.micEnabled);
  }, [users]);

  const closePeerConnection = useCallback((userId: string) => {
    const pc = peerConnectionsRef.current.get(userId);
    if (pc) {
      pc.close();
      peerConnectionsRef.current.delete(userId);
    }
    const audio = remoteAudioRef.current.get(userId);
    if (audio) {
      audio.srcObject = null;
      remoteAudioRef.current.delete(userId);
    }
  }, []);

  const createPeerConnection = useCallback(
    (targetUserId: string): RTCPeerConnection => {
      const pc = new RTCPeerConnection(ICE_SERVERS);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('voice_ice_candidate', {
            targetUserId,
            candidate: event.candidate.toJSON(),
          });
        }
      };

      pc.ontrack = (event) => {
        let audio = remoteAudioRef.current.get(targetUserId);
        if (!audio) {
          audio = new Audio();
          audio.autoplay = true;
          remoteAudioRef.current.set(targetUserId, audio);
        }
        audio.srcObject = event.streams[0];
        // Browsers may block autoplay without a prior user gesture.
        // Calling play() explicitly satisfies the policy where possible.
        void audio.play().catch(() => {
          // autoplay blocked — audio will start automatically after any user interaction
        });
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed') {
          closePeerConnection(targetUserId);
        }
      };

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
        });
      }

      peerConnectionsRef.current.set(targetUserId, pc);
      return pc;
    },
    [closePeerConnection]
  );

  const closeAllConnections = useCallback(() => {
    peerConnectionsRef.current.forEach((pc, id) => {
      pc.close();
      const audio = remoteAudioRef.current.get(id);
      if (audio) audio.srcObject = null;
    });
    peerConnectionsRef.current.clear();
    remoteAudioRef.current.clear();
  }, []);

  const startSpeakingDetection = useCallback(() => {
    if (!localStreamRef.current) return;
    try {
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(localStreamRef.current);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);

      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      speakingIntervalRef.current = window.setInterval(() => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        const speaking = average > SPEAKING_THRESHOLD;
        if (speaking !== lastSpeakingRef.current) {
          lastSpeakingRef.current = speaking;
          setIsSpeaking(speaking);
          onSpeakingStatusChange(speaking);
        }
      }, SPEAKING_CHECK_INTERVAL);
    } catch {
      console.warn('Failed to start speaking detection');
    }
  }, [onSpeakingStatusChange]);

  const stopSpeakingDetection = useCallback(() => {
    if (speakingIntervalRef.current) {
      clearInterval(speakingIntervalRef.current);
      speakingIntervalRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    lastSpeakingRef.current = false;
    setIsSpeaking(false);
    onSpeakingStatusChange(false);
  }, [onSpeakingStatusChange]);

  const enableMic = useCallback(async () => {
    setMicError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      startSpeakingDetection();

      const otherUsers = getOtherUsers();
      for (const user of otherUsers) {
        const pc = createPeerConnection(user.id);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('voice_offer', { targetUserId: user.id, offer });
      }

      setMicEnabled(true);
      onMicStatusChange(true);
      void requestWakeLock();
    } catch (err) {
      let errorMessage =
        err instanceof Error ? err.message : 'Could not access the microphone.';
      const name =
        err instanceof DOMException ? err.name : err instanceof Error ? err.name : '';
      if (name === 'NotAllowedError') {
        errorMessage = 'Microphone permission was denied.';
      } else if (name === 'NotFoundError') {
        errorMessage = 'No microphone was found on this device.';
      }
      setMicError(errorMessage);
      console.error('Failed to enable microphone:', err);
    }
  }, [getOtherUsers, createPeerConnection, startSpeakingDetection, onMicStatusChange, requestWakeLock]);

  const disableMic = useCallback(() => {
    stopSpeakingDetection();
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    closeAllConnections();
    socket.emit('voice_leave');
    setMicEnabled(false);
    setMicError(null);
    onMicStatusChange(false);
    void releaseWakeLock();
  }, [closeAllConnections, stopSpeakingDetection, onMicStatusChange, releaseWakeLock]);

  const toggleMic = useCallback(async () => {
    if (micEnabled) {
      disableMic();
    } else {
      await enableMic();
    }
  }, [micEnabled, enableMic, disableMic]);

  // WebRTC signalling handlers
  useEffect(() => {
    const handleVoiceOffer = async (data: {
      fromUserId: string;
      offer: RTCSessionDescriptionInit;
    }) => {
      if (!micEnabled) return;
      let pc = peerConnectionsRef.current.get(data.fromUserId);
      if (!pc) pc = createPeerConnection(data.fromUserId);
      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('voice_answer', { targetUserId: data.fromUserId, answer });
    };

    const handleVoiceAnswer = async (data: {
      fromUserId: string;
      answer: RTCSessionDescriptionInit;
    }) => {
      const pc = peerConnectionsRef.current.get(data.fromUserId);
      if (pc) await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
    };

    const handleVoiceIceCandidate = async (data: {
      fromUserId: string;
      candidate: RTCIceCandidateInit;
    }) => {
      const pc = peerConnectionsRef.current.get(data.fromUserId);
      if (pc) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch {
          console.warn('Failed to add ICE candidate');
        }
      }
    };

    const handleVoiceLeave = (data: { userId: string }) => {
      closePeerConnection(data.userId);
    };

    const handleUserLeft = (userId: string) => {
      closePeerConnection(userId);
    };

    socket.on('voice_offer', handleVoiceOffer);
    socket.on('voice_answer', handleVoiceAnswer);
    socket.on('voice_ice_candidate', handleVoiceIceCandidate);
    socket.on('voice_leave', handleVoiceLeave);
    socket.on('user_left', handleUserLeft);

    return () => {
      socket.off('voice_offer', handleVoiceOffer);
      socket.off('voice_answer', handleVoiceAnswer);
      socket.off('voice_ice_candidate', handleVoiceIceCandidate);
      socket.off('voice_leave', handleVoiceLeave);
      socket.off('user_left', handleUserLeft);
    };
  }, [micEnabled, createPeerConnection, closePeerConnection]);

  // Auto-connect to new users with mic enabled
  useEffect(() => {
    if (!micEnabled) return;
    const otherUsers = getOtherUsers();
    for (const user of otherUsers) {
      if (!peerConnectionsRef.current.has(user.id)) {
        const pc = createPeerConnection(user.id);
        pc.createOffer().then(async (offer) => {
          await pc.setLocalDescription(offer);
          socket.emit('voice_offer', { targetUserId: user.id, offer });
        });
      }
    }
  }, [users, micEnabled, getOtherUsers, createPeerConnection]);

  // Cleanup on unmount
  const cleanupRef = useRef<(() => void) | null>(null);
  cleanupRef.current = () => {
    if (speakingIntervalRef.current) {
      clearInterval(speakingIntervalRef.current);
      speakingIntervalRef.current = null;
    }
    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();
    remoteAudioRef.current.forEach((audio) => { audio.srcObject = null; });
    remoteAudioRef.current.clear();
    try { socket.emit('voice_leave'); } catch { /* tab closing */ }
  };

  useEffect(() => {
    return () => { cleanupRef.current?.(); };
  }, []);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (micEnabled) disableMic();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [micEnabled, disableMic]);

  return {
    micEnabled,
    isSpeaking,
    micError,
    wakeLockActive,
    wakeLockUnsupported,
    toggleMic,
    enableMic,
    disableMic,
  };
}

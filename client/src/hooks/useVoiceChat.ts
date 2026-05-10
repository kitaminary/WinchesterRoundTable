import { useState, useCallback, useRef, useEffect } from 'react';
import { socket, getSocketId } from '../socket';
import { playOrQueue } from '../lib/audioUnlock';
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
// If VITE_TURN_URL is empty the connection falls back to public TURN + STUN.
const _TURN_URL = (import.meta.env.VITE_TURN_URL as string | undefined) || '';
const _TURN_USERNAME = (import.meta.env.VITE_TURN_USERNAME as string | undefined) || '';
const _TURN_CREDENTIAL = (import.meta.env.VITE_TURN_CREDENTIAL as string | undefined) || '';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    ...(_TURN_URL
      ? [{ urls: _TURN_URL, username: _TURN_USERNAME, credential: _TURN_CREDENTIAL }]
      : [
          {
            urls: ['turn:openrelay.metered.ca:443', 'turn:openrelay.metered.ca:443?transport=tcp'],
            username: 'openrelayproject',
            credential: 'openrelayproject',
          },
        ]),
  ],
};

const SPEAKING_THRESHOLD = 15;
const SPEAKING_CHECK_INTERVAL = 100;
const RECONNECT_DELAY = 3000;

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
  // Buffer ICE candidates that arrive before remoteDescription is set.
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const speakingIntervalRef = useRef<number | null>(null);
  const lastSpeakingRef = useRef(false);
  const micEnabledRef = useRef(false);

  // Stable refs for values used inside socket handlers (registered once)
  const closePeerConnectionRef = useRef<(userId: string) => void>(() => {});
  const createPeerConnectionRef = useRef<(targetUserId: string) => RTCPeerConnection>(
    null as unknown as (targetUserId: string) => RTCPeerConnection
  );
  const flushPendingCandidatesRef = useRef<(userId: string, pc: RTCPeerConnection) => Promise<void>>(
    async () => {}
  );

  const getOtherUsers = useCallback(() => {
    const myId = getSocketId();
    return users.filter((u) => u.id !== myId);
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
      audio.remove();
      remoteAudioRef.current.delete(userId);
    }
    pendingCandidatesRef.current.delete(userId);
  }, []);

  const flushPendingCandidates = useCallback(async (userId: string, pc: RTCPeerConnection) => {
    const queued = pendingCandidatesRef.current.get(userId);
    if (!queued || queued.length === 0) return;
    pendingCandidatesRef.current.delete(userId);
    for (const c of queued) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(c));
      } catch {
        // candidate may be stale after rollback — ignore silently
      }
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
        console.log('[voice] ontrack from', targetUserId, 'streams:', event.streams.length);
        let audio = remoteAudioRef.current.get(targetUserId);
        if (!audio) {
          audio = document.createElement('audio');
          audio.autoplay = true;
          audio.setAttribute('playsinline', 'true');
          // Attach to DOM — some browsers won't play MediaStream from detached elements.
          audio.style.display = 'none';
          document.body.appendChild(audio);
          remoteAudioRef.current.set(targetUserId, audio);
        }
        audio.srcObject = event.streams[0];
        playOrQueue(audio);
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed') {
          closePeerConnection(targetUserId);
          setTimeout(() => {
            if (!peerConnectionsRef.current.has(targetUserId)) {
              const newPc = createPeerConnection(targetUserId);
              const myId = getSocketId();
              if (myId && myId < targetUserId) {
                newPc.createOffer().then(async (offer) => {
                  await newPc.setLocalDescription(offer);
                  socket.emit('voice_offer', { targetUserId, offer });
                }).catch(() => {});
              }
            }
          }, RECONNECT_DELAY);
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

  // Keep refs in sync so socket handlers (registered once) use latest functions
  closePeerConnectionRef.current = closePeerConnection;
  createPeerConnectionRef.current = createPeerConnection;
  flushPendingCandidatesRef.current = flushPendingCandidates;

  const closeAllConnections = useCallback(() => {
    peerConnectionsRef.current.forEach((pc, id) => {
      pc.close();
      const audio = remoteAudioRef.current.get(id);
      if (audio) {
        audio.srcObject = null;
        audio.remove();
      }
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

      // Add local tracks to existing connections and renegotiate.
      for (const [userId, pc] of peerConnectionsRef.current.entries()) {
        const senders = pc.getSenders();
        const hasTrack = senders.some((s) => s.track);
        if (!hasTrack) {
          stream.getTracks().forEach((track) => {
            pc.addTrack(track, stream);
          });
          try {
            console.log('[voice] sending renegotiation offer to', userId);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit('voice_offer', { targetUserId: userId, offer });
          } catch (err) {
            console.error('[voice] renegotiation failed for', userId, err);
          }
        }
      }

      setMicEnabled(true);
      micEnabledRef.current = true;
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
  }, [startSpeakingDetection, onMicStatusChange, requestWakeLock]);

  const disableMic = useCallback(() => {
    stopSpeakingDetection();
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    closeAllConnections();
    socket.emit('voice_leave');
    setMicEnabled(false);
    micEnabledRef.current = false;
    setMicError(null);
    onMicStatusChange(false);
    void releaseWakeLock();
  }, [closeAllConnections, stopSpeakingDetection, onMicStatusChange, releaseWakeLock]);

  const muteMic = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => { t.enabled = false; });
    setMicEnabled(false);
    micEnabledRef.current = false;
    onMicStatusChange(false);
  }, [onMicStatusChange]);

  const unmuteMic = useCallback(() => {
    if (!localStreamRef.current) return false;
    localStreamRef.current.getTracks().forEach((t) => { t.enabled = true; });
    setMicEnabled(true);
    micEnabledRef.current = true;
    onMicStatusChange(true);
    return true;
  }, [onMicStatusChange]);

  const toggleMic = useCallback(async () => {
    if (micEnabled) {
      if (localStreamRef.current) {
        muteMic();
      } else {
        disableMic();
      }
    } else {
      if (unmuteMic()) return;
      await enableMic();
    }
  }, [micEnabled, enableMic, disableMic, muteMic, unmuteMic]);

  // WebRTC signalling handlers — registered ONCE (empty deps).
  // Use refs to access latest closePeerConnection / createPeerConnection.
  useEffect(() => {
    const handleVoiceOffer = async (data: {
      fromUserId: string;
      offer: RTCSessionDescriptionInit;
    }) => {
      console.log('[voice] received offer from', data.fromUserId);
      let pc = peerConnectionsRef.current.get(data.fromUserId);

      // Glare resolution: both sides sent offers simultaneously
      if (pc && pc.signalingState === 'have-local-offer') {
        const myId = getSocketId();
        if (myId && myId > data.fromUserId) {
          return;
        }
        await pc.setLocalDescription({ type: 'rollback' });
      }

      if (!pc) pc = createPeerConnectionRef.current(data.fromUserId);
      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
      await flushPendingCandidatesRef.current(data.fromUserId, pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('voice_answer', { targetUserId: data.fromUserId, answer });
    };

    const handleVoiceAnswer = async (data: {
      fromUserId: string;
      answer: RTCSessionDescriptionInit;
    }) => {
      console.log('[voice] received answer from', data.fromUserId);
      const pc = peerConnectionsRef.current.get(data.fromUserId);
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        await flushPendingCandidatesRef.current(data.fromUserId, pc);
      }
    };

    const handleVoiceIceCandidate = async (data: {
      fromUserId: string;
      candidate: RTCIceCandidateInit;
    }) => {
      console.log('[voice] received ICE from', data.fromUserId);
      const pc = peerConnectionsRef.current.get(data.fromUserId);
      // Queue candidates that arrive before remoteDescription is set.
      if (!pc || !pc.remoteDescription || !pc.remoteDescription.type) {
        const queue = pendingCandidatesRef.current.get(data.fromUserId) ?? [];
        queue.push(data.candidate);
        pendingCandidatesRef.current.set(data.fromUserId, queue);
        return;
      }
      try {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch {
        // candidate may have become stale (e.g. after rollback) — ignore
      }
    };

    const handleVoiceLeave = (data: { userId: string }) => {
      closePeerConnectionRef.current(data.userId);
    };

    const handleUserLeft = (userId: string) => {
      closePeerConnectionRef.current(userId);
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-connect to every other user as soon as they appear in the room.
  // Mic state is irrelevant — connections exist regardless, tracks are
  // added later via renegotiation in enableMic.
  useEffect(() => {
    const myId = getSocketId();
    const otherUsers = getOtherUsers();
    for (const user of otherUsers) {
      if (!peerConnectionsRef.current.has(user.id)) {
        const pc = createPeerConnection(user.id);
        // Deterministic offerer: only the lower socket ID initiates.
        // The other side will receive the offer and answer.
        if (myId && myId < user.id) {
          console.log('[voice] sending offer to', user.id);
          pc.createOffer().then(async (offer) => {
            await pc.setLocalDescription(offer);
            socket.emit('voice_offer', { targetUserId: user.id, offer });
          }).catch((err) => console.error('[voice] offer failed:', err));
        }
      }
    }
  }, [users, getOtherUsers, createPeerConnection]);

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
    remoteAudioRef.current.forEach((audio) => {
      audio.srcObject = null;
      audio.remove();
    });
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

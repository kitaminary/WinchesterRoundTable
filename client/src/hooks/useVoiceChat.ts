import { useState, useCallback, useRef, useEffect } from 'react';
import { socket, getSocketId } from '../socket';
import { playOrQueue, isUnlocked, unlockAudio } from '../lib/audioUnlock';
import type { User } from '../types';

export interface UseVoiceChatReturn {
  micEnabled: boolean;
  isSpeaking: boolean;
  micError: string | null;
  audioBlocked: boolean;
  toggleMic: () => Promise<void>;
  enableMic: () => Promise<void>;
  disableMic: () => void;
  retryAudio: () => void;
}

const DEV = import.meta.env.DEV;

function buildIceConfig(): RTCConfiguration {
  const iceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];

  const turnUrl = import.meta.env.VITE_TURN_URL?.trim();
  const turnUser = import.meta.env.VITE_TURN_USERNAME?.trim();
  const turnCred = import.meta.env.VITE_TURN_CREDENTIAL?.trim();

  if (turnUrl && turnUser && turnCred) {
    const urls = turnUrl.split(',').map((u) => u.trim()).filter(Boolean);
    iceServers.push({ urls, username: turnUser, credential: turnCred });
    if (DEV) {
      console.log('[voice] TURN configured:', urls.map((u) => u.replace(/:[^:]+$/, ':****')));
    }
  } else if (DEV) {
    console.warn(
      '[voice] TURN is not configured; WebRTC may fail across NAT/mobile networks. ' +
      'Set VITE_TURN_URL, VITE_TURN_USERNAME, VITE_TURN_CREDENTIAL in .env.'
    );
  }

  return { iceServers };
}

const ICE_CONFIG = buildIceConfig();

const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

const SPEAKING_THRESHOLD = 15;
const SPEAKING_CHECK_INTERVAL = 100;

interface PeerState {
  pc: RTCPeerConnection;
  candidateQueue: RTCIceCandidateInit[];
  makingOffer: boolean;
  remoteCtx: AudioContext | null;
}

function playRemoteStream(stream: MediaStream, audio: HTMLAudioElement, targetUserId: string): void {
  // Primary path: HTMLAudioElement with srcObject
  audio.srcObject = stream;
  audio.muted = false;

  playOrQueue(audio);

  // Secondary path: AudioContext routing bypasses autoplay policy once context is resumed.
  // We keep both — HTMLAudioElement is the audible output, AudioContext is a
  // belt-and-suspenders approach that also forces the browser to pull samples.
  try {
    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(stream);
    src.connect(ctx.destination);
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    if (DEV) console.log(`[voice] AudioContext routing active for ${targetUserId}, state=${ctx.state}`);
  } catch (err) {
    if (DEV) console.warn(`[voice] AudioContext routing failed for ${targetUserId}:`, err);
  }
}

export function useVoiceChat(
  users: User[],
  onMicStatusChange: (enabled: boolean) => void,
  onSpeakingStatusChange: (isSpeaking: boolean) => void
): UseVoiceChatReturn {
  const [micEnabled, setMicEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [audioBlocked, setAudioBlocked] = useState(false);

  const micEnabledRef = useRef(false);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef(new Map<string, PeerState>());
  const remoteAudioRef = useRef(new Map<string, HTMLAudioElement>());
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const speakingIntervalRef = useRef<number | null>(null);
  const lastSpeakingRef = useRef(false);
  const usersRef = useRef(users);
  usersRef.current = users;
  const onMicRef = useRef(onMicStatusChange);
  onMicRef.current = onMicStatusChange;
  const onSpeakingRef = useRef(onSpeakingStatusChange);
  onSpeakingRef.current = onSpeakingStatusChange;

  // ─── peer helpers ─────────────────────────────────────────

  const closePeer = useCallback((userId: string) => {
    const peer = peersRef.current.get(userId);
    if (peer) {
      peer.pc.close();
      if (peer.remoteCtx) {
        peer.remoteCtx.close().catch(() => {});
      }
      peersRef.current.delete(userId);
    }
    const audio = remoteAudioRef.current.get(userId);
    if (audio) {
      audio.pause();
      audio.srcObject = null;
      audio.remove();
      remoteAudioRef.current.delete(userId);
    }
  }, []);

  const createPeer = useCallback((targetUserId: string): PeerState => {
    const existing = peersRef.current.get(targetUserId);
    if (existing) return existing;

    const pc = new RTCPeerConnection(ICE_CONFIG);
    const state: PeerState = { pc, candidateQueue: [], makingOffer: false, remoteCtx: null };

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit('voice_ice_candidate', {
          targetUserId,
          candidate: e.candidate.toJSON(),
        });
      }
    };

    pc.ontrack = (e) => {
      if (DEV) {
        console.log(
          `[voice] ontrack from ${targetUserId}: kind=${e.track.kind}`,
          `streams=${e.streams.length}`,
          `stream[0] active=${e.streams[0]?.active}`,
          `track.readyState=${e.track.readyState}`
        );
      }

      // Chrome may deliver ontrack with an empty streams array.
      // Build a fresh MediaStream from the track itself.
      const stream = e.streams[0]?.active
        ? e.streams[0]
        : new MediaStream([e.track]);

      let audio = remoteAudioRef.current.get(targetUserId);
      if (!audio) {
        audio = new Audio();
        audio.autoplay = true;
        audio.setAttribute('playsinline', '');
        document.body.appendChild(audio);
        remoteAudioRef.current.set(targetUserId, audio);
      }

      playRemoteStream(stream, audio, targetUserId);

      if (!isUnlocked()) {
        if (DEV) console.warn('[voice] audio.play() likely blocked by autoplay policy');
        setAudioBlocked(true);
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (DEV) console.log(`[voice] ${targetUserId} iceConnection: ${pc.iceConnectionState}`);
    };

    pc.onconnectionstatechange = () => {
      if (DEV) console.log(`[voice] ${targetUserId} connection: ${pc.connectionState}`);
      if (pc.connectionState === 'failed') {
        if (DEV) console.warn(`[voice] ${targetUserId} ICE restart triggered`);
        pc.restartIce();
      }
    };

    if (DEV) {
      pc.onsignalingstatechange = () => {
        console.log(`[voice] ${targetUserId} signaling: ${pc.signalingState}`);
      };
    }

    peersRef.current.set(targetUserId, state);
    return state;
  }, []);

  const drainQueue = useCallback(async (peer: PeerState) => {
    for (const c of peer.candidateQueue) {
      try {
        await peer.pc.addIceCandidate(new RTCIceCandidate(c));
      } catch { /* stale candidate */ }
    }
    peer.candidateQueue = [];
  }, []);

  const sendOffer = useCallback(async (userId: string, peer: PeerState) => {
    try {
      peer.makingOffer = true;
      const offer = await peer.pc.createOffer();
      if (peer.pc.signalingState !== 'stable') return;
      await peer.pc.setLocalDescription(offer);
      socket.emit('voice_offer', {
        targetUserId: userId,
        offer: peer.pc.localDescription!,
      });
    } catch (err) {
      console.error('[voice] sendOffer failed:', err);
    } finally {
      peer.makingOffer = false;
    }
  }, []);

  // ─── audio unlock retry ──────────────────────────────────

  const retryAudio = useCallback(() => {
    unlockAudio();
    for (const audio of remoteAudioRef.current.values()) {
      if (audio.srcObject && audio.paused) {
        audio.play().then(() => {
          if (DEV) console.log('[voice] retryAudio play() succeeded');
        }).catch((err) => {
          if (DEV) console.warn('[voice] retryAudio play() failed:', err);
        });
      }
    }
    setAudioBlocked(false);
  }, []);

  // ─── speaking detection ───────────────────────────────────

  const startSpeakingDetection = useCallback(() => {
    if (!localStreamRef.current) return;
    try {
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(
        localStreamRef.current
      );
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);
      const buf = new Uint8Array(analyserRef.current.frequencyBinCount);

      speakingIntervalRef.current = window.setInterval(() => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(buf);
        const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
        const speaking = avg > SPEAKING_THRESHOLD;
        if (speaking !== lastSpeakingRef.current) {
          lastSpeakingRef.current = speaking;
          setIsSpeaking(speaking);
          onSpeakingRef.current(speaking);
        }
      }, SPEAKING_CHECK_INTERVAL);
    } catch {
      console.warn('[voice] speaking detection failed');
    }
  }, []);

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
    onSpeakingRef.current(false);
  }, []);

  // ─── mic controls ────────────────────────────────────────

  const enableMic = useCallback(async () => {
    setMicError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: AUDIO_CONSTRAINTS,
      });
      localStreamRef.current = stream;
      micEnabledRef.current = true;
      const track = stream.getAudioTracks()[0];

      unlockAudio();
      setAudioBlocked(false);

      for (const [userId, peer] of peersRef.current) {
        const audioT = peer.pc
          .getTransceivers()
          .find(
            (t) =>
              t.receiver.track?.kind === 'audio' ||
              t.sender.track?.kind === 'audio' ||
              t.sender.track === null
          );

        if (audioT) {
          await audioT.sender.replaceTrack(track);
          if (audioT.direction === 'recvonly') {
            audioT.direction = 'sendrecv';
            await sendOffer(userId, peer);
          }
        } else {
          peer.pc.addTrack(track, stream);
          await sendOffer(userId, peer);
        }
      }

      const myId = getSocketId();
      for (const user of usersRef.current) {
        if (user.id === myId || peersRef.current.has(user.id)) continue;
        const peer = createPeer(user.id);
        peer.pc.addTrack(track, stream);
        await sendOffer(user.id, peer);
      }

      startSpeakingDetection();
      setMicEnabled(true);
      onMicRef.current(true);
    } catch (err) {
      let msg =
        err instanceof Error
          ? err.message
          : 'Could not access the microphone.';
      const name =
        err instanceof DOMException
          ? err.name
          : err instanceof Error
            ? err.name
            : '';
      if (name === 'NotAllowedError') {
        msg =
          'Microphone permission was denied. Allow access in the browser, or use HTTPS (ngrok) or localhost.';
      } else if (name === 'NotFoundError') {
        msg = 'No microphone was found on this device.';
      }
      setMicError(msg);
      console.error('[voice] mic enable failed:', err);
    }
  }, [createPeer, sendOffer, startSpeakingDetection]);

  const disableMic = useCallback(() => {
    stopSpeakingDetection();

    for (const [, peer] of peersRef.current) {
      for (const sender of peer.pc.getSenders()) {
        if (sender.track?.kind === 'audio') {
          sender.replaceTrack(null).catch(() => {});
        }
      }
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }

    micEnabledRef.current = false;
    setMicEnabled(false);
    setMicError(null);
    onMicRef.current(false);
  }, [stopSpeakingDetection]);

  const toggleMic = useCallback(async () => {
    if (micEnabledRef.current) disableMic();
    else await enableMic();
  }, [enableMic, disableMic]);

  // ─── signaling (registered once) ─────────────────────────

  useEffect(() => {
    const polite = (peerId: string) => (getSocketId() ?? '') < peerId;

    const onOffer = async (data: {
      fromUserId: string;
      offer: RTCSessionDescriptionInit;
    }) => {
      if (data.fromUserId === getSocketId()) return;
      try {
        let peer = peersRef.current.get(data.fromUserId);

        if (peer) {
          const collision =
            peer.makingOffer || peer.pc.signalingState !== 'stable';
          if (collision) {
            if (!polite(data.fromUserId)) return;
            await peer.pc.setLocalDescription({ type: 'rollback' });
          }
        } else {
          peer = createPeer(data.fromUserId);
        }

        await peer.pc.setRemoteDescription(data.offer);
        await drainQueue(peer);

        if (localStreamRef.current) {
          const track = localStreamRef.current.getAudioTracks()[0];
          const audioT = peer.pc
            .getTransceivers()
            .find((t) => t.receiver.track?.kind === 'audio');
          if (audioT && track) {
            audioT.direction = 'sendrecv';
            await audioT.sender.replaceTrack(track);
          }
        }

        const answer = await peer.pc.createAnswer();
        await peer.pc.setLocalDescription(answer);
        socket.emit('voice_answer', {
          targetUserId: data.fromUserId,
          answer: peer.pc.localDescription!,
        });
      } catch (err) {
        console.error('[voice] onOffer error:', err);
      }
    };

    const onAnswer = async (data: {
      fromUserId: string;
      answer: RTCSessionDescriptionInit;
    }) => {
      try {
        const peer = peersRef.current.get(data.fromUserId);
        if (!peer) return;
        await peer.pc.setRemoteDescription(data.answer);
        await drainQueue(peer);
      } catch (err) {
        console.error('[voice] onAnswer error:', err);
      }
    };

    const onIceCandidate = async (data: {
      fromUserId: string;
      candidate: RTCIceCandidateInit;
    }) => {
      const peer = peersRef.current.get(data.fromUserId);
      if (!peer) return;
      if (!peer.pc.remoteDescription) {
        peer.candidateQueue.push(data.candidate);
        return;
      }
      try {
        await peer.pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch {
        /* stale candidate */
      }
    };

    const onPeerReady = (data: { userId: string }) => {
      if (data.userId === getSocketId()) return;
      if (!micEnabledRef.current || !localStreamRef.current) return;
      if (peersRef.current.has(data.userId)) return;
      const peer = createPeer(data.userId);
      const track = localStreamRef.current.getAudioTracks()[0];
      if (track) peer.pc.addTrack(track, localStreamRef.current);
      sendOffer(data.userId, peer);
    };

    const onLeave = (data: { userId: string }) => closePeer(data.userId);
    const onUserLeft = (userId: string) => closePeer(userId);

    const emitJoin = () =>
      socket.emit('voice_join', { passive: !micEnabledRef.current });
    if (socket.connected) emitJoin();
    socket.on('connect', emitJoin);

    socket.on('voice_offer', onOffer);
    socket.on('voice_answer', onAnswer);
    socket.on('voice_ice_candidate', onIceCandidate);
    socket.on('voice_peer_ready', onPeerReady);
    socket.on('voice_leave', onLeave);
    socket.on('user_left', onUserLeft);

    return () => {
      socket.off('connect', emitJoin);
      socket.off('voice_offer', onOffer);
      socket.off('voice_answer', onAnswer);
      socket.off('voice_ice_candidate', onIceCandidate);
      socket.off('voice_peer_ready', onPeerReady);
      socket.off('voice_leave', onLeave);
      socket.off('user_left', onUserLeft);
    };
  }, [createPeer, closePeer, drainQueue, sendOffer]);

  // ─── auto-connect new users when mic is on ────────────────

  useEffect(() => {
    const currentIds = new Set(users.map((u) => u.id));
    for (const userId of peersRef.current.keys()) {
      if (!currentIds.has(userId)) closePeer(userId);
    }

    if (!micEnabledRef.current || !localStreamRef.current) return;
    const myId = getSocketId();
    const track = localStreamRef.current.getAudioTracks()[0];
    if (!track) return;

    for (const user of users) {
      if (user.id === myId || peersRef.current.has(user.id)) continue;
      const peer = createPeer(user.id);
      peer.pc.addTrack(track, localStreamRef.current!);
      sendOffer(user.id, peer);
    }
  }, [users, createPeer, closePeer, sendOffer]);

  // ─── cleanup ─────────────────────────────────────────────

  const cleanupRef = useRef<(() => void) | null>(null);
  cleanupRef.current = () => {
    if (speakingIntervalRef.current) clearInterval(speakingIntervalRef.current);
    if (audioContextRef.current) void audioContextRef.current.close();
    if (localStreamRef.current)
      localStreamRef.current.getTracks().forEach((t) => t.stop());
    peersRef.current.forEach((p) => {
      p.pc.close();
      if (p.remoteCtx) p.remoteCtx.close().catch(() => {});
    });
    peersRef.current.clear();
    remoteAudioRef.current.forEach((a) => {
      a.pause();
      a.srcObject = null;
      a.remove();
    });
    remoteAudioRef.current.clear();
    try {
      socket.emit('voice_leave');
    } catch {
      /* tab closing */
    }
  };

  useEffect(() => () => cleanupRef.current?.(), []);

  useEffect(() => {
    const h = () => cleanupRef.current?.();
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, []);

  return { micEnabled, isSpeaking, micError, audioBlocked, toggleMic, enableMic, disableMic, retryAudio };
}

import { useState, useEffect, useRef, useCallback } from 'react';
import Peer, { type MediaConnection, type DataConnection } from 'peerjs';
import { RemotePeer, ChatMessage, ConnectionStatus } from '../types';
import { createAudioMeter } from '../utils/audioAnalyser';
import { acquireUserMedia } from '../utils/mediaUtils';

interface UsePeerRoomProps {
  roomId: string;
  userName: string;
  initialAudioMuted?: boolean;
  initialVideoMuted?: boolean;
}

interface PeerMessage {
  type: 'peer_list' | 'user_info' | 'chat' | 'status_update';
  peers?: string[];
  userId?: string;
  userName?: string;
  isAudioMuted?: boolean;
  isVideoMuted?: boolean;
  isScreenSharing?: boolean;
  chatMessage?: ChatMessage;
}

export function usePeerRoom({
  roomId,
  userName,
  initialAudioMuted = false,
  initialVideoMuted = false,
}: UsePeerRoomProps) {
  const [peerId, setPeerId] = useState<string>('');
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Local media stream and controls
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState(initialAudioMuted);
  const [isVideoMuted, setIsVideoMuted] = useState(initialVideoMuted);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [localVolume, setLocalVolume] = useState(0);
  const [isLocalSpeaking, setIsLocalSpeaking] = useState(false);
  const [hasCameraHardware, setHasCameraHardware] = useState(true);
  const [hasMicHardware, setHasMicHardware] = useState(true);

  // Remote participants
  const [remotePeers, setRemotePeers] = useState<Map<string, RemotePeer>>(new Map());

  // Chat messages
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  // Internal refs to keep track of active connections and streams
  const peerRef = useRef<Peer | null>(null);
  const activeCallsRef = useRef<Map<string, MediaConnection>>(new Map());
  const activeDataConsRef = useRef<Map<string, DataConnection>>(new Map());
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null);
  const micTrackRef = useRef<MediaStreamTrack | null>(null);
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);
  const localAudioCleanupRef = useRef<(() => void) | null>(null);
  const remoteAudioCleanupsRef = useRef<Map<string, () => void>>(new Map());
  const isHostRef = useRef<boolean>(false);
  const knownPeerIdsRef = useRef<Set<string>>(new Set());

  // Helper to safely broadcast data message to all active data connections
  const broadcast = useCallback((msg: PeerMessage) => {
    activeDataConsRef.current.forEach((conn) => {
      if (conn.open) {
        try {
          conn.send(msg);
        } catch (err) {
          console.warn('Error broadcasting message to peer:', err);
        }
      }
    });
  }, []);

  // Initialize local media
  useEffect(() => {
    let mounted = true;

    async function initMedia() {
      const res = await acquireUserMedia();
      if (!mounted) return;

      setLocalStream(res.stream);
      setHasCameraHardware(res.hasVideo);
      setHasMicHardware(res.hasAudio);

      const videoTrack = res.stream.getVideoTracks()[0] || null;
      const audioTrack = res.stream.getAudioTracks()[0] || null;

      cameraTrackRef.current = videoTrack;
      micTrackRef.current = audioTrack;

      if (videoTrack) {
        videoTrack.enabled = !initialVideoMuted && res.hasVideo;
      }
      if (audioTrack) {
        audioTrack.enabled = !initialAudioMuted && res.hasAudio;
      }

      // Attach audio meter for local volume indicator
      localAudioCleanupRef.current = createAudioMeter(res.stream, (volume, isSpeaking) => {
        if (!mounted) return;
        setLocalVolume(volume);
        setIsLocalSpeaking(isSpeaking);
      });
    }

    initMedia();

    return () => {
      mounted = false;
      if (localAudioCleanupRef.current) {
        localAudioCleanupRef.current();
      }
    };
  }, [initialAudioMuted, initialVideoMuted]);

  // Hook up remote audio meter
  const attachRemoteAudioMeter = useCallback((remoteId: string, stream: MediaStream) => {
    const existing = remoteAudioCleanupsRef.current.get(remoteId);
    if (existing) existing();

    const cleanup = createAudioMeter(stream, (volume, isSpeaking) => {
      setRemotePeers((prev) => {
        const peer = prev.get(remoteId);
        if (!peer) return prev;
        if (peer.volumeLevel === volume && peer.isSpeaking === isSpeaking) return prev;
        const updated = new Map(prev);
        updated.set(remoteId, { ...peer, volumeLevel: volume, isSpeaking });
        return updated;
      });
    });

    remoteAudioCleanupsRef.current.set(remoteId, cleanup);
  }, []);

  // Handle incoming data connection
  const setupDataConnection = useCallback((conn: DataConnection) => {
    activeDataConsRef.current.set(conn.peer, conn);

    conn.on('open', () => {
      // Send our user info
      conn.send({
        type: 'user_info',
        userId: peerRef.current?.id || '',
        userName,
        isAudioMuted,
        isVideoMuted,
        isScreenSharing,
      });

      // If we are the room host, send the known peer list to the new peer
      if (isHostRef.current) {
        knownPeerIdsRef.current.add(conn.peer);
        const peersList = Array.from(knownPeerIdsRef.current);
        conn.send({
          type: 'peer_list',
          peers: peersList,
        });
      }
    });

    conn.on('data', (data: unknown) => {
      const msg = data as PeerMessage;
      if (!msg) return;

      if (msg.type === 'peer_list' && msg.peers) {
        // Connect to any peer we don't have an active call with yet
        msg.peers.forEach((id) => {
          if (id !== peerRef.current?.id && !activeCallsRef.current.has(id)) {
            connectToPeer(id);
          }
        });
      } else if (msg.type === 'user_info' || msg.type === 'status_update') {
        setRemotePeers((prev) => {
          const updated = new Map(prev);
          const existing = updated.get(conn.peer) || {
            id: conn.peer,
            name: msg.userName || `User ${conn.peer.slice(-4)}`,
            isAudioMuted: false,
            isVideoMuted: false,
            isScreenSharing: false,
            volumeLevel: 0,
            isSpeaking: false,
          };

          updated.set(conn.peer, {
            ...existing,
            name: msg.userName !== undefined ? msg.userName : existing.name,
            isAudioMuted: msg.isAudioMuted !== undefined ? msg.isAudioMuted : existing.isAudioMuted,
            isVideoMuted: msg.isVideoMuted !== undefined ? msg.isVideoMuted : existing.isVideoMuted,
            isScreenSharing: msg.isScreenSharing !== undefined ? msg.isScreenSharing : existing.isScreenSharing,
          });
          return updated;
        });
      } else if (msg.type === 'chat' && msg.chatMessage) {
        setChatMessages((prev) => [...prev, msg.chatMessage!]);
      }
    });

    conn.on('close', () => {
      activeDataConsRef.current.delete(conn.peer);
      knownPeerIdsRef.current.delete(conn.peer);
    });
  }, [userName, isAudioMuted, isVideoMuted, isScreenSharing]);

  // Handle incoming media call
  const setupMediaCall = useCallback((call: MediaConnection, streamToAnswer: MediaStream) => {
    activeCallsRef.current.set(call.peer, call);

    call.answer(streamToAnswer);

    call.on('stream', (remoteStream) => {
      setRemotePeers((prev) => {
        const updated = new Map(prev);
        const existing = updated.get(call.peer) || {
          id: call.peer,
          name: `User ${call.peer.slice(-4)}`,
          isAudioMuted: false,
          isVideoMuted: false,
          isScreenSharing: false,
          volumeLevel: 0,
          isSpeaking: false,
        };
        updated.set(call.peer, {
          ...existing,
          stream: remoteStream,
        });
        return updated;
      });

      attachRemoteAudioMeter(call.peer, remoteStream);
    });

    call.on('close', () => {
      activeCallsRef.current.delete(call.peer);
      const audioCleanup = remoteAudioCleanupsRef.current.get(call.peer);
      if (audioCleanup) {
        audioCleanup();
        remoteAudioCleanupsRef.current.delete(call.peer);
      }
      setRemotePeers((prev) => {
        const updated = new Map(prev);
        updated.delete(call.peer);
        return updated;
      });
    });
  }, [attachRemoteAudioMeter]);

  // Connect to an existing remote peer
  const connectToPeer = useCallback((targetPeerId: string) => {
    if (!peerRef.current || !localStream || targetPeerId === peerRef.current.id) return;
    if (activeCallsRef.current.has(targetPeerId)) return;

    // 1. Establish DataConnection
    const conn = peerRef.current.connect(targetPeerId, {
      reliable: true,
    });
    setupDataConnection(conn);

    // 2. Establish Media Call
    const call = peerRef.current.call(targetPeerId, localStream);
    activeCallsRef.current.set(targetPeerId, call);

    call.on('stream', (remoteStream) => {
      setRemotePeers((prev) => {
        const updated = new Map(prev);
        const existing = updated.get(targetPeerId) || {
          id: targetPeerId,
          name: `User ${targetPeerId.slice(-4)}`,
          isAudioMuted: false,
          isVideoMuted: false,
          isScreenSharing: false,
          volumeLevel: 0,
          isSpeaking: false,
        };
        updated.set(targetPeerId, {
          ...existing,
          stream: remoteStream,
        });
        return updated;
      });

      attachRemoteAudioMeter(targetPeerId, remoteStream);
    });

    call.on('close', () => {
      activeCallsRef.current.delete(targetPeerId);
      const cleanup = remoteAudioCleanupsRef.current.get(targetPeerId);
      if (cleanup) {
        cleanup();
        remoteAudioCleanupsRef.current.delete(targetPeerId);
      }
      setRemotePeers((prev) => {
        const updated = new Map(prev);
        updated.delete(targetPeerId);
        return updated;
      });
    });
  }, [localStream, setupDataConnection, attachRemoteAudioMeter]);

  // Connect PeerJS client to default public broker
  useEffect(() => {
    if (!localStream) return;

    let isDestroyed = false;
    const cleanRoom = roomId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const hostPeerId = `senvibe-room-${cleanRoom}-host`;
    const randomSuffix = Math.random().toString(36).substring(2, 7);
    const guestPeerId = `senvibe-room-${cleanRoom}-${randomSuffix}`;

    // Attempt to register either as the room host, or if already taken, as a guest
    function createPeerInstance(idToTry: string, isHostAttempt: boolean) {
      if (isDestroyed) return;

      const peer = new Peer(idToTry, {
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' },
          ],
        },
      });

      peerRef.current = peer;

      peer.on('open', (id) => {
        if (isDestroyed) return;
        setPeerId(id);
        setStatus('connected');
        isHostRef.current = isHostAttempt;
        knownPeerIdsRef.current.add(id);

        // If we are guest, immediately call & connect to the host!
        if (!isHostAttempt) {
          connectToPeer(hostPeerId);
        }
      });

      peer.on('call', (incomingCall) => {
        if (isDestroyed || !localStream) return;
        setupMediaCall(incomingCall, localStream);
      });

      peer.on('connection', (incomingConn) => {
        if (isDestroyed) return;
        setupDataConnection(incomingConn);
      });

      peer.on('error', (err: { type?: string; message?: string }) => {
        console.warn('PeerJS event:', err.type, err.message);

        // If host ID is already taken, safely register as guest peer
        if (isHostAttempt && err.type === 'unavailable-id') {
          peer.destroy();
          createPeerInstance(guestPeerId, false);
          return;
        }

        if (err.type === 'peer-unavailable') {
          // Normal when searching for room host
          return;
        }

        if (err.type === 'network' || err.type === 'disconnected') {
          setStatus('reconnecting');
        } else {
          setErrorMessage(err.message || 'Connection issue encountered');
        }
      });

      peer.on('disconnected', () => {
        setStatus('reconnecting');
        peer.reconnect();
      });

      peer.on('close', () => {
        setStatus('disconnected');
      });
    }

    createPeerInstance(hostPeerId, true);

    return () => {
      isDestroyed = true;
      // Stop all tracks
      if (screenTrackRef.current) {
        screenTrackRef.current.stop();
      }
      activeCallsRef.current.forEach((call) => call.close());
      activeCallsRef.current.clear();
      activeDataConsRef.current.forEach((conn) => conn.close());
      activeDataConsRef.current.clear();

      remoteAudioCleanupsRef.current.forEach((cleanup) => cleanup());
      remoteAudioCleanupsRef.current.clear();

      if (peerRef.current) {
        peerRef.current.destroy();
        peerRef.current = null;
      }
    };
  }, [roomId, localStream]);

  // Toggle Audio (Mute / Unmute)
  const toggleAudio = useCallback(() => {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      const newMutedState = !isAudioMuted;
      audioTrack.enabled = !newMutedState;
      setIsAudioMuted(newMutedState);

      broadcast({
        type: 'status_update',
        userId: peerRef.current?.id,
        isAudioMuted: newMutedState,
      });
    }
  }, [localStream, isAudioMuted, broadcast]);

  // Toggle Video (Camera On / Off)
  const toggleVideo = useCallback(() => {
    if (!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      const newMutedState = !isVideoMuted;
      videoTrack.enabled = !newMutedState;
      setIsVideoMuted(newMutedState);

      broadcast({
        type: 'status_update',
        userId: peerRef.current?.id,
        isVideoMuted: newMutedState,
      });
    }
  }, [localStream, isVideoMuted, broadcast]);

  // Lagless Screen Share Toggle using RTCRtpSender.replaceTrack
  const toggleScreenShare = useCallback(async () => {
    if (!localStream) return;

    if (isScreenSharing) {
      // STOP SCREEN SHARE: switch back to camera track
      const camTrack = cameraTrackRef.current;
      if (screenTrackRef.current) {
        screenTrackRef.current.stop();
        screenTrackRef.current = null;
      }

      if (camTrack) {
        // Replace in RTCRtpSenders
        activeCallsRef.current.forEach((call) => {
          const senders = call.peerConnection?.getSenders() || [];
          const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
          if (videoSender) {
            videoSender.replaceTrack(camTrack).catch(console.error);
          }
        });

        // Replace in local stream
        const currentVideo = localStream.getVideoTracks()[0];
        if (currentVideo) {
          localStream.removeTrack(currentVideo);
        }
        localStream.addTrack(camTrack);
      }

      setIsScreenSharing(false);
      broadcast({
        type: 'status_update',
        userId: peerRef.current?.id,
        isScreenSharing: false,
      });
    } else {
      // START SCREEN SHARE
      try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            frameRate: { ideal: 30, max: 60 },
          },
          audio: true,
        });

        const screenTrack = displayStream.getVideoTracks()[0];
        if (!screenTrack) return;

        screenTrackRef.current = screenTrack;

        // Automatically revert back if user stops sharing via browser's built-in floating pill
        screenTrack.onended = () => {
          toggleScreenShare();
        };

        // Instant lagless track replacement across all active WebRTC senders
        activeCallsRef.current.forEach((call) => {
          const senders = call.peerConnection?.getSenders() || [];
          const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
          if (videoSender) {
            videoSender.replaceTrack(screenTrack).catch(console.error);
          }
        });

        // Update local stream
        const currentVideo = localStream.getVideoTracks()[0];
        if (currentVideo) {
          localStream.removeTrack(currentVideo);
        }
        localStream.addTrack(screenTrack);

        setIsScreenSharing(true);
        broadcast({
          type: 'status_update',
          userId: peerRef.current?.id,
          isScreenSharing: true,
        });
      } catch (err) {
        console.warn('Screen share canceled or denied:', err);
      }
    }
  }, [localStream, isScreenSharing, broadcast]);

  // Switch video input device (Camera)
  const switchCameraDevice = useCallback(async (deviceId: string) => {
    if (!localStream) return;
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });

      const newTrack = newStream.getVideoTracks()[0];
      if (!newTrack) return;

      cameraTrackRef.current = newTrack;

      // If not currently screen sharing, replace the video sender track immediately
      if (!isScreenSharing) {
        activeCallsRef.current.forEach((call) => {
          const senders = call.peerConnection?.getSenders() || [];
          const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
          if (videoSender) {
            videoSender.replaceTrack(newTrack).catch(console.error);
          }
        });

        const currentVideo = localStream.getVideoTracks()[0];
        if (currentVideo) {
          currentVideo.stop();
          localStream.removeTrack(currentVideo);
        }
        localStream.addTrack(newTrack);
        newTrack.enabled = !isVideoMuted;
      }
    } catch (err) {
      console.error('Failed to switch camera:', err);
    }
  }, [localStream, isScreenSharing, isVideoMuted]);

  // Switch audio input device (Microphone)
  const switchMicrophoneDevice = useCallback(async (deviceId: string) => {
    if (!localStream) return;
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId }, echoCancellation: true, noiseSuppression: true },
        video: false,
      });

      const newTrack = newStream.getAudioTracks()[0];
      if (!newTrack) return;

      micTrackRef.current = newTrack;

      activeCallsRef.current.forEach((call) => {
        const senders = call.peerConnection?.getSenders() || [];
        const audioSender = senders.find((s) => s.track && s.track.kind === 'audio');
        if (audioSender) {
          audioSender.replaceTrack(newTrack).catch(console.error);
        }
      });

      const currentAudio = localStream.getAudioTracks()[0];
      if (currentAudio) {
        currentAudio.stop();
        localStream.removeTrack(currentAudio);
      }
      localStream.addTrack(newTrack);
      newTrack.enabled = !isAudioMuted;

      // Re-attach audio meter for local stream
      if (localAudioCleanupRef.current) {
        localAudioCleanupRef.current();
      }
      localAudioCleanupRef.current = createAudioMeter(localStream, (volume, isSpeaking) => {
        setLocalVolume(volume);
        setIsLocalSpeaking(isSpeaking);
      });
    } catch (err) {
      console.error('Failed to switch microphone:', err);
    }
  }, [localStream, isAudioMuted]);

  // Send a chat message
  const sendChatMessage = useCallback((text: string) => {
    if (!text.trim()) return;

    const chatMsg: ChatMessage = {
      id: Math.random().toString(36).substring(2, 9),
      senderId: peerRef.current?.id || 'me',
      senderName: userName,
      text: text.trim(),
      timestamp: Date.now(),
    };

    setChatMessages((prev) => [...prev, chatMsg]);

    broadcast({
      type: 'chat',
      chatMessage: chatMsg,
    });
  }, [userName, broadcast]);

  return {
    peerId,
    status,
    errorMessage,
    localStream,
    isAudioMuted,
    isVideoMuted,
    isScreenSharing,
    localVolume,
    isLocalSpeaking,
    hasCameraHardware,
    hasMicHardware,
    remotePeers: Array.from(remotePeers.values()),
    chatMessages,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    switchCameraDevice,
    switchMicrophoneDevice,
    sendChatMessage,
  };
}

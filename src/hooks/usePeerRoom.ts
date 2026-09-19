import { useState, useEffect, useRef, useCallback } from 'react';
import Peer, { type MediaConnection, type DataConnection } from 'peerjs';
import { RemotePeer, ChatMessage, ConnectionStatus } from '../types';
import { createAudioMeter } from '../utils/audioAnalyser';
import { acquireUserMedia } from '../utils/mediaUtils';
import { ScreenAudioMixer } from '../utils/audioMixer';

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
  isScreenAudioActive?: boolean;
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
  const [isScreenAudioActive, setIsScreenAudioActive] = useState(false);
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
  const screenAudioTrackRef = useRef<MediaStreamTrack | null>(null);
  const screenAudioMixerRef = useRef<ScreenAudioMixer | null>(null);
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
        isScreenAudioActive,
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
            isScreenAudioActive: false,
            volumeLevel: 0,
            isSpeaking: false,
          };

          updated.set(conn.peer, {
            ...existing,
            name: msg.userName !== undefined ? msg.userName : existing.name,
            isAudioMuted: msg.isAudioMuted !== undefined ? msg.isAudioMuted : existing.isAudioMuted,
            isVideoMuted: msg.isVideoMuted !== undefined ? msg.isVideoMuted : existing.isVideoMuted,
            isScreenSharing: msg.isScreenSharing !== undefined ? msg.isScreenSharing : existing.isScreenSharing,
            isScreenAudioActive: msg.isScreenAudioActive !== undefined ? msg.isScreenAudioActive : existing.isScreenAudioActive,
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
  }, [userName, isAudioMuted, isVideoMuted, isScreenSharing, isScreenAudioActive]);

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
        screenTrackRef.current = null;
      }
      if (screenAudioTrackRef.current) {
        screenAudioTrackRef.current.stop();
        screenAudioTrackRef.current = null;
      }
      if (screenAudioMixerRef.current) {
        screenAudioMixerRef.current.destroy();
        screenAudioMixerRef.current = null;
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
  // When screen audio is active, muting mic will mute the voice while letting screen audio play through!
  const toggleAudio = useCallback(() => {
    const newMutedState = !isAudioMuted;
    setIsAudioMuted(newMutedState);

    if (micTrackRef.current) {
      micTrackRef.current.enabled = !newMutedState;
    }

    // If screen audio mixer is active, adjust mic gain in the mixer while screen audio continues!
    if (screenAudioMixerRef.current) {
      screenAudioMixerRef.current.setMicMuted(newMutedState);
    } else if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !newMutedState;
      }
    }

    broadcast({
      type: 'status_update',
      userId: peerRef.current?.id,
      isAudioMuted: newMutedState,
      isScreenAudioActive,
    });
  }, [isAudioMuted, isScreenAudioActive, broadcast, localStream]);

  // Toggle Video (Camera On / Off)
  const toggleVideo = useCallback(async () => {
    if (!localStream) return;

    // If currently screen sharing and user turns video on, stop screen sharing and switch to camera ON
    if (isScreenSharing) {
      await toggleScreenShare();
      if (cameraTrackRef.current) {
        cameraTrackRef.current.enabled = true;
      }
      setIsVideoMuted(false);
      broadcast({
        type: 'status_update',
        userId: peerRef.current?.id,
        isVideoMuted: false,
      });
      return;
    }

    const camTrack = cameraTrackRef.current;
    const newMutedState = !isVideoMuted;
    if (camTrack) {
      camTrack.enabled = !newMutedState;
    }
    const currentVideoTrack = localStream.getVideoTracks()[0];
    if (currentVideoTrack && currentVideoTrack !== camTrack) {
      currentVideoTrack.enabled = !newMutedState;
    }
    setIsVideoMuted(newMutedState);

    broadcast({
      type: 'status_update',
      userId: peerRef.current?.id,
      isVideoMuted: newMutedState,
    });
  }, [localStream, isVideoMuted, isScreenSharing, broadcast]);

  // Screen Share Toggle with audio mixing & automatic camera auto-off
  const toggleScreenShare = useCallback(async () => {
    if (!localStream) return;

    if (isScreenSharing) {
      // STOP SCREEN SHARE:
      // 1. Stop screen video track
      if (screenTrackRef.current) {
        screenTrackRef.current.stop();
        screenTrackRef.current = null;
      }

      // 2. Stop screen audio track and dismantle mixer
      if (screenAudioTrackRef.current) {
        screenAudioTrackRef.current.stop();
        screenAudioTrackRef.current = null;
      }
      if (screenAudioMixerRef.current) {
        screenAudioMixerRef.current.destroy();
        screenAudioMixerRef.current = null;
      }
      setIsScreenAudioActive(false);

      // 3. Restore microphone track to WebRTC audio senders & localStream
      if (micTrackRef.current) {
        micTrackRef.current.enabled = !isAudioMuted;

        activeCallsRef.current.forEach((call) => {
          const senders = call.peerConnection?.getSenders() || [];
          const audioSender = senders.find((s) => s.track && s.track.kind === 'audio');
          if (audioSender && micTrackRef.current) {
            audioSender.replaceTrack(micTrackRef.current).catch((err) => {
              console.warn('Error restoring mic track to audio sender:', err);
            });
          }
        });

        const curAudio = localStream.getAudioTracks()[0];
        if (curAudio && curAudio !== micTrackRef.current) {
          localStream.removeTrack(curAudio);
          localStream.addTrack(micTrackRef.current);
        }
      }

      // 4. Restore camera track to video senders & localStream
      const camTrack = cameraTrackRef.current;
      if (camTrack) {
        // Since video control was auto turned off when screen sharing started,
        // camTrack remains off (!isVideoMuted) unless user explicitly turned it back on
        camTrack.enabled = !isVideoMuted;

        activeCallsRef.current.forEach((call) => {
          const senders = call.peerConnection?.getSenders() || [];
          const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
          if (videoSender) {
            videoSender.replaceTrack(camTrack).catch((err) => {
              console.warn('Error restoring camera track to video sender:', err);
            });
          }
        });

        const curVideo = localStream.getVideoTracks()[0];
        if (curVideo && curVideo !== camTrack) {
          localStream.removeTrack(curVideo);
          localStream.addTrack(camTrack);
        }
      }

      setIsScreenSharing(false);
      broadcast({
        type: 'status_update',
        userId: peerRef.current?.id,
        isScreenSharing: false,
        isScreenAudioActive: false,
      });
    } else {
      // START SCREEN SHARE
      try {
        let displayStream: MediaStream;
        try {
          const displayMediaOptions = {
            video: {
              frameRate: { ideal: 30, max: 60 },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
            audio: {
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false,
            },
            systemAudio: 'include',
            surfaceSwitching: 'include',
          } as DisplayMediaStreamOptions & { systemAudio?: string; surfaceSwitching?: string };

          displayStream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
        } catch (err: unknown) {
          const errorName = (err as { name?: string })?.name;
          if (errorName === 'TypeError' || errorName === 'OverconstrainedError') {
            displayStream = await navigator.mediaDevices.getDisplayMedia({
              video: true,
              audio: true,
            });
          } else {
            throw err;
          }
        }

        const screenVideoTrack = displayStream.getVideoTracks()[0];
        if (!screenVideoTrack) return;

        screenTrackRef.current = screenVideoTrack;

        // Auto revert back if user stops sharing via browser's built-in floating pill
        screenVideoTrack.onended = () => {
          toggleScreenShare();
        };

        // AUTO TURN OFF VIDEO CONTROL IF VIDEO/CAMERA WAS ON BEFORE SCREEN SHARING BEGAN:
        let updatedVideoMuted = isVideoMuted;
        if (!isVideoMuted) {
          if (cameraTrackRef.current) {
            cameraTrackRef.current.enabled = false;
          }
          setIsVideoMuted(true);
          updatedVideoMuted = true;
          broadcast({
            type: 'status_update',
            userId: peerRef.current?.id,
            isVideoMuted: true,
          });
        }

        // Check if user shared audio (e.g. checked "Share audio" / "Share tab audio")
        const screenAudioTracks = displayStream.getAudioTracks();
        const hasScreenAudio = screenAudioTracks.length > 0;
        let mixedAudioTrack: MediaStreamTrack | null = null;

        if (hasScreenAudio) {
          const screenAudioTrack = screenAudioTracks[0];
          screenAudioTrackRef.current = screenAudioTrack;

          screenAudioTrack.onended = () => {
            console.log('In-screen audio track ended');
            setIsScreenAudioActive(false);
          };

          const mixer = new ScreenAudioMixer();
          mixedAudioTrack = mixer.initialize(
            micTrackRef.current,
            screenAudioTrack,
            isAudioMuted
          );

          if (mixedAudioTrack) {
            screenAudioMixerRef.current = mixer;
            setIsScreenAudioActive(true);

            // Replace audio track across all active WebRTC calls
            activeCallsRef.current.forEach((call) => {
              const senders = call.peerConnection?.getSenders() || [];
              const audioSender = senders.find((s) => s.track && s.track.kind === 'audio');
              if (audioSender && mixedAudioTrack) {
                audioSender.replaceTrack(mixedAudioTrack).catch((e) => {
                  console.warn('Failed to replace audio track with screen audio mixer:', e);
                });
              }
            });

            // Update localStream audio track for subsequent callers
            const curAudio = localStream.getAudioTracks()[0];
            if (curAudio) {
              localStream.removeTrack(curAudio);
            }
            localStream.addTrack(mixedAudioTrack);
          }
        } else {
          setIsScreenAudioActive(false);
        }

        // Replace video track across all active WebRTC senders with screen share track
        activeCallsRef.current.forEach((call) => {
          const senders = call.peerConnection?.getSenders() || [];
          const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
          if (videoSender) {
            videoSender.replaceTrack(screenVideoTrack).catch(console.error);
          }
        });

        // Update localStream video track
        const curVideo = localStream.getVideoTracks()[0];
        if (curVideo) {
          localStream.removeTrack(curVideo);
        }
        localStream.addTrack(screenVideoTrack);

        setIsScreenSharing(true);
        broadcast({
          type: 'status_update',
          userId: peerRef.current?.id,
          isScreenSharing: true,
          isScreenAudioActive: hasScreenAudio && Boolean(mixedAudioTrack),
          isVideoMuted: updatedVideoMuted,
        });
      } catch (err) {
        console.warn('Screen share canceled or denied:', err);
      }
    }
  }, [localStream, isScreenSharing, isAudioMuted, isVideoMuted, broadcast]);

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
      } else {
        // While screen sharing, camera is kept off
        newTrack.enabled = false;
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

      // If screen audio mixer is running, update the mixer with the new microphone source
      if (screenAudioMixerRef.current) {
        screenAudioMixerRef.current.updateMicTrack(newTrack, isAudioMuted);
      } else {
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
      }

      // Re-attach audio meter for local stream
      if (localAudioCleanupRef.current) {
        localAudioCleanupRef.current();
      }
      localAudioCleanupRef.current = createAudioMeter(new MediaStream([newTrack]), (volume, isSpeaking) => {
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
    isScreenAudioActive,
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

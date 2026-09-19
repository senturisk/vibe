/**
 * Sen Vibe - Minimalist, Lagless Video & Screen Sharing Platform
 * Developed by Senturisk
 * Material You 3 Design & PeerJS WebRTC
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { Lobby } from './components/Lobby';
import { VideoTile } from './components/VideoTile';
import { ControlsBar } from './components/ControlsBar';
import { ShareModal } from './components/ShareModal';
import { DeviceSettingsModal } from './components/DeviceSettingsModal';
import { ChatDrawer } from './components/ChatDrawer';
import { usePeerRoom } from './hooks/usePeerRoom';
import { DeviceSettings, LayoutMode } from './types';

export default function App() {
  // Read room from URL ?room= or ?peer= or ?join= or ?id=
  const [urlRoomId, setUrlRoomId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const room =
        params.get('room') ||
        params.get('peer') ||
        params.get('join') ||
        params.get('id');
      if (room) return room.trim();
      const raw = window.location.search.replace(/^\?/, '').trim();
      if (raw && !raw.includes('=')) return decodeURIComponent(raw);
    }
    return '';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const room =
        params.get('room') ||
        params.get('peer') ||
        params.get('join') ||
        params.get('id');
      if (room) {
        setUrlRoomId(room.trim());
      } else {
        const raw = window.location.search.replace(/^\?/, '').trim();
        if (raw && !raw.includes('=')) setUrlRoomId(decodeURIComponent(raw));
      }
    }
  }, []);

  // Room state
  const [inRoom, setInRoom] = useState(false);
  const [activeRoomId, setActiveRoomId] = useState('');
  const [activeUserName, setActiveUserName] = useState('');
  const [initialAudioMuted, setInitialAudioMuted] = useState(false);
  const [initialVideoMuted, setInitialVideoMuted] = useState(false);

  // UI state
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('grid');
  const [pinnedPeerId, setPinnedPeerId] = useState<string | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  // Device & Theme settings with persistence
  const [deviceSettings, setDeviceSettings] = useState<DeviceSettings>(() => {
    let initialTheme: 'light' | 'dark' = 'light';
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('senvibe_theme');
      if (saved === 'dark' || saved === 'light') {
        initialTheme = saved;
      } else if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
        initialTheme = 'dark';
      }
    }
    return {
      audioInputId: '',
      videoInputId: '',
      audioOutputId: '',
      videoResolution: '720p',
      isMirrorMode: true,
      theme: initialTheme,
    };
  });

  // Sync dark class on root document whenever theme changes
  useEffect(() => {
    const isDark = deviceSettings.theme === 'dark';
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', isDark);
      try {
        localStorage.setItem('senvibe_theme', deviceSettings.theme);
      } catch (e) {
        console.warn('Could not save theme preference:', e);
      }
    }
  }, [deviceSettings.theme]);

  const handleToggleTheme = () => {
    setDeviceSettings((prev) => ({
      ...prev,
      theme: prev.theme === 'dark' ? 'light' : 'dark',
    }));
  };

  // Call WebRTC Room Hook
  const {
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
    remotePeers,
    chatMessages,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    switchCameraDevice,
    switchMicrophoneDevice,
    sendChatMessage,
  } = usePeerRoom({
    roomId: activeRoomId,
    userName: activeUserName,
    initialAudioMuted,
    initialVideoMuted,
  });

  // Track unread chat messages when drawer is closed
  useEffect(() => {
    if (!isChatOpen && chatMessages.length > 0) {
      setUnreadChatCount((prev) => prev + 1);
    }
  }, [chatMessages, isChatOpen]);

  // Handle joining room from lobby
  const handleJoinRoom = (
    roomId: string,
    name: string,
    audioMuted: boolean,
    videoMuted: boolean
  ) => {
    setActiveRoomId(roomId);
    setActiveUserName(name);
    setInitialAudioMuted(audioMuted);
    setInitialVideoMuted(videoMuted);
    setInRoom(true);

    // Update browser URL query param cleanly without reloading
    if (typeof window !== 'undefined') {
      const newUrl = `${window.location.pathname}?room=${encodeURIComponent(roomId)}`;
      window.history.replaceState(null, '', newUrl);
    }
  };

  // Handle leaving room
  const handleLeaveRoom = () => {
    setInRoom(false);
    setActiveRoomId('');
    setPinnedPeerId(null);
    setIsChatOpen(false);

    // Clear room query param
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', window.location.pathname);
    }
  };

  // Auto spotlight screen share if someone is screen sharing and no manual pin
  useEffect(() => {
    if (isScreenSharing) {
      setPinnedPeerId('local');
    } else {
      const sharingRemote = remotePeers.find((p) => p.isScreenSharing);
      if (sharingRemote) {
        setPinnedPeerId(sharingRemote.id);
      } else if (pinnedPeerId === 'local') {
        setPinnedPeerId(null);
      }
    }
  }, [isScreenSharing, remotePeers, pinnedPeerId]);

  // Total participants count
  const participantCount = 1 + remotePeers.length;

  // Render grid calculation
  const gridClasses = useMemo(() => {
    const total = participantCount;
    if (total === 1) return 'grid-cols-1 max-w-3xl';
    if (total === 2) return 'grid-cols-1 md:grid-cols-2 max-w-5xl';
    if (total <= 4) return 'grid-cols-1 sm:grid-cols-2 max-w-5xl';
    if (total <= 6) return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 max-w-6xl';
    return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 max-w-7xl';
  }, [participantCount]);

  // Determine pinned peer
  const pinnedPeer = useMemo(() => {
    if (pinnedPeerId === 'local') {
      return {
        id: 'local',
        name: activeUserName,
        stream: localStream || undefined,
        isLocal: true,
        isAudioMuted,
        isVideoMuted,
        isScreenSharing,
        volumeLevel: localVolume,
        isSpeaking: isLocalSpeaking,
      };
    }
    const found = remotePeers.find((p) => p.id === pinnedPeerId);
    if (found) {
      return {
        ...found,
        isLocal: false,
      };
    }
    return null;
  }, [
    pinnedPeerId,
    activeUserName,
    localStream,
    isAudioMuted,
    isVideoMuted,
    isScreenSharing,
    localVolume,
    isLocalSpeaking,
    remotePeers,
  ]);

  return (
    <div className="min-h-screen flex flex-col bg-[#FBF8FD] dark:bg-[#141218] text-[#1D1B20] dark:text-[#E6E0E9] selection:bg-[#EADDFF] dark:selection:bg-[#4F378B] selection:text-[#21005D] dark:selection:text-[#EADDFF] transition-colors duration-200">
      {/* Top App Bar */}
      <Header
        roomId={activeRoomId}
        peerId={peerId}
        status={status}
        participantCount={participantCount}
        onOpenShare={() => setIsShareModalOpen(true)}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        inRoom={inRoom}
        theme={deviceSettings.theme}
        onToggleTheme={handleToggleTheme}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {!inRoom ? (
          /* Lobby / Pre-Join Screen */
          <Lobby
            initialRoomId={urlRoomId}
            onJoinRoom={handleJoinRoom}
            onOpenSettings={() => setIsSettingsModalOpen(true)}
          />
        ) : (
          /* In-Room Video Session */
          <div className="flex-1 p-3 sm:p-5 pb-24 sm:pb-28 flex flex-col items-center justify-center max-w-7xl w-full mx-auto">
            {/* Spotlight Mode Layout */}
            {layoutMode === 'spotlight' && pinnedPeer ? (
              <div className="w-full flex-1 flex flex-col lg:flex-row gap-4 items-center justify-center">
                {/* Main Spotlight Video */}
                <div className="flex-1 w-full max-w-5xl h-full flex items-center justify-center">
                  <VideoTile
                    stream={pinnedPeer.stream}
                    name={pinnedPeer.name}
                    isLocal={pinnedPeer.isLocal}
                    isAudioMuted={pinnedPeer.isAudioMuted}
                    isVideoMuted={pinnedPeer.isVideoMuted}
                    isScreenSharing={pinnedPeer.isScreenSharing}
                    volumeLevel={pinnedPeer.volumeLevel}
                    isSpeaking={pinnedPeer.isSpeaking}
                    isPinned={true}
                    isMirror={pinnedPeer.isLocal && deviceSettings.isMirrorMode}
                    onTogglePin={() => setPinnedPeerId(null)}
                  />
                </div>

                {/* Side Strip of Other Participants */}
                <div className="w-full lg:w-72 flex lg:flex-col gap-3 overflow-x-auto lg:overflow-y-auto max-h-[60vh] py-1 px-1">
                  {/* Show local tile in strip if not pinned */}
                  {pinnedPeerId !== 'local' && (
                    <div className="w-48 lg:w-full shrink-0">
                      <VideoTile
                        stream={localStream || undefined}
                        name={activeUserName}
                        isLocal={true}
                        isAudioMuted={isAudioMuted}
                        isVideoMuted={isVideoMuted}
                        isScreenSharing={isScreenSharing}
                        volumeLevel={localVolume}
                        isSpeaking={isLocalSpeaking}
                        isMirror={deviceSettings.isMirrorMode}
                        onTogglePin={() => setPinnedPeerId('local')}
                      />
                    </div>
                  )}

                  {/* Show remote peers in strip */}
                  {remotePeers
                    .filter((p) => p.id !== pinnedPeerId)
                    .map((peer) => (
                      <div key={peer.id} className="w-48 lg:w-full shrink-0">
                        <VideoTile
                          stream={peer.stream}
                          name={peer.name}
                          isLocal={false}
                          isAudioMuted={peer.isAudioMuted}
                          isVideoMuted={peer.isVideoMuted}
                          isScreenSharing={peer.isScreenSharing}
                          volumeLevel={peer.volumeLevel}
                          isSpeaking={peer.isSpeaking}
                          onTogglePin={() => setPinnedPeerId(peer.id)}
                        />
                      </div>
                    ))}
                </div>
              </div>
            ) : (
              /* Auto Grid Mode Layout */
              <div className={`w-full grid gap-3 sm:gap-4 mx-auto items-center justify-center ${gridClasses}`}>
                {/* Local Video Tile */}
                <VideoTile
                  stream={localStream || undefined}
                  name={activeUserName}
                  isLocal={true}
                  isAudioMuted={isAudioMuted}
                  isVideoMuted={isVideoMuted}
                  isScreenSharing={isScreenSharing}
                  volumeLevel={localVolume}
                  isSpeaking={isLocalSpeaking}
                  isPinned={pinnedPeerId === 'local'}
                  isMirror={deviceSettings.isMirrorMode}
                  onTogglePin={() => {
                    setLayoutMode('spotlight');
                    setPinnedPeerId('local');
                  }}
                />

                {/* Remote Participants Video Tiles */}
                {remotePeers.map((peer) => (
                  <VideoTile
                    key={peer.id}
                    stream={peer.stream}
                    name={peer.name}
                    isLocal={false}
                    isAudioMuted={peer.isAudioMuted}
                    isVideoMuted={peer.isVideoMuted}
                    isScreenSharing={peer.isScreenSharing}
                    volumeLevel={peer.volumeLevel}
                    isSpeaking={peer.isSpeaking}
                    isPinned={pinnedPeerId === peer.id}
                    onTogglePin={() => {
                      setLayoutMode('spotlight');
                      setPinnedPeerId(peer.id);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Floating Bottom Controls Bar in Room */}
      {inRoom && (
        <ControlsBar
          isAudioMuted={isAudioMuted}
          isVideoMuted={isVideoMuted}
          isScreenSharing={isScreenSharing}
          layoutMode={layoutMode}
          unreadChatCount={unreadChatCount}
          hasCameraHardware={hasCameraHardware}
          hasMicHardware={hasMicHardware}
          onToggleAudio={toggleAudio}
          onToggleVideo={toggleVideo}
          onToggleScreenShare={toggleScreenShare}
          onToggleLayout={() =>
            setLayoutMode((prev) => (prev === 'grid' ? 'spotlight' : 'grid'))
          }
          onToggleChat={() => {
            setIsChatOpen((prev) => !prev);
            setUnreadChatCount(0);
          }}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
          onOpenShare={() => setIsShareModalOpen(true)}
          onLeaveRoom={handleLeaveRoom}
          onSwitchCamera={switchCameraDevice}
          onSwitchMicrophone={switchMicrophoneDevice}
        />
      )}

      {/* In-Call Text Chat Drawer */}
      <ChatDrawer
        isOpen={isChatOpen && inRoom}
        onClose={() => setIsChatOpen(false)}
        messages={chatMessages}
        onSendMessage={sendChatMessage}
        currentUserId={peerId}
      />

      {/* QR Code & Share Invite Modal */}
      <ShareModal
        roomId={activeRoomId}
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
      />

      {/* Device Settings Modal */}
      <DeviceSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        currentSettings={deviceSettings}
        onUpdateSettings={setDeviceSettings}
        currentVolume={localVolume}
        onSwitchCamera={switchCameraDevice}
        onSwitchMicrophone={switchMicrophoneDevice}
      />

      {/* Footer with Senturisk Copyright */}
      <Footer />
    </div>
  );
}

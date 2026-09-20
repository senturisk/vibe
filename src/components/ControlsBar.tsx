import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  MonitorOff,
  LayoutGrid,
  SquareSquare,
  MessageSquare,
  Settings,
  PhoneOff,
  ChevronUp,
  QrCode,
  Check,
} from 'lucide-react';
import { LayoutMode } from '../types';

interface ControlsBarProps {
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  isScreenSharing: boolean;
  isScreenAudioActive?: boolean;
  layoutMode: LayoutMode;
  unreadChatCount: number;
  hasCameraHardware: boolean;
  hasMicHardware: boolean;
  selectedAudioId?: string;
  selectedVideoId?: string;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onToggleLayout: () => void;
  onToggleChat: () => void;
  onOpenSettings: () => void;
  onOpenShare: () => void;
  onLeaveRoom: () => void;
  onSwitchCamera?: (deviceId: string) => void;
  onSwitchMicrophone?: (deviceId: string) => void;
}

export const ControlsBar: React.FC<ControlsBarProps> = ({
  isAudioMuted,
  isVideoMuted,
  isScreenSharing,
  isScreenAudioActive = false,
  layoutMode,
  unreadChatCount,
  hasCameraHardware,
  hasMicHardware,
  selectedAudioId: propAudioId = '',
  selectedVideoId: propVideoId = '',
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onToggleLayout,
  onToggleChat,
  onOpenSettings,
  onOpenShare,
  onLeaveRoom,
  onSwitchCamera,
  onSwitchMicrophone,
}) => {
  const [showMicMenu, setShowMicMenu] = useState(false);
  const [showCamMenu, setShowCamMenu] = useState(false);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [localAudioId, setLocalAudioId] = useState('');
  const [localVideoId, setLocalVideoId] = useState('');

  const currentAudioId = propAudioId || localAudioId;
  const currentVideoId = propVideoId || localVideoId;

  const micMenuRef = useRef<HTMLDivElement | null>(null);
  const camMenuRef = useRef<HTMLDivElement | null>(null);

  // Load available devices and listen for hotplugs/unplugs
  useEffect(() => {
    async function loadDevices() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const mics = devices.filter((d) => d.kind === 'audioinput');
        const cams = devices.filter((d) => d.kind === 'videoinput');
        setAudioDevices(mics);
        setVideoDevices(cams);
      } catch (err) {
        console.warn('Unable to enumerate devices:', err);
      }
    }
    loadDevices();
    navigator.mediaDevices?.addEventListener?.('devicechange', loadDevices);
    return () => {
      navigator.mediaDevices?.removeEventListener?.('devicechange', loadDevices);
    };
  }, []);

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (micMenuRef.current && !micMenuRef.current.contains(e.target as Node)) {
        setShowMicMenu(false);
      }
      if (camMenuRef.current && !camMenuRef.current.contains(e.target as Node)) {
        setShowCamMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="fixed bottom-3 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 w-auto max-w-[98vw] px-1">
      {/* Material 3 Floating Pill Dock */}
      <div className="flex items-center gap-1 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2.5 rounded-full bg-[#FEF7FF]/95 dark:bg-[#1D1B20]/95 backdrop-blur-xl border border-[#EADDFF] dark:border-[#49454F]/70 shadow-2xl transition-all">
        {/* Microphone Button + Device Selector */}
        <div className="relative flex items-center" ref={micMenuRef}>
          <button
            onClick={onToggleAudio}
            disabled={!hasMicHardware}
            title={
              !hasMicHardware
                ? 'No microphone detected'
                : isAudioMuted
                ? 'Unmute Microphone'
                : 'Mute Microphone'
            }
            className={`flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full transition-all active:scale-95 ${
              !hasMicHardware
                ? 'bg-gray-200 dark:bg-zinc-800 text-gray-400 dark:text-zinc-600 cursor-not-allowed'
                : isAudioMuted
                ? 'bg-[#FFDAD6] text-[#410002] hover:bg-[#FFB4AB]'
                : 'bg-[#EADDFF] text-[#21005D] hover:bg-[#D0BCFF] dark:bg-[#4F378B] dark:text-[#EADDFF]'
            }`}
          >
            {isAudioMuted || !hasMicHardware ? (
              <MicOff className="w-4 h-4 sm:w-5 sm:h-5" />
            ) : (
              <Mic className="w-4 h-4 sm:w-5 sm:h-5" />
            )}
          </button>

          {audioDevices.length > 1 && hasMicHardware && (
            <button
              onClick={() => {
                setShowMicMenu(!showMicMenu);
                setShowCamMenu(false);
              }}
              title="Select Microphone"
              className="p-1 rounded-full text-[#49454F] dark:text-[#CAC4D0] hover:bg-[#F3EDF7] dark:hover:bg-[#2B2831] -ml-2 sm:-ml-1.5"
            >
              <ChevronUp className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </button>
          )}

          {/* Microphones dropdown */}
          {showMicMenu && (
            <div className="absolute bottom-13 sm:bottom-14 left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0 w-56 sm:w-64 bg-[#FEF7FF] dark:bg-[#1D1B20] rounded-2xl p-2 shadow-2xl border border-[#EADDFF] dark:border-[#49454F] z-50 text-xs">
              <div className="px-3 py-1.5 font-semibold text-[#21005D] dark:text-[#E6E0E9]">Select Microphone</div>
              <div className="divide-y divide-[#EADDFF]/50 dark:divide-[#49454F]/40 max-h-48 overflow-y-auto">
                {audioDevices.map((dev, idx) => (
                  <button
                    key={dev.deviceId || idx}
                    onClick={() => {
                      setLocalAudioId(dev.deviceId);
                      onSwitchMicrophone?.(dev.deviceId);
                      setShowMicMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-[#F3EDF7] dark:hover:bg-[#2B2831] rounded-xl flex items-center justify-between text-[#1D1B20] dark:text-[#E6E0E9]"
                  >
                    <span className="truncate pr-2">
                      {dev.label || `Microphone ${idx + 1}`}
                    </span>
                    {currentAudioId === dev.deviceId && (
                      <Check className="w-3.5 h-3.5 text-[#6750A4] dark:text-[#D0BCFF] shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Camera Button + Device Selector */}
        <div className="relative flex items-center" ref={camMenuRef}>
          <button
            onClick={onToggleVideo}
            disabled={!hasCameraHardware}
            title={
              !hasCameraHardware
                ? 'No camera detected'
                : isVideoMuted
                ? 'Turn On Camera'
                : 'Turn Off Camera'
            }
            className={`flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full transition-all active:scale-95 ${
              !hasCameraHardware
                ? 'bg-gray-200 dark:bg-zinc-800 text-gray-400 dark:text-zinc-600 cursor-not-allowed'
                : isVideoMuted
                ? 'bg-[#FFDAD6] text-[#410002] hover:bg-[#FFB4AB]'
                : 'bg-[#EADDFF] text-[#21005D] hover:bg-[#D0BCFF] dark:bg-[#4F378B] dark:text-[#EADDFF]'
            }`}
          >
            {isVideoMuted || !hasCameraHardware ? (
              <VideoOff className="w-4 h-4 sm:w-5 sm:h-5" />
            ) : (
              <Video className="w-4 h-4 sm:w-5 sm:h-5" />
            )}
          </button>

          {videoDevices.length > 1 && hasCameraHardware && (
            <button
              onClick={() => {
                setShowCamMenu(!showCamMenu);
                setShowMicMenu(false);
              }}
              title="Select Camera"
              className="p-1 rounded-full text-[#49454F] dark:text-[#CAC4D0] hover:bg-[#F3EDF7] dark:hover:bg-[#2B2831] -ml-2 sm:-ml-1.5"
            >
              <ChevronUp className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </button>
          )}

          {/* Cameras dropdown */}
          {showCamMenu && (
            <div className="absolute bottom-13 sm:bottom-14 left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0 w-56 sm:w-64 bg-[#FEF7FF] dark:bg-[#1D1B20] rounded-2xl p-2 shadow-2xl border border-[#EADDFF] dark:border-[#49454F] z-50 text-xs">
              <div className="px-3 py-1.5 font-semibold text-[#21005D] dark:text-[#E6E0E9]">Select Camera</div>
              <div className="divide-y divide-[#EADDFF]/50 dark:divide-[#49454F]/40 max-h-48 overflow-y-auto">
                {videoDevices.map((dev, idx) => (
                  <button
                    key={dev.deviceId || idx}
                    onClick={() => {
                      setLocalVideoId(dev.deviceId);
                      onSwitchCamera?.(dev.deviceId);
                      setShowCamMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-[#F3EDF7] dark:hover:bg-[#2B2831] rounded-xl flex items-center justify-between text-[#1D1B20] dark:text-[#E6E0E9]"
                  >
                    <span className="truncate pr-2">
                      {dev.label || `Camera ${idx + 1}`}
                    </span>
                    {currentVideoId === dev.deviceId && (
                      <Check className="w-3.5 h-3.5 text-[#6750A4] dark:text-[#D0BCFF] shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Screen Share Button */}
        <div className="relative">
          <button
            onClick={onToggleScreenShare}
            title={
              isScreenSharing
                ? isScreenAudioActive
                  ? 'Stop Screen Sharing (In-Screen Audio is being shared)'
                  : 'Stop Screen Sharing'
                : 'Share Screen'
            }
            className={`flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full transition-all active:scale-95 ${
              isScreenSharing
                ? 'bg-[#6750A4] dark:bg-[#D0BCFF] text-white dark:text-[#381E72] shadow-md animate-pulse'
                : 'bg-[#F3EDF7] dark:bg-[#2B2831] text-[#49454F] dark:text-[#CAC4D0] hover:bg-[#EADDFF] dark:hover:bg-[#4F378B] hover:text-[#21005D] dark:hover:text-[#EADDFF]'
            }`}
          >
            {isScreenSharing ? (
              <MonitorOff className="w-4 h-4 sm:w-5 sm:h-5" />
            ) : (
              <Monitor className="w-4 h-4 sm:w-5 sm:h-5" />
            )}
          </button>
          {isScreenSharing && isScreenAudioActive && (
            <span
              className="absolute -top-1 -right-1 flex h-3.5 w-3.5 sm:h-4 sm:w-4 items-center justify-center rounded-full bg-[#7429B6] dark:bg-[#4F378B] text-[8px] sm:text-[9px] font-bold text-white shadow"
              title="Screen Audio Active"
            >
              ♪
            </span>
          )}
        </div>

        {/* Divider */}
        <div className="w-[1px] h-5 sm:h-6 bg-[#CAC4D0] dark:bg-[#49454F] mx-0.5" />

        {/* Layout Switcher (Grid vs Spotlight) */}
        <button
          onClick={onToggleLayout}
          title={layoutMode === 'grid' ? 'Switch to Spotlight' : 'Switch to Grid'}
          className="flex items-center justify-center w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-[#F3EDF7] dark:bg-[#2B2831] text-[#49454F] dark:text-[#CAC4D0] hover:bg-[#EADDFF] dark:hover:bg-[#4F378B] hover:text-[#21005D] dark:hover:text-[#EADDFF] transition-colors"
        >
          {layoutMode === 'grid' ? (
            <SquareSquare className="w-4 h-4 sm:w-5 sm:h-5" />
          ) : (
            <LayoutGrid className="w-4 h-4 sm:w-5 sm:h-5" />
          )}
        </button>

        {/* QR / Invite Link Modal Button */}
        <button
          onClick={onOpenShare}
          title="Share Invite & QR Code"
          className="flex items-center justify-center w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-[#F3EDF7] dark:bg-[#2B2831] text-[#49454F] dark:text-[#CAC4D0] hover:bg-[#EADDFF] dark:hover:bg-[#4F378B] hover:text-[#21005D] dark:hover:text-[#EADDFF] transition-colors"
        >
          <QrCode className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        {/* Chat Drawer Toggle with Unread Badge */}
        <button
          onClick={onToggleChat}
          title="Open In-Call Chat"
          className="relative flex items-center justify-center w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-[#F3EDF7] dark:bg-[#2B2831] text-[#49454F] dark:text-[#CAC4D0] hover:bg-[#EADDFF] dark:hover:bg-[#4F378B] hover:text-[#21005D] dark:hover:text-[#EADDFF] transition-colors"
        >
          <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
          {unreadChatCount > 0 && (
            <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-[#B3261E] text-white text-[9px] sm:text-[10px] font-bold shadow-sm">
              {unreadChatCount > 9 ? '9+' : unreadChatCount}
            </span>
          )}
        </button>

        {/* Device Settings Button */}
        <button
          onClick={onOpenSettings}
          title="Device Settings"
          className="flex items-center justify-center w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-[#F3EDF7] dark:bg-[#2B2831] text-[#49454F] dark:text-[#CAC4D0] hover:bg-[#EADDFF] dark:hover:bg-[#4F378B] hover:text-[#21005D] dark:hover:text-[#EADDFF] transition-colors"
        >
          <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        {/* Divider */}
        <div className="w-[1px] h-5 sm:h-6 bg-[#CAC4D0] dark:bg-[#49454F] mx-0.5" />

        {/* Leave Room (End Call) Button */}
        <button
          onClick={onLeaveRoom}
          title="Leave Room"
          className="flex items-center justify-center px-3.5 sm:px-5 h-10 sm:h-12 rounded-full bg-[#BA1A1A] text-white hover:bg-[#93000A] shadow-md transition-all active:scale-95 gap-1 sm:gap-1.5 text-xs font-semibold"
        >
          <PhoneOff className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="hidden sm:inline">Leave</span>
        </button>
      </div>
    </div>
  );
};

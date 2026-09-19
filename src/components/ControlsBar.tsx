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
  layoutMode: LayoutMode;
  unreadChatCount: number;
  hasCameraHardware: boolean;
  hasMicHardware: boolean;
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
  layoutMode,
  unreadChatCount,
  hasCameraHardware,
  hasMicHardware,
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
  const [selectedAudioId, setSelectedAudioId] = useState('');
  const [selectedVideoId, setSelectedVideoId] = useState('');

  const micMenuRef = useRef<HTMLDivElement | null>(null);
  const camMenuRef = useRef<HTMLDivElement | null>(null);

  // Load available devices
  useEffect(() => {
    async function loadDevices() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const mics = devices.filter((d) => d.kind === 'audioinput');
        const cams = devices.filter((d) => d.kind === 'videoinput');
        setAudioDevices(mics);
        setVideoDevices(cams);
        if (mics.length > 0 && !selectedAudioId) {
          setSelectedAudioId(mics[0].deviceId);
        }
        if (cams.length > 0 && !selectedVideoId) {
          setSelectedVideoId(cams[0].deviceId);
        }
      } catch (err) {
        console.warn('Unable to enumerate devices:', err);
      }
    }
    loadDevices();
  }, [selectedAudioId, selectedVideoId]);

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
    <div className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 w-auto max-w-[95vw]">
      {/* Material 3 Floating Pill Dock */}
      <div className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-full bg-[#FEF7FF]/95 backdrop-blur-xl border border-[#EADDFF] shadow-2xl transition-all">
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
            className={`flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-full transition-all active:scale-95 ${
              !hasMicHardware
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : isAudioMuted
                ? 'bg-[#FFDAD6] text-[#410002] hover:bg-[#FFB4AB]'
                : 'bg-[#EADDFF] text-[#21005D] hover:bg-[#D0BCFF]'
            }`}
          >
            {isAudioMuted || !hasMicHardware ? (
              <MicOff className="w-5 h-5" />
            ) : (
              <Mic className="w-5 h-5" />
            )}
          </button>

          {audioDevices.length > 1 && hasMicHardware && (
            <button
              onClick={() => {
                setShowMicMenu(!showMicMenu);
                setShowCamMenu(false);
              }}
              title="Select Microphone"
              className="p-1 rounded-full text-[#49454F] hover:bg-[#F3EDF7] -ml-2"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Microphones dropdown */}
          {showMicMenu && (
            <div className="absolute bottom-14 left-0 w-64 bg-[#FEF7FF] rounded-2xl p-2 shadow-2xl border border-[#EADDFF] z-50 text-xs">
              <div className="px-3 py-1.5 font-semibold text-[#21005D]">Select Microphone</div>
              <div className="divide-y divide-[#EADDFF]/50 max-h-48 overflow-y-auto">
                {audioDevices.map((dev, idx) => (
                  <button
                    key={dev.deviceId || idx}
                    onClick={() => {
                      setSelectedAudioId(dev.deviceId);
                      onSwitchMicrophone?.(dev.deviceId);
                      setShowMicMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-[#F3EDF7] rounded-xl flex items-center justify-between text-[#1D1B20]"
                  >
                    <span className="truncate pr-2">
                      {dev.label || `Microphone ${idx + 1}`}
                    </span>
                    {selectedAudioId === dev.deviceId && (
                      <Check className="w-3.5 h-3.5 text-[#6750A4] shrink-0" />
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
            className={`flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-full transition-all active:scale-95 ${
              !hasCameraHardware
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : isVideoMuted
                ? 'bg-[#FFDAD6] text-[#410002] hover:bg-[#FFB4AB]'
                : 'bg-[#EADDFF] text-[#21005D] hover:bg-[#D0BCFF]'
            }`}
          >
            {isVideoMuted || !hasCameraHardware ? (
              <VideoOff className="w-5 h-5" />
            ) : (
              <Video className="w-5 h-5" />
            )}
          </button>

          {videoDevices.length > 1 && hasCameraHardware && (
            <button
              onClick={() => {
                setShowCamMenu(!showCamMenu);
                setShowMicMenu(false);
              }}
              title="Select Camera"
              className="p-1 rounded-full text-[#49454F] hover:bg-[#F3EDF7] -ml-2"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Cameras dropdown */}
          {showCamMenu && (
            <div className="absolute bottom-14 left-0 w-64 bg-[#FEF7FF] rounded-2xl p-2 shadow-2xl border border-[#EADDFF] z-50 text-xs">
              <div className="px-3 py-1.5 font-semibold text-[#21005D]">Select Camera</div>
              <div className="divide-y divide-[#EADDFF]/50 max-h-48 overflow-y-auto">
                {videoDevices.map((dev, idx) => (
                  <button
                    key={dev.deviceId || idx}
                    onClick={() => {
                      setSelectedVideoId(dev.deviceId);
                      onSwitchCamera?.(dev.deviceId);
                      setShowCamMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-[#F3EDF7] rounded-xl flex items-center justify-between text-[#1D1B20]"
                  >
                    <span className="truncate pr-2">
                      {dev.label || `Camera ${idx + 1}`}
                    </span>
                    {selectedVideoId === dev.deviceId && (
                      <Check className="w-3.5 h-3.5 text-[#6750A4] shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Screen Share Button */}
        <button
          onClick={onToggleScreenShare}
          title={isScreenSharing ? 'Stop Screen Sharing' : 'Share Screen'}
          className={`flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-full transition-all active:scale-95 ${
            isScreenSharing
              ? 'bg-[#6750A4] text-white shadow-md animate-pulse'
              : 'bg-[#F3EDF7] text-[#49454F] hover:bg-[#EADDFF] hover:text-[#21005D]'
          }`}
        >
          {isScreenSharing ? (
            <MonitorOff className="w-5 h-5" />
          ) : (
            <Monitor className="w-5 h-5" />
          )}
        </button>

        {/* Divider */}
        <div className="w-[1px] h-6 bg-[#CAC4D0] mx-0.5" />

        {/* Layout Switcher (Grid vs Spotlight) */}
        <button
          onClick={onToggleLayout}
          title={layoutMode === 'grid' ? 'Switch to Spotlight' : 'Switch to Grid'}
          className="flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#F3EDF7] text-[#49454F] hover:bg-[#EADDFF] hover:text-[#21005D] transition-colors"
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
          className="flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#F3EDF7] text-[#49454F] hover:bg-[#EADDFF] hover:text-[#21005D] transition-colors"
        >
          <QrCode className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        {/* Chat Drawer Toggle with Unread Badge */}
        <button
          onClick={onToggleChat}
          title="Open In-Call Chat"
          className="relative flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#F3EDF7] text-[#49454F] hover:bg-[#EADDFF] hover:text-[#21005D] transition-colors"
        >
          <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
          {unreadChatCount > 0 && (
            <span className="absolute -top-1 -right-1 flex items-center justify-center w-5 h-5 rounded-full bg-[#B3261E] text-white text-[10px] font-bold shadow-sm">
              {unreadChatCount > 9 ? '9+' : unreadChatCount}
            </span>
          )}
        </button>

        {/* Device Settings Button */}
        <button
          onClick={onOpenSettings}
          title="Device Settings"
          className="hidden sm:flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#F3EDF7] text-[#49454F] hover:bg-[#EADDFF] hover:text-[#21005D] transition-colors"
        >
          <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        {/* Divider */}
        <div className="w-[1px] h-6 bg-[#CAC4D0] mx-0.5" />

        {/* Leave Room (End Call) Button */}
        <button
          onClick={onLeaveRoom}
          title="Leave Room"
          className="flex items-center justify-center px-4 sm:px-5 h-11 sm:h-12 rounded-full bg-[#BA1A1A] text-white hover:bg-[#93000A] shadow-md transition-all active:scale-95 gap-1.5 text-xs font-semibold"
        >
          <PhoneOff className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="hidden sm:inline">Leave</span>
        </button>
      </div>
    </div>
  );
};

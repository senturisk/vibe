import React, { useEffect, useRef, useState } from 'react';
import {
  Dice5,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Sparkles,
  ShieldCheck,
  Zap,
  ArrowRight,
  Settings,
  AlertCircle,
  Users,
} from 'lucide-react';
import { generate4DigitCode, generateRoomId } from '../utils/mediaUtils';
import { createAudioMeter } from '../utils/audioAnalyser';

interface LobbyProps {
  initialRoomId: string;
  onJoinRoom: (roomId: string, name: string, audioMuted: boolean, videoMuted: boolean) => void;
  onOpenSettings: () => void;
}

export const Lobby: React.FC<LobbyProps> = ({
  initialRoomId,
  onJoinRoom,
  onOpenSettings,
}) => {
  // Display name state, pre-seeded with a random 4-digit alphanumeric code
  const [displayName, setDisplayName] = useState(() => generate4DigitCode());
  const [roomId, setRoomId] = useState(initialRoomId || '');
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);

  // Local media preview state
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [hasCamera, setHasCamera] = useState(true);
  const [hasMic, setHasMic] = useState(true);
  const [permissionNotice, setPermissionNotice] = useState<string | null>(null);
  const [micVolume, setMicVolume] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioCleanupRef = useRef<(() => void) | null>(null);

  // Initialize preview stream with graceful fallback
  useEffect(() => {
    let active = true;

    async function setupPreview() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          audio: { echoCancellation: true, noiseSuppression: true },
        });

        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        setPreviewStream(stream);
        setHasCamera(true);
        setHasMic(true);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        // Attach audio meter
        audioCleanupRef.current = createAudioMeter(stream, (vol) => {
          if (active) setMicVolume(vol);
        });
      } catch (err: unknown) {
        console.warn('Full preview acquisition failed, attempting audio-only:', err);

        // Try audio only
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          if (!active) {
            audioStream.getTracks().forEach((t) => t.stop());
            return;
          }
          setPreviewStream(audioStream);
          setHasCamera(false);
          setHasMic(true);
          setPermissionNotice('Camera not detected or permission denied. You will join with voice only.');

          audioCleanupRef.current = createAudioMeter(audioStream, (vol) => {
            if (active) setMicVolume(vol);
          });
        } catch (audioErr: unknown) {
          console.warn('Audio preview also failed:', audioErr);
          if (!active) return;
          setHasCamera(false);
          setHasMic(false);
          setPermissionNotice('Media devices not found. You can still join as a viewer and share your screen!');
        }
      }
    }

    setupPreview();

    return () => {
      active = false;
      if (audioCleanupRef.current) {
        audioCleanupRef.current();
      }
      if (previewStream) {
        previewStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Update track enabled state on mute changes
  useEffect(() => {
    if (previewStream) {
      previewStream.getVideoTracks().forEach((t) => {
        t.enabled = !isVideoMuted;
      });
      previewStream.getAudioTracks().forEach((t) => {
        t.enabled = !isAudioMuted;
      });
    }
  }, [isVideoMuted, isAudioMuted, previewStream]);

  const handleRandomizeName = () => {
    const code = generate4DigitCode();
    setDisplayName(code);
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const finalRoom = (roomId || generateRoomId()).trim().toLowerCase();
    const finalName = displayName.trim() || generate4DigitCode();

    // Clean up preview stream before joining room so devices are cleanly handed over
    if (previewStream) {
      previewStream.getTracks().forEach((t) => t.stop());
    }
    if (audioCleanupRef.current) {
      audioCleanupRef.current();
    }

    onJoinRoom(finalRoom, finalName, isAudioMuted, isVideoMuted);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-12 gap-6 sm:gap-8 items-center">
        {/* Left Column: Brand, Setup, Display Name */}
        <div className="md:col-span-6 flex flex-col justify-center space-y-6">
          {/* Logo & Headline */}
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-[#EADDFF] text-[#21005D] text-xs font-semibold shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-[#6750A4]" />
              <span>Material You 3 WebRTC Platform</span>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-3xl bg-[#F3EDF7] p-1.5 shadow-md border border-[#EADDFF] flex items-center justify-center">
                <img
                  src="/Sen_Vibe_logo.png"
                  alt="Sen Vibe Logo"
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#21005D]">
                  Sen Vibe
                </h1>
                <p className="text-xs text-[#49454F] font-medium">
                  Easy & lagless video, voice, and screen sharing
                </p>
              </div>
            </div>
          </div>

          {/* Form Card */}
          <form
            onSubmit={handleJoin}
            className="p-6 rounded-3xl bg-[#FEF7FF] border border-[#EADDFF] shadow-xl space-y-5"
          >
            {/* Display Name Section */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#21005D]">
                Your Display Name
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. 7K9A or Alex"
                  className="flex-1 px-4 py-3 rounded-2xl bg-[#F3EDF7] border border-[#CAC4D0]/60 text-sm font-semibold text-[#1D1B20] focus:outline-none focus:ring-2 focus:ring-[#6750A4]"
                />
                <button
                  type="button"
                  onClick={handleRandomizeName}
                  title="Generate Random 4-Digit Code"
                  className="flex items-center gap-1.5 px-4 py-3 rounded-2xl bg-[#EADDFF] hover:bg-[#D0BCFF] text-[#21005D] text-xs font-bold transition-all active:scale-95 shadow-sm"
                >
                  <Dice5 className="w-4 h-4" />
                  <span>Random</span>
                </button>
              </div>
              <p className="text-[11px] text-[#49454F]">
                Pick your custom name or use the randomized 4-digit code.
              </p>
            </div>

            {/* Room ID Section */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#21005D]">
                Room Code
              </label>
              <input
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="Leave blank to create a new room"
                className="w-full px-4 py-3 rounded-2xl bg-[#F3EDF7] border border-[#CAC4D0]/60 text-sm font-mono text-[#1D1B20] focus:outline-none focus:ring-2 focus:ring-[#6750A4]"
              />
              {initialRoomId && (
                <p className="text-[11px] text-[#6750A4] font-medium flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  You were invited to join room: <span className="font-bold">{initialRoomId}</span>
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full py-3.5 px-6 rounded-full bg-[#6750A4] hover:bg-[#523e85] text-white font-bold text-sm shadow-lg hover:shadow-xl transition-all active:scale-98 flex items-center justify-center gap-2"
            >
              <span>{roomId ? 'Join Room' : 'Start New Room'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Badges */}
          <div className="grid grid-cols-3 gap-2 text-center text-[11px] text-[#49454F]">
            <div className="p-2.5 rounded-2xl bg-[#F3EDF7] border border-[#EADDFF]">
              <Zap className="w-4 h-4 text-[#6750A4] mx-auto mb-1" />
              <span className="font-medium">Lagless P2P</span>
            </div>
            <div className="p-2.5 rounded-2xl bg-[#F3EDF7] border border-[#EADDFF]">
              <ShieldCheck className="w-4 h-4 text-[#6750A4] mx-auto mb-1" />
              <span className="font-medium">No External ICE</span>
            </div>
            <div className="p-2.5 rounded-2xl bg-[#F3EDF7] border border-[#EADDFF]">
              <Sparkles className="w-4 h-4 text-[#6750A4] mx-auto mb-1" />
              <span className="font-medium">Direct QR Scan</span>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Video & Mic Preview Card */}
        <div className="md:col-span-6 flex flex-col items-center">
          <div className="w-full relative rounded-3xl overflow-hidden bg-[#1E192B] border-2 border-[#EADDFF] shadow-2xl aspect-video flex items-center justify-center">
            {/* Live Video Mirror */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover scale-x-[-1] ${
                !isVideoMuted && hasCamera ? 'block' : 'hidden'
              }`}
            />

            {/* Video Off Placeholder */}
            {(!hasCamera || isVideoMuted) && (
              <div className="flex flex-col items-center justify-center text-center p-6 select-none">
                <div className="w-20 h-20 rounded-full bg-[#EADDFF] flex items-center justify-center text-[#21005D] text-2xl font-bold mb-3 shadow-inner">
                  {displayName.slice(0, 2).toUpperCase() || 'SV'}
                </div>
                <p className="text-white/90 text-sm font-semibold">
                  {displayName || 'Preview'}
                </p>
                <p className="text-white/60 text-xs mt-0.5">
                  {isVideoMuted ? 'Camera is turned off' : 'No camera detected'}
                </p>
              </div>
            )}

            {/* Live Mic Meter in Preview */}
            <div className="absolute bottom-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md text-white text-xs">
              {isAudioMuted || !hasMic ? (
                <MicOff className="w-3.5 h-3.5 text-rose-400" />
              ) : (
                <Mic className="w-3.5 h-3.5 text-[#D0BCFF]" />
              )}
              <div className="w-16 h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div
                  style={{ width: `${isAudioMuted ? 0 : Math.min(100, micVolume * 1.6)}%` }}
                  className="h-full bg-[#D0BCFF] transition-all duration-75 rounded-full"
                />
              </div>
            </div>

            {/* Preview Quick Toggles */}
            <div className="absolute bottom-4 right-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsAudioMuted(!isAudioMuted)}
                disabled={!hasMic}
                title={isAudioMuted ? 'Unmute' : 'Mute'}
                className={`p-2.5 rounded-full shadow-md transition-all active:scale-95 ${
                  isAudioMuted || !hasMic
                    ? 'bg-[#FFDAD6] text-[#410002]'
                    : 'bg-[#EADDFF] text-[#21005D] hover:bg-[#D0BCFF]'
                }`}
              >
                {isAudioMuted || !hasMic ? (
                  <MicOff className="w-4 h-4" />
                ) : (
                  <Mic className="w-4 h-4" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setIsVideoMuted(!isVideoMuted)}
                disabled={!hasCamera}
                title={isVideoMuted ? 'Turn on camera' : 'Turn off camera'}
                className={`p-2.5 rounded-full shadow-md transition-all active:scale-95 ${
                  isVideoMuted || !hasCamera
                    ? 'bg-[#FFDAD6] text-[#410002]'
                    : 'bg-[#EADDFF] text-[#21005D] hover:bg-[#D0BCFF]'
                }`}
              >
                {isVideoMuted || !hasCamera ? (
                  <VideoOff className="w-4 h-4" />
                ) : (
                  <Video className="w-4 h-4" />
                )}
              </button>

              <button
                type="button"
                onClick={onOpenSettings}
                title="Device Settings"
                className="p-2.5 rounded-full bg-black/60 hover:bg-black/80 text-white shadow-md transition-colors"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Graceful Permission Alert Banner if any */}
          {permissionNotice && (
            <div className="mt-3 w-full p-3 rounded-2xl bg-[#FFF8E1] border border-[#FFE082] text-[#5D4037] text-xs flex items-center gap-2 shadow-sm">
              <AlertCircle className="w-4 h-4 text-[#FFA000] shrink-0" />
              <span>{permissionNotice}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

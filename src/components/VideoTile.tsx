import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Monitor, Maximize2, Minimize2, PictureInPicture2, Pin, PinOff, User } from 'lucide-react';

interface VideoTileProps {
  stream?: MediaStream;
  name: string;
  isLocal?: boolean;
  isAudioMuted?: boolean;
  isVideoMuted?: boolean;
  isScreenSharing?: boolean;
  volumeLevel?: number; // 0 - 100
  isSpeaking?: boolean;
  isPinned?: boolean;
  isMirror?: boolean;
  onTogglePin?: () => void;
}

export const VideoTile: React.FC<VideoTileProps> = ({
  stream,
  name,
  isLocal = false,
  isAudioMuted = false,
  isVideoMuted = false,
  isScreenSharing = false,
  volumeLevel = 0,
  isSpeaking = false,
  isPinned = false,
  isMirror = false,
  onTogglePin,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [supportsPip, setSupportsPip] = useState(false);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    setSupportsPip(document.pictureInPictureEnabled ?? false);
  }, []);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(console.error);
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(console.error);
      setIsFullscreen(false);
    }
  };

  const togglePip = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (err) {
      console.warn('PiP request failed:', err);
    }
  };

  // Determine equalizer bar heights based on volumeLevel (0 - 100)
  const bar1 = Math.min(100, Math.max(15, volumeLevel * 1.2));
  const bar2 = Math.min(100, Math.max(15, volumeLevel * 1.5));
  const bar3 = Math.min(100, Math.max(15, volumeLevel * 1.1));
  const bar4 = Math.min(100, Math.max(15, volumeLevel * 1.3));

  const showVideo = !isVideoMuted && stream && stream.getVideoTracks().some((t) => t.enabled);

  return (
    <div
      ref={containerRef}
      className={`group relative overflow-hidden rounded-3xl bg-[#1E192B] border-2 transition-all duration-200 flex items-center justify-center aspect-video w-full ${
        isSpeaking && !isAudioMuted
          ? 'border-[#7429B6] shadow-[0_0_20px_rgba(116,41,182,0.4)]'
          : 'border-[#EADDFF]/20 shadow-md'
      }`}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal} // Always mute local to avoid feedback loop
        className={`w-full h-full object-contain ${
          isLocal && isMirror && !isScreenSharing ? 'scale-x-[-1]' : ''
        } ${showVideo ? 'block' : 'hidden'}`}
      />

      {/* Fallback Display when Video is Off */}
      {!showVideo && (
        <div className="flex flex-col items-center justify-center p-6 text-center select-none">
          <div className="relative w-20 h-20 rounded-full bg-[#EADDFF] flex items-center justify-center text-[#21005D] text-2xl font-bold mb-3 shadow-inner">
            {name ? (
              name.slice(0, 2).toUpperCase()
            ) : (
              <User className="w-10 h-10 text-[#6750A4]" />
            )}

            {/* Speaking animated ring around avatar */}
            {isSpeaking && !isAudioMuted && (
              <span className="absolute inset-0 rounded-full border-4 border-[#7429B6] animate-ping opacity-75 pointer-events-none" />
            )}
          </div>
          <p className="text-white/90 text-sm font-medium">{name} {isLocal && '(You)'}</p>
          <p className="text-white/50 text-xs mt-0.5">Camera off</p>
        </div>
      )}

      {/* Screen Sharing Watermark / Badge */}
      {isScreenSharing && (
        <div className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#6750A4]/90 backdrop-blur-md text-white text-xs font-semibold shadow-md">
          <Monitor className="w-3.5 h-3.5 animate-pulse" />
          <span>Screen Share</span>
        </div>
      )}

      {/* Top Right Quick Controls on Hover */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity bg-black/40 backdrop-blur-md p-1 rounded-full text-white">
        {onTogglePin && (
          <button
            onClick={onTogglePin}
            title={isPinned ? 'Unpin' : 'Pin to Spotlight'}
            className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
          >
            {isPinned ? <PinOff className="w-3.5 h-3.5 text-[#EADDFF]" /> : <Pin className="w-3.5 h-3.5" />}
          </button>
        )}

        {supportsPip && showVideo && (
          <button
            onClick={togglePip}
            title="Picture-in-Picture"
            className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
          >
            <PictureInPicture2 className="w-3.5 h-3.5" />
          </button>
        )}

        <button
          onClick={toggleFullscreen}
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
        >
          {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Bottom Information Pill (Name + Volume Indicator + Mic State) */}
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md text-white text-xs font-medium max-w-[80%] truncate">
          <span className="truncate">{name} {isLocal && '(You)'}</span>

          {/* Real-time Voice Volume Indicator Bars */}
          {!isAudioMuted ? (
            <div className="flex items-end gap-[2px] h-3.5 w-4 ml-1 shrink-0" title={`Volume: ${volumeLevel}%`}>
              <span
                style={{ height: `${bar1}%` }}
                className={`w-[2.5px] rounded-full transition-all duration-75 ${
                  isSpeaking ? 'bg-[#D0BCFF]' : 'bg-white/40'
                }`}
              />
              <span
                style={{ height: `${bar2}%` }}
                className={`w-[2.5px] rounded-full transition-all duration-75 ${
                  isSpeaking ? 'bg-[#D0BCFF]' : 'bg-white/40'
                }`}
              />
              <span
                style={{ height: `${bar3}%` }}
                className={`w-[2.5px] rounded-full transition-all duration-75 ${
                  isSpeaking ? 'bg-[#D0BCFF]' : 'bg-white/40'
                }`}
              />
              <span
                style={{ height: `${bar4}%` }}
                className={`w-[2.5px] rounded-full transition-all duration-75 ${
                  isSpeaking ? 'bg-[#D0BCFF]' : 'bg-white/40'
                }`}
              />
            </div>
          ) : (
            <div className="p-0.5 rounded-full bg-rose-500/80 text-white shrink-0 ml-1" title="Microphone muted">
              <MicOff className="w-2.5 h-2.5" />
            </div>
          )}
        </div>

        {/* Local mic status icon on right if muted */}
        {isAudioMuted && (
          <div className="px-2.5 py-1 rounded-full bg-rose-600/90 backdrop-blur-sm text-white text-[11px] font-medium flex items-center gap-1 shadow-sm">
            <MicOff className="w-3 h-3" />
            <span className="hidden sm:inline">Muted</span>
          </div>
        )}
      </div>
    </div>
  );
};

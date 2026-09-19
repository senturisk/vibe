/**
 * Media Utilities: Stream acquisition with graceful fallback and dummy tracks
 */

export function generate4DigitCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function generateRoomId(): string {
  return `vibe-${generate4DigitCode().toLowerCase()}`;
}

export interface MediaAcquireResult {
  stream: MediaStream;
  hasAudio: boolean;
  hasVideo: boolean;
  audioError?: string;
  videoError?: string;
}

/**
 * Creates a silent audio track using Web Audio API so PeerJS calls can safely transmit audio
 */
export function createSilentAudioTrack(): MediaStreamTrack {
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  const oscillator = ctx.createOscillator();
  const dst = ctx.createMediaStreamDestination();
  oscillator.connect(dst);
  oscillator.start();
  const track = dst.stream.getAudioTracks()[0];
  track.enabled = false; // Muted by default
  return track;
}

/**
 * Creates a blank canvas video track for graceful video fallback
 */
export function createBlankVideoTrack(width = 640, height = 360): MediaStreamTrack {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#1e1035';
    ctx.fillRect(0, 0, width, height);
  }
  const stream = canvas.captureStream(10);
  return stream.getVideoTracks()[0];
}

/**
 * Gracefully acquires media streams (Audio + Video), falling back to Audio-only,
 * or synthetic dummy stream if hardware/permissions are missing or denied.
 */
export async function acquireUserMedia(preferredVideoId?: string, preferredAudioId?: string): Promise<MediaAcquireResult> {
  let stream: MediaStream | null = null;
  let hasAudio = false;
  let hasVideo = false;
  let audioError: string | undefined;
  let videoError: string | undefined;

  const audioConstraints: boolean | MediaTrackConstraints = preferredAudioId
    ? { deviceId: { exact: preferredAudioId }, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    : { echoCancellation: true, noiseSuppression: true, autoGainControl: true };

  const videoConstraints: boolean | MediaTrackConstraints = preferredVideoId
    ? { deviceId: { exact: preferredVideoId }, width: { ideal: 1280 }, height: { ideal: 720 } }
    : { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' };

  // 1. Try full Audio + Video
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: audioConstraints,
      video: videoConstraints,
    });
    hasAudio = stream.getAudioTracks().length > 0;
    hasVideo = stream.getVideoTracks().length > 0;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.warn('Initial Audio+Video request failed:', errorMsg);

    // 2. Try Audio only
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
        video: false,
      });
      hasAudio = stream.getAudioTracks().length > 0;
      videoError = 'Camera not available or access denied';
    } catch (audioErr: unknown) {
      audioError = 'Microphone not available or access denied';
      console.warn('Audio-only request failed:', audioErr);

      // 3. Try Video only
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: videoConstraints,
        });
        hasVideo = stream.getVideoTracks().length > 0;
      } catch (videoErr: unknown) {
        videoError = 'Camera not available or access denied';
        console.warn('Video-only request failed:', videoErr);
      }
    }
  }

  // If completely failed, assemble a fallback dummy stream so WebRTC connection doesn't break
  if (!stream) {
    stream = new MediaStream();
  }

  // Ensure there's at least an audio track so connection negotiation works seamlessly
  if (stream.getAudioTracks().length === 0) {
    try {
      const dummyAudio = createSilentAudioTrack();
      stream.addTrack(dummyAudio);
    } catch (e) {
      console.warn('Could not create dummy audio track', e);
    }
  }

  // Ensure there's at least a video track so video senders are properly initialized
  if (stream.getVideoTracks().length === 0) {
    try {
      const dummyVideo = createBlankVideoTrack();
      dummyVideo.enabled = false;
      stream.addTrack(dummyVideo);
    } catch (e) {
      console.warn('Could not create dummy video track', e);
    }
  }

  return {
    stream,
    hasAudio,
    hasVideo,
    audioError,
    videoError,
  };
}

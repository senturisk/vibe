/**
 * Audio Analyser Utility using Web Audio API
 * Accurately detects volume levels and speaking states for local and remote streams
 */
export function createAudioMeter(
  stream: MediaStream,
  onVolumeChange: (volume: number, isSpeaking: boolean) => void
): () => void {
  const audioTracks = stream.getAudioTracks();
  if (audioTracks.length === 0) {
    onVolumeChange(0, false);
    return () => {};
  }

  let audioCtx: AudioContext | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let analyser: AnalyserNode | null = null;
  let animId: number | null = null;
  let isCleanedUp = false;

  try {
    const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtxClass) {
      return () => {};
    }

    audioCtx = new AudioCtxClass();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.6;

    // Create source from the stream
    source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const checkVolume = () => {
      if (isCleanedUp || !analyser) return;

      // Resume suspended context if browser policy requires it
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }

      // Check if any track is enabled and active
      const hasActiveEnabledTrack = stream.getAudioTracks().some(t => t.enabled && t.readyState === 'live');
      if (!hasActiveEnabledTrack) {
        onVolumeChange(0, false);
        animId = requestAnimationFrame(checkVolume);
        return;
      }

      analyser.getByteFrequencyData(dataArray);

      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const average = sum / bufferLength;
      // Scale from 0-128 average to 0-100 normalized
      const normalized = Math.min(100, Math.round((average / 110) * 100));
      const isSpeaking = normalized > 10;

      onVolumeChange(normalized, isSpeaking);
      animId = requestAnimationFrame(checkVolume);
    };

    animId = requestAnimationFrame(checkVolume);
  } catch (err) {
    console.warn('Unable to initialize Web Audio Analyser:', err);
    onVolumeChange(0, false);
  }

  return () => {
    isCleanedUp = true;
    if (animId !== null) {
      cancelAnimationFrame(animId);
    }
    if (source) {
      try {
        source.disconnect();
      } catch {}
    }
    if (analyser) {
      try {
        analyser.disconnect();
      } catch {}
    }
    if (audioCtx && audioCtx.state !== 'closed') {
      audioCtx.close().catch(() => {});
    }
  };
}

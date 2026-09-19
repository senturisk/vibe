/**
 * ScreenAudioMixer: Mixes local microphone audio and screen share audio
 * into a single outgoing WebRTC audio track using the Web Audio API.
 * 
 * Key capabilities:
 * - High-fidelity in-screen/tab audio transmission to all peers.
 * - Independent mic mute control: when mic is muted, screen audio continues playing.
 * - Seamless cleanup and fallback without interrupting the WebRTC peer session.
 */

export class ScreenAudioMixer {
  private audioCtx: AudioContext | null = null;
  private destination: MediaStreamAudioDestinationNode | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private micGain: GainNode | null = null;
  private screenSource: MediaStreamAudioSourceNode | null = null;
  private screenGain: GainNode | null = null;
  private mixedTrack: MediaStreamTrack | null = null;

  public initialize(
    micTrack: MediaStreamTrack | null,
    screenAudioTrack: MediaStreamTrack,
    isMicMuted: boolean
  ): MediaStreamTrack | null {
    try {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

      if (!AudioCtxClass) {
        console.warn('AudioContext not supported in this browser environment');
        return null;
      }

      this.audioCtx = new AudioCtxClass();

      // Resume context if browser started it in suspended state
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch((err) => {
          console.warn('Could not resume mixer AudioContext:', err);
        });
      }

      this.destination = this.audioCtx.createMediaStreamDestination();

      // 1. Hook up screen audio source with unity gain (1.0)
      this.screenSource = this.audioCtx.createMediaStreamSource(
        new MediaStream([screenAudioTrack])
      );
      this.screenGain = this.audioCtx.createGain();
      this.screenGain.gain.setValueAtTime(1.0, this.audioCtx.currentTime);
      this.screenSource.connect(this.screenGain);
      this.screenGain.connect(this.destination);

      // 2. Hook up mic audio source (if available) with independent gain
      if (micTrack) {
        this.micSource = this.audioCtx.createMediaStreamSource(
          new MediaStream([micTrack])
        );
        this.micGain = this.audioCtx.createGain();
        this.micGain.gain.setValueAtTime(isMicMuted ? 0 : 1.0, this.audioCtx.currentTime);
        this.micSource.connect(this.micGain);
        this.micGain.connect(this.destination);
      }

      const tracks = this.destination.stream.getAudioTracks();
      if (tracks.length > 0) {
        this.mixedTrack = tracks[0];
        return this.mixedTrack;
      }

      return null;
    } catch (err) {
      console.error('Failed to initialize ScreenAudioMixer:', err);
      return null;
    }
  }

  /**
   * Updates microphone mute state without affecting screen audio playback.
   */
  public setMicMuted(isMuted: boolean): void {
    if (this.micGain && this.audioCtx) {
      try {
        this.micGain.gain.setValueAtTime(isMuted ? 0 : 1.0, this.audioCtx.currentTime);
      } catch (err) {
        console.warn('Error adjusting mic gain in mixer:', err);
      }
    }
  }

  /**
   * Updates the microphone track (e.g. after user switched mic hardware device).
   */
  public updateMicTrack(newMicTrack: MediaStreamTrack | null, isMicMuted: boolean): void {
    if (!this.audioCtx || !this.destination) return;
    try {
      if (this.micSource) {
        this.micSource.disconnect();
        this.micSource = null;
      }
      if (this.micGain) {
        this.micGain.disconnect();
        this.micGain = null;
      }

      if (newMicTrack) {
        this.micSource = this.audioCtx.createMediaStreamSource(
          new MediaStream([newMicTrack])
        );
        this.micGain = this.audioCtx.createGain();
        this.micGain.gain.setValueAtTime(isMicMuted ? 0 : 1.0, this.audioCtx.currentTime);
        this.micSource.connect(this.micGain);
        this.micGain.connect(this.destination);
      }
    } catch (err) {
      console.warn('Failed to update mic track in mixer:', err);
    }
  }

  public getMixedTrack(): MediaStreamTrack | null {
    return this.mixedTrack;
  }

  /**
   * Teardown and clean up all Web Audio nodes and context.
   */
  public destroy(): void {
    try {
      if (this.screenSource) {
        this.screenSource.disconnect();
        this.screenSource = null;
      }
      if (this.screenGain) {
        this.screenGain.disconnect();
        this.screenGain = null;
      }
      if (this.micSource) {
        this.micSource.disconnect();
        this.micSource = null;
      }
      if (this.micGain) {
        this.micGain.disconnect();
        this.micGain = null;
      }
      if (this.audioCtx && this.audioCtx.state !== 'closed') {
        this.audioCtx.close().catch((err) => {
          console.warn('Error closing mixer AudioContext:', err);
        });
        this.audioCtx = null;
      }
      this.destination = null;
      this.mixedTrack = null;
    } catch (err) {
      console.warn('Error destroying ScreenAudioMixer:', err);
    }
  }
}

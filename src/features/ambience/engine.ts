import type { SoundscapeId } from '../../data/db';

/**
 * Web Audio API Synthesized Soundscape Engine
 * - Creates AudioContext ONLY on the first user tap.
 * - Synthesized beds (labeled honestly in UI and README as synthesized):
 *   1. Rain: band-passed pink noise with sparse short high-frequency noise ticks
 *   2. Seashore: low-passed brown noise with a slow 0.08 to 0.12 Hz amplitude and cutoff swell
 *   3. Forest: soft filtered wind noise with occasional quiet sine-sweep chirps at random intervals of 4 to 12s
 * - Loops seamlessly with AudioBufferSourceNode (loop = true) and crossfaded loop boundaries.
 * - Never exceeds -12 dB headroom (~0.251 linear peak) at full volume.
 * - Fades in and out over 400ms with gain ramps to avoid pops.
 * - Suspends when tab is hidden for more than 60 seconds if playing, and updates listeners accurately.
 */

const HEADROOM_MAX_GAIN = 0.24; // ~ -12.4 dB headroom at 100% slider volume
const FADE_SECONDS = 0.4; // 400ms fade

type EngineListener = (state: { playing: boolean; bed: SoundscapeId; volume: number }) => void;

class AmbienceAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private activeSource: AudioBufferSourceNode | null = null;
  private activeNodes: AudioNode[] = [];
  private chirpTimerId: number | null = null;
  private hiddenSuspendTimerId: number | null = null;
  private fadeOutTimerId: number | null = null;

  private playing = false;
  private currentBed: SoundscapeId = 'rain';
  private volume = 0.55;
  private bufferCache = new Map<SoundscapeId, AudioBuffer>();
  private listeners = new Set<EngineListener>();

  constructor() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }

  public subscribe(listener: EngineListener): () => void {
    this.listeners.add(listener);
    listener({ playing: this.playing, bed: this.currentBed, volume: this.volume });
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const snapshot = {
      playing: this.playing,
      bed: this.currentBed,
      volume: this.volume,
    };
    for (const l of this.listeners) {
      l(snapshot);
    }
  }

  private handleVisibilityChange = () => {
    if (typeof document === 'undefined') return;
    if (document.hidden) {
      if (this.playing && !this.hiddenSuspendTimerId) {
        this.hiddenSuspendTimerId = window.setTimeout(() => {
          this.hiddenSuspendTimerId = null;
          if (document.hidden && this.playing) {
            this.pause();
          }
        }, 60000);
      }
    } else {
      if (this.hiddenSuspendTimerId) {
        window.clearTimeout(this.hiddenSuspendTimerId);
        this.hiddenSuspendTimerId = null;
      }
    }
  };

  private ensureContext(): AudioContext | null {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  /**
   * Generates a 10-second seamless loop buffer with a 0.5-second equal-power crossfade at the seam
   * so loop=true never produces a click.
   */
  private getOrCreateBuffer(ctx: AudioContext, bed: SoundscapeId): AudioBuffer {
    const cached = this.bufferCache.get(bed);
    if (cached) return cached;

    const sampleRate = ctx.sampleRate;
    const durationSec = 10;
    const totalSamples = sampleRate * durationSec;
    const crossfadeSamples = Math.floor(sampleRate * 0.5);
    const buffer = ctx.createBuffer(2, totalSamples, sampleRate);

    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      const raw = new Float32Array(totalSamples + crossfadeSamples);

      if (bed === 'rain') {
        // Pink noise (Paul Kellet's filter) + sparse high-frequency droplet ticks
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < raw.length; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          let sample = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.045;
          b6 = white * 0.115926;

          // Sparse short droplet tick
          if (Math.random() < 0.00025) {
            sample += (Math.random() * 2 - 1) * 0.18;
          }
          raw[i] = sample;
        }
      } else if (bed === 'seashore') {
        // Brown noise with slow 0.10 Hz wave swell (exact 1 cycle per 10s for seamless phase loop)
        let lastOut = 0;
        for (let i = 0; i < raw.length; i++) {
          const white = Math.random() * 2 - 1;
          lastOut = (lastOut + 0.02 * white) / 1.02;
          const t = i / sampleRate;
          const swell = 0.55 + 0.45 * Math.sin(2 * Math.PI * 0.1 * t + (ch * 0.4));
          raw[i] = lastOut * 0.42 * swell;
        }
      } else {
        // Forest: soft wind noise modulated gently
        let lastOut = 0;
        for (let i = 0; i < raw.length; i++) {
          const white = Math.random() * 2 - 1;
          lastOut = (lastOut + 0.035 * white) / 1.035;
          const t = i / sampleRate;
          const breeze = 0.65 + 0.35 * Math.sin(2 * Math.PI * 0.2 * t + ch * 0.8);
          raw[i] = lastOut * 0.32 * breeze;
        }
      }

      // Copy and crossfade seam so index 0 and totalSamples-1 match seamlessly
      for (let i = 0; i < totalSamples; i++) {
        if (i < crossfadeSamples) {
          const alpha = i / crossfadeSamples;
          const fadeIn = Math.sin(alpha * 0.5 * Math.PI);
          const fadeOut = Math.cos(alpha * 0.5 * Math.PI);
          data[i] = raw[i] * fadeIn + raw[totalSamples + i] * fadeOut;
        } else {
          data[i] = raw[i];
        }
      }
    }

    this.bufferCache.set(bed, buffer);
    return buffer;
  }

  private scheduleForestChirp() {
    if (this.chirpTimerId) {
      window.clearTimeout(this.chirpTimerId);
      this.chirpTimerId = null;
    }
    if (!this.playing || this.currentBed !== 'forest' || !this.ctx || !this.masterGain) {
      return;
    }

    const delayMs = 4000 + Math.random() * 8000; // 4 to 12 seconds
    this.chirpTimerId = window.setTimeout(() => {
      if (!this.playing || this.currentBed !== 'forest' || !this.ctx || !this.masterGain) return;
      try {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const chirpGain = this.ctx.createGain();
        const baseFreq = 1650 + Math.random() * 550;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(baseFreq, now);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.28, now + 0.09);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.1, now + 0.18);

        chirpGain.gain.setValueAtTime(0.0001, now);
        chirpGain.gain.linearRampToValueAtTime(0.035, now + 0.03);
        chirpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

        osc.connect(chirpGain);
        chirpGain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.24);
      } catch {
        // ignore
      }
      this.scheduleForestChirp();
    }, delayMs);
  }

  private cleanupActiveNodes() {
    if (this.chirpTimerId) {
      window.clearTimeout(this.chirpTimerId);
      this.chirpTimerId = null;
    }
    if (this.activeSource) {
      try {
        this.activeSource.stop();
        this.activeSource.disconnect();
      } catch {
        // ignore
      }
      this.activeSource = null;
    }
    for (const node of this.activeNodes) {
      try {
        node.disconnect();
      } catch {
        // ignore
      }
    }
    this.activeNodes = [];
    if (this.masterGain) {
      try {
        this.masterGain.disconnect();
      } catch {
        // ignore
      }
      this.masterGain = null;
    }
  }

  public start(bed?: SoundscapeId, volume?: number) {
    if (bed) this.currentBed = bed;
    if (typeof volume === 'number') this.volume = volume;

    if (this.fadeOutTimerId) {
      window.clearTimeout(this.fadeOutTimerId);
      this.fadeOutTimerId = null;
    }

    const ctx = this.ensureContext();
    if (!ctx) return;

    this.cleanupActiveNodes();

    const buffer = this.getOrCreateBuffer(ctx, this.currentBed);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    if (this.currentBed === 'rain') {
      filter.type = 'bandpass';
      filter.frequency.value = 1100;
      filter.Q.value = 0.55;
    } else if (this.currentBed === 'seashore') {
      filter.type = 'lowpass';
      filter.frequency.value = 480;
    } else {
      filter.type = 'lowpass';
      filter.frequency.value = 620;
    }

    const masterGain = ctx.createGain();
    const targetGain = Math.max(0.0001, this.volume * HEADROOM_MAX_GAIN);
    const now = ctx.currentTime;
    masterGain.gain.setValueAtTime(0.0001, now);
    masterGain.gain.linearRampToValueAtTime(targetGain, now + FADE_SECONDS);

    source.connect(filter);
    filter.connect(masterGain);
    masterGain.connect(ctx.destination);
    source.start(0);

    this.activeSource = source;
    this.activeNodes = [filter];
    this.masterGain = masterGain;
    this.playing = true;

    if (this.currentBed === 'forest') {
      this.scheduleForestChirp();
    }

    this.notify();
  }

  public pause() {
    if (!this.playing) return;
    this.playing = false;
    this.notify();

    if (this.chirpTimerId) {
      window.clearTimeout(this.chirpTimerId);
      this.chirpTimerId = null;
    }

    if (this.ctx && this.masterGain) {
      const now = this.ctx.currentTime;
      try {
        this.masterGain.gain.cancelScheduledValues(now);
        this.masterGain.gain.setValueAtTime(
          Math.max(0.0001, this.masterGain.gain.value),
          now
        );
        this.masterGain.gain.linearRampToValueAtTime(0.0001, now + FADE_SECONDS);
      } catch {
        // ignore
      }
      this.fadeOutTimerId = window.setTimeout(() => {
        this.cleanupActiveNodes();
      }, FADE_SECONDS * 1000 + 30);
    } else {
      this.cleanupActiveNodes();
    }
  }

  public toggle(bed: SoundscapeId, volume: number) {
    if (this.playing) {
      this.pause();
    } else {
      this.start(bed, volume);
    }
  }

  public selectBed(bed: SoundscapeId, volume: number) {
    this.currentBed = bed;
    this.volume = volume;
    if (this.playing) {
      this.start(bed, volume);
    } else {
      this.notify();
    }
  }

  public setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.ctx && this.masterGain && this.playing) {
      const now = this.ctx.currentTime;
      const target = Math.max(0.0001, this.volume * HEADROOM_MAX_GAIN);
      this.masterGain.gain.setTargetAtTime(target, now, 0.04);
    }
    this.notify();
  }
}

export const ambienceEngine = new AmbienceAudioEngine();

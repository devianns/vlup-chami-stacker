type SoundName = 'ui' | 'drop' | 'land' | 'milestone' | 'danger' | 'gameOver' | 'saved';

const AudioContextClass = window.AudioContext;

export class GameAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: GainNode | null = null;
  private effects: GainNode | null = null;
  private reverb: ConvolverNode | null = null;
  private timer = 0;
  private nextBeat = 0;
  private beat = 0;
  private enabled = false;

  constructor() {
    document.addEventListener('visibilitychange', () => {
      if (!this.context || !this.enabled) return;
      if (document.hidden) {
        this.stopScheduler();
        void this.context.suspend();
      } else {
        void this.context.resume().then(() => {
          this.nextBeat = this.context!.currentTime + 0.08;
          this.startScheduler();
        });
      }
    });
  }

  isEnabled(): boolean { return this.enabled; }

  async setEnabled(enabled: boolean): Promise<void> {
    this.enabled = enabled;
    if (!enabled) {
      if (this.master && this.context) this.master.gain.setTargetAtTime(0, this.context.currentTime, 0.03);
      this.stopScheduler();
      return;
    }
    this.ensureGraph();
    await this.context!.resume();
    this.master!.gain.setTargetAtTime(0.94, this.context!.currentTime, 0.08);
    this.nextBeat = this.context!.currentTime + 0.08;
    this.startScheduler();
    this.play('ui');
  }

  play(name: SoundName): void {
    if (!this.enabled || !this.context || !this.effects) return;
    const now = this.context.currentTime;
    if (name === 'ui') this.pluck(740, now, 0.09, 0.08, this.effects);
    if (name === 'drop') this.tone(240, 150, now, 0.13, 0.1, 'sine', this.effects);
    if (name === 'land') {
      this.tone(125, 82, now, 0.16, 0.16, 'sine', this.effects);
      this.noise(now, 0.07, 0.035, 500);
    }
    if (name === 'milestone') [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => this.pluck(frequency, now + index * 0.07, 0.22, 0.1, this.effects!));
    if (name === 'danger') {
      this.tone(330, 280, now, 0.18, 0.11, 'triangle', this.effects);
      this.tone(330, 270, now + 0.22, 0.18, 0.09, 'triangle', this.effects);
    }
    if (name === 'gameOver') [392, 329.63, 261.63, 196].forEach((frequency, index) => this.pluck(frequency, now + index * 0.13, 0.34, 0.11, this.effects!));
    if (name === 'saved') [659.25, 783.99, 987.77].forEach((frequency, index) => this.pluck(frequency, now + index * 0.08, 0.2, 0.08, this.effects!));
  }

  private ensureGraph(): void {
    if (this.context) return;
    this.context = new AudioContextClass();
    this.master = this.context.createGain();
    this.music = this.context.createGain();
    this.effects = this.context.createGain();
    this.reverb = this.context.createConvolver();
    this.master.gain.value = 0;
    this.music.gain.value = 0.34;
    this.effects.gain.value = 0.56;
    this.reverb.buffer = this.createImpulse(1.4, 2.4);
    this.music.connect(this.master);
    this.music.connect(this.reverb);
    this.effects.connect(this.master);
    this.effects.connect(this.reverb);
    const wet = this.context.createGain();
    wet.gain.value = 0.18;
    this.reverb.connect(wet).connect(this.master);
    const compressor = this.context.createDynamicsCompressor();
    compressor.threshold.value = -12;
    compressor.knee.value = 12;
    compressor.ratio.value = 5;
    compressor.attack.value = 0.008;
    compressor.release.value = 0.18;
    this.master.connect(compressor).connect(this.context.destination);
  }

  private createImpulse(seconds: number, decay: number): AudioBuffer {
    const length = Math.floor(this.context!.sampleRate * seconds);
    const buffer = this.context!.createBuffer(2, length, this.context!.sampleRate);
    for (let channel = 0; channel < 2; channel += 1) {
      const data = buffer.getChannelData(channel);
      for (let index = 0; index < length; index += 1) data[index] = (Math.random() * 2 - 1) * ((1 - index / length) ** decay);
    }
    return buffer;
  }

  private startScheduler(): void {
    this.stopScheduler();
    this.timer = window.setInterval(() => this.scheduleMusic(), 90);
    this.scheduleMusic();
  }

  private stopScheduler(): void { if (this.timer) window.clearInterval(this.timer); this.timer = 0; }

  private scheduleMusic(): void {
    if (!this.enabled || !this.context || !this.music) return;
    const beatLength = 60 / 86 / 2;
    const melody = [659.25, 783.99, 880, 783.99, 659.25, 587.33, 523.25, 587.33, 659.25, 0, 523.25, 587.33, 659.25, 783.99, 587.33, 0];
    const bass = [130.81, 130.81, 174.61, 174.61, 146.83, 146.83, 196, 196];
    while (this.nextBeat < this.context.currentTime + 0.35) {
      const step = this.beat % melody.length;
      if (melody[step]) this.pluck(melody[step], this.nextBeat, beatLength * 1.35, 0.055, this.music);
      if (this.beat % 4 === 0) this.tone(bass[Math.floor(this.beat / 4) % bass.length], bass[Math.floor(this.beat / 4) % bass.length] * 0.98, this.nextBeat, beatLength * 3.5, 0.042, 'sine', this.music);
      if (this.beat % 8 === 0) this.pad([261.63, 329.63, 392], this.nextBeat, beatLength * 7.5);
      this.nextBeat += beatLength;
      this.beat += 1;
    }
  }

  private pluck(frequency: number, start: number, duration: number, volume: number, destination: AudioNode): void {
    const oscillator = this.context!.createOscillator();
    const gain = this.context!.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.03);
  }

  private tone(from: number, to: number, start: number, duration: number, volume: number, type: OscillatorType, destination: AudioNode): void {
    const oscillator = this.context!.createOscillator();
    const gain = this.context!.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + duration);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.03);
  }

  private pad(frequencies: number[], start: number, duration: number): void {
    frequencies.forEach((frequency) => {
      const oscillator = this.context!.createOscillator();
      const gain = this.context!.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.018, start + 0.3);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain).connect(this.music!);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.05);
    });
  }

  private noise(start: number, duration: number, volume: number, cutoff: number): void {
    const length = Math.max(1, Math.floor(this.context!.sampleRate * duration));
    const buffer = this.context!.createBuffer(1, length, this.context!.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) data[index] = Math.random() * 2 - 1;
    const source = this.context!.createBufferSource();
    const filter = this.context!.createBiquadFilter();
    const gain = this.context!.createGain();
    source.buffer = buffer;
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter).connect(gain).connect(this.effects!);
    source.start(start);
  }
}

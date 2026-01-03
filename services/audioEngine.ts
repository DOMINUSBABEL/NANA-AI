import { WaveType, NoiseType } from '../types';

class AudioEngine {
  private ctx: AudioContext | null = null;
  
  // Mix Bus
  private masterGain: GainNode | null = null;
  
  // FX Bus
  private reverbNode: ConvolverNode | null = null;
  private reverbGain: GainNode | null = null;
  private delayNode: DelayNode | null = null;
  private delayGain: GainNode | null = null;

  // Binaural
  private leftOsc: OscillatorNode | null = null;
  private rightOsc: OscillatorNode | null = null;
  private binauralGain: GainNode | null = null;
  private merger: ChannelMergerNode | null = null;

  // Music
  private musicGain: GainNode | null = null;
  
  // Noise
  private noiseSource: AudioBufferSourceNode | null = null;
  private noiseFilter: BiquadFilterNode | null = null;
  private noiseGain: GainNode | null = null;
  private baseNoiseVolume: number = 0.1; // User set volume
  
  // Adaptive Microphone Logic
  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private micAnalyser: AnalyserNode | null = null;
  private adaptiveInterval: number | null = null;
  private isAdaptive: boolean = false;

  constructor() {
    // Lazy init
  }

  private initContext() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);

      // --- FX Chain ---
      this.reverbNode = this.ctx.createConvolver();
      this.reverbNode.buffer = this.impulseResponse(3.0, 2.5, false); // Long, lush reverb
      this.reverbGain = this.ctx.createGain();
      this.reverbGain.gain.value = 0.3;
      
      this.delayNode = this.ctx.createDelay();
      this.delayNode.delayTime.value = 0.5;
      const delayFeedback = this.ctx.createGain();
      delayFeedback.gain.value = 0.4;
      this.delayNode.connect(delayFeedback);
      delayFeedback.connect(this.delayNode);
      
      this.delayGain = this.ctx.createGain();
      this.delayGain.gain.value = 0.2;

      this.reverbNode.connect(this.reverbGain);
      this.reverbGain.connect(this.masterGain);
      
      this.delayNode.connect(this.delayGain);
      this.delayGain.connect(this.masterGain);
    }
  }

  private impulseResponse(duration: number, decay: number, reverse: boolean): AudioBuffer {
    const sampleRate = this.ctx!.sampleRate;
    const length = sampleRate * duration;
    const impulse = this.ctx!.createBuffer(2, length, sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);
    for (let i = 0; i < length; i++) {
      const n = reverse ? length - i : i;
      left[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / length, decay);
      right[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / length, decay);
    }
    return impulse;
  }

  public async resume() {
    this.initContext();
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  // --- Adaptive Microphone Logic ---
  
  public async enableAdaptiveNoise(enable: boolean) {
    this.isAdaptive = enable;
    if (enable) {
      try {
        if (!this.micStream) {
          this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        }
        this.initContext();
        if (this.ctx && !this.micSource) {
           this.micSource = this.ctx.createMediaStreamSource(this.micStream);
           this.micAnalyser = this.ctx.createAnalyser();
           this.micAnalyser.fftSize = 256;
           this.micSource.connect(this.micAnalyser);
           // We do NOT connect mic to destination to avoid feedback loop
        }
        this.startAdaptiveLoop();
      } catch (err) {
        console.warn("Microphone access denied or error:", err);
        this.isAdaptive = false;
      }
    } else {
      this.stopAdaptiveLoop();
      // Reset volume to user base
      this.updateNoiseGain(this.baseNoiseVolume);
    }
  }

  private startAdaptiveLoop() {
    if (this.adaptiveInterval) window.clearInterval(this.adaptiveInterval);
    
    this.adaptiveInterval = window.setInterval(() => {
      if (!this.micAnalyser || !this.isAdaptive || !this.noiseGain) return;

      const dataArray = new Uint8Array(this.micAnalyser.frequencyBinCount);
      this.micAnalyser.getByteFrequencyData(dataArray);

      // Calculate simple average volume (RMS-ish)
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length;
      
      // Map 0-255 average input to a volume boost
      // Threshold: only boost if average > 20
      let boost = 0;
      if (average > 20) {
        // Max boost of +0.3
        boost = Math.min((average - 20) / 200, 0.3);
      }

      const targetVol = Math.min(this.baseNoiseVolume + boost, 0.8); // Cap at 0.8
      
      // Smooth transition
      if (this.ctx) {
        this.noiseGain.gain.setTargetAtTime(targetVol, this.ctx.currentTime, 0.5);
      }
    }, 500); // Check every 500ms
  }

  private stopAdaptiveLoop() {
    if (this.adaptiveInterval) {
      window.clearInterval(this.adaptiveInterval);
      this.adaptiveInterval = null;
    }
  }

  // --- Noise Logic (Updated for Gain Control) ---

  private updateNoiseGain(vol: number) {
     if (this.noiseGain && this.ctx) {
        this.noiseGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.2);
     }
  }

  public setNoiseVolume(val: number) {
    this.baseNoiseVolume = val;
    // If not adaptive, set directly. If adaptive, the loop will handle it relative to this base.
    if (!this.isAdaptive) {
       this.updateNoiseGain(val);
    }
  }
  
  public startNoise(type: NoiseType, volume: number) {
    this.initContext();
    if (!this.ctx) return;
    this.baseNoiseVolume = volume;
    
    // Check if we need to restart
    // If running, just update type? Hard to update buffer type on fly, simpler to restart
    this.stopNoise();
    if (type === NoiseType.OFF) return;

    const bufferSize = this.ctx.sampleRate * 2; 
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    this.noiseSource = this.ctx.createBufferSource();
    this.noiseSource.buffer = buffer;
    this.noiseSource.loop = true;

    this.noiseFilter = this.ctx.createBiquadFilter();
    
    if (type === NoiseType.GREY) {
      this.noiseFilter.type = 'lowpass';
      this.noiseFilter.frequency.value = 500; 
      this.noiseFilter.Q.value = 0.5;
    } else if (type === NoiseType.BROWN) {
      this.noiseFilter.type = 'lowpass';
      this.noiseFilter.frequency.value = 150; 
      this.noiseFilter.Q.value = 1;
    } else {
      this.noiseFilter.type = 'allpass'; 
    }

    this.noiseGain = this.ctx.createGain();
    this.noiseGain.gain.value = volume;

    this.noiseSource.connect(this.noiseFilter);
    this.noiseFilter.connect(this.noiseGain);
    this.noiseGain.connect(this.masterGain!);

    this.noiseSource.start();
  }

  public stopNoise() {
    if (this.noiseSource) { try { this.noiseSource.stop(); this.noiseSource.disconnect(); } catch {} }
    this.noiseSource = null;
  }

  // --- Music Logic (Enriched Dual Oscillator) ---

  public setMusicVolume(val: number) {
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setTargetAtTime(val, this.ctx.currentTime, 0.1);
    }
  }

  private getFrequency(note: string): number {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = parseInt(note.slice(-1));
    const key = note.slice(0, -1);
    const semitone = notes.indexOf(key);
    if (semitone === -1) return 200; 
    const midiBase = (octave + 1) * 12 + semitone;
    return 440 * Math.pow(2, (midiBase - 69) / 12);
  }

  public playComposition(notes: {note: string, duration: number, startTime: number}[]) {
    this.initContext();
    if (!this.ctx) return;
    
    if (!this.musicGain) {
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.3; 
      this.musicGain.connect(this.masterGain!);
      
      if (this.reverbNode && this.reverbGain) this.musicGain.connect(this.reverbNode);
      if (this.delayNode && this.delayGain) this.musicGain.connect(this.delayNode);
    }

    const now = this.ctx.currentTime;
    
    notes.forEach(n => {
        const freq = this.getFrequency(n.note);
        
        // --- Enriched Sound: Dual Oscillators per Note ---
        // Oscillator 1: Main body
        const osc1 = this.ctx!.createOscillator();
        const osc1Gain = this.ctx!.createGain();
        osc1.frequency.value = freq;
        osc1.type = 'sine'; // Pure base
        
        // Oscillator 2: Detuned "Chorus" Layer (creates warmth/thickness)
        const osc2 = this.ctx!.createOscillator();
        const osc2Gain = this.ctx!.createGain();
        osc2.frequency.value = freq;
        osc2.detune.value = 8; // +8 cents
        osc2.type = 'triangle'; // Richer harmonics
        
        // Connect Oscs to their envelopes
        osc1.connect(osc1Gain);
        osc2.connect(osc2Gain);
        
        // Stereo Panning (Simple) - Osc 1 slightly Left, Osc 2 slightly Right
        const merger = this.ctx!.createChannelMerger(2);
        osc1Gain.connect(merger, 0, 0); // Left
        osc2Gain.connect(merger, 0, 1); // Right
        
        merger.connect(this.musicGain!);

        const startTime = now + n.startTime;
        const duration = n.duration;
        const attack = duration * 0.3;
        const release = duration * 0.3;

        // Envelope 1 (Softer)
        osc1Gain.gain.setValueAtTime(0, startTime);
        osc1Gain.gain.linearRampToValueAtTime(0.2, startTime + attack); 
        osc1Gain.gain.setValueAtTime(0.2, startTime + duration - release); 
        osc1Gain.gain.linearRampToValueAtTime(0, startTime + duration); 
        
        // Envelope 2 (More subtle)
        osc2Gain.gain.setValueAtTime(0, startTime);
        osc2Gain.gain.linearRampToValueAtTime(0.1, startTime + attack); 
        osc2Gain.gain.setValueAtTime(0.1, startTime + duration - release); 
        osc2Gain.gain.linearRampToValueAtTime(0, startTime + duration); 

        osc1.start(startTime);
        osc1.stop(startTime + duration);
        osc2.start(startTime);
        osc2.stop(startTime + duration);
    });
  }

  // --- Binaural & FX Controls (Standard) ---
  public setReverbMix(value: number) {
    if (this.reverbGain && this.ctx) this.reverbGain.gain.setTargetAtTime(value, this.ctx.currentTime, 0.1);
  }
  public setDelayMix(value: number) {
    if (this.delayGain && this.ctx) this.delayGain.gain.setTargetAtTime(value, this.ctx.currentTime, 0.1);
  }
  public setBinauralVolume(val: number) {
    if (this.binauralGain && this.ctx) this.binauralGain.gain.setTargetAtTime(val, this.ctx.currentTime, 0.1);
  }
  public startBinaural(carrierFreq: number, beatFreq: number, volume: number) {
    this.initContext();
    if (!this.ctx) return;
    this.stopBinaural();
    this.merger = this.ctx.createChannelMerger(2);
    this.binauralGain = this.ctx.createGain();
    this.binauralGain.gain.value = volume;
    this.merger.connect(this.binauralGain);
    this.binauralGain.connect(this.masterGain!);

    this.leftOsc = this.ctx.createOscillator();
    this.leftOsc.type = 'sine';
    this.leftOsc.frequency.value = carrierFreq;
    const leftChGain = this.ctx.createGain();
    leftChGain.gain.value = 0.5;
    this.leftOsc.connect(leftChGain);
    leftChGain.connect(this.merger, 0, 0);

    this.rightOsc = this.ctx.createOscillator();
    this.rightOsc.type = 'sine';
    this.rightOsc.frequency.value = carrierFreq + beatFreq;
    const rightChGain = this.ctx.createGain();
    rightChGain.gain.value = 0.5;
    this.rightOsc.connect(rightChGain);
    rightChGain.connect(this.merger, 0, 1);

    this.leftOsc.start(this.ctx.currentTime);
    this.rightOsc.start(this.ctx.currentTime);
  }
  public stopBinaural() {
    if (this.leftOsc) { try { this.leftOsc.stop(); this.leftOsc.disconnect(); } catch {} }
    if (this.rightOsc) { try { this.rightOsc.stop(); this.rightOsc.disconnect(); } catch {} }
    this.leftOsc = null;
    this.rightOsc = null;
  }
  public stopAll() {
    this.stopBinaural();
    this.stopNoise();
    this.stopAdaptiveLoop();
    if (this.micStream) {
       this.micStream.getTracks().forEach(track => track.stop());
       this.micStream = null;
       this.micSource = null;
    }
    if (this.masterGain && this.ctx) {
       this.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.5);
       setTimeout(() => { if (this.masterGain) this.masterGain.gain.value = 1; }, 500);
    }
  }
}

export const audioEngine = new AudioEngine();

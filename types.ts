export enum WaveType {
  SINE = 'sine',
  TRIANGLE = 'triangle',
}

export enum BrainwaveState {
  DELTA = 'Delta (Sleep)',
  THETA = 'Theta (Deep Relax)',
  ALPHA = 'Alpha (Calm)',
}

export enum NoiseType {
  OFF = 'off',
  WHITE = 'white',
  GREY = 'grey',
  BROWN = 'brown',
}

export interface NoteEvent {
  note: string;
  duration: number;
  startTime: number;
  velocity: number;
}

export interface Composition {
  name: string;
  bpm: number;
  key?: string; // e.g. "D Major"
  notes: NoteEvent[];
  description: string;
  tags?: string[]; 
}

export interface AudioState {
  isPlaying: boolean;
  masterVolume: number;
  binauralVolume: number;
  musicVolume: number;
  noiseVolume: number;
  noiseType: NoiseType;
  carrierFreq: number;
  beatFreq: number;
  reverbMix: number;
  delayMix: number;
  isAdaptiveNoise: boolean; // New flag
}

export interface AgenticConfig {
  stationName: string;
  carrierFreq: number;
  beatFreq: number;
  noiseType: NoiseType;
  noiseVolume: number;
  musicPrompt: string;
  reasoning: string;
}

export interface PersonalizationParams {
  babyName?: string;
  babyType?: 'Sensitive' | 'Active' | 'Colic' | 'Newborn';
  currentEmotion?: 'Crying' | 'Restless' | 'Playful' | 'Overtired';
  timeOfDay?: 'Nap' | 'Night' | 'Witching Hour';
  environment?: 'City' | 'Quiet' | 'Stormy';
}

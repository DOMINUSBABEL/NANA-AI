# NanaIA: A Neuro-Adaptive Generative Audio System for Pediatric Sleep Induction

**Authors:** NanaIA Engineering Team  
**Date:** October 2023  
**Subject:** Human-Computer Interaction; Audio Signal Processing; Generative AI

---

## Abstract

NanaIA proposes a novel architecture for pediatric sleep aid utilizing a hybrid approach of browser-based digital signal processing (DSP) and Large Language Model (LLM) agentic orchestration. The system combines real-time binaural beat generation, adaptive noise masking via local microphone analysis, and an infinite, non-repeating musical stream composed by generative AI. This paper outlines the technical blueprint of the system, detailing the dual-oscillator synthesis engine, the harmonic alignment algorithms, and the multi-agent personalization framework.

## 1. Introduction

Traditional sleep aids rely on static loops of white noise or pre-recorded lullabies. While effective, these methods lack personalization and adaptability to the immediate environment or the subject's changing physiological state. NanaIA addresses these limitations by creating a dynamic audio environment that evolves in real-time. By leveraging the Gemini 3 Flash model for compositional logic and the Web Audio API for sound generation, NanaIA achieves a low-latency, highly personalized sleep experience.

## 2. System Architecture

The architecture is divided into three primary layers: The Client-Side DSP Engine, the Agentic Orchestration Layer, and the User Interface Control Plane.

### 2.1 Audio Engine (DSP)
The core of NanaIA is a custom `AudioEngine` class built upon the Web Audio API. It features a completely procedural signal chain:

*   **Binaural Generator:** Two precise `OscillatorNodes` (Sine wave) are panned hard-left and hard-right. The frequency difference ($\Delta f$) corresponds to the target brainwave state (Delta, Theta, Alpha).
*   **Dual-Oscillator Synthesis:** The musical component utilizes a dual-oscillator architecture per note. Osc 1 acts as the fundamental, while Osc 2 is detuned (+8 cents) and panned to create a "chorusing" effect, simulating analog warmth.
*   **Adaptive Noise Masking:** An `AnalyserNode` processes the microphone input buffer locally. A feedback loop calculates the RMS amplitude of ambient noise and inversely modulates the gain of the generated colored noise (White/Grey/Brown), effectively masking sudden external sounds without recording audio data.
*   **Spatial FX Chain:** A convolution reverb (`ConvolverNode`) using procedurally generated impulse responses provides spatial depth, while a feedback delay adds rhythmic texture.

### 2.2 Agentic Orchestration (LLM)
NanaIA utilizes Google's Gemini 3 Flash model to function as a multi-agent system:
1.  **The Physiologist Agent:** Analyzes the child's state (e.g., "Colic", "Overtired") to determine the optimal carrier frequency and binaural beat delta.
2.  **The Composer Agent:** Generates JSON-structured musical compositions. It adheres to strict harmonic constraints, ensuring the generated melody key aligns with the binaural carrier frequency (e.g., 200Hz $\approx$ G3) to prevent dissonance.

## 3. Methodology

### 3.1 Harmonic Alignment Algorithm
To ensure psychoacoustic comfort, the system calculates the approximate musical key of the binaural carrier tone:

$$ Key_{approx} = f_{carrier} \rightarrow Note_{closest} $$

The Generative AI is then prompted to compose strictly within the Major or Lydian mode of this key. This creates a drone-like harmonic anchor, enhancing the hypnotic effect of the lullaby.

### 3.2 Adaptive Tempo
The BPM of the generated composition is dynamically linked to the target sleep cycle:
*   **Delta State (1-3Hz):** Target 30-45 BPM.
*   **Theta State (4-7Hz):** Target 50-70 BPM.
*   **Alpha State (8-12Hz):** Target 70-90 BPM.

## 4. Implementation Details

The application is implemented in **React 19** and **TypeScript**.

*   **State Management:** React Hooks manage the complex interplay between the UI state and the imperative AudioContext.
*   **Inference:** The `@google/genai` SDK handles real-time requests to the Gemini API.
*   **Privacy:** All microphone analysis occurs within the browser's memory; no audio data is ever transmitted to a server.

## 5. Future Work

Future iterations will explore:
*   **Biometric Feedback:** Integration with wearable APIs to adjust BPM based on real-time heart rate.
*   **Fourier Re-synthesis:** Using AI to generate spectral databanks for the Web Audio oscillators to simulate realistic instruments (Celesta, Harp) dynamically.

---
*NanaIA Technical Blueprint v1.0*

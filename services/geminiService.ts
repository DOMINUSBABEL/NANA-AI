import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Composition, AgenticConfig, PersonalizationParams } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const noteSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    note: { type: Type.STRING },
    duration: { type: Type.NUMBER },
    startTime: { type: Type.NUMBER },
  },
  required: ["note", "duration", "startTime"],
};

const compositionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    description: { type: Type.STRING },
    bpm: { type: Type.NUMBER },
    key: { type: Type.STRING },
    notes: { type: Type.ARRAY, items: noteSchema }
  },
  required: ["name", "notes", "bpm", "description"]
};

const agenticConfigSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    stationName: { type: Type.STRING },
    carrierFreq: { type: Type.NUMBER },
    beatFreq: { type: Type.NUMBER },
    noiseType: { type: Type.STRING, enum: ['off', 'white', 'grey', 'brown'] },
    noiseVolume: { type: Type.NUMBER },
    musicPrompt: { type: Type.STRING },
    reasoning: { type: Type.STRING },
  },
  required: ["stationName", "carrierFreq", "beatFreq", "noiseType", "musicPrompt", "reasoning"]
};

// --- HELPER: Hz to Musical Key Approximation ---
function getApproximateKey(hz: number): string {
    if (hz < 155) return "D3";
    if (hz < 165) return "Eb3";
    if (hz < 175) return "E3";
    if (hz < 185) return "F3";
    if (hz < 196) return "F#3";
    if (hz < 208) return "G3";
    if (hz < 220) return "Ab3";
    return "A3";
}

// --- HELPER: Beat Freq to BPM ---
function getTargetBPM(beatFreq: number): string {
    // Delta (0.5 - 4Hz) -> Slow BPM
    if (beatFreq <= 4) return "30-50 BPM (Largo)";
    // Theta (4 - 8Hz) -> Med BPM
    if (beatFreq <= 8) return "50-70 BPM (Adagio)";
    // Alpha/Beta -> Faster
    return "70-90 BPM (Andante)";
}

export const generateLullaby = async (
  mood: string, 
  previousContext?: string, 
  carrierFreq: number = 200, 
  beatFreq: number = 4
): Promise<Composition | null> => {
  try {
    const musicalKey = getApproximateKey(carrierFreq);
    const targetBPM = getTargetBPM(beatFreq);

    const prompt = `
      Context: The Binaural carrier is ${carrierFreq}Hz (Approx ${musicalKey}). 
      The Target Sleep Cycle BPM is ${targetBPM}.
      Atmosphere: ${mood}.
      
      Task: Generate a rich, multi-layered ambient loop (15-20s).
      
      Musical Rules:
      1. Key: Compose strictly in the key of ${musicalKey} (Major or Lydian) to harmonize with the carrier drone.
      2. Harmony: Use chords (multiple notes with same startTime) or lush intervals (3rds, 5ths, 9ths).
      3. Rhythm: Polyrhythmic feel, but gentle. Avoid rigid grid.
      4. Instrumentation: Pad-like, sustained notes.
      ${previousContext ? `Variation: Evolve from previous track "${previousContext}".` : ''}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: compositionSchema,
      }
    });

    const text = response.text;
    if (!text) return null;
    return JSON.parse(text) as Composition;
  } catch (error) {
    console.error("Composer Error:", error);
    return null;
  }
};

export const orchestrateExperience = async (userPrompt: string, params?: PersonalizationParams): Promise<AgenticConfig | null> => {
   // Existing orchestrator logic stays mostly same, just ensuring prompt quality
   const context = params ? `Baby:${params.babyType}, Emotion:${params.currentEmotion}, Time:${params.timeOfDay}, Env:${params.environment}` : '';
   const systemPrompt = `
      Act as Sleep Scientist. User Request: "${userPrompt}". Context: ${context}.
      Output JSON config. Choose freq based on sleep science (Delta=Sleep, Theta=Relax).
   `;
   try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: systemPrompt,
      config: { responseMimeType: "application/json", responseSchema: agenticConfigSchema }
    });
    if (!response.text) return null;
    return JSON.parse(response.text) as AgenticConfig;
   } catch (e) { return null; }
}

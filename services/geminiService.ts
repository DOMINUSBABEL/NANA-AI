import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Composition, AgenticConfig, PersonalizationParams, MusicalSettings } from "../types";

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
    if (beatFreq <= 4) return "30-50 BPM (Largo)";
    if (beatFreq <= 8) return "50-70 BPM (Adagio)";
    return "70-90 BPM (Andante)";
}

export const generateLullaby = async (
  mood: string, 
  previousContext?: string, 
  carrierFreq: number = 200, 
  beatFreq: number = 4,
  musicalSettings?: MusicalSettings
): Promise<Composition | null> => {
  try {
    const musicalKey = getApproximateKey(carrierFreq);
    const targetBPM = getTargetBPM(beatFreq);

    // Construct constraint string based on user settings
    let musicalConstraints = `1. Key: Compose strictly in the key of ${musicalKey} to harmonize with the carrier drone.`;
    
    if (musicalSettings?.scale && musicalSettings.scale !== 'Auto') {
        musicalConstraints += `\n      2. Scale: Use the ${musicalSettings.scale} scale/mode strictly.`;
    } else {
        musicalConstraints += `\n      2. Scale: Use Major or Lydian mode.`;
    }

    let styleInstruction = "Pad-like, sustained notes.";
    if (musicalSettings?.style && musicalSettings.style !== 'Auto') {
        if (musicalSettings.style === 'Bells') styleInstruction = "Short attack, long decay, sparse bell-like clusters.";
        if (musicalSettings.style === 'Piano') styleInstruction = "Gentle piano voicing, arpeggiated slow chords.";
        if (musicalSettings.style === 'Minimal') styleInstruction = "Very sparse, only 3-4 notes total, long duration.";
    }

    const specificMood = (musicalSettings?.mood && musicalSettings.mood !== 'Auto') ? musicalSettings.mood : mood;

    const prompt = `
      Context: The Binaural carrier is ${carrierFreq}Hz (Approx ${musicalKey}). 
      The Target Sleep Cycle BPM is ${targetBPM}.
      Atmosphere/Mood: ${specificMood}.
      
      Task: Generate a rich, multi-layered ambient loop (15-20s).
      
      Musical Rules:
      ${musicalConstraints}
      3. Rhythm: Polyrhythmic feel, but gentle. Avoid rigid grid.
      4. Style/Instrumentation: ${styleInstruction}
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
   const context = params ? `Baby:${params.babyType}, Emotion:${params.currentEmotion}, Time:${params.timeOfDay}, Env:${params.environment}` : '';
   
   // We inject the musical preference into the context for the agent to consider
   const musicalPref = params?.musicalSettings ? `Preferred Scale: ${params.musicalSettings.scale}, Preferred Style: ${params.musicalSettings.style}` : '';

   const systemPrompt = `
      Act as Sleep Scientist. User Request: "${userPrompt}". 
      Context: ${context}. ${musicalPref}.
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

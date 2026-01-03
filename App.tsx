import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Play, Pause, RefreshCw, Volume2, Moon, Radio, 
  Wind, Waves, Timer, Settings, Clock, Sparkles, 
  Mic, MicOff, Save, Download, Sliders, X
} from 'lucide-react';
import { audioEngine } from './services/audioEngine';
import { generateLullaby, orchestrateExperience } from './services/geminiService';
import Visualizer from './components/Visualizer';
import { Composition, NoiseType, PersonalizationParams, AgenticConfig } from './types';

// --- CONSTANTS ---
const STATIONS = [
  { id: 'delta', name: 'Estación Profunda', carrier: 150, beat: 2.5, desc: 'Ondas Delta (1-3Hz)', mood: 'Deep sleep, cosmic, heavy slow pads' },
  { id: 'theta', name: 'Estación Sueños', carrier: 180, beat: 5, desc: 'Ondas Theta (4-7Hz)', mood: 'Dreamy, fantasy, soft shimmer' },
  { id: 'alpha', name: 'Estación Calma', carrier: 200, beat: 10, desc: 'Ondas Alpha (8-12Hz)', mood: 'Peaceful, morning light, gentle' },
];

interface SavedPreset {
  id: string;
  name: string;
  config: AgenticConfig;
  composition: Composition;
  date: number;
}

export default function App() {
  // --- STATE ---
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Audio Config
  const [currentStation, setCurrentStation] = useState(STATIONS[0]);
  const [volBinaural, setVolBinaural] = useState(0.5);
  const [volMusic, setVolMusic] = useState(0.4);
  const [volNoise, setVolNoise] = useState(0.15);
  const [reverbMix, setReverbMix] = useState(0.3);
  const [delayMix, setDelayMix] = useState(0.2);
  const [noiseType, setNoiseType] = useState<NoiseType>(NoiseType.OFF);
  
  // Adaptive Features
  const [isAdaptive, setIsAdaptive] = useState(false);
  
  // Timer
  const [timerDuration, setTimerDuration] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [showTimerModal, setShowTimerModal] = useState(false);
  const [inputMinutes, setInputMinutes] = useState(30);

  // Music & AI
  const [composition, setComposition] = useState<Composition | null>(null);
  const [nextComposition, setNextComposition] = useState<Composition | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [agentStatus, setAgentStatus] = useState<string>('');
  
  // Advanced Studio
  const [showStudio, setShowStudio] = useState(false);
  const [magicPrompt, setMagicPrompt] = useState('');
  const [personalParams, setPersonalParams] = useState<PersonalizationParams>({
    babyType: 'Sensitive',
    currentEmotion: 'Restless',
    timeOfDay: 'Night',
    environment: 'Quiet'
  });

  // Offline Library
  const [library, setLibrary] = useState<SavedPreset[]>([]);
  const [showLibrary, setShowLibrary] = useState(false);

  const musicLoopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- INIT ---
  useEffect(() => {
    const saved = localStorage.getItem('nanaia_library');
    if (saved) {
      try { setLibrary(JSON.parse(saved)); } catch (e) { console.error("Load failed", e); }
    }
  }, []);

  // --- AUDIO SYNC ---
  useEffect(() => {
    audioEngine.resume();
    if (isPlaying) {
      audioEngine.startBinaural(currentStation.carrier, currentStation.beat, volBinaural);
      audioEngine.startNoise(noiseType, volNoise);
      audioEngine.setMusicVolume(volMusic);
      audioEngine.setReverbMix(reverbMix);
      audioEngine.setDelayMix(delayMix);
      audioEngine.enableAdaptiveNoise(isAdaptive);
      playMusicLoop();
    } else {
      audioEngine.stopAll();
      if (musicLoopRef.current) clearTimeout(musicLoopRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, currentStation, noiseType, reverbMix, delayMix, isAdaptive]);

  useEffect(() => audioEngine.setBinauralVolume(volBinaural), [volBinaural]);
  useEffect(() => audioEngine.setMusicVolume(volMusic), [volMusic]);
  useEffect(() => audioEngine.setNoiseVolume(volNoise), [volNoise]);
  useEffect(() => audioEngine.setReverbMix(reverbMix), [reverbMix]);
  useEffect(() => audioEngine.setDelayMix(delayMix), [delayMix]);

  // --- TIMER ---
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isPlaying && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) { setIsPlaying(false); return 0; }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, timeLeft]);

  // --- AGENTIC ORCHESTRATION ---
  const handleMagicAgent = async () => {
    if (!magicPrompt.trim()) return;
    setIsGenerating(true);
    setAgentStatus('Analizando petición...');

    const config = await orchestrateExperience(magicPrompt, personalParams);
    
    if (config) {
      setAgentStatus('Configurando motor de audio...');
      setCurrentStation({
        id: 'custom',
        name: config.stationName,
        carrier: config.carrierFreq,
        beat: config.beatFreq,
        desc: 'Configuración personalizada por IA',
        mood: config.musicPrompt
      });
      setNoiseType(config.noiseType);
      
      setAgentStatus('Armonizando melodía...');
      // Pass the specific frequencies to align melody key
      const newComp = await generateLullaby(
          config.musicPrompt, 
          undefined, 
          config.carrierFreq, 
          config.beatFreq
      );
      if (newComp) {
        setComposition(newComp);
        setNextComposition(null);
        if (isPlaying) {
             if (musicLoopRef.current) clearTimeout(musicLoopRef.current);
             playMusicLoop(); 
        }
      }
    }
    setAgentStatus('');
    setIsGenerating(false);
    setShowStudio(false);
  };

  // --- MUSIC LOOP ---
  const generateNextSegment = async () => {
    setIsGenerating(true);
    const prevContext = composition ? composition.name : '';
    // Pass current station frequencies for harmonic alignment
    const newComp = await generateLullaby(
        currentStation.mood, 
        prevContext,
        currentStation.carrier,
        currentStation.beat
    );
    if (newComp) {
      if (!composition) setComposition(newComp);
      else setNextComposition(newComp);
    }
    setIsGenerating(false);
  };

  const playMusicLoop = useCallback(() => {
    if (!isPlaying) return;
    const track = nextComposition || composition;
    
    if (track) {
      if (track === nextComposition) {
        setComposition(nextComposition);
        setNextComposition(null);
        generateNextSegment();
      } else if (!nextComposition && !isGenerating) {
        generateNextSegment();
      }

      audioEngine.playComposition(track.notes);
      
      const maxDuration = Math.max(...track.notes.map(n => n.startTime + n.duration)) || 15;
      const loopTimeMs = (maxDuration) * 1000; 

      if (musicLoopRef.current) clearTimeout(musicLoopRef.current);
      musicLoopRef.current = setTimeout(() => playMusicLoop(), loopTimeMs);
    } else {
      if (!isGenerating && !composition) generateNextSegment();
      musicLoopRef.current = setTimeout(playMusicLoop, 1000);
    }
  }, [isPlaying, composition, nextComposition, isGenerating, currentStation]);

  // --- PRESETS ---
  const savePreset = () => {
    if (!composition) return;
    const newPreset: SavedPreset = {
      id: Date.now().toString(),
      name: currentStation.name === 'Estación Personalizada' ? `Sesión ${new Date().toLocaleTimeString()}` : currentStation.name,
      config: {
        stationName: currentStation.name,
        carrierFreq: currentStation.carrier,
        beatFreq: currentStation.beat,
        noiseType: noiseType,
        noiseVolume: volNoise,
        musicPrompt: currentStation.mood,
        reasoning: 'User saved'
      },
      composition: composition,
      date: Date.now()
    };
    const updated = [newPreset, ...library];
    setLibrary(updated);
    localStorage.setItem('nanaia_library', JSON.stringify(updated));
    alert('Sesión guardada.');
  };

  const loadPreset = (preset: SavedPreset) => {
    setCurrentStation({
      id: 'saved',
      name: preset.config.stationName,
      carrier: preset.config.carrierFreq,
      beat: preset.config.beatFreq,
      desc: 'Desde Biblioteca',
      mood: preset.config.musicPrompt
    });
    setNoiseType(preset.config.noiseType);
    setComposition(preset.composition);
    setShowLibrary(false);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="relative min-h-screen w-full bg-slate-950 text-slate-200 overflow-hidden font-sans selection:bg-indigo-500/30">
      
      <Visualizer isPlaying={isPlaying} beatFreq={currentStation.beat} />

      {/* --- TOP BAR --- */}
      <header className="fixed top-0 w-full z-30 bg-slate-950/80 backdrop-blur-md border-b border-white/5 px-4 md:px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${isPlaying ? 'bg-indigo-500 animate-pulse' : 'bg-slate-600'}`}></div>
          <h1 className="text-xl font-light tracking-widest uppercase text-slate-400 hidden md:block">
            Nana<span className="font-bold text-white">IA</span> LAB
          </h1>
          <h1 className="text-lg font-bold text-white md:hidden">NanaIA</h1>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          {timeLeft > 0 && (
            <div className="flex items-center gap-2 text-indigo-300 bg-indigo-900/30 px-3 py-1 rounded-full text-xs font-mono border border-indigo-500/30">
              <Clock className="w-3 h-3" />
              <span>{formatTime(timeLeft)}</span>
            </div>
          )}
          
          <button onClick={() => setShowLibrary(true)} className="p-2 hover:bg-white/10 rounded-full text-slate-400">
            <Save className="w-5 h-5" />
          </button>

          <button onClick={() => setShowStudio(true)} className="p-2 bg-indigo-600 hover:bg-indigo-500 rounded-full text-white shadow-lg shadow-indigo-500/30 transition-all">
            <Sparkles className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* --- MAIN --- */}
      <main className="relative z-10 container mx-auto px-4 pt-24 pb-40 max-w-3xl flex flex-col items-center">
        
        <div className="mb-8 text-center space-y-4">
           {agentStatus && (
             <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs animate-pulse">
               <RefreshCw className="w-3 h-3 animate-spin" />
               {agentStatus}
             </div>
           )}
           
           <h2 className="text-4xl md:text-6xl font-thin text-white tracking-tight drop-shadow-lg">
             {currentStation.name}
           </h2>
           <div className="flex flex-wrap justify-center gap-2 text-slate-400 text-sm">
             <span className="bg-slate-900/50 px-3 py-1 rounded-full border border-white/5">{currentStation.desc}</span>
             {composition?.key && <span className="bg-indigo-900/30 px-3 py-1 rounded-full border border-indigo-500/20 text-indigo-300 text-xs">Tono: {composition.key}</span>}
           </div>
        </div>

        {/* --- MIXER --- */}
        <div className="w-full bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl">
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div className="space-y-3">
                 <div className="flex justify-between text-indigo-300 text-sm font-medium">
                    <span className="flex items-center gap-2"><Waves className="w-4 h-4" /> Binaural</span>
                    <span>{Math.round(volBinaural * 100)}%</span>
                 </div>
                 <input type="range" max="1" step="0.01" value={volBinaural} onChange={e => setVolBinaural(Number(e.target.value))} className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-400" />
              </div>

              <div className="space-y-3">
                 <div className="flex justify-between text-pink-300 text-sm font-medium">
                    <span className="flex items-center gap-2"><Radio className="w-4 h-4" /> Melodía IA</span>
                    <span>{Math.round(volMusic * 100)}%</span>
                 </div>
                 <input type="range" max="1" step="0.01" value={volMusic} onChange={e => setVolMusic(Number(e.target.value))} className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-pink-400" />
              </div>
           </div>

           {/* Noise & Mic Section */}
           <div className="mb-4 space-y-2 p-4 bg-slate-800/30 rounded-xl border border-white/5">
              <div className="flex justify-between items-center text-xs text-slate-400 uppercase tracking-wider mb-2">
                 <div className="flex items-center gap-2">
                   <span>Atmósfera</span>
                   <button 
                    onClick={() => setIsAdaptive(!isAdaptive)}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-md transition-colors ${isAdaptive ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' : 'bg-slate-700 text-slate-500'}`}
                    title="Adaptar volumen al ruido ambiente"
                   >
                     {isAdaptive ? <Mic className="w-3 h-3" /> : <MicOff className="w-3 h-3" />}
                     <span className="text-[10px]">{isAdaptive ? 'Auto' : 'Manual'}</span>
                   </button>
                 </div>
                 <span>{Math.round(volNoise * 100)}%</span>
              </div>
              <input type="range" max="0.5" step="0.01" value={volNoise} onChange={e => setVolNoise(Number(e.target.value))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-slate-400" />
              <div className="flex gap-1 mt-2">
                 {[NoiseType.WHITE, NoiseType.GREY, NoiseType.BROWN].map(t => (
                   <button key={t} onClick={() => setNoiseType(noiseType === t ? NoiseType.OFF : t)} className={`flex-1 text-[10px] py-1 rounded border ${noiseType === t ? 'bg-slate-500 text-white border-slate-400' : 'border-slate-700 text-slate-500'}`}>
                     {t}
                   </button>
                 ))}
              </div>
           </div>

           <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 p-3 bg-indigo-900/10 rounded-xl border border-white/5">
                 <div className="text-xs text-indigo-400 uppercase tracking-wider">Reverb</div>
                 <input type="range" max="0.8" step="0.01" value={reverbMix} onChange={e => setReverbMix(Number(e.target.value))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-400" />
              </div>
              <div className="space-y-2 p-3 bg-indigo-900/10 rounded-xl border border-white/5">
                 <div className="text-xs text-indigo-400 uppercase tracking-wider">Delay</div>
                 <input type="range" max="0.6" step="0.01" value={delayMix} onChange={e => setDelayMix(Number(e.target.value))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-400" />
              </div>
           </div>
        </div>
      </main>

      {/* --- PLAYBAR --- */}
      <footer className="fixed bottom-0 w-full z-30 bg-black/80 backdrop-blur-md border-t border-white/10 pb-6 pt-4 px-6 flex justify-center gap-6">
          <button onClick={() => setShowTimerModal(true)} className="p-3 rounded-full hover:bg-white/10 text-slate-400">
             <Timer className="w-6 h-6" />
          </button>
          <button
             onClick={() => setIsPlaying(!isPlaying)}
             className={`w-16 h-16 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(99,102,241,0.4)] transition-all duration-300 hover:scale-105 ${isPlaying ? 'bg-slate-100 text-black' : 'bg-indigo-600 text-white'}`}
           >
             {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-1" />}
           </button>
           <button onClick={savePreset} className="p-3 rounded-full hover:bg-white/10 text-slate-400">
             <Save className="w-6 h-6" />
           </button>
      </footer>

      {/* --- STUDIO MODAL --- */}
      {showStudio && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex justify-end">
          <div className="w-full md:w-[500px] h-full bg-slate-900 border-l border-white/10 p-8 overflow-y-auto animate-float">
             <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-light text-white flex items-center gap-2">
                  <Sparkles className="text-indigo-400" /> Laboratorio IA
                </h2>
                <button onClick={() => setShowStudio(false)}><X className="text-slate-400" /></button>
             </div>
             <div className="space-y-8">
                <div className="space-y-2">
                   <label className="text-sm font-bold text-indigo-300 uppercase tracking-wide">Agente Mágico</label>
                   <textarea 
                      value={magicPrompt}
                      onChange={e => setMagicPrompt(e.target.value)}
                      placeholder="Describe: 'Está lloviendo y el bebé no deja de llorar...'"
                      className="w-full h-32 bg-slate-800 border border-slate-700 rounded-xl p-4 text-sm text-white focus:ring-2 ring-indigo-500 outline-none resize-none"
                   />
                </div>
                <div className="space-y-4">
                   <label className="text-sm font-bold text-slate-500 uppercase tracking-wide">Parámetros Finos</label>
                   <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-xs text-slate-400 block mb-1">Tipo de Bebé</span>
                        <select 
                          className="w-full bg-slate-800 rounded-lg p-2 text-sm outline-none"
                          value={personalParams.babyType}
                          onChange={e => setPersonalParams({...personalParams, babyType: e.target.value as any})}
                        >
                          <option value="Sensitive">Sensible</option>
                          <option value="Active">Activo</option>
                          <option value="Colic">Con Cólicos</option>
                          <option value="Newborn">Recién Nacido</option>
                        </select>
                      </div>
                      <div>
                        <span className="text-xs text-slate-400 block mb-1">Emoción Actual</span>
                        <select 
                          className="w-full bg-slate-800 rounded-lg p-2 text-sm outline-none"
                          value={personalParams.currentEmotion}
                          onChange={e => setPersonalParams({...personalParams, currentEmotion: e.target.value as any})}
                        >
                          <option value="Restless">Inquieto</option>
                          <option value="Crying">Llorando</option>
                          <option value="Playful">Juguetón</option>
                          <option value="Overtired">Pasado de sueño</option>
                        </select>
                      </div>
                   </div>
                </div>
                <button 
                  onClick={handleMagicAgent}
                  disabled={isGenerating || !magicPrompt}
                  className="w-full py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold tracking-wide shadow-lg shadow-indigo-900/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isGenerating ? 'Orquestando Agentes...' : 'Generar Experiencia'}
                </button>
             </div>
          </div>
        </div>
      )}

      {/* --- LIBRARY MODAL --- */}
      {showLibrary && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
           <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col">
              <div className="p-6 border-b border-slate-800 flex justify-between">
                 <h3 className="text-lg font-bold text-white">Biblioteca Guardada</h3>
                 <button onClick={() => setShowLibrary(false)}><X className="text-slate-400" /></button>
              </div>
              <div className="overflow-y-auto p-4 space-y-3">
                 {library.length === 0 && <p className="text-slate-500 text-center py-8">No hay sesiones guardadas.</p>}
                 {library.map(preset => (
                   <button key={preset.id} onClick={() => loadPreset(preset)} className="w-full text-left p-4 rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors border border-transparent hover:border-indigo-500/30">
                     <div className="flex justify-between items-center mb-1">
                       <span className="font-bold text-white">{preset.name}</span>
                       <span className="text-xs text-slate-500">{new Date(preset.date).toLocaleDateString()}</span>
                     </div>
                     <p className="text-xs text-slate-400 line-clamp-1">{preset.config.musicPrompt}</p>
                   </button>
                 ))}
              </div>
           </div>
        </div>
      )}

      {/* --- TIMER MODAL --- */}
      {showTimerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-sm">
            <h3 className="text-white mb-6">Temporizador (Minutos)</h3>
            <input type="number" value={inputMinutes} onChange={e => setInputMinutes(Number(e.target.value))} className="w-full bg-slate-800 p-4 rounded-xl text-center text-3xl text-white mb-6 outline-none focus:ring-2 ring-indigo-500" />
            <div className="flex gap-3">
              <button onClick={() => setShowTimerModal(false)} className="flex-1 py-3 bg-slate-800 rounded-xl text-slate-400">Cancelar</button>
              <button onClick={() => { setTimeLeft(inputMinutes * 60); setShowTimerModal(false); }} className="flex-1 py-3 bg-indigo-600 rounded-xl text-white">Iniciar</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

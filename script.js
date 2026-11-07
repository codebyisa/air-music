/* =========================================================
   AIR MUSIC — script.js
   Detecção das mãos: MediaPipe Hand Landmarker
   Som: Tone.js
   ========================================================= */

/* ---------------------------------------------------------
   Configuração
   --------------------------------------------------------- */
const MEDIAPIPE_URLS = [
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs',
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/vision_bundle.mjs',
];
const MEDIAPIPE_WASM = (url) => url.replace(/vision_bundle\.mjs$/, 'wasm');
const HAND_MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const PIANO_SAMPLES = 'https://tonejs.github.io/audio/salamander/';

// Violão de nylon de verdade: as gravações ficam na pasta samples/violao do site
const GUITAR_SAMPLES = 'samples/violao/';
const GUITAR_URLS = {
  D2: 'D2.mp3', E2: 'E2.mp3', 'F#2': 'Fs2.mp3', 'G#2': 'Gs2.mp3', A2: 'A2.mp3', B2: 'B2.mp3',
  'C#3': 'Cs3.mp3', D3: 'D3.mp3', E3: 'E3.mp3', 'F#3': 'Fs3.mp3', G3: 'G3.mp3', A3: 'A3.mp3',
  B3: 'B3.mp3', 'C#4': 'Cs4.mp3', 'D#4': 'Ds4.mp3', E4: 'E4.mp3', 'F#4': 'Fs4.mp3', 'G#4': 'Gs4.mp3',
  A4: 'A4.mp3', B4: 'B4.mp3',
};

// Tempo musical: 192 "ticks" por tempo (padrão do Tone.js), compasso 4/4
const PPQ = 192;
const BAR = PPQ * 4;
const SIXTEENTH = PPQ / 4;
const MAX_LAYERS = 8;

// Sensibilidade: 1 = precisa de gesto firme · 5 = um toque leve já toca
const SENS_LABELS = ['Bem firme', 'Firme', 'Normal', 'Leve', 'Bem leve'];
const SENS_FACTOR = [1.7, 1.3, 1, 0.75, 0.55]; // multiplica a velocidade mínima do gesto

const INSTRUMENT_INFO = {
  piano: { label: 'Piano', color: '#b9a8e6' },
  guitar: { label: 'Violão', color: '#e6bf8a' },
  drums: { label: 'Batidas', color: '#e99c8f' },
};

// Pontos da mão (MediaPipe)
const TIPS = [4, 8, 12, 16, 20];       // polegar, indicador, médio, anelar, mindinho
const PIPS = [3, 6, 10, 14, 18];

// Nomes das notas em português
const SOLFEGE = ['Dó', 'Dó♯', 'Ré', 'Ré♯', 'Mi', 'Fá', 'Fá♯', 'Sol', 'Sol♯', 'Lá', 'Lá♯', 'Si'];
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const SCALES = {
  pentatonic: { steps: [0, 2, 4, 7, 9], keys: 11 },
  major: { steps: [0, 2, 4, 5, 7, 9, 11], keys: 11 },
  chromatic: { steps: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], keys: 13 },
};

// Acordes do violão: dedos levantados → acorde (notas das 6 cordas, da 6ª para a 1ª)
const CHORDS = [
  { fingers: 1, name: 'Dó', short: 'C', notes: [null, 'C3', 'E3', 'G3', 'C4', 'E4'] },
  { fingers: 2, name: 'Sol', short: 'G', notes: ['G2', 'B2', 'D3', 'G3', 'B3', 'G4'] },
  { fingers: 3, name: 'Lá menor', short: 'Am', notes: [null, 'A2', 'E3', 'A3', 'C4', 'E4'] },
  { fingers: 4, name: 'Fá', short: 'F', notes: ['F2', 'C3', 'F3', 'A3', 'C4', 'F4'] },
  { fingers: 5, name: 'Mi menor', short: 'Em', notes: ['E2', 'B2', 'E3', 'G3', 'B3', 'E4'] },
];
const STRING_WIDTHS = [3, 2.6, 2.2, 1.8, 1.4, 1];

// Bateria: 8 "lugares" fixos. O som e o nome de cada um mudam com o kit.
const DRUMS = [
  { id: 'kick', color: '#e99c8f' },
  { id: 'snare', color: '#e6bf8a' },
  { id: 'clap', color: '#f0d58c' },
  { id: 'hat', color: '#a8d5c2' },
  { id: 'openhat', color: '#9cc9dd' },
  { id: 'tom', color: '#b9a8e6' },
  { id: 'perc', color: '#d9a6c9' },
  { id: 'crash', color: '#c9c3b8' },
];

const KITS = {
  classic: {
    label: 'Clássico', bpm: 100, preset: 'basic',
    names: {
      kick: ['Bumbo', 'kick'], snare: ['Caixa', 'snare'], clap: ['Palmas', 'clap'], hat: ['Chimbal', 'hi-hat'],
      openhat: ['Chimbal aberto', 'open hat'], tom: ['Tom', 'tom'], perc: ['Percussão', 'perc'], crash: ['Prato', 'crash'],
    },
  },
  techno: {
    label: 'Hard techno', bpm: 150, preset: 'techno',
    names: {
      kick: ['Kick', 'distorcido'], snare: ['Rumble', 'grave sujo'], clap: ['Chicote', 'whip'], hat: ['Chiado', 'noise hat'],
      openhat: ['Ride', 'ride'], tom: ['Metal', 'industrial'], perc: ['Stab', 'acorde'], crash: ['Subida', 'riser'],
    },
  },
  funk: {
    label: 'Funk carioca', bpm: 130, preset: 'funkbr',
    names: {
      kick: ['Grave', '808'], snare: ['Caixa', 'snare'], clap: ['Palma', 'clap'], hat: ['Chimbal', 'hi-hat'],
      openhat: ['Tamborzão', 'tambor'], tom: ['Cuíca', 'cuíca'], perc: ['Agogô', 'agogô'], crash: ['Sirene', 'sirene'],
    },
  },
  house: {
    label: 'House', bpm: 124, preset: 'house',
    names: {
      kick: ['Kick', '4x4'], snare: ['Clap', 'clap'], clap: ['Snap', 'estalo'], hat: ['Hat', 'fechado'],
      openhat: ['Hat aberto', 'open hat'], tom: ['Shaker', 'shaker'], perc: ['Conga', 'conga'], crash: ['Baixo', 'bass'],
    },
  },
};

// Batidas prontas (algumas trocam o kit e o BPM)
const PRESETS = {
  basic: { kick: [0, 8], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14] },
  pop: { kick: [0, 8, 10], snare: [4, 12], clap: [12], hat: [0, 2, 4, 6, 8, 10, 12, 14], crash: [0] },
  funk: { kick: [0, 3, 8, 11], clap: [4, 12], perc: [2, 6, 10, 14], hat: [0, 2, 4, 6, 8, 10, 12, 14] },
  hiphop: { kick: [0, 7, 10], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12], openhat: [14] },
  reggaeton: { kick: [0, 4, 8, 12], snare: [3, 6, 11, 14], hat: [0, 2, 4, 6, 8, 10, 12, 14] },
  techno: {
    kit: 'techno', bpm: 150,
    kick: [0, 4, 8, 12], snare: [2, 6, 10, 14], clap: [12], hat: [1, 3, 5, 7, 9, 11, 13, 15],
    openhat: [2, 6, 10, 14], tom: [7, 15], crash: [0],
  },
  funkbr: {
    kit: 'funk', bpm: 130,
    kick: [0, 3, 8, 11], snare: [4, 12], clap: [4, 12], hat: [2, 6, 10, 14],
    openhat: [0, 3, 6, 8, 11, 14], tom: [7, 15], perc: [10],
  },
  house: {
    kit: 'house', bpm: 124,
    kick: [0, 4, 8, 12], snare: [4, 12], hat: [1, 3, 5, 7, 9, 11, 13, 15], openhat: [2, 6, 10, 14],
    tom: [0, 2, 4, 6, 8, 10, 12, 14], perc: [3, 10], crash: [2, 6, 10, 14],
  },
};

// Atualiza os nomes dos 8 sons conforme o kit
function applyKitNames(kitId) {
  const kit = KITS[kitId] || KITS.classic;
  DRUMS.forEach((d) => { [d.label, d.en] = kit.names[d.id]; });
}
applyKitNames('classic');

/* ---------------------------------------------------------
   Helpers
   --------------------------------------------------------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem('airmusic:' + key); return v === null ? fallback : JSON.parse(v); }
    catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem('airmusic:' + key, JSON.stringify(value)); } catch { /* sem armazenamento */ }
  },
};

const noteFromMidi = (m) => `${NOTE_NAMES[m % 12]}${Math.floor(m / 12) - 1}`;

/* ---------------------------------------------------------
   Elementos
   --------------------------------------------------------- */
const el = {
  body: document.body,
  stage: $('#stage'),
  video: $('#video'),
  canvas: $('#handsCanvas'),
  pianoOverlay: $('#pianoOverlay'),
  guitarOverlay: $('#guitarOverlay'),
  guitarStrings: $('#guitarStrings'),
  chordName: $('#chordName'),
  chordHint: $('#chordHint'),
  drumsOverlay: $('#drumsOverlay'),
  status: $('#stageStatus'),
  statusText: $('#stageStatusText'),
  stageRec: $('#stageRec'),
  recTime: $('#recTime'),
  startScreen: $('#startScreen'),
  startBtn: $('#startBtn'),
  startError: $('#startError'),
  loading: $('#loadingScreen'),
  loadingText: $('#loadingText'),

  instrumentTabs: $$('.instruments [data-instrument]'),
  toggleVideo: $('#toggleVideo'),
  recordBtn: $('#recordBtn'),
  recordLabel: $('#recordLabel'),

  pianoScale: $('#pianoScale'),
  octaveDown: $('#octaveDown'),
  octaveUp: $('#octaveUp'),
  octaveValue: $('#octaveValue'),

  chordLegend: $('#chordLegend'),

  drumMode: $('#drumMode'),
  drumKit: $('#drumKit'),
  bpmRange: $('#bpmRange'),
  bpmValue: $('#bpmValue'),
  tapTempo: $('#tapTempo'),
  loopPlay: $('#loopPlay'),
  patternPreset: $('#patternPreset'),
  patternClear: $('#patternClear'),
  sequencer: $('#sequencer'),
  drumsHint: $('#drumsHint'),

  volume: $('#volumeRange'),
  metronome: $('#metronomeToggle'),
  loopUnder: $('#loopUnder'),
  sensRange: $('#sensRange'),
  sensValue: $('#sensValue'),
  recordMode: $('#recordMode'),

  layerRec: $('#layerRec'),
  layerRecLabel: $('#layerRecLabel'),
  layersPlay: $('#layersPlay'),
  layerBars: $('#layerBars'),
  layersClear: $('#layersClear'),
  layersList: $('#layersList'),
  layersHint: $('#layersHint'),
  stageLoop: $('#stageLoop'),
  stageLoopCount: $('#stageLoopCount'),
  stageLoopText: $('#stageLoopText'),
  stageLoopBar: $('#stageLoopBar'),

  recSheet: $('#recSheet'),
  recMedia: $('#recMedia'),
  recMeta: $('#recMeta'),
  recDownload: $('#recDownload'),
  recShare: $('#recShare'),

  toast: $('#toast'),
  footerYear: $('#footerYear'),
};

/* ---------------------------------------------------------
   Estado (com preferências salvas)
   --------------------------------------------------------- */
const state = {
  instrument: store.get('instrument', 'piano'),
  scale: store.get('scale', 'pentatonic'),
  octave: store.get('octave', 4),
  drumMode: store.get('drumMode', 'pads'),
  bpm: store.get('bpm', 100),
  volume: store.get('volume', 0.8),
  metronome: false,
  loopUnder: store.get('loopUnder', true),
  pattern: store.get('pattern', null) || makePattern(PRESETS.basic),
  kit: KITS[store.get('kit', 'classic')] ? store.get('kit', 'classic') : 'classic',
  videoHidden: store.get('videoHidden', false),
  sens: store.get('sens', 3),
  recordMode: store.get('recordMode', 'video'),
  layers: store.get('layers', []),
  layerBars: store.get('layerBars', 2),
  layersOn: false,
  loopOn: false,
  cameraOn: false,
};

// Fator da sensibilidade atual (menor = mais sensível)
const sensK = () => SENS_FACTOR[clamp(state.sens, 1, 5) - 1];

function makePattern(preset = {}) {
  const p = {};
  DRUMS.forEach((d) => { p[d.id] = Array.from({ length: 16 }, (_, i) => (preset[d.id] || []).includes(i)); });
  return p;
}

/* =========================================================
   ÁUDIO (Tone.js)
   ========================================================= */
const audio = {
  ready: false,
  piano: null,
  pianoFallback: null,
  pianoLoaded: false,
  strings: [],
  drums: {},
  metro: null,
  streamDest: null,
  lastTime: {},
};

// Garante que cada voz receba horários sempre crescentes (exigência do Tone.js)
function voiceTime(key, t = Tone.now()) {
  const last = audio.lastTime[key] || 0;
  const time = Math.max(t, last + 0.005);
  audio.lastTime[key] = time;
  return time;
}

/* ---------------------------------------------------------
   Som no celular
   - iPhone: a chave do silencioso corta o som da Web Audio.
     Tocar um áudio "mudo" em loop faz o iOS tratar o site como
     player de mídia, e aí o som sai mesmo no silencioso.
   - Ao ligar a câmera, alguns celulares pausam o som:
     religamos a cada toque na tela.
   --------------------------------------------------------- */
let silentAudio = null;

function makeSilentWav() {
  const rate = 8000;
  const samples = rate; // 1 segundo
  const buf = new ArrayBuffer(44 + samples);
  const v = new DataView(buf);
  const str = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); v.setUint32(4, 36 + samples, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  str(36, 'data'); v.setUint32(40, samples, true);
  for (let i = 0; i < samples; i++) v.setUint8(44 + i, 128); // 128 = silêncio em 8 bits
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

function unlockMobileAudio() {
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* sem suporte */ }
  try {
    if (!silentAudio) {
      silentAudio = new Audio(makeSilentWav());
      silentAudio.loop = true;
      silentAudio.setAttribute('playsinline', '');
      silentAudio.volume = 0.01;
    }
    if (silentAudio.paused) silentAudio.play().catch(() => {});
  } catch { /* segue sem */ }
}

function resumeAudio() {
  if (!window.Tone) return;
  unlockMobileAudio();
  const ctx = Tone.getContext().rawContext;
  if (ctx.state !== 'running') {
    ctx.resume().catch(() => {});
    Tone.start().catch(() => {});
  }
}

function audioIsRunning() {
  return !window.Tone || Tone.getContext().rawContext.state === 'running';
}

['pointerdown', 'touchend', 'click', 'keydown'].forEach((ev) => {
  document.addEventListener(ev, resumeAudio, { passive: true, capture: true });
});

function setupAudio() {
  if (audio.ready) return;

  Tone.Transport.PPQ = PPQ;
  // Limitador no final: segura os picos pra o som nunca estourar
  Tone.Destination.chain(new Tone.Limiter(-1));
  Tone.Destination.volume.value = Tone.gainToDb(Math.max(0.0001, state.volume));

  const reverb = new Tone.Reverb({ decay: 2.2, wet: 0.18 }).toDestination();

  // Piano de verdade (amostras do Salamander Grand Piano)
  audio.pianoFallback = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.005, decay: 0.4, sustain: 0.25, release: 1.2 },
  }).connect(reverb);
  audio.pianoFallback.volume.value = -10;

  audio.piano = new Tone.Sampler({
    urls: {
      A0: 'A0.mp3', C1: 'C1.mp3', 'D#1': 'Ds1.mp3', 'F#1': 'Fs1.mp3', A1: 'A1.mp3',
      C2: 'C2.mp3', 'D#2': 'Ds2.mp3', 'F#2': 'Fs2.mp3', A2: 'A2.mp3', C3: 'C3.mp3',
      'D#3': 'Ds3.mp3', 'F#3': 'Fs3.mp3', A3: 'A3.mp3', C4: 'C4.mp3', 'D#4': 'Ds4.mp3',
      'F#4': 'Fs4.mp3', A4: 'A4.mp3', C5: 'C5.mp3', 'D#5': 'Ds5.mp3', 'F#5': 'Fs5.mp3',
      A5: 'A5.mp3', C6: 'C6.mp3', 'D#6': 'Ds6.mp3', 'F#6': 'Fs6.mp3', A6: 'A6.mp3',
      C7: 'C7.mp3', 'D#7': 'Ds7.mp3', 'F#7': 'Fs7.mp3', A7: 'A7.mp3', C8: 'C8.mp3',
    },
    baseUrl: PIANO_SAMPLES,
    release: 1.2,
    onload: () => { audio.pianoLoaded = true; },
  }).connect(reverb);

  // Violão: gravações de um violão de nylon de verdade.
  // Enquanto carregam (ou se faltarem), toca um som sintetizado parecido.
  const guitarBus = new Tone.Volume(-5).connect(reverb);
  audio.guitarFallback = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.002, decay: 1.2, sustain: 0, release: 0.4 },
  }).connect(new Tone.Filter(2400, 'lowpass').connect(guitarBus));
  audio.guitarFallback.volume.value = -12;
  audio.guitar = new Tone.Sampler({
    urls: GUITAR_URLS,
    baseUrl: GUITAR_SAMPLES,
    release: 0.8,
    onload: () => { audio.guitarLoaded = true; },
    onerror: () => { console.warn('[air music] Não achei as gravações do violão em', GUITAR_SAMPLES); },
  }).connect(guitarBus);

  // Bateria, toda sintetizada (sem arquivos de som).
  // São 3 kits iguais: ao vivo, sequenciador e camadas. Assim um nunca
  // "atropela" o outro (cada som só pode ser disparado em ordem no tempo).
  // Cada kit é criado só quando é usado pela primeira vez.
  audio.drumBus = new Tone.Compressor(-18, 4).toDestination();
  audio.kits = {};
  drumKit('live');
  drumKit('seq');

  // Metrônomo
  const metroSynth = new Tone.Synth({ oscillator: { type: 'square' }, envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.01 } }).toDestination();
  metroSynth.volume.value = -14;
  audio.metro = new Tone.Loop((time) => {
    const beat = Number(String(Tone.Transport.position).split(':')[1]) || 0;
    metroSynth.triggerAttackRelease(beat === 0 ? 'C6' : 'G5', '32n', voiceTime('metro', time));
  }, '4n');

  // Contagem antes de gravar uma camada
  audio.countSynth = new Tone.Synth({ oscillator: { type: 'square' }, envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.01 } }).toDestination();
  audio.countSynth.volume.value = -10;

  // Sequenciador de 16 passos
  audio.sequence = new Tone.Sequence((time, step) => {
    const k = drumKit('seq');
    DRUMS.forEach((d) => { if (state.pattern[d.id][step]) k[d.id](time, 0.9); });
    Tone.Draw.schedule(() => showPlayhead(step), time);
  }, [...Array(16).keys()], '16n');

  // Relógio das camadas: a cada 1/16 toca as notas gravadas daquele trecho
  Tone.Transport.scheduleRepeat(playLayersAt, '16n', 0);

  // Saída de áudio para as gravações (áudio e vídeo)
  audio.streamDest = Tone.getContext().rawContext.createMediaStreamDestination();
  Tone.Destination.connect(audio.streamDest);

  Tone.Transport.bpm.value = state.bpm;
  audio.ready = true;
}

// Kit pronto para uso: role = 'live' (ao vivo), 'seq' (sequenciador) ou 'layer' (camadas)
function drumKit(role, kitId = state.kit) {
  const key = `${role}:${kitId}`;
  if (!audio.kits[key]) audio.kits[key] = makeDrumKit(audio.drumBus, key, kitId);
  return audio.kits[key];
}

function makeDrumKit(bus, name, kitId) {
  const k = (id) => `${name}:${id}`;
  const out = (node, vol = 0) => { node.volume.value = vol; return node; };
  const fx = (...chain) => { chain.reduce((a, b) => (a.connect(b), b)); chain[chain.length - 1].connect(bus); return chain[0]; };

  // Palmas: três estalos rápidos
  const clapHits = (synth, key) => (t, v) => {
    const t0 = voiceTime(k(key), t);
    synth.triggerAttackRelease(0.01, t0, v);
    synth.triggerAttackRelease(0.01, voiceTime(k(key), t0 + 0.012), v);
    synth.triggerAttackRelease(0.14, voiceTime(k(key), t0 + 0.024), v);
  };

  if (kitId === 'techno') {
    // Hard techno: tudo sujo, distorcido e pesado
    const kick = out(new Tone.MembraneSynth({ pitchDecay: 0.06, octaves: 7, envelope: { attack: 0.001, decay: 0.55, sustain: 0, release: 0.1 } }), -6);
    fx(kick, new Tone.Distortion(0.75), new Tone.Filter(4500, 'lowpass'));

    const rumble = out(new Tone.MembraneSynth({ pitchDecay: 0.12, octaves: 3, envelope: { attack: 0.005, decay: 0.9, sustain: 0, release: 0.3 } }), -2);
    fx(rumble, new Tone.Distortion(0.5), new Tone.Filter(160, 'lowpass'), new Tone.Reverb({ decay: 2.5, wet: 0.55 }));

    const whip = out(new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.2, sustain: 0 } }), 2);
    fx(whip, new Tone.Filter({ frequency: 2600, type: 'bandpass', Q: 0.9 }), new Tone.Reverb({ decay: 1.6, wet: 0.45 }));

    const hiss = out(new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.07, sustain: 0 } }), -8);
    fx(hiss, new Tone.Filter(7500, 'highpass'));

    const ride = out(new Tone.MetalSynth({ envelope: { attack: 0.001, decay: 0.6, release: 0.2 }, harmonicity: 5.1, modulationIndex: 40, resonance: 7000, octaves: 1.5 }), -20);
    ride.frequency.value = 600;
    ride.connect(bus);

    const metal = out(new Tone.MetalSynth({ envelope: { attack: 0.001, decay: 0.25, release: 0.05 }, harmonicity: 3.1, modulationIndex: 20, resonance: 1800, octaves: 1 }), -14);
    metal.frequency.value = 120;
    fx(metal, new Tone.Distortion(0.5));

    const stab = out(new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'sawtooth' }, envelope: { attack: 0.002, decay: 0.16, sustain: 0, release: 0.05 } }), -16);
    fx(stab, new Tone.Distortion(0.7), new Tone.Filter(2200, 'lowpass'), new Tone.Reverb({ decay: 1.8, wet: 0.35 }));

    const riserFilter = new Tone.Filter({ frequency: 400, type: 'bandpass', Q: 1.5 });
    const riser = out(new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.05, decay: 1.4, sustain: 0 } }), -8);
    fx(riser, riserFilter);

    return {
      kick: (t, v) => kick.triggerAttackRelease('C1', '8n', voiceTime(k('kick'), t), v),
      snare: (t, v) => rumble.triggerAttackRelease('A0', '8n', voiceTime(k('rumble'), t), v),
      clap: (t, v) => whip.triggerAttackRelease(0.2, voiceTime(k('whip'), t), v),
      hat: (t, v) => hiss.triggerAttackRelease(0.07, voiceTime(k('hiss'), t), v),
      openhat: (t, v) => ride.triggerAttackRelease(600, '8n', voiceTime(k('ride'), t), v * 0.9),
      tom: (t, v) => metal.triggerAttackRelease(120, '16n', voiceTime(k('metal'), t), v),
      perc: (t, v) => stab.triggerAttackRelease(['C3', 'D#3', 'G3'], '16n', t, v),
      crash: (t, v) => {
        const t0 = voiceTime(k('riser'), t);
        riserFilter.frequency.cancelScheduledValues(t0);
        riserFilter.frequency.setValueAtTime(300, t0);
        riserFilter.frequency.exponentialRampToValueAtTime(9000, t0 + 1.3);
        riser.triggerAttackRelease(1.4, t0, v);
      },
    };
  }

  if (kitId === 'funk') {
    // Funk carioca: grave 808, tamborzão, cuíca, agogô e sirene
    const grave = out(new Tone.MembraneSynth({ pitchDecay: 0.1, octaves: 4, envelope: { attack: 0.001, decay: 1.1, sustain: 0, release: 0.5 } }), -1);
    fx(grave, new Tone.Distortion(0.18));

    const snareNoise = out(new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.14, sustain: 0 } }), -5);
    fx(snareNoise, new Tone.Filter(2200, 'highpass'));
    const snareBody = out(new Tone.MembraneSynth({ pitchDecay: 0.02, octaves: 2, envelope: { attack: 0.001, decay: 0.1, sustain: 0 } }), -8);
    snareBody.connect(bus);

    const clap = out(new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.001, decay: 0.12, sustain: 0 } }), -1);
    fx(clap, new Tone.Filter({ frequency: 1100, type: 'bandpass', Q: 1.1 }), new Tone.Reverb({ decay: 0.9, wet: 0.25 }));

    const hat = out(new Tone.MetalSynth({ envelope: { attack: 0.001, decay: 0.05, release: 0.01 }, harmonicity: 5.1, modulationIndex: 32, resonance: 5000, octaves: 1.5 }), -22);
    hat.frequency.value = 420;
    hat.connect(bus);

    const tambor = out(new Tone.MembraneSynth({ pitchDecay: 0.03, octaves: 2.5, envelope: { attack: 0.001, decay: 0.22, sustain: 0 } }), -2);
    tambor.connect(bus);

    const cuica = out(new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.01, decay: 0.28, sustain: 0, release: 0.05 } }), -4);
    cuica.connect(bus);

    const agogo = out(new Tone.FMSynth({ harmonicity: 3.01, modulationIndex: 8, envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.1 }, modulationEnvelope: { attack: 0.001, decay: 0.2, sustain: 0 } }), -14);
    agogo.connect(bus);
    let agogoHigh = true;

    const siren = out(new Tone.Synth({ oscillator: { type: 'square' }, envelope: { attack: 0.02, decay: 0.9, sustain: 0, release: 0.1 } }), -20);
    fx(siren, new Tone.Filter(2600, 'lowpass'));

    return {
      kick: (t, v) => grave.triggerAttackRelease('F1', '4n', voiceTime(k('grave'), t), v),
      snare: (t, v) => {
        snareNoise.triggerAttackRelease('16n', voiceTime(k('snareN'), t), v);
        snareBody.triggerAttackRelease('D3', '32n', voiceTime(k('snareB'), t), v);
      },
      clap: clapHits(clap, 'clap'),
      hat: (t, v) => hat.triggerAttackRelease(420, '32n', voiceTime(k('hat'), t), v),
      openhat: (t, v) => tambor.triggerAttackRelease('A2', '16n', voiceTime(k('tambor'), t), v),
      tom: (t, v) => {
        // "uí" da cuíca: a nota sobe e desce
        const t0 = voiceTime(k('cuica'), t);
        cuica.triggerAttackRelease(380, 0.28, t0, v);
        cuica.frequency.setValueAtTime(380, t0);
        cuica.frequency.exponentialRampToValueAtTime(760, t0 + 0.1);
        cuica.frequency.exponentialRampToValueAtTime(430, t0 + 0.28);
      },
      perc: (t, v) => {
        agogo.triggerAttackRelease(agogoHigh ? 'E6' : 'B5', '16n', voiceTime(k('agogo'), t), v);
        agogoHigh = !agogoHigh;
      },
      crash: (t, v) => {
        const t0 = voiceTime(k('siren'), t);
        siren.triggerAttackRelease(600, 0.9, t0, v);
        siren.frequency.setValueAtTime(600, t0);
        siren.frequency.linearRampToValueAtTime(1500, t0 + 0.4);
        siren.frequency.linearRampToValueAtTime(600, t0 + 0.85);
      },
    };
  }

  if (kitId === 'house') {
    // House / tech house: kick seco, clap com eco, hats e um baixo
    const kick = out(new Tone.MembraneSynth({ pitchDecay: 0.03, octaves: 5, envelope: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.05 } }), -2);
    kick.connect(bus);

    const clap = out(new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.001, decay: 0.14, sustain: 0 } }), -1);
    fx(clap, new Tone.Filter({ frequency: 1500, type: 'bandpass', Q: 1.2 }), new Tone.Reverb({ decay: 1.3, wet: 0.35 }));

    const snap = out(new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.04, sustain: 0 } }), -4);
    fx(snap, new Tone.Filter({ frequency: 3500, type: 'bandpass', Q: 3 }), new Tone.Reverb({ decay: 0.8, wet: 0.3 }));

    const hat = out(new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.04, sustain: 0 } }), -14);
    fx(hat, new Tone.Filter(9000, 'highpass'));

    const openhat = out(new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.002, decay: 0.25, sustain: 0 } }), -13);
    fx(openhat, new Tone.Filter(8000, 'highpass'));

    const shaker = out(new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.006, decay: 0.05, sustain: 0 } }), -15);
    fx(shaker, new Tone.Filter({ frequency: 6000, type: 'bandpass', Q: 1 }));

    const conga = out(new Tone.MembraneSynth({ pitchDecay: 0.008, octaves: 1.2, envelope: { attack: 0.001, decay: 0.2, sustain: 0 } }), -8);
    conga.connect(bus);

    const bass = out(new Tone.MonoSynth({
      oscillator: { type: 'sawtooth' },
      filter: { Q: 2, type: 'lowpass' },
      envelope: { attack: 0.005, decay: 0.2, sustain: 0, release: 0.05 },
      filterEnvelope: { attack: 0.001, decay: 0.15, sustain: 0, baseFrequency: 120, octaves: 3 },
    }), -8);
    bass.connect(bus);

    return {
      kick: (t, v) => kick.triggerAttackRelease('C1', '8n', voiceTime(k('kick'), t), v),
      snare: clapHits(clap, 'clap'),
      clap: (t, v) => snap.triggerAttackRelease(0.04, voiceTime(k('snap'), t), v),
      hat: (t, v) => hat.triggerAttackRelease(0.04, voiceTime(k('hat'), t), v),
      openhat: (t, v) => openhat.triggerAttackRelease(0.25, voiceTime(k('openhat'), t), v),
      tom: (t, v) => shaker.triggerAttackRelease(0.05, voiceTime(k('shaker'), t), v),
      perc: (t, v) => conga.triggerAttackRelease('D4', '16n', voiceTime(k('conga'), t), v),
      crash: (t, v) => bass.triggerAttackRelease('A1', '16n', voiceTime(k('bass'), t), v),
    };
  }

  // Clássico
  const kick = out(new Tone.MembraneSynth({ pitchDecay: 0.05, octaves: 6, envelope: { attack: 0.001, decay: 0.45, sustain: 0 } }));
  kick.connect(bus);

  const snareNoise = out(new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.18, sustain: 0 } }), -6);
  fx(snareNoise, new Tone.Filter(1800, 'highpass'));
  const snareBody = out(new Tone.MembraneSynth({ pitchDecay: 0.02, octaves: 2, envelope: { attack: 0.001, decay: 0.12, sustain: 0 } }), -10);
  snareBody.connect(bus);

  const clap = out(new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.001, decay: 0.12, sustain: 0 } }), -2);
  fx(clap, new Tone.Filter({ frequency: 1400, type: 'bandpass', Q: 1.2 }));

  const hat = out(new Tone.MetalSynth({ envelope: { attack: 0.001, decay: 0.05, release: 0.01 }, harmonicity: 5.1, modulationIndex: 32, resonance: 5000, octaves: 1.5 }), -22);
  hat.frequency.value = 400;
  hat.connect(bus);

  const openhat = out(new Tone.MetalSynth({ envelope: { attack: 0.001, decay: 0.35, release: 0.1 }, harmonicity: 5.1, modulationIndex: 32, resonance: 5000, octaves: 1.5 }), -24);
  openhat.frequency.value = 400;
  openhat.connect(bus);

  const tom = out(new Tone.MembraneSynth({ pitchDecay: 0.08, octaves: 3, envelope: { attack: 0.001, decay: 0.35, sustain: 0 } }), -4);
  tom.connect(bus);

  const perc = out(new Tone.MembraneSynth({ pitchDecay: 0.01, octaves: 1.5, envelope: { attack: 0.001, decay: 0.08, sustain: 0 } }), -8);
  perc.connect(bus);

  const crash = out(new Tone.MetalSynth({ envelope: { attack: 0.001, decay: 1.4, release: 0.3 }, harmonicity: 5.1, modulationIndex: 40, resonance: 3000, octaves: 1.5 }), -22);
  crash.frequency.value = 300;
  crash.connect(bus);

  return {
    kick: (t, v) => kick.triggerAttackRelease('C1', '8n', voiceTime(k('kick'), t), v),
    snare: (t, v) => {
      snareNoise.triggerAttackRelease('16n', voiceTime(k('snareN'), t), v);
      snareBody.triggerAttackRelease('G2', '32n', voiceTime(k('snareB'), t), v);
    },
    clap: clapHits(clap, 'clap'),
    hat: (t, v) => hat.triggerAttackRelease(400, '32n', voiceTime(k('hat'), t), v),
    openhat: (t, v) => openhat.triggerAttackRelease(400, '8n', voiceTime(k('openhat'), t), v),
    tom: (t, v) => tom.triggerAttackRelease('G2', '8n', voiceTime(k('tom'), t), v),
    perc: (t, v) => perc.triggerAttackRelease('E4', '32n', voiceTime(k('perc'), t), v),
    crash: (t, v) => crash.triggerAttackRelease(300, '2n', voiceTime(k('crash'), t), v),
  };
}

// Toca uma corda do violão
function playGuitar(note, time, velocity) {
  const synth = audio.guitarLoaded ? audio.guitar : audio.guitarFallback;
  synth.triggerAttackRelease(note, 3, time, velocity);
}

function playPiano(note, velocity) {
  const synth = audio.pianoLoaded ? audio.piano : audio.pianoFallback;
  synth.triggerAttack(note, Tone.now(), velocity);
  captureNote({ k: 'p', n: note, v: velocity });
}

function releasePiano(note) {
  const synth = audio.pianoLoaded ? audio.piano : audio.pianoFallback;
  synth.triggerRelease(note, Tone.now() + 0.05);
  captureRelease(note);
}

function needsTransport() {
  return state.loopOn || state.metronome || state.layersOn || !!layerRec;
}

function syncTransport() {
  if (!audio.ready) return;
  const needs = needsTransport();
  if (needs && Tone.Transport.state !== 'started') Tone.Transport.start('+0.05');
  if (needs) kickUi();
  if (!needs && Tone.Transport.state === 'started') {
    Tone.Transport.stop();
    showPlayhead(-1);
  }
}

/* =========================================================
   CAMADAS (loop pedal)
   Cada nota tocada durante a gravação é guardada com a sua
   posição no compasso (em "ticks"). Na hora de tocar, um
   relógio de 1/16 dispara as notas de cada trecho. Por ser
   guardado em ticks, a camada acompanha se o BPM mudar.
   ========================================================= */
let layerRec = null;      // gravação em andamento
let layerSeq = 1;         // número da próxima camada

const loopTicks = () => state.layerBars * BAR;
const secPerTick = () => 60 / (Tone.Transport.bpm.value * PPQ);

// Agrupa as notas de cada camada por trecho de 1/16 (mais rápido de tocar)
function bucketize(layer) {
  layer.buckets = new Map();
  layer.events.forEach((e) => {
    const b = Math.floor(e.t / SIXTEENTH);
    if (!layer.buckets.has(b)) layer.buckets.set(b, []);
    layer.buckets.get(b).push(e);
  });
  layer.buckets.forEach((list) => list.sort((a, b) => a.t - b.t));
}

function playLayersAt(time) {
  if (!state.layersOn || !state.layers.length) return;
  const L = loopTicks();
  const tick = Math.round(Tone.Transport.getTicksAtTime(time) / SIXTEENTH) * SIXTEENTH;
  const slot = Math.round((((tick % L) + L) % L) / SIXTEENTH);
  const spt = secPerTick();

  const due = [];
  state.layers.forEach((layer) => {
    if (layer.muted) return;
    if (!layer.buckets) bucketize(layer);
    (layer.buckets.get(slot) || []).forEach((e) => due.push(e));
  });
  due.sort((a, b) => a.t - b.t);

  due.forEach((e) => {
    const at = time + Math.max(0, e.t - slot * SIXTEENTH) * spt;
    try {
      if (e.k === 'p') {
        const synth = audio.pianoLoaded ? audio.piano : audio.pianoFallback;
        synth.triggerAttackRelease(e.n, Math.max(0.08, e.d * spt), at, e.v);
      } else if (e.k === 's') {
        playGuitar(e.n, at, e.v);
      } else if (e.k === 'd') {
        drumKit('layer', e.kit || 'classic')[e.n](at, e.v);
      }
    } catch (err) { /* nota fora de hora: ignora */ }
  });
}

// Guarda uma nota tocada ao vivo (se estiver gravando uma camada)
function captureNote(ev, delaySec = 0) {
  if (!layerRec || layerRec.phase !== 'rec' || !audio.ready) return;
  let tk = Tone.Transport.ticks + delaySec / secPerTick();
  if (tk >= layerRec.end) return;
  tk = Math.max(tk, layerRec.start); // notas um tiquinho adiantadas entram no começo
  const e = { ...ev, tk: Math.round(tk) };
  layerRec.events.push(e);
  if (e.k === 'p') layerRec.open.set(e.n, e);
}

function captureRelease(note) {
  if (!layerRec || !layerRec.open.has(note)) return;
  const e = layerRec.open.get(note);
  e.d = Math.max(SIXTEENTH / 2, Math.min(layerRec.end, Tone.Transport.ticks) - e.tk);
  layerRec.open.delete(note);
}

async function toggleLayerRecording() {
  if (layerRec) { cancelLayerRecording(); toast('Gravação da camada cancelada'); return; }
  if (state.layers.length >= MAX_LAYERS) { toast(`Máximo de ${MAX_LAYERS} camadas. Apague uma para gravar outra.`); return; }
  if (!(await ensureAudio())) return;

  const L = loopTicks();
  const running = Tone.Transport.state === 'started';
  const now = running ? Tone.Transport.ticks : 0;
  // Começa num início de compasso, com pelo menos 1 compasso de preparação
  const start = Math.ceil((now + BAR) / BAR) * BAR;

  layerRec = {
    phase: 'count',
    start,
    end: start + L,
    events: [],
    open: new Map(),
    instrument: state.instrument,
    kit: state.kit,
    ids: [],
  };

  // 4 batidas de contagem (agudo no 1º tempo)
  for (let b = 4; b >= 1; b--) {
    const tick = start - b * PPQ;
    layerRec.ids.push(Tone.Transport.scheduleOnce((time) => {
      audio.countSynth.triggerAttackRelease(b === 4 ? 'C6' : 'G5', '32n', voiceTime('count', time));
      Tone.Draw.schedule(() => showCount(b), time);
    }, `${tick}i`));
  }

  layerRec.ids.push(Tone.Transport.scheduleOnce((time) => {
    Tone.Draw.schedule(() => { if (layerRec) layerRec.phase = 'rec'; renderLayerRecUI(); }, time);
  }, `${start}i`));

  layerRec.ids.push(Tone.Transport.scheduleOnce((time) => {
    Tone.Draw.schedule(finishLayerRecording, time);
  }, `${start + L}i`));

  // Mostra o palco, pra você ver a contagem
  const r = el.stage.getBoundingClientRect();
  if (r.top < 0 || r.bottom > window.innerHeight) el.stage.scrollIntoView({ behavior: 'smooth', block: 'center' });

  // As camadas já gravadas tocam junto
  setLayersOn(true);
  syncTransport();
  renderLayerRecUI();
}

function cancelLayerRecording() {
  if (!layerRec) return;
  layerRec.ids.forEach((id) => Tone.Transport.clear(id));
  layerRec = null;
  renderLayerRecUI();
  syncTransport();
}

function finishLayerRecording() {
  if (!layerRec) return;
  const rec = layerRec;
  // A fase pode não ter virado ainda se a aba ficou escondida
  rec.phase = 'done';
  rec.ids.forEach((id) => Tone.Transport.clear(id));
  layerRec = null;

  const L = rec.end - rec.start;
  const events = rec.events.map((e) => {
    const out = { k: e.k, n: e.n, v: Math.round(e.v * 100) / 100, t: ((e.tk % L) + L) % L };
    if (e.k === 'p') out.d = Math.min(L, e.d || rec.end - e.tk);
    if (e.k === 's') out.i = e.i;
    if (e.k === 'd') out.kit = e.kit || 'classic';
    return out;
  });

  renderLayerRecUI();

  if (!events.length) {
    toast('Nada foi tocado nessa camada 🤔');
    syncTransport();
    return;
  }

  // Nome da camada: o instrumento (ou o kit, nas batidas) + número
  const base = rec.instrument === 'drums' ? KITS[rec.kit].label : INSTRUMENT_INFO[rec.instrument].label;
  const count = state.layers.filter((l) => l.name.startsWith(base + ' ')).length + 1;
  const layer = { id: Date.now().toString(36) + layerSeq++, inst: rec.instrument, name: `${base} ${count}`, events, muted: false };
  bucketize(layer);
  state.layers.push(layer);
  saveLayers();
  renderLayers();
  toast(`${layer.name} gravada! Grave outra por cima 🎛️`);
}

function saveLayers() {
  store.set('layers', state.layers.map(({ buckets, ...l }) => l));
  store.set('layerBars', state.layerBars);
  el.layerBars.disabled = state.layers.length > 0;
  el.layerBars.title = state.layers.length ? 'Apague as camadas para mudar o tamanho do loop' : '';
}

function setLayersOn(on) {
  state.layersOn = on;
  el.layersPlay.setAttribute('aria-pressed', String(on));
  el.layersPlay.setAttribute('aria-label', on ? 'Parar as camadas' : 'Tocar as camadas');
  el.layersPlay.title = on ? 'Parar as camadas' : 'Tocar as camadas';
  $('use', el.layersPlay).setAttribute('href', on ? '#i-stop' : '#i-play');
}

function renderLayers() {
  const L = loopTicks();
  el.layersList.style.setProperty('--beats', state.layerBars * 4);
  el.layersList.innerHTML = state.layers.map((l) => {
    const info = INSTRUMENT_INFO[l.inst] || INSTRUMENT_INFO.piano;
    const dots = l.events.slice(0, 160).map((e) => `<i style="left:${((e.t / L) * 100).toFixed(2)}%"></i>`).join('');
    const notes = l.events.length === 1 ? '1 nota' : `${l.events.length} notas`;
    return `
      <li class="layer${l.muted ? ' is-muted' : ''}" data-id="${l.id}" style="--lc:${info.color}">
        <span class="layer-dot" aria-hidden="true"></span>
        <span class="layer-name">${l.name}<small>${notes}</small></span>
        <span class="layer-track" aria-hidden="true">${dots}</span>
        <button class="round-btn round-btn-sm" type="button" data-act="mute" aria-pressed="${l.muted}" aria-label="${l.muted ? 'Ligar' : 'Silenciar'} ${l.name}" title="${l.muted ? 'Ligar' : 'Silenciar'}">
          <svg class="ico"><use href="${l.muted ? '#i-mute' : '#i-volume'}"/></svg>
        </button>
        <button class="round-btn round-btn-sm" type="button" data-act="del" aria-label="Apagar ${l.name}" title="Apagar">
          <svg class="ico"><use href="#i-trash"/></svg>
        </button>
      </li>`;
  }).join('');
  el.layersHint.hidden = state.layers.length > 1;
}

function renderLayerRecUI() {
  const phase = layerRec ? layerRec.phase : 'idle';
  el.layerRec.dataset.phase = phase;
  el.layerRec.setAttribute('aria-pressed', String(!!layerRec));
  el.layerRecLabel.textContent = phase === 'count' ? 'Prepare… (cancelar)' : phase === 'rec' ? 'Gravando… (cancelar)' : 'Gravar camada';

  el.stageLoop.hidden = !layerRec;
  el.stageLoop.dataset.phase = phase;
  el.stageLoopText.textContent = phase === 'count'
    ? `Prepare… ${INSTRUMENT_INFO[layerRec.instrument].label}`
    : `Gravando camada ${state.layers.length + 1}`;
  if (phase !== 'count') el.stageLoopCount.textContent = '';
}

function showCount(n) {
  if (!layerRec || layerRec.phase !== 'count') return;
  el.stageLoopCount.textContent = n;
  el.stageLoopCount.classList.remove('is-pop');
  void el.stageLoopCount.offsetWidth;
  el.stageLoopCount.classList.add('is-pop');
  el.layerRecLabel.textContent = `Prepare… ${n}`;
}

// Atualiza a agulha das camadas e a barra de progresso da gravação
let uiRunning = false;
function kickUi() {
  if (uiRunning) return;
  uiRunning = true;
  requestAnimationFrame(uiTick);
}

function uiTick() {
  const running = audio.ready && Tone.Transport.state === 'started';
  if (running) {
    const tk = Tone.Transport.ticks;
    if (state.layers.length) {
      const L = loopTicks();
      el.layersList.style.setProperty('--ph', state.layersOn ? `${(((tk % L) + L) % L) / L * 100}%` : '-10%');
    }
    if (layerRec && layerRec.phase === 'rec') {
      el.stageLoopBar.style.width = `${clamp((tk - layerRec.start) / (layerRec.end - layerRec.start), 0, 1) * 100}%`;
    }
  } else {
    el.layersList.style.setProperty('--ph', '-10%');
  }
  if (needsTransport()) requestAnimationFrame(uiTick);
  else uiRunning = false;
}

/* =========================================================
   CÂMERA + DETECÇÃO DAS MÃOS
   ========================================================= */
let landmarker = null;
let lastVideoTime = -1;
let hands = [];             // mãos atuais, em coordenadas do palco (0 a 1)
let prevHands = [];
let lastFrameAt = 0;

async function loadLandmarker() {
  let lastError = null;
  for (const url of MEDIAPIPE_URLS) {
    try {
      const { FilesetResolver, HandLandmarker } = await import(url);
      const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM(url));
      try {
        return await HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: HAND_MODEL, delegate: 'GPU' },
          runningMode: 'VIDEO',
          numHands: 2,
          minHandDetectionConfidence: 0.6,
          minTrackingConfidence: 0.5,
        });
      } catch {
        // Sem placa de vídeo disponível: usa o processador
        return await HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: HAND_MODEL, delegate: 'CPU' },
          runningMode: 'VIDEO',
          numHands: 2,
        });
      }
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('Não foi possível carregar o detector de mãos');
}

async function start() {
  el.startError.textContent = '';

  if (!window.isSecureContext) {
    el.startError.textContent = 'A câmera só funciona em sites com https (como na Netlify) ou no localhost.';
    return;
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    el.startError.textContent = 'Seu navegador não permite usar a câmera. Tente no Chrome, Edge, Firefox ou Safari atualizados.';
    return;
  }
  if (!window.Tone) {
    el.startError.textContent = 'A biblioteca de som não carregou. Confira a internet e recarregue a página.';
    return;
  }

  el.loading.hidden = false;

  try {
    // O som precisa ser liberado por um clique (antes de qualquer espera)
    el.loadingText.textContent = 'Ligando o som…';
    unlockMobileAudio();
    await Tone.start();
    setupAudio();

    el.loadingText.textContent = 'Pedindo acesso à câmera…';
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    el.video.srcObject = stream;
    await el.video.play();

    el.loadingText.textContent = 'Carregando o detector de mãos…';
    landmarker = await loadLandmarker();

    // Alguns celulares pausam o som quando a câmera liga
    resumeAudio();

    state.cameraOn = true;
    el.body.dataset.camera = 'on';
    el.loading.hidden = true;
    el.status.hidden = false;
    resizeStage();
    buildOverlays();
    requestAnimationFrame(loop);
    toast('Mostre as mãos pra câmera e toque! 🎶');
  } catch (err) {
    el.loading.hidden = true;
    console.error('[air music]', err);
    if (err && err.name === 'NotAllowedError') {
      el.startError.textContent = 'Você não permitiu a câmera. Clique no ícone de câmera na barra de endereço, libere o acesso e tente de novo.';
    } else if (err && (err.name === 'NotFoundError' || err.name === 'OverconstrainedError')) {
      el.startError.textContent = 'Não encontrei nenhuma câmera neste aparelho.';
    } else if (err && err.name === 'NotReadableError') {
      el.startError.textContent = 'A câmera está sendo usada por outro programa. Feche-o e tente de novo.';
    } else {
      el.startError.textContent = 'Algo deu errado ao preparar a câmera ou o detector de mãos. Recarregue a página e tente de novo.';
    }
  }
}

// Converte um ponto do vídeo para o palco (vídeo espelhado + recorte "cover")
let mapping = { scale: 1, offX: 0, offY: 0, sw: 1, sh: 1, vw: 1, vh: 1 };

function updateMapping() {
  const sw = el.stage.clientWidth;
  const sh = el.stage.clientHeight;
  const vw = el.video.videoWidth || 1280;
  const vh = el.video.videoHeight || 720;
  const scale = Math.max(sw / vw, sh / vh);
  mapping = { scale, offX: (sw - vw * scale) / 2, offY: (sh - vh * scale) / 2, sw, sh, vw, vh };
}

function toStage(p) {
  const x = (mapping.offX + (1 - p.x) * mapping.vw * mapping.scale) / mapping.sw;
  const y = (mapping.offY + p.y * mapping.vh * mapping.scale) / mapping.sh;
  return { x, y };
}

function loop(now) {
  if (!state.cameraOn) return;

  if (landmarker && el.video.readyState >= 2 && el.video.currentTime !== lastVideoTime) {
    lastVideoTime = el.video.currentTime;
    let result = null;
    try { result = landmarker.detectForVideo(el.video, now); } catch { result = null; }

    const dt = lastFrameAt ? Math.min(0.1, (now - lastFrameAt) / 1000) : 1 / 30;
    lastFrameAt = now;

    prevHands = hands;
    hands = ((result && result.landmarks) || []).map((lm) => {
      const pts = lm.map(toStage);
      return { pts, cx: pts[9].x, cy: pts[9].y, size: dist(pts[0], pts[9]) || 0.1 };
    });

    // Ordena da esquerda para a direita da tela e acha a mão "anterior" correspondente
    hands.sort((a, b) => a.cx - b.cx);
    hands.forEach((h) => {
      let best = null;
      let bestD = 0.25;
      prevHands.forEach((p) => { const d = Math.hypot(p.cx - h.cx, p.cy - h.cy); if (d < bestD) { bestD = d; best = p; } });
      h.prev = best;
      h.dt = dt;
      // Suaviza um pouco o tremor da detecção
      if (best) h.pts = h.pts.map((p, i) => ({ x: best.pts[i].x * 0.35 + p.x * 0.65, y: best.pts[i].y * 0.35 + p.y * 0.65 }));
    });

    updateStatus();
    handleInstrument();
  }

  drawHands(now);
  if (rec && rec.canvas) drawComposite(rec.canvas);
  requestAnimationFrame(loop);
}

function updateStatus() {
  if (!audioIsRunning()) {
    el.status.classList.remove('is-tracking');
    el.statusText.textContent = '🔇 Toque na tela pra ligar o som';
    return;
  }
  el.status.classList.toggle('is-tracking', hands.length > 0);
  el.statusText.textContent = hands.length === 0
    ? 'Mostre as mãos pra câmera'
    : hands.length === 1 ? '1 mão detectada' : '2 mãos detectadas';
}

// Velocidade vertical de um ponto (alturas do palco por segundo; positivo = descendo)
function vy(hand, idx) {
  if (!hand.prev) return 0;
  return (hand.pts[idx].y - hand.prev.pts[idx].y) / hand.dt;
}

/* ---------------------------------------------------------
   Desenho dos pontos das mãos
   --------------------------------------------------------- */
const bursts = []; // círculos que se expandem quando algo toca

function addBurst(x, y, color) {
  bursts.push({ x, y, color, t: performance.now() });
}

function resizeStage() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  el.canvas.width = Math.round(el.stage.clientWidth * dpr);
  el.canvas.height = Math.round(el.stage.clientHeight * dpr);
  updateMapping();
  cacheRects();
}

function accentColor() {
  return getComputedStyle(el.body).getPropertyValue('--accent').trim() || '#b9a8e6';
}

function drawHands(now) {
  const g = el.canvas.getContext('2d');
  const W = el.canvas.width;
  const H = el.canvas.height;
  const dpr = W / Math.max(1, el.stage.clientWidth);
  g.clearRect(0, 0, W, H);
  const accent = accentColor();

  hands.forEach((h) => {
    h.pts.forEach((p, i) => {
      const isTip = TIPS.includes(i);
      const r = (isTip ? 6 : 3) * dpr;
      if (isTip) {
        g.beginPath();
        g.arc(p.x * W, p.y * H, r * 2.2, 0, Math.PI * 2);
        g.fillStyle = accent + '33';
        g.fill();
      }
      g.beginPath();
      g.arc(p.x * W, p.y * H, r, 0, Math.PI * 2);
      g.fillStyle = isTip ? accent : 'rgba(255,255,255,.75)';
      g.fill();
    });
  });

  // Círculos de "toque"
  for (let i = bursts.length - 1; i >= 0; i--) {
    const b = bursts[i];
    const age = (now - b.t) / 400;
    if (age >= 1) { bursts.splice(i, 1); continue; }
    g.beginPath();
    g.arc(b.x * W, b.y * H, (10 + age * 40) * dpr, 0, Math.PI * 2);
    g.strokeStyle = b.color;
    g.globalAlpha = 1 - age;
    g.lineWidth = 2.5 * dpr;
    g.stroke();
    g.globalAlpha = 1;
  }
}

/* =========================================================
   INSTRUMENTOS SOBRE O VÍDEO
   ========================================================= */
let rects = { keys: [], keysTop: 0, strings: [], stringsBox: null, pads: [], steps: [] };

function relRect(node) {
  const s = el.stage.getBoundingClientRect();
  const r = node.getBoundingClientRect();
  return { x: (r.left - s.left) / s.width, y: (r.top - s.top) / s.height, w: r.width / s.width, h: r.height / s.height };
}

function cacheRects() {
  if (!state.cameraOn) return;
  rects.keys = $$('.key', el.pianoOverlay).map((n) => ({ node: n, note: n.dataset.note, ...relRect(n) }));
  rects.keysTop = rects.keys.length ? Math.min(...rects.keys.map((k) => k.y)) : 0.66;

  rects.stringsBox = el.guitarStrings.offsetParent ? relRect(el.guitarStrings) : null;
  rects.strings = $$('.string', el.guitarStrings).map((n, i) => {
    const r = relRect(n);
    return { node: n, index: i, y: r.y + r.h / 2 };
  });

  rects.pads = $$('.pad', el.drumsOverlay).map((n) => ({ node: n, id: n.dataset.drum, ...relRect(n) }));
  rects.steps = $$('.step', el.drumsOverlay).map((n) => ({ node: n, drum: n.dataset.drum, step: Number(n.dataset.step), ...relRect(n) }));
}

function buildOverlays() {
  buildPiano();
  buildGuitar();
  buildDrums();
  requestAnimationFrame(cacheRects);
}

/* ----- Piano ----- */
const pianoFingers = new Map(); // "mão-dedo" → nota pressionada

function pianoNotes() {
  const { steps, keys } = SCALES[state.scale];
  const base = (state.octave + 1) * 12; // Dó da oitava escolhida (MIDI)
  const notes = [];
  for (let i = 0; notes.length < keys; i++) {
    const midi = base + Math.floor(i / steps.length) * 12 + steps[i % steps.length];
    notes.push(midi);
  }
  return notes;
}

function buildPiano() {
  el.pianoOverlay.innerHTML = pianoNotes().map((m) => {
    const pc = m % 12;
    const sharp = [1, 3, 6, 8, 10].includes(pc);
    return `<div class="key${sharp ? ' is-sharp' : ''}" data-note="${noteFromMidi(m)}">${SOLFEGE[pc]}</div>`;
  }).join('');
  pianoFingers.clear();
}

function handlePiano() {
  const active = new Set();
  rects.keys.forEach((k) => k.node.classList.remove('is-hover'));

  hands.forEach((h, hi) => {
    TIPS.forEach((tip) => {
      const p = h.pts[tip];
      const id = `${hi}-${tip}`;
      const key = rects.keys.find((k) => p.x >= k.x && p.x <= k.x + k.w && p.y >= k.y - 0.04 && p.y <= k.y + k.h);
      const pressed = pianoFingers.get(id);
      const inZone = key && p.y >= rects.keysTop + 0.02;

      if (key && !inZone) key.node.classList.add('is-hover');

      if (inZone) {
        if (!pressed && vy(h, tip) > 0.35 * sensK()) {
          // Dedo desceu sobre a tecla: toca
          const vel = clamp(0.35 + vy(h, tip) / 4, 0.35, 1);
          playPiano(key.note, vel);
          pianoFingers.set(id, key.note);
          addBurst(p.x, p.y, accentColor());
        } else if (pressed && pressed !== key.note) {
          // Deslizou para outra tecla: glissando
          releasePiano(pressed);
          playPiano(key.note, 0.6);
          pianoFingers.set(id, key.note);
        }
      } else if (pressed && p.y < rects.keysTop - 0.01) {
        releasePiano(pressed);
        pianoFingers.delete(id);
      }

      const now = pianoFingers.get(id);
      if (now) active.add(now);
    });
  });

  // Solta notas de dedos que sumiram da câmera
  [...pianoFingers.entries()].forEach(([id, note]) => {
    const [hi] = id.split('-').map(Number);
    if (!hands[hi]) { releasePiano(note); pianoFingers.delete(id); }
  });

  rects.keys.forEach((k) => k.node.classList.toggle('is-active', active.has(k.note)));
}

/* ----- Violão ----- */
let currentChord = CHORDS[0]; // começa em Dó, pra já sair som
let muted = false;
let pendingFingers = { count: -1, since: 0 };

function buildGuitar() {
  el.guitarStrings.innerHTML = STRING_WIDTHS.map((w) => `<span class="string" style="--w:${w}"></span>`).join('');
}

function renderChordLegend() {
  el.chordLegend.innerHTML = CHORDS.map((c) => `
    <li data-chord="${c.short}">
      <span class="chord-fingers" aria-hidden="true">${[1, 2, 3, 4, 5].map((n) => `<i class="${n <= c.fingers ? 'on' : ''}"></i>`).join('')}</span>
      <span><strong>${c.short}</strong> <small>${c.name}</small></span>
    </li>`).join('') + `
    <li data-chord="mute">
      <span class="chord-fingers" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
      <span><strong>✊</strong> <small>Mão fechada abafa</small></span>
    </li>`;
}

// Quantos dedos estão levantados (funciona com a mão em qualquer ângulo)
function countFingers(h) {
  const w = h.pts[0];
  let count = 0;
  for (let f = 1; f < 5; f++) {
    if (dist(h.pts[TIPS[f]], w) > dist(h.pts[PIPS[f]], w) * 1.12) count++;
  }
  // Polegar: aberto se a ponta estiver longe da base do mindinho
  if (dist(h.pts[4], h.pts[17]) > dist(h.pts[2], h.pts[17]) * 1.25) count++;
  return count;
}

function setChord(count) {
  const chord = CHORDS.find((c) => c.fingers === count) || null;
  const nowMuted = count === 0;
  if (chord === currentChord && nowMuted === muted) return;
  currentChord = chord || currentChord;
  muted = nowMuted;
  // Mão fechada abafa as cordas que ainda estão soando
  if (muted && audio.ready) {
    audio.guitar.releaseAll(Tone.now());
    audio.guitarFallback.releaseAll(Tone.now());
  }

  el.chordName.textContent = muted ? '✊' : currentChord ? currentChord.short : '—';
  el.chordHint.textContent = muted ? 'Abafado' : currentChord ? currentChord.name : 'Levante os dedos da mão esquerda';
  el.chordName.classList.remove('is-changed');
  void el.chordName.offsetWidth;
  el.chordName.classList.add('is-changed');

  $$('li', el.chordLegend).forEach((li) => li.classList.toggle('is-active', li.dataset.chord === (muted ? 'mute' : currentChord && currentChord.short)));
}

function handleGuitar() {
  if (!hands.length) return;

  // Mão da esquerda da tela = acordes; da direita = batida
  let chordHand = null;
  let strumHand = null;
  if (hands.length >= 2) { chordHand = hands[0]; strumHand = hands[hands.length - 1]; }
  else if (hands[0].cx < 0.5) chordHand = hands[0];
  else strumHand = hands[0];

  if (chordHand) {
    const n = countFingers(chordHand);
    const now = performance.now();
    if (n !== pendingFingers.count) pendingFingers = { count: n, since: now };
    else if (now - pendingFingers.since > 140 * Math.sqrt(sensK())) setChord(n);
  }

  if (strumHand && strumHand.prev && rects.stringsBox) {
    const p = strumHand.pts[8];
    const q = strumHand.prev.pts[8];
    const box = rects.stringsBox;
    const inside = p.x >= box.x - 0.05 && p.x <= box.x + box.w + 0.05;
    if (!inside) return;

    const crossed = rects.strings.filter((s) => (q.y - s.y) * (p.y - s.y) < 0);
    if (!crossed.length) return;

    const down = p.y > q.y;
    crossed.sort((a, b) => (down ? a.y - b.y : b.y - a.y));
    const speed = Math.abs(p.y - q.y) / strumHand.dt;
    // Movimento lento demais não conta como batida (depende da sensibilidade)
    if (speed < 0.25 * sensK()) return;
    const vel = clamp(0.4 + speed / 5, 0.4, 1);

    crossed.forEach((s, i) => {
      s.node.classList.remove('is-vibrating');
      void s.node.offsetWidth;
      s.node.classList.add('is-vibrating');
      if (muted || !currentChord) return;
      const note = currentChord.notes[s.index];
      if (!note) return;
      playGuitar(note, Tone.now() + i * 0.012, vel);
      captureNote({ k: 's', i: s.index, n: note, v: vel }, i * 0.012);
    });
    addBurst(p.x, p.y, accentColor());
  }
}

/* ----- Batidas ----- */
const padCooldown = new Map();
const pinchState = new Map();

function buildDrums() {
  if (state.drumMode === 'pads') {
    el.drumsOverlay.innerHTML = DRUMS.map((d) => `
      <div class="pad" data-drum="${d.id}" style="--pc:${d.color}">
        ${d.label}<small>${d.en}</small>
      </div>`).join('');
  } else {
    el.drumsOverlay.innerHTML = sequencerHtml();
  }
}

function hitDrum(id, velocity = 0.9) {
  if (!audio.ready) return;
  drumKit('live')[id](Tone.now(), velocity);
  captureNote({ k: 'd', n: id, v: velocity, kit: state.kit });
  const pad = rects.pads.find((p) => p.id === id);
  if (pad) {
    pad.node.classList.remove('is-hit');
    void pad.node.offsetWidth;
    pad.node.classList.add('is-hit');
    setTimeout(() => pad.node.classList.remove('is-hit'), 120);
  }
}

function handleDrums() {
  if (state.drumMode === 'pads') {
    rects.pads.forEach((p) => p.node.classList.remove('is-hover'));
    hands.forEach((h, hi) => {
      [8, 12].forEach((tip) => {
        const p = h.pts[tip];
        const pad = rects.pads.find((r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h);
        if (!pad) return;
        pad.node.classList.add('is-hover');
        const id = `${hi}-${pad.id}`; // um toque por mão, mesmo com 2 dedos juntos
        const last = padCooldown.get(id) || 0;
        const speed = vy(h, tip);
        if (speed > 1.1 * sensK() && performance.now() - last > 160) {
          padCooldown.set(id, performance.now());
          hitDrum(pad.id, clamp(0.45 + speed / 6, 0.45, 1));
          addBurst(p.x, p.y, DRUMS.find((d) => d.id === pad.id).color);
        }
      });
    });
  } else {
    // Sequenciador no ar: "pinça" (polegar + indicador) liga e desliga um passo
    rects.steps.forEach((s) => s.node.classList.remove('is-hover'));
    hands.forEach((h, hi) => {
      const mid = { x: (h.pts[4].x + h.pts[8].x) / 2, y: (h.pts[4].y + h.pts[8].y) / 2 };
      const pinching = dist(h.pts[4], h.pts[8]) < h.size * 0.35 / Math.sqrt(sensK());
      const step = rects.steps.find((s) => mid.x >= s.x && mid.x <= s.x + s.w && mid.y >= s.y && mid.y <= s.y + s.h);
      if (step) step.node.classList.add('is-hover');

      const was = pinchState.get(hi) || false;
      if (pinching && !was && step) {
        toggleStep(step.drum, step.step);
        addBurst(mid.x, mid.y, DRUMS.find((d) => d.id === step.drum).color);
      }
      pinchState.set(hi, pinching);
    });
  }
}

function handleInstrument() {
  if (state.instrument === 'piano') handlePiano();
  else if (state.instrument === 'guitar') handleGuitar();
  else handleDrums();
}

/* ---------------------------------------------------------
   Sequenciador (painel + palco)
   --------------------------------------------------------- */
function sequencerHtml() {
  return `<div class="seq" style="--rows:${DRUMS.length}">${DRUMS.map((d) => `
    <div class="seq-row" style="--pc:${d.color}">
      <span class="seq-label">${d.label}</span>
      ${state.pattern[d.id].map((on, i) => `<button type="button" class="step${on ? ' is-on' : ''}${i % 4 === 0 ? ' is-beat' : ''}" data-drum="${d.id}" data-step="${i}" style="--pc:${d.color}" aria-label="${d.label}, passo ${i + 1}" aria-pressed="${on}"></button>`).join('')}
    </div>`).join('')}</div>`;
}

function renderSequencer() {
  el.sequencer.innerHTML = sequencerHtml();
  if (state.drumMode === 'sequencer' && state.cameraOn) {
    el.drumsOverlay.innerHTML = sequencerHtml();
    requestAnimationFrame(cacheRects);
  }
}

function toggleStep(drum, step) {
  state.pattern[drum][step] = !state.pattern[drum][step];
  store.set('pattern', state.pattern);
  const on = state.pattern[drum][step];
  $$(`.step[data-drum="${drum}"][data-step="${step}"]`).forEach((b) => {
    b.classList.toggle('is-on', on);
    b.setAttribute('aria-pressed', String(on));
  });
  if (on && audio.ready) drumKit('live')[drum](Tone.now(), 0.8);
}

let lastPlayhead = -1;
function showPlayhead(step) {
  if (step === lastPlayhead) return;
  $$('.step.is-playhead').forEach((b) => b.classList.remove('is-playhead'));
  if (step >= 0) $$(`.step[data-step="${step}"]`).forEach((b) => b.classList.add('is-playhead'));
  lastPlayhead = step;
}

/* =========================================================
   CONTROLES
   ========================================================= */
function setInstrument(name) {
  state.instrument = name;
  store.set('instrument', name);
  el.body.dataset.instrument = name;
  el.instrumentTabs.forEach((b) => b.setAttribute('aria-selected', String(b.dataset.instrument === name)));
  $$('.panel[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== name; });

  // Sem "manter o loop", ele para ao sair das batidas
  if (name !== 'drums' && state.loopOn && !state.loopUnder) setLoop(false);

  // Solta notas presas do piano
  pianoFingers.forEach((note) => releasePiano(note));
  pianoFingers.clear();

  requestAnimationFrame(cacheRects);
}

function setDrumMode(mode) {
  state.drumMode = mode;
  store.set('drumMode', mode);
  el.body.dataset.drumMode = mode;
  $$('button', el.drumMode).forEach((b) => b.setAttribute('aria-checked', String(b.dataset.mode === mode)));
  el.drumsHint.textContent = mode === 'pads'
    ? 'Bata no ar sobre os pads, de cima para baixo, como numa bateria.'
    : 'No palco, faça uma "pinça" (junte polegar e indicador) sobre um quadradinho para ligar ou desligar. Também dá pra clicar aqui embaixo.';
  if (state.cameraOn) { buildDrums(); requestAnimationFrame(cacheRects); }
}

// Troca o kit de bateria (som + nomes dos pads)
function setKit(kitId, { keepPattern = false } = {}) {
  if (!KITS[kitId]) kitId = 'classic';
  state.kit = kitId;
  store.set('kit', kitId);
  applyKitNames(kitId);
  $$('button', el.drumKit).forEach((b) => b.setAttribute('aria-checked', String(b.dataset.kit === kitId)));
  el.body.dataset.kit = kitId;

  // Se a sequência for vazia ou uma das prontas, já carrega a batida do estilo
  if (!keepPattern) {
    const current = JSON.stringify(state.pattern);
    const isPreset = Object.values(PRESETS).some((p) => JSON.stringify(makePattern(p)) === current);
    const isEmpty = !Object.values(state.pattern).some((row) => row.some(Boolean));
    if (isPreset || isEmpty) {
      const kit = KITS[kitId];
      state.pattern = makePattern(PRESETS[kit.preset]);
      store.set('pattern', state.pattern);
      setBpm(kit.bpm);
    }
  }

  if (audio.ready) { drumKit('live'); drumKit('seq'); }
  renderSequencer();
  if (state.cameraOn) { buildDrums(); requestAnimationFrame(cacheRects); }
}

function setBpm(bpm) {
  state.bpm = clamp(Math.round(bpm), 60, 180);
  store.set('bpm', state.bpm);
  el.bpmRange.value = state.bpm;
  el.bpmValue.textContent = state.bpm;
  el.bpmRange.style.setProperty('--v', `${((state.bpm - 60) / 120) * 100}%`);
  if (audio.ready) Tone.Transport.bpm.rampTo(state.bpm, 0.1);
}

async function ensureAudio() {
  if (!window.Tone) { toast('A biblioteca de som não carregou.'); return false; }
  if (Tone.context.state !== 'running') await Tone.start();
  setupAudio();
  return true;
}

async function setLoop(on) {
  if (on && !(await ensureAudio())) return;
  state.loopOn = on;
  el.loopPlay.setAttribute('aria-pressed', String(on));
  $('use', el.loopPlay).setAttribute('href', on ? '#i-stop' : '#i-play');
  $('span', el.loopPlay).textContent = on ? 'Parar loop' : 'Tocar loop';
  if (audio.ready) {
    if (on) audio.sequence.start(0);
    else audio.sequence.stop();
  }
  syncTransport();
}

function setVolume(v) {
  state.volume = clamp(v, 0, 1);
  store.set('volume', state.volume);
  el.volume.value = state.volume;
  el.volume.style.setProperty('--v', `${state.volume * 100}%`);
  if (audio.ready) Tone.Destination.volume.rampTo(Tone.gainToDb(Math.max(0.0001, state.volume)), 0.05);
}

function setVideoHidden(hidden) {
  state.videoHidden = hidden;
  store.set('videoHidden', hidden);
  el.body.dataset.video = hidden ? 'hidden' : 'visible';
  el.toggleVideo.setAttribute('aria-pressed', String(hidden));
  el.toggleVideo.setAttribute('aria-label', hidden ? 'Mostrar o vídeo' : 'Esconder o vídeo');
  el.toggleVideo.title = hidden ? 'Mostrar o vídeo' : 'Esconder o vídeo';
  $('use', el.toggleVideo).setAttribute('href', hidden ? '#i-eye-off' : '#i-eye');
}

function setSens(value) {
  state.sens = clamp(Math.round(value), 1, 5);
  store.set('sens', state.sens);
  el.sensRange.value = state.sens;
  el.sensRange.style.setProperty('--v', `${((state.sens - 1) / 4) * 100}%`);
  el.sensValue.textContent = SENS_LABELS[state.sens - 1];
}

function setRecordMode(mode) {
  if (rec) { toast('Pare a gravação antes de trocar'); return; }
  state.recordMode = mode === 'audio' ? 'audio' : 'video';
  store.set('recordMode', state.recordMode);
  $$('button', el.recordMode).forEach((b) => b.setAttribute('aria-checked', String(b.dataset.rec === state.recordMode)));
}

/* ----- Gravação (áudio ou vídeo) ----- */
let rec = null;          // { recorder, kind, chunks, canvas, started, timer }
let lastResultUrl = null;
let lastResultFile = null;

function pickMime(kind) {
  if (!window.MediaRecorder) return null;
  const list = kind === 'video'
    ? ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
    : ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
  const can = (t) => { try { return MediaRecorder.isTypeSupported(t); } catch { return false; } };
  return list.find(can) || '';
}

function extFor(type, kind) {
  if (type.includes('mp4')) return kind === 'video' ? 'mp4' : 'm4a';
  if (type.includes('ogg')) return 'ogg';
  return 'webm';
}

async function toggleRecording() {
  if (rec) { stopRecording(); return; }
  if (!(await ensureAudio())) return;

  const kind = state.recordMode === 'video' ? 'video' : 'audio';
  if (kind === 'video' && !state.cameraOn) {
    toast('Ligue a câmera pra gravar vídeo (ou escolha "Só áudio")');
    return;
  }

  const mime = pickMime(kind);
  if (mime === null) { toast('Seu navegador não consegue gravar 😕'); return; }

  const tracks = [...audio.streamDest.stream.getAudioTracks()];
  let canvas = null;
  if (kind === 'video') {
    canvas = document.createElement('canvas');
    sizeComposite(canvas);
    drawComposite(canvas);
    if (!canvas.captureStream) { toast('Seu navegador não grava vídeo. Tente "Só áudio".'); return; }
    tracks.unshift(...canvas.captureStream(30).getVideoTracks());
  }

  let recorder;
  try {
    const opts = mime ? { mimeType: mime } : {};
    if (kind === 'video') opts.videoBitsPerSecond = 6_000_000;
    opts.audioBitsPerSecond = 192_000;
    recorder = new MediaRecorder(new MediaStream(tracks), opts);
  } catch {
    try { recorder = new MediaRecorder(new MediaStream(tracks)); } catch { toast('Não deu pra começar a gravar 😕'); return; }
  }

  rec = { recorder, kind, chunks: [], canvas, started: Date.now(), timer: null };
  recorder.ondataavailable = (e) => { if (e.data && e.data.size) rec.chunks.push(e.data); };
  recorder.onstop = () => onRecordingDone(rec);
  recorder.start(1000);

  el.recordBtn.setAttribute('aria-pressed', 'true');
  el.recordLabel.textContent = 'Parar';
  $('use', el.recordBtn).setAttribute('href', '#i-stop');
  el.stageRec.hidden = false;
  rec.timer = setInterval(() => {
    const s = Math.floor((Date.now() - rec.started) / 1000);
    el.recTime.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }, 250);
  toast(kind === 'video' ? 'Gravando vídeo… 🎬' : 'Gravando áudio… 🎙️');
}

function stopRecording() {
  if (!rec) return;
  clearInterval(rec.timer);
  el.recordBtn.setAttribute('aria-pressed', 'false');
  el.recordLabel.textContent = 'Gravar';
  $('use', el.recordBtn).setAttribute('href', '#i-record');
  el.stageRec.hidden = true;
  el.recTime.textContent = '00:00';
  try { rec.recorder.stop(); } catch { onRecordingDone(rec); }
}

function onRecordingDone(r) {
  if (r.done) return;
  r.done = true;
  if (r.canvas) r.canvas.width = r.canvas.height = 0;
  if (rec === r) rec = null;

  const type = r.recorder.mimeType || (r.chunks[0] && r.chunks[0].type) || (r.kind === 'video' ? 'video/webm' : 'audio/webm');
  const blob = new Blob(r.chunks, { type });
  if (!blob.size) { toast('A gravação ficou vazia 😕'); return; }

  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
  const name = `air-music-${stamp}.${extFor(type, r.kind)}`;
  const secs = Math.round((Date.now() - r.started) / 1000);
  openResult(blob, name, r.kind, secs);
}

function openResult(blob, name, kind, secs) {
  if (lastResultUrl) URL.revokeObjectURL(lastResultUrl);
  lastResultUrl = URL.createObjectURL(blob);
  lastResultFile = null;
  try { lastResultFile = new File([blob], name, { type: blob.type }); } catch { /* navegador antigo */ }

  el.recMedia.innerHTML = kind === 'video'
    ? `<video src="${lastResultUrl}" controls playsinline></video>`
    : `<audio src="${lastResultUrl}" controls></audio>`;
  const mb = (blob.size / 1048576).toFixed(1).replace('.', ',');
  el.recMeta.textContent = `${name} · ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')} · ${mb} MB`;
  el.recDownload.href = lastResultUrl;
  el.recDownload.download = name;

  let canShare = false;
  try { canShare = !!(lastResultFile && navigator.canShare && navigator.canShare({ files: [lastResultFile] })); } catch { canShare = false; }
  el.recShare.hidden = !canShare;

  el.recSheet.hidden = false;
  el.body.style.overflow = 'hidden';
}

function closeResult() {
  el.recSheet.hidden = true;
  el.body.style.overflow = '';
  const media = $('video, audio', el.recMedia);
  if (media) media.pause();
}

async function shareResult() {
  if (!lastResultFile) return;
  try {
    await navigator.share({ files: [lastResultFile], title: 'AIR MUSIC', text: 'Toquei isso no ar 🎶' });
  } catch (err) {
    if (err && err.name !== 'AbortError') toast('Não deu pra compartilhar. Baixe o arquivo 🙂');
  }
}

/* ----- Vídeo: junta câmera + instrumento + pontos das mãos num canvas ----- */
function sizeComposite(canvas) {
  const sw = el.stage.clientWidth || 1280;
  const sh = el.stage.clientHeight || 720;
  // Nítido como a tela, mas no máximo 1280 px no lado maior
  const k = Math.min(Math.min(2, window.devicePixelRatio || 1), 1280 / Math.max(sw, sh));
  canvas.width = Math.round((sw * k) / 2) * 2;
  canvas.height = Math.round((sh * k) / 2) * 2;
}

function rrect(g, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function alpha(hex, a) {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function drawComposite(canvas) {
  const g = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const u = W / Math.max(1, el.stage.clientWidth); // 1 px do palco no vídeo
  const accent = INSTRUMENT_INFO[state.instrument].color;

  // Fundo
  const bg = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7);
  bg.addColorStop(0, alpha(accent, 0.12));
  bg.addColorStop(1, '#0a0a0c');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);

  // Câmera (espelhada, como no palco)
  if (!state.videoHidden && el.video.readyState >= 2) {
    const k = W / mapping.sw;
    g.save();
    g.translate(W, 0);
    g.scale(-1, 1);
    if ('filter' in g) g.filter = 'saturate(.75) brightness(.8)';
    g.drawImage(el.video, mapping.offX * k, mapping.offY * k, mapping.vw * mapping.scale * k, mapping.vh * mapping.scale * k);
    g.restore();
  }

  // Escurecida embaixo
  const shade = g.createLinearGradient(0, H, 0, H * 0.55);
  shade.addColorStop(0, 'rgba(10,10,12,.55)');
  shade.addColorStop(1, 'rgba(10,10,12,0)');
  g.fillStyle = shade;
  g.fillRect(0, 0, W, H);

  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';

  if (state.instrument === 'piano') {
    rects.keys.forEach((k) => {
      const x = k.x * W; const y = k.y * H; const w = k.w * W; const h = k.h * H;
      const on = k.node.classList.contains('is-active');
      const sharp = k.node.classList.contains('is-sharp');
      rrect(g, x, y + (on ? 3 * u : 0), w, h, 12 * u);
      g.fillStyle = on ? alpha(INSTRUMENT_INFO.piano.color, 0.6) : sharp ? 'rgba(0,0,0,.4)' : 'rgba(255,255,255,.1)';
      g.fill();
      g.lineWidth = 1 * u;
      g.strokeStyle = on ? INSTRUMENT_INFO.piano.color : 'rgba(255,255,255,.22)';
      g.stroke();
      g.fillStyle = on ? '#fff' : 'rgba(255,255,255,.7)';
      g.font = `500 ${11 * u}px "JetBrains Mono", monospace`;
      g.fillText(k.node.textContent, x + w / 2, y + h - 10 * u);
    });
  } else if (state.instrument === 'guitar') {
    // Acorde
    g.textAlign = 'left';
    const cx = 0.04 * W;
    const cy = el.chordName.offsetParent ? relRect(el.chordName) : { x: 0.04, y: 0.4, h: 0.12 };
    g.fillStyle = INSTRUMENT_INFO.guitar.color;
    g.font = `700 ${cy.h * H * 0.9}px "Unbounded", sans-serif`;
    g.fillText(el.chordName.textContent, cy.x * W || cx, (cy.y + cy.h * 0.85) * H);
    g.fillStyle = 'rgba(255,255,255,.75)';
    g.font = `400 ${13 * u}px "Inter", sans-serif`;
    g.fillText(el.chordHint.textContent, cy.x * W || cx, (cy.y + cy.h) * H + 20 * u);
    g.textAlign = 'center';

    // Cordas
    const box = rects.stringsBox;
    if (box) {
      g.fillStyle = alpha(INSTRUMENT_INFO.guitar.color, 0.35);
      g.fillRect(box.x * W, box.y * H, 3 * u, box.h * H);
      g.fillRect((box.x + box.w) * W - 3 * u, box.y * H, 3 * u, box.h * H);
      rects.strings.forEach((s) => {
        const vib = s.node.classList.contains('is-vibrating');
        g.fillStyle = vib ? INSTRUMENT_INFO.guitar.color : 'rgba(255,255,255,.6)';
        const th = (STRING_WIDTHS[s.index] * 1.5 + 1) * u;
        const wob = vib ? Math.sin(performance.now() / 18) * 2 * u : 0;
        g.fillRect(box.x * W, s.y * H - th / 2 + wob, box.w * W, th);
      });
    }
  } else if (state.drumMode === 'pads') {
    rects.pads.forEach((p) => {
      const d = DRUMS.find((x) => x.id === p.id);
      const x = p.x * W; const y = p.y * H; const w = p.w * W; const h = p.h * H;
      const hit = p.node.classList.contains('is-hit');
      rrect(g, x, y, w, h, 16 * u);
      g.fillStyle = hit ? alpha(d.color, 0.7) : alpha(d.color, 0.12);
      g.fill();
      g.lineWidth = 1 * u;
      g.strokeStyle = alpha(d.color, p.node.classList.contains('is-hover') || hit ? 1 : 0.45);
      g.stroke();
      g.textAlign = 'left';
      g.fillStyle = 'rgba(255,255,255,.88)';
      g.font = `600 ${12 * u}px "Inter", sans-serif`;
      g.fillText(d.label.toUpperCase(), x + 12 * u, y + h - 24 * u);
      g.fillStyle = 'rgba(255,255,255,.5)';
      g.font = `400 ${10 * u}px "JetBrains Mono", monospace`;
      g.fillText(d.en, x + 12 * u, y + h - 10 * u);
      g.textAlign = 'center';
    });
  } else {
    rects.steps.forEach((s) => {
      const d = DRUMS.find((x) => x.id === s.drum);
      const on = s.node.classList.contains('is-on');
      const ph = s.node.classList.contains('is-playhead');
      rrect(g, s.x * W, s.y * H, s.w * W, s.h * H, 4 * u);
      g.fillStyle = on ? d.color : 'rgba(10,10,12,.35)';
      g.fill();
      g.lineWidth = 1 * u;
      g.strokeStyle = ph ? 'rgba(255,255,255,.8)' : 'rgba(255,255,255,.12)';
      g.stroke();
    });
  }

  // Pontos das mãos
  if (el.canvas.width) g.drawImage(el.canvas, 0, 0, W, H);

  // Contagem da camada
  if (layerRec && layerRec.phase === 'count' && el.stageLoopCount.textContent) {
    g.fillStyle = accent;
    g.font = `700 ${Math.min(W, H) * 0.28}px "Unbounded", sans-serif`;
    g.textBaseline = 'middle';
    g.fillText(el.stageLoopCount.textContent, W / 2, H * 0.42);
    g.textBaseline = 'alphabetic';
  }

  // Marca d'água
  const m = 18 * u;
  g.textAlign = 'right';
  g.font = `700 ${13 * u}px "Unbounded", sans-serif`;
  g.fillStyle = 'rgba(255,255,255,.85)';
  g.fillText('AIR MUSIC', W - m, m + 12 * u);
  const tw = g.measureText('AIR MUSIC').width;
  for (let i = 0; i < 5; i++) {
    g.beginPath();
    g.arc(W - m - tw - 12 * u - i * 8 * u, m + 7 * u + Math.sin(performance.now() / 200 + i) * 2 * u, 2.5 * u, 0, Math.PI * 2);
    g.fillStyle = accent;
    g.fill();
  }
  g.textAlign = 'center';
}

/* ----- Tap tempo ----- */
let taps = [];
function tap() {
  const now = performance.now();
  taps = taps.filter((t) => now - t < 2500);
  taps.push(now);
  el.tapTempo.classList.add('is-tapped');
  setTimeout(() => el.tapTempo.classList.remove('is-tapped'), 100);
  if (taps.length >= 2) {
    const gaps = taps.slice(1).map((t, i) => t - taps[i]);
    const avg = gaps.slice(-4).reduce((a, b) => a + b, 0) / Math.min(4, gaps.length);
    setBpm(60000 / avg);
  }
}

/* ----- Toast ----- */
let toastTimer = null;
function toast(msg) {
  el.toast.textContent = msg;
  el.toast.classList.add('is-show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove('is-show'), 2600);
}

/* =========================================================
   EVENTOS
   ========================================================= */
el.startBtn.addEventListener('click', start);

el.instrumentTabs.forEach((b) => b.addEventListener('click', () => setInstrument(b.dataset.instrument)));

el.toggleVideo.addEventListener('click', () => setVideoHidden(!state.videoHidden));
el.recordBtn.addEventListener('click', toggleRecording);

el.pianoScale.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-scale]');
  if (!btn) return;
  state.scale = btn.dataset.scale;
  store.set('scale', state.scale);
  $$('button', el.pianoScale).forEach((b) => b.setAttribute('aria-checked', String(b === btn)));
  if (state.cameraOn) { buildPiano(); requestAnimationFrame(cacheRects); }
});

function changeOctave(delta) {
  state.octave = clamp(state.octave + delta, 2, 6);
  store.set('octave', state.octave);
  el.octaveValue.textContent = state.octave;
  if (state.cameraOn) { buildPiano(); requestAnimationFrame(cacheRects); }
}
el.octaveDown.addEventListener('click', () => changeOctave(-1));
el.octaveUp.addEventListener('click', () => changeOctave(1));

el.drumMode.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-mode]');
  if (btn) setDrumMode(btn.dataset.mode);
});

el.bpmRange.addEventListener('input', () => setBpm(Number(el.bpmRange.value)));
el.tapTempo.addEventListener('click', tap);
el.loopPlay.addEventListener('click', () => setLoop(!state.loopOn));

el.patternPreset.addEventListener('change', () => {
  const p = PRESETS[el.patternPreset.value];
  el.patternPreset.value = '';
  if (!p) return;
  if (p.kit && p.kit !== state.kit) setKit(p.kit, { keepPattern: true });
  if (p.bpm) setBpm(p.bpm);
  state.pattern = makePattern(p);
  store.set('pattern', state.pattern);
  renderSequencer();
  toast('Batida carregada! Aperte "Tocar loop" ▶');
});

el.drumKit.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-kit]');
  if (!btn || btn.dataset.kit === state.kit) return;
  setKit(btn.dataset.kit);
  // Toca o bumbo do kit novo pra você ouvir
  if (await ensureAudio()) drumKit('live').kick(Tone.now(), 0.9);
});

el.patternClear.addEventListener('click', () => {
  state.pattern = makePattern({});
  store.set('pattern', state.pattern);
  renderSequencer();
});

// Clique nos passos (painel e palco)
document.addEventListener('click', async (e) => {
  const step = e.target.closest('.step[data-drum]');
  if (!step) return;
  await ensureAudio();
  toggleStep(step.dataset.drum, Number(step.dataset.step));
});

el.volume.addEventListener('input', () => setVolume(Number(el.volume.value)));

el.metronome.addEventListener('change', async () => {
  if (el.metronome.checked && !(await ensureAudio())) { el.metronome.checked = false; return; }
  state.metronome = el.metronome.checked;
  if (audio.ready) {
    if (state.metronome) audio.metro.start(0);
    else audio.metro.stop();
  }
  syncTransport();
});

el.sensRange.addEventListener('input', () => setSens(Number(el.sensRange.value)));

el.recordMode.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-rec]');
  if (btn) setRecordMode(btn.dataset.rec);
});

// Camadas
el.layerRec.addEventListener('click', toggleLayerRecording);

el.layersPlay.addEventListener('click', async () => {
  if (!state.layers.length && !state.layersOn) { toast('Grave uma camada primeiro 🙂'); return; }
  if (!(await ensureAudio())) return;
  setLayersOn(!state.layersOn);
  if (!state.layersOn && layerRec) cancelLayerRecording();
  syncTransport();
});

el.layerBars.addEventListener('change', () => {
  state.layerBars = Number(el.layerBars.value) || 2;
  saveLayers();
  renderLayers();
});

el.layersClear.addEventListener('click', () => {
  if (!state.layers.length) return;
  cancelLayerRecording();
  state.layers = [];
  saveLayers();
  renderLayers();
  setLayersOn(false);
  syncTransport();
  toast('Camadas apagadas');
});

el.layersList.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const id = btn.closest('.layer').dataset.id;
  const layer = state.layers.find((l) => l.id === id);
  if (!layer) return;
  if (btn.dataset.act === 'mute') layer.muted = !layer.muted;
  else state.layers = state.layers.filter((l) => l !== layer);
  saveLayers();
  renderLayers();
  if (!state.layers.length) { setLayersOn(false); syncTransport(); }
});

// Resultado da gravação
el.recSheet.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeResult(); });
el.recShare.addEventListener('click', shareResult);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !el.recSheet.hidden) closeResult(); });

el.loopUnder.addEventListener('change', () => {
  state.loopUnder = el.loopUnder.checked;
  store.set('loopUnder', state.loopUnder);
});

// Atalhos: 1, 2, 3 trocam o instrumento; espaço liga/desliga o loop
document.addEventListener('keydown', (e) => {
  if (e.target.closest('input, select, textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === '1') setInstrument('piano');
  else if (e.key === '2') setInstrument('guitar');
  else if (e.key === '3') setInstrument('drums');
  else if (e.code === 'Space' && !e.target.closest('button')) { e.preventDefault(); setLoop(!state.loopOn); }
});

if ('ResizeObserver' in window) new ResizeObserver(resizeStage).observe(el.stage);
else window.addEventListener('resize', resizeStage);

// Pausa a detecção quando a aba fica escondida (economiza bateria)
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && state.cameraOn) {
    lastFrameAt = 0;
    resumeAudio();
  }
});

/* =========================================================
   INÍCIO
   ========================================================= */
function init() {
  el.footerYear.textContent = new Date().getFullYear();

  setInstrument(state.instrument);
  $$('button', el.pianoScale).forEach((b) => b.setAttribute('aria-checked', String(b.dataset.scale === state.scale)));
  el.octaveValue.textContent = state.octave;
  setKit(state.kit, { keepPattern: true });
  setDrumMode(state.drumMode);
  setBpm(state.bpm);
  setVolume(state.volume);
  setVideoHidden(state.videoHidden);
  el.loopUnder.checked = state.loopUnder;
  setSens(state.sens);
  setRecordMode(state.recordMode);

  // Camadas salvas da última visita
  state.layers = (Array.isArray(state.layers) ? state.layers : []).filter((l) => l && Array.isArray(l.events));
  state.layers.forEach(bucketize);
  el.layerBars.value = String(state.layerBars);
  saveLayers();
  renderLayers();
  setLayersOn(false);
  renderLayerRecUI();

  renderChordLegend();
  el.chordName.textContent = currentChord.short;
  el.chordHint.textContent = `${currentChord.name} · levante dedos da mão esquerda pra trocar`;
  $$('li', el.chordLegend).forEach((li) => li.classList.toggle('is-active', li.dataset.chord === currentChord.short));
  renderSequencer();
}

init();
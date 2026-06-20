// ── Audio engine ──────────────────────────────────────
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let masterGain = audioCtx.createGain();
masterGain.gain.value = 0.7;
masterGain.connect(audioCtx.destination);

// Recording
let recording = false, recordedNotes = [], playbackNodes = [];
let recordStart = 0, timerInterval = null;
let destNode = null, mediaRecorder = null, recordedChunks = [];

function noteFreq(note, octave) {
  const NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const idx = NOTES.indexOf(note);
  // A4 = 440Hz, MIDI: A4=69
  const midi = (octave + 1) * 12 + idx;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function playNote(note, octave, duration = 0.6) {
  audioCtx.resume();
  const freq = noteFreq(note, octave);
  const waveform = document.getElementById('waveform').value;

  const osc  = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = waveform;
  osc.frequency.value = freq;
  osc.connect(gain); gain.connect(masterGain);

  const now = audioCtx.currentTime;
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(0.8, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  osc.start(now); osc.stop(now + duration + 0.01);

  if (recording) {
    recordedNotes.push({ note, octave, time: Date.now() - recordStart });
  }
  return { osc, gain };
}

function stopNote(gain) {
  const now = audioCtx.currentTime;
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
}

// ── Keyboard layout ───────────────────────────────────
// One octave + one: C D E F G A B C (white) + C# D# F# G# A# (black)
const WHITE_NOTES = ['C','D','E','F','G','A','B','C','D','E','F','G','A','B','C'];
const BLACK_NOTES_MAP = { 0:'C#',1:'D#', 3:'F#',4:'G#',5:'A#', 7:'C#',8:'D#', 10:'F#',11:'G#',12:'A#' };
// White key positions for black key positioning
const BLACK_OFFSET = { 0:22, 1:58, 3:130, 4:166, 5:202, 7:274, 8:310, 10:382, 11:418, 12:454 };

const KEY_MAP = {
  'a':'C','w':'C#','s':'D','e':'D#','d':'E','f':'F','t':'F#',
  'g':'G','y':'G#','h':'A','u':'A#','j':'B','k':'C','o':'C#','l':'D',
};
const KEY_OCTAVE_OFFSET = {
  'a':0,'w':0,'s':0,'e':0,'d':0,'f':0,'t':0,
  'g':0,'y':0,'h':0,'u':0,'j':0,'k':1,'o':1,'l':1,
};

let octave = 4;
const activeNotes = new Map();
const noteHistory = [];

// ── Build piano keys ──────────────────────────────────
const pianoEl = document.getElementById('piano');
const wrapper = document.createElement('div');
wrapper.style.cssText = 'position:relative;display:flex;';

let whiteIdx = 0;
const whiteKeys = [];
const blackKeys = [];

WHITE_NOTES.forEach((note, i) => {
  const key = document.createElement('div');
  key.className = 'white-key';
  key.dataset.note = note;
  key.dataset.oct  = i >= 7 ? octave + 1 : octave;

  const lbl = document.createElement('span');
  lbl.className = 'key-label';
  lbl.textContent = note;
  key.appendChild(lbl);

  key.addEventListener('mousedown', e => { e.preventDefault(); triggerKey(note, i >= 7 ? octave + 1 : octave, key); });
  key.addEventListener('mouseup',   () => releaseKey(key));
  key.addEventListener('mouseleave',() => releaseKey(key));
  wrapper.appendChild(key);
  whiteKeys.push(key);
});

// Black keys
Object.entries(BLACK_OFFSET).forEach(([wIdx, leftPx]) => {
  const wi = parseInt(wIdx);
  if (!BLACK_NOTES_MAP[wi]) return;
  const note = BLACK_NOTES_MAP[wi];
  const oct  = wi >= 7 ? octave + 1 : octave;

  const key = document.createElement('div');
  key.className = 'black-key';
  key.dataset.note = note;
  key.dataset.oct  = oct;
  key.style.left = (leftPx + 8) + 'px';

  const lbl = document.createElement('span');
  lbl.className = 'key-label black'; lbl.textContent = note.replace('#','♯');
  key.appendChild(lbl);

  key.addEventListener('mousedown', e => { e.preventDefault(); triggerKey(note, oct, key); });
  key.addEventListener('mouseup',   () => releaseKey(key));
  key.addEventListener('mouseleave',() => releaseKey(key));
  wrapper.appendChild(key);
  blackKeys.push(key);
});

pianoEl.appendChild(wrapper);

// ── Trigger / release ─────────────────────────────────
function triggerKey(note, oct, keyEl) {
  const id = note + oct;
  if (activeNotes.has(id)) return;
  keyEl.classList.add('pressed');
  const nodes = playNote(note, oct, 2);
  activeNotes.set(id, { nodes, keyEl });
  showNoteChip(note, oct);
}

function releaseKey(keyEl) {
  const id = keyEl.dataset.note + keyEl.dataset.oct;
  keyEl.classList.remove('pressed');
  const entry = activeNotes.get(id);
  if (entry) { stopNote(entry.nodes.gain); activeNotes.delete(id); }
}

function showNoteChip(note, oct) {
  const container = document.getElementById('played-notes');
  const chip = document.createElement('div');
  chip.className = 'note-chip';
  chip.textContent = note + oct;
  container.appendChild(chip);
  if (container.children.length > 20) container.removeChild(container.firstChild);
  container.scrollTop = container.scrollHeight;
}

// ── Keyboard input ─────────────────────────────────────
const pressedKeys = new Set();
document.addEventListener('keydown', e => {
  if (e.target.tagName==='INPUT'||e.target.tagName==='SELECT') return;
  const key = e.key.toLowerCase();
  if (pressedKeys.has(key)) return;
  pressedKeys.add(key);

  if (key in KEY_MAP) {
    const note = KEY_MAP[key];
    const oct  = octave + KEY_OCTAVE_OFFSET[key];
    // Find and highlight key element
    const allKeys = [...wrapper.querySelectorAll('[data-note]')];
    const keyEl = allKeys.find(k => k.dataset.note===note && parseInt(k.dataset.oct)===oct && !k.classList.contains('black-key') === !note.includes('#'));
    if (keyEl) triggerKey(note, oct, keyEl);
  }
});
document.addEventListener('keyup', e => {
  const key = e.key.toLowerCase();
  pressedKeys.delete(key);
  if (key in KEY_MAP) {
    const note = KEY_MAP[key];
    const oct  = octave + KEY_OCTAVE_OFFSET[key];
    const allKeys = [...wrapper.querySelectorAll('[data-note]')];
    const keyEl = allKeys.find(k => k.dataset.note===note && parseInt(k.dataset.oct)===oct);
    if (keyEl) releaseKey(keyEl);
  }
});

// ── Octave control ────────────────────────────────────
document.getElementById('oct-down').addEventListener('click', () => {
  if (octave>1) { octave--; document.getElementById('oct-display').textContent=octave; updateKeyOctaves(); }
});
document.getElementById('oct-up').addEventListener('click', () => {
  if (octave<7) { octave++; document.getElementById('oct-display').textContent=octave; updateKeyOctaves(); }
});
function updateKeyOctaves() {
  WHITE_NOTES.forEach((note, i) => {
    const oct = i >= 7 ? octave + 1 : octave;
    whiteKeys[i].dataset.oct = oct;
  });
  Object.entries(BLACK_OFFSET).forEach(([wIdx, leftPx], j) => {
    const wi = parseInt(wIdx);
    const oct = wi >= 7 ? octave + 1 : octave;
    if (blackKeys[j]) blackKeys[j].dataset.oct = oct;
  });
}

// ── Volume ────────────────────────────────────────────
document.getElementById('volume').addEventListener('input', e => {
  masterGain.gain.value = parseFloat(e.target.value);
});

// ── Recording ─────────────────────────────────────────
const recBtn  = document.getElementById('btn-record');
const playBtn = document.getElementById('btn-play');
const stopBtn = document.getElementById('btn-stop');
const expBtn  = document.getElementById('btn-export');
const recStat = document.getElementById('rec-status');

recBtn.addEventListener('click', () => {
  if (!recording) {
    recording = true; recordedNotes = []; recordStart = Date.now();
    recBtn.textContent='⏹ 録音停止'; recBtn.classList.add('recording');
    let elapsed = 0;
    timerInterval = setInterval(() => {
      elapsed++; const m=Math.floor(elapsed/60), s=elapsed%60;
      recStat.textContent = `●REC ${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    }, 1000);
  } else {
    recording = false;
    recBtn.textContent='⏺ 録音'; recBtn.classList.remove('recording');
    clearInterval(timerInterval); recStat.textContent=`${recordedNotes.length}ノート録音`;
    playBtn.disabled = !recordedNotes.length;
    expBtn.disabled  = !recordedNotes.length;
  }
});

let playbackTimers = [];
playBtn.addEventListener('click', () => {
  playbackTimers.forEach(clearTimeout);
  playbackTimers = [];
  stopBtn.disabled = false;
  recordedNotes.forEach(({note, octave:oct, time}) => {
    const t = setTimeout(() => playNote(note, oct, 0.4), time);
    playbackTimers.push(t);
  });
  const totalDur = recordedNotes[recordedNotes.length-1]?.time || 0;
  const endT = setTimeout(() => { stopBtn.disabled=true; }, totalDur + 600);
  playbackTimers.push(endT);
});

stopBtn.addEventListener('click', () => {
  playbackTimers.forEach(clearTimeout); stopBtn.disabled=true;
});

// WAV export (simplified: generate a tone sequence)
expBtn.addEventListener('click', () => {
  const sampleRate = 44100, duration = (recordedNotes[recordedNotes.length-1]?.time||0)/1000 + 0.6;
  const samples = Math.ceil(sampleRate * duration);
  const buffer = new Float32Array(samples);

  recordedNotes.forEach(({note, octave:oct, time}) => {
    const freq = noteFreq(note, oct);
    const start = Math.floor(time/1000 * sampleRate);
    const noteDur = 0.4;
    for (let i=0;i<sampleRate*noteDur && start+i<samples;i++) {
      const t = i/sampleRate;
      const env = Math.min(t*50, 1) * Math.exp(-t*3);
      buffer[start+i] += Math.sin(2*Math.PI*freq*t) * env * 0.3;
    }
  });

  // Encode WAV
  const wav = encodeWAV(buffer, sampleRate);
  const blob = new Blob([wav], {type:'audio/wav'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='piano_recording.wav'; a.click();
});

function encodeWAV(samples, sampleRate) {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buf);
  const s16 = new Int16Array(samples.length);
  samples.forEach((s,i)=>s16[i]=Math.max(-32768,Math.min(32767,s*32767)));

  const writeStr = (off,str) => { for(let i=0;i<str.length;i++) view.setUint8(off+i,str.charCodeAt(i)); };
  writeStr(0,'RIFF'); view.setUint32(4,36+samples.length*2,true);
  writeStr(8,'WAVE'); writeStr(12,'fmt '); view.setUint32(16,16,true);
  view.setUint16(20,1,true); view.setUint16(22,1,true);
  view.setUint32(24,sampleRate,true); view.setUint32(28,sampleRate*2,true);
  view.setUint16(32,2,true); view.setUint16(34,16,true);
  writeStr(36,'data'); view.setUint32(40,samples.length*2,true);
  new Uint8Array(buf,44).set(new Uint8Array(s16.buffer));
  return buf;
}

document.getElementById('piano-wrap').focus();

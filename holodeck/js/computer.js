// Computer replies, typed input, speech recognition, save/load.
import { parseCommand, PRESETS } from './parser.js';
import { chirpOk, chirpNo, chirpLoad, chirpFreeze, speak, ensureAudio } from './audio.js';

const SAVE_KEY = 'gridchamber.saves.v1';

export function loadSaves() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY) || '{}'); } catch { return {}; }
}
export function writeSave(name, spec) {
  const all = loadSaves();
  all[name] = { spec, t: Date.now() };
  localStorage.setItem(SAVE_KEY, JSON.stringify(all));
}
export function readSave(name) {
  return loadSaves()[name] || null;
}
export function listSaveNames() {
  return Object.keys(loadSaves());
}

export function createComputerUI(rootEl, handlers) {
  const wrap = document.createElement('div');
  wrap.id = 'computer';
  wrap.innerHTML = `
    <div id="comp-reply">Grid chamber ready.</div>
    <div id="comp-row">
      <input id="comp-input" type="text" enterkeyhint="go" autocomplete="off" spellcheck="false"
        placeholder="Computer, create a beach at sunset" maxlength="120" />
      <button id="comp-go" type="button">Go</button>
      <button id="comp-mic" type="button" title="Voice">🎤</button>
    </div>
    <div id="comp-presets"></div>
  `;
  rootEl.appendChild(wrap);

  const replyEl = wrap.querySelector('#comp-reply');
  const input = wrap.querySelector('#comp-input');
  const goBtn = wrap.querySelector('#comp-go');
  const micBtn = wrap.querySelector('#comp-mic');
  const presets = wrap.querySelector('#comp-presets');

  for (const p of PRESETS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = p.label;
    b.addEventListener('click', () => {
      ensureAudio();
      input.value = p.cmd;
      run(p.cmd);
    });
    presets.appendChild(b);
  }

  let voiceOn = false;
  let recognizing = false;
  let rec = null;
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRec) {
    micBtn.disabled = true;
    micBtn.title = 'Voice not supported here';
    micBtn.style.opacity = '0.4';
  } else {
    rec = new SpeechRec();
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (e) => {
      const t = e.results[0][0].transcript;
      input.value = t;
      run(t);
    };
    rec.onerror = () => { recognizing = false; micBtn.classList.remove('live'); };
    rec.onend = () => { recognizing = false; micBtn.classList.remove('live'); };
  }

  function say(text, ok = true) {
    replyEl.textContent = text;
    replyEl.className = ok ? 'ok' : 'no';
    if (handlers.voiceReply) speak(text, handlers.voiceReply());
  }

  function run(raw) {
    ensureAudio();
    const result = parseCommand(raw);
    if (result.ok) chirpOk(); else chirpNo();
    say(result.reply, result.ok);
    const maybe = handlers.onCommand(result, raw);
    result._done = maybe && typeof maybe.then === 'function' ? maybe : Promise.resolve();
    return result;
  }

  goBtn.addEventListener('click', () => run(input.value));
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); run(input.value); }
  });
  micBtn.addEventListener('click', () => {
    ensureAudio();
    if (!rec) { say('Voice unavailable. Type instead.', false); return; }
    if (recognizing) { try { rec.stop(); } catch {} return; }
    recognizing = true;
    micBtn.classList.add('live');
    try { rec.start(); } catch { recognizing = false; micBtn.classList.remove('live'); }
  });

  return {
    el: wrap,
    run,
    say,
    setVisible(v) { wrap.style.display = v ? '' : 'none'; },
    focus() { input.focus(); },
    setInput(v) { input.value = v; },
    chirpLoad, chirpFreeze
  };
}

const fs = require('fs'); const path = require('path');
const audio = require('C:/Users/pc/.claude/plugins/cache/ls-extensions/ls-clad/1.1.0/skills/build-sfx/tools');
const PROJECT_ASSETS_SFX = 'C:/Users/pc/Documents/HandOnCpr/Assets/GeneratedSFX';
fs.mkdirSync(PROJECT_ASSETS_SFX, { recursive: true });
const SR = audio.SAMPLE_RATE, p = audio.sfx_presets;
function trim(buf, sec) {
  const n = Math.floor(sec * SR);
  if (buf.left) return { left: buf.left.slice(0, n), right: buf.right.slice(0, n) };
  return buf.slice(0, n);
}
function fade(buf, s) { if (buf.left) { audio.fadeOut(buf.left, s); audio.fadeOut(buf.right, s); } else audio.fadeOut(buf, s); }
function stats(buf) { const chans = buf.left ? [buf.left, buf.right] : [buf]; let pk = 0;
  for (const c of chans) for (let i = 0; i < c.length; i++) pk = Math.max(pk, Math.abs(c[i]));
  return { duration_s: +(chans[0].length / SR).toFixed(4), peak_db: +(20 * Math.log10(pk || 1e-9)).toFixed(2) }; }
const out = [];
function save(name, buf) {
  const f = path.join(PROJECT_ASSETS_SFX, name + '.wav');
  audio.WavBuilder.write(buf, f);
  out.push({ name, path: 'Assets/GeneratedSFX/' + name + '.wav', ...stats(buf), bytes: fs.statSync(f).size });
}
// BeatClick: sharp dry click, trimmed under 40 ms
{ let b = p.uiClick({ character: 'sharp' });
  b = audio.mix_bus.applyFx(b, { hpf: 150 });
  b = trim(b, 0.036); fade(b, 0.005);
  audio.mix_bus.masterChain(b, { normalize: 'peak' });
  b = trim(b, 0.036); fade(b, 0.004);
  save('BeatClick', b); }
// ButtonPress: soft UI confirm tap
{ let b = p.uiClick({ character: 'soft', pitch: -2 });
  b = audio.mix_bus.applyFx(b, { hpf: 120, lpf: 6000, gain: 0.9 });
  fade(b, 0.005);
  audio.mix_bus.masterChain(b, { normalize: 'peak' });
  save('ButtonPress', b); }
// HoldComplete: gentle rising two-tone chime (perfect fourth up)
{ const root = 76 + Math.floor(Math.random() * 3);
  const n1 = audio.synth_voices.bell(root, 0.45, 90, 240);
  const n2 = audio.synth_voices.bell(root + 5, 0.6, 86, 240);
  let o = new Float32Array(Math.floor(0.95 * SR));
  audio.addInto(o, n1, 0, 0.55);
  audio.addInto(o, n2, Math.floor(0.13 * SR), 0.55);
  let b = audio.mix_bus.applyFx(o, { hpf: 200, lpf: 7000, reverb: 'smallRoom', gain: 0.8 });
  b = trim(b, 0.9); fade(b, 0.08);
  audio.mix_bus.masterChain(b, { normalize: 'peak' });
  save('HoldComplete', b); }
console.log(JSON.stringify(out));

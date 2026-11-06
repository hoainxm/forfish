// NHẠC NỀN TỰ TỔNG HỢP (không bản quyền bên thứ ba): pad hợp âm ấm + arpeggio "pluck" nhẹ + tiếng sóng biển.
// node nhac.mjs <ra.wav> [giây=64]  — vòng 4 hợp âm I–vi–IV–V (C–Am–F–G), 92 BPM, có tiếng vang đơn giản.
import { writeFileSync } from "node:fs";
const [, , out, giayArg] = process.argv;
const SR = 44100, GIAY = Number(giayArg || 64), N = SR * GIAY;
const L = new Float32Array(N), R = new Float32Array(N);
const hz = (m) => 440 * 2 ** ((m - 69) / 12);
const BEAT = 60 / 92, BAR = BEAT * 4;
const CHORDS = [
  [48, 55, 60, 64, 67, 71], // Cmaj7
  [45, 52, 57, 60, 64, 67], // Am7
  [41, 48, 53, 57, 60, 64], // Fmaj7
  [43, 50, 55, 59, 62, 69], // G6/9
];
let seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
// pad: mỗi ô nhịp một hợp âm, attack/release mềm, hơi lệch tần hai kênh cho rộng
for (let b = 0; b * BAR < GIAY; b++) {
  const ch = CHORDS[b % 4], t0 = b * BAR, len = BAR + 1.2;
  for (const m of ch.slice(1, 5)) {
    const f = hz(m);
    for (let i = Math.floor(t0 * SR); i < Math.min(N, (t0 + len) * SR); i++) {
      const t = i / SR - t0;
      const env = Math.min(1, t / 0.9) * Math.min(1, (len - t) / 1.2);
      const v = 0.028 * env * (Math.sin(2 * Math.PI * f * t) + 0.25 * Math.sin(4 * Math.PI * f * t));
      L[i] += v * (1 + 0.002 * Math.sin(t * 3)); R[i] += 0.028 * env * Math.sin(2 * Math.PI * f * 1.003 * t);
    }
  }
  // bass
  const fb = hz(ch[0] - 12 + 12);
  for (let i = Math.floor(t0 * SR); i < Math.min(N, (t0 + BAR) * SR); i++) {
    const t = i / SR - t0; const env = Math.min(1, t / 0.05) * Math.exp(-t * 0.6);
    const v = 0.06 * env * Math.sin(2 * Math.PI * fb * t); L[i] += v; R[i] += v;
  }
  // arpeggio nốt móc đơn, mẫu lên-xuống, nhỏ dần, nốt đầu ô nhịp nhấn nhẹ
  const pat = [2, 3, 4, 5, 4, 3, 2, 3];
  for (let k = 0; k < 8; k++) {
    const st = t0 + k * BEAT / 2, f = hz(ch[pat[k]] + 12), pan = 0.5 + 0.35 * Math.sin(k);
    const amp = (k === 0 ? 0.075 : 0.055) * (0.85 + 0.3 * rnd());
    for (let i = Math.floor(st * SR); i < Math.min(N, (st + 1.6) * SR); i++) {
      const t = i / SR - st; const env = Math.min(1, t / 0.004) * Math.exp(-t * 3.2);
      const v = amp * env * (Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(6 * Math.PI * f * t) * Math.exp(-t * 6));
      L[i] += v * (1 - pan) * 1.4; R[i] += v * pan * 1.4;
    }
  }
}
// tiếng sóng: nhiễu nâu lọc thấp, to nhỏ theo nhịp sóng ~9 giây
let bL = 0, bR = 0, lpL = 0, lpR = 0;
for (let i = 0; i < N; i++) {
  const t = i / SR;
  bL = (bL + 0.02 * (rnd() * 2 - 1)) * 0.995; bR = (bR + 0.02 * (rnd() * 2 - 1)) * 0.995;
  lpL += 0.06 * (bL - lpL); lpR += 0.06 * (bR - lpR);
  const song = 0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(2 * Math.PI * t / 9.3 - 1.2), 2.2);
  L[i] += 0.55 * song * lpL; R[i] += 0.55 * song * lpR;
}
// tiếng vang: hai đường trễ hồi tiếp
for (const [d, g] of [[0.211, 0.32], [0.337, 0.24]]) {
  const D = Math.floor(d * SR);
  for (let i = D; i < N; i++) { L[i] += g * R[i - D]; R[i] += g * L[i - D]; }
}
// vào/ra mềm 2 giây + chuẩn đỉnh
let pk = 0; for (let i = 0; i < N; i++) pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i]));
const buf = Buffer.alloc(44 + N * 4);
buf.write("RIFF", 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write("WAVEfmt ", 8); buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28);
buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  const t = i / SR, f = Math.min(1, t / 2, (GIAY - t) / 2);
  buf.writeInt16LE(Math.round((L[i] / pk) * 0.85 * f * 32767), 44 + i * 4);
  buf.writeInt16LE(Math.round((R[i] / pk) * 0.85 * f * 32767), 46 + i * 4);
}
writeFileSync(out, buf);
console.log("nhạc:", out, GIAY, "s");

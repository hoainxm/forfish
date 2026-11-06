// QUAY MỘT VIDEO: node quay.mjs <kich-ban.mjs>
//  1) đọc lời từng cảnh bằng Mỹ Duyên (cache) → biết độ dài từng câu
//  2) mở app thật bằng tài khoản test, chạy thao tác từng cảnh, mỗi cảnh kéo đủ dài theo lời → ghi mốc thời gian
//  3) ghép: khung dọc 1080×1920, màn điện thoại ở giữa, phụ đề dải dưới, tiếng đọc đặt đúng mốc
import { writeFileSync, readFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import * as L from "./lib.mjs";

const kb = (await import("file:///" + L.SRC + process.argv[2] + "?t=" + Date.now())).default;
const W = `${L.DIR}out/${kb.ten}/`;
mkdirSync(W, { recursive: true });
const CHI_GHEP = process.argv.includes("--chi-ghep");

// ---------- 1. TTS ----------
const key = execFileSync("wsl", ["-e", "bash", "-lc", "grep -m1 '^TTS_API_KEY=' ~/.local/forlife/secrets.env | cut -d= -f2-"], { encoding: "utf8" }).trim();
function wavDur(buf) {
  const byteRate = buf.readUInt32LE(28);
  let o = 12;
  while (o < buf.length - 8) {
    const id = buf.toString("ascii", o, o + 4), sz = buf.readUInt32LE(o + 4);
    if (id === "data") return Math.min(sz, buf.length - o - 8) / byteRate;
    o += 8 + sz;
  }
  return 0;
}
mkdirSync(`${L.DIR}tts-cache`, { recursive: true });
async function doc(text) {
  const doc = text.replace(/sdfish.sdvico.vn/g, "ét đê phít chấm ét đê vi cô chấm vi en").replace(/SDFish/g, "ét đê phít").replace(/PWA/g, "pê đáp liu a").replace(/CH Play/g, "xê hát pờ lây").replace(/ForFish/g, "ét đê phít").replace(/SDVICO/g, "ét đê vi cô").replace(/S-Tracking/g, "ét trắc king").replace(/Kairos/g, "Khai rốt").replace(/AIS/g, "a i ét").replace(/Sen Biển/g, "Sen Biển");
  const f = `${L.DIR}tts-cache/${createHash("md5").update(doc).digest("hex").slice(0, 12)}.wav`;
  if (!existsSync(f)) {
    for (let t = 0; t < 4; t++) {
      const r = await fetch("http://127.0.0.1:8791/v1/tts", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${key}` }, body: JSON.stringify({ text: doc, voice: "Mỹ Duyên" }) });
      if (r.ok) { writeFileSync(f, Buffer.from(await r.arrayBuffer())); break; }
      console.log("  tts lỗi", r.status, "thử lại"); await new Promise((r) => setTimeout(r, 1500));
    }
  }
  return { f, sec: wavDur(readFileSync(f)) };
}
const GAP = 0.35, LEAD = 0.25, TAIL = 0.45;
for (const c of kb.canh) {
  c.cau = [];
  for (const s of c.noi) c.cau.push({ text: s, ...(await doc(s)) });
  c.dai = LEAD + c.cau.reduce((a, x) => a + x.sec + GAP, 0) - GAP + TAIL;
  console.log(`cảnh ${c.id}: ${c.dai.toFixed(1)}s`);
}
console.log("tổng lời:", kb.canh.reduce((a, c) => a + c.dai, 0).toFixed(1), "s");

// ---------- 2. QUAY ----------
const mocFile = `${W}moc.json`;
let moc;
if (!CHI_GHEP) {
  if (kb.don) execFileSync("node", [`${L.SRC}don.mjs`, kb.phone]);
  const vdir = `${W}raw/`;
  mkdirSync(vdir, { recursive: true });
  for (const f of readdirSync(vdir)) execFileSync("cmd", ["/c", "del", "/q", (vdir + f).replace(/\//g, "\\")]);
  const { b, ctx, page } = await L.moPhien(kb.phone, { video: vdir });
  const t0 = Date.now();
  if (kb.chuanBi) await kb.chuanBi({ page, L });
  await L.boDongY(page);
  moc = { batDau: 0, canh: [] };
  moc.batDau = (Date.now() - t0) / 1000;
  for (const c of kb.canh) {
    const s = (Date.now() - t0) / 1000;
    const han = s + c.dai;
    try { await c.lam?.({ page, L }); } catch (e) { console.log(`  ! cảnh ${c.id}:`, e.message.split("\n")[0]); await page.screenshot({ path: `${W}loi-${c.id}.png` }); }
    const conLai = han - (Date.now() - t0) / 1000;
    if (conLai > 0) await page.waitForTimeout(conLai * 1000);
    const e = (Date.now() - t0) / 1000;
    if (e - s > c.dai + 0.5) console.log(`  · cảnh ${c.id} thao tác dài hơn lời ${(e - s - c.dai).toFixed(1)}s`);
    moc.canh.push({ id: c.id, s, e });
  }
  await page.waitForTimeout(600);
  moc.ket = (Date.now() - t0) / 1000;
  await page.__stopCast();
  await page.waitForTimeout(300);
  // khung hình → danh sách concat có thời lượng từng khung (screencast chỉ đẩy khung khi màn đổi)
  const fr = page.__frames.map((x) => ({ f: x.f, t: x.t - t0 / 1000 }));
  await ctx.close(); await b.close();
  let lst = "ffconcat version 1.0\n";
  // khung đầu phủ từ 0
  if (fr.length) fr[0].t = Math.min(fr[0].t, 0);
  for (let i = 0; i < fr.length; i++) {
    const d = (i + 1 < fr.length ? fr[i + 1].t : moc.ket + 0.5) - fr[i].t;
    if (d <= 0) continue;
    lst += `file '${fr[i].f}'
duration ${d.toFixed(4)}
`;
  }
  lst += `file '${fr[fr.length - 1].f}'
`;
  writeFileSync(`${W}khung.txt`, lst);
  moc.video = `${W}khung.txt`;
  console.log("khung hình:", fr.length);
  writeFileSync(mocFile, JSON.stringify(moc, null, 1));
} else moc = JSON.parse(readFileSync(mocFile, "utf8"));

// ---------- 3. GHÉP ----------
// phụ đề ASS: mỗi câu một dòng sự kiện, đặt từ mốc đầu cảnh
const T = (x) => { const h = Math.floor(x / 3600), m = Math.floor((x % 3600) / 60), s = (x % 60); return `${h}:${String(m).padStart(2, "0")}:${s.toFixed(2).padStart(5, "0")}`; };
const tru = moc.batDau; // cắt phần khởi động trước cảnh 1
let ev = [], amIn = [], amF = [];
const wrap = (t, n = 38) => { const w = t.split(" "); const l = []; let c = ""; for (const x of w) { if ((c + " " + x).trim().length > n && c) { l.push(c); c = x; } else c = (c + " " + x).trim(); } if (c) l.push(c); return l.join("\\N"); };
kb.canh.forEach((c, i) => {
  let t = moc.canh[i].s - tru + LEAD;
  for (const x of c.cau) {
    ev.push(`Dialogue: 0,${T(t)},${T(t + x.sec + 0.15)},Sub,,0,0,0,,${wrap(x.text)}`);
    amIn.push(x.f); amF.push(Math.round(t * 1000));
    t += x.sec + GAP;
  }
});
const tong = moc.ket - tru;
const tieuDe = kb.tieuDe;
const ass = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Sub,Segoe UI,46,&H00FFFFFF,&H00FFFFFF,&H00402A12,&H00000000,1,0,0,0,100,100,0,0,1,0,0,2,50,50,58,1
Style: Top,Segoe UI,40,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,0,0,8,40,40,30,1
Style: Tag,Segoe UI,30,&H00E8D9A6,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,8,40,40,86,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,${T(0)},${T(tong)},Top,,0,0,0,,${tieuDe}
Dialogue: 0,${T(0)},${T(tong)},Tag,,0,0,0,,SDFish · Hướng dẫn sử dụng · ${kb.vaiTen}
${ev.join("\n")}
`;
writeFileSync(`${W}sub.ass`, ass);
// SRT kèm theo (bật/tắt phụ đề khi đăng lên mạng)
let srt = "", n = 0;
const S = (x) => { const ms = Math.round(x * 1000); const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`; };
kb.canh.forEach((c, i) => { let t = moc.canh[i].s - tru + LEAD; for (const x of c.cau) { srt += `${++n}\n${S(t)} --> ${S(t + x.sec + 0.15)}\n${x.text}\n\n`; t += x.sec + GAP; } });
writeFileSync(`${W}${kb.ten}.srt`, srt);

// tiếng: đặt từng câu đúng mốc
const args = ["-y", "-v", "error"];
for (const f of amIn) args.push("-i", f);
const fc = amIn.map((_, i) => `[${i}:a]aresample=48000,adelay=${amF[i]}|${amF[i]}[a${i}]`).join(";") + ";" + amIn.map((_, i) => `[a${i}]`).join("") + `amix=inputs=${amIn.length}:normalize=0,apad=whole_dur=${tong.toFixed(2)},atrim=0:${tong.toFixed(2)},loudnorm=I=-16:TP=-1.5:LRA=11[a]`;
args.push("-filter_complex", fc, "-map", "[a]", "-ar", "48000", "-ac", "2", `${W}giong.wav`);
execFileSync("ffmpeg", args);
// NHẠC NỀN tự tổng hợp (nhac.mjs — không bản quyền bên thứ ba), nhỏ ~-22 dB, tự hạ khi có lời (sidechain)
execFileSync("node", [`${L.SRC}nhac.mjs`, `${W}nhac.wav`, (tong + 1).toFixed(0)]);
execFileSync("ffmpeg", ["-y", "-v", "error", "-i", `${W}giong.wav`, "-i", `${W}nhac.wav`, "-filter_complex",
  "[0:a]asplit=2[g][k];[1:a]aresample=48000,volume=0.16[m];[m][k]sidechaincompress=threshold=0.02:ratio=5:attack=30:release=600[md];[g][md]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.95[a]",
  "-map", "[a]", "-ar", "48000", "-ac", "2", `${W}tieng.wav`]);

// hình: nền navy, màn điện thoại 732×1592 bo góc ở giữa (y=184), phụ đề dải dưới
const fontsDir = `${L.DIR}fonts`;
const vf = [
  `[0:v]trim=start=${tru.toFixed(3)},setpts=PTS-STARTPTS,fps=30,scale=680:1478:flags=lanczos,format=rgba[s]`,
  `[2:v]scale=680:1478,format=gray[m]`,
  `[s][m]alphamerge[sm]`,
  `[1:v][sm]overlay=200:150:shortest=0,trim=duration=${tong.toFixed(2)},subtitles=sub.ass:fontsdir=fonts,format=yuv420p[v]`,
].join(";");
const out = `${L.DIR}out/${kb.ten}.mp4`;
const r = spawnSync("ffmpeg", ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", moc.video, "-f", "lavfi", "-i", `color=c=0x0E2A40:s=1080x1920:r=30:d=${(tong + 1).toFixed(2)}`, "-loop", "1", "-i", `${L.DIR}mask.png`, "-i", `${W}tieng.wav`,
  "-filter_complex", vf, "-map", "[v]", "-map", "3:a", "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-r", "30", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", "-t", tong.toFixed(2), out], { cwd: W, encoding: "utf8" });
if (r.status !== 0) { console.log(r.stderr); process.exit(1); }
console.log("XONG:", out, (statSync(out).size / 1e6).toFixed(1), "MB,", tong.toFixed(1), "s");

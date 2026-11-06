// VIDEO 7 (bản thật) — CÀI SDFISH: ANDROID (Chrome thật, giả lập Android 15 máy GPU) + IPHONE (Safari thật, iOS
// Simulator 27.2 trên Mac, giao diện tiếng Việt). Mỗi bước = một đoạn cắt từ bản quay + lời Mỹ Duyên; đoạn chờ dài thì
// tua nhanh (≤3×), lời dài hơn hình thì giữ khung cuối. Ra 1080×2400 (tỉ lệ máy Android), iPhone đệm viền tối 2 đầu.
import { writeFileSync, readFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
const HERE = new URL(".", import.meta.url).pathname.replace(/^\/(\w:)/, "$1");
// kho làm việc ngoài git (test-reports/ đã ignore): and/cai-android.mp4 (android/quay-android.sh), ios/cai-ios.mov
// (Mac: `xcrun simctl io booted recordVideo`, simulator để tiếng Việt), icon.png, tts-cache/, fonts/
const DIR = (process.env.HDSD_DIR || HERE + "../../test-reports/video-hdsd/").replace(/\\/g, "/");
const W = `${DIR}out/7-cai-app-that/`;
mkdirSync(W, { recursive: true });
const AND = `${DIR}and/cai-android.mp4`, IOS = `${DIR}ios/cai-ios.mov`, ICON = `${DIR}icon.png`;
const OW = 1080, OH = 2400;

const key = execFileSync("wsl", ["-e", "bash", "-lc", "grep -m1 '^TTS_API_KEY=' ~/.local/forlife/secrets.env | cut -d= -f2-"], { encoding: "utf8" }).trim();
function wavDur(buf) { const br = buf.readUInt32LE(28); let o = 12; while (o < buf.length - 8) { const id = buf.toString("ascii", o, o + 4), sz = buf.readUInt32LE(o + 4); if (id === "data") return Math.min(sz, buf.length - o - 8) / br; o += 8 + sz; } return 0; }
async function doc(text) {
  const d = text.replace(/sdfish\.sdvico\.vn/g, "ét đê phít chấm ét đê vi cô chấm vi en").replace(/SDFish/g, "ét đê phít").replace(/PWA/g, "pê đáp liu a").replace(/CH Play/g, "xê hát pờ lây")
    .replace(/Install and create shortcut/g, "in-xtôn en cri-ết sọt-cắt").replace(/Add to home screen/g, "át tu hôm xờ-crin").replace(/Install/g, "in-xtôn").replace(/Safari/g, "Sa-pha-ri").replace(/Chrome/g, "Crôm").replace(/iPhone/g, "ai phôn").replace(/Android/g, "an-đroi");
  const f = `${DIR}tts-cache/${createHash("md5").update(d).digest("hex").slice(0, 12)}.wav`;
  if (!existsSync(f)) {
    for (let t = 0; t < 4; t++) {
      const r = await fetch("http://127.0.0.1:8791/v1/tts", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${key}` }, body: JSON.stringify({ text: d, voice: "Mỹ Duyên" }) });
      if (r.ok) { writeFileSync(f, Buffer.from(await r.arrayBuffer())); break; }
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  return { f, sec: wavDur(readFileSync(f)), text };
}

// đoạn: { nhan (nhãn trên), the (thẻ chữ, không có nguồn), src, s, e, noi[] }
const AN = "Máy Android · Chrome", IP = "iPhone · Safari";
const DOAN = [
  { the: "Cài SDFish về điện thoại\nAndroid và iPhone", noi: ["Chào bà con! Video này em chỉ cách cài SDFish về điện thoại, cả máy Android lẫn iPhone.", "SDFish là ứng dụng web cài được, gọi là PWA: không cần vào CH Play hay App Store, cài ngay từ trình duyệt là xong."] },
  { nhan: AN, src: AND, s: 1.5, e: 21.1, noi: ["Với máy Android: mở Chrome, chạm vào thanh địa chỉ, gõ đúng sdfish.sdvico.vn rồi bấm Đi."] },
  { nhan: AN, src: AND, s: 21.1, e: 27.2, noi: ["Trang SDFish mở ra. Nếu Chrome hỏi có dịch trang không thì cứ bỏ qua."] },
  { nhan: AN, src: AND, s: 27.2, e: 30.3, noi: ["Bấm nút ba chấm ở góc trên bên phải."] },
  { nhan: AN, src: AND, s: 30.3, e: 35.9, noi: ["Chọn mục Install and create shortcut, nghĩa là cài đặt và tạo lối tắt."] },
  { nhan: AN, src: AND, s: 35.9, e: 48.3, noi: ["Chọn Install, rồi bấm Install thêm lần nữa để xác nhận, đợi máy cài một chút."] },
  { nhan: AN, src: AND, s: 48.3, e: 53.7, noi: ["Máy hỏi thêm, bấm Add to home screen, tức là thêm vào màn hình chính."] },
  { nhan: AN, src: AND, s: 53.7, e: 69.4, noi: ["Biểu tượng SDFish đã nằm ngoài màn hình chính. Chạm vào là app mở toàn màn hình, như app bình thường."] },
  { nhan: IP, src: IOS, s: 0, e: 29.7, noi: ["Với iPhone: mở Safari, chạm vào thanh địa chỉ, gõ sdfish.sdvico.vn rồi bấm Đi."] },
  { nhan: IP, src: IOS, s: 29.7, e: 40.0, noi: ["Trang SDFish mở ra."] },
  { nhan: IP, src: IOS, s: 48.3, e: 74.9, noi: ["Bấm nút có ba gạch ở bên trái thanh địa chỉ, rồi chọn Chia sẻ. Máy đời cũ thì nút Chia sẻ nằm ngay ở thanh dưới cùng."] },
  { nhan: IP, src: IOS, s: 74.9, e: 83.4, noi: ["Trong bảng chia sẻ, bấm Xem thêm."] },
  { nhan: IP, src: IOS, s: 83.4, e: 100.2, noi: ["Chọn Thêm vào Màn hình chính. Để nguyên tên SDFish, công tắc Mở dưới dạng ứng dụng web để bật, rồi bấm Thêm."] },
  { nhan: IP, src: IOS, s: 100.2, e: 114.8, noi: ["Biểu tượng SDFish hiện ngoài màn hình chính."] },
  { nhan: IP, src: IOS, s: 114.8, e: 134.0, noi: ["Chạm vào để mở. Với iPhone, cài xong nhớ mở app ngay lúc còn sóng để app tải dữ liệu về máy một lần."] },
  { the: "Cài một lần\ndùng cả chuyến biển", noi: ["Từ nay bà con mở SDFish bằng biểu tượng ngoài màn hình chính. Mỗi lần có sóng, app tự tải sẵn dữ liệu đi biển. Chúc bà con bình an!"] },
];

const GAP = 0.3, LEAD = 0.35, TAIL = 0.6;
const clips = [];
let t = 0;
const ev = [], amIn = [], amF = [];
const T = (x) => { const h = Math.floor(x / 3600), m = Math.floor((x % 3600) / 60), s = x % 60; return `${h}:${String(m).padStart(2, "0")}:${s.toFixed(2).padStart(5, "0")}`; };
const wrap = (s, n = 36) => { const w = s.split(" "); const l = []; let c = ""; for (const x of w) { if ((c + " " + x).trim().length > n && c) { l.push(c); c = x; } else c = (c + " " + x).trim(); } if (c) l.push(c); return l.join("\\N"); };
for (const [i, d] of DOAN.entries()) {
  const cau = [];
  for (const s of d.noi) cau.push(await doc(s));
  const N = LEAD + cau.reduce((a, x) => a + x.sec + GAP, 0) - GAP + TAIL;
  const out = `${W}seg${String(i).padStart(2, "0")}.mp4`;
  let dur;
  if (d.the) {
    dur = Math.max(N, 3);
    execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", `color=c=0x0E2A40:s=${OW}x${OH}:r=30:d=${dur.toFixed(2)}`, "-loop", "1", "-i", ICON,
      "-filter_complex", `[1:v]scale=300:300[ic];[0:v][ic]overlay=(W-w)/2:700,format=yuv420p[v]`, "-map", "[v]", "-t", dur.toFixed(2), "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", "-r", "30", out]);
    const [a, b] = d.the.split("\n");
    ev.push(`Dialogue: 1,${T(t)},${T(t + dur)},The,,0,0,0,,{\\fad(300,300)\\pos(540,1200)}${a}`);
    ev.push(`Dialogue: 1,${T(t)},${T(t + dur)},The2,,0,0,0,,{\\fad(300,300)\\pos(540,1300)}${b}`);
  } else {
    const D = d.e - d.s;
    const sp = D > N + 3 ? Math.min(3, D / (N + 2)) : 1;
    const hinh = D / sp;
    dur = Math.max(hinh, N);
    const vf = `setpts=(PTS-STARTPTS)/${sp.toFixed(3)},fps=30,scale=${OW}:-2:flags=lanczos,pad=${OW}:${OH}:(ow-iw)/2:(oh-ih)/2:color=0x0b0f14,setsar=1,tpad=stop_mode=clone:stop_duration=${(dur - hinh + 0.2).toFixed(2)},trim=duration=${dur.toFixed(2)},format=yuv420p`;
    execFileSync("ffmpeg", ["-y", "-v", "error", "-ss", d.s.toFixed(2), "-t", D.toFixed(2), "-i", d.src, "-vf", vf, "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", "-r", "30", out]);
    ev.push(`Dialogue: 1,${T(t)},${T(t + dur)},Nhan,,0,0,0,,${d.nhan}`);
    console.log(`đoạn ${i}: ${D.toFixed(1)}s ×${sp.toFixed(2)} → ${dur.toFixed(1)}s`);
  }
  let tt = t + LEAD;
  for (const x of cau) { ev.push(`Dialogue: 0,${T(tt)},${T(tt + x.sec + 0.15)},Sub,,0,0,0,,${wrap(x.text)}`); amIn.push(x.f); amF.push(Math.round(tt * 1000)); tt += x.sec + GAP; }
  clips.push(out);
  t += dur;
}
const tong = t;
writeFileSync(`${W}list.txt`, clips.map((c) => `file '${c}'`).join("\n"));
execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", `${W}list.txt`, "-c", "copy", `${W}hinh.mp4`]);
const ass = `[Script Info]
ScriptType: v4.00+
PlayResX: ${OW}
PlayResY: ${OH}
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Sub,Segoe UI,50,&H00FFFFFF,&H00FFFFFF,&H30402A12,&H00000000,1,0,0,0,100,100,0,0,3,18,0,2,70,70,330,1
Style: Nhan,Segoe UI,46,&H00FFFFFF,&H00FFFFFF,&H10865C0F,&H00000000,1,0,0,0,100,100,0,0,3,16,0,8,40,40,300,1
Style: The,Segoe UI,72,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,0,0,5,60,60,0,1
Style: The2,Segoe UI,52,&H00E8D9A6,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,5,60,60,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${ev.join("\n")}
`;
writeFileSync(`${W}sub.ass`, ass);
let srt = "", n = 0;
for (const e of ev.filter((x) => x.includes(",Sub,"))) { const p = e.split(","); const tx = p.slice(9).join(",").replace(/\\N/g, " "); const S = (s) => { const [h, m, ss] = s.split(":"); const sec = +h * 3600 + +m * 60 + +ss; const ms = Math.round(sec * 1000); return `${String(Math.floor(ms / 3600000)).padStart(2, "0")}:${String(Math.floor(ms / 60000) % 60).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`; }; srt += `${++n}\n${S(p[1])} --> ${S(p[2])}\n${tx}\n\n`; }
writeFileSync(`${W}7-cai-app.srt`, srt);
// tiếng: giọng đặt đúng mốc + nhạc nền tự tổng hợp (cùng mức với các video khác)
const args = ["-y", "-v", "error"]; for (const f of amIn) args.push("-i", f);
const fc = amIn.map((_, i) => `[${i}:a]aresample=48000,adelay=${amF[i]}|${amF[i]}[a${i}]`).join(";") + ";" + amIn.map((_, i) => `[a${i}]`).join("") + `amix=inputs=${amIn.length}:normalize=0,apad=whole_dur=${tong.toFixed(2)},atrim=0:${tong.toFixed(2)},loudnorm=I=-16:TP=-1.5:LRA=11[a]`;
args.push("-filter_complex", fc, "-map", "[a]", "-ar", "48000", "-ac", "2", `${W}giong.wav`);
execFileSync("ffmpeg", args);
execFileSync("node", [`${HERE}nhac.mjs`, `${W}nhac.wav`, (tong + 1).toFixed(0)]);
execFileSync("ffmpeg", ["-y", "-v", "error", "-i", `${W}giong.wav`, "-i", `${W}nhac.wav`, "-filter_complex",
  "[0:a]asplit=2[g][k];[1:a]aresample=48000,volume=0.42[m];[m][k]sidechaincompress=threshold=0.06:ratio=2.5:attack=40:release=500[md];[g][md]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.95[a]",
  "-map", "[a]", "-ar", "48000", "-ac", "2", `${W}tieng.wav`]);
const out = `${DIR}out/7-cai-app.mp4`;
execFileSync("ffmpeg", ["-y", "-v", "error", "-i", `${W}hinh.mp4`, "-i", `${W}tieng.wav`, "-vf", "subtitles=sub.ass:fontsdir=../../fonts,format=yuv420p", "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-preset", "medium", "-crf", "21", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", "-t", tong.toFixed(2), out], { cwd: W });
execFileSync("ffmpeg", ["-y", "-v", "error", "-i", out, "-i", `${W}giong.wav`, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", `${DIR}out/7-cai-app-khong-nhac.mp4`]);
console.log("XONG:", out, (statSync(out).size / 1e6).toFixed(1), "MB,", tong.toFixed(1), "s");

// @vitest-environment jsdom
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join, posix } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { napManhGiong, speechParts, splitSentences } from "@/lib/voice/tts";

/*
  CỔNG NGUỒN CÂU NÓI — hết "cứ lọt" (anh Long 2026-11-06: "làm bao nhiêu vòng rồi cứ lọt thế").

  Trước đây danh sách file soạn câu nói (NGUON của scripts/sen-bien-giong/lap_manh.mjs) khai TAY: trợ lý toàn app
  (lib/assistant/answer.ts) đọc giọng máy cả tháng mà không cổng nào đỏ. Cổng này TỰ DÒ:

   1. VÙNG ĐỌC TIẾNG = file import cửa giọng (`@/lib/voice/tts`, `use-nav-voice`) + file chúng import trực tiếp + bao
      đóng import bên trong các thư mục câu nói (lib/sen-bien, assistant, nav-voice, kairos, stracking).
   2. Mỗi CÂU CỐ ĐỊNH TRỌN VẸN (mở chữ hoa, kết . ? !, có dấu tiếng Việt) trong vùng phải phủ đủ giọng thu sẵn
      (`speechParts` — câu nguyên hoặc mảnh) — TRỪ file trong `CHI_HIEN_THI` (chữ trên màn, không đọc), có lý do.
   3. Danh mục mảnh KHỚP nguồn: chạy `lap_manh.mjs --kiem` phải ra "mới 0" — sửa câu trong file nguồn mà quên lập lại
      danh mục là đỏ.

  Đỏ ở (2)? Câu đó có đọc lên không:
   · CÓ ⇒ thêm file vào NGUON của lap_manh.mjs (câu có chỗ trống) hoặc câu vào src/data/giong-sen-bien.json (câu cố
     định), chạy lap_manh + gen_clips + chon_clips (doc 15 §36). Câu nguyên ĐỀ XUẤT sẵn: ra-soat-giong.test.ts.
   · KHÔNG (chỉ hiện chữ) ⇒ thêm file vào CHI_HIEN_THI kèm lý do.
*/

const ROOT = process.cwd();
const LAP = readFileSync(join(ROOT, "scripts/sen-bien-giong/lap_manh.mjs"), "utf8");
const NGUON = new Set([...LAP.slice(LAP.indexOf("const NGUON"), LAP.indexOf("];", LAP.indexOf("const NGUON"))).matchAll(/"(src\/[^"]+)"/g)].map((m) => m[1]));

/** File trong vùng đọc tiếng mà chữ CHỈ HIỆN trên màn (không qua giọng). Mỗi dòng một lý do — thêm có cân nhắc. */
const CHI_HIEN_THI: Record<string, string> = {
  "src/data/fish-seasons.ts": "mùa vụ từng loài — hiện trong thẻ loài cá trên bản đồ",
  "src/data/fishing-ports.ts": "địa chỉ cảng — danh bạ cảng; tên cảng đọc qua nhóm mảnh `ten`",
  "src/data/sdvico-showcase.ts": "mô tả hàng SDVICO trên thẻ quảng bá; câu ĐÁP hàng Sen Biển đọc nằm ở khuyen-mai.ts (đã thu)",
  "src/lib/moon.ts": "ghi chú trăng / đánh đèn trên thẻ ngư trường",
  "src/lib/ocean-map.ts": "chú giải lớp bản đồ (nhiệt độ, phù du, độ sâu)",
  "src/lib/offline-basemap.ts": "dòng báo nền bản đồ trên màn",
  "src/lib/scalar-field.ts": "chú giải lớp bản đồ (mây, mưa, dông, độ mặn…)",
  "src/lib/sea-scalars.ts": "chú giải lớp bản đồ (độ cao mặt biển, độ mặn vệ tinh)",
  "src/lib/sen-bien-state.ts": "lỗi micro hiện chữ — lúc này micro hỏng, Sen Biển không nói chen",
  "src/lib/sen-bien/gemma.ts": "lời nhắc (prompt) cho mô hình Gemma, không phải câu nói",
  "src/lib/soundings-verified.ts": "ghi chú nguồn số đo sâu",
  "src/lib/soundings.ts": "tên cơ quan nguồn số đo sâu",
  "src/lib/source-registry.ts": "ghi chú độ tươi nguồn dữ liệu trên màn",
  "src/lib/tau-ais.ts": "dòng báo thẻ tàu AIS",
  "src/lib/tides.ts": "ghi chú độ tin trạm con nước trên thẻ (câu con nước Sen Biển đọc ở hoi-ban-do / answer)",
  "src/lib/vms-zones.ts": "lỗi nhập vùng VMS ở trang quản trị",
};

const TAT_CA: string[] = [];
(function di(d: string) {
  for (const e of readdirSync(join(ROOT, d), { withFileTypes: true })) {
    const p = posix.join(d, e.name);
    if (e.isDirectory()) {
      if (e.name !== "__tests__") di(p);
    } else if (/\.(ts|tsx|mjs)$/.test(e.name)) TAT_CA.push(p);
  }
})("src");
const SRC = new Map(TAT_CA.map((f) => [f, readFileSync(join(ROOT, f), "utf8")]));
const tim = (f: string) => ["", ".ts", ".tsx", ".mjs"].map((e) => f + e).find((x) => SRC.has(x)) ?? null;
const nhap = (f: string) =>
  [...SRC.get(f)!.matchAll(/(?:from |import\()["']@\/((?:lib|data)\/[^"']+)["']/g)].map((m) => tim(`src/${m[1]}`)).filter((x): x is string => !!x);
const CUA = /(?:from |import\()["']@\/lib\/(?:voice\/tts|nav-voice\/use-nav-voice)["']/;
const THU_MUC_NOI = /^src\/lib\/(sen-bien|assistant|nav-voice|kairos|stracking)\//;

function vungDocTieng(): string[] {
  const goc = TAT_CA.filter((f) => CUA.test(SRC.get(f)!) && !/^src\/lib\/voice\//.test(f));
  const vung = new Set(goc);
  for (const g of goc) for (const f of nhap(g)) vung.add(f);
  const hang = [...vung].filter((f) => THU_MUC_NOI.test(f));
  while (hang.length) {
    for (const f of nhap(hang.pop()!))
      if (THU_MUC_NOI.test(f) && !vung.has(f)) {
        vung.add(f);
        hang.push(f);
      }
  }
  return [...vung].filter((f) => !/^src\/lib\/voice\//.test(f)).sort();
}

const DAU = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;
/** Câu cố định trọn vẹn trong chuỗi chữ của file (bỏ chú thích; chuỗi có `${…}` chỉ lấy câu không dính chỗ trống). */
function cauCoDinh(src: string): string[] {
  const s = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
  const out: string[] = [];
  for (const m of s.matchAll(/"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g)) {
    const chuoi = (m[1] ?? m[2] ?? m[3] ?? "").replace(/\\n/g, " ");
    for (const khuc of chuoi.split(/\$\{[^}]*\}/)) {
      // khúc cạnh chỗ trống chỉ giữ CÂU TRỌN (không chạm ${…}): bỏ câu đầu/cuối của khúc nếu khúc bị cắt
      const cau = splitSentences(khuc);
      for (const c of cau) {
        const t = c.trim();
        const dau = t.replace(/^["“]/, "")[0] ?? "";
        if (dau === dau.toLowerCase() || !/[.?!]$/.test(t) || !DAU.test(t) || t.split(/\s+/).length < 2) continue;
        if (!khuc.trim().startsWith(t.slice(0, 3)) && cau[0] === c && m[3] && khuc !== chuoi) continue;
        if (/[{}<>=\\]|https?:/.test(t)) continue;
        out.push(t);
      }
    }
  }
  return [...new Set(out)];
}

/** Thời lượng mp3 (giây) đếm theo khung MPEG — không cần ffprobe. File hỏng / không có khung ⇒ 0. */
function thoiLuongMp3(b: Buffer): number {
  const BR = { 1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320], 2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160] };
  const SR = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] } as Record<number, number[]>;
  let i = 0;
  if (b.subarray(0, 3).toString("latin1") === "ID3") i = 10 + ((b[6] << 21) | (b[7] << 14) | (b[8] << 7) | b[9]);
  let giay = 0;
  let dau = true;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff || (b[i + 1] & 0xe0) !== 0xe0) { i++; continue; }
    const ver = (b[i + 1] >> 3) & 3; // 3 = MPEG1, 2 = MPEG2, 0 = MPEG2.5
    const brI = b[i + 2] >> 4, srI = (b[i + 2] >> 2) & 3, pad = (b[i + 2] >> 1) & 1;
    if (ver === 1 || brI === 0 || brI === 15 || srI === 3) { i++; continue; }
    const sr = SR[ver][srI];
    const kbps = BR[ver === 3 ? 1 : 2][brI];
    const mau = ver === 3 ? 1152 : 576;
    const dai = Math.floor(((ver === 3 ? 144 : 72) * kbps * 1000) / sr) + pad;
    // khung đầu thường là khung Xing/Info (không mang tiếng) — bỏ
    const xing = dau && /Xing|Info/.test(b.subarray(i + 4, i + 4 + 40).toString("latin1"));
    if (!xing) giay += mau / sr;
    dau = false;
    i += Math.max(dai, 1);
  }
  return giay;
}

beforeAll(() => napManhGiong());

describe("nguồn câu nói ↔ giọng thu sẵn (tự dò, không khai tay)", () => {
  it("vùng đọc tiếng dò ra đủ các màn đã biết (dò hỏng ⇒ cổng rỗng, phải đỏ)", () => {
    const v = vungDocTieng();
    for (const f of ["src/lib/assistant/answer.ts", "src/lib/sen-bien/hoi-ban-do.ts", "src/lib/stracking/doc-canh-bao.mjs", "src/lib/sen-bien/nhap-giong.ts", "src/lib/nav-voice/events.ts"])
      expect(v).toContain(f);
  });

  it("mọi câu cố định trong vùng đọc tiếng phủ đủ giọng Mỹ Duyên (hoặc file ghi rõ là chỉ hiển thị)", () => {
    const lot: string[] = [];
    for (const f of vungDocTieng()) {
      if (CHI_HIEN_THI[f]) continue;
      for (const c of cauCoDinh(SRC.get(f)!)) if (!speechParts(c).every((p) => p.clips)) lot.push(`${f} | ${c}`);
    }
    expect(lot).toEqual([]);
  });

  it("CHI_HIEN_THI không giữ file đã hết (gỡ khi file đổi tên / xoá)", () => {
    for (const f of Object.keys(CHI_HIEN_THI)) expect(SRC.has(f), f).toBe(true);
  });

  it("NGUON của lap_manh trỏ file có thật", () => {
    for (const f of NGUON) expect(SRC.has(f), f).toBe(true);
  });

  it("danh mục mảnh KHỚP nguồn: lap_manh --kiem ra 'mới 0 · bỏ 0'", { timeout: 60_000 }, () => {
    const out = execFileSync(process.execPath, ["scripts/sen-bien-giong/lap_manh.mjs", "--kiem"], { cwd: ROOT, encoding: "utf8" });
    expect(out).toMatch(/mới 0 · bỏ 0/);
  });
  /*  MẢNH HỎNG (06/11): "tàu", "bản", "khu" là file 180 byte chỉ có khung đầu — 0 giây tiếng; "sóng", "tiêu" bị cắt cụt
      0,14 s. Từ 17/10 mọi câu ghép mấy chữ này mất tiếng ngay chỗ đó mà không cổng nào thấy. Đo 06/11: file lành
      ≥ 0,25 s mỗi âm tiết (trung vị 0,33) ⇒ trần dưới 0,2 s/âm tiết. */
  it("mọi mp3 giọng Sen Biển có TIẾNG đủ dài (≥ 0,2 s mỗi âm tiết) — bắt file rỗng / cắt cụt", () => {
    const cau = JSON.parse(readFileSync(join(ROOT, "src/data/giong-sen-bien.json"), "utf8")) as { dir: string; items: { id: string; text: string; doc?: string }[] };
    const manh = JSON.parse(readFileSync(join(ROOT, "src/data/giong-sen-bien-manh.json"), "utf8")) as { dir: string; nhom: Record<string, [string, string][]> };
    const ds: [string, string][] = [
      ...cau.items.map((i): [string, string] => [`${cau.dir}/${i.id}.mp3`, i.doc ?? i.text]),
      ...Object.values(manh.nhom).flat().map(([id, t]): [string, string] => [`${manh.dir}/${id}.mp3`, t]),
    ];
    const hong: string[] = [];
    for (const [url, chu] of ds) {
      const am = chu.trim().split(/\s+/).length;
      const giay = thoiLuongMp3(readFileSync(join(ROOT, "public", url)));
      if (giay < 0.2 * am) hong.push(`${url} (${giay.toFixed(2)} s, ${am} âm tiết) "${chu}"`);
    }
    expect(hong).toEqual([]);
  });
});

// LẬP DANH MỤC MẢNH GIỌNG SEN BIỂN (doc 15 §21) — chạy ở máy nào cũng được.
//
//   node scripts/sen-bien-giong/lap_manh.mjs          # ghi src/data/giong-sen-bien-manh.json
//   node scripts/sen-bien-giong/lap_manh.mjs --kiem   # chỉ in mảnh mới / mảnh bỏ, không ghi
//
// Nguồn mảnh:
//  · `so`    — âm tiết đọc số (luật trong lib/voice/ghep.mjs)
//  · `khung` — QUÉT mọi chuỗi chữ trong các file dựng câu nói (NGUON bên dưới):
//              phần chữ cố định giữa các `${…}`, tách ở dấu câu. Viết câu mới
//              trong code rồi chạy lại là có mảnh — không phải khai tay.
//  · `coban` — từ rời (hướng, buổi, đơn vị, giới từ) — khai trong CO_BAN bên dưới
//  · `them`  — mảnh khai TAY (giữ nguyên qua mỗi lần chạy): sửa thẳng trong JSON
//  · `ten`   — tên cảng, đảo, trạm thuỷ triều, đèn biển, khu tránh trú bão, vùng quản lý
//  · `gop` / `kichban` — HỌC từ kịch bản toàn bộ (--kich-ban, xem dưới)
//  · `ran`   — tên rạn / bãi / địa danh ngầm (chủ dự án chốt thu 2026-10-17)
//  · `bao`   — phiên âm Việt tên bão quốc tế (bảng trong lib/nav-voice/ten-bao.ts)
//
// id GIỮ NGUYÊN cho chữ đã có (file mp3 không bị đổi tên ⇒ git không phình);
// chữ mới mới được id mới. Sau đó: gen_clips.py --manh → chon_clips.mjs --manh.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { docSo, khoaManh, vietThanhNoi } from "../../src/lib/voice/ghep.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = join(ROOT, "src/data/giong-sen-bien-manh.json");
const NGUON = [
  "src/lib/nav-voice/events.ts",
  "src/lib/nav-voice/nav-storm.ts",
  "src/lib/nav-voice/opening.ts",
  "src/lib/nav-voice/phrases.ts",
  "src/lib/nav-voice/sea-now.ts",
  "src/lib/nav-voice/use-nav-voice.ts",
  "src/lib/sen-bien/hieu-y.ts",
  "src/lib/sen-bien/hoi-ban-do.ts",
  "src/lib/sen-bien/lenh-ban-do.ts",
  "src/lib/nav-hazards.ts",
  "src/lib/nav-context.ts",
  "src/lib/seamarks.ts",
  "src/lib/xac-tau.ts",
  "src/lib/vung-quan-ly.ts",
  "src/lib/den-bien.ts",
  "src/lib/khu-tru-bao.ts",
  "src/lib/route-plan.ts",
  "src/lib/urgent.ts",
];

/* ── quét chuỗi chữ trong mã TS ───────────────────────────────────────────── */

/** Mọi phần chữ cố định của chuỗi '…' "…" `…` (bỏ chú thích, đệ quy vào `${…}`). */
function chuoiTrong(src) {
  const out = [];
  let i = 0;
  function quote(q) {
    let s = "";
    i++;
    while (i < src.length && src[i] !== q) {
      if (src[i] === "\\") {
        s += src[i + 1] === "n" ? " " : src[i + 1];
        i += 2;
      } else if (src[i] === "\n") break;
      else s += src[i++];
    }
    i++;
    out.push(s);
  }
  function tpl() {
    let s = "";
    i++;
    while (i < src.length && src[i] !== "`") {
      if (src[i] === "\\") {
        s += src[i + 1];
        i += 2;
      } else if (src[i] === "$" && src[i + 1] === "{") {
        out.push(s);
        s = "";
        i += 2;
        code(1);
      } else s += src[i++];
    }
    i++;
    out.push(s);
  }
  function code(depth) {
    while (i < src.length) {
      const c = src[i];
      if (c === "/" && src[i + 1] === "/") {
        while (i < src.length && src[i] !== "\n") i++;
      } else if (c === "/" && src[i + 1] === "*") {
        const e = src.indexOf("*/", i + 2);
        i = e < 0 ? src.length : e + 2;
      } else if (c === '"' || c === "'") quote(c);
      else if (c === "`") tpl();
      else if (c === "{") {
        depth++;
        i++;
      } else if (c === "}") {
        i++;
        if (--depth === 0) return;
      } else i++;
    }
  }
  code(Number.POSITIVE_INFINITY);
  return out;
}

const DAU = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;
/** Một chuỗi chữ → các mảnh: tách ở dấu câu, bỏ thứ không phải tiếng Việt. */
function manhTu(s) {
  // "{v}" là chỗ trống của khuôn (seamarks.ts) — tách ở đó, đừng bỏ cả câu
  s = s.replace(/\{\w+\}/g, "|");
  if (!DAU.test(s) || /[=<>{}\\]|https?:/.test(s)) return [];
  return s
    .split(/[.,;:!?…·—–()"“”\/|]+|\s-\s/)
    .map((x) => vietThanhNoi(x))
    .filter((x) => x && DAU.test(x) && x.split(" ").length <= 14);
}

/* ── tên trong danh mục có sẵn ────────────────────────────────────────────── */

const json = (f) => JSON.parse(readFileSync(join(ROOT, "public/data", f), "utf8"));
const sach = (n) => String(n ?? "").replace(/ — .*$/, "").replace(/\s+/g, " ").trim();
function tenCo() {
  const ten = new Set();
  const them = (n) => {
    const t = sach(n);
    if (t && DAU.test(t + "đ") && !/\d{3,}|[A-Z]{2,}-/.test(t)) ten.add(t);
  };
  for (const m of readFileSync(join(ROOT, "src/data/fishing-ports.ts"), "utf8").matchAll(/name:\s*"([^"]+)"/g)) them(m[1]);
  for (const f of json("vn-islands.v1.json").features) them(f.properties.name);
  for (const s of json("tide-stations.v1.json").stations) them(s.name);
  for (const n of json("den-bien.v1.json").names) them(n);
  for (const k of json("khu-tru-bao.v1.json").khu) them(k.ten);
  for (const v of json("vung-quan-ly.v1.json").vung) them(v.ten);
  // tên xác tàu / chướng ngại có dấu tiếng Việt (tên tàu nước ngoài viết hoa không dấu ⇒ giọng máy)
  for (const n of json("xac-tau.v1.json").names) if (DAU.test(n)) them(n.replace(/\s+\d+$/, ""));
  return ten;
}
function tenRan() {
  const ten = new Set();
  for (const f of json("coral-reefs.v1.json").features) if (sach(f.properties.name)) ten.add(sach(f.properties.name));
  for (const d of json("dia-danh-ngam.v1.json").diaDanh) if (sach(d[3])) ten.add(sach(d[3]));
  return ten;
}

/** Phiên âm tên bão: vế phải của bảng BANG trong ten-bao.ts ("Wutip: \"Vu típ\""). */
function tenBao() {
  const src = readFileSync(join(ROOT, "src/lib/nav-voice/ten-bao.ts"), "utf8");
  const bang = src.slice(src.indexOf("const BANG"), src.indexOf("};", src.indexOf("const BANG")));
  return new Set([...bang.matchAll(/:\s*"([^"]+)"/g)].map((m) => m[1]));
}

/* ── lập ───────────────────────────────────────────────────────────────────── */

/*  Số: MỘT mảnh cho cả cụm hay gặp (0–99, "X trăm", "lẻ X", "X nghìn", "phẩy X") —
    đo 2026-10-17: âm tiết số thu ĐỨNG RIÊNG ("trăm", "phẩy", "lẻ") hay méo và bộ
    nhận giọng nghe sai 9/22; cụm hai âm tiết đọc tự nhiên hơn và ít mảnh nối hơn.
    Âm tiết lẻ vẫn giữ để số hiếm vẫn ghép được. */
const SO = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
const SO_MANH = [...new Set([
  ...Array.from({ length: 100 }, (_, n) => docSo(String(n)).join(" ")),
  ...SO.slice(1).flatMap((d) => [`${d} trăm`, `lẻ ${d}`, `${d} nghìn`, `${d} triệu`]),
  ...SO.map((d) => `phẩy ${d}`),
  "không trăm", "mươi", "mốt", "tư", "lăm", "lẻ", "trăm", "nghìn", "triệu", "phẩy", "rưỡi", "nửa",
])];

/** Từ rời hay đứng sát chỗ trống (hướng, buổi, đơn vị) — dùng khi khung không phủ. */
const CO_BAN = [
  "Bắc", "Nam", "Đông", "Tây", "Đông Bắc", "Đông Nam", "Tây Nam", "Tây Bắc", "hướng",
  "sáng", "trưa", "chiều", "tối", "đêm", "khuya", "nay", "mai", "mốt", "giờ", "phút", "giây", "ngày", "tháng", "năm nay",
  "hải lý", "cây số", "mét", "độ", "cấp", "phần trăm", "héc ta", "ki lô mét",
  "còn", "chừng", "tới", "về", "đi", "từ", "trong", "ngoài", "gần", "xa", "cách", "lúc", "sau", "trước", "nữa",
  "đảo", "hòn", "cảng", "cửa", "bãi", "đá", "mũi", "vũng", "trạm", "đèn", "phao", "rạn", "khu", "tàu",
  "điểm", "chỗ", "ghé", "số", "bản đồ", "sóng", "gió", "cao", "thấp", "vừa", "lớn", "nhỏ", "và", "hoặc", "là", "có", "không", "đang", "đã", "chưa", "trên", "dưới",
];

const cu = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : { nhom: {} };
const idCu = new Map();
for (const ds of Object.values(cu.nhom ?? {})) for (const [id, text] of ds) idCu.set(khoaManh(text), id);

const khung = new Set();
for (const f of NGUON) for (const s of chuoiTrong(readFileSync(join(ROOT, f), "utf8"))) for (const m of manhTu(s)) khung.add(m.toLowerCase());

const dungId = new Set(idCu.values());
const slug = (t) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D")
    .toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);
function idCho(text) {
  const k = khoaManh(text);
  if (idCu.has(k)) return idCu.get(k);
  let id = slug(text) || "m";
  // Tên thiết bị cấm của Windows (con, prn, aux, nul, com1–9, lpt1–9) — file
  // "con.mp3" không tạo được trên Windows: checkout hỏng, commit lén xoá file
  // (dính thật 2026-10). Thêm đuôi "_m" cho mọi máy đọc được.
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/.test(id)) id = `${id}_m`;
  if (dungId.has(id)) id = `${id}_${createHash("sha1").update(k).digest("hex").slice(0, 4)}`;
  dungId.add(id);
  idCu.set(k, id);
  return id;
}

const daCo = new Set();
function nhom(ds) {
  const out = [];
  for (const t of [...ds].sort((a, b) => a.localeCompare(b, "vi"))) {
    const k = khoaManh(t);
    if (!k || daCo.has(k)) continue;
    daCo.add(k);
    out.push([idCho(t), t]);
  }
  return out;
}

/* ── HỌC TỪ KỊCH BẢN (--kich-ban <báo cáo của sen-bien-kich-ban.test.ts>) ──
    · `kichban`: cụm câu thật còn phải đọc giọng máy ⇒ thu thêm. Bỏ mã viết tắt
      (TS, BĐ…), tên Latin, chữ toàn hoa không dấu (tên tàu nước ngoài) — để giọng máy.
    · `gop`: cặp mảnh hay đứng liền (kiểu BPE) ⇒ thu GỘP, nghe liền hơi hơn, ít chỗ nối.
    Không truyền báo cáo ⇒ GIỮ nguyên hai nhóm này như lần trước. */
const iKB = process.argv.indexOf("--kich-ban");
const KB = iKB > 0 ? JSON.parse(readFileSync(process.argv[iKB + 1], "utf8")) : null;
const GOP_TOI_DA = 400;
const giu = (k) => (cu.nhom?.[k] ?? []).map(([, t]) => t);
function hocKichBan() {
  if (!KB) return { kichban: giu("kichban"), gop: giu("gop") };
  const kichban = new Set(giu("kichban"));
  for (const [t, n] of KB.thieu) {
    const w = t.split(/\s+/);
    if (n < 2 || w.length > 8) continue;
    // mã viết tắt (TS, BĐ, ĐT), họ Latin (…idae, Hippocampus) ⇒ để giọng máy
    if (w.some((x) => /^[A-ZĐ0-9]{1,4}\??$/u.test(x) || /idae$|^[A-Z]{2,}$/.test(x) || /^[a-zA-Z]{8,}$/.test(x))) continue;
    if (!DAU.test(t) && !/^[A-ZĐ][a-zà-ỹ]+( [A-ZĐ][a-zà-ỹ]+)*$/u.test(t)) continue;
    kichban.add(t);
  }
  // url → chữ của mảnh (cho cặp gộp)
  const chu = new Map();
  for (const ds of Object.values(cu.nhom ?? {})) for (const [id, t] of ds) chu.set(`${cu.dir}/${id}.mp3`, t);
  const gop = new Set(giu("gop"));
  for (const [cap, n] of KB.cap) {
    if (gop.size >= GOP_TOI_DA || n < 15) break;
    const [a, b] = cap.split("|").map((u) => chu.get(u));
    if (!a || !b) continue;
    const t = `${a} ${b}`;
    if (khoaManh(t).split(" ").length > 6) continue;
    gop.add(t);
  }
  return { kichban: [...kichban], gop: [...gop] };
}
const hoc = hocKichBan();

// thứ tự = thứ tự tải trước (warmVoiceClips): số + khung trước, tên sau, rạn cuối
const moi = {
  _ghi:
    "Mảnh giọng Sen Biển (Mỹ Duyên, VieNeu) để GHÉP câu có số/tên (doc 15 §21). Mỗi mục [id, chữ] ⇒ public/giong/sen-bien/m/<id>.mp3. Nhóm so/khung/ten/ran do scripts/sen-bien-giong/lap_manh.mjs sinh lại; nhóm `them` khai TAY, giữ qua mỗi lần chạy. Khoá tra = chữ qua lib/voice/ghep.mjs (số đọc bằng chữ, chữ thường).",
  voice: "Mỹ Duyên",
  dir: "/giong/sen-bien/m",
  nhom: {},
};
moi.nhom.so = nhom(SO_MANH);
moi.nhom.coban = nhom(CO_BAN.map((t) => t.toLowerCase()));
moi.nhom.them = nhom((cu.nhom?.them ?? []).map(([, t]) => t));
moi.nhom.khung = nhom(khung);
moi.nhom.gop = nhom(hoc.gop.map((t) => t.toLowerCase()));
moi.nhom.kichban = nhom(hoc.kichban);
moi.nhom.ten = nhom(tenCo());
moi.nhom.bao = nhom(tenBao());
moi.nhom.ran = nhom(tenRan());

const truoc = new Set([...idCu.entries()].filter(([, id]) => Object.values(cu.nhom ?? {}).some((ds) => ds.some(([i]) => i === id))).map(([, id]) => id));
const sau = new Set(Object.values(moi.nhom).flatMap((ds) => ds.map(([id]) => id)));
const them = [...sau].filter((x) => !truoc.has(x));
const bo = [...truoc].filter((x) => !sau.has(x));
const am = Object.values(moi.nhom).flat().reduce((n, [, t]) => n + khoaManh(t).split(" ").length, 0);
for (const [k, ds] of Object.entries(moi.nhom)) console.log(`${k.padEnd(6)} ${ds.length}`);
console.log(`tổng ${sau.size} mảnh · ${am} âm tiết (~${((am * 1.5) / 1024).toFixed(1)} MB mp3) · mới ${them.length} · bỏ ${bo.length}`);
if (bo.length) console.log("bỏ (xoá mp3 tương ứng):", bo.join(" "));
if (!process.argv.includes("--kiem")) {
  writeFileSync(OUT, `${JSON.stringify(moi, null, 0).replace(/\],\[/g, "],\n[").replace(/":\[\[/g, '":[\n[')}\n`);
  console.log("đã ghi", OUT.replace(ROOT + "/", ""));
}

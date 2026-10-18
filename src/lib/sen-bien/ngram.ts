// SEN BIỂN — bộ HIỂU Ý siêu nhỏ chạy trong máy (không mạng).
//
// Hồi quy logistic đa lớp trên n-gram ký tự + từ, băm 2^16 chiều, trọng số
// int8 (3,6 MB, `public/data/sen-bien-ngram.v3.bin`). Train ở repo AI Assistant
// `train/tro-ly/ngram.mjs` + `chay-bd.sh` (bản v3, 2026-10-17): 52 ý định = 31 ý
// cũ + 13 ý HỎI BẢN ĐỒ (hoi_*, con_bao_xa) + 8 ý THAO TÁC bản đồ (lenh-ban-do.ts). Số đo ở train/reports/troly-*.md.
// File này là bản CHÉP Y HỆT phần đoán — đổi cách băm/đặc trưng ở đó thì phải
// đổi ở đây, và ngược lại; test `sen-bien.test.ts` khoá vài câu với đúng file trọng số.
//
// Chỉ đoán Ý ĐỊNH. Tên chỗ (dẫn đi đâu) do `hieu-y.ts` tự dò trong danh sách
// cảng + điểm đã ghim; tham số câu hỏi bản đồ do luật `hoi-ban-do.tachThamSo`.
// Đường dẫn có SỐ BẢN: SW giữ /data cache-first nên đổi bản phải đổi tên (v1 → v3)
// thì máy cũ mới lấy file mới; file sai cỡ ⇒ loadNgram trả null ⇒ chạy bằng luật.

export const NGRAM_PATH = "/data/sen-bien-ngram.v3.bin";

export const INTENTS = [
  "thoi_tiet", "bao", "con_nuoc", "dan_duong", "dat_cang_nha",
  "giay_to", "bao_duong", "thuyen_vien", "tau_cua_toi",
  "tim_mon", "them_gio", "xem_gio", "don_cua_toi", "gia_ca", "gia_dau", "tin_mua_ban", "goi_shop", "goi_sdvico",
  "mo_man", "hop_thu",
  "tro_giup", "lap_lai", "tat_tieng", "bat_tieng", "xac_nhan", "tu_choi", "huy",
  "hoi_mo", "ngoai_pham_vi", "chao_hoi", "khong_hieu",
  // v2 — hỏi bản đồ (hoi-ban-do.ts LoaiHoi; "con_nuoc" dùng lại ý cũ)
  "hoi_dao_gan", "hoi_o_dau", "hoi_ran_gan", "hoi_do_sau", "hoi_phia_truoc", "hoi_den_bien", "hoi_phao",
  "hoi_xac_tau", "hoi_tru_bao", "hoi_vung_cam", "hoi_cang_gan", "hoi_ca", "con_bao_xa",
  // v3 — thao tác màn bản đồ (lenh-ban-do.ts)
  "mo_lop", "tat_lop", "doi_thoi_diem", "doc_gia_tri", "phong_to", "thu_nho", "ve_tau", "chay_thoi_gian",
] as const;
export type SenIntent = (typeof INTENTS)[number];
const REASONS = ["y_te", "phap_ly", "tien", "tra_nguoi", "khac"] as const;

const DIM = 1 << 16;
const NY = INTENTS.length;
const NLOP = NY + REASONS.length;
/** thang int8 → số thực, ghi lúc train (meta.json của bản v3) */
const THANG = 0.15106531578724777;
export const NGRAM_BYTES = DIM * NLOP;

/** Bỏ dấu + chữ thường + chỉ giữ a-z0-9 — giống `foldVn` bên train. */
export function foldVn(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function bam(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % DIM;
}

/** ctx: tên đã fold — tín hiệu "câu có nhắc tên chỗ/cảng"; `xn` = đang chờ bà con đồng ý (lúc train có cờ này — "đi" lúc chờ là đồng ý). */
export type NgramCtx = { diem?: string[]; cang?: string[]; tau?: string[]; xn?: boolean };

function dacTrung(cau: string, ctx: NgramCtx): [number, number][] {
  const f = foldVn(cau);
  const w = f.split(" ").filter(Boolean);
  const out = new Map<number, number>();
  const add = (k: string) => {
    const i = bam(k);
    out.set(i, (out.get(i) || 0) + 1);
  };
  add(`xn=${ctx.xn ? 1 : 0}`);
  add(`len=${Math.min(w.length, 12)}`);
  if (w.length > 40) add("qua_dai");
  const t = ` ${f} `;
  for (let n = 2; n <= 5; n++) for (let i = 0; i + n <= t.length; i++) add(`c${n}:${t.slice(i, i + n)}`);
  for (let i = 0; i < w.length; i++) {
    add(`w:${w[i]}`);
    if (i + 1 < w.length) add(`b:${w[i]} ${w[i + 1]}`);
  }
  if (w.length) {
    add(`dau:${w[0]}`);
    add(`cuoi:${w[w.length - 1]}`);
  }
  for (const [k, ds] of [["diem", ctx.diem], ["tau", ctx.tau], ["cang", ctx.cang]] as const)
    for (const d of ds || []) if (d && t.includes(` ${d} `)) add(`co_${k}`);
  const n2 = Math.sqrt([...out.values()].reduce((a, b) => a + b * b, 0)) || 1;
  return [...out].map(([i, v]) => [i, v / n2]);
}

export type NgramModel = { w: Int8Array };

/** Bọc bytes trọng số. Sai cỡ (file cũ / hỏng / bị cắt) ⇒ null, chỗ gọi lùi về luật. */
export function loadNgram(buf: ArrayBuffer): NgramModel | null {
  if (buf.byteLength !== NGRAM_BYTES) return null;
  return { w: new Int8Array(buf) };
}

export function guessIntent(m: NgramModel, cau: string, ctx: NgramCtx = {}): { y: SenIntent; conf: number } {
  const x = dacTrung(cau, ctx);
  const z = new Array<number>(NY).fill(0);
  for (const [i, v] of x) {
    const o = i * NLOP;
    for (let c = 0; c < NY; c++) z[c] += m.w[o + c] * THANG * v;
  }
  const mx = Math.max(...z);
  const e = z.map((v) => Math.exp(v - mx));
  const s = e.reduce((a, b) => a + b, 0);
  let b = 0;
  for (let i = 1; i < NY; i++) if (e[i] > e[b]) b = i;
  return { y: INTENTS[b], conf: +(e[b] / s).toFixed(3) };
}

/**
 * Trục 1 — LỚP BÁO HIỆU HÀNG HẢI (phao · đèn biển · tiêu · lồng bè · vùng neo).
 *
 * File này giữ TYPE + GIẢI MÃ + NHÃN TIẾNG VIỆT (thuần, test được) cho dataset
 * tĩnh public/data/seamarks.v1.json (sinh bởi scripts/generate-seamarks.mjs).
 * Component render bằng lớp symbol của MapLibre — file này KHÔNG vẽ.
 *
 * ── VÌ SAO CÓ ─────────────────────────────────────────────────────────────
 * Trước đây phao/đèn biển chỉ là ẢNH raster kéo từ OpenSeaMap qua mạng
 * (`src/lib/tile-proxy.ts`, nguồn "seamark"). Ảnh thì app KHÔNG BIẾT chấm đó
 * là phao gì — không tra được, không chạm xem được; và mất sóng thì chỉ còn
 * mấy ô bà con tình cờ đã mở. Ngoài khơi mất sóng nhiều ngày = mất báo hiệu.
 * Vector nằm sẵn trong máy thì tra được VÀ luôn có.
 *
 * ── CHỦ QUYỀN ─────────────────────────────────────────────────────────────
 * Dataset KHÔNG có trường tên (OSM vùng tranh chấp gắn tên nước ngoài/chữ
 * Hán). Chỉ có loại + đặc tính đèn + màu. Mọi chữ bà con đọc trên màn hình
 * đều do BẢNG NHÃN dưới đây sinh ra — không chuỗi nào chảy thẳng từ OSM.
 *
 * ## Assumptions
 * - Nhãn tiếng Việt tự soạn cho ngư dân 40–60 tuổi, KHÔNG jargon hàng hải
 *   tiếng Anh và không phiên âm ("cardinal", "lateral" không xuất hiện).
 * - Loại lạ (OSM thêm tag mới) rơi về "Báo hiệu hàng hải" — KHÔNG bao giờ lộ
 *   chuỗi tiếng Anh thô ra màn hình.
 * - Chu kỳ đèn tính bằng GIÂY, tầm hiệu lực tính bằng HẢI LÝ (chuẩn `M` của
 *   hải đồ). Nguồn OSM để trống rất nhiều → mọi trường đều tuỳ chọn.
 */

import { timeoutSignal } from "@/lib/abort";

/** Loại báo hiệu giữ trong dataset — PHẢI khớp `KEEP` của script sinh file. */
export type SeamarkType =
  | "buoy_lateral"
  | "buoy_cardinal"
  | "buoy_safe_water"
  | "buoy_special_purpose"
  | "buoy_isolated_danger"
  | "buoy_installation"
  | "beacon"
  | "beacon_lateral"
  | "beacon_cardinal"
  | "beacon_safe_water"
  | "beacon_special_purpose"
  | "beacon_isolated_danger"
  | "light"
  | "light_major"
  | "light_minor"
  | "light_vessel"
  | "light_float"
  | "virtual_aton"
  | "landmark"
  | "anchorage"
  | "harbour"
  | "mooring"
  | "pile"
  | "platform"
  | "marine_farm"
  | "gate";

/** Đặc tính đèn đã tách phần — đủ để dựng câu tiếng Việt. */
export type LightInfo = {
  /** viết tắt hải đồ: Fl, LFl, Oc, Iso, Q, VQ, Mo, Al… */
  character?: string;
  /** nhóm chớp: "2", "2+1", hoặc chữ Morse "A" */
  group?: string;
  /** màu ánh đèn (từ tiếng Anh của OSM: "white", "white;red") */
  colour?: string;
  /** chu kỳ, giây */
  period?: number;
  /** tầm hiệu lực, hải lý */
  range?: number;
};

export type Seamark = {
  lon: number;
  lat: number;
  type: SeamarkType | string;
  light?: LightInfo;
  /** màu THÂN phao/tiêu ("red", "black;yellow;black") */
  colour?: string;
};

/** Dạng thô trong public/data/seamarks.v1.json — bảng tra + hàng số. */
export type SeamarkFile = {
  v: number;
  types: string[];
  chars: string[];
  groups: string[];
  colours: string[];
  marks: number[][];
};

/* ── NHÃN TIẾNG VIỆT ────────────────────────────────────────────────────── */

/**
 * Loại báo hiệu → câu bà con đọc được. Viết như người đi biển nói, không dịch
 * từ điển: "cardinal" là phao chỉ hướng nên đi vòng qua, nên gọi thẳng
 * "Phao báo hướng an toàn"; "virtual" là phao KHÔNG CÓ THẬT ngoài biển, chỉ
 * hiện trên máy, nên phải nói rõ để bà con đừng đi tìm.
 */
export const SEAMARK_LABEL: Record<SeamarkType, string> = {
  buoy_lateral: "Phao luồng",
  buoy_cardinal: "Phao báo hướng an toàn",
  buoy_safe_water: "Phao giữa luồng, nước sâu an toàn",
  buoy_special_purpose: "Phao chuyên dùng",
  buoy_isolated_danger: "Phao báo chỗ nguy hiểm",
  buoy_installation: "Phao neo công trình",
  beacon: "Tiêu báo hiệu",
  beacon_lateral: "Tiêu báo mép luồng",
  beacon_cardinal: "Tiêu báo hướng an toàn",
  beacon_safe_water: "Tiêu giữa luồng, nước sâu an toàn",
  beacon_special_purpose: "Tiêu chuyên dùng",
  beacon_isolated_danger: "Tiêu báo chỗ nguy hiểm",
  light: "Đèn báo hiệu",
  light_major: "Đèn biển lớn",
  light_minor: "Đèn báo hiệu nhỏ",
  light_vessel: "Tàu đèn neo cố định",
  light_float: "Phao đèn",
  virtual_aton: "Phao ảo, chỉ máy thấy",
  landmark: "Mốc trên bờ có đèn",
  anchorage: "Vùng neo đậu",
  harbour: "Cảng, bến",
  mooring: "Trụ, phao buộc tàu",
  pile: "Cọc báo hiệu",
  platform: "Giàn khoan, công trình biển",
  marine_farm: "Lồng bè nuôi",
  gate: "Cửa, âu tàu",
};

/** Nhãn cho một loại — loại lạ KHÔNG BAO GIỜ lộ chuỗi tiếng Anh thô. */
export function seamarkLabel(type: string): string {
  return SEAMARK_LABEL[type as SeamarkType] ?? "Báo hiệu hàng hải";
}

/** Từ màu tiếng Anh của OSM → tiếng Việt. */
const COLOUR_WORD: Record<string, string> = {
  white: "trắng",
  red: "đỏ",
  green: "xanh lá",
  yellow: "vàng",
  black: "đen",
  blue: "xanh dương",
  grey: "xám",
  gray: "xám",
  orange: "cam",
  amber: "hổ phách",
  violet: "tím",
  magenta: "hồng sen",
  brown: "nâu",
};

/** Viết tắt màu ánh đèn trên hải đồ (W, R, G…) → từ tiếng Anh của OSM. */
const COLOUR_ABBR: Record<string, string> = {
  W: "white",
  R: "red",
  G: "green",
  Y: "yellow",
  Bu: "blue",
  Vi: "violet",
  Am: "amber",
  Or: "orange",
};

/**
 * "black;red;black" → "đen–đỏ–đen". Chuỗi lạ trả về "" (thà không nói gì còn
 * hơn in chữ tiếng Anh lên màn hình của bà con).
 */
export function colourLabel(colour?: string): string {
  if (!colour) return "";
  const parts = String(colour)
    .split(";")
    .map((c) => COLOUR_WORD[c.trim().toLowerCase()])
    .filter(Boolean);
  return parts.join("–");
}

/* ── ĐẶC TÍNH ĐÈN ───────────────────────────────────────────────────────── */

/**
 * Viết tắt đặc tính đèn → nửa câu tiếng Việt. `{n}` thay bằng số nhịp khi có
 * nhóm chớp. Dài nhất đứng trước khi dò chuỗi (LFl phải thắng Fl, Fl thắng F).
 */
const CHARACTER_PHRASE: Record<string, string> = {
  "Al.Oc": "Sáng liên tục, ngắt từng nhịp, đổi màu",
  "Al.Fl": "Chớp{n} đổi màu",
  "VQ+LFl": "Chớp rất nhanh{n} rồi một chớp dài",
  "Q+LFl": "Chớp nhanh{n} rồi một chớp dài",
  FFl: "Sáng liên tục kèm chớp{n}",
  LFl: "Chớp dài{n}",
  Iso: "Sáng và tắt đều nhau",
  Oc: "Sáng liên tục, ngắt{n}",
  VQ: "Chớp rất nhanh{n}",
  UQ: "Chớp cực nhanh{n}",
  IQ: "Chớp nhanh ngắt quãng{n}",
  Mo: "Chớp theo tín hiệu Morse",
  Al: "Đổi màu luân phiên",
  Fl: "Chớp{n}",
  Q: "Chớp nhanh{n}",
  F: "Sáng liên tục",
};

/** Dò theo độ dài giảm dần để "LFl" không bị "Fl" ăn mất. */
const CHARACTER_TOKENS = Object.keys(CHARACTER_PHRASE).sort(
  (a, b) => b.length - a.length,
);

/** "Bu" phải đứng trước "B"-đơn lẻ nếu sau này thêm — dài nhất trước. */
const COLOUR_ABBR_ALT = Object.keys(COLOUR_ABBR)
  .sort((a, b) => b.length - a.length)
  .join("|");

/** Cụm màu ánh đèn ngay sau đặc tính: ".W", "W.R.G", " Bu". */
const LIGHT_COLOUR_ABBR_RE = new RegExp(
  `^[.\\s]*((?:${COLOUR_ABBR_ALT})(?:[.\\s]*(?:${COLOUR_ABBR_ALT}))*)`,
);

/**
 * Tách một chuỗi đặc tính đèn KIỂU HẢI ĐỒ ("Fl(2)W.10s14M") thành từng phần.
 *
 * OSM ở vùng biển VN phần lớn tách sẵn ra `seamark:light:character/group/
 * colour/period/range`, nhưng có người map nhét cả cụm vào một tag — hàm này
 * nuốt được cả hai kiểu nên chỗ gọi không phải đoán.
 */
export function parseLightString(text?: string): LightInfo {
  const info: LightInfo = {};
  let rest = String(text ?? "").trim();
  if (!rest) return info;

  for (const tok of CHARACTER_TOKENS) {
    if (rest.slice(0, tok.length).toLowerCase() === tok.toLowerCase()) {
      info.character = tok;
      rest = rest.slice(tok.length);
      break;
    }
  }

  const group = rest.match(/^\s*\(([^)]*)\)/);
  if (group) {
    if (group[1].trim()) info.group = group[1].trim();
    rest = rest.slice(group[0].length);
  }

  const colour = rest.match(LIGHT_COLOUR_ABBR_RE);
  if (colour) {
    const words = colour[1]
      .split(/[.\s]+/)
      .map((c) => COLOUR_ABBR[c])
      .filter(Boolean);
    if (words.length) info.colour = words.join(";");
    rest = rest.slice(colour[0].length);
  }

  // \d+ CHỨ KHÔNG [\d.]+: chuỗi hải đồ dùng dấu chấm làm dải phân cách
  // ("Oc(3)W.15s") nên [\d.]+ sẽ nuốt luôn dấu chấm ⇒ ".15" đọc thành 0,15 giây.
  const period = rest.match(/(\d+(?:\.\d+)?)\s*s/);
  if (period && Number.isFinite(Number(period[1])))
    info.period = Number(period[1]);
  // `M` HOA = hải lý; `m` thường = chiều cao đèn (không dùng) — phân biệt hoa thường
  const range = rest.match(/(\d+(?:\.\d+)?)\s*M/);
  if (range && Number.isFinite(Number(range[1]))) info.range = Number(range[1]);

  return info;
}

/** "2" → " 2 nhịp" · "2+1" → " 2 nhịp rồi 1 nhịp" · chữ Morse → "" */
function groupPhrase(group?: string): string {
  const g = String(group ?? "").trim();
  if (!g || !/^\d/.test(g)) return "";
  const parts = g.split("+").filter((p) => /^\d+$/.test(p));
  if (!parts.length) return "";
  return " " + parts.map((p) => `${p} nhịp`).join(" rồi ");
}

/**
 * Đặc tính đèn → CÂU BÀ CON ĐỌC ĐƯỢC.
 *
 *   "Fl(2)W.10s14M" → "Chớp 2 nhịp, ánh trắng, 10 giây một vòng, xa 14 hải lý"
 *
 * Nhận cả chuỗi hải đồ lẫn object đã tách sẵn. Thiếu phần nào thì bỏ phần đó —
 * KHÔNG bịa (nguồn OSM để trống rất nhiều; hứa chính xác thứ nguồn không có là
 * điều app cấm). Không có gì để nói thì trả "".
 */
export function describeLight(light?: LightInfo | string | null): string {
  if (!light) return "";
  const info = typeof light === "string" ? parseLightString(light) : light;

  const bits: string[] = [];

  const template = info.character ? CHARACTER_PHRASE[info.character] : undefined;
  if (template) {
    let head = template.replace("{n}", groupPhrase(info.group));
    if (info.character === "Mo" && info.group?.trim()) {
      head += ` chữ ${info.group.trim().toUpperCase()}`;
    }
    bits.push(head);
  }

  const colour = colourLabel(info.colour);
  if (colour) bits.push(`ánh ${colour}`);

  if (Number.isFinite(info.period) && (info.period ?? 0) > 0) {
    bits.push(`${info.period} giây một vòng`);
  }
  if (Number.isFinite(info.range) && (info.range ?? 0) > 0) {
    bits.push(`xa ${info.range} hải lý`);
  }

  return bits.join(", ");
}

/**
 * Một dòng mô tả đầy đủ cho ô "chạm xem": loại + màu thân + đặc tính đèn.
 * Ví dụ: "Phao luồng · thân đỏ · Chớp 2 nhịp, ánh đỏ, 6 giây một vòng".
 */
export function describeSeamark(m: Seamark): string {
  const bits = [seamarkLabel(m.type)];
  const body = colourLabel(m.colour);
  if (body) bits.push(`thân ${body}`);
  const light = describeLight(m.light);
  if (light) bits.push(light);
  return bits.join(" · ");
}

/* ── GIẢI MÃ DATASET ────────────────────────────────────────────────────── */

const pick = (table: string[], i: number | undefined): string | undefined =>
  typeof i === "number" && i >= 0 && i < table.length ? table[i] : undefined;

/**
 * Bảng tra + hàng số → danh sách báo hiệu. Bỏ QUA hàng hỏng thay vì ném: một
 * dòng lỗi không được làm mất cả lớp báo hiệu của chuyến biển.
 */
export function decodeSeamarks(raw: unknown): Seamark[] {
  const f = raw as Partial<SeamarkFile> | null;
  if (!f || !Array.isArray(f.marks)) return [];
  const types = Array.isArray(f.types) ? f.types : [];
  const chars = Array.isArray(f.chars) ? f.chars : [];
  const groups = Array.isArray(f.groups) ? f.groups : [];
  const colours = Array.isArray(f.colours) ? f.colours : [];

  const out: Seamark[] = [];
  for (const row of f.marks) {
    if (!Array.isArray(row) || row.length < 3) continue;
    const [lon, lat, t, ch, grp, lc, per, rng, bc] = row;
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    const type = pick(types, t);
    if (!type) continue;

    const light: LightInfo = {};
    const character = pick(chars, ch);
    if (character) light.character = character;
    const group = pick(groups, grp);
    if (group) light.group = group;
    const lightColour = pick(colours, lc);
    if (lightColour) light.colour = lightColour;
    if (Number.isFinite(per) && per > 0) light.period = per;
    if (Number.isFinite(rng) && rng > 0) light.range = rng;

    const mark: Seamark = { lon, lat, type };
    if (Object.keys(light).length) mark.light = light;
    const body = pick(colours, bc);
    if (body) mark.colour = body;
    out.push(mark);
  }
  return out;
}

/* ── TẢI ASSET TĨNH ─────────────────────────────────────────────────────── */

let cached: Promise<Seamark[]> | null = null;

/**
 * Tải lớp báo hiệu (~180 KB, CÙNG ORIGIN nên service worker giữ được) — cache
 * cho cả phiên.
 *
 * `async` LÀ LÁ CHẮN THỨ HAI (cùng lý do đã ghi ở `depth-grid.ts`): nếu hàm
 * không `async` mà vẫn trả Promise thì cú ném ĐỒNG BỘ trong thân hàm (máy cũ
 * thiếu `AbortSignal.timeout`) bay ra ngoài trước khi promise kịp tồn tại ⇒
 * `.catch` của chỗ gọi không với tới ⇒ cây React sập, bản đồ trắng cả chuyến.
 * Lá chắn thứ nhất là `timeoutSignal` (không bao giờ ném).
 */
export async function fetchSeamarks(): Promise<Seamark[]> {
  if (!cached) {
    cached = fetch("/data/seamarks.v1.json", { signal: timeoutSignal(20000) })
      .then((r) => {
        if (!r.ok) throw new Error(`seamarks ${r.status}`);
        return r.json();
      })
      .then(decodeSeamarks)
      .catch((e) => {
        cached = null; // lần sau thử lại (mất sóng không khoá vĩnh viễn)
        throw e;
      });
  }
  return cached;
}

// KAIROS — GẮN KHU VỰC CHO BÀI (14 §4, AC05). THUẦN.
//
// Chữ ⇒ { regions[], provinces[], ports[] }. Dùng ở: route /api/kairos/nhap (máy chủ chạy
// LẠI cho bài báo), route đăng bài bà con (cảng chọn + thân bài), và máy thu tin.
// .mjs vì máy thu tin (Node trần) dùng chung — xem lien-ket.mjs. Danh mục cảng KHÔNG import
// ở đây (fishing-ports.ts là TS): bên gọi truyền vào. Máy thu tin không có danh mục ⇒ chỉ gắn
// tỉnh/vùng; máy chủ chạy lại đủ cả cảng.
//
// So khớp: mặc định trên chữ BỎ DẤU (foldVi) theo ranh giới từ, để bà con gõ không dấu vẫn
// trúng. Riêng các tên trùng với chữ thường ngày ("hòa bình", "hải dương" = đại dương,
// "huế"/"huệ", "cao bằng"…) chỉ nhận khi VIẾT HOA ĐÚNG DẤU — báo luôn viết hoa tên tỉnh.

import { foldVi } from "./lien-ket.mjs";

/**
 * 34 tỉnh/thành sau sáp nhập (NQ 202/2025/QH15, hiệu lực 01/7/2025).
 * `old` = tỉnh cũ đã nhập vào. `sea` = vùng biển (A5); tỉnh không giáp biển ⇒ [].
 * `aliases` = cách gọi khác (so không dấu). `cs` = tên chỉ nhận khi viết hoa đúng dấu.
 * @type {readonly { id: string, name: string, old: string[], sea: string[], aliases?: string[], cs?: string[] }[]}
 */
export const PROVINCES = [
  { id: "ha-noi", name: "Hà Nội", old: [], sea: [] },
  { id: "hue", name: "Huế", old: [], sea: ["mien-trung"], aliases: ["Thừa Thiên Huế", "Thừa Thiên - Huế", "TP Huế", "thành phố Huế"], cs: ["Huế"] },
  { id: "lai-chau", name: "Lai Châu", old: [], sea: [] },
  { id: "dien-bien", name: "Điện Biên", old: [], sea: [] },
  { id: "son-la", name: "Sơn La", old: [], sea: [], cs: ["Sơn La"] },
  { id: "lang-son", name: "Lạng Sơn", old: [], sea: [] },
  { id: "cao-bang", name: "Cao Bằng", old: [], sea: [], cs: ["Cao Bằng"] },
  { id: "quang-ninh", name: "Quảng Ninh", old: [], sea: ["vinh-bac-bo"] },
  { id: "thanh-hoa", name: "Thanh Hóa", old: [], sea: ["vinh-bac-bo"] },
  { id: "nghe-an", name: "Nghệ An", old: [], sea: ["vinh-bac-bo"] },
  { id: "ha-tinh", name: "Hà Tĩnh", old: [], sea: ["vinh-bac-bo"] },
  { id: "tuyen-quang", name: "Tuyên Quang", old: ["Hà Giang"], sea: [] },
  { id: "lao-cai", name: "Lào Cai", old: ["Yên Bái"], sea: [] },
  { id: "thai-nguyen", name: "Thái Nguyên", old: ["Bắc Kạn", "Bắc Cạn"], sea: [] },
  { id: "phu-tho", name: "Phú Thọ", old: ["Vĩnh Phúc", "Hòa Bình"], sea: [], cs: ["Vĩnh Phúc", "Hòa Bình"] },
  { id: "bac-ninh", name: "Bắc Ninh", old: ["Bắc Giang"], sea: [] },
  { id: "hung-yen", name: "Hưng Yên", old: ["Thái Bình"], sea: ["vinh-bac-bo"], cs: ["Thái Bình"] },
  // "hai phòng" (hai căn phòng) ⇒ chỉ nhận viết hoa.
  { id: "hai-phong", name: "Hải Phòng", old: ["Hải Dương"], sea: ["vinh-bac-bo"], cs: ["Hải Phòng", "Hải Dương"] },
  { id: "ninh-binh", name: "Ninh Bình", old: ["Hà Nam", "Nam Định"], sea: ["vinh-bac-bo"], cs: ["Hà Nam"] },
  { id: "quang-tri", name: "Quảng Trị", old: ["Quảng Bình"], sea: ["mien-trung"] },
  { id: "da-nang", name: "Đà Nẵng", old: ["Quảng Nam"], sea: ["mien-trung"] },
  { id: "quang-ngai", name: "Quảng Ngãi", old: ["Kon Tum"], sea: ["mien-trung"] },
  { id: "gia-lai", name: "Gia Lai", old: ["Bình Định"], sea: ["mien-trung"], cs: ["Bình Định"] },
  { id: "khanh-hoa", name: "Khánh Hòa", old: ["Ninh Thuận"], sea: ["mien-trung"] },
  { id: "lam-dong", name: "Lâm Đồng", old: ["Đắk Nông", "Đắc Nông", "Bình Thuận"], sea: ["mien-trung"], cs: ["Bình Thuận"] },
  { id: "dak-lak", name: "Đắk Lắk", old: ["Phú Yên"], sea: ["mien-trung"], aliases: ["Đắc Lắc", "Daklak"], cs: ["Phú Yên"] },
  {
    id: "ho-chi-minh",
    name: "TP Hồ Chí Minh",
    old: ["Bình Dương", "Bà Rịa - Vũng Tàu", "Bà Rịa Vũng Tàu", "Bà Rịa", "BR-VT"],
    sea: ["dong-nam-bo"],
    // "Hồ Chí Minh" trần là tên Bác — chỉ nhận khi có "TP/Thành phố" hoặc viết tắt.
    aliases: ["TP.HCM", "TPHCM", "TP HCM", "Thành phố Hồ Chí Minh", "TP Hồ Chí Minh", "TP. Hồ Chí Minh", "Sài Gòn"],
    cs: ["Bình Dương", "Vũng Tàu"],
  },
  { id: "dong-nai", name: "Đồng Nai", old: ["Bình Phước"], sea: [] },
  { id: "tay-ninh", name: "Tây Ninh", old: ["Long An"], sea: [], cs: ["Long An"] },
  { id: "can-tho", name: "Cần Thơ", old: ["Sóc Trăng", "Hậu Giang"], sea: ["dong-nam-bo"] },
  { id: "vinh-long", name: "Vĩnh Long", old: ["Bến Tre", "Trà Vinh"], sea: ["dong-nam-bo"] },
  { id: "dong-thap", name: "Đồng Tháp", old: ["Tiền Giang"], sea: ["dong-nam-bo"] },
  { id: "ca-mau", name: "Cà Mau", old: ["Bạc Liêu"], sea: ["dong-nam-bo", "tay-nam-bo"] },
  { id: "an-giang", name: "An Giang", old: ["Kiên Giang"], sea: ["tay-nam-bo"] },
];

/** Từ khoá vùng biển (so không dấu). */
const REGION_KEYWORDS = /** @type {const} */ ([
  ["vinh-bac-bo", ["vinh bac bo"]],
  ["mien-trung", ["mien trung", "trung bo", "nam trung bo", "bac trung bo", "duyen hai mien trung"]],
  ["dong-nam-bo", ["dong nam bo", "vung bien dong nam bo"]],
  ["tay-nam-bo", ["tay nam bo", "vinh thai lan"]],
  // DK1 = cụm nhà giàn trên thềm lục địa phía Nam — gộp vào vùng Hoàng Sa–Trường Sa (A5).
  ["hoang-sa-truong-sa", ["hoang sa", "truong sa", "song tu tay", "song tu dong", "sinh ton", "nam yet", "dk1", "dk 1", "nha gian", "da tay", "tri ton"]],
]);

/** Tên cảng trùng tên thành phố/đường phố — chỉ nhận khi có "cảng/bến/cửa" đứng trước. */
const PORT_NEED_PREFIX = new Set(
  ["Quy Nhơn", "Phan Thiết", "Hạ Long", "Mỹ Tho", "Hòn Gai", "Bạch Đằng", "Tam Kỳ", "La Gi", "Đông Hải", "Ninh Hải", "Phú Hải", "An Hòa", "Bình Đại", "Thạnh Phú", "Mỹ Tân", "Tân Sơn", "Hải Châu", "Việt Trung", "Phú Lạc", "Tân Phước", "Bình Khánh", "Trần Đề", "Định An", "Vĩnh Lương", "Lộc An", "Quảng Hội", "Hoà Lộc", "Hòa Lộc", "Triều Dương", "Thịnh Lâm", "Tiên Châu", "Đá Bạc", "Bến Đá", "Lò Vôi", "Cát Lở", "Đông Tác", "Quần Vinh", "Đảo Nam"].map(foldVi),
);
/** Tiền tố tên cảng trong danh mục — bỏ để lấy lõi tên. */
const PORT_PREFIX = /^(cảng dịch vụ hậu cần nghề cá|bến dịch vụ hậu cần nghề cá|cảng cá|cảng|bến cá|bến|knđ|khu neo đậu|cửa sông)\s+/iu;
/** Tên là tổ chức, không phải địa danh — bỏ qua (không ai viết "Cty TNHH…" trong tin). */
const PORT_ORG = /^(cty|công ty|tổng cty|xí nghiệp|htx|incomap)/iu;

// Không lookbehind (Safari < 16.4 chết lúc parse): ăn ký tự đứng trước, chỉ dùng test().
const CS_L = "(?:^|[^\\p{L}\\p{N}])";
const CS_R = "(?![\\p{L}\\p{N}])";
/** "Hải dương học" không phải tỉnh Hải Dương. ("Thái Bình Dương" bóc khỏi chữ trước khi so — xem tagArea.) */
const CS_EXCLUDE = { "Hải Dương": "(?![ \\t]+học)" };

/** @param {string} s */
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "[ \\t]+");

/** @param {string} name */
function csRegex(name) {
  const forms = [name, name.toUpperCase()].map(escRe).join("|");
  const after = /** @type {Record<string,string>} */ (CS_EXCLUDE)[name] ?? "";
  return new RegExp(`${CS_L}(?:${forms})${CS_R}${after}`, "u");
}

const PROVINCE_INDEX = PROVINCES.map((p) => {
  const cs = new Set((p.cs ?? []).map(foldVi));
  const folded = [p.name, ...p.old, ...(p.aliases ?? [])]
    .map(foldVi)
    .filter((f) => f && !cs.has(f) && f !== "ho chi minh");
  return { id: p.id, sea: p.sea, folded: [...new Set(folded)], cs: (p.cs ?? []).map(csRegex) };
});

/** Mã tỉnh hợp lệ (34). */
export const PROVINCE_IDS = PROVINCES.map((p) => p.id);
const PROVINCE_BY_ID = new Map(PROVINCES.map((p) => [p.id, p]));

/**
 * Tên tỉnh (cũ hay mới, có dấu hay không) ⇒ mã tỉnh mới. Dùng cho `province` của danh mục
 * cảng và hồ sơ khách. Không nhận ra ⇒ null.
 * @param {string | null | undefined} name
 * @returns {string | null}
 */
export function provinceIdOf(name) {
  const f = foldVi(String(name ?? "").replace(/^(tỉnh|thành phố|tp\.?)\s+/iu, ""));
  if (!f) return null;
  if (f === "ho chi minh" || f === "hcm") return "ho-chi-minh";
  for (const p of PROVINCES) {
    const all = [p.name, ...p.old, ...(p.aliases ?? []), ...(p.cs ?? [])].map(foldVi);
    if (all.includes(f)) return p.id;
  }
  return null;
}

/**
 * Vùng biển của một tỉnh (A5). Tỉnh không giáp biển / mã lạ ⇒ [].
 * @param {string} provinceId
 * @returns {string[]}
 */
export function regionsOfProvince(provinceId) {
  return [...(PROVINCE_BY_ID.get(provinceId)?.sea ?? [])];
}

/**
 * @typedef {{ id: string, name: string, province?: string, district?: string }} PortLike
 * @typedef {{ id: string, province: string | null, sea: string[], phrases: string[] }} PortEntry
 */

/** @type {WeakMap<readonly PortLike[], PortEntry[]>} */
const PORT_CACHE = new WeakMap();
const PORT_PREFIX_WORDS = ["cang ca", "cang", "ben ca", "ben", "cua", "khu neo dau", "au thuyen"];

/**
 * Bảng so khớp cảng (nhớ theo mảng danh mục). Mỗi cảng ⇒ các CỤM (đã bỏ dấu) phải có mặt
 * nguyên trong chữ:
 *   - "Đảo X" ⇒ chỉ "dao x";
 *   - lõi tên ≥2 tiếng, không trùng tên tỉnh/phố ⇒ chính lõi tên;
 *   - lõi 1 tiếng / trùng tên tỉnh / tên phố ⇒ phải có "cảng/bến/cửa…" đứng trước.
 * @param {readonly PortLike[]} ports
 * @returns {PortEntry[]}
 */
function portIndex(ports) {
  const hit = PORT_CACHE.get(ports);
  if (hit) return hit;
  const provinceFolds = new Set(PROVINCES.flatMap((p) => [p.name, ...p.old, ...(p.aliases ?? []), ...(p.cs ?? [])].map(foldVi)));
  const out = ports.map((p) => {
    const raw = String(p.name ?? "").trim();
    /** @type {Set<string>} */
    const phrases = new Set();
    if (!PORT_ORG.test(raw)) {
      const inParen = [...raw.matchAll(/\(([^)]+)\)/g)].map((m) => m[1]);
      const head = raw.replace(/\([^)]*\)/g, " ");
      for (const part of [...head.split("/"), ...inParen]) {
        if (/^\s*đảo\s+/iu.test(part)) {
          const core = foldVi(part);
          if (core.split(" ").length >= 2) phrases.add(core);
          continue;
        }
        const core = foldVi(part.replace(PORT_PREFIX, ""));
        if (!core || /^phuong \d/.test(core)) continue;
        if (core.split(" ").length >= 2 && !provinceFolds.has(core) && !PORT_NEED_PREFIX.has(core)) phrases.add(core);
        else for (const w of PORT_PREFIX_WORDS) phrases.add(`${w} ${core}`);
      }
    }
    const district = foldVi(p.district ?? "");
    const island = district.includes("truong sa") || district.includes("hoang sa");
    const province = provinceIdOf(p.province);
    const sea = [...(province ? regionsOfProvince(province) : []), ...(island ? ["hoang-sa-truong-sa"] : [])];
    return { id: p.id, province, sea, phrases: [...phrases] };
  });
  PORT_CACHE.set(ports, out);
  return out;
}

/**
 * Cảng trúng trong chữ, theo luật KHỚP DÀI NHẤT: "đảo Nam Du" không tính là cảng "Đảo Nam".
 * @param {string} hay  chữ đã foldVi, bọc khoảng trắng hai đầu
 * @param {PortEntry[]} index
 * @returns {PortEntry[]}
 */
function portHits(hay, index) {
  /** @type {{ e: PortEntry, s: number, t: number }[]} */
  const hits = [];
  for (const e of index) {
    for (const ph of e.phrases) {
      const needle = ` ${ph} `;
      let i = hay.indexOf(needle);
      while (i >= 0) {
        hits.push({ e, s: i, t: i + needle.length });
        i = hay.indexOf(needle, i + 1);
      }
    }
  }
  const kept = hits.filter((h) => !hits.some((o) => o.e !== h.e && o.s <= h.s && o.t >= h.t && o.t - o.s > h.t - h.s));
  return [...new Set(kept.map((h) => h.e))];
}

/**
 * @param {string} hay  chữ đã foldVi, bọc khoảng trắng hai đầu
 * @param {string} needle  đã foldVi
 */
const hasWord = (hay, needle) => hay.includes(` ${needle} `);

/**
 * Gắn khu vực cho một bài.
 * @param {string | null | undefined} text  tiêu đề + mô tả / thân bài
 * @param {{ ports?: readonly PortLike[], chosenPorts?: readonly string[] }} [opts]
 *   ports = danh mục cảng (src/data/fishing-ports.ts); chosenPorts = mã cảng bà con chọn khi đăng.
 * @returns {{ regions: string[], provinces: string[], ports: string[] }}
 *   Không trúng gì ⇒ regions = ["ca-nuoc"]. Tỉnh không giáp biển chỉ gắn tỉnh (regions rỗng).
 */
export function tagArea(text, opts = {}) {
  const raw = String(text ?? "").normalize("NFC");
  const hay = ` ${foldVi(raw)} `;
  // Thái Bình Dương (đại dương) chứa cả "Thái Bình" lẫn "Bình Dương" — bóc trước khi so tên viết hoa.
  const rawCs = raw.replace(/thái\s+bình\s+dương/giu, " ");
  const regions = new Set();
  const provinces = new Set();
  const ports = new Set();

  for (const p of PROVINCE_INDEX) {
    if (p.folded.some((f) => hasWord(hay, f)) || p.cs.some((re) => re.test(rawCs))) {
      provinces.add(p.id);
      for (const s of p.sea) regions.add(s);
    }
  }
  for (const [region, words] of REGION_KEYWORDS) {
    if (words.some((w) => hasWord(hay, w))) regions.add(region);
  }

  const catalog = opts.ports ?? [];
  const index = catalog.length ? portIndex(catalog) : [];
  const byId = new Map(index.map((e) => [e.id, e]));
  /** @param {PortEntry} e */
  const addPort = (e) => {
    ports.add(e.id);
    if (e.province) provinces.add(e.province);
    for (const s of e.sea) regions.add(s);
  };
  for (const id of opts.chosenPorts ?? []) {
    const e = byId.get(id);
    if (e) addPort(e);
  }
  for (const e of portHits(hay, index)) addPort(e);

  const out = { regions: [...regions], provinces: [...provinces], ports: [...ports] };
  if (!out.regions.length && !out.provinces.length && !out.ports.length) out.regions = ["ca-nuoc"];
  return out;
}

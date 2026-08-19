// Trục 1 — HÌNH DẠNG ĐẦY ĐỦ CỦA MỘT BẢN TIN BÃO, để LƯU KHO và VẼ (2026-08-18).
//
// ═══ VÌ SAO TÁCH KHỎI `storms-vn.ts` ═══
//
// `storms-vn.ts` là ADAPTER CẢNH BÁO: bản tin → `StormAlert` (tâm + track thô),
// vừa đủ cho banner và cho cổng chặn tuyến. File này trả lời câu khác, của chủ
// dự án 2026-08-18:
//
//   *"nên có DB lưu các bản tin để vẽ cho chuẩn — bão A có tin lúc nào, tâm bão
//   thời gian nào, bán kính bao nhiêu, hướng di chuyển nào; lúc update thì
//   update phần mới"* và *"cái bão đã đi qua và sắp tới, cứ mỗi lần update thì
//   hiệu chỉnh phần sắp tới thôi"*.
//
// Nên: MỘT BẢN TIN = MỘT HÀNG BẤT BIẾN trong kho, kèm các mốc dự báo của chính
// nó. Đường ĐÃ ĐI = nối tâm các bản tin cũ theo giờ phát (không bao giờ sửa);
// đường SẮP TỚI = mốc dự báo của bản tin MỚI NHẤT (mỗi lần có tin mới thì chỉ
// phần này đổi). Đó đúng là cách các web bão dựng bản đồ.
//
// ═══ VÙNG ẢNH HƯỞNG VẼ BẰNG SỐ NGUỒN PHÁT — KHÔNG BỊA BÁN KÍNH ═══
//
// Web bão quốc tế vẽ "nón bất định" bằng sai số dự báo trung bình mà chính cơ
// quan đó công bố (JMA/NHC có bảng ấy). NCHMF KHÔNG công bố con số đó. Nhưng
// bản tin VN CÓ **vùng nguy hiểm** cho từng mốc, dạng khung toạ độ
// ("19,0-21,0N; 114,5-118,5E") — đó mới là thứ cơ quan Việt Nam chịu trách
// nhiệm, và là thứ bà con nghe trên đài. Ta vẽ đúng nó.
// Mượn sai số nước ngoài vẽ vòng tròn quanh tâm là **tự nhận một trách nhiệm
// mình không có**, ở đúng chỗ dính tính mạng. `radiusKm` chỉ điền khi bản tin
// BÃO ghi thẳng "bán kính khoảng N km".
//
// Mọi hàm ở đây THUẦN (nhận chuỗi, trả dữ liệu) — test bằng bản tin thật.

import {
  catThanBanTin,
  parseCapGio,
  parseGioBanTinTiepTheo,
  parseGioPhatTin,
  parseToaDo,
} from "@/lib/storms-vn";

/** "19,8" → 19.8 (bản tin VN dùng dấu PHẨY thập phân) */
const soVn = (s: string) => Number(s.replace(",", "."));

/** Khung toạ độ vùng nguy hiểm: "19,0-21,0N; 114,5-118,5E" */
export type DangerBox = {
  latMin: number;
  latMax: number;
  lonMin: number;
  lonMax: number;
};

/** Một mốc DỰ BÁO trong bảng 24/48/72 giờ của bản tin */
export type ForecastPoint = {
  /** thời điểm dự báo (epoch ms) — "07 giờ ngày 19/8" */
  validAt: number | null;
  lat: number;
  lon: number;
  cap: number | null;
  giat: number | null;
  /** hướng di chuyển tới mốc này ("Tây Tây Bắc") */
  dir: string | null;
  speedKmh: number | null;
  danger: DangerBox | null;
};

export type NchmfBulletin = {
  /** giờ PHÁT bản tin (epoch ms) — khoá thời gian của hàng trong kho */
  issuedAt: number | null;
  /** giờ QUAN TRẮC tâm ("Hồi 07 giờ") — khác giờ phát, thường sớm hơn ~1 giờ */
  observedAt: number | null;
  /** giờ nguồn HẸN bản tin kế ("Bản tin tiếp theo: 14h00 ngày 18/8"); null =
      bản tin không ghi. Đây là thứ quyết định NHỊP QUÉT — xem `lib/storm-scan.ts` */
  nextAt: number | null;
  laBao: boolean;
  /** "5" khi bản tin ghi "bão số 5"; null với áp thấp nhiệt đới */
  soBao: string | null;
  lat: number;
  lon: number;
  cap: number | null;
  giat: number | null;
  dir: string | null;
  speedKmh: number | null;
  /** chỉ có khi bản tin ghi thẳng "bán kính khoảng N km" (bản tin BÃO) */
  radiusKm: number | null;
  danger: DangerBox | null;
  /** cấp độ rủi ro thiên tai (1..5) */
  risk: number | null;
  forecast: ForecastPoint[];
  url: string | null;
};

const KHUNG_BIEN_DONG = { latMin: 0, latMax: 30, lonMin: 95, lonMax: 140 };

/** "19,0-21,0N; 114,5-118,5E" → khung. null nếu không đúng hình dạng. */
export function parseDangerBox(s: string): DangerBox | null {
  const m =
    /(\d{1,2},\d|\d{1,2})\s*[-–]\s*(\d{1,2},\d|\d{1,2})\s*N\s*[;,]?\s*(\d{2,3},\d|\d{2,3})\s*[-–]\s*(\d{2,3},\d|\d{2,3})\s*E/iu.exec(
      s,
    );
  if (!m) return null;
  const [a, b, c, d] = m.slice(1, 5).map(soVn);
  const box = {
    latMin: Math.min(a, b),
    latMax: Math.max(a, b),
    lonMin: Math.min(c, d),
    lonMax: Math.max(c, d),
  };
  // ngoài khung Biển Đông = đọc nhầm số khác trong câu
  if (
    box.latMin < KHUNG_BIEN_DONG.latMin ||
    box.latMax > KHUNG_BIEN_DONG.latMax ||
    box.lonMin < KHUNG_BIEN_DONG.lonMin ||
    box.lonMax > KHUNG_BIEN_DONG.lonMax
  )
    return null;
  return box;
}

/**
 * "07 giờ ngày 19/8" (đủ ngày) hoặc "Hồi 07 giờ" (chỉ giờ) → epoch ms, giờ VN.
 * `mocMs` = giờ phát tin, dùng làm ngày tham chiếu cho dạng chỉ-có-giờ và làm
 * neo năm cho dạng đủ ngày (bản tin KHÔNG BAO GIỜ ghi năm).
 */
export function parseGioNgay(
  s: string,
  mocMs: number | null,
  now: Date,
): number | null {
  const full = /(\d{1,2})\s*giờ\s*ngày\s*(\d{1,2})\s*[/.-]\s*(\d{1,2})/iu.exec(s);
  if (full) {
    const [gio, ngay, thang] = full.slice(1, 4).map(Number);
    if (gio > 23 || ngay > 31 || thang > 12) return null;
    const neo = mocMs ?? now.getTime();
    const nam = new Date(neo).getUTCFullYear();
    let ms = Date.UTC(nam, thang - 1, ngay, gio - 7, 0);
    /*  Bản tin cuối tháng 12 dự báo sang tháng 1: mốc tính ra lùi gần một năm
        so với giờ phát ⇒ cộng một năm. Ngược lại thì thôi — dự báo luôn ở
        TƯƠNG LAI gần so với giờ phát. */
    if (neo - ms > 300 * 86400_000) ms = Date.UTC(nam + 1, thang - 1, ngay, gio - 7, 0);
    return ms;
  }
  const chiGio = /hồi\s*(\d{1,2})\s*giờ/iu.exec(s);
  if (chiGio && mocMs != null) {
    const gio = Number(chiGio[1]);
    if (gio > 23) return null;
    const d = new Date(mocMs);
    const ms = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), gio - 7, 0);
    /*  Giờ quan trắc phải TRƯỚC giờ phát (bản tin 08h00 nói "hồi 07 giờ"). Tính
        ra lại SAU giờ phát nghĩa là bản tin phát sau nửa đêm nói về giờ quan
        trắc của hôm trước ⇒ lùi một ngày. */
    return ms > mocMs ? ms - 86400_000 : ms;
  }
  return null;
}

/*  Hướng GHÉP phải đứng TRƯỚC hướng đơn, không thì "Tây Tây Bắc" bị cắt còn
    "Tây" (đã dính khi chạy trên bản tin thật). */
const HUONG =
  "Tây\\s+Tây\\s+Bắc|Tây\\s+Tây\\s+Nam|Đông\\s+Đông\\s+Bắc|Đông\\s+Đông\\s+Nam|Tây\\s+Bắc|Tây\\s+Nam|Đông\\s+Bắc|Đông\\s+Nam|Bắc|Nam|Đông|Tây";

/**
 * "chậm theo hướng Tây, tốc độ khoảng 5km/h" → {dir, speedKmh}
 *
 * ⚠️ HAI LỐI VIẾT, đều gặp trong CÙNG một bản tin (sửa 2026-08-18 sau khi chạy
 * trên bản tin thật):
 *  · phần HIỆN TRẠNG viết đủ chữ: *"Hướng và tốc độ di chuyển: chậm theo hướng
 *    Tây, tốc độ khoảng 5km/h"*;
 *  · cột "Hướng, tốc độ" trong BẢNG DỰ BÁO viết trần: *"Tây, khoảng 10 km/h"* —
 *    không có chữ "hướng" nào.
 *
 * ⚠️ VÀ TỐC ĐỘ KHÔNG ĐƯỢC NHẶT TỪ CƯỜNG ĐỘ: cùng câu có *"cấp 6 (39–49km/h)"* —
 * đó là DẢI GIÓ, không phải tốc độ di chuyển. Bản đầu lấy nhầm và ra 44 km/h
 * cho một cơn đang bò 5 km/h. Nên: bỏ mọi cụm trong ngoặc đơn trước khi đọc tốc
 * độ, và chỉ nhận số đứng cạnh chữ chỉ tốc độ.
 */
export function parseHuongTocDo(s: string): {
  dir: string | null;
  speedKmh: number | null;
} {
  const dir =
    new RegExp(`hướng\\s+(${HUONG})`, "iu").exec(s)?.[1] ??
    // lối viết trần trong bảng dự báo: hướng đứng ngay đầu ô, trước dấu phẩy
    new RegExp(`(?:^|\\d\\s*[/.-]\\s*\\d\\s+)(${HUONG})\\s*,`, "iu").exec(s)?.[1] ??
    null;

  const khongNgoac = s.replace(/\([^)]*\)/g, " ");
  const sp =
    /(?:tốc\s+độ|đi\s+được|khoảng)\s*(?:khoảng\s*)?(\d{1,3})\s*(?:[-–]\s*(\d{1,3}))?\s*km\/h/iu.exec(
      khongNgoac,
    );
  let speedKmh: number | null = null;
  if (sp) {
    const a = Number(sp[1]);
    const b = sp[2] ? Number(sp[2]) : null;
    speedKmh = b != null ? Math.round((a + b) / 2) : a;
  }
  return { dir: dir ? dir.replace(/\s+/g, " ").trim() : null, speedKmh };
}

/*  BẢNG DỰ BÁO sau khi bỏ thẻ HTML là MỘT DÒNG CHỮ dài:
      "07 giờ ngày 19/8 Tây, khoảng 10 km/h 19,9N-115,3E; … Cấp 6, giật cấp 8
       19,0-21,0N; 114,5-118,5E Cấp 3: … 07 giờ ngày 20/8 …"
    Cắt theo MỐC GIỜ, mỗi lát là một mốc. Lát không có toạ độ thì BỎ — thà
    thiếu một mốc còn hơn vẽ một chấm sai chỗ giữa biển. */
export function parseForecastPoints(
  text: string,
  issuedAt: number | null,
  now: Date,
): ForecastPoint[] {
  const moc = /\d{1,2}\s*giờ\s*ngày\s*\d{1,2}\s*[/.-]\s*\d{1,2}/giu;
  const dau: { at: number; head: string }[] = [];
  for (const m of text.matchAll(moc)) dau.push({ at: m.index ?? 0, head: m[0] });

  const out: ForecastPoint[] = [];
  for (let i = 0; i < dau.length; i++) {
    const lat = text.slice(dau[i].at, i + 1 < dau.length ? dau[i + 1].at : text.length);
    const diem = parseToaDo(lat);
    if (diem.length === 0) continue;
    const giatCap = /giật\s+cấp\s+(\d{1,2})/iu.exec(lat)?.[1] ?? null;
    /*  Cấp CHÍNH = cấp gió của cơn, KHÔNG phải cấp giật và KHÔNG phải "Cấp độ
        rủi ro thiên tai cấp 3" nằm cùng lát. Bỏ hai thứ đó rồi mới đọc. */
    const sach = lat
      .replace(/giật\s+cấp\s+\d{1,2}/giu, " ")
      .replace(/rủi\s+ro[^]{0,30}?cấp\s+\d/giu, " ");
    const caps = [...sach.matchAll(/cấp\s+(\d{1,2})/giu)]
      .map((x) => Number(x[1]))
      .filter((c) => c >= 6 && c <= 17);
    out.push({
      validAt: parseGioNgay(dau[i].head, issuedAt, now),
      lat: diem[0].lat,
      lon: diem[0].lon,
      cap: caps.length ? Math.max(...caps) : null,
      giat: giatCap ? Number(giatCap) : null,
      ...parseHuongTocDo(lat),
      danger: parseDangerBox(lat),
    });
  }
  return out;
}

/** Bản tin chữ → hình dạng ĐẦY ĐỦ để ghi kho. null = không đủ dữ kiện. */
export function parseNchmfFull(
  thoText: string,
  now: Date,
  url?: string,
): NchmfBulletin | null {
  // BỎ MENU TRANG TRƯỚC MỌI PHÉP ĐỌC — xem `catThanBanTin` (storms-vn.ts)
  const text = catThanBanTin(thoText);
  const diem = parseToaDo(text);
  if (diem.length === 0) return null;

  const issuedAt = parseGioPhatTin(text, now);
  /*  Cắt phần HIỆN TRẠNG (trước mục "Dự báo diễn biến") để hướng/tốc độ/cấp của
      TÂM không lẫn với số của các mốc dự báo phía sau — bản tin là một dòng chữ
      liền sau khi bỏ thẻ HTML. */
  const cat = text.search(/dự\s+báo\s+diễn\s+biến/iu);
  const hienTrang = cat > 0 ? text.slice(0, cat) : text;
  const giat = /giật\s+cấp\s+(\d{1,2})/iu.exec(hienTrang)?.[1] ?? null;
  /*  Bản tin BÃO viết đủ một câu dài: *"Bán kính gió mạnh cấp 6 khoảng 250km
      tính từ tâm bão"* — giữa "bán kính" và số còn "gió mạnh cấp 6 khoảng".
      Nới trong PHẠM VI HẸP (≤40 ký tự, không vượt dấu chấm) để không vơ nhầm
      một con số km nào khác trong bản tin. */
  const banKinh =
    /bán\s+kính[^.]{0,40}?(\d{2,3})\s*km/iu.exec(text)?.[1] ?? null;
  const risk = /rủi\s+ro[^]{0,40}?cấp\s+(\d)\b/iu.exec(text)?.[1] ?? null;

  return {
    issuedAt,
    observedAt: parseGioNgay(hienTrang, issuedAt, now),
    // đọc trên TOÀN bản tin: mốc hẹn nằm ở cuối, sau bảng dự báo
    nextAt: parseGioBanTinTiepTheo(text, issuedAt, now),
    laBao: /\bbão\b/iu.test(text) && !/áp\s+thấp\s+nhiệt\s+đới/iu.test(text),
    soBao: /bão\s+số\s+(\d{1,2})/iu.exec(text)?.[1] ?? null,
    lat: diem[0].lat,
    lon: diem[0].lon,
    cap: parseCapGio(hienTrang),
    giat: giat ? Number(giat) : null,
    ...parseHuongTocDo(hienTrang),
    radiusKm: banKinh ? Number(banKinh) : null,
    danger: parseDangerBox(hienTrang),
    risk: risk ? Number(risk) : null,
    forecast: parseForecastPoints(cat > 0 ? text.slice(cat) : text, issuedAt, now),
    url: url ?? null,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   GOM BẢN TIN VỀ CÙNG MỘT CƠN
   ═══════════════════════════════════════════════════════════════════════════ */

/** Hai bản tin liên tiếp cách nhau quá ngần này giờ thì không còn là một cơn */
export const LIEN_TUC_GIO = 12;
/** …hoặc tâm nhảy quá ngần này km */
export const LIEN_TUC_KM = 600;

/** Haversine (km) */
export function khoangCachKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type StormKeyRef = {
  key: string;
  issuedAt: number | null;
  lat: number;
  lon: number;
};

/**
 * KHOÁ gom bản tin về cùng một cơn.
 *
 * Bão có số ("bão số 5") thì dễ và ổn định. **Áp thấp nhiệt đới KHÔNG có tên
 * hay số nào** — mà đó lại là ca thường gặp nhất, và cũng là ca cần đường đi
 * nhất (ATNĐ mạnh lên thành bão thì bà con muốn thấy nó đã bò từ đâu tới).
 * Gom theo LIÊN TỤC: cùng cơn nếu cách bản tin trước ≤ 12 giờ và tâm cách
 * ≤ 600 km (ATNĐ đi ~5–15 km/h, 12 giờ tối đa ~180 km — 600 km là rộng rãi cho
 * cả ca nhảy tâm khi cơn tổ chức lại). Không khớp ⇒ cơn MỚI, khoá theo ngày
 * phát để vừa duy nhất vừa đọc được.
 *
 * ⚠️ ATNĐ MẠNH LÊN THÀNH BÃO: bản tin sau có "bão số N" ⇒ khoá ĐỔI sang
 * `bao-so-N`. Chỗ ghi kho phải nối hai khoá đó lại (xem `/api/cron/refresh-storms`),
 * không thì đường đi đứt làm đôi đúng lúc cơn nguy hiểm nhất.
 */
export function noiTiep(b: NchmfBulletin, truoc?: StormKeyRef | null): boolean {
  if (!truoc || truoc.issuedAt == null || b.issuedAt == null) return false;
  const gio = Math.abs(b.issuedAt - truoc.issuedAt) / 3_600_000;
  if (gio > LIEN_TUC_GIO) return false;
  return khoangCachKm(b.lat, b.lon, truoc.lat, truoc.lon) <= LIEN_TUC_KM;
}

/**
 * Khoá CŨ cần đổi tên khi áp thấp mạnh lên thành bão, hoặc null.
 *
 * Không dùng thì đường đi ĐỨT LÀM ĐÔI đúng lúc cơn nguy hiểm nhất: các bản tin
 * ATNĐ nằm dưới `atnd-2026...`, các bản tin bão nằm dưới `bao-so-5-2026`, bản
 * đồ vẽ ra hai vệt rời không ai hiểu. Đây là lần DUY NHẤT hàng cũ được sửa —
 * và chỉ sửa NHÃN, không đụng toạ độ/giờ (xem `/api/cron/refresh-storms`).
 */
export function khoaCanDoiTen(
  b: NchmfBulletin,
  truoc: StormKeyRef | null | undefined,
  khoaMoi: string,
): string | null {
  if (!truoc || truoc.key === khoaMoi) return null;
  if (!truoc.key.startsWith("atnd-")) return null; // bão→bão số khác = cơn khác
  return noiTiep(b, truoc) ? truoc.key : null;
}

export function stormKeyFor(b: NchmfBulletin, truoc?: StormKeyRef | null): string {
  const nam = new Date(b.issuedAt ?? Date.now()).getUTCFullYear();
  if (b.soBao) return `bao-so-${b.soBao}-${nam}`;
  if (noiTiep(b, truoc)) return truoc!.key;
  const d = new Date(b.issuedAt ?? Date.now());
  const ngay = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(
    d.getUTCDate(),
  ).padStart(2, "0")}`;
  return `atnd-${ngay}`;
}

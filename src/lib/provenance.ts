/**
 * SỔ NGUỒN GỐC (provenance) cho từng ĐỐI TƯỢNG bản đồ.
 *
 * Vì sao có file này: dữ liệu bản đồ đang chạy phần lớn dẫn xuất từ
 * OpenStreetMap — giấy phép ODbL có điều khoản SHARE-ALIKE. Nếu sau này bán
 * licence dữ liệu, mọi thứ chạm vào ODbL đều kéo theo nghĩa vụ mở lại cơ sở
 * dữ liệu dẫn xuất. Muốn tách được "gói sạch" (bán được) khỏi "gói ODbL"
 * (dùng trong app, không bán rời) thì mỗi đối tượng phải TỰ MANG theo lý lịch
 * của nó: lấy ở đâu, giấy phép gì, ngày nào, đã đối chiếu với ai, tin được
 * tới đâu. Ghi ở mức bộ dữ liệu là KHÔNG đủ — một file có thể trộn nhiều
 * nguồn (vd hình rạn OSM + nhãn tên tự soạn).
 *
 * File này THUẦN: không fetch, không đọc đồng hồ máy, không đọc file. Mọi mốc
 * thời gian truyền vào dưới dạng "YYYY-MM-DD". Nhờ vậy test được toàn bộ luật
 * giấy phép + độ tin cậy mà không cần mạng.
 *
 * Công cụ đối chiếu sinh ra số liệu cho `crossChecks`:
 * `scripts/compare-sources.mjs` (xem `docs/research/doi-chieu-nguon-2026-08.md`).
 */

// ── 1. GIẤY PHÉP ────────────────────────────────────────────────────────────

export type LicenseId =
  | "public-domain" // NOAA/NGA (tác phẩm chính phủ Mỹ), không ràng buộc
  | "cc0-1.0"
  | "cc-by-4.0" // phải ghi công, KHÔNG share-alike
  | "gebco" // GEBCO: dùng tự do, yêu cầu ghi công (không share-alike)
  | "odbl-1.0" // OpenStreetMap — CÓ share-alike, đây là thứ phải lọc ra
  | "vn-official" // văn bản/số liệu nhà nước VN công bố công khai
  | "sdfish-own" // tự soạn trong dự án — sở hữu của mình
  | "unknown"; // chưa tra được → coi như KHÔNG bán được

export interface LicenseTerms {
  id: LicenseId;
  /** tên hiển thị trong doc/UI */
  label: string;
  /** bắt buộc ghi công nguồn khi phát hành */
  attribution: boolean;
  /**
   * CÓ share-alike = tác phẩm dẫn xuất phải mở lại theo cùng giấy phép.
   * Đây là tiêu chí CHẶN của gói bán.
   */
  shareAlike: boolean;
  /** được phép phát hành lại (kể cả có thu tiền) */
  redistributable: boolean;
}

export const LICENSES: Record<LicenseId, LicenseTerms> = {
  "public-domain": {
    id: "public-domain",
    label: "Public domain (tác phẩm chính phủ Mỹ)",
    attribution: false,
    shareAlike: false,
    redistributable: true,
  },
  "cc0-1.0": {
    id: "cc0-1.0",
    label: "CC0 1.0",
    attribution: false,
    shareAlike: false,
    redistributable: true,
  },
  "cc-by-4.0": {
    id: "cc-by-4.0",
    label: "CC BY 4.0",
    attribution: true,
    shareAlike: false,
    redistributable: true,
  },
  gebco: {
    id: "gebco",
    label: "GEBCO Grid terms (ghi công, không share-alike)",
    attribution: true,
    shareAlike: false,
    redistributable: true,
  },
  "odbl-1.0": {
    id: "odbl-1.0",
    label: "ODbL 1.0 (OpenStreetMap — CÓ share-alike)",
    attribution: true,
    shareAlike: true,
    redistributable: true,
  },
  /*  NHÀ NƯỚC VIỆT NAM CÔNG BỐ CÔNG KHAI — Thông báo hàng hải, danh mục báo
      hiệu, tin bão.

      Điều 15 Luật Sở hữu trí tuệ loại "văn bản hành chính" và "số liệu" khỏi
      phạm vi bảo hộ quyền tác giả. Doanh nghiệp hiện thực hoá thông tin đó
      thành ứng dụng cho bà con là việc bình thường — KHÔNG share-alike, KHÔNG
      chặn thương mại.

      `attribution: true` KHÔNG phải nghĩa vụ pháp lý mà là quyết định của dự
      án: ghi số hiệu thông báo và cơ quan ban hành để bà con (hoặc cán bộ cảng
      vụ) tra lại tận gốc. Ta không phải nguồn cuối cùng và không giả vờ là. */
  "vn-official": {
    id: "vn-official",
    label: "Nhà nước Việt Nam công bố công khai (Điều 15 Luật SHTT)",
    attribution: true,
    shareAlike: false,
    redistributable: true,
  },
  "sdfish-own": {
    id: "sdfish-own",
    label: "Tự soạn trong dự án SDFish",
    attribution: false,
    shareAlike: false,
    redistributable: true,
  },
  unknown: {
    id: "unknown",
    label: "Chưa tra được giấy phép",
    attribution: true,
    shareAlike: false,
    // Chưa biết thì KHÔNG được phát hành lại. Mặc định an toàn nhất —
    // đoán "chắc là tự do" là cách nhanh nhất để bị kiện.
    redistributable: false,
  },
};

// ── 2. NGUỒN ────────────────────────────────────────────────────────────────

export type SourceId =
  | "osm" // OpenStreetMap qua Overpass
  | "aca" // Allen Coral Atlas (PlanetScope 5 m + ML)
  | "wcmc" // UNEP-WCMC WCMC-008 (Millennium Coral Reef Mapping + biên tập)
  | "gebco" // GEBCO Grid (compilation độ sâu toàn cầu)
  | "etopo" // ETOPO 2022 (NOAA NCEI)
  | "nga-msi" // NGA Maritime Safety Information
  | "tbhh" // Thông báo hàng hải (vmsa.vn, kho vms-south, cảng vụ tỉnh)
  | "vinamarine" // Cục Hàng hải VN — danh mục báo hiệu
  | "vms-south-aton-list" // sổ "List of AtoN System" miền Nam (NXB GTVT 2016)
  | "sdfish"; // tự soạn (nhãn tên Việt, đảo, tuyến)

/**
 * HẠNG PHƯƠNG PHÁP ĐO của nguồn — dùng cho thang tin cậy.
 * Không phải "nguồn nào uy tín hơn" mà là "sai theo KIỂU nào":
 *  - `remote-sensing`: ảnh vệ tinh có độ phân giải công bố + quy trình lặp
 *    lại được. Sai số có thể ƯỚC LƯỢNG (bằng GSD ảnh).
 *  - `survey-compilation`: gộp từ khảo sát/bản đồ nhiều nguồn, có biên tập.
 *    Sai số KHÔNG đều theo vùng — chỗ có khảo sát thì rất tốt, chỗ không thì
 *    là nội suy.
 *  - `crowd`: tình nguyện viên vẽ tay theo ảnh nền không rõ đời. Sai số
 *    không chặn được, và phụ thuộc người vẽ.
 *  - `authored`: người trong dự án tự soạn. Tin được về Ý NGHĨA (tên tiếng
 *    Việt, chủ quyền) nhưng KHÔNG phải là phép đo.
 */
export type SourceMethod =
  | "remote-sensing"
  | "survey-compilation"
  | "crowd"
  | "authored";

export interface SourceInfo {
  id: SourceId;
  label: string;
  license: LicenseId;
  method: SourceMethod;
  /** độ phân giải danh nghĩa (mét/ô hoặc mét/pixel); null khi không có khái niệm này */
  resolutionM: number | null;
  /** phải ghi công thế nào khi phát hành */
  attribution: string;
}

export const SOURCES: Record<SourceId, SourceInfo> = {
  osm: {
    id: "osm",
    label: "OpenStreetMap (Overpass)",
    license: "odbl-1.0",
    method: "crowd",
    resolutionM: null,
    attribution: "© OpenStreetMap contributors (ODbL)",
  },
  aca: {
    id: "aca",
    label: "Allen Coral Atlas",
    license: "cc-by-4.0",
    method: "remote-sensing",
    resolutionM: 5,
    attribution: "Allen Coral Atlas (CC BY 4.0)",
  },
  wcmc: {
    id: "wcmc",
    label: "UNEP-WCMC WCMC-008 Global Distribution of Coral Reefs",
    license: "cc-by-4.0",
    method: "survey-compilation",
    resolutionM: 30,
    attribution: "UNEP-WCMC, WorldFish Centre, WRI, TNC (2021), WCMC-008 v4.1",
  },
  gebco: {
    id: "gebco",
    label: "GEBCO Grid (15 giây cung)",
    license: "gebco",
    method: "survey-compilation",
    resolutionM: 450,
    attribution: "GEBCO Compilation Group — GEBCO Grid",
  },
  etopo: {
    id: "etopo",
    label: "ETOPO 2022 (NOAA NCEI, 15 giây cung)",
    license: "public-domain",
    method: "survey-compilation",
    resolutionM: 450,
    attribution: "NOAA NCEI ETOPO 2022 (public domain)",
  },
  "nga-msi": {
    id: "nga-msi",
    label: "NGA Maritime Safety Information",
    license: "public-domain",
    method: "survey-compilation",
    resolutionM: null,
    attribution: "U.S. NGA Maritime Safety Information (public domain)",
  },
  /*  Số đo sâu bóc từ Thông báo hàng hải. `survey-compilation` chứ không phải
      một hạng "đo trực tiếp" riêng: từng thông báo LÀ khảo sát hồi âm thật, độ
      phân giải mét — nhưng bộ dữ liệu ta phát hành là NHIỀU đợt khảo sát khác
      ngày gộp lại, nên sai số không đều theo vùng và theo thời gian, đúng chỗ
      hạng này mô tả. Tuổi từng điểm nói riêng ở giao diện. */
  tbhh: {
    id: "tbhh",
    label: "Thông báo hàng hải (Tổng công ty Bảo đảm an toàn hàng hải)",
    license: "vn-official",
    method: "survey-compilation",
    resolutionM: 1,
    attribution: "Thông báo hàng hải — Bảo đảm an toàn hàng hải Việt Nam",
  },
  vinamarine: {
    id: "vinamarine",
    label: "Cục Hàng hải Việt Nam — danh mục báo hiệu hàng hải",
    license: "vn-official",
    method: "survey-compilation",
    resolutionM: 1,
    attribution: "Cục Hàng hải Việt Nam",
  },
  /*  Sổ "List of AtoN system from the South of Sa Huynh lighthouse" — Tổng
      công ty Bảo đảm an toàn hàng hải miền Nam biên soạn, NXB Giao thông vận
      tải phát hành (QĐ 211/QĐ-GTVT 24/10/2016, ISBN 978-604-76-1153-9).
      752 báo hiệu miền Nam có toạ độ — nguồn giấy DUY NHẤT còn lại cho 22
      tuyến luồng mà cổng ENC chỉ công bố con số đếm.

      Ấn phẩm của doanh nghiệp nhà nước, nội dung là số liệu báo hiệu hàng hải
      (nhóm S-12 công khai) — cùng chân đứng pháp lý `vn-official` với hai
      nguồn trên. Điều PHẢI giữ không phải nhãn pháp lý mà là nhãn TUỔI: sổ
      chốt 2016, phao luồng đổi theo từng đợt nạo vét, nên mọi đối tượng gốc
      sổ mang cờ `canhBaoTuoi` và nhường chỗ cho Thông báo hàng hải mới hơn
      khi trùng vị trí (xem generate-vn-aids.mjs, nguồn C). */
  "vms-south-aton-list": {
    id: "vms-south-aton-list",
    label:
      "List of AtoN System — Bảo đảm an toàn hàng hải miền Nam (NXB GTVT 2016)",
    license: "vn-official",
    method: "survey-compilation",
    resolutionM: 1,
    attribution:
      "Tổng công ty Bảo đảm an toàn hàng hải miền Nam — List of AtoN System (2016)",
  },
  sdfish: {
    id: "sdfish",
    label: "SDFish tự soạn",
    license: "sdfish-own",
    method: "authored",
    resolutionM: null,
    attribution: "SDFish",
  },
};

// ── 3. LÝ LỊCH MỘT ĐỐI TƯỢNG ────────────────────────────────────────────────

/** Một lần lấy dữ liệu từ một nguồn. `at` là ngày LẤY VỀ ("YYYY-MM-DD"). */
export interface SourceRef {
  source: SourceId;
  at: string;
  /** phiên bản/bản phát hành của nguồn, vd "v4.1", "2026" — có thì ghi */
  version?: string;
  /** endpoint đã gọi — để chạy lại được */
  url?: string;
}

/** Kết quả đối chiếu đối tượng này với MỘT nguồn khác. */
export interface CrossCheck {
  source: SourceId;
  /** nguồn kia CÓ đối tượng tương ứng trong bán kính đã đặt */
  agreed: boolean;
  /** khoảng lệch đo được (mét); null khi không khớp hoặc không đo được */
  offsetM: number | null;
  /** ngày chạy đối chiếu ("YYYY-MM-DD") */
  at: string;
}

export interface Provenance {
  /** nguồn của HÌNH HỌC — quyết định giấy phép nặng nhất */
  origin: SourceRef;
  /** nguồn phụ đã trộn vào (nhãn tên, thuộc tính…) — cũng kéo theo giấy phép */
  derivedFrom?: SourceRef[];
  crossChecks?: CrossCheck[];
}

/** Mọi đối tượng mang lý lịch. Dùng cho GeoJSON `properties.prov`. */
export interface WithProvenance {
  prov: Provenance;
}

/** Mọi nguồn dính vào đối tượng này (gốc + phụ), không trùng. */
export function sourcesOf(p: Provenance): SourceId[] {
  const ids = [p.origin.source, ...(p.derivedFrom ?? []).map((d) => d.source)];
  return [...new Set(ids)];
}

// ── 4. LỌC GÓI SẠCH GIẤY PHÉP ───────────────────────────────────────────────

/**
 * Đối tượng này có bán/phát hành lại được KHÔNG.
 *
 * Luật: MỌI nguồn dính vào nó (gốc lẫn phụ) phải vừa `redistributable` vừa
 * KHÔNG `shareAlike`. Một nguồn ODbL trong `derivedFrom` là đủ để cả đối
 * tượng nhiễm share-alike — nhãn tên lấy từ OSM cũng tính.
 */
export function isCleanLicense(p: Provenance): boolean {
  return sourcesOf(p).every((id) => {
    const terms = LICENSES[SOURCES[id].license];
    return terms.redistributable && !terms.shareAlike;
  });
}

/** Nguồn nào làm đối tượng này KHÔNG sạch (rỗng = sạch). Để báo lý do. */
export function dirtySources(p: Provenance): SourceId[] {
  return sourcesOf(p).filter((id) => {
    const terms = LICENSES[SOURCES[id].license];
    return !terms.redistributable || terms.shareAlike;
  });
}

/**
 * MỘT CÂU TRUY VẤN ra gói sạch: lọc theo giấy phép, và (tuỳ chọn) theo sàn
 * độ tin cậy — bán dữ liệu sạch nhưng sai thì cũng không bán được lần hai.
 */
export function cleanPackage<T extends WithProvenance>(
  items: readonly T[],
  opts: { minConfidence?: number; today?: string } = {},
): T[] {
  const { minConfidence, today } = opts;
  return items.filter((it) => {
    if (!isCleanLicense(it.prov)) return false;
    if (minConfidence == null) return true;
    return confidenceOf(it.prov, today).score >= minConfidence;
  });
}

/** Chuỗi ghi công cần in kèm gói (đã lọc trùng, theo thứ tự nguồn xuất hiện). */
export function attributionsFor(
  items: readonly WithProvenance[],
): string[] {
  const out: string[] = [];
  for (const it of items) {
    for (const id of sourcesOf(it.prov)) {
      const s = SOURCES[id];
      if (LICENSES[s.license].attribution && !out.includes(s.attribution)) {
        out.push(s.attribution);
      }
    }
  }
  return out;
}

// ── 5. THANG ĐỘ TIN CẬY ─────────────────────────────────────────────────────
//
// Bốn yếu tố, cộng lại tối đa 100. Trọng số là XẾP HẠNG THỨ TỰ (yếu tố nào
// mạnh hơn yếu tố nào), KHÔNG phải hệ số khớp từ dữ liệu — chưa có bộ chân lý
// nào cho vùng biển VN để khớp cả. Ai có bộ đo thật (khảo sát thuỷ đạc) thì
// hiệu chỉnh lại; tới lúc đó bốn con số dưới đây là phán đoán có lý do:
//
//  (1) SỐ NGUỒN ĐỘC LẬP XÁC NHẬN — 40 điểm, NẶNG NHẤT.
//      Hai bên đo bằng hai cách khác nhau mà ra cùng một chỗ thì phải có vật
//      thật ở đó. Một mình OSM nói có rạn thì không có cách nào phân biệt
//      "rạn thật" với "một người vẽ nhầm" — mà rạn là vật cản chết người.
//      Đây là loại bằng chứng duy nhất KHÔNG suy được từ chính nguồn đó.
//
//  (2) HẠNG PHƯƠNG PHÁP CỦA NGUỒN GỐC — 25 điểm.
//      Ảnh vệ tinh 5 m có quy trình lặp lại được và sai số ước lượng được;
//      OSM vẽ tay thì không. Nhẹ hơn (1) vì nó nói về CÁCH ĐO chứ không phải
//      về vật: một nguồn tốt vẫn có thể sót, hai nguồn xoàng đồng ý thì
//      thường vẫn có vật.
//
//  (3) VÊNH VỊ TRÍ giữa các nguồn đồng ý — 20 điểm.
//      Hai nguồn "cùng nói có rạn" nhưng lệch 3 km thì thực chất chưa xác
//      nhận được ĐÂU là mép rạn — thứ người lái tàu cần. Chỉ tính khi đã có
//      xác nhận, nên nhẹ hơn (1).
//
//  (4) ĐỘ TƯƠI — 15 điểm, NHẸ NHẤT nhưng KHÔNG bỏ được.
//      Rạn đổi theo chục năm, nên tuổi bản đồ ít quan trọng hơn ba yếu tố
//      trên. Nhưng riêng Trường Sa, địa hình bị NẠO VÉT ĐẮP ĐẢO đổi hẳn trong
//      2014–2016: một hình vẽ trước 2014 ở đó là sai vật lý, không phải cũ.
//      Vì vậy tuổi vẫn phải có mặt trong công thức.
//
// Ai muốn sửa: sửa hằng số ở đây, ĐỪNG rải số ma trong code gọi.

export const CONFIDENCE_WEIGHTS = {
  agreement: 40,
  method: 25,
  offset: 20,
  freshness: 15,
} as const;

/** Điểm hạng phương pháp, 0..1 — nhân với trọng số `method`. */
const METHOD_SCORE: Record<SourceMethod, number> = {
  "remote-sensing": 1,
  "survey-compilation": 0.75,
  // Tự soạn ĐỨNG TRÊN crowd: người soạn là người trong dự án, chịu trách
  // nhiệm và tra được lý do; OSM vùng tranh chấp thì không ai chịu trách nhiệm.
  authored: 0.5,
  crowd: 0.35,
};

/**
 * Vênh bao nhiêu mét thì coi như "cùng một vật, đo lệch chút" (điểm đầy) và
 * bao nhiêu thì coi như "không còn xác nhận được mép" (điểm 0).
 * 150 m ≈ chưa tới nửa ô lưới độ sâu 15" (450 m) — dưới mức đó thì mọi nguồn
 * trong dự án đều không phân biệt nổi. 3000 m là bề ngang một rạn cỡ vừa ở
 * Trường Sa: lệch hơn thế thì hai bên đang nói về hai chỗ khác nhau.
 */
export const OFFSET_FULL_M = 150;
export const OFFSET_ZERO_M = 3000;

/**
 * Bao lâu thì bản đồ hết "tươi". 5 năm: đủ dài để không phạt oan dữ liệu
 * biên tập kỹ (WCMC v4.1 phát hành 2021), đủ ngắn để một hình vẽ từ thời
 * trước đợt nạo vét Trường Sa 2014–2016 rơi hẳn xuống 0.
 */
export const FRESH_FULL_DAYS = 365;
export const FRESH_ZERO_DAYS = 365 * 5;

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Nội suy tuyến tính giảm dần: `full` → 1, `zero` → 0. */
function ramp(v: number, full: number, zero: number): number {
  if (!Number.isFinite(v)) return 0;
  if (v <= full) return 1;
  if (v >= zero) return 0;
  return (zero - v) / (zero - full);
}

/** Số ngày giữa hai mốc "YYYY-MM-DD"; NaN nếu chuỗi không hợp lệ. */
export function daysBetween(fromISO: string, toISO: string): number {
  const a = Date.parse(`${fromISO}T00:00:00Z`);
  const b = Date.parse(`${toISO}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return NaN;
  return (b - a) / 86_400_000;
}

export interface ConfidenceBreakdown {
  /** 0..100 */
  score: number;
  /** A ≥ 80 · B ≥ 60 · C ≥ 40 · D < 40 — dùng BẬC khi nói với người, đừng nói số lẻ */
  band: "A" | "B" | "C" | "D";
  parts: {
    agreement: number;
    method: number;
    offset: number;
    freshness: number;
  };
  /** số nguồn ĐỘC LẬP xác nhận (không kể nguồn gốc) */
  confirmations: number;
  /** vênh lớn nhất trong các xác nhận (mét); null khi chưa xác nhận được */
  worstOffsetM: number | null;
}

/**
 * Điểm tin cậy của một đối tượng.
 *
 * `today` là "YYYY-MM-DD"; không truyền thì bỏ qua yếu tố độ tươi và CHIA LẠI
 * thang về 100 (không phạt oan khi người gọi chưa quan tâm tới tuổi).
 */
export function confidenceOf(
  p: Provenance,
  today?: string,
): ConfidenceBreakdown {
  const checks = p.crossChecks ?? [];
  // Chỉ đếm nguồn KHÁC nguồn gốc — nguồn tự xác nhận chính nó không phải bằng chứng.
  const agreedIds = [
    ...new Set(
      checks
        .filter((c) => c.agreed && c.source !== p.origin.source)
        .map((c) => c.source),
    ),
  ];
  const confirmations = agreedIds.length;

  // (1) Xác nhận: 1 nguồn = 70% điểm, ≥2 nguồn = đầy. Bước nhảy lớn nhất nằm ở
  // "từ không ai xác nhận sang có một người" — đó là chỗ thông tin tăng nhiều nhất.
  const agreementScore =
    confirmations >= 2 ? 1 : confirmations === 1 ? 0.7 : 0;

  // (2) Phương pháp của nguồn gốc.
  const methodScore = METHOD_SCORE[SOURCES[p.origin.source].method];

  // (3) Vênh: lấy trường hợp XẤU NHẤT trong các xác nhận (không lấy trung bình
  // — một xác nhận lệch 3 km vẫn là một điểm mù, trung bình sẽ giấu nó đi).
  const offsets = checks
    .filter((c) => c.agreed && c.offsetM != null && Number.isFinite(c.offsetM))
    .map((c) => c.offsetM as number);
  const worstOffsetM = offsets.length ? Math.max(...offsets) : null;
  // Chưa có xác nhận nào → không có gì để đo vênh → 0 điểm (không phải "đầy").
  const offsetScore =
    worstOffsetM == null ? 0 : ramp(worstOffsetM, OFFSET_FULL_M, OFFSET_ZERO_M);

  const parts = {
    agreement: agreementScore * CONFIDENCE_WEIGHTS.agreement,
    method: methodScore * CONFIDENCE_WEIGHTS.method,
    offset: offsetScore * CONFIDENCE_WEIGHTS.offset,
    freshness: 0,
  };

  let total = CONFIDENCE_WEIGHTS.agreement + CONFIDENCE_WEIGHTS.method + CONFIDENCE_WEIGHTS.offset;
  if (today) {
    const age = daysBetween(p.origin.at, today);
    const freshScore = Number.isNaN(age)
      ? 0
      : ramp(Math.max(age, 0), FRESH_FULL_DAYS, FRESH_ZERO_DAYS);
    parts.freshness = freshScore * CONFIDENCE_WEIGHTS.freshness;
    total += CONFIDENCE_WEIGHTS.freshness;
  }

  const raw = parts.agreement + parts.method + parts.offset + parts.freshness;
  const score = Math.round(clamp01(raw / total) * 100);
  const band = score >= 80 ? "A" : score >= 60 ? "B" : score >= 40 ? "C" : "D";
  return { score, band, parts, confirmations, worstOffsetM };
}

// ── 6. KIỂM TÍNH HỢP LỆ ─────────────────────────────────────────────────────

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Ngày có THẬT không. Phải so vòng lại chứ không chỉ `Date.parse`:
 * `Date.parse("2026-02-31")` KHÔNG trả NaN — V8 lặng lẽ cuộn sang 03-03.
 * Một ngày lấy dữ liệu sai lệch vài ngày là sai lý lịch, phải bắt.
 */
function isRealISODate(s: string): boolean {
  const t = Date.parse(`${s}T00:00:00Z`);
  if (!Number.isFinite(t)) return false;
  return new Date(t).toISOString().slice(0, 10) === s;
}

function checkRef(ref: SourceRef, where: string, out: string[]): void {
  if (!SOURCES[ref.source]) out.push(`${where}: nguồn lạ "${ref.source}"`);
  if (!ISO_DATE.test(ref.at ?? "")) {
    out.push(`${where}: ngày lấy phải là YYYY-MM-DD, đang là "${ref.at}"`);
  } else if (!isRealISODate(ref.at)) {
    out.push(`${where}: ngày lấy không có thật — "${ref.at}"`);
  }
}

/**
 * Trả DANH SÁCH LỖI (rỗng = hợp lệ). Không ném — người gọi thường đang duyệt
 * hàng nghìn đối tượng và cần biết HẾT chỗ hỏng, không phải dừng ở cái đầu.
 */
export function validateProvenance(p: Provenance | null | undefined): string[] {
  const out: string[] = [];
  if (!p || typeof p !== "object") return ["thiếu lý lịch (prov)"];
  if (!p.origin) {
    out.push("thiếu origin — không biết hình học lấy ở đâu");
  } else {
    checkRef(p.origin, "origin", out);
  }
  (p.derivedFrom ?? []).forEach((d, i) => checkRef(d, `derivedFrom[${i}]`, out));

  const seen = new Set<SourceId>();
  (p.crossChecks ?? []).forEach((c, i) => {
    const where = `crossChecks[${i}]`;
    if (!SOURCES[c.source]) out.push(`${where}: nguồn lạ "${c.source}"`);
    if (!ISO_DATE.test(c.at ?? "")) {
      out.push(`${where}: ngày đối chiếu phải là YYYY-MM-DD, đang là "${c.at}"`);
    }
    if (c.agreed && c.offsetM != null && !(c.offsetM >= 0)) {
      out.push(`${where}: offsetM phải ≥ 0, đang là ${c.offsetM}`);
    }
    if (!c.agreed && c.offsetM != null) {
      // Không khớp mà vẫn ghi khoảng lệch = mâu thuẫn; điểm tin cậy sẽ bỏ qua
      // số này, nên phải báo chứ không nuốt im.
      out.push(`${where}: agreed=false nhưng vẫn có offsetM=${c.offsetM}`);
    }
    if (c.source === p.origin?.source) {
      out.push(`${where}: đối chiếu với CHÍNH nguồn gốc — không phải bằng chứng độc lập`);
    }
    if (seen.has(c.source)) out.push(`${where}: trùng nguồn "${c.source}"`);
    seen.add(c.source);
  });
  return out;
}

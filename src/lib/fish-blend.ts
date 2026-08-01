// Trục 1 — LỚP CÁ CHO CHUYẾN DÀI: pha trộn bản DỰ BÁO (ảnh vệ tinh hôm nay)
// với bản MÙA VỤ (điều kiện điển hình của tháng, dựng từ nhiều năm lịch sử).
//
//     blend(ô, d) = w(d)·persist(ô) + (1 − w(d))·clim(ô, tháng đích)
//
// VÌ SAO: lộ trình chuyến biển tới 16 NGÀY, nhưng ảnh vệ tinh chỉ nói được vài
// ngày đầu. Ngày xa mà vẫn bê nguyên ảnh hôm nay là hứa hão; rơi về mùa vụ thì
// mất thông tin đang có. Pha trộn giữ được cả hai.
//
// w(d) KHÔNG ĐẶT TAY (chủ dự án chốt 2026-07-28): đo bằng backtest thật ở
// scripts/fit-fish-blend-weights.mjs → src/data/fish-blend-weights.json.
// Sửa w phải chạy lại script, KHÔNG gõ số vào đây.
//
// OFFLINE (bất biến của app): bảng w NHÚNG THẲNG vào bundle (JSON nhỏ, không
// bao giờ phải tải); bản mùa vụ là asset tĩnh /data/fish-climatology.v1.json
// đã nằm trong danh sách pre-cache của service worker → giữa biển mất sóng vẫn
// dựng được lộ trình. Thiếu bản mùa vụ ⇒ TRẢ NGUYÊN bản dự báo (bất biến
// monotonic: mất nguồn thì bớt thông tin, KHÔNG bịa thêm).

import weightsRaw from "@/data/fish-blend-weights.json";

/* ── bảng trọng số (sinh offline) ─────────────────────────────────────────── */

interface LeadRow {
  lead: number;
  w: number | null;
}
interface WeightsFile {
  perLead?: LeadRow[];
  guard?: { degenerate?: boolean; verdict?: string };
  cvWinsOverPersistence?: number[];
}

const WEIGHTS = weightsRaw as WeightsFile;

/** Các mốc tầm ngày đã ĐO được, tăng dần, đã bỏ mốc thiếu số */
const MEASURED: { lead: number; w: number }[] = (WEIGHTS.perLead ?? [])
  .filter((r): r is { lead: number; w: number } => typeof r?.w === "number")
  .map((r) => ({ lead: r.lead, w: Math.min(1, Math.max(0, r.w)) }))
  .sort((a, b) => a.lead - b.lead);

/** Bảng w có dùng được không — rỗng/suy biến thì lớp blend tự tắt (giữ persist) */
export const BLEND_USABLE =
  MEASURED.length > 0 && WEIGHTS.guard?.degenerate !== true;

/** Tầm ngày xa nhất bảng w nói được (ngày) — quá mốc này giữ w của mốc cuối */
export const MAX_MEASURED_LEAD = MEASURED.length
  ? MEASURED[MEASURED.length - 1].lead
  : 0;

/**
 * TỶ LỆ ĐO ĐƯỢC — bao nhiêu phần tin bản dự báo tại tầm `dayIdx`, theo backtest.
 * Đây là SỐ ĐO thuần, giữ lại để đối chiếu; cái app dùng là `blendWeight`
 * (có lớp chọn của chủ dự án đè lên — xem PRODUCT_SHARE bên dưới).
 */
export function measuredWeight(dayIdx: number): number {
  if (!BLEND_USABLE) return 1;
  const d = Math.max(0, dayIdx);
  if (d === 0) return 1;
  if (d <= MEASURED[0].lead) {
    const t = d / MEASURED[0].lead;
    return 1 + t * (MEASURED[0].w - 1);
  }
  for (let i = 0; i < MEASURED.length - 1; i++) {
    const a = MEASURED[i];
    const b = MEASURED[i + 1];
    if (d <= b.lead) {
      const t = (d - a.lead) / (b.lead - a.lead);
      return a.w + t * (b.w - a.w);
    }
  }
  return MEASURED[MEASURED.length - 1].w;
}

/* ── LỚP CHỌN CỦA CHỦ DỰ ÁN (2026-07-28) ─────────────────────────────────────
   Backtest nói mùa vụ chỉ đáng ~20 % ở ngày 16 (tối ưu theo sai số). CHỦ DỰ ÁN
   CHỐT: "tăng theo ngày từ 6 % ngày 1 tới 56 % ngày 16 chứ 20 % thì ít quá".

   ĐÂY LÀ QUYẾT ĐỊNH SẢN PHẨM, KHÔNG PHẢI SỐ ĐO — ghi rõ để người sau khỏi tưởng
   là kết quả backtest. Lý do sản phẩm chính đáng: ở 20 % thì KHÔNG ô mới nào
   vượt nổi sàn hiển thị 40 ⇒ bản đồ ngày xa chỉ là bản đồ hôm nay nhạt đi, mùa
   vụ không nói được gì. Ở 56 % thì ô mùa vụ mạnh mới nổi lên được.

   CÁI GIÁ (đo thật, đừng quên): xem `productCurve` trong fish-blend-weights.json
   và 09 §5f — nhích tỷ lệ lên khỏi mức tối ưu thì độ "chỉ đúng chỗ" (top-100)
   giảm. Đánh đổi: ít chính xác hơn một chút, đổi lấy bản đồ ngày xa có nội dung.

   CÁCH DỰNG: giữ nguyên HÌNH DẠNG đường cong đo được (lên nhanh mấy ngày đầu
   rồi thoải dần) và kéo giãn tuyến tính để hai đầu chạm đúng 6 % và 56 %. Đổi
   hai mốc này = đổi hằng số ở đây; KHÔNG sửa file weights (file đó là số đo). */
export const PRODUCT_SHARE_FIRST = 0.06; // mùa vụ gánh ở tầm ngày đo đầu tiên
export const PRODUCT_SHARE_LAST = 0.56; // ... và ở tầm ngày đo cuối cùng
/**
 * ĐỘ CONG. gamma > 1 = giữ THẤP mấy ngày đầu rồi VỌT LÊN về cuối.
 *
 * ⚠ ĐÍNH CHÍNH 2026-07-28 (bản ghi trước ở đây SAI — đã khẳng định gamma=2,5
 * "thắng" dựa trên một con số chưa hề đọc được):
 * Đo lại nghiêm túc bằng `scripts/fish-knee-probe.mjs` (11 tầm ngày, ghép cặp
 * theo mốc gốc, có sai số chuẩn) cho kết quả **HOÀ**: top-100 trung bình
 * gamma 0,75 = 63,96 · 1 = 63,93 · 1,5 = 63,95 · 2,5 = 63,81 (bản đang chạy
 * dùng t đo được: 63,94) — chênh nhau < 0,2 điểm %, dưới ngưỡng đáng kể 0,5.
 * Chỉ gamma ≥ 4 và logistic dốc là THUA rõ. ⇒ GIỮ 2,5 vì hoà với bản tốt nhất
 * và khớp ý đồ sản phẩm ("ngày gần đừng đụng vào ảnh"), KHÔNG phải vì nó thắng.
 *
 * ĐIỂM GÃY THẬT: X = 4 ngày (gãy khúc thắng hàm mũ, R² 0,99), NHƯNG chiều gãy
 * NGƯỢC với giả định: ảnh rữa NHANH NHẤT trong 1–4 ngày đầu (−0,050 top-100/ngày)
 * rồi mới phẳng (−0,011/ngày), chứ không phải "consistent rồi rơi".
 *
 * TRẦN CỦA CẢ LỚP NÀY: pha trộn chỉ mua được ~+1,4 điểm % so với ảnh thuần, gần
 * như toàn bộ ở d ≥ 10. Mùa vụ thuần 49,1 vs ảnh 62,5 — KHÔNG bao giờ vượt ảnh ở
 * bất kỳ tầm nào trong 16 ngày.
 *
 * ⚠ BA ĐIỀU BẮT BUỘC BIẾT (vòng phản biện 8 agent, 2026-07-28 — xem 09 §5j):
 * 1. Con số "+1,4" BỊ THỔI LÊN vì RÒ RỈ: bản mùa vụ dựng từ 2020–2025 mà backtest
 *    chạy trên 2022–2025 ⇒ bản neo chứa sẵn dị thường của chính năm test
 *    (ρ ≈ 1/√6). Bỏ năm test đi thì lời tụt từ +3,42 → +2,61 (d≥10: 7,02 → 5,51),
 *    tức ~22 % là rò rỉ. SẢN PHẨM KHÔNG SAI (dùng mọi năm quá khứ là hợp lệ),
 *    nhưng KHÔNG ĐƯỢC fit lại w theo số cũ — phải dựng bản neo bỏ-năm-test trước.
 * 2. THƯỚC ĐO ĐANG PHÓNG ĐẠI SAI SỐ: trường điểm là RUY-BĂNG rộng 1–2 ô men theo
 *    front (86,8 % ô top-100 có ô top-100 kề). Lệch MỘT ô (28 km — vài giờ chạy
 *    tàu) bị tính sai hoàn toàn. Đo với dung sai ±1 ô thì d16 = 80,9 % chứ không
 *    phải 52,7 %. Đừng mô tả sản phẩm bằng con số đúng-ô.
 * 3. 16 mốc gốc chỉ phân giải được hiệu ứng ≥1,1–2,9 điểm % ⇒ mọi kết quả "hoà"
 *    dưới mức đó là KHÔNG ĐO ĐƯỢC, không phải "không có hiệu ứng".
 *
 * ĐÃ THỬ VÀ TRƯỢT (đừng làm lại — 09 §5h, §5j): mùa vụ có điều kiện theo năm
 * tương tự · nở rộng vùng tô · tách w theo mùa gió · đổi dạng đường cong · advect
 * phù du · front composite · neo SST+xu hướng · trung bình động của chính mình
 * (THUA −1,8) · độ tin theo từng ô · dịch trường theo vectơ · **gió/sóng 16 ngày**
 * (nhánh này ĐÃ ĐÓNG: biết HOÀN HẢO thành phần 1° của phần dư cũng chỉ đáng
 * +9–10 điểm %, gió thật hiện thực hoá 1,2 % của trần đó).
 *
 * NHÁNH DUY NHẤT CÒN TÍN HIỆU: bản neo dựng từ NHIỀU NĂM HƠN (5–8 năm trước
 * 2022). Bản bỏ-năm-test cho +1,10 vs bản đang ship (0 tham số fit), nhưng bản
 * chỉ-dùng-năm-TRƯỚC (nhân quả thật) chỉ +0,68 ± 0,47 — chưa chứng minh.
 */
export const PRODUCT_SHARE_GAMMA = 2.5;

/** Tỷ lệ MÙA VỤ gánh tại tầm `dayIdx` (0..1) — số app thật sự dùng */
export function climShare(dayIdx: number): number {
  const d = Math.max(0, dayIdx);
  if (!BLEND_USABLE || d === 0) return 0;
  const raw = 1 - measuredWeight(d);
  const lo = 1 - measuredWeight(MEASURED[0].lead);
  const hi = 1 - measuredWeight(MEASURED[MEASURED.length - 1].lead);
  // dải đo suy biến (hai đầu bằng nhau) → rơi về nội suy thẳng giữa hai mốc chọn
  if (!(hi > lo)) {
    const t = Math.min(1, d / Math.max(1, MEASURED[MEASURED.length - 1].lead));
    return PRODUCT_SHARE_FIRST + t * (PRODUCT_SHARE_LAST - PRODUCT_SHARE_FIRST);
  }
  const t = (raw - lo) / (hi - lo);
  const v =
    PRODUCT_SHARE_FIRST +
    Math.pow(Math.max(0, Math.min(1, t)), PRODUCT_SHARE_GAMMA) *
      (PRODUCT_SHARE_LAST - PRODUCT_SHARE_FIRST);
  return Math.max(0, Math.min(1, v));
}

/**
 * Tỷ lệ tin bản DỰ BÁO tại tầm `dayIdx` ngày (0 = hôm nay).
 * · ngày 0 → 1 (hôm nay chính là ảnh hôm nay, KHÔNG BAO GIỜ pha)
 * · ngày 1..16 → theo `climShare` (hình dạng đo được, hai đầu do chủ dự án chốt)
 * · bảng hỏng/suy biến → 1 (dùng thẳng bản dự báo, không pha)
 */
export function blendWeight(dayIdx: number): number {
  if (!BLEND_USABLE) return 1;
  if (Math.max(0, dayIdx) === 0) return 1;
  return 1 - climShare(dayIdx);
}

/**
 * TẦM NGÀY THẬT của lớp cá = ngày ĐANG XEM − NGÀY ẢNH, KHÔNG phải trừ hôm nay.
 *
 * VÌ SAO (sửa 2026-07-31): backtest đo w(d) với d tính TỪ NGÀY ẢNH
 * (scripts/fit-fish-blend-weights.mjs — chấm ảnh ngày T rồi so với ngày T+d).
 * Nhưng màn hình lại truyền "hôm nay → ngày xem". Ra khơi mất sóng, service
 * worker trả lại bản đồ cá tải từ 8 ngày trước mà chip vẫn đứng ở "Hôm nay"
 * ⇒ d = 0 ⇒ w = 1 = TIN 100% tấm ảnh cũ nhất, đúng lúc nó đáng tin nhất.
 * Đếm từ ngày ảnh thì ảnh càng cũ càng tự pha loãng về bản mùa vụ.
 *
 * Ngày ảnh thiếu/hỏng → lùi về `viewLead` (hành vi cũ, không bịa).
 */
export function fishLeadDays(
  imageDateIso: string | null | undefined,
  viewDateIso: string,
  viewLead: number,
): number {
  if (!imageDateIso || !viewDateIso) return Math.max(0, viewLead);
  const from = Date.parse(`${imageDateIso}T00:00:00Z`);
  const to = Date.parse(`${viewDateIso}T00:00:00Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to))
    return Math.max(0, viewLead);
  const d = Math.round((to - from) / 86400000);
  // Ảnh mới hơn ngày xem (múi giờ / ngày quá khứ) → coi như tầm 0, không âm.
  // KHÔNG bao giờ nhỏ hơn tầm tính từ hôm nay: thà pha loãng thừa còn hơn thiếu.
  return Math.max(0, Math.max(d, viewLead));
}

/* ── bản mùa vụ (asset tĩnh, SW giữ offline) ──────────────────────────────── */

export interface ClimatologyFile {
  v: number;
  generatedAt?: string;
  years?: [number, number];
  lat0: number;
  lon0: number;
  dLat: number;
  dLon: number;
  nLat: number;
  nLon: number;
  /** tháng 1..12 → điểm 0..100 mỗi ô, mã base64 của Uint8Array (row-major theo lat) */
  months: Record<string, string>;
}

export interface Climatology {
  meta: Omit<ClimatologyFile, "months">;
  months: Map<number, Uint8Array>;
}

/** Giải mã file mùa vụ; tháng thiếu bị bỏ (tra sẽ trả 0 = không có gì thêm) */
export function decodeClimatology(file: ClimatologyFile): Climatology {
  const need = file.nLat * file.nLon;
  const months = new Map<number, Uint8Array>();
  for (let m = 1; m <= 12; m++) {
    const b64 = file.months?.[String(m)];
    if (!b64) continue;
    const bin = typeof atob === "function" ? atob(b64) : "";
    if (!bin) continue;
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    if (arr.length !== need) continue; // cỡ sai = file hỏng, bỏ tháng đó
    months.set(m, arr);
  }
  const meta: Omit<ClimatologyFile, "months"> = {
    v: file.v,
    generatedAt: file.generatedAt,
    years: file.years,
    lat0: file.lat0,
    lon0: file.lon0,
    dLat: file.dLat,
    dLon: file.dLon,
    nLat: file.nLat,
    nLon: file.nLon,
  };
  return { meta, months };
}

/**
 * Điểm mùa vụ tại một toạ độ trong tháng `month` (1..12).
 * Ngoài lưới / thiếu tháng → 0 (nghĩa: mùa vụ không nói gì thêm về chỗ này).
 */
export function climScoreAt(
  clim: Climatology | null,
  lat: number,
  lon: number,
  month: number,
): number {
  if (!clim) return 0;
  const buf = clim.months.get(month);
  if (!buf) return 0;
  const { lat0, lon0, dLat, dLon, nLat, nLon } = clim.meta;
  const i = Math.round((lat - lat0) / dLat);
  const j = Math.round((lon - lon0) / dLon);
  if (i < 0 || i >= nLat || j < 0 || j >= nLon) return 0;
  return buf[i * nLon + j] ?? 0;
}

/**
 * Điểm cá dùng cho NGÀY THỨ `dayIdx` của chuyến.
 * `persistS` = điểm bản dự báo (ảnh hôm nay); `climS` = điểm mùa vụ tháng đích.
 * Trả số nguyên 0..100 để đồng nhất với thang điểm đang dùng khắp app.
 */
export function blendScore(
  persistS: number,
  climS: number,
  dayIdx: number,
): number {
  const w = blendWeight(dayIdx);
  const v = w * persistS + (1 - w) * climS;
  return Math.max(0, Math.min(100, Math.round(v)));
}

/* ── v2: CHUẨN HOÁ PHÂN VỊ + PHA TRÊN HỢP HAI TẬP ────────────────────────────
   VÌ SAO PHẢI SỬA (đo 2026-07-28, scripts/fish-blend-audit.mjs — chủ dự án hỏi
   "mùa vụ có tạo ra vị trí mới không hay chỉ kéo tụt điểm ảnh vệ tinh?"):

   · Bản mùa vụ dựng trên nhiệt/phù du TRUNG BÌNH nhiều năm ⇒ các FRONT (ranh
     nước — thứ đẻ ra điểm cao) bị làm mượt mất ⇒ thang điểm của nó BỊ NÉN
     (tháng 7: p90 40 / max 59, so với bản đồ ngày p90 44 / max 62).
   · Lưới cá chỉ chứa ô ≥25 điểm, nên vòng lặp cũ chạy trên DANH SÁCH Ô CỦA ẢNH
     — chỗ nào ảnh chê thì không có mặt để mà nâng.
   ⇒ Hệ quả đo được: 0 ô mới ở MỌI tầm ngày. Muốn một ô mới chạm sàn hiển thị 40
     ở ngày 16 thì mùa vụ phải đạt ≥88 điểm, trong khi cao nhất cả năm là 64 —
     tức là VỀ TOÁN HỌC không bao giờ xảy ra. Mùa vụ chỉ biết kéo xuống.

   NHƯNG mùa vụ THẬT SỰ biết chỗ: tương quan HẠNG với sự thật 0,46 / 0,43 / 0,45
   ở ngày 3 / 8 / 16 — gần như KHÔNG rữa theo ngày, trong khi ảnh vệ tinh rữa
   0,82 → 0,67 → 0,51. Tới ngày 16 hai bên xấp xỉ nhau. Vấn đề chỉ là BIÊN ĐỘ.

   CÁCH SỬA: quy điểm mùa vụ về ĐÚNG THANG của bản đồ ngày bằng PHÂN VỊ — ô nằm
   top 5% của mùa vụ được cho điểm bằng ô top 5% của bản đồ hôm nay. Giữ nguyên
   thứ tự (thông tin vị trí), chỉ kéo giãn biên độ. Rồi pha trên HỢP hai tập ô. */

/** Ô KHÔNG có trong lưới cá nghĩa là điểm < KEEP_MIN(25), không phải bằng 0 —
    lấy điểm giữa khoảng làm ước lượng. PHẢI khớp với scripts/fit-fish-blend-weights.mjs. */
export const ABSENT_PERSIST = 12;

/** Bảng quy đổi điểm mùa vụ (0..100) → điểm theo thang bản đồ ngày */
export type ClimScaleMap = Uint8Array;

/**
 * Dựng bảng quy đổi phân vị: điểm mùa vụ tháng `month` → thang điểm của
 * `dayScores` (điểm các ô bản đồ hôm nay). Cả hai chỉ tính ô > 0.
 * Thiếu dữ liệu một bên → bảng ĐỒNG NHẤT (quy đổi = chính nó, không bịa).
 */
export function buildClimScaleMap(
  clim: Climatology | null,
  month: number,
  dayScores: number[],
): ClimScaleMap {
  const identity = new Uint8Array(101);
  for (let i = 0; i <= 100; i++) identity[i] = i;
  const buf = clim?.months.get(month);
  if (!buf || !dayScores.length) return identity;

  // đếm phân bố (thang 0..100 nên đếm trực tiếp, không cần sort)
  const climHist = new Int32Array(101);
  let nClim = 0;
  for (const v of buf)
    if (v > 0) {
      climHist[Math.min(100, v)]++;
      nClim++;
    }
  const dayHist = new Int32Array(101);
  let nDay = 0;
  for (const v of dayScores)
    if (v > 0) {
      dayHist[Math.max(0, Math.min(100, Math.round(v)))]++;
      nDay++;
    }
  if (!nClim || !nDay) return identity;

  // CDF ngày → tra ngược: phân vị p ↦ điểm ngày nhỏ nhất có CDF ≥ p
  const dayAtPct: number[] = [];
  {
    let acc = 0;
    let s = 0;
    for (let step = 0; step <= 1000; step++) {
      const p = step / 1000;
      while (s <= 100 && (acc + dayHist[s]) / nDay < p) {
        acc += dayHist[s];
        s++;
      }
      dayAtPct.push(Math.min(100, s));
    }
  }

  const out = new Uint8Array(101);
  let acc = 0;
  for (let v = 0; v <= 100; v++) {
    if (v === 0) {
      out[0] = 0; // không có số mùa vụ → vẫn không có
      continue;
    }
    // phân vị GIỮA của bậc v (nửa khoảng — tránh dồn hết về một đầu)
    const p = (acc + climHist[v] / 2) / nClim;
    acc += climHist[v];
    out[v] = climHist[v] === 0 ? out[v - 1] : dayAtPct[Math.round(p * 1000)];
  }
  // đảm bảo KHÔNG GIẢM (giữ đúng thứ tự của mùa vụ)
  for (let v = 1; v <= 100; v++) if (out[v] < out[v - 1]) out[v] = out[v - 1];
  return out;
}

/**
 * Ô lớp cá để pha — cùng hình dạng `FishCell` của lib/fish-predict (khai lại ở
 * đây để fish-blend KHÔNG phụ thuộc ngược vào fish-predict; hai bên khớp field).
 * `fromClim` = ô do BẢN MÙA VỤ sinh ra (ảnh vệ tinh hôm nay không có ô này).
 */
export interface BlendableCell {
  lat: number;
  lon: number;
  s: number;
  top: string[];
  sp: Record<string, number>;
  t: number;
  c: number | null;
  fromClim?: boolean;
}

/**
 * Pha lớp cá cho ngày thứ `dayIdx` trên HỢP (ô ảnh ∪ ô mùa vụ đủ mạnh).
 *
 * · dayIdx 0 / thiếu mùa vụ / bảng w suy biến → TRẢ NGUYÊN mảng cũ (bất biến:
 *   hôm nay không bao giờ đổi, mất nguồn thì không bịa).
 * · Ô chỉ có ở mùa vụ: điểm ảnh coi như `ABSENT_PERSIST`; ô mới được gắn
 *   `fromClim: true` để chỗ gọi phân biệt được nếu cần.
 * · Điểm từng LOÀI giữ TỈ LỆ với điểm chung (mùa vụ chỉ có một lớp chung).
 */
export function blendFishCells(
  cells: BlendableCell[],
  clim: Climatology | null,
  month: number,
  dayIdx: number,
  opts?: { gridStep?: number },
): BlendableCell[] {
  if (!cells.length || dayIdx <= 0 || !clim || !BLEND_USABLE) return cells;
  const buf = clim.months.get(month);
  if (!buf) return cells;

  const w = blendWeight(dayIdx);
  const scale = buildClimScaleMap(
    clim,
    month,
    cells.map((c) => c.s),
  );
  const { lat0, lon0, dLat, dLon, nLat, nLon } = clim.meta;
  const step = opts?.gridStep ?? (Math.abs(dLat) || 0.25);
  const key = (lat: number, lon: number) =>
    `${Math.round(lat / step)},${Math.round(lon / step)}`;

  const seen = new Set<string>();
  const out: BlendableCell[] = [];
  const rawBlend: number[] = [];

  for (const c of cells) {
    seen.add(key(c.lat, c.lon));
    const i = Math.round((c.lat - lat0) / dLat);
    const j = Math.round((c.lon - lon0) / dLon);
    const raw =
      i >= 0 && i < nLat && j >= 0 && j < nLon ? (buf[i * nLon + j] ?? 0) : 0;
    const climS = scale[Math.min(100, raw)] ?? 0;
    rawBlend.push(w * c.s + (1 - w) * climS);
    out.push(c);
  }

  // Ô CHỈ CÓ Ở MÙA VỤ — đây mới là chỗ đẻ ra VỊ TRÍ MỚI cho ngày xa
  for (let i = 0; i < nLat; i++)
    for (let j = 0; j < nLon; j++) {
      const raw = buf[i * nLon + j] ?? 0;
      if (!raw) continue;
      const lat = Math.round((lat0 + i * dLat) * 100) / 100;
      const lon = Math.round((lon0 + j * dLon) * 100) / 100;
      if (seen.has(key(lat, lon))) continue;
      const climS = scale[Math.min(100, raw)] ?? 0;
      const v = w * ABSENT_PERSIST + (1 - w) * climS;
      if (v <= 0) continue;
      rawBlend.push(v);
      out.push({ lat, lon, s: 0, sp: {}, top: [], t: 0, c: null, fromClim: true });
    }

  /* GIÃN LẠI VỀ PHÂN BỐ CỦA BẢN ĐỒ HÔM NAY.
     Trộn hai bản tương quan nhau LUÔN làm co phương sai — đo thật: để nguyên
     thì càng pha nhiều bản đồ càng NGHÈO (ô ≥40 tụt 785 → 603, hồng tâm 55 → 14
     ở mức 56 %), tức là ngược hẳn ý đồ "ngày xa phải có nội dung". Đây là
     ARTIFACT của phép trung bình, không phải điều dữ liệu muốn nói.
     Cách chữa: dùng điểm pha để XẾP HẠNG, rồi ánh xạ hạng đó trở lại ĐÚNG phân
     bố điểm của bản đồ hôm nay ⇒ số ô mỗi mức giữ nguyên như hôm nay, nhưng
     CHỖ NÀO đứng ở mức nào thì đổi theo ngày. Đánh đổi phải nhớ: bản đồ ngày xa
     trông "chắc" ngang ngày gần — độ không chắc nói bằng CHỮ trong sheet, không
     bằng cách làm nhạt bản đồ (quyết định sản phẩm 2026-07-28). */
  const target = [...cells.map((c) => c.s)].sort((a, b) => a - b);
  const order = rawBlend.map((v, i) => [v, i] as [number, number]).sort((a, b) => a[0] - b[0]);
  const n = order.length;
  for (let k = 0; k < n; k++) {
    const i = order[k][1];
    const pos = n === 1 ? target.length - 1 : Math.round((k / (n - 1)) * (target.length - 1));
    const s = Math.max(0, Math.min(100, Math.round(target[pos] ?? 0)));
    const cell = out[i];
    let sp = cell.sp;
    if (cell.sp && cell.s > 0 && s !== cell.s) {
      const kk = s / cell.s;
      sp = Object.fromEntries(
        Object.entries(cell.sp).map(([nm, v]) => [
          nm,
          Math.max(0, Math.min(100, Math.round(v * kk))),
        ]),
      );
    }
    out[i] = { ...cell, s, sp };
  }

  return out;
}

/* ── ĐỘ RỘNG "CHỖ CÁ" THEO TẦM NGÀY ──────────────────────────────────────────
   ĐO ĐƯỢC (scripts/fish-spread-probe.mjs, 16 mốc gốc × 11 tầm, 2026-07-28):
   chỗ app chỉ đích danh MỘT ô ("hồng tâm") lệch so với thực tế
       88 km (ngày 1) · 352 km (ngày 8) · 507 km (ngày 16)
   trong khi TRỌNG TÂM CỦA CỤM chỉ lệch
       62 km (ngày 1) · 214 km (ngày 8) · 249 km (ngày 16)
   ⇒ cụm ổn định gấp ~2 lần ô đơn. Chỉ đích danh một ô ở ngày xa là NÓI DỐI
   (bà con chạy tới đó có thể sai nửa nghìn cây số).

   ⚠ ĐÃ THỬ VÀ LOẠI: nở rộng vùng TÔ (dilation) — thua 0/132 phép so công bằng
   cùng diện tích, d16 mất 17,4 điểm % precision đổi lấy 7,6 recall. Bản đồ
   KHÔNG thiếu độ phủ (recall gốc đã 88–98 %), nó thiếu độ SẮC ở đỉnh. Vì vậy
   cách chữa đúng là NỚI KHOẢNG CÁCH GIỮA CÁC HỒNG TÂM (một hồng tâm = một
   VÙNG), KHÔNG phải tô loang ra. Chi tiết + số: 09 §5h.

   Hai hàm dưới đây là thuần + có test; component bản đồ chỉ việc gọi. */

/** Mốc đo: [tầm ngày, trọng tâm cụm lệch bao nhiêu km] */
const DRIFT_KM: [number, number][] = [
  [1, 62],
  [3, 119],
  [5, 150],
  [8, 214],
  [12, 233],
  [16, 249],
];
const KM_PER_DEG = 111;
/** Khoảng cách tối thiểu giữa hai hồng tâm khi xem HÔM NAY (hành vi cũ) */
export const HOTSPOT_SPACING_TODAY_DEG = 0.7;

/**
 * Hai hồng tâm phải cách nhau ít nhất bao nhiêu ĐỘ ở tầm `dayIdx` ngày.
 * Ngày 0 giữ nguyên 0,7° (không đổi gì so với trước). Ngày xa nới rộng theo
 * đúng mức lệch ĐO ĐƯỢC của trọng tâm cụm ⇒ mỗi hồng tâm đại diện một VÙNG
 * rộng bằng độ không chắc thật, thay vì một chấm giả vờ chính xác.
 */
export function hotspotSpacingDeg(dayIdx: number): number {
  const d = Math.max(0, dayIdx);
  if (d === 0) return HOTSPOT_SPACING_TODAY_DEG;
  let km = DRIFT_KM[0][1];
  if (d >= DRIFT_KM[DRIFT_KM.length - 1][0]) {
    km = DRIFT_KM[DRIFT_KM.length - 1][1];
  } else {
    for (let i = 0; i < DRIFT_KM.length - 1; i++) {
      const [d0, k0] = DRIFT_KM[i];
      const [d1, k1] = DRIFT_KM[i + 1];
      if (d <= d0) {
        km = k0;
        break;
      }
      if (d <= d1) {
        km = k0 + ((d - d0) / (d1 - d0)) * (k1 - k0);
        break;
      }
    }
  }
  return Math.max(HOTSPOT_SPACING_TODAY_DEG, km / KM_PER_DEG);
}

/** Số hồng tâm tối đa — nới khoảng cách thì phải bớt chấm, kẻo chật kín màn */
export function hotspotMaxCount(dayIdx: number): number {
  const d = Math.max(0, dayIdx);
  if (d === 0) return 8;
  if (d <= 3) return 8;
  if (d <= 8) return 6;
  return 4;
}

/* ── nạp asset (client) ───────────────────────────────────────────────────── */

let cached: Promise<Climatology | null> | null = null;

/**
 * Tải bản mùa vụ (~70 KB, cùng origin, SW pre-cache) — cache cho cả phiên.
 * KHÔNG BAO GIỜ ném: hỏng/mất mạng-chưa-cache → null → blend tự giữ bản dự báo.
 */
export function fetchClimatology(): Promise<Climatology | null> {
  if (!cached) {
    cached = fetch("/data/fish-climatology.v1.json", {
      signal: AbortSignal.timeout(15000),
    })
      .then((r) => {
        if (!r.ok) throw new Error(`climatology ${r.status}`);
        return r.json();
      })
      .then((j) => decodeClimatology(j as ClimatologyFile))
      .catch(() => null);
  }
  return cached;
}

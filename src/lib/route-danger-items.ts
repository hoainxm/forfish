/**
 * Trục 1 — CÂU CHỮ CẢNH BÁO CỦA THẺ TUYẾN (THUẦN, test được, không React).
 *
 * Tách khỏi `route-planner.tsx` ngày 2026-09-04 (Đợt 2) vì hai lẽ:
 *   · thứ tự và mức (đỏ/vàng) của cảnh báo an toàn là LUẬT, phải test được —
 *     nằm trong một `useMemo` giữa 2.400 dòng JSX thì không ai test;
 *   · có HAI nơi đọc cùng một danh sách (khối đỏ trong thân thẻ và dải một dòng
 *     ở thanh ghim đáy). Hai chỗ tự dựng lấy chữ là hai luật cảnh báo, sớm muộn
 *     cũng lệch nhau.
 *
 * Đầu vào là `RoutePlan` (cờ của thuật toán) + `RouteHit[]` (hậu kiểm
 * `auditRoute` trên kho hải đồ). Câu dài LẤY NGUYÊN `hit.cau` — câu chữ của vật
 * thể thuộc về `route-hazards`, ở đây chỉ SẮP XẾP và gắn nhãn.
 *
 * ── THỨ TỰ CỐ ĐỊNH (quyết định thiết kế 2026-09-04 §2 Đợt 2) ───────────────
 *   ĐỎ:  Sóng quá lớn · Sát ranh giới · Xác tàu/chướng ngại · Giàn khoan ·
 *        Vùng cấm · Bãi rất cạn · Đè lên bờ · Thiếu nước
 *   VÀNG: Sóng dồn đuôi · Nước nông · Chỗ cạn 2–4 m · Cáp ngầm ·
 *        Cấm neo/đánh bắt · Con nước (hai đầu đang ròng) · (lưu ý khác) ·
 *        Sát cảng gộp
 *
 * ── LUẬT SÁT CẢNG ─────────────────────────────────────────────────────────
 * `nearPortOnly` = mọi chỗ cạn/bờ trên tuyến đều nằm trong bán kính nới quanh
 * hai đầu. Ca này THAY hai mục đỏ "Bãi rất cạn" + "Đè lên bờ" bằng MỘT dòng
 * vàng: hai mục đỏ đó bật ở gần như mọi tuyến xuất phát từ cảng (cảng nằm trong
 * đất liền theo lưới thô), mà cảnh báo đỏ bật mọi lúc thì không còn là cảnh báo.
 * Đỏ chỉ dành cho hiểm hoạ thật và chỗ cạn GIỮA ĐƯỜNG.
 *
 * ## Assumptions
 * - Mỗi hàng gộp tối đa `MAX_HIT_LINES` vật rồi nói "…và N chỗ nữa": thẻ tuyến
 *   trên màn 375 px không đọc nổi 30 dòng, mà cảnh báo dài là cảnh báo không ai
 *   đọc. Chọn vật NẶNG hơn trước (đỏ trước vàng), rồi tới vật GẶP SỚM hơn.
 * - `hit.loai` lạ (kho đổi, phiên bản mới) KHÔNG bị bỏ im: nó rơi vào hàng "lưu
 *   ý khác" cuối nhóm vàng. Thà thừa một dòng còn hơn nuốt một cảnh báo.
 * - Không nhận `prefs` đơn vị: mọi khoảng cách trong các câu này do
 *   `route-hazards` viết sẵn theo mét/hải lý (thước của hải đồ), còn sóng/gió là
 *   mét và cấp — không có số nào đổi theo km/hải lý của map-prefs.
 */

import { beaufort, formatNumberVN } from "@/lib/marine-weather";
import type { RouteHit } from "@/lib/route-hazards";
import type { RoutePlan } from "@/lib/route-plan";

export type DangerItem = {
  /** khoá React ổn định — KHÔNG dùng `text` (đổi theo dữ liệu mỗi lượt tính) */
  key: string;
  /** nhãn 2–3 chữ cho dải ghim đáy (cột chỉ rộng ~271 px) */
  label: string;
  /** câu đầy đủ cho khối cảnh báo trong thân thẻ */
  text: string;
  /** true = mức ĐỎ (tô nền nguy hiểm, được ưu tiên lên dải ghim) */
  danger: boolean;
};

/** Tối đa bấy nhiêu vật một hàng, phần còn lại gộp thành "…và N chỗ nữa". */
export const MAX_HIT_LINES = 3;
/** Tối đa bấy nhiêu dòng trong khối "Trên đường sẽ gặp". */
export const MAX_WILL_MEET = 8;

const MUC_RANK: Record<RouteHit["muc"], number> = { do: 3, vang: 2, tin: 1 };

/** Vật chặn thuộc hàng "Xác tàu / chướng ngại" (giàn khoan tách riêng). */
const VAT_CHAN = new Set([
  "xac-tau",
  "chuong-ngai",
  "vat-chim",
  "phao-nguy-hiem",
  "long-be",
]);

/** `loai` của hit → khoá hàng. `null` = không lên khối cảnh báo (chỉ "sẽ gặp"). */
function hangCua(loai: string): string | null {
  if (loai === "ranh-gioi") return "ranh-gioi";
  if (VAT_CHAN.has(loai)) return "vat-chan";
  if (loai === "gian-khoan") return "gian-khoan";
  if (loai === "cam-vao" || loai === "cam-vao-ho") return "vung-cam";
  // luồng thiếu nước nói cùng chuyện với số đo sâu: không đủ nước dưới đáy
  if (loai === "do-sau" || loai === "luong") return "thieu-nuoc";
  if (loai === "cap-ong") return "cap-ong";
  if (loai === "vung-han-che") return "cam-neo";
  if (loai === "con-nuoc") return "con-nuoc"; // hai đầu tuyến đang nước ròng
  if (loai === "phao") return null; // báo hiệu chỉ để "sẽ gặp", không phải mối nguy
  return "khac";
}

/** "Km 12: " — chỗ gặp trên tuyến. Dưới 1 km thì thôi, đang ở ngay đây. */
function kmPrefix(h: RouteHit): string {
  return Number.isFinite(h.alongKm) && h.alongKm >= 1
    ? `Km ${Math.round(h.alongKm)}: `
    : "";
}

/** Nặng trước, rồi gặp sớm trước. */
function xepHit(a: RouteHit, b: RouteHit): number {
  const d = MUC_RANK[b.muc] - MUC_RANK[a.muc];
  return d !== 0 ? d : a.alongKm - b.alongKm;
}

function gopCau(hits: RouteHit[]): string {
  const xep = [...hits].sort(xepHit);
  const dau = xep.slice(0, MAX_HIT_LINES).map((h) => `${kmPrefix(h)}${h.cau}`);
  if (xep.length > MAX_HIT_LINES)
    dau.push(`…và ${xep.length - MAX_HIT_LINES} chỗ nữa cùng loại.`);
  return dau.join(" ");
}

const NHAN_HANG: Record<string, string> = {
  "ranh-gioi": "Sát ranh giới",
  "vat-chan": "Xác tàu",
  "gian-khoan": "Giàn khoan",
  "vung-cam": "Vùng cấm",
  "thieu-nuoc": "Thiếu nước",
  "cap-ong": "Cáp ngầm",
  "cam-neo": "Cấm neo",
  "con-nuoc": "Con nước",
  khac: "Lưu ý khác",
};

/**
 * Danh sách ý cảnh báo của MỘT tuyến, đúng thứ tự cố định ở đầu file.
 *
 * @param plan tuyến đã tính (cờ của thuật toán)
 * @param hits kết quả `auditRoute`; `null`/rỗng = chưa hậu kiểm được kho hải đồ
 *             — KHÔNG được đọc thành "đã soi và sạch" (`plan.hazardChecked` và
 *             dòng "chưa đối chiếu đủ" mới là chỗ nói chuyện đó)
 */
export function buildDangerItems(
  plan: RoutePlan | null,
  hits: readonly RouteHit[] | null,
): DangerItem[] {
  if (!plan) return [];
  const items: DangerItem[] = [];

  // gom hit theo hàng — chỉ mức đỏ/vàng; "tin" đi vào khối "sẽ gặp"
  const theoHang = new Map<string, RouteHit[]>();
  for (const h of hits ?? []) {
    if (!h || (h.muc !== "do" && h.muc !== "vang")) continue;
    const hang = hangCua(h.loai);
    if (!hang) continue;
    const cu = theoHang.get(hang);
    if (cu) cu.push(h);
    else theoHang.set(hang, [h]);
  }
  const hang = (key: string): DangerItem | null => {
    const hs = theoHang.get(key);
    if (!hs || hs.length === 0) return null;
    return {
      key,
      label: NHAN_HANG[key] ?? "Lưu ý khác",
      text: gopCau(hs),
      danger: hs.some((h) => h.muc === "do"),
    };
  };
  const them = (i: DangerItem | null) => {
    if (i) items.push(i);
  };

  /* ── ĐỎ ─────────────────────────────────────────────────────────────── */
  if (plan.hasRoughLeg)
    items.push({
      key: "song-du",
      danger: true,
      label: "Sóng quá lớn",
      text: `Có đoạn sóng tới ${formatNumberVN(plan.maxWaveM)} m, gió cấp ${beaufort(plan.maxWindKmh)} — mức KHÔNG NÊN ĐI với tàu nhỏ. Cân nhắc hoãn chuyến, nghe đài trước khi quyết.`,
    });
  them(hang("ranh-gioi"));

  /*  VẬT CHẶN: gộp cả cờ `hasHazardLeg` vào đây. Cờ đó nghĩa là tuyến TRẢ VỀ
      còn đi vào vòng chặn ở ngoài vùng cảng — `planRoute` chặn cứng ca này nên
      bình thường không bao giờ bật; bật là tuyến lọt lưới và bà con phải biết,
      kể cả khi hậu kiểm không kịp chỉ ra vật nào. */
  {
    const hs = theoHang.get("vat-chan") ?? [];
    if (hs.length > 0 || plan.hasHazardLeg) {
      const cau = hs.length > 0 ? gopCau(hs) : "";
      const them2 = plan.hasHazardLeg
        ? "Tuyến còn đoạn đi vào vùng chặn quanh vật chìm / giàn khoan — máy KHÔNG né được chỗ đó, khúc này phải dò hải đồ."
        : "";
      items.push({
        key: "vat-chan",
        label: NHAN_HANG["vat-chan"],
        text: [cau, them2].filter(Boolean).join(" "),
        danger: plan.hasHazardLeg || hs.some((h) => h.muc === "do"),
      });
    }
  }
  them(hang("gian-khoan"));
  them(hang("vung-cam"));

  /*  LUẬT SÁT CẢNG — hai mục đỏ này chỉ còn là đỏ khi chỗ cạn/bờ nằm GIỮA
      ĐƯỜNG. Cạn chỉ ở hai đầu thì gộp xuống một dòng vàng cuối danh sách. */
  if (plan.hasVeryShallowLeg && !plan.nearPortOnly)
    items.push({
      key: "rat-can",
      danger: true,
      label: "Bãi rất cạn",
      text: "Có đoạn đè lên vùng RẤT CẠN / bãi nổi (dưới 4 m) — chỉ vào theo con nước lên, đi chậm, hỏi người rành luồng lạch chỗ đó.",
    });
  if (plan.hasNearLandLeg && !plan.nearPortOnly)
    items.push({
      key: "de-bo",
      danger: true,
      label: "Đè lên bờ",
      text: "Tuyến có đoạn đè lên phần BỜ theo bản đồ độ sâu của máy — chỗ đó máy không vẽ chính xác được; đi theo luồng quen và hải đồ, đừng bám vạch trên màn hình.",
    });
  them(hang("thieu-nuoc"));

  /* ── VÀNG ───────────────────────────────────────────────────────────── */
  if (plan.hasFollowingSeaRisk && !plan.hasRoughLeg)
    items.push({
      key: "song-duoi",
      danger: false,
      label: "Sóng dồn đuôi",
      text: "Có đoạn sóng dồn từ phía đuôi (≥2 m, sóng ngắn) — dễ trượt sóng: tới đoạn đó giảm ga, đừng để sóng vỗ thẳng đuôi tàu.",
    });
  if (plan.hasShallowLeg)
    items.push({
      key: "nuoc-nong",
      danger: false,
      label: "Nước nông",
      text: "Tuyến có đoạn nước nông (cỡ 4–12 m) — để ý con nước, hải đồ đoạn đó.",
    });
  if (plan.hasDraftShallowLeg)
    items.push({
      key: "can-mon",
      danger: false,
      label: "Chỗ cạn 2–4 m",
      text: "Có đoạn nước chỉ cỡ 2–4 m — máy cho đi vì mớn tàu đã khai đủ nước. Sóng lên hoặc nước ròng thì thiếu nước; tới đoạn đó đi chậm, nhìn con nước.",
    });
  them(hang("cap-ong"));
  them(hang("cam-neo"));
  /*  CON NƯỚC HAI ĐẦU (2026-09-04): chỉ lên đây khi hậu kiểm thấy giờ đi/giờ
      tới rơi đúng lúc nước ròng (mức vàng) — còn lại là "tin" nằm ở khối "sẽ
      gặp". Đứng sau cáp/cấm neo vì đây là chuyện CHỜ, không phải chuyện TRÁNH. */
  them(hang("con-nuoc"));
  them(hang("khac"));

  /*  MỘT DÒNG GỘP CHO CẢ VÙNG CẢNG: cạn/bờ sát bến (`nearPortOnly`) và vật
      chặn trong 5 km quanh bến (`hasHazardNearPortLeg`) đều là cùng một sự
      thật — máy nới cho đi ở khúc bà con rành hơn máy. Nói một lần, đúng mức. */
  if (plan.nearPortOnly || plan.hasHazardNearPortLeg) {
    const canBo = plan.nearPortOnly
      ? "Đoạn đầu/cuối tuyến sát bờ, cạn"
      : "Đoạn đầu/cuối tuyến";
    const vat = plan.hasHazardNearPortLeg
      ? ", lại có vật chặn gần bến (lồng bè, đăng đáy, xác tàu cũ)"
      : "";
    items.push({
      key: "sat-cang",
      danger: false,
      label: "Sát cảng",
      text: `${canBo}${vat} — máy nới cho đi. Khúc đó tự dò luồng quen và hải đồ, đừng bám vạch trên màn hình.`,
    });
  }

  /*  MỌI Ý ĐỎ ĐỨNG TRƯỚC MỌI Ý VÀNG — dải ghim đáy chỉ in ĐÚNG MỘT nhãn, nên
      nhãn đó phải là mối nguy nặng nhất. Thứ tự trong bảng ở trên đã xếp sẵn
      theo hai nhóm, nhưng MỨC của mấy hàng dựng từ hậu kiểm phụ thuộc dữ liệu
      (luồng thiếu nước là vàng, số đo sâu thiếu nước là đỏ; `loai` lạ rơi vào
      hàng "lưu ý khác" cuối nhóm vàng nhưng có thể mang hit đỏ). Sắp ỔN ĐỊNH
      theo mức giữ nguyên thứ tự trong từng nhóm và làm hai tầng đỏ/vàng thành
      sự thật với MỌI dữ liệu, không chỉ với dữ liệu hôm nay. */
  return items.sort((a, b) => Number(b.danger) - Number(a.danger));
}

/**
 * Khối "Trên đường sẽ gặp" — hit mức `tin` theo thứ tự gặp, tối đa
 * `MAX_WILL_MEET` dòng. Không màu, không chuông: đây là thứ để ĐỐI CHIẾU mắt
 * với hải đồ, không phải mối nguy.
 */
export function buildWillMeet(hits: readonly RouteHit[] | null): string[] {
  const tin = (hits ?? [])
    .filter((h) => h && h.muc === "tin")
    .sort((a, b) => a.alongKm - b.alongKm);
  if (tin.length === 0) return [];
  const giu = tin.length > MAX_WILL_MEET ? tin.slice(0, MAX_WILL_MEET - 1) : tin;
  const out = giu.map((h) => `${kmPrefix(h)}${h.cau}`);
  if (tin.length > MAX_WILL_MEET)
    out.push(`…và ${tin.length - giu.length} chỗ nữa dọc tuyến.`);
  return out;
}

/* ── KHO NÀO CHƯA SOI ĐƯỢC ───────────────────────────────────────────────── */

/*  MÃ KHO RIÊNG CHO CHÍNH LƯỢT HẬU KIỂM (sửa 2026-09-04, review đợt 4 N1).
    `auditRoute` ném bất ngờ thì thẻ tuyến trước đây đặt `audit = null` — mà
    `null` đi vào `buildDangerItems`/`moTaThieu` y hệt "đã soi và sạch": không
    dòng hiểm hoạ nào, KHÔNG cả dòng "chưa đối chiếu". Im đúng lúc máy mù là
    kiểu nói dối nặng nhất của thẻ này. Nhánh `catch` nay để lại mã này trong
    `missing` để câu "Chưa soi được …" vẫn hiện. */
export const KHO_HAU_KIEM = "hau-kiem";

const TEN_KHO: Record<string, string> = {
  [KHO_HAU_KIEM]: "vật cản, cáp ngầm, con nước trên tuyến (hậu kiểm lỗi)",
  "xac-tau": "xác tàu, chướng ngại",
  "sea-lanes": "giàn khoan, cáp ngầm, khu cấm",
  seamarks: "phao, lồng bè",
  "hiem-hoa": "vật chặn trên đường",
  "so-do-sau": "số đo sâu",
  "doi-chieu": "đối chiếu số đo sâu",
  "thuy-trieu": "con nước",
  luong: "độ sâu luồng",
  "vn-aids": "báo hiệu hàng hải",
  "ranh-gioi": "ranh giới biển",
  "bai-can": "tên bãi cạn",
};

/**
 * MỘT câu cho khối "Tuyến này chưa đối chiếu đủ" — gộp mọi kho thiếu, giữ đúng
 * thứ tự đã ghi. `null` khi không thiếu gì (chỗ gọi không thêm dòng nào).
 *
 * Mã lạ (kho mới thêm mà quên khai tên) vẫn được nói ra bằng chính mã đó: thà
 * chữ khó hiểu còn hơn im — im là bà con tưởng đã soi hết.
 */
export function moTaThieu(missing: readonly string[] | null): string | null {
  const ten: string[] = [];
  for (const m of missing ?? []) {
    if (!m || m === "tuyen") continue;
    const t = TEN_KHO[m] ?? m;
    if (!ten.includes(t)) ten.push(t);
  }
  if (ten.length === 0) return null;
  return `Chưa soi được ${ten.join(" · ")} — phần này tuyến chưa đối chiếu, bà con tự dò hải đồ.`;
}

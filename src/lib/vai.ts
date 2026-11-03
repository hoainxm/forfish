// VAI TÀI KHOẢN (2026-11-03, spec docs/app-map/17-ba-spec-vai-tai-khoan.md) — logic THUẦN, dùng chung client/route/middleware.
//
// Trục thứ 5 cạnh account_kind (thật/thử) · role (quản trị) · tier (gói): "làm nghề gì trong chuỗi". MỘT SĐT MỘT VAI,
// người dùng tự chọn (anh Long chốt 03/11). Vai chỉ đổi GIAO DIỆN (dock, trang chủ) — không khoá dữ liệu — trừ đúng một
// chỗ: ô Bản đồ của đi bạn / thu mua / đại lý chỉ mở khi có gói (§11, anh Long: *"chủ tàu thì giữ nguyên như hiện tại,
// còn ngư dân, thu mua, đại lý mới chia premium và free"*). Chủ tàu + chưa chọn vai: bản đồ y như hôm nay.

export const VAI_IDS = ["ngu-dan", "chu-tau", "thu-mua", "dai-ly"] as const;
export type Vai = (typeof VAI_IDS)[number];

/** Bốn thẻ màn chọn vai — tên hiện cho bà con + một dòng phụ (§3.1). Thứ tự = thứ tự thẻ. */
export const VAI: readonly { id: Vai; ten: string; phu: string }[] = [
  { id: "ngu-dan", ten: "Đi bạn", phu: "Tìm tàu đi, xem giá, tin tức" },
  { id: "chu-tau", ten: "Chủ tàu", phu: "Giấy tờ, bạn thuyền, chuyến biển" },
  { id: "thu-mua", ten: "Thu mua", phu: "Tìm cá bán, đăng giá mua" },
  { id: "dai-ly", ten: "Đại lý", phu: "Bán thiết bị, vật tư" },
];

const TEN = new Map<string, string>(VAI.map((v) => [v.id, v.ten]));

export const isVai = (v: unknown): v is Vai => typeof v === "string" && TEN.has(v);
export const tenVai = (v: Vai | null | undefined): string => (v ? TEN.get(v) ?? "" : "");

/** Vai mà ô Bản đồ phải có gói mới hiện (§11). Chủ tàu + null KHÔNG nằm đây. */
const CAN_GOI_BAN_DO = new Set<Vai>(["ngu-dan", "thu-mua", "dai-ly"]);

/**
 * Vai này có được BẢN ĐỒ không. `premium` = dấu hạng hiệu lực (đã tính ân hạn — tier.effectivePremiumMark);
 * "unknown" (chưa tra xong) ⇒ coi như KHÔNG gói — dock giữ bản lần trước nhờ vai lưu máy, nên không nhấp nháy.
 */
export function coBanDo(vai: Vai | null, premium: boolean): boolean {
  if (vai === null || !CAN_GOI_BAN_DO.has(vai)) return true;
  return premium;
}

/** Cùng luật cho máy chủ (dataGate): lớp bản đồ free có bị chặn vì vai không. */
export function chanBanDoFree(vai: unknown, premium: boolean): boolean {
  return isVai(vai) && !coBanDo(vai, premium);
}

/**
 * SUY VAI cho tài khoản cũ (§3.2) — gặp điều kiện đầu tiên thì dừng. Migration 0079 chạy đúng thứ tự này bằng SQL;
 * hàm thuần để route/test dùng chung một luật.
 */
export function suyVai(a: { coShop: boolean; coThietBi: boolean; coTau: boolean; ngheKairos?: string | null }): Vai | null {
  if (a.coShop) return "dai-ly";
  if (a.coThietBi || a.coTau) return "chu-tau";
  if (a.ngheKairos === "thu-mua") return "thu-mua";
  return null;
}

/* ── VAI LƯU TRONG MÁY ───────────────────────────────────────────────────────
   Dock phải vẽ đúng ngay lúc mở app, kể cả mất sóng ⇒ vai nằm ở máy, máy chủ chỉ là bản sao.
   `cho` = đã đổi ở máy mà chưa gửi được (mất sóng) — nhịp sau gửi lại; trong lúc đó vai máy chủ trả về KHÔNG được đè. */
export const VAI_KEY = "forfish.vai.v1";
export const VAI_EVENT = "forfish:vai";

/** `sdt` = tài khoản của bản lưu — đổi tài khoản trên cùng máy thì bản của người trước không được áp. */
export type VaiMay = { sdt: string; vai: Vai | null; cho: boolean; luc: number };

/** Đọc thô → VaiMay của ĐÚNG `sdt`; hỏng / lạ / của tài khoản khác ⇒ null (chưa biết). */
export function parseVaiMay(raw: string | null, sdt: string | null): VaiMay | null {
  if (!raw || !sdt) return null;
  try {
    const o = JSON.parse(raw) as Partial<VaiMay>;
    if (o.sdt !== sdt) return null;
    if (o.vai !== null && !isVai(o.vai)) return null;
    return { sdt, vai: o.vai ?? null, cho: o.cho === true, luc: typeof o.luc === "number" ? o.luc : 0 };
  } catch {
    return null;
  }
}

/**
 * Máy chủ vừa trả vai — có nên ghi đè bản máy không. Bản máy đang chờ gửi (`cho`) thì KHÔNG: người dùng vừa đổi lúc
 * mất sóng, ghi đè là xoá lựa chọn của họ. Giá trị lạ từ máy chủ ⇒ bỏ qua (thà cũ còn hơn sai).
 */
export function nenNhanVaiMayChu(may: VaiMay | null, tuMayChu: unknown): boolean {
  if (tuMayChu !== null && !isVai(tuMayChu)) return false;
  if (may?.cho) return false;
  return may === null || may.vai !== tuMayChu;
}

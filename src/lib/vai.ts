// VAI TÀI KHOẢN (2026-11-03, spec docs/app-map/17-ba-spec-vai-tai-khoan.md) — logic THUẦN, dùng chung client/route/middleware.
//
// Trục thứ 5 cạnh account_kind (thật/thử) · role (quản trị) · tier (gói): "làm nghề gì trong chuỗi". MỘT SĐT MỘT VAI,
// người dùng tự chọn MỘT LẦN (anh Long chốt 03/11). Vai chỉ đổi GIAO DIỆN (dock, trang chủ) — không khoá dữ liệu — trừ đúng một
// chỗ: ô Bản đồ của đi bạn / thu mua / đại lý chỉ mở khi có gói (§11, anh Long: *"chủ tàu thì giữ nguyên như hiện tại,
// còn ngư dân, thu mua, đại lý mới chia premium và free"*). Chủ tàu + chưa chọn vai: bản đồ y như hôm nay.

import { NHAN, TEN_GOI } from "./labels";

export const VAI_IDS =["ngu-dan", "chu-tau", "thu-mua", "dai-ly"] as const;
export type Vai = (typeof VAI_IDS)[number];

/** Bốn thẻ màn chọn vai — tên hiện cho bà con + một dòng phụ (§3.1). Thứ tự = thứ tự thẻ. */
export const VAI: readonly { id: Vai; ten: string; phu: string }[] = [
  { id: "ngu-dan", ten: "Đi bạn", phu: "Tìm tàu đi, xem giá, tin tức" },
  { id: "chu-tau", ten: "Chủ tàu", phu: "Giấy tờ, bạn thuyền, chuyến biển" },
  { id: "thu-mua", ten: "Thu mua", phu: "Tìm cá bán, đăng giá mua" },
  { id: "dai-ly", ten: "Đại lý", phu: "Bán thiết bị, vật tư" },
];

const TEN = new Map<string, string>(VAI.map((v) => [v.id, v.ten]));

/*
  CHỌN VAI NÀY THÌ ĐƯỢC GÌ (anh Long 06/11: *"ghi rõ luôn dựa trên acc vô họ chọn cái đó thì sẽ xem dc gì, list nhanh
  tính năng ngắn gọn theo tab thôi, ví dụ bạn thuyền thì giúp tạo hồ sơ rồi kiếm việc trên các tàu"*). Một dòng mỗi ô
  dock của vai đó, đúng thứ tự dock (bỏ Trang chủ — vai nào cũng có). `o` = tên ô dock (NHAN) — test vai khoá: mọi `o`
  phải là ô có thật trong dockTheoVai(vai, true), nên dock đổi mà quên sửa ở đây là đỏ. `goi` = ô chỉ có khi có gói (§11)
  — tài khoản CHƯA có gói: dòng đó vẫn hiện nhưng MỜ + chữ đậm "Quan tâm bản đồ? Bà con dùng gói dự báo, liên hệ SDVICO để nâng cấp" (anh Long 06/11, câu nhẹ nhàng: "bôi
  … cái bản đồ để họ ko chọn nhầm, ở đi bạn thì ghi rõ muốn xem bản đồ thì dùng bản pre" — tên gói hiển thị là TEN_GOI,
  không dùng chữ Premium); dùng `tinhNangHien`, đừng đọc thẳng bảng.
*/
export type TinhNangVai = { o: string; viec: string; goi?: true };
export const TINH_NANG_VAI: Record<Vai, readonly TinhNangVai[]> = {
  "ngu-dan": [
    { o: NHAN.kairos, viec: "Tin tức, chính sách" },
    { o: NHAN.banDo, viec: "Dự báo cá", goi: true },
    { o: NHAN.viecLam, viec: "Tạo hồ sơ, tìm tàu" },
    { o: NHAN.choCa, viec: "Giá cá, tin mua bán" },
    { o: NHAN.vatTu, viec: "Mua đồ đi biển" },
  ],
  "chu-tau": [
    { o: NHAN.kairos, viec: "Tin tức, chính sách" },
    { o: NHAN.banDo, viec: "Thời tiết, tin bão" },
    { o: NHAN.tauToi, viec: "Giấy tờ, bạn thuyền" },
    { o: NHAN.choCa, viec: "Giá cá, đăng bán" },
    { o: NHAN.vatTu, viec: "Mua vật tư, thiết bị" },
  ],
  "thu-mua": [
    { o: NHAN.kairos, viec: "Tin tức, chính sách" },
    { o: NHAN.banDo, viec: "Dự báo cá", goi: true },
    { o: NHAN.choCa, viec: "Tìm cá, đăng giá mua" },
    { o: NHAN.vatTu, viec: "Mua vật tư, thiết bị" },
  ],
  "dai-ly": [
    { o: NHAN.kairos, viec: "Tin tức, chính sách" },
    { o: NHAN.banDo, viec: "Dự báo cá", goi: true },
    { o: NHAN.banHang, viec: "Đăng hàng, nhận đơn" },
    { o: NHAN.vatTu, viec: "Xem chợ vật tư" },
  ],
};

/** Dòng thẻ vai sau khi xét gói. `khoa` = ô cần gói mà tài khoản chưa có — vẽ mờ, chữ việc đổi thành lời mời dùng gói. */
export type TinhNangHien = { o: string; viec: string; khoa: boolean };

/** Các dòng thẻ vai cho tài khoản này: chưa có gói ⇒ ô cần gói vẫn có dòng nhưng `khoa` (dock sẽ không có ô đó). */
export function tinhNangHien(vai: Vai, coGoi: boolean): readonly TinhNangHien[] {
  return TINH_NANG_VAI[vai].map((t) => {
    const khoa = !!t.goi && !coGoi;
    return { o: t.o, viec: khoa ? `Quan tâm ${t.o.toLowerCase()}? Bà con dùng ${TEN_GOI}, liên hệ SDVICO để nâng cấp` : t.viec, khoa };
  });
}

/*
  VAI BÀ CON TỰ CHỌN ĐƯỢC (anh Long 04/11: *"thu mua và đại lý ko cho tự chọn nhé, phải do admin quản trị duyệt, ko cần
  cho hiện ra lúc chọn ban đầu đâu"*). Màn /chon-vai chỉ hiện hai thẻ này; Thu mua + Đại lý do nhân viên gán ở /quan-tri
  (Đại lý cũng lên khi nhân viên DUYỆT gian hàng — admin/cho/shops). `PUT /api/me/vai` chặn hai vai kia (409 `can_duyet`).
*/
const VAI_TU_CHON = new Set<Vai>(["ngu-dan", "chu-tau"]);
export const tuChonDuoc = (v: Vai): boolean => VAI_TU_CHON.has(v);
/**
 * Thẻ của màn chọn vai — chỉ vai tự chọn được, CHỦ TÀU LÊN THẺ 1 (anh Long 09/11: *"chỗ chọn vai lựa chọn 1 là chủ tàu,
 * thay vì bạn tàu như hiện tại"*). Thứ tự này KHÁC thứ tự `VAI` (bảng quản trị / chip vẫn theo VAI).
 */
const THU_TU_CHON: readonly Vai[] = ["chu-tau", "ngu-dan"];
export const VAI_CHON = THU_TU_CHON.map((id) => VAI.find((v) => v.id === id)!);

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

/*
  KHOÁ VAI (anh Long 03/11: *"tính năng đổi vai là ko cho đổi sau khi đã đk tránh dữ liệu bị rối, ngư dân + tàu = chủ
  tàu, cửa hàng và thu mua độc lập, ko đổi vai đc"*). Vai chọn MỘT LẦN; sau đó chỉ một đường đi tiếp: Đi bạn có tàu
  trong sổ ⇒ Chủ tàu (tự lên, không hỏi). Đại lý và Thu mua đứng riêng, không đổi sang vai nào. Sửa vai chọn nhầm là
  việc của nhân viên (/quan-tri), không phải của app.
*/
export type LyDoKhoaVai = "da_co_vai" | "chua_co_tau" | "can_duyet";

/** Đổi từ `hienTai` sang `moi` có được không. null = được; còn lại là lý do từ chối (route trả 409 kèm mã này). */
export function lyDoKhongDoiVai(hienTai: Vai | null, moi: Vai, coTau: boolean): LyDoKhoaVai | null {
  if (hienTai === moi) return null;
  if (!tuChonDuoc(moi)) return "can_duyet"; // Thu mua / Đại lý: chỉ nhân viên gán
  if (hienTai === null) return null;
  if (hienTai === "ngu-dan" && moi === "chu-tau") return coTau ? null : "chua_co_tau";
  return "da_co_vai";
}

/** Có tàu trong sổ mà đang là Đi bạn (hoặc chưa chọn vai) ⇒ lên Chủ tàu — "ngư dân + tàu = chủ tàu". Đại lý, Thu mua
 *  có tàu cũng KHÔNG đổi (độc lập). */
export const nenLenChuTau = (vai: Vai | null, soTau: number): boolean => (vai === "ngu-dan" || vai === null) && soTau > 0;

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

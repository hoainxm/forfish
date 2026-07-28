// Cảnh báo thuyền viên chéo giữa chủ tàu — logic THUẦN (dùng chung
// client/server, test được). Nền: một chủ tàu sau chuyến biển báo cáo vấn đề
// của thuyền viên (định danh bằng CCCD); chủ tàu khác nhập CCCD trước khi thuê
// sẽ thấy cảnh báo ĐÃ ĐƯỢC KIỂM DUYỆT.
//
// Chống lạm dụng (chốt với chủ dự án 2026-07-27):
// · report phải qua DUYỆT (admin) mới hiện cho người khác — 'pending' im lặng
// · người bị ghi được PHẢN HỒI (qua admin, v1) — đính chính đi kèm cảnh báo
// · CHỈ premium mới tra/báo cáo; người báo ẨN với người tra (admin mới thấy)
// · khoá tra là HASH(CCCD) → muốn tra phải BIẾT CCCD, không dò/duyệt được danh sách
//
// Ghi/đọc kho chia sẻ CHỈ qua service-role (API route) — bảng bật RLS không
// policy client (migration 0007, giống fish_forecast_snapshot).

export type CrewReportCategory =
  | "bo_tau"
  | "trom_cap"
  | "gay_roi"
  | "chat_kich_thich"
  | "no_ung"
  | "khac";

export const CREW_REPORT_CATEGORY_LABELS: Record<CrewReportCategory, string> = {
  bo_tau: "Bỏ tàu giữa chuyến / phá hợp đồng",
  trom_cap: "Trộm cắp tài sản",
  gay_roi: "Đánh nhau, gây rối",
  chat_kich_thich: "Rượu chè, chất kích thích",
  no_ung: "Ứng tiền rồi trốn",
  khac: "Vấn đề khác",
};

export const CREW_REPORT_CATEGORIES = Object.keys(
  CREW_REPORT_CATEGORY_LABELS,
) as CrewReportCategory[];

export function isCrewReportCategory(v: unknown): v is CrewReportCategory {
  return typeof v === "string" && v in CREW_REPORT_CATEGORY_LABELS;
}

export function crewReportCategoryLabel(v: string): string {
  return isCrewReportCategory(v) ? CREW_REPORT_CATEGORY_LABELS[v] : "Vấn đề khác";
}

export type CrewReportStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "withdrawn";

/** Một cảnh báo ĐÃ DUYỆT trả về cho người TRA — KHÔNG lộ danh tính người báo. */
export interface CrewReportPublic {
  id: string;
  category: CrewReportCategory;
  detail: string | null;
  /** tên tàu người báo (tuỳ chọn) — bối cảnh, không phải danh tính cá nhân */
  reporterBoat: string | null;
  createdAt: string;
  /** phản hồi/đính chính của người bị ghi (qua admin) nếu có */
  subjectResponse: string | null;
  subjectRespondedAt: string | null;
}

/** Kết quả tra một CCCD: mấy cảnh báo đã duyệt + mức độ tổng. */
export interface CrewLookupResult {
  /** đã tra xong (đã hash + hỏi kho) — phân biệt "chưa tra" với "tra rồi, sạch" */
  checked: boolean;
  count: number;
  reports: CrewReportPublic[];
}

/** Nhãn tổng quan cho một kết quả tra — dùng tô màu banner. */
export function lookupLevel(r: CrewLookupResult): "danger" | "ok" {
  return r.count > 0 ? "danger" : "ok";
}

/** Giới hạn độ dài mô tả để tránh spam/nhồi dữ liệu. */
export const CREW_REPORT_DETAIL_MAX = 500;

/** Chuẩn hoá + cắt mô tả người dùng nhập (bỏ khoảng trắng thừa, cắt tối đa). */
export function cleanReportDetail(raw: string | null | undefined): string {
  return (raw ?? "").trim().slice(0, CREW_REPORT_DETAIL_MAX);
}

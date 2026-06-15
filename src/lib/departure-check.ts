// CHECKLIST XUẤT BẾN theo Lmax (B1, roadmap 01-product §7 / 06-jtbd nhóm E) —
// đèn xanh-đỏ "đủ điều kiện xuất bến chưa". Phân vùng + giấy tờ bắt buộc theo
// CHIỀU DÀI TÀU (NĐ 26/2019 Đ.42–43, TT 22/2018) — THAM KHẢO, không thay
// cơ quan đăng kiểm/biên phòng. App tự kiểm phần ĐỌC ĐƯỢC (hạn giấy tờ trong
// tủ + bảo hiểm thuyền viên trong sổ); phần KHÔNG thấy được (tín hiệu VMS, sổ
// danh bạ giấy) chỉ NHẮC bà con tự kiểm, KHÔNG tự gật đèn xanh.

import { getExpiryStatus, type BoatDocument, type DocumentKind } from "@/lib/documents";
import type { CrewMember } from "@/lib/crew";

export type CheckStatus =
  | "ok"
  | "soon" // sắp hết hạn (≤30 ngày)
  | "expired" // đã quá hạn
  | "missing" // chưa có trong sổ
  | "manual"; // app không kiểm được — bà con tự xác nhận

export interface CheckItem {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  /** app tự đọc được từ dữ liệu (gật đèn) hay chỉ nhắc tự kiểm */
  auto: boolean;
}

export type Readiness = "green" | "yellow" | "red";

export interface DepartureCheck {
  /** mô tả cỡ tàu + vùng hoạt động */
  groupLabel: string;
  zone: string;
  items: CheckItem[];
  /** đèn — CHỈ tính trên item app tự kiểm được */
  readiness: Readiness;
  redCount: number;
  soonCount: number;
}

export function boatZone(lengthM: number): { zone: string; groupLabel: string } {
  if (lengthM < 12)
    return { zone: "ven bờ", groupLabel: "Tàu ven bờ (dưới 12m)" };
  if (lengthM < 15)
    return { zone: "lộng", groupLabel: "Tàu vùng lộng (12 – dưới 15m)" };
  return { zone: "khơi", groupLabel: "Tàu vùng khơi (15m trở lên)" };
}

function docStatus(
  documents: BoatDocument[],
  kind: DocumentKind,
  today: Date,
): { status: CheckStatus; detail: string } {
  const doc = documents.find((d) => d.kind === kind);
  if (!doc) return { status: "missing", detail: "Chưa có trong tủ giấy tờ" };
  const ex = getExpiryStatus(doc, today);
  if (ex.level === "expired")
    return { status: "expired", detail: ex.label };
  if (ex.level === "soon") return { status: "soon", detail: ex.label };
  return { status: "ok", detail: doc.expiresOn ? ex.label : "Còn hiệu lực" };
}

export function departureCheck(args: {
  lengthM: number;
  documents: BoatDocument[];
  crew: CrewMember[];
  today: Date;
}): DepartureCheck {
  const { lengthM, documents, crew, today } = args;
  const { zone, groupLabel } = boatZone(lengthM);
  const items: CheckItem[] = [];

  // Giấy phép khai thác — tàu ≥6m
  if (lengthM >= 6) {
    const s = docStatus(documents, "giay_phep_khai_thac", today);
    items.push({
      id: "giay_phep",
      label: "Giấy phép khai thác thủy sản",
      auto: true,
      ...s,
    });
  }

  // Đăng kiểm — tàu ≥12m
  if (lengthM >= 12) {
    const s = docStatus(documents, "dang_kiem", today);
    items.push({ id: "dang_kiem", label: "Đăng kiểm tàu cá", auto: true, ...s });
  }

  // Chứng nhận ATTP — tàu ≥15m
  if (lengthM >= 15) {
    const s = docStatus(documents, "an_toan_thuc_pham", today);
    items.push({
      id: "attp",
      label: "Chứng nhận an toàn thực phẩm",
      auto: true,
      ...s,
    });
  }

  // Chứng chỉ thuyền trưởng/máy trưởng — tàu ≥12m
  if (lengthM >= 12) {
    const s = docStatus(documents, "chung_chi_thuyen_truong", today);
    items.push({
      id: "chung_chi",
      label: "Chứng chỉ thuyền trưởng / máy trưởng",
      auto: true,
      ...s,
    });
  }

  // Bảo hiểm thuyền viên — đọc từ sổ thuyền viên
  if (crew.length > 0) {
    const noIns = crew.filter((m) => !m.hasInsurance);
    if (noIns.length > 0) {
      items.push({
        id: "bao_hiem_tv",
        label: "Bảo hiểm thuyền viên",
        auto: true,
        status: "missing",
        detail: `${noIns.length} người chưa có bảo hiểm`,
      });
    } else {
      items.push({
        id: "bao_hiem_tv",
        label: "Bảo hiểm thuyền viên",
        auto: true,
        status: "ok",
        detail: `Đủ bảo hiểm cho ${crew.length} người`,
      });
    }
  } else {
    items.push({
      id: "bao_hiem_tv",
      label: "Bảo hiểm thuyền viên",
      auto: false,
      status: "manual",
      detail: "Chưa có thuyền viên trong sổ — tự kiểm khi chốt người",
    });
  }

  // VMS giám sát hành trình — tàu ≥15m, app KHÔNG thấy tín hiệu
  if (lengthM >= 15) {
    items.push({
      id: "vms",
      label: "Thiết bị giám sát hành trình (VMS)",
      auto: false,
      status: "manual",
      detail: "Tự kiểm máy còn báo tín hiệu — app không thấy được",
    });
  }

  // Sổ danh bạ thuyền viên — tàu ≥12m, bản giấy khớp người thực
  if (lengthM >= 12) {
    items.push({
      id: "so_danh_ba",
      label: "Sổ danh bạ thuyền viên khớp người thực",
      auto: false,
      status: "manual",
      detail: "Tự kiểm danh sách khớp người lên tàu chuyến này",
    });
  }

  // Đèn — chỉ tính trên item app tự kiểm được
  const auto = items.filter((i) => i.auto);
  const redCount = auto.filter(
    (i) => i.status === "expired" || i.status === "missing",
  ).length;
  const soonCount = auto.filter((i) => i.status === "soon").length;
  const readiness: Readiness =
    redCount > 0 ? "red" : soonCount > 0 ? "yellow" : "green";

  return { groupLabel, zone, items, readiness, redCount, soonCount };
}

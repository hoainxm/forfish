// KAIROS — DÒNG PHỤ + SỐ HIỆU TÀU TỪ SỔ TÀU ĐỒNG BỘ (14 §3.7, AC12). THUẦN.
//
// Máy chủ không có cột "cảng nhà": cảng nhà nằm trong sổ tàu bà con (forfish.boats.v1) mà
// /api/me/sync đã gương lên `user_docs` (kind='boats'). Lấy TÀU ĐẦU TIÊN còn sống (bỏ bản đã
// xoá `_deleted`) — đúng tàu mà app coi là mặc định. Không có sổ / không có cảng ⇒ "" (thẻ
// vẫn hiện, chỉ thiếu dòng phụ). Số hiệu tàu (`maTau`) CHỈ trả khi chủ bật show_boat — bên
// gọi (dto.authorDto) kiểm cờ đó.

import { isDeleted } from "@/lib/sync-tombstone";
import { sublineFor } from "./ten-goi";

export interface BoatExtra {
  subline: string;
  boatReg: string | null;
}

/**
 * `data` = cột user_docs.data (mảng Boat); `portName(id)` tra danh mục fishing-ports;
 * `businessName` = tên cơ sở bên mua (market_listings) — dòng phụ khi không có cảng nhà.
 */
export function boatExtra(data: unknown, portName: (id: string) => string | null, businessName?: string | null): BoatExtra {
  const boats = Array.isArray(data) ? data.filter((b) => b && typeof b === "object" && !isDeleted(b)) : [];
  const b = boats[0] as { homePortId?: unknown; maTau?: unknown } | undefined;
  const portId = typeof b?.homePortId === "string" ? b.homePortId : null;
  const reg = typeof b?.maTau === "string" ? b.maTau.trim().slice(0, 30) : "";
  return {
    subline: sublineFor({ portName: portId ? portName(portId) : null, businessName }),
    boatReg: reg || null,
  };
}

// Đa tàu — 1 chủ tàu có thể có NHIỀU tàu. Mọi dữ liệu (giấy tờ, thuyền viên,
// sản phẩm) gắn theo `boatId` của tàu đang chọn. Lưu local (chưa đăng nhập);
// khi có auth + Supabase sẽ đồng bộ theo owner_id.

export interface Boat {
  id: string;
  name: string;        // tên gọi tàu
  maTau?: string;      // mã/số đăng ký tàu (vd "BV-1234-TS")
  homeProvince?: string; // tỉnh cảng nhà (lọc "gần tôi")
  homePortId?: string;   // cảng hay cập (id trong fishing-ports)
  lengthM?: number;      // chiều dài Lmax (m) — chi phối quy định
}

const BOATS_KEY = "forfish.boats.v1";
const CURRENT_KEY = "forfish.currentBoat.v1";

export function loadBoats(): Boat[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(BOATS_KEY);
    if (raw) {
      const list = JSON.parse(raw) as Boat[];
      if (Array.isArray(list) && list.length) return list;
    }
  } catch {
    /* ignore */
  }
  // KHÔNG seed tàu mẫu — user tự thêm tàu thật (data giả dùng chung gây hiểu
  // nhầm; mọi chức năng tàu nay khóa sau đăng nhập, xem BoatSwitcher).
  return [];
}

export function saveBoats(boats: Boat[]) {
  try {
    window.localStorage.setItem(BOATS_KEY, JSON.stringify(boats));
  } catch {
    /* ignore */
  }
}

export function loadCurrentBoatId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(CURRENT_KEY);
  } catch {
    return null;
  }
}

export function saveCurrentBoatId(id: string) {
  try {
    window.localStorage.setItem(CURRENT_KEY, id);
  } catch {
    /* ignore */
  }
}

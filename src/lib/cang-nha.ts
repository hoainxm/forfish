// CẢNG NHÀ — MỘT CỬA ĐỌC + MỘT CỬA GHI (2026-10-29, rà hành trình A-02/A-06).
//
// Trước đây "cảng nhà" nằm rải ở nhiều kho không nói chuyện với nhau: nói với Sen Biển
// "cảng nhà tôi là Tam Quan" ghi vào `forfish.home.v1`, còn thẻ Biển hôm nay / Con nước
// chỉ đọc điểm ghim + hồ sơ tàu ⇒ thẻ không hiện. Nay MỌI chỗ đọc đi qua `docCangNha`,
// MỌI chỗ đặt đi qua `datCangNha`.
//
// Thứ tự đọc (đọc LÙI mọi kho cũ — không mất cảng bà con đã chọn, không xoá khoá,
// không bump phiên bản):
//   1. điểm ghim kind "home" (`forfish.places.v1` — /cang "Đặt cảng nhà", ghim bản đồ)
//   2. `forfish.home.v1` .portId (Sen Biển "đặt cảng nhà là …" trước 2026-10-29)
//   3. `homePortId` của tàu đang chọn (`forfish.boats.v1`, dữ liệu cũ/SDWork)
//   4. Kairos `forfish.kairos.thoiquen.v1` .home.port (nút "Cảng nhà" ở Bến)
// `forfish.port.v1` (cảng dự báo đã chọn) KHÔNG phải cảng nhà — sea-today-card tự lùi về nó.
//
// Ghi: `datCangNha(portId)` ghi CẢ (1) và (2) để hai kho không lệch nữa. Hồ sơ Kairos
// trên máy chủ (`about.homePort`) là hồ sơ công khai, không thuộc kho này.

import { FISHING_PORTS } from "@/data/fishing-ports";
import { PORTS } from "@/data/ports";
import { loadBoats, loadCurrentBoatId } from "@/lib/boats";
import { homeOf, loadPlaces, persistPlaces, placeId, upsertPlace } from "@/lib/places";
import { loadHome, saveHome } from "@/lib/region";

/** = `HABIT_KEY` của lib/kairos/thoi-quen — viết lại chuỗi để Trang chủ không kéo cả bộ chủ đề/khu vực
 *  Kairos vào bundle chỉ vì một khoá; cang-nha.test gác hai chuỗi bằng nhau. */
export const KAIROS_HABIT_KEY = "forfish.kairos.thoiquen.v1";

export type CangNha = {
  name: string;
  lat: number;
  lon: number;
  /** id trong danh mục cảng (fishing-ports / ports) khi tra ra được */
  portId?: string;
  province?: string;
};

type CangDanhMuc = { id: string; name: string; province?: string; lat: number; lon: number };

/** Tra cảng theo id: danh bạ cảng cá (FISHING_PORTS, có toạ độ) trước, rồi cảng dự báo (PORTS). */
export function cangTheoId(id: string | null | undefined): CangDanhMuc | null {
  if (!id) return null;
  const f = FISHING_PORTS.find((p) => p.id === id);
  if (f && Number.isFinite(f.lat) && Number.isFinite(f.lng)) {
    return { id: f.id, name: f.name, province: f.province, lat: f.lat as number, lon: f.lng as number };
  }
  const p = PORTS.find((x) => x.id === id);
  return p ? { id: p.id, name: p.name, province: p.province, lat: p.lat, lon: p.lon } : null;
}

/** Cảng trong danh mục trùng toạ độ điểm ghim (cùng phép làm tròn của placeId). */
function cangTaiToaDo(lat: number, lon: number): CangDanhMuc | null {
  const id = placeId(lat, lon);
  const f = FISHING_PORTS.find((p) => p.lat != null && p.lng != null && placeId(p.lat, p.lng) === id);
  if (f) return cangTheoId(f.id);
  const p = PORTS.find((x) => placeId(x.lat, x.lon) === id);
  return p ? cangTheoId(p.id) : null;
}

const tuDanhMuc = (c: CangDanhMuc): CangNha => ({
  name: c.name,
  lat: c.lat,
  lon: c.lon,
  portId: c.id,
  ...(c.province ? { province: c.province } : {}),
});

function portCuaKairos(): string | null {
  try {
    const raw = window.localStorage.getItem(KAIROS_HABIT_KEY);
    if (!raw) return null;
    const port = (JSON.parse(raw) as { home?: { port?: unknown } } | null)?.home?.port;
    return typeof port === "string" ? port : null;
  } catch {
    return null;
  }
}

/** Cảng nhà theo thứ tự ở đầu file; null = chưa khai ở đâu cả. Không bao giờ ném. */
export function docCangNha(): CangNha | null {
  if (typeof window === "undefined") return null;
  try {
    const ghim = homeOf(loadPlaces());
    if (ghim) {
      const c = cangTaiToaDo(ghim.lat, ghim.lon);
      return {
        name: ghim.name,
        lat: ghim.lat,
        lon: ghim.lon,
        ...(c ? { portId: c.id, ...(c.province ? { province: c.province } : {}) } : {}),
      };
    }
  } catch {
    /* sổ ghim hỏng ⇒ lùi xuống kho sau */
  }
  const tuHome = cangTheoId(loadHome().portId);
  if (tuHome) return tuDanhMuc(tuHome);
  try {
    const boats = loadBoats();
    const cur = loadCurrentBoatId();
    const boat = boats.find((b) => b.id === cur) ?? boats[0];
    const tuTau = cangTheoId(boat?.homePortId);
    if (tuTau) return tuDanhMuc(tuTau);
  } catch {
    /* sổ tàu hỏng ⇒ lùi tiếp */
  }
  const tuKairos = cangTheoId(portCuaKairos());
  return tuKairos ? tuDanhMuc(tuKairos) : null;
}

/**
 * Đặt cảng nhà = ghi điểm ghim "home" (hạ cảng nhà cũ thành điểm thường) + `forfish.home.v1`.
 * Trả `false` khi KHÔNG giữ được — id lạ, sổ ghim đọc hỏng (khoá ghi, K4) hoặc máy hết chỗ;
 * chỗ gọi phải nói ra, đừng im. Ghi ghim trước: ghim là kho đọc đầu tiên, nếu nó hỏng mà
 * vẫn báo "xong" thì cảng cũ trong ghim sẽ che cảng mới.
 */
export function datCangNha(portId: string): boolean {
  const c = cangTheoId(portId);
  if (!c) return false;
  const next = upsertPlace(loadPlaces(), { name: c.name, lat: c.lat, lon: c.lon, asHome: true });
  if (!persistPlaces(next)) return false;
  return saveHome({ ...loadHome(), portId: c.id, ...(c.province ? { province: c.province } : {}) });
}

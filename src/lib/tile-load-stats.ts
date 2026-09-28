/**
 * ĐO TIẾN ĐỘ TẢI Ô BẢN ĐỒ THEO NGUỒN — công cụ kiểm tra cho người phát triển
 * (bật bằng `?debug=tiles` trên /ngu-truong, xem components/tile-load-debug).
 *
 * Trả lời câu "mở lớp X thì bản đồ đã tải/hiển thị được bao nhiêu %": mỗi
 * nguồn (basemap, ocean-data = lớp ảnh đang chọn, …) đếm các ô MapLibre đang
 * giữ theo trạng thái — xong / đang tải / lỗi. % = ô xong ÷ tổng ô.
 *
 * Đọc `map.style.tileManagers` — API NỘI BỘ của MapLibre (5.x; bản 4.x tên là
 * `sourceCaches`). Không có API công khai đếm ô theo trạng thái; `areTilesLoaded`
 * chỉ trả đúng/sai. Nên hàm đọc phòng thủ: sai hình thì trả mảng rỗng, không ném.
 * // nợ: phụ thuộc tên nội bộ MapLibre, nâng cấp khi MapLibre đổi tên/thêm API đếm ô công khai
 */

export type TileTally = {
  source: string;
  total: number;
  loaded: number;
  loading: number;
  errored: number;
  /** 0–100, làm tròn; nguồn chưa có ô nào = null (chưa biết, không phải 0%) */
  pct: number | null;
};

type TileLike = { state?: string };
type ManagerLike = {
  getIds?: () => string[];
  getTileByID?: (id: string) => TileLike | undefined;
};
type MapLike = {
  style?: {
    tileManagers?: Record<string, ManagerLike>;
    sourceCaches?: Record<string, ManagerLike>;
  };
};

/** Gộp trạng thái ô của một nguồn. "reloading"/"expired" vẫn đang hiển thị ảnh cũ ⇒ tính là xong. */
export function tallyStates(source: string, states: string[]): TileTally {
  let loaded = 0;
  let loading = 0;
  let errored = 0;
  for (const s of states) {
    if (s === "loaded" || s === "reloading" || s === "expired") loaded++;
    else if (s === "errored") errored++;
    else if (s === "loading") loading++;
    // "unloaded" = ô đã bỏ khỏi khung nhìn, không đếm
  }
  const total = loaded + loading + errored;
  return {
    source,
    total,
    loaded,
    loading,
    errored,
    pct: total ? Math.round((loaded / total) * 100) : null,
  };
}

/** Đọc trạng thái ô mọi nguồn dạng ô (raster/vector) của bản đồ đang chạy. */
export function readTileTallies(map: unknown): TileTally[] {
  const style = (map as MapLike | null)?.style;
  const managers = style?.tileManagers ?? style?.sourceCaches;
  if (!managers || typeof managers !== "object") return [];
  const out: TileTally[] = [];
  for (const [source, m] of Object.entries(managers)) {
    if (typeof m?.getIds !== "function" || typeof m.getTileByID !== "function") continue;
    const states = m
      .getIds()
      .map((id) => m.getTileByID!(id)?.state)
      .filter((s): s is string => typeof s === "string");
    // geojson cũng có tileManager nhưng ô sinh tại chỗ — vẫn đếm, lỗi ở đó cũng đáng thấy
    out.push(tallyStates(source, states));
  }
  return out;
}

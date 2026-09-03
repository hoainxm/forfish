/**
 * CHỈ MỤC KHÔNG GIAN TRONG MÁY — tầng truy xuất cho lớp hải đồ.
 *
 * Hôm nay bản đồ chỉ biết VẼ: dữ liệu rạn/đá/phao/bãi cạn nằm trong máy dưới
 * dạng GeoJSON, MapLibre vẽ ra rồi thôi. App KHÔNG trả lời được câu bà con hỏi:
 *
 *   · "Quanh tôi 5 hải lý có gì nguy hiểm?"       → queryRadius
 *   · "Phao đèn gần nhất là cái nào?"             → queryNearest
 *   · "Đường tôi định đi có sát vật cản nào không?" → queryCorridor
 *
 * File này là MỘT CƠ CHẾ, không phải một tính năng: nó không biết rạn là gì,
 * không fetch, không đụng React. Chỗ gọi đưa vào danh sách điểm bất kỳ (báo
 * hiệu từ `seamarks.ts`, hiểm hoạ từ `reef-shapes.v1.json`, cảng, điểm ghim của
 * bà con) và nhận về câu trả lời kèm KHOẢNG CÁCH THẬT. Nhờ vậy một chỉ mục
 * dùng cho mọi lớp, không nhân bản luật tìm kiếm ở từng màn.
 *
 * ── VÌ SAO LƯỚI Ô, KHÔNG PHẢI R-TREE HAY GEOHASH ─────────────────────────
 * Ba ứng viên đều giải được bài này. Chọn lưới ô vì bài toán CỤ THỂ ở đây:
 *  · Dữ liệu TĨNH (asset đóng gói lúc build), nạp một lần, không chèn/xoá lúc
 *    chạy. Ưu thế của R-tree là chèn/xoá động và dữ liệu phân bố lệch — ta
 *    không dùng tới cái nào. Đổi lại R-tree cần tách nút, chọn trục, ~150 dòng
 *    và một cây con trỏ (nặng bộ nhớ, xấu với bộ dọn rác của máy yếu).
 *  · Geohash mã hoá thành CHUỖI rồi tìm theo tiền tố. Nó sinh ra một việc thừa
 *    (nối chuỗi, so sánh chuỗi) và một cái bẫy thật: hai điểm cạnh nhau có thể
 *    khác tiền tố ở mọi ký tự (qua mép ô lớn), nên vẫn phải tự tính 8 ô lân
 *    cận — đúng việc mà lưới ô làm thẳng bằng số học.
 *  · Vùng biển VN là một khung chữ nhật NHỎ và dữ liệu rải khá đều trên biển.
 *    Đây là ca lý tưởng của lưới ô: tra ô là hai phép chia, không đuổi con trỏ.
 * Chốt: LƯỚI Ô, xếp theo kiểu CSR (một mảng số nguyên phẳng, không phải mảng
 * của mảng) — dựng O(n), không sinh hàng nghìn mảng con cho bộ dọn rác. Đo thật
 * ở `src/lib/__tests__/spatial-index.test.ts`.
 *
 * ── ĐỘ SÂU THÌ KHÔNG QUA ĐÂY ─────────────────────────────────────────────
 * Câu "tuyến của tôi có cắt chỗ cạn dưới 4 m nào không" KHÔNG dùng chỉ mục này:
 * chỗ cạn không phải một danh sách điểm mà là một trường liên tục, đã có
 * `depth-grid.ts` tra O(1) theo toạ độ. Lấy mẫu dọc tuyến bằng `pathPoints` ở
 * dưới rồi hỏi `depthClassAt` là xong — đừng nhét lưới độ sâu vào đây.
 */

import { haversineKm, type LatLon } from "@/lib/route-plan";

/** Một kết quả: đối tượng + khoảng cách thật tới nó (km). */
export type Hit<T> = { item: T; km: number };

/**
 * Kết quả tra dọc tuyến. `alongKm` = đã chạy bao xa kể từ điểm xuất phát thì
 * tới chỗ gần đối tượng nhất — đủ để màn hình nói "còn 12 hải lý nữa mới tới".
 */
export type PathHit<T> = Hit<T> & { alongKm: number };

/** Lấy toạ độ của một phần tử. */
export type PosFn<T> = (item: T) => LatLon;

/**
 * Chỉ mục đã dựng. Các trường là chi tiết bên trong — đọc để soi/để test, đừng
 * sửa. Toạ độ được SAO ra hai mảng số thực phẳng ngay lúc dựng: mọi truy vấn
 * sau đó không gọi lại `PosFn`, không chạm object nào cho tới khi đã chắc chắn
 * có kết quả (quan trọng trên máy yếu — vòng lọc chỉ đọc số).
 */
export type SpatialIndex<T> = {
  readonly items: readonly T[];
  /** Cạnh ô, độ. */
  readonly cellDeg: number;
  readonly latMin: number;
  readonly lonMin: number;
  readonly nLat: number;
  readonly nLon: number;
  /** CSR: phần tử của ô k nằm ở `order[start[k] .. start[k+1]-1]` */
  readonly start: Int32Array;
  readonly order: Int32Array;
  readonly lats: Float64Array;
  readonly lons: Float64Array;
  /** Số điểm THẬT SỰ vào chỉ mục (đã bỏ toạ độ hỏng). */
  readonly count: number;
};

/**
 * Một độ vĩ = bao nhiêu km — LẤY ĐÚNG QUẢ CẦU CỦA `haversineKm` (R = 6371 km),
 * KHÔNG lấy 111,32 của ellipsoid.
 *
 * VÌ SAO CHÍNH XÁC ĐẾN THẾ MỚI ĐƯỢC (lỗi thật, test quét cạn bắt: 936 ≠ 937):
 * hộp lọc thô đổi bán kính km ra ĐỘ, còn phép loại cuối cùng là `haversineKm`.
 * Hai bên dùng hai bán kính Trái Đất khác nhau thì hộp HẸP hơn hình tròn thật
 * khoảng một phần nghìn — và một phần nghìn đó đủ để nuốt mất một cái phao nằm
 * sát mép. Sai kiểu này KHÔNG BAO GIỜ tự lộ: danh sách trả về vẫn dài, vẫn hợp
 * lý, chỉ thiếu đúng cái xa nhất. Với lớp hiểm hoạ thì "cái xa nhất" hôm nay là
 * "cái tàu đâm vào" ngày mai.
 * Quy tắc rút ra, ghi lại cho người sau: HỘP LỌC THÔ PHẢI DÙNG CHUNG MỘT MÔ
 * HÌNH TRÁI ĐẤT VỚI PHÉP ĐO CHÍNH XÁC, và còn phải nới thêm một chút (BOX_SLACK).
 */
const KM_PER_DEG_LAT = (Math.PI / 180) * 6371;
/**
 * Nới hộp lọc thô thêm 0,1%. Hai lý do, cả hai đều là "thà xét thừa":
 *  · sai số dấu phẩy động khi đổi độ ↔ km ↔ radian;
 *  · chặn kinh độ suy ra từ bất đẳng thức haversine chỉ đúng tới số hạng bậc
 *    hai — với chặng dưới ~600 km thì sai lệch < 0,04%.
 * Giá phải trả: vài phần nghìn ứng viên thừa, và chúng bị `haversineKm` loại
 * chính xác ngay sau đó. Giá của việc KHÔNG nới: bỏ sót im lặng.
 */
const BOX_SLACK = 1.001;
const rad = (d: number) => (d * Math.PI) / 180;
/** Một độ kinh ≈ bao nhiêu km ở vĩ độ `lat`. Cận cực thì co về 0 — chặn sàn để
 *  không chia cho 0 (vùng biển VN không tới đó, nhưng hàm này là hàng dùng chung). */
const kmPerDegLon = (lat: number) =>
  Math.max(1e-6, KM_PER_DEG_LAT * Math.cos(rad(lat)));

/**
 * Một độ kinh dài NGẮN NHẤT trong dải vĩ độ `lat ± padDeg` — dùng để nới hộp
 * lọc thô ra cho AN TOÀN.
 *
 * VÌ SAO PHẢI CÓ (lỗi thật, test quét cạn bắt được: chỉ mục ra 936 trong khi
 * quét cạn ra 937): độ kinh CO LẠI khi đi về phía cực. Lấy `kmPerDegLon` ngay
 * tại tâm rồi đổi bán kính km ra độ thì hộp lọc HẸP HƠN thực tế đối với những
 * điểm nằm về phía cực so với tâm — chúng cách tâm đúng trong bán kính mà vẫn
 * bị loại ở bước lọc thô, và loại IM LẶNG. Với lớp hiểm hoạ thì đó là một hòn
 * đá ngầm biến mất khỏi câu trả lời "quanh tôi có gì nguy hiểm".
 * Lấy độ dài NGẮN NHẤT trong dải ⇒ hộp luôn RỘNG HƠN cần thiết ⇒ sai lệch
 * nghiêng về phía xét thừa (rồi haversine loại chính xác), không bao giờ về
 * phía bỏ sót.
 */
const minKmPerDegLon = (lat: number, padDeg: number) =>
  kmPerDegLon(Math.min(89.9, Math.abs(lat) + Math.max(0, padDeg)));

/** Số ô tối đa — chặn ca dữ liệu một điểm mà khung rộng, đừng cấp phát oan. */
const MAX_CELLS = 1 << 20;
/** Mỗi ô nhắm trung bình bấy nhiêu phần tử: đủ thưa để lọc nhanh, đủ dày để
 *  một truy vấn bán kính nhỏ không phải quét hàng chục ô rỗng. */
const TARGET_PER_CELL = 4;

/**
 * Dựng chỉ mục. Điểm có toạ độ hỏng (NaN, ngoài −90..90 / −180..180) bị BỎ QUA
 * chứ không ném: một dòng dữ liệu lỗi không được làm mất cả lớp báo hiệu của
 * chuyến biển (cùng lối với `decodeSeamarks`). `count` cho biết còn lại bao
 * nhiêu, chỗ gọi muốn cảnh báo thì so với `items.length`.
 *
 * @param cellDeg cạnh ô (độ). Bỏ trống thì tự chọn theo mật độ dữ liệu.
 */
export function buildIndex<T>(
  items: readonly T[],
  pos: PosFn<T>,
  opts: { cellDeg?: number } = {},
): SpatialIndex<T> {
  const n = items.length;
  const lats = new Float64Array(n);
  const lons = new Float64Array(n);
  const ok = new Uint8Array(n);

  let latMin = Infinity;
  let latMax = -Infinity;
  let lonMin = Infinity;
  let lonMax = -Infinity;
  let count = 0;

  for (let i = 0; i < n; i++) {
    let p: LatLon;
    try {
      p = pos(items[i]);
    } catch {
      continue; // phần tử dị dạng — bỏ nó, giữ cả lớp
    }
    const la = p?.lat;
    const lo = p?.lon;
    if (
      !Number.isFinite(la) ||
      !Number.isFinite(lo) ||
      la < -90 ||
      la > 90 ||
      lo < -180 ||
      lo > 180
    )
      continue;
    lats[i] = la;
    lons[i] = lo;
    ok[i] = 1;
    count++;
    if (la < latMin) latMin = la;
    if (la > latMax) latMax = la;
    if (lo < lonMin) lonMin = lo;
    if (lo > lonMax) lonMax = lo;
  }

  if (count === 0) {
    return {
      items,
      cellDeg: 1,
      latMin: 0,
      lonMin: 0,
      nLat: 1,
      nLon: 1,
      start: new Int32Array(2),
      order: new Int32Array(0),
      lats,
      lons,
      count: 0,
    };
  }

  const spanLat = Math.max(latMax - latMin, 1e-6);
  const spanLon = Math.max(lonMax - lonMin, 1e-6);
  let cellDeg = opts.cellDeg;
  if (!Number.isFinite(cellDeg) || (cellDeg ?? 0) <= 0) {
    // ô vuông sao cho trung bình TARGET_PER_CELL phần tử một ô
    cellDeg = Math.sqrt((spanLat * spanLon * TARGET_PER_CELL) / count);
  }
  cellDeg = Math.max(cellDeg as number, 1e-6);

  let nLat = Math.floor(spanLat / cellDeg) + 1;
  let nLon = Math.floor(spanLon / cellDeg) + 1;
  // Khung rộng + dữ liệu thưa (một chùm điểm ở góc) có thể ra hàng triệu ô rỗng
  // — nới ô cho tới khi vừa trần, thà quét thêm vài phần tử còn hơn cấp phát oan.
  while (nLat * nLon > MAX_CELLS) {
    cellDeg *= 2;
    nLat = Math.floor(spanLat / cellDeg) + 1;
    nLon = Math.floor(spanLon / cellDeg) + 1;
  }

  const nCells = nLat * nLon;
  const start = new Int32Array(nCells + 1);
  const cellOf = new Int32Array(n).fill(-1);

  for (let i = 0; i < n; i++) {
    if (!ok[i]) continue;
    const r = Math.min(nLat - 1, Math.floor((lats[i] - latMin) / cellDeg));
    const c = Math.min(nLon - 1, Math.floor((lons[i] - lonMin) / cellDeg));
    const k = r * nLon + c;
    cellOf[i] = k;
    start[k + 1]++;
  }
  for (let k = 0; k < nCells; k++) start[k + 1] += start[k];

  const order = new Int32Array(count);
  const cursor = Int32Array.from(start.subarray(0, nCells));
  for (let i = 0; i < n; i++) {
    const k = cellOf[i];
    if (k >= 0) order[cursor[k]++] = i;
  }

  return {
    items,
    cellDeg,
    latMin,
    lonMin,
    nLat,
    nLon,
    start,
    order,
    lats,
    lons,
    count,
  };
}

/** Chỉ số hàng/cột của một toạ độ, đã kẹp vào trong lưới. */
function rowOf<T>(ix: SpatialIndex<T>, lat: number): number {
  const r = Math.floor((lat - ix.latMin) / ix.cellDeg);
  return r < 0 ? -1 : r >= ix.nLat ? ix.nLat : r;
}
function colOf<T>(ix: SpatialIndex<T>, lon: number): number {
  const c = Math.floor((lon - ix.lonMin) / ix.cellDeg);
  return c < 0 ? -1 : c >= ix.nLon ? ix.nLon : c;
}

/**
 * Mọi đối tượng trong bán kính `radiusKm` quanh `center`, SẮP THEO GẦN TRƯỚC.
 *
 * "Quanh tôi 5 hải lý có gì nguy hiểm?" → `queryRadius(hazards, me, 5 * 1.852)`.
 *
 * Bán kính không hợp lệ (âm, NaN) trả mảng rỗng — KHÔNG ném và KHÔNG âm thầm
 * đổi thành một bán kính khác: màn hình hỏi sai thì phải thấy "không có gì",
 * chứ không được nhận một câu trả lời bịa cho một câu hỏi khác.
 */
export function queryRadius<T>(
  ix: SpatialIndex<T>,
  center: LatLon,
  radiusKm: number,
  /** lọc thêm (loại, mức nguy hiểm…) — chạy TRƯỚC khi tính khoảng cách chính xác */
  where?: (item: T) => boolean,
): Hit<T>[] {
  const out: Hit<T>[] = [];
  if (
    ix.count === 0 ||
    !Number.isFinite(radiusKm) ||
    radiusKm <= 0 ||
    !Number.isFinite(center?.lat) ||
    !Number.isFinite(center?.lon)
  )
    return out;

  const dLat = (radiusKm * BOX_SLACK) / KM_PER_DEG_LAT;
  const dLon = (radiusKm * BOX_SLACK) / minKmPerDegLon(center.lat, dLat);
  const r0 = Math.max(0, rowOf(ix, center.lat - dLat));
  const r1 = Math.min(ix.nLat - 1, rowOf(ix, center.lat + dLat));
  const c0 = Math.max(0, colOf(ix, center.lon - dLon));
  const c1 = Math.min(ix.nLon - 1, colOf(ix, center.lon + dLon));

  for (let r = r0; r <= r1; r++) {
    const base = r * ix.nLon;
    for (let c = c0; c <= c1; c++) {
      const k = base + c;
      for (let s = ix.start[k]; s < ix.start[k + 1]; s++) {
        const i = ix.order[s];
        // loại nhanh bằng hộp chữ nhật trước khi làm lượng giác
        if (Math.abs(ix.lats[i] - center.lat) > dLat) continue;
        if (Math.abs(ix.lons[i] - center.lon) > dLon) continue;
        if (where && !where(ix.items[i])) continue;
        const km = haversineKm(center, { lat: ix.lats[i], lon: ix.lons[i] });
        if (km <= radiusKm) out.push({ item: ix.items[i], km });
      }
    }
  }
  out.sort((a, b) => a.km - b.km);
  return out;
}

/**
 * `k` đối tượng gần `center` nhất (mặc định 1), gần trước.
 *
 * "Phao đèn gần nhất tên gì?" → `queryNearest(seamarkIndex, me)`.
 * "Cảng tránh trú gần nhất?"  → `queryNearest(portIndex, me, 3)` rồi chỗ gọi
 * tự đổi km ra giờ chạy theo tốc độ tàu (việc đó thuộc `route-plan`, không
 * thuộc chỉ mục).
 *
 * Nở vòng ô ra dần rồi DỪNG khi vòng kế tiếp không thể chứa gì gần hơn —
 * không quét cả lưới. `maxKm` chặn ca "tìm mãi không thấy" (không có phao nào
 * trong vùng): quá bán kính đó thì trả về những gì đã có.
 */
export function queryNearest<T>(
  ix: SpatialIndex<T>,
  center: LatLon,
  k = 1,
  maxKm = Infinity,
  where?: (item: T) => boolean,
): Hit<T>[] {
  if (
    ix.count === 0 ||
    k <= 0 ||
    !Number.isFinite(center?.lat) ||
    !Number.isFinite(center?.lon)
  )
    return [];

  // Nở vòng từ Ô GẦN TÂM NHẤT — tâm nằm ngoài lưới (bà con ở rìa vùng dữ liệu)
  // thì vẫn phải bắt đầu từ mép, không phải từ một ô không tồn tại.
  const r = Math.min(ix.nLat - 1, Math.max(0, rowOf(ix, center.lat)));
  const c = Math.min(ix.nLon - 1, Math.max(0, colOf(ix, center.lon)));
  const best: Hit<T>[] = [];
  const maxRing = Math.max(ix.nLat, ix.nLon);

  for (let ring = 0; ring <= maxRing; ring++) {
    /*  Khoảng cách NHỎ NHẤT có thể có ở vòng `ring` trở ra: mọi ô của vòng đó
        cách tâm ít nhất (ring−1) ô. Đủ kết quả VÀ vòng tới không thể gần hơn
        cái xa nhất đang giữ ⇒ dừng. Đây là chỗ khiến hàm này không phải quét
        toàn lưới, nên đừng "đơn giản hoá" nó đi. */
    // km/độ NHỎ NHẤT trong tầm với của vòng này ⇒ chặn dưới AN TOÀN, không bao
    // giờ dừng sớm hơn mức được phép (cùng lý do minKmPerDegLon ở trên).
    const ringFloorKm = (rings: number) =>
      (rings *
        ix.cellDeg *
        Math.min(
          KM_PER_DEG_LAT,
          minKmPerDegLon(center.lat, (rings + 1) * ix.cellDeg),
        )) /
      BOX_SLACK;
    if (ring > 0 && best.length >= k) {
      if (ringFloorKm(ring - 1) > best[best.length - 1].km) break;
    }
    /*  Vòng này đã xa hơn trần cho phép ⇒ dừng, kể cả khi CHƯA tìm được gì.
        Không có vế này thì "quanh đây 5 hải lý không có phao nào" phải quét
        hết lưới mới dám trả lời — đúng ca hay gặp nhất giữa khơi. */
    if (ring > 0 && ringFloorKm(ring - 1) > maxKm) break;

    for (let rr = r - ring; rr <= r + ring; rr++) {
      if (rr < 0 || rr >= ix.nLat) continue;
      const onLatEdge = rr === r - ring || rr === r + ring;
      for (let cc = c - ring; cc <= c + ring; cc++) {
        if (cc < 0 || cc >= ix.nLon) continue;
        // chỉ VIỀN của vòng — bên trong đã quét ở các vòng trước
        if (!onLatEdge && cc !== c - ring && cc !== c + ring) continue;
        const cell = rr * ix.nLon + cc;
        for (let s = ix.start[cell]; s < ix.start[cell + 1]; s++) {
          const i = ix.order[s];
          if (where && !where(ix.items[i])) continue;
          const km = haversineKm(center, { lat: ix.lats[i], lon: ix.lons[i] });
          if (km > maxKm) continue;
          best.push({ item: ix.items[i], km });
        }
      }
    }
    if (best.length > 1) best.sort((a, b) => a.km - b.km);
    if (best.length > k) best.length = k;
    // vòng đã trùm hết lưới ⇒ không còn ô nào để nở ra nữa
    if (r - ring <= 0 && c - ring <= 0 && r + ring >= ix.nLat - 1 && c + ring >= ix.nLon - 1)
      break;
  }
  return best;
}

/**
 * Mọi đối tượng nằm trong hành lang rộng `widthKm` (mỗi bên) dọc theo `path`.
 *
 * "Đường tôi định đi có sát vật cản nào không?" → đưa vào chính chuỗi điểm của
 * tuyến. Kết quả kèm `alongKm` (đã chạy bao xa thì tới đó) nên màn hình xếp
 * được theo thứ tự GẶP, không phải theo thứ tự gần.
 *
 * Mỗi đối tượng chỉ ra MỘT LẦN, lấy lần áp sát nhất — tuyến gấp khúc quay lại
 * gần một hòn đá hai lần thì bà con vẫn chỉ thấy một cảnh báo.
 */
export function queryCorridor<T>(
  ix: SpatialIndex<T>,
  path: readonly LatLon[],
  widthKm: number,
  where?: (item: T) => boolean,
): PathHit<T>[] {
  if (ix.count === 0 || !Number.isFinite(widthKm) || widthKm <= 0) return [];
  const pts = path.filter(
    (p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lon),
  );
  if (pts.length === 0) return [];
  if (pts.length === 1)
    return queryRadius(ix, pts[0], widthKm, where).map((h) => ({
      ...h,
      alongKm: 0,
    }));

  /*  Chống trùng bằng chính bảng kết quả (khoá = chỉ số phần tử): một đối tượng
      có thể rơi vào hành lang của HAI chặng liên tiếp, và ta muốn lần ÁP SÁT
      NHẤT. Không dựng thêm mảng cờ — bảng này vốn đã phải có. */
  const found = new Map<number, PathHit<T>>();

  let travelled = 0;
  for (let s = 0; s + 1 < pts.length; s++) {
    const a = pts[s];
    const b = pts[s + 1];
    const segKm = haversineKm(a, b);

    const latPad = (widthKm * BOX_SLACK) / KM_PER_DEG_LAT;
    const latLo = Math.min(a.lat, b.lat) - latPad;
    const latHi = Math.max(a.lat, b.lat) + latPad;
    // lấy mút XA XÍCH ĐẠO NHẤT của chặng để hộp nới đủ rộng (xem minKmPerDegLon)
    const farLat = Math.max(Math.abs(a.lat), Math.abs(b.lat));
    const lonPad = (widthKm * BOX_SLACK) / minKmPerDegLon(farLat, latPad);
    const lonLo = Math.min(a.lon, b.lon) - lonPad;
    const lonHi = Math.max(a.lon, b.lon) + lonPad;

    const r0 = Math.max(0, rowOf(ix, latLo));
    const r1 = Math.min(ix.nLat - 1, rowOf(ix, latHi));
    const c0 = Math.max(0, colOf(ix, lonLo));
    const c1 = Math.min(ix.nLon - 1, colOf(ix, lonHi));

    for (let r = r0; r <= r1; r++) {
      const base = r * ix.nLon;
      for (let c = c0; c <= c1; c++) {
        const cell = base + c;
        for (let t = ix.start[cell]; t < ix.start[cell + 1]; t++) {
          const i = ix.order[t];
          const la = ix.lats[i];
          const lo = ix.lons[i];
          if (la < latLo || la > latHi || lo < lonLo || lo > lonHi) continue;
          if (where && !where(ix.items[i])) continue;
          const d = distToSegment({ lat: la, lon: lo }, a, b);
          if (d.km > widthKm) continue;
          const hit: PathHit<T> = {
            item: ix.items[i],
            km: d.km,
            alongKm: travelled + d.alongKm,
          };
          const prev = found.get(i);
          if (!prev || hit.km < prev.km) found.set(i, hit);
        }
      }
    }
    travelled += segKm;
  }

  const out = [...found.values()];
  out.sort((x, y) => x.alongKm - y.alongKm);
  return out;
}

/**
 * Khoảng cách từ điểm `p` tới đoạn thẳng a→b, và đã đi bao xa dọc đoạn thì tới
 * chỗ áp sát nhất.
 *
 * Chiếu về mặt phẳng km lấy vĩ độ giữa đoạn làm gốc (equirectangular cục bộ).
 * Với chặng vài chục km trong vùng biển VN, sai số dưới một phần nghìn — nhỏ
 * hơn nhiều so với sai số của chính dữ liệu rạn (~33 m). Không dùng công thức
 * cầu đầy đủ vì hàm này chạy vài nghìn lượt cho một tuyến.
 */
export function distToSegment(
  p: LatLon,
  a: LatLon,
  b: LatLon,
): { km: number; alongKm: number } {
  const kx = kmPerDegLon((a.lat + b.lat) / 2);
  const ax = a.lon * kx;
  const ay = a.lat * KM_PER_DEG_LAT;
  const bx = b.lon * kx;
  const by = b.lat * KM_PER_DEG_LAT;
  const px = p.lon * kx;
  const py = p.lat * KM_PER_DEG_LAT;

  const dx = bx - ax;
  const dy = by - ay;
  const den = dx * dx + dy * dy;
  let t = den === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / den;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return {
    km: Math.hypot(px - cx, py - cy),
    alongKm: t * Math.sqrt(den),
  };
}

/**
 * Rải điểm dọc một tuyến, cách nhau tối đa `stepKm`.
 *
 * Dùng cho thứ KHÔNG phải danh sách điểm mà là một trường liên tục — độ sâu.
 * "Tuyến này có cắt chỗ cạn dưới 4 m nào không" = rải điểm ở đây rồi hỏi
 * `depthClassAt` từng điểm. Bước lấy mẫu PHẢI nhỏ hơn ô của trường đang hỏi,
 * không thì bãi cạn lọt qua khe giữa hai mẫu — đúng bài học `WEATHER_SAMPLE_KM`
 * của `route-plan.ts`. Ô lưới độ sâu là ~450 m, nên `stepKm` ≤ 0,4.
 */
export function pathPoints(
  path: readonly LatLon[],
  stepKm: number,
): LatLon[] {
  const pts = path.filter(
    (p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lon),
  );
  if (pts.length === 0 || !Number.isFinite(stepKm) || stepKm <= 0) return [];
  const out: LatLon[] = [pts[0]];
  for (let s = 0; s + 1 < pts.length; s++) {
    const a = pts[s];
    const b = pts[s + 1];
    const km = haversineKm(a, b);
    const n = Math.max(1, Math.ceil(km / stepKm));
    for (let i = 1; i <= n; i++) {
      out.push({
        lat: a.lat + ((b.lat - a.lat) * i) / n,
        lon: a.lon + ((b.lon - a.lon) * i) / n,
      });
    }
  }
  return out;
}

/*  nợ: chỉ mục KHÔNG xử lý vòng qua kinh tuyến 180° — khung dữ liệu của app là
    102–118°Đ nên không đụng. Nâng cấp khi nào: nếu có ngày app phục vụ vùng
    biển vắt qua 180° (Thái Bình Dương), phải cắt truy vấn thành hai dải kinh độ
    trong `queryRadius`/`queryCorridor` thay vì kẹp thẳng như hiện nay. */

// Geofence ranh giới biển — tính khoảng cách từ vị trí tàu tới đường ranh giới
// biển VN và mức cảnh báo. Logic thuần, không phụ thuộc bản đồ (test được).
//
// Mục tiêu: chống lỗi IUU nặng nhất — vượt ranh giới sang vùng biển nước ngoài.
// Ta KHÔNG khẳng định "đã vượt" (cần đa giác kín + bên chính xác); chỉ báo
// KHOẢNG CÁCH tới ranh giới + cảnh báo khi tới gần. Trung thực hơn, an toàn hơn.

import { type LngLat } from "@/data/vn-maritime-border";
import vmsZonesJson from "@/data/vms-zones.json";

/*  BIÊN THẬT = MÉP NGOÀI CỦA VÙNG VMS (chủ dự án chốt 2026-08-25: *"mép ngoài
    của 3 vùng"*).
    ÁN LỆ — vì sao phải đổi: 2026-07-28 đường 75 điểm `VN_MARITIME_BORDER` bị GỠ
    KHỎI BẢN ĐỒ (biên mới = 3 vùng VMS), nhưng `borderProximity` vẫn đo theo nó.
    Chú thích lúc đó ghi "cảnh báo khoảng cách tới ranh giới không bị ảnh hưởng"
    — SAI. Suốt gần một tháng app đo tới một đường KHÔNG CÒN VẼ Ở ĐÂU, nên số
    hải lý không khớp đường bà con nhìn thấy. Bà con bắt được ngay khi đường đo
    được vẽ ra: *"cái tính khoảng cách đang ko gắn vào đường ranh nè"*.
    Bài học: gỡ phần VẼ của một dữ liệu thì phải soi lại MỌI phép tính đang dùng
    dữ liệu đó — không được kết luận "không ảnh hưởng" bằng cảm giác.

    · `VN_OUTER_BORDER`  — cung ngoài khơi (200 điểm) ĐANG ĐƯỢC VẼ đỏ nét đứt
      (`allowedOffshore`, zone `default-allowed-offshore`). Đây là thứ bà con
      NHÌN THẤY, nên là thứ phải đo tới.
    · `VN_ALLOWED_POLYS` — đa giác vùng được phép (`allowed`), dùng để biết điểm
      nằm TRONG hay NGOÀI biên. Có đa giác kín rồi thì mới dám nói "đã ra ngoài";
      trước đây cố ý không nói vì chỉ có một đường hở. */
export const VN_OUTER_BORDER: LngLat[] = (
  vmsZonesJson.allowedOffshore.features[0].geometry.coordinates as number[][]
).map((c) => [c[0], c[1]] as LngLat);

/**
 * Vùng được phép, GIỮ NGUYÊN cấu trúc MultiPolygon: mỗi phần tử là MỘT polygon,
 * gồm vòng ngoài + các lỗ.
 *
 * ⚠️ ÁN LỆ — ĐỪNG TRỘN PHẲNG (2026-08-25). Bản đầu `flatMap` mọi vòng của mọi
 * polygon vào một mảng rồi chạy chẵn-lẻ chung. Sai: điểm nằm trong HAI polygon
 * khác nhau bị đếm hai lần ⇒ chẵn ⇒ hoá "ở ngoài". Đo thật trên 10 cảng cá:
 * **Thọ Quang (Đà Nẵng) và Vũng Tàu bị báo "ĐÃ NGOÀI ranh giới"** — cảng cá
 * Việt Nam mà app bảo đã ra khỏi vùng biển Việt Nam. Chẵn-lẻ chỉ đúng TRONG
 * một polygon (để lỗ đảo tự lật ngược); giữa các polygon phải là HOẶC.
 */
export const VN_ALLOWED_POLYS: LngLat[][][] = (
  vmsZonesJson.allowed.features[0].geometry.coordinates as number[][][][]
).map((poly) => poly.map((ring) => ring.map((c) => [c[0], c[1]] as LngLat)));

const NM_PER_KM = 1 / 1.852;

export type BorderLevel = "ok" | "near" | "very_near";

export interface BorderProximity {
  /**  CÓ NÊN NÓI GÌ VỀ RANH GIỚI Ở ĐIỂM NÀY KHÔNG.
   *   false = điểm không nằm trên mặt biển thuộc phạm vi biên (trong bờ, trong
   *   vịnh kín, hay đất liền) ⇒ mọi thứ liên quan ranh giới phải ẨN: dòng chữ,
   *   đường đo, nhãn. Xem `applies` trong thân hàm để biết luật.
   *   Khi false thì `level` luôn `"ok"` và `label` rỗng — caller nào quên kiểm
   *   `applies` cũng chỉ im lặng, KHÔNG bao giờ hét cảnh báo sai. */
  applies: boolean;
  /** điểm này nằm NGOÀI vùng được phép chưa (true = đã qua biên) */
  outside: boolean;
  /** khoảng cách ngắn nhất tới ranh giới, hải lý */
  distanceNm: number;
  level: BorderLevel;
  label: string;
  /** điểm gần nhất trên ranh giới [lng, lat] — để vẽ/định hướng */
  nearest: LngLat;
}

// Ngưỡng cảnh báo (hải lý). Tàu cá chạy ~7–10 hải lý/giờ → 6 hải lý ~ 40 phút.
const VERY_NEAR_NM = 6;
const NEAR_NM = 15;

/**
 * MỐC NÓI LẠI khi đang DẪN ĐƯỜNG theo GPS (2026-08-18, audit M3): vào 15 hải
 * lý nói một lần, rồi CHỈ nói lại khi vượt sang mốc gần hơn (10 → 6 → 3), không
 * lặp mỗi giây theo nhịp GPS. Từ 6 hải lý trở vào (VERY_NEAR_NM) dòng cảnh báo
 * không thu được.
 */
export const BORDER_STEPS_NM = [NEAR_NM, 10, VERY_NEAR_NM, 3] as const;

/**
 * Mốc hiện tại theo khoảng cách: mốc NHỎ NHẤT mà distance ≤ mốc; null khi còn
 * xa hơn 15 hải lý. THUẦN, có test.
 */
export function borderStepFor(distanceNm: number): number | null {
  if (!Number.isFinite(distanceNm)) return null;
  let step: number | null = null;
  for (const s of BORDER_STEPS_NM) if (distanceNm <= s) step = s;
  return step;
}

/**
 * Có phải vừa VƯỢT SANG MỐC GẦN HƠN không — chỗ duy nhất quyết "nói lại".
 * `prev` = mốc đã nói lần trước (null = chưa nói / đang ở ngoài 15 hải lý).
 * Trả về mốc mới nếu đáng nói, null nếu im (đứng yên trong mốc, hoặc đang đi
 * ra xa — đi ra xa thì caller cập nhật prev = borderStepFor(d) trong im lặng để
 * lần quay lại gần vẫn được nhắc).
 */
export function borderStepCrossed(
  distanceNm: number,
  prev: number | null,
): number | null {
  const step = borderStepFor(distanceNm);
  if (step == null) return null;
  if (prev == null || step < prev) return step;
  return null;
}

/**
 * Nguồn hình dùng cho cảnh báo ranh giới.
 *  · `line`  — ĐƯỜNG BIỂN, thứ duy nhất được dùng để ĐO khoảng cách. Không bao
 *    giờ lấy đoạn bờ: bà con dặn *"biên chỉ áp dụng với đường biển thôi"*.
 *  · `polys` — vùng kín, chỉ dùng để biết TRONG hay NGOÀI.
 */
export interface BorderSource {
  line: LngLat[];
  polys: LngLat[][][];
}

/** Nguồn mặc định = dữ liệu tĩnh SDVico gửi kèm app. */
export const STATIC_BORDER_SOURCE: BorderSource = {
  line: VN_OUTER_BORDER,
  polys: VN_ALLOWED_POLYS,
};

/** Vùng admin nạp — chỉ cần đúng hai trường này, KHÔNG import type VmsZone để
    geofence khỏi phụ thuộc ngược vào tầng dữ liệu. */
export interface BorderZoneLike {
  isBorder: boolean;
  geojson: GeoJSON.FeatureCollection;
}

/**
 * Dựng nguồn biên từ các vùng ADMIN đã đánh dấu `isBorder` (migration 0038).
 * Hai nửa LÙI ĐỘC LẬP: không có đường biển nào được đánh dấu thì đường lấy từ
 * dữ liệu tĩnh, không có vùng kín nào thì vùng kín lấy từ dữ liệu tĩnh. Nhờ vậy
 * admin đánh dấu nửa vời cũng không làm cảnh báo im hoặc hoá dại.
 */
export function borderFromZones(zones: BorderZoneLike[] | null): BorderSource {
  if (!zones || zones.length === 0) return STATIC_BORDER_SOURCE;
  const line: LngLat[] = [];
  const polys: LngLat[][][] = [];
  for (const z of zones) {
    if (!z.isBorder) continue;
    for (const f of z.geojson?.features ?? []) {
      const g = f.geometry;
      if (!g) continue;
      if (g.type === "LineString") {
        line.push(...(g.coordinates as number[][]).map((c) => [c[0], c[1]] as LngLat));
      } else if (g.type === "MultiLineString") {
        for (const l of g.coordinates as number[][][])
          line.push(...l.map((c) => [c[0], c[1]] as LngLat));
      } else if (g.type === "Polygon") {
        polys.push((g.coordinates as number[][][]).map((r) => r.map((c) => [c[0], c[1]] as LngLat)));
      } else if (g.type === "MultiPolygon") {
        for (const poly of g.coordinates as number[][][][])
          polys.push(poly.map((r) => r.map((c) => [c[0], c[1]] as LngLat)));
      }
    }
  }
  return {
    line: line.length >= 2 ? line : VN_OUTER_BORDER,
    polys: polys.length > 0 ? polys : VN_ALLOWED_POLYS,
  };
}

/** Haversine — km giữa hai điểm (lat,lng độ). */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Khoảng cách ngắn nhất (km) từ điểm tới đoạn thẳng [a,b], xấp xỉ mặt phẳng
 * tiếp tuyến quanh điểm (đủ chính xác ở quy mô vài chục hải lý).
 * a,b,p là [lng, lat].
 */
function pointToSegmentKm(p: LngLat, a: LngLat, b: LngLat): number {
  const lat0 = (p[1] + a[1] + b[1]) / 3;
  const kx = (Math.cos((lat0 * Math.PI) / 180) * 111.32); // km / độ lng
  const ky = 110.574; // km / độ lat
  const px = p[0] * kx,
    py = p[1] * ky;
  const ax = a[0] * kx,
    ay = a[1] * ky;
  const bx = b[0] * kx,
    by = b[1] * ky;
  const dx = bx - ax,
    dy = by - ay;
  const segLen2 = dx * dx + dy * dy;
  let t = segLen2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / segLen2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx,
    cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

/**
 * Điểm có nằm trong một vòng kín không — ray casting chẵn-lẻ trên mặt phẳng
 * lng/lat. Ở quy mô vùng biển VN sai số chiếu không đổi được kết quả trong/ngoài
 * (chỉ mấp mé đúng trên đường biên, mà sát biên thì đằng nào cũng đang cảnh báo).
 */
function pointInRing(p: LngLat, ring: LngLat[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const crosses =
      yi > p[1] !== yj > p[1] &&
      p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi || Number.EPSILON) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

/** Trong MỘT polygon: chẵn-lẻ trên các vòng của nó (lỗ đảo tự lật ngược). */
function inOnePolygon(p: LngLat, rings: LngLat[][]): boolean {
  let inside = false;
  for (const ring of rings) if (pointInRing(p, ring)) inside = !inside;
  return inside;
}

/**
 * TRONG vùng được phép hay chưa — HOẶC giữa các polygon, chẵn-lẻ trong từng
 * polygon. Xem án lệ ở `VN_ALLOWED_POLYS`: trộn phẳng là sai.
 */
export function insideAllowed(
  lat: number,
  lng: number,
  polys: LngLat[][][] = VN_ALLOWED_POLYS,
): boolean {
  return polys.some((rings) => inOnePolygon([lng, lat], rings));
}

/** Khoảng cách ngắn nhất (km) từ điểm tới một tập đoạn nối tiếp. */
function minKmToPath(p: LngLat, path: LngLat[]): number {
  let best = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    const d = pointToSegmentKm(p, path[i], path[i + 1]);
    if (d < best) best = d;
  }
  return best;
}

/** Nội suy điểm trên đoạn [a,b] theo tham số t∈[0,1]. */
function lerp(a: LngLat, b: LngLat, t: number): LngLat {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/**
 * Tính khoảng cách từ vị trí (lat,lng) tới đường ranh giới biển VN.
 * Trả về khoảng cách hải lý, mức cảnh báo, và điểm gần nhất trên ranh giới.
 */
export function borderProximity(
  lat: number,
  lng: number,
  src: BorderSource = STATIC_BORDER_SOURCE,
): BorderProximity {
  const { line: border, polys } = src;
  const p: LngLat = [lng, lat];
  let bestKm = Infinity;
  let bestNearest: LngLat = border[0];

  for (let i = 0; i < border.length - 1; i++) {
    const a = border[i];
    const b = border[i + 1];
    const d = pointToSegmentKm(p, a, b);
    if (d < bestKm) {
      bestKm = d;
      // tìm lại điểm chiếu để hiển thị (xấp xỉ bằng t trên mặt phẳng)
      const lat0 = (p[1] + a[1] + b[1]) / 3;
      const kx = Math.cos((lat0 * Math.PI) / 180) * 111.32;
      const ky = 110.574;
      const ax = a[0] * kx,
        ay = a[1] * ky;
      const bx = b[0] * kx,
        by = b[1] * ky;
      const dx = bx - ax,
        dy = by - ay;
      const segLen2 = dx * dx + dy * dy;
      let t =
        segLen2 === 0
          ? 0
          : ((p[0] * kx - ax) * dx + (p[1] * ky - ay) * dy) / segLen2;
      t = Math.max(0, Math.min(1, t));
      bestNearest = lerp(a, b, t);
    }
  }

  const distanceNm = bestKm * NM_PER_KM;
  /*  CHỈ KHẲNG ĐỊNH "ĐÃ RA NGOÀI" KHI RA BẰNG ĐƯỜNG BIỂN.
      Bà con dặn (VSS Quân 2026-08-25): *"tuy đường kín nhưng đừng bao giờ tính
      biên tới cái biên trên bờ, biên chỉ áp dụng với đường biển thôi"*.

      Vì sao bắt buộc: đoạn BỜ của vòng kín là đường bờ ĐÃ GIẢN LƯỢC, nó cắt
      ngang các vịnh. Đo thật trên 10 cảng cá: **Thọ Quang (Đà Nẵng)** nằm sâu
      trong vịnh sau bán đảo Sơn Trà nên rơi ra phía "đất liền" của vòng kín ⇒
      app báo "ĐÃ NGOÀI ranh giới" cho một cảng cá Việt Nam. Sát bờ thì
      trong/ngoài là câu hỏi vô nghĩa, và trả lời bừa là báo động giả.

      Luật: ngoài vòng kín thôi CHƯA đủ — điểm gần nhất trên biên phải nằm trên
      ĐƯỜNG BIỂN (chênh không quá 1 hải lý so với điểm gần nhất trên toàn bộ
      viền). Ra bằng phía bờ ⇒ im, chỉ nói khoảng cách. */
  /*  KHÔNG CÓ VÙNG KÍN THÌ KHÔNG BIẾT TRONG/NGOÀI — và không biết thì IM, chứ
      không được đoán. Bẫy vừa dính: `insideAllowed` với danh sách rỗng trả
      `false`, mà `!false` = "ở ngoài" ⇒ mọi điểm bị phán đã vượt biên. Ca này
      có thật khi admin chỉ đánh dấu một vùng dạng ĐƯỜNG (đường hở không có
      "bên trong"). Test tổng hợp trong geofence.test.ts bắt được. */
  const bietTrongNgoai = polys.length > 0;
  const kmToSea = minKmToPath([lng, lat], border);
  const kmToAnyEdge = Math.min(
    ...polys.flatMap((rings) =>
      rings.map((ring) => minKmToPath([lng, lat], ring)),
    ),
  );
  const raBangDuongBien = kmToSea <= kmToAnyEdge + 1 / NM_PER_KM;
  const trongVungBien = bietTrongNgoai && insideAllowed(lat, lng, polys);
  const outside = bietTrongNgoai && !trongVungBien && raBangDuongBien;

  /*  ─── LÚC NÀO MỚI NÓI CHUYỆN RANH GIỚI ───────────────────────────────────
      Chủ dự án 2026-08-25: *"các điểm ở trên bờ phía trong của VN thì đừng hiển
      thị cái tính khoảng cách tới biên"*.

      Chìa khoá: vùng `allowed` CHỈ PHỦ MẶT BIỂN — mép trong của nó chính là
      đường bờ, các đảo là lỗ. Nên chỉ cần đọc vị trí so với vùng đó là biết
      điểm đang ở biển hay trên cạn, KHÔNG cần thêm dữ liệu đất liền nào.

      Ba nhánh:
       · TRONG vùng biển                     → NÓI (đang ở biển, còn cách biên N)
       · NGOÀI + ra bằng ĐƯỜNG BIỂN          → NÓI (đã vượt biên)
       · NGOÀI + phía BỜ (đất liền, vịnh kín,
         hồ, sông, hay bờ bị giản lược cắt)  → IM
      Nhánh ba là thứ vừa thêm. Trước đây nó vẫn in "cách ranh giới 73 hải lý"
      cho một điểm giữa thành phố — số đúng về hình học, vô nghĩa với bà con, và
      là thứ làm người ta hết tin những con số còn lại.

      Không biết trong/ngoài (nguồn biên chỉ có đường hở) ⇒ vẫn NÓI khoảng cách,
      vì lúc đó ta không có cơ sở để bảo điểm nào trên cạn. */
  const applies = trongVungBien || raBangDuongBien || !bietTrongNgoai;

  /*  ĐÃ RA NGOÀI thì nói thẳng là RA NGOÀI, đừng nói "cách biên bao xa" (bà con
      qua VSS Quân 2026-08-25: *"trỏ qua biên thì báo vượt biên, chứ sao báo cách
      biên"*). Nói "cách ranh giới 30 hải lý" cho một chỗ NGOÀI vùng được phép là
      câu đúng-số nhưng sai-nghĩa: bà con đọc ra "còn 30 hải lý nữa mới tới biên".
      Nay có đa giác kín (`VN_ALLOWED_RINGS`) nên khẳng định được bên nào.
      Câu chữ nói về CHỖ ĐANG XEM, không phải về tàu — app không kết tội ai. */
  let level: BorderLevel = "ok";
  let label = `Cách ranh giới biển khoảng ${Math.round(distanceNm)} hải lý`;
  if (!applies) {
    // im lặng, và im theo cách an toàn: caller quên kiểm cờ cũng không hét bậy
    label = "";
  } else if (outside) {
    level = "very_near";
    label = `Chỗ này ĐÃ NGOÀI ranh giới — vào trong ~${
      distanceNm < 10 ? distanceNm.toFixed(1) : Math.round(distanceNm)
    } hải lý`;
  } else if (distanceNm <= VERY_NEAR_NM) {
    level = "very_near";
    label = `Rất gần ranh giới — còn ~${distanceNm.toFixed(1)} hải lý`;
  } else if (distanceNm <= NEAR_NM) {
    level = "near";
    label = `Gần ranh giới — còn ~${Math.round(distanceNm)} hải lý`;
  }

  return { distanceNm, level, label, nearest: bestNearest, outside, applies };
}

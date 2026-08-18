// ĐƯỜNG ĐI CỦA CƠN BÃO — hình dạng để vẽ, dựng THUẦN từ hàng trong kho.
//
// VÌ SAO CÓ (chủ dự án, 2026-08-18): *"xem cách họ dựng bản đồ về bão — nó có
// cái bão đã đi qua và sắp tới, cứ mỗi lần update thì hiệu chỉnh phần sắp tới
// thôi"*. Đó chính xác là hai mảng dưới đây:
//   · `past`     — nối tâm của MỌI bản tin đã phát (bất biến, chỉ dài thêm)
//   · `forecast` — mốc dự báo của bản tin MỚI NHẤT (thay mới mỗi lần có tin)
//
// Không có "vòng tròn bán kính" tự chế. Thứ vẽ được vùng nguy hiểm là `danger`
// — KHUNG TOẠ ĐỘ do NCHMF phát cho từng mốc. Bịa một con số sai số quanh tâm là
// tự nhận trách nhiệm mình không có, ở chỗ dính tính mạng (xem migration 0036).
import type { DangerBox } from "@/lib/storm-bulletin";

/** Một điểm tâm bão ĐÃ QUAN TRẮC (một bản tin = một điểm) */
export type TrackPoint = {
  /** epoch ms — giờ quan trắc nếu bản tin có, không thì giờ phát */
  at: number;
  lat: number;
  lon: number;
  cap: number | null;
  giat: number | null;
};

/** Một mốc DỰ BÁO của bản tin mới nhất */
export type TrackForecast = {
  at: number | null;
  lat: number;
  lon: number;
  cap: number | null;
  giat: number | null;
  danger: DangerBox | null;
};

export type StormTrack = {
  key: string;
  /** "Bão số 5" / "Áp thấp nhiệt đới" — để in nhãn, không phải tên riêng */
  name: string;
  laBao: boolean;
  /** giờ phát bản tin MỚI NHẤT (epoch ms) */
  issuedAt: number;
  past: TrackPoint[];
  forecast: TrackForecast[];
};

/** Hàng thô của `storm_bulletins` (đã select đúng cột) */
export type BulletinRow = {
  id: string;
  storm_key: string;
  issued_at: string;
  observed_at: string | null;
  la_bao: boolean | null;
  so_bao: string | null;
  lat: number | string;
  lon: number | string;
  cap: number | null;
  giat: number | null;
};

/** Hàng thô của `storm_forecast_points` */
export type ForecastRow = {
  bulletin_id: string;
  valid_at: string | null;
  lat: number | string;
  lon: number | string;
  cap: number | null;
  giat: number | null;
  danger_box: DangerBox | null;
  seq: number | null;
};

const so = (v: number | string): number => (typeof v === "number" ? v : Number(v));

function tenCon(laBao: boolean, soBao: string | null): string {
  if (!laBao) return "Áp thấp nhiệt đới";
  return soBao ? `Bão số ${soBao}` : "Bão";
}

/**
 * Hàng kho → đường đi để vẽ.
 *
 * `bulletins` KHÔNG cần sắp sẵn — hàm tự xếp theo giờ, vì một lần đổi thứ tự ở
 * chỗ gọi là một đường đi vẽ ngoằn ngoèo qua biển mà không ai nghi ngờ.
 * Bản tin thiếu toạ độ bị BỎ (không vẽ điểm nằm ở 0°N/0°E giữa Đại Tây Dương).
 */
export function rowsToTracks(
  bulletins: BulletinRow[],
  points: ForecastRow[],
): StormTrack[] {
  const theoKhoa = new Map<string, BulletinRow[]>();
  for (const r of bulletins) {
    if (!Number.isFinite(so(r.lat)) || !Number.isFinite(so(r.lon))) continue;
    const arr = theoKhoa.get(r.storm_key);
    if (arr) arr.push(r);
    else theoKhoa.set(r.storm_key, [r]);
  }

  const diemTheoBanTin = new Map<string, ForecastRow[]>();
  for (const p of points) {
    const arr = diemTheoBanTin.get(p.bulletin_id);
    if (arr) arr.push(p);
    else diemTheoBanTin.set(p.bulletin_id, [p]);
  }

  const out: StormTrack[] = [];
  for (const [key, rows] of theoKhoa) {
    rows.sort((a, b) => Date.parse(a.issued_at) - Date.parse(b.issued_at));
    const moiNhat = rows[rows.length - 1];
    const issuedAt = Date.parse(moiNhat.issued_at);
    if (!Number.isFinite(issuedAt)) continue;

    const past: TrackPoint[] = rows.map((r) => ({
      // giờ QUAN TRẮC mới là lúc tâm ở đó; giờ phát chỉ là lúc đài đọc tin
      at: Date.parse(r.observed_at ?? r.issued_at),
      lat: so(r.lat),
      lon: so(r.lon),
      cap: r.cap,
      giat: r.giat,
    }));

    const fc = (diemTheoBanTin.get(moiNhat.id) ?? [])
      .filter((p) => Number.isFinite(so(p.lat)) && Number.isFinite(so(p.lon)))
      .sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0))
      .map((p) => ({
        at: p.valid_at ? Date.parse(p.valid_at) : null,
        lat: so(p.lat),
        lon: so(p.lon),
        cap: p.cap,
        giat: p.giat,
        danger: p.danger_box ?? null,
      }));

    out.push({
      key,
      name: tenCon(!!moiNhat.la_bao, moiNhat.so_bao),
      laBao: !!moiNhat.la_bao,
      issuedAt,
      past,
      forecast: fc,
    });
  }

  // cơn có tin mới nhất đứng trước — bà con nhìn cơn đang sống trước tiên
  out.sort((a, b) => b.issuedAt - a.issuedAt);
  return out;
}

/** Cơn im quá ngần này giờ thì không vẽ nữa (đã tan hoặc ra khỏi vùng ra tin) */
export const TRACK_SONG_GIO = 48;

/* ═══════════════════════════════════════════════════════════════════════════
   HÌNH ĐỂ VẼ
   ═══════════════════════════════════════════════════════════════════════════ */

/** Nhãn ngày/giờ cạnh mốc: "13h 19/8" — bà con đọc theo giờ VN, không ISO */
export function nhanMoc(at: number | null): string {
  if (at == null || !Number.isFinite(at)) return "";
  const d = new Date(at + 7 * 3600_000); // giờ VN = UTC+7, cố định, không DST
  return `${d.getUTCHours()}h ${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
}

/**
 * Đường đi → GeoJSON để MapLibre vẽ. THUẦN (test được, không đụng bản đồ).
 *
 * Bốn loại `kind` trong properties, mỗi loại một lớp vẽ riêng:
 *   · `qua-khu`   — LineString liền, đoạn cơn ĐÃ ĐI
 *   · `sap-toi`   — LineString gạch đứt, nối tâm hiện tại qua các mốc dự báo
 *   · `moc`       — Point từng mốc (có `nhan`, `tuong-lai`) để chấm + ghi giờ
 *   · `vung-nguy-hiem` — Polygon khung toạ độ NCHMF phát cho mốc đó
 *
 * ⚠️ Đoạn "sắp tới" LUÔN bắt đầu từ TÂM HIỆN TẠI (điểm cuối của `past`), không
 * phải từ mốc dự báo đầu tiên — thiếu đoạn nối đó thì đường đứt một khúc đúng
 * chỗ bà con đang nhìn để đoán bão có quét qua mình không.
 */
export function tracksToGeoJSON(
  tracks: StormTrack[],
): GeoJSON.FeatureCollection | null {
  const features: GeoJSON.Feature[] = [];
  for (const t of tracks) {
    const qua = t.past.map((p) => [p.lon, p.lat]);
    if (qua.length > 1) {
      features.push({
        type: "Feature",
        properties: { kind: "qua-khu", key: t.key },
        geometry: { type: "LineString", coordinates: qua },
      });
    }
    for (const p of t.past) {
      features.push({
        type: "Feature",
        properties: {
          kind: "moc",
          tuongLai: false,
          nhan: nhanMoc(p.at),
          cap: p.cap ?? null,
          ten: t.name,
        },
        geometry: { type: "Point", coordinates: [p.lon, p.lat] },
      });
    }

    const tam = qua[qua.length - 1];
    const toi = t.forecast.map((p) => [p.lon, p.lat]);
    if (toi.length > 0) {
      const noi = tam ? [tam, ...toi] : toi;
      if (noi.length > 1) {
        features.push({
          type: "Feature",
          properties: { kind: "sap-toi", key: t.key },
          geometry: { type: "LineString", coordinates: noi },
        });
      }
    }
    for (const p of t.forecast) {
      features.push({
        type: "Feature",
        properties: {
          kind: "moc",
          tuongLai: true,
          nhan: nhanMoc(p.at),
          cap: p.cap ?? null,
          ten: t.name,
        },
        geometry: { type: "Point", coordinates: [p.lon, p.lat] },
      });
      if (p.danger) {
        const { latMin, latMax, lonMin, lonMax } = p.danger;
        features.push({
          type: "Feature",
          properties: { kind: "vung-nguy-hiem", nhan: nhanMoc(p.at) },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [lonMin, latMin],
                [lonMax, latMin],
                [lonMax, latMax],
                [lonMin, latMax],
                [lonMin, latMin],
              ],
            ],
          },
        });
      }
    }
  }
  return features.length ? { type: "FeatureCollection", features } : null;
}

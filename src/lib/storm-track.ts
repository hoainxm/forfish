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
import { khoangCachKm, type DangerBox } from "@/lib/storm-bulletin";

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
  /** BÁN KÍNH GIÓ MẠNH CẤP 6 quanh tâm hiện tại (km), do bản tin GHI THẲNG.
      null với áp thấp nhiệt đới — NCHMF không phát con số đó cho ATNĐ. */
  radiusKm: number | null;
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
  radius_km: number | null;
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
      radiusKm:
        moiNhat.radius_km != null && Number.isFinite(Number(moiNhat.radius_km))
          ? Number(moiNhat.radius_km)
          : null,
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

/**
 * Vòng tròn bán kính `km` quanh một điểm → vòng toạ độ ĐÓNG để vẽ Polygon.
 *
 * ⚠️ CHỈ dùng cho con số bản tin GHI THẲNG ("Bán kính gió mạnh cấp 6 khoảng
 * 250km tính từ tâm bão"). TUYỆT ĐỐI KHÔNG dựng vòng tròn từ khung vùng nguy
 * hiểm: nội tiếp thì BỎ MẤT bốn góc cơ quan đã tuyên là nguy hiểm, ngoại tiếp
 * thì phình ra vùng họ không hề nói. Đổi hình cho quen mắt mà làm sai nghĩa
 * "vùng nguy hiểm" thì cái giá rơi vào người đi biển.
 *
 * Dựng bằng CÔNG THỨC ĐIỂM ĐÍCH trên mặt cầu (cùng bán kính Trái Đất với
 * `khoangCachKm`), không phải cộng độ theo mặt phẳng. Phép mặt phẳng — lấy
 * `km/111,32` cho vĩ và chia `cos(lat)` cho kinh — đo lại ra 249,4 km thay vì
 * 250 ở 20°N, vì `cos` chỉ đúng tại tâm chứ không đúng dọc theo vòng. Lệch
 * 0,25% thì mắt không thấy, nhưng đây là vòng NGUY HIỂM: đã vẽ thì vẽ đúng số
 * bản tin nói, và cổng test khoá bất biến "mọi đỉnh cách tâm đúng N km".
 */
export const VONG_DINH = 64;

const BAN_KINH_TRAI_DAT_KM = 6371;

export function vongTron(
  lat: number,
  lon: number,
  km: number,
  dinh = VONG_DINH,
): number[][] {
  const rad = (d: number) => (d * Math.PI) / 180;
  const deg = (r: number) => (r * 180) / Math.PI;
  const p1 = rad(lat);
  const l1 = rad(lon);
  const d = km / BAN_KINH_TRAI_DAT_KM; // góc ở tâm Trái Đất
  const ring: number[][] = [];
  for (let i = 0; i < dinh; i++) {
    const huong = (2 * Math.PI * i) / dinh; // phương vị, 0 = hướng Bắc
    const p2 = Math.asin(
      Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(huong),
    );
    const l2 =
      l1 +
      Math.atan2(
        Math.sin(huong) * Math.sin(d) * Math.cos(p1),
        Math.cos(d) - Math.sin(p1) * Math.sin(p2),
      );
    ring.push([deg(l2), deg(p2)]);
  }
  ring.push(ring[0]);
  return ring;
}

/**
 * VÒNG TRÒN NGOẠI TIẾP khung vùng nguy hiểm: tâm ở giữa khung, bán kính vươn
 * tới GÓC XA NHẤT — tức vòng **bao trọn** khung.
 *
 * ⚠️ ĐÂY LÀ QUYẾT ĐỊNH SẢN PHẨM, KHÔNG PHẢI PHÉP TÍNH TỰ NGHĨ RA (chủ dự án
 * chốt 2026-08-18h: *"dùng các bản tin cũ vẽ vòng tròn ngoại tiếp, dư thừa
 * không sao"*). Tôi từng bác cả hai lối vẽ vòng từ khung; chốt lại thì **ngoại
 * tiếp khác hẳn nội tiếp**:
 *   · nội tiếp  → BỎ MẤT bốn góc cơ quan đã tuyên là nguy hiểm ⇒ báo SÓT. Cấm.
 *   · ngoại tiếp → phình ra vùng nguồn không nói ⇒ báo THỪA. Chấp nhận được,
 *     vì với tin bão thì thà bà con tránh rộng hơn còn hơn tránh hụt.
 * Vòng là bao lồi nhỏ nhất chứa khung, nên phần thừa cũng nhỏ nhất có thể.
 *
 * Bán kính đo bằng `khoangCachKm` tới cả bốn góc rồi lấy max — không quy đổi độ
 * sang km bằng tay, để phần co của kinh tuyến theo vĩ độ tự đúng.
 */
export function vongNgoaiTiep(box: DangerBox): {
  lat: number;
  lon: number;
  km: number;
} {
  const lat = (box.latMin + box.latMax) / 2;
  const lon = (box.lonMin + box.lonMax) / 2;
  const goc: [number, number][] = [
    [box.latMin, box.lonMin],
    [box.latMin, box.lonMax],
    [box.latMax, box.lonMin],
    [box.latMax, box.lonMax],
  ];
  let km = 0;
  for (const [a, b] of goc) km = Math.max(km, khoangCachKm(lat, lon, a, b));
  return { lat, lon, km };
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
 *   · `vung-nguy-hiem` — Polygon VÒNG TRÒN ngoại tiếp khung toạ độ NCHMF phát
 *     cho mốc đó (bao trọn khung: báo thừa, không báo sót — xem `vongNgoaiTiep`)
 *   · `ban-kinh`  — vòng BÁN KÍNH GIÓ MẠNH quanh tâm, chỉ khi bản tin BÃO ghi số
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
    /*  BÁN KÍNH GIÓ MẠNH quanh tâm HIỆN TẠI — chỉ khi bản tin ghi thẳng con số.
        Bản tin BÃO có ("Bán kính gió mạnh cấp 6 khoảng 250km"); bản tin ÁP THẤP
        NHIỆT ĐỚI KHÔNG có, và lúc đó KHÔNG vẽ vòng nào cả thay vì bịa một số. */
    if (tam && t.radiusKm != null && t.radiusKm > 0) {
      features.push({
        type: "Feature",
        properties: { kind: "ban-kinh", km: t.radiusKm, ten: t.name },
        geometry: {
          type: "Polygon",
          coordinates: [vongTron(tam[1], tam[0], t.radiusKm)],
        },
      });
    }
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
        /*  VẼ VÒNG NGOẠI TIẾP thay cho khung chữ nhật (chủ dự án chốt
            2026-08-18h). Vòng BAO TRỌN khung nên không bỏ sót mét nào của vùng
            nguồn đã tuyên; phần dư là báo thừa, và với tin bão thì thà tránh
            rộng hơn tránh hụt. Khung gốc vẫn nằm nguyên trong payload
            (`forecast[].danger`) — đổi lại lối vẽ chỉ là sửa chỗ này. */
        const v = vongNgoaiTiep(p.danger);
        features.push({
          type: "Feature",
          properties: { kind: "vung-nguy-hiem", nhan: nhanMoc(p.at), km: Math.round(v.km) },
          geometry: { type: "Polygon", coordinates: [vongTron(v.lat, v.lon, v.km)] },
        });
      }
    }
  }
  return features.length ? { type: "FeatureCollection", features } : null;
}

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
import {
  khoangCachKm,
  LIEN_TUC_GIO,
  LIEN_TUC_KM,
  type DangerBox,
} from "@/lib/storm-bulletin";

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
  /** Giờ phát của bản tin CŨ mà `forecast`/`radiusKm` phải mượn về, khi tin mới
      nhất parse hụt hai thứ đó. `null` = tin mới đủ, không mượn gì. */
  buTuTinLuc: number | null;
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

/** Bán kính gió mạnh cấp 6 của một bản tin, `null` khi tin không ghi số. */
function banKinh(r: BulletinRow): number | null {
  return r.radius_km != null && Number.isFinite(Number(r.radius_km))
    ? Number(r.radius_km)
    : null;
}

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
 *
 * `nowMs` = mốc "bây giờ" để chia ĐÃ QUA / SẮP TỚI (chủ dự án 2026-08-31):
 *   · Mốc DỰ BÁO đã qua giờ (`valid_at < nowMs`) bị BỎ khỏi `forecast` — nó
 *     không còn là "sắp tới", vẽ tiếp thành gạch-đứt-tương-lai là nói dối.
 *   · Track CÙNG CƠN nhưng KHÁC KHOÁ (ATNĐ→bão, hoặc ingestion chưa nối) được
 *     GỘP: giữ forecast của bản MỚI NHẤT, gộp đường-đã-đi của bản cũ, BỎ track
 *     cũ (kèm forecast cũ) — đúng "tin cũ bị tin mới viết lại thì ẩn đi".
 */
export function rowsToTracks(
  bulletins: BulletinRow[],
  points: ForecastRow[],
  nowMs: number = Date.now(),
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

    const mocDuBao = (id: string): TrackForecast[] =>
      (diemTheoBanTin.get(id) ?? [])
        .filter((p) => Number.isFinite(so(p.lat)) && Number.isFinite(so(p.lon)))
        .sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0))
        .map((p) => ({
          at: p.valid_at ? Date.parse(p.valid_at) : null,
          lat: so(p.lat),
          lon: so(p.lon),
          cap: p.cap,
          giat: p.giat,
          danger: p.danger_box ?? null,
        }))
        // BỎ mốc dự báo ĐÃ QUA GIỜ — chỉ "sắp tới" mới là dự báo. Mốc không
        // có giờ (`at == null`) thì GIỮ (không biết thì thà vẽ). Xem `nowMs`.
        .filter((p) => p.at == null || p.at >= nowMs);

    let fc = mocDuBao(moiNhat.id);
    let radiusKm = banKinh(moiNhat);
    let buTuTinLuc: number | null = null;

    /*  TIN MỚI THIẾU THÌ MƯỢN CỦA TIN CŨ (chủ dự án 2026-09-02: *"nếu tin mới
        mà nó ko đủ thì dùng toạ độ tâm mới còn các phần kia dùng info của tin
        cũ bù vào"*). TÂM luôn lấy của tin MỚI NHẤT (điểm cuối `past`) — đó là
        thứ phải đúng nhất và luôn có. Đường dự báo + bán kính gió mạnh thì thà
        mượn của tin trước còn hơn để trống: giữa hai bản tin (thường 3–6 giờ)
        chúng đổi chậm, sai số nhỏ; để trống thì màn hình câm — cái giá rơi vào
        người đi biển. Mốc dự báo của tin cũ vẫn qua cả bộ lọc `nowMs`, nên chỉ
        mượn được phần CÒN Ở TƯƠNG LAI — không vẽ lại quá khứ thành dự báo.
        Giờ tin đã mượn ghi lại để màn nói thật (`buTuTinLuc`), không đội lốt tin mới. */
    for (let i = rows.length - 2; i >= 0; i--) {
      if (fc.length && radiusKm != null) break;
      const cu = rows[i];
      const gioCu = Date.parse(cu.issued_at);
      if (!Number.isFinite(gioCu)) continue;
      let muon = false;
      if (!fc.length) {
        const cuFc = mocDuBao(cu.id);
        if (cuFc.length) {
          fc = cuFc;
          muon = true;
        }
      }
      if (radiusKm == null) {
        const r = banKinh(cu);
        if (r != null) {
          radiusKm = r;
          muon = true;
        }
      }
      // giữ giờ CŨ NHẤT trong những thứ đã mượn — khai chỗ cũ nhất là khai
      // đúng tuổi thật của dữ liệu đang vẽ, không hứa mới hơn thực tế
      if (muon) buTuTinLuc = buTuTinLuc == null ? gioCu : Math.min(buTuTinLuc, gioCu);
    }

    out.push({
      key,
      radiusKm,
      buTuTinLuc,
      name: tenCon(!!moiNhat.la_bao, moiNhat.so_bao),
      laBao: !!moiNhat.la_bao,
      issuedAt,
      past,
      forecast: fc,
    });
  }

  // cơn có tin mới nhất đứng trước — bà con nhìn cơn đang sống trước tiên
  out.sort((a, b) => b.issuedAt - a.issuedAt);

  /*  GỘP CÙNG CƠN KHÁC KHOÁ — lưới an toàn ở TẦNG VẼ. Ingestion đã nối ATNĐ→bão
      (`khoaCanDoiTen` trong refresh-storms), nhưng phòng khi khoá vẫn tách (bão
      đổi số, ingestion gãy, dữ liệu cũ trước khi có logic nối): hai track là MỘT
      cơn nếu tâm quan trắc MỚI NHẤT cách ≤ `LIEN_TUC_KM` và bản tin cách ≤
      `LIEN_TUC_GIO` — CÙNG ngưỡng định danh với `noiTiep`. Đã sắp MỚI→CŨ nên
      track duyệt sau là CŨ hơn: gộp đường-đã-đi của nó vào track mới rồi BỎ nó
      (forecast cũ theo đó ẩn luôn — đúng "tin cũ bị tin mới viết lại thì ẩn"). */
  const gop: StormTrack[] = [];
  for (const t of out) {
    const tamT = t.past[t.past.length - 1];
    const chung = tamT
      ? gop.find((m) => {
          const tamM = m.past[m.past.length - 1];
          if (!tamM) return false;
          const gio = Math.abs(m.issuedAt - t.issuedAt) / 3_600_000;
          return (
            gio <= LIEN_TUC_GIO &&
            khoangCachKm(tamT.lat, tamT.lon, tamM.lat, tamM.lon) <= LIEN_TUC_KM
          );
        })
      : undefined;
    if (chung) {
      // t CŨ hơn → chèn đường-đã-đi của nó, xếp lại theo giờ, bỏ điểm trùng
      // (hai khoá có thể cùng một mốc quan trắc). Forecast của t KHÔNG lấy.
      const nhap = [...chung.past, ...t.past].sort((a, b) => a.at - b.at);
      chung.past = nhap.filter(
        (p, i) =>
          i === 0 || p.at !== nhap[i - 1].at || p.lat !== nhap[i - 1].lat,
      );
      /*  MƯỢN LUÔN Ở ĐÂY nếu bản mới không có (cùng luật với mượn giữa các bản
          tin cùng khoá, 2026-09-02): track mới đổi khoá mà chưa kịp có đường dự
          báo / bán kính thì lấy của bản cũ vừa gộp, thay vì để trống. */
      if (!chung.forecast.length && t.forecast.length) {
        chung.forecast = t.forecast;
        chung.buTuTinLuc = t.buTuTinLuc ?? t.issuedAt;
      }
      if (chung.radiusKm == null && t.radiusKm != null) {
        chung.radiusKm = t.radiusKm;
        chung.buTuTinLuc = Math.min(
          chung.buTuTinLuc ?? Number.POSITIVE_INFINITY,
          t.buTuTinLuc ?? t.issuedAt,
        );
      }
    } else {
      gop.push(t);
    }
  }
  return gop;
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

/** Cơn im quá ngần này giờ thì không vẽ nữa (đã tan hoặc ra khỏi vùng ra tin) */
export const TRACK_SONG_GIO = 48;

/**
 * BA DẢI ỐNG BÃO — **bán kính** (km) quanh TRỤC đường đi, trong→ngoài.
 *
 * Chủ dự án 2026-08-31 (soi ảnh NCHMF thật): vẽ GIỐNG NHÀ NƯỚC — vùng nguy hiểm
 * là ỐNG BÁM SÁT ĐƯỜNG ĐI (không phải bao lồi CẮT GÓC, không phải vòng ngoại tiếp
 * khung phình ~700km). Hiện thực bằng **lớp LINE dày bo tròn** quanh trục (feature
 * `kind:"ong"`): mỗi mức một line rộng gấp đôi bán kính, `line-cap/join: round`.
 * Vì sao line chứ không đa giác: MapLibre tô LINE PHẲNG — không cộng độ mờ ở chỗ
 * line tự-chồng (bo góc, bo đầu) — nên chỗ tiếp tuyến/giao nhau chỉ MỘT màu (chủ
 * dự án: *"chỗ giao nhau… lấy 1 màu thôi"*). Ba line rộng dần, mờ, chồng nhau →
 * chuyển màu MƯỢT: xanh lá đậm sát tâm → tím ở rìa (vùng gió ≥ cấp 6).
 *
 * `line-width` MapLibre tính bằng PIXEL nên fishing-map-view quy bán-kính-km ra
 * pixel theo zoom (biểu thức `interpolate exponential 2`) để ống co giãn đúng
 * theo bản đồ. Bán kính CỐ ĐỊNH (không lấy từ khung nửa-mặt-phẳng — khung đó bị
 * kẹp tới mép Biển Đông nên vô dụng cho cỡ vẽ). Ống BẬT khi có ĐƯỜNG DỰ BÁO
 * (≥2 nút), KHÔNG đòi `danger` box — parser NCHMF có ngày hụt, mà tắt vùng nguy
 * hiểm vì lỗi parse là nguy hiểm (feature an toàn thà cảnh báo rộng hơn tắt câm).
 */
export const ONG_BAO_MUC = [110, 210, 320];

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
 * Các loại `kind` trong properties, mỗi loại một lớp vẽ riêng:
 *   · `qua-khu`   — LineString liền, đoạn cơn ĐÃ ĐI
 *   · `sap-toi`   — LineString gạch đứt, nối tâm hiện tại qua các mốc dự báo
 *   · `moc`       — Point từng mốc (có `nhan`, `tuongLai`, `lat/lon/cap/giat/at`,
 *     và `dangerKm` cho mốc dự báo) để chấm + ghi giờ + CHẠM bật popup (A)
 *   · `ong`       — LineString TRỤC đường đi; fishing-map-view vẽ 3 lớp LINE dày
 *     bo tròn quanh nó (vùng nguy hiểm kiểu NCHMF, gradient xanh→tím ôm sát tuyến)
 *   · `vong-gio`  — Polygon vòng gió quanh mốc dự báo (viền trắng, bán kính dải trong)
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
          giat: p.giat ?? null,
          // toạ độ + giờ đưa vào props để CHẠM MỐC bật popup thông tin (A)
          lat: p.lat,
          lon: p.lon,
          at: p.at ?? null,
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
    /*  CÓ ĐƯỜNG DỰ BÁO để dựng ống nguy hiểm không. KHÔNG đòi `danger` box của
        bản tin (chủ dự án 2026-08-31, ca thật: bản tin 07:00 parse hụt danger →
        cả vùng nguy hiểm biến mất dù bão vẫn đó). Ống dùng bán kính CỐ ĐỊNH
        (`ONG_BAO_MUC`), box chỉ là tín hiệu — mà parser NCHMF luôn có ngày hụt.
        Feature an toàn TẮT VÌ LỖI PARSE = nguy hiểm, nên vẽ vùng bão theo ĐƯỜNG
        ĐI (thứ luôn có) — thà cảnh báo rộng hơn tắt câm. */
    const nodes = tam ? [tam, ...toi] : toi;
    const veOng = nodes.length >= 2;
    for (const p of t.forecast) {
      features.push({
        type: "Feature",
        properties: {
          kind: "moc",
          tuongLai: true,
          nhan: nhanMoc(p.at),
          cap: p.cap ?? null,
          giat: p.giat ?? null,
          // toạ độ + giờ + bán kính vùng ảnh hưởng → popup khi CHẠM MỐC (A)
          lat: p.lat,
          lon: p.lon,
          at: p.at ?? null,
          dangerKm: ONG_BAO_MUC[ONG_BAO_MUC.length - 1],
          // có số = đường dự báo này MƯỢN của bản tin cũ (xem `buTuTinLuc`)
          tinCuLuc: t.buTuTinLuc,
          ten: t.name,
        },
        geometry: { type: "Point", coordinates: [p.lon, p.lat] },
      });
      // VÒNG GIÓ trắng quanh mốc dự báo (bán kính dải trong) — như NCHMF
      if (veOng) {
        features.push({
          type: "Feature",
          properties: { kind: "vong-gio", key: t.key },
          geometry: {
            type: "Polygon",
            coordinates: [vongTron(p.lat, p.lon, ONG_BAO_MUC[0])],
          },
        });
      }
    }
    /*  ỐNG BÃO — TRỤC đường đi (tâm hiện tại → các mốc dự báo). Vùng nguy hiểm
        kiểu NCHMF vẽ bằng lớp LINE DÀY bo tròn quanh trục này (xem fishing-map-
        view: 3 line rộng dần cho gradient xanh→tím). Vẽ bằng line thay đa giác vì
        line MapLibre tô PHẲNG — không cộng độ mờ ở chỗ tự-chồng (bo góc/đầu), nên
        chỗ tiếp tuyến/giao nhau chỉ MỘT màu. Bật khi ĐỦ ≥2 nút để thành đường. */
    if (veOng) {
      features.push({
        type: "Feature",
        properties: { kind: "ong", key: t.key },
        geometry: { type: "LineString", coordinates: nodes },
      });
    } else if (tam) {
      /*  CÓ BÃO LÀ PHẢI VẼ VÙNG NGUY HIỂM — KHÔNG có ngoại lệ nào (chủ dự án
          2026-09-02: *"sao ko vẽ? kiểm tra để đảm bảo có bão là luôn vẽ"*).

          CA THẬT (ảnh chụp máy 09:09 ngày 2/9): bản tin có ĐỦ vệt quá khứ tới
          `7h 2/9` nhưng KHÔNG parse ra mốc dự báo nào ⇒ `nodes` chỉ còn đúng
          tâm hiện tại ⇒ `veOng = false` ⇒ màn hiện vệt bão mà TUYỆT NHIÊN
          không có vùng nguy hiểm. Bà con nhìn thấy đường bão chạy tới, không
          thấy vùng phải tránh.

          Đây là cùng một lớp lỗi với bản vá 2026-08-31 ("không đòi `danger`
          box"): mỗi mảnh dữ liệu parse hụt lại tắt câm một feature AN TOÀN.
          Luật phải là ngược lại — parse được tới đâu thì vẽ tới đó, thiếu thì
          lùi về vòng tròn quanh tâm, KHÔNG BAO GIỜ lùi về không vẽ gì.

          Vòng tròn dùng ĐÚNG bán kính ngoài của ống (`ONG_BAO_MUC` cuối), nên
          không đẻ ngưỡng mới và không hứa hẹp hơn ống. Thà cảnh báo rộng hơn
          là tắt câm — nhầm rộng thì bà con đi vòng, tắt câm thì bà con đi
          thẳng vào. */
      /*  BA DẢI ĐỒNG TÂM, đúng bộ bán kính của ống (`ONG_BAO_MUC`) — để mắt
          đọc ra CÙNG MỘT thứ dù bản tin có đường dự báo hay không. Vẽ từ NGOÀI
          vào TRONG (tím → xanh) y như thứ tự lớp của ống. */
      for (let m = ONG_BAO_MUC.length - 1; m >= 0; m--) {
        features.push({
          type: "Feature",
          properties: { kind: "ong-tron", muc: m, key: t.key, ten: t.name },
          geometry: {
            type: "Polygon",
            coordinates: [vongTron(tam[1], tam[0], ONG_BAO_MUC[m])],
          },
        });
      }
    }
  }
  return features.length ? { type: "FeatureCollection", features } : null;
}

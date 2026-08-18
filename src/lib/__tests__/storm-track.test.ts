// ĐƯỜNG ĐI CƠN BÃO — hàng kho → hình vẽ.
//
// Vì sao canh kỹ chỗ này: một lỗi thứ tự hay một điểm thiếu toạ độ ở đây KHÔNG
// làm app sập, không báo đỏ — nó chỉ vẽ ra một đường ngoằn ngoèo qua biển trông
// vẫn "có vẻ đúng". Bà con nhìn đường đó để đoán bão có quét qua chỗ mình không.
import { describe, expect, it } from "vitest";
import {
  VONG_DINH,
  nhanMoc,
  rowsToTracks,
  tracksToGeoJSON,
  vongTron,
  type BulletinRow,
  type ForecastRow,
} from "@/lib/storm-track";
import {
  khoaCanDoiTen,
  khoangCachKm,
  noiTiep,
  stormKeyFor,
  type NchmfBulletin,
} from "@/lib/storm-bulletin";

function hang(p: Partial<BulletinRow> & { id: string; issued_at: string }): BulletinRow {
  return {
    storm_key: "atnd-20260818",
    observed_at: null,
    la_bao: false,
    so_bao: null,
    lat: 19.8,
    lon: 117.6,
    cap: 6,
    giat: 8,
    radius_km: null,
    ...p,
  };
}

function tin(p: Partial<NchmfBulletin> = {}): NchmfBulletin {
  return {
    issuedAt: Date.UTC(2026, 7, 18, 1),
    observedAt: null,
    nextAt: null,
    laBao: false,
    soBao: null,
    lat: 19.8,
    lon: 117.6,
    cap: 6,
    giat: 8,
    dir: "Tây",
    speedKmh: 10,
    radiusKm: null,
    danger: null,
    risk: 3,
    forecast: [],
    url: null,
    ...p,
  };
}

describe("rowsToTracks — gom bản tin thành đường đi", () => {
  it("xếp theo giờ phát dù hàng vào lộn xộn", () => {
    const rows = [
      hang({ id: "b", issued_at: "2026-08-18T07:00:00Z", lat: 20.1, lon: 113.2 }),
      hang({ id: "a", issued_at: "2026-08-18T01:00:00Z", lat: 19.8, lon: 117.6 }),
      hang({ id: "c", issued_at: "2026-08-18T13:00:00Z", lat: 20.4, lon: 110.9 }),
    ];
    const [t] = rowsToTracks(rows, []);
    expect(t.past.map((p) => p.lon)).toEqual([117.6, 113.2, 110.9]);
  });

  it("mốc dự báo CHỈ lấy của bản tin mới nhất", () => {
    const rows = [
      hang({ id: "cu", issued_at: "2026-08-18T01:00:00Z" }),
      hang({ id: "moi", issued_at: "2026-08-18T07:00:00Z" }),
    ];
    const pts: ForecastRow[] = [
      { bulletin_id: "cu", valid_at: null, lat: 1, lon: 1, cap: null, giat: null, danger_box: null, seq: 0 },
      { bulletin_id: "moi", valid_at: null, lat: 2, lon: 2, cap: null, giat: null, danger_box: null, seq: 0 },
    ];
    const [t] = rowsToTracks(rows, pts);
    expect(t.forecast).toHaveLength(1);
    expect(t.forecast[0].lat).toBe(2);
  });

  it("mốc dự báo xếp theo seq, không theo thứ tự DB trả về", () => {
    const rows = [hang({ id: "x", issued_at: "2026-08-18T07:00:00Z" })];
    const pts: ForecastRow[] = [
      { bulletin_id: "x", valid_at: null, lat: 3, lon: 3, cap: null, giat: null, danger_box: null, seq: 2 },
      { bulletin_id: "x", valid_at: null, lat: 1, lon: 1, cap: null, giat: null, danger_box: null, seq: 0 },
      { bulletin_id: "x", valid_at: null, lat: 2, lon: 2, cap: null, giat: null, danger_box: null, seq: 1 },
    ];
    const [t] = rowsToTracks(rows, pts);
    expect(t.forecast.map((p) => p.lat)).toEqual([1, 2, 3]);
  });

  it("dùng giờ QUAN TRẮC làm mốc điểm, không phải giờ phát", () => {
    const rows = [
      hang({
        id: "a",
        issued_at: "2026-08-18T01:00:00Z",
        observed_at: "2026-08-18T00:00:00Z",
      }),
    ];
    const [t] = rowsToTracks(rows, []);
    expect(t.past[0].at).toBe(Date.parse("2026-08-18T00:00:00Z"));
  });

  it("bản tin thiếu toạ độ bị BỎ, không vẽ điểm ở 0°N/0°E", () => {
    const rows = [
      hang({ id: "a", issued_at: "2026-08-18T01:00:00Z" }),
      hang({ id: "hong", issued_at: "2026-08-18T07:00:00Z", lat: NaN, lon: NaN }),
    ];
    const [t] = rowsToTracks(rows, []);
    expect(t.past).toHaveLength(1);
  });

  it("toạ độ dạng chuỗi (numeric của Postgres) vẫn ra số", () => {
    const rows = [hang({ id: "a", issued_at: "2026-08-18T01:00:00Z", lat: "19.800", lon: "117.600" })];
    const [t] = rowsToTracks(rows, []);
    expect(t.past[0].lat).toBeCloseTo(19.8);
  });

  it("nhiều cơn: tách theo khoá, cơn có tin mới nhất đứng trước", () => {
    const rows = [
      hang({ id: "a", storm_key: "atnd-20260810", issued_at: "2026-08-10T01:00:00Z" }),
      hang({ id: "b", storm_key: "bao-so-5-2026", issued_at: "2026-08-18T07:00:00Z", la_bao: true, so_bao: "5" }),
    ];
    const ts = rowsToTracks(rows, []);
    expect(ts).toHaveLength(2);
    expect(ts[0].key).toBe("bao-so-5-2026");
    expect(ts[0].name).toBe("Bão số 5");
    expect(ts[1].name).toBe("Áp thấp nhiệt đới");
  });

  it("mảng rỗng → không có đường nào (không ném)", () => {
    expect(rowsToTracks([], [])).toEqual([]);
  });
});

describe("tracksToGeoJSON — hình để vẽ", () => {
  const rows = [
    hang({ id: "a", issued_at: "2026-08-18T01:00:00Z", lat: 19.8, lon: 117.6 }),
    hang({ id: "b", issued_at: "2026-08-18T07:00:00Z", lat: 20.1, lon: 113.2 }),
  ];
  const pts: ForecastRow[] = [
    {
      bulletin_id: "b",
      valid_at: "2026-08-19T00:00:00Z",
      lat: 20.5,
      lon: 110.0,
      cap: 6,
      giat: 8,
      danger_box: { latMin: 19, latMax: 21, lonMin: 108, lonMax: 112 },
      seq: 0,
    },
  ];

  it("đoạn SẮP TỚI nối từ TÂM HIỆN TẠI, không bỏ hở khúc đầu", () => {
    const gj = tracksToGeoJSON(rowsToTracks(rows, pts))!;
    const toi = gj.features.find((f) => f.properties?.kind === "sap-toi")!;
    const c = (toi.geometry as GeoJSON.LineString).coordinates;
    expect(c[0]).toEqual([113.2, 20.1]); // tâm mới nhất
    expect(c[1]).toEqual([110.0, 20.5]);
  });

  it("vùng nguy hiểm là khung ĐÓNG (5 đỉnh, đỉnh cuối trùng đỉnh đầu)", () => {
    const gj = tracksToGeoJSON(rowsToTracks(rows, pts))!;
    const v = gj.features.find((f) => f.properties?.kind === "vung-nguy-hiem")!;
    const ring = (v.geometry as GeoJSON.Polygon).coordinates[0];
    expect(ring).toHaveLength(5);
    expect(ring[0]).toEqual(ring[4]);
  });

  it("mốc đã qua và mốc sắp tới phân biệt được bằng cờ tuongLai", () => {
    const gj = tracksToGeoJSON(rowsToTracks(rows, pts))!;
    const moc = gj.features.filter((f) => f.properties?.kind === "moc");
    expect(moc.filter((f) => f.properties?.tuongLai === false)).toHaveLength(2);
    expect(moc.filter((f) => f.properties?.tuongLai === true)).toHaveLength(1);
  });

  it("một bản tin duy nhất: chưa có đoạn ĐÃ ĐI (cần 2 điểm) nhưng vẫn có mốc", () => {
    const gj = tracksToGeoJSON(rowsToTracks([rows[0]], []))!;
    expect(gj.features.some((f) => f.properties?.kind === "qua-khu")).toBe(false);
    expect(gj.features.filter((f) => f.properties?.kind === "moc")).toHaveLength(1);
  });

  it("không có gì để vẽ → null (chỗ gọi bỏ hẳn Source)", () => {
    expect(tracksToGeoJSON([])).toBeNull();
  });
});

/*  VÒNG TRÒN BÁN KÍNH GIÓ MẠNH — chỉ vẽ khi bản tin GHI THẲNG con số.
 *
 *  Chủ dự án hỏi "sao không phải vòng tròn tương tự các dự báo bão khác": vòng
 *  tròn trên web bão quốc tế là NÓN BẤT ĐỊNH, dựng từ bảng sai số dự báo mà
 *  chính cơ quan đó công bố (JMA/NHC có). NCHMF KHÔNG công bố bảng ấy — nên
 *  vòng tròn duy nhất app được phép vẽ là BÁN KÍNH GIÓ MẠNH mà bản tin BÃO ghi
 *  ra bằng chữ. Bản tin ÁP THẤP NHIỆT ĐỚI không có ⇒ không vẽ vòng nào. */
describe("vòng tròn bán kính gió mạnh", () => {
  const rowBao = (radius: number | null) =>
    hang({
      id: "b",
      issued_at: "2026-08-18T07:00:00Z",
      la_bao: true,
      so_bao: "5",
      lat: 20,
      lon: 113,
      radius_km: radius,
    });

  it("bản tin BÃO có bán kính → vẽ vòng tròn quanh tâm hiện tại", () => {
    const gj = tracksToGeoJSON(rowsToTracks([rowBao(250)], []))!;
    const v = gj.features.find((f) => f.properties?.kind === "ban-kinh");
    expect(v).toBeDefined();
    expect(v!.properties?.km).toBe(250);
  });

  it("bản tin ÁP THẤP (không có bán kính) → KHÔNG vẽ vòng nào", () => {
    const gj = tracksToGeoJSON(rowsToTracks([rowBao(null)], []))!;
    expect(gj.features.some((f) => f.properties?.kind === "ban-kinh")).toBe(false);
  });

  it("vòng ĐÓNG và đúng số đỉnh", () => {
    const ring = vongTron(20, 113, 250);
    expect(ring).toHaveLength(VONG_DINH + 1);
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });

  it("MỌI đỉnh cách tâm ĐÚNG bán kính — không dẹt thành hình trứng", () => {
    /*  Phép cộng-độ theo mặt phẳng (km/111,32 cho vĩ, chia cos(lat) cho kinh)
        đo lại ra 249,4 km ở 20°N vì cos chỉ đúng tại tâm. Ca này khoá việc
        dùng công thức điểm đích trên mặt cầu, sai số dưới 0,5 km. */
    const [lat, lon, km] = [20, 113, 250];
    for (const p of vongTron(lat, lon, km)) {
      expect(khoangCachKm(lat, lon, p[1], p[0])).toBeCloseTo(km, 0);
    }
  });

  it("vẽ quanh tâm MỚI NHẤT, không phải tâm đầu tiên", () => {
    const cu = hang({ id: "a", issued_at: "2026-08-18T01:00:00Z", lat: 19, lon: 118, radius_km: 250 });
    const gj = tracksToGeoJSON(rowsToTracks([cu, rowBao(250)], []))!;
    const ring = (gj.features.find((f) => f.properties?.kind === "ban-kinh")!
      .geometry as GeoJSON.Polygon).coordinates[0];
    // tâm vòng = trung bình đỉnh; phải bám tâm mới (20N, 113E)
    const cLat = ring.reduce((a, p) => a + p[1], 0) / ring.length;
    expect(cLat).toBeCloseTo(20, 1);
  });

  it("bán kính 0 hoặc âm → không vẽ (số rác, không phải vòng bán kính 0)", () => {
    const gj = tracksToGeoJSON(rowsToTracks([rowBao(0)], []))!;
    expect(gj.features.some((f) => f.properties?.kind === "ban-kinh")).toBe(false);
  });
});

describe("nhanMoc — giờ VN, không ISO", () => {
  it("in theo UTC+7", () => {
    // 00:00 UTC 19/8 = 07:00 giờ VN cùng ngày
    expect(nhanMoc(Date.UTC(2026, 7, 19, 0))).toBe("7h 19/8");
  });
  it("qua nửa đêm VN thì sang ngày hôm sau", () => {
    // 18:00 UTC 18/8 = 01:00 giờ VN 19/8
    expect(nhanMoc(Date.UTC(2026, 7, 18, 18))).toBe("1h 19/8");
  });
  it("không có giờ → chuỗi rỗng, không in 'Invalid Date'", () => {
    expect(nhanMoc(null)).toBe("");
    expect(nhanMoc(NaN)).toBe("");
  });
});

describe("nối khoá khi áp thấp mạnh lên thành bão", () => {
  const truoc = {
    key: "atnd-20260818",
    issuedAt: Date.UTC(2026, 7, 18, 1),
    lat: 19.8,
    lon: 117.6,
  };

  it("bản tin sau có 'bão số 5' ⇒ khoá mới, và khoá ATNĐ cũ được đổi tên", () => {
    const b = tin({ laBao: true, soBao: "5", issuedAt: Date.UTC(2026, 7, 18, 7), lat: 20.1, lon: 113.2 });
    const khoaMoi = stormKeyFor(b, truoc);
    expect(khoaMoi).toBe("bao-so-5-2026");
    expect(khoaCanDoiTen(b, truoc, khoaMoi)).toBe("atnd-20260818");
  });

  it("cơn khác hẳn (cách 3 ngày) thì KHÔNG nối — đường không nhảy ngang biển", () => {
    const b = tin({ laBao: true, soBao: "5", issuedAt: Date.UTC(2026, 7, 21, 7) });
    expect(khoaCanDoiTen(b, truoc, stormKeyFor(b, truoc))).toBeNull();
  });

  it("tâm nhảy quá xa thì KHÔNG nối dù cùng ngày", () => {
    const b = tin({ laBao: true, soBao: "5", issuedAt: Date.UTC(2026, 7, 18, 7), lat: 10, lon: 105 });
    expect(khoaCanDoiTen(b, truoc, stormKeyFor(b, truoc))).toBeNull();
  });

  it("bão số này → bão số khác KHÔNG bao giờ đổi tên hàng cũ", () => {
    const cuBao = { ...truoc, key: "bao-so-4-2026" };
    const b = tin({ laBao: true, soBao: "5", issuedAt: Date.UTC(2026, 7, 18, 7), lat: 20.1, lon: 113.2 });
    expect(khoaCanDoiTen(b, cuBao, "bao-so-5-2026")).toBeNull();
  });

  it("khoá không đổi thì không có gì để đổi tên", () => {
    const b = tin({ issuedAt: Date.UTC(2026, 7, 18, 7), lat: 20.1, lon: 113.2 });
    expect(stormKeyFor(b, truoc)).toBe("atnd-20260818");
    expect(khoaCanDoiTen(b, truoc, "atnd-20260818")).toBeNull();
  });

  it("noiTiep: thiếu giờ ở một bên ⇒ KHÔNG dám nối", () => {
    expect(noiTiep(tin({ issuedAt: null }), truoc)).toBe(false);
    expect(noiTiep(tin(), { ...truoc, issuedAt: null })).toBe(false);
    expect(noiTiep(tin(), null)).toBe(false);
  });
});

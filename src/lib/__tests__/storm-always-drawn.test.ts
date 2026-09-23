import { describe, it, expect } from "vitest";

import {
  tracksToGeoJSON,
  rowsToTracks,
  ONG_BAO_MUC,
  type StormTrack,
  type BulletinRow,
  type ForecastRow,
} from "../storm-track";

/*  CÓ BÃO LÀ PHẢI VẼ VÙNG NGUY HIỂM — chủ dự án 2026-09-02: *"sao ko vẽ? kiểm
    tra để đảm bảo có bão là luôn vẽ"*.

    Đây là feature AN TOÀN. Mỗi mảnh dữ liệu parse hụt mà làm nó tắt câm là một
    lần bà con nhìn thấy đường bão chạy tới nhưng không thấy vùng phải tránh.
    Luật: parse được tới đâu vẽ tới đó, thiếu thì LÙI một nấc, KHÔNG BAO GIỜ lùi
    về không vẽ gì. */

const P = (lat: number, lon: number, at = 1) => ({ lat, lon, at, cap: 8, giat: 10 });
/** mốc DỰ BÁO — `danger` là hộp bản tin ghi thẳng, ở đây không có nên null */
const F = (lat: number, lon: number, at = 1) => ({ ...P(lat, lon, at), danger: null });

function track(over: Partial<StormTrack> = {}): StormTrack {
  return {
    key: "b1",
    name: "Áp thấp nhiệt đới số 05",
    past: [P(12, 110), P(13, 111)],
    forecast: [],
    radiusKm: null,
    buTuTinLuc: null,
    ...over,
  } as StormTrack;
}

/** Có feature nào là vùng nguy hiểm không (ống bám tuyến HOẶC dải đồng tâm). */
function coVungNguyHiem(g: GeoJSON.FeatureCollection | null): boolean {
  if (!g) return false;
  return g.features.some(
    (f) => f.properties?.kind === "ong" || f.properties?.kind === "ong-tron",
  );
}

describe("mọi ca có bão đều PHẢI có vùng nguy hiểm", () => {
  it("CÓ đường dự báo ⇒ ống bám tuyến", () => {
    const g = tracksToGeoJSON([track({ forecast: [F(14, 112), F(15, 113)] })]);
    expect(coVungNguyHiem(g)).toBe(true);
    expect(g!.features.some((f) => f.properties?.kind === "ong")).toBe(true);
  });

  it("KHÔNG có đường dự báo (ca 2/9) ⇒ LÙI VỀ dải đồng tâm, KHÔNG bỏ trống", () => {
    /*  Ca thật trong ảnh: vệt quá khứ đủ tới 7h 2/9, không parse ra mốc dự báo
        nào. Bản cũ ra `veOng = false` rồi thôi — không vẽ gì. */
    const g = tracksToGeoJSON([track({ forecast: [] })]);
    expect(coVungNguyHiem(g)).toBe(true);
    const dai = g!.features.filter((f) => f.properties?.kind === "ong-tron");
    expect(dai).toHaveLength(ONG_BAO_MUC.length);
  });

  it("dải đồng tâm dùng ĐÚNG bộ bán kính của ống — không đẻ ngưỡng mới", () => {
    const g = tracksToGeoJSON([track({ forecast: [] })]);
    const mucs = g!.features
      .filter((f) => f.properties?.kind === "ong-tron")
      .map((f) => f.properties?.muc as number)
      .sort();
    expect(mucs).toEqual(ONG_BAO_MUC.map((_, i) => i));
  });

  it("chỉ có MỘT điểm quá khứ (bản tin đầu tiên) ⇒ vẫn vẽ vùng", () => {
    const g = tracksToGeoJSON([track({ past: [P(12, 110)], forecast: [] })]);
    expect(coVungNguyHiem(g)).toBe(true);
  });

  it("QUÉT: mọi tổ hợp số mốc quá khứ × dự báo đều có vùng nguy hiểm", () => {
    const thieu: string[] = [];
    for (const nPast of [1, 2, 3])
      for (const nFc of [0, 1, 2]) {
        const t = track({
          past: Array.from({ length: nPast }, (_, i) => P(12 + i, 110 + i)),
          forecast: Array.from({ length: nFc }, (_, i) => F(15 + i, 113 + i)),
        });
        if (!coVungNguyHiem(tracksToGeoJSON([t])))
          thieu.push(`past=${nPast} forecast=${nFc}`);
      }
    expect(thieu).toEqual([]);
  });

  it("KHÔNG có bão thì KHÔNG vẽ gì (đừng doạ suông)", () => {
    expect(tracksToGeoJSON([])).toBeNull();
  });

  it("mốc dự báo luôn khai `dangerKm` để popup nói được bán kính", () => {
    const g = tracksToGeoJSON([track({ forecast: [F(14, 112)] })]);
    const moc = g!.features.find(
      (f) => f.properties?.kind === "moc" && f.properties?.tuongLai === true,
    );
    expect(moc!.properties!.dangerKm).toBe(ONG_BAO_MUC[ONG_BAO_MUC.length - 1]);
  });
});

/*  TIN MỚI THIẾU ⇒ MƯỢN TIN CŨ — chủ dự án 2026-09-02: *"nếu tin mới mà nó ko đủ
    thì dùng toạ độ tâm mới còn các phần kia dùng info của tin cũ bù vào, chủ yếu
    để thị giác đáp ứng, nó vẫn chính xác tương đối về bán kính các kiểu mà"*.

    Thứ tự lùi: (1) dữ liệu của tin mới → (2) mượn tin cũ, tâm vẫn của tin mới →
    (3) dải đồng tâm quanh tâm. Không bao giờ có nấc (4) "không vẽ gì". */

const NOW = Date.parse("2026-09-02T09:00:00Z");

function hang(p: Partial<BulletinRow> & { id: string; issued_at: string }): BulletinRow {
  return {
    storm_key: "bao-so-6-2026",
    observed_at: null,
    la_bao: true,
    so_bao: "6",
    lat: 15,
    lon: 112,
    cap: 9,
    giat: 11,
    radius_km: null,
    ...p,
  };
}

const moc = (bulletin_id: string, lat: number, lon: number, valid_at: string): ForecastRow => ({
  bulletin_id,
  valid_at,
  lat,
  lon,
  cap: 9,
  giat: 11,
  danger_box: null,
  seq: 0,
});

describe("tin mới parse hụt ⇒ mượn tin cũ, KHÔNG để trống", () => {
  const cu = hang({ id: "cu", issued_at: "2026-09-02T01:00:00Z", lat: 14, lon: 113, radius_km: 250 });
  const moi = hang({ id: "moi", issued_at: "2026-09-02T07:00:00Z", lat: 15.4, lon: 111.2 });
  const ptsCu = [moc("cu", 17, 109, "2026-09-03T01:00:00Z")];

  it("tin mới KHÔNG có mốc dự báo ⇒ lấy mốc của tin cũ", () => {
    const [t] = rowsToTracks([cu, moi], ptsCu, NOW);
    expect(t.forecast.map((p) => p.lat)).toEqual([17]);
    expect(t.buTuTinLuc).toBe(Date.parse(cu.issued_at));
  });

  it("TÂM vẫn là của tin MỚI — mượn phần dự báo chứ không mượn vị trí", () => {
    const [t] = rowsToTracks([cu, moi], ptsCu, NOW);
    const tam = t.past[t.past.length - 1];
    expect([tam.lat, tam.lon]).toEqual([15.4, 111.2]);
  });

  it("tin mới KHÔNG ghi bán kính gió mạnh ⇒ lấy số của tin cũ", () => {
    const [t] = rowsToTracks([cu, moi], [], NOW);
    expect(t.radiusKm).toBe(250);
    // và vòng bán kính được VẼ quanh tâm mới
    const g = tracksToGeoJSON([t])!;
    expect(g.features.some((f) => f.properties?.kind === "ban-kinh")).toBe(true);
  });

  it("tin mới CÓ ĐỦ ⇒ KHÔNG mượn (tin mới luôn thắng)", () => {
    const [t] = rowsToTracks(
      [cu, hang({ ...moi, radius_km: 300 })],
      [...ptsCu, moc("moi", 18, 108, "2026-09-03T07:00:00Z")],
      NOW,
    );
    expect(t.forecast.map((p) => p.lat)).toEqual([18]);
    expect(t.radiusKm).toBe(300);
    expect(t.buTuTinLuc).toBeNull();
  });

  it("mốc mượn ĐÃ QUA GIỜ thì vẫn bỏ — không vẽ quá khứ thành dự báo", () => {
    const quaGio = [moc("cu", 17, 109, "2026-09-02T03:00:00Z")]; // < NOW
    // `cu` bản KHÔNG bán kính, để cờ mượn chỉ nói về đường dự báo
    const [t] = rowsToTracks([{ ...cu, radius_km: null }, moi], quaGio, NOW);
    expect(t.forecast).toHaveLength(0);
    expect(t.buTuTinLuc).toBeNull();
    // hết đường mượn ⇒ vẫn phải có vùng nguy hiểm (nấc 3)
    expect(
      tracksToGeoJSON([t])!.features.some((f) => f.properties?.kind === "ong-tron"),
    ).toBe(true);
  });

  it("mượn thì mốc dự báo KHAI giờ tin cũ để màn nói thật", () => {
    const [t] = rowsToTracks([cu, moi], ptsCu, NOW);
    const f = tracksToGeoJSON([t])!.features.find(
      (x) => x.properties?.kind === "moc" && x.properties?.tuongLai === true,
    );
    expect(f!.properties!.tinCuLuc).toBe(Date.parse(cu.issued_at));
  });

  it("gộp hai khoá cùng cơn: khoá mới chưa có dự báo ⇒ mượn của khoá cũ", () => {
    const a = hang({ id: "a", storm_key: "atnd-2026", la_bao: false, so_bao: null, issued_at: "2026-09-02T01:00:00Z", lat: 14, lon: 113 });
    const b = hang({ id: "b", storm_key: "bao-so-6-2026", issued_at: "2026-09-02T07:00:00Z", lat: 14.4, lon: 112.6 });
    const tracks = rowsToTracks([a, b], [moc("a", 17, 109, "2026-09-03T01:00:00Z")], NOW);
    expect(tracks).toHaveLength(1);
    expect(tracks[0].forecast.map((p) => p.lat)).toEqual([17]);
    expect(tracks[0].laBao).toBe(true); // vẫn là bản MỚI
  });
});

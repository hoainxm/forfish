// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { KM_PER_NM } from "@/lib/ais-cpa";
import { TAU_AIS_STORE_KEY, type TauAis, type TauAisBan } from "@/lib/tau-ais";
import { QUANH_GIO, fetchTauQuanh, gopTauQuanh, quanhGeoJson, tamHopLe, thamSoQuanh, tomTatQuanh, trangThaiQuanh, type TauQuanh } from "@/lib/tau-ais-quanh";

const TAM = { lat: 10.3, lon: 107.1 };
const NOW = Date.parse("2026-10-31T08:00:00Z");
const TU = Math.floor(NOW / 1000) - QUANH_GIO * 3600;
/** điểm cách tâm `nm` hải lý về phía Bắc */
const bac = (nm: number) => TAM.lat + nm / 60;

const tau = (o: Partial<TauAis>): TauAis => ({
  id: "111", ten: "BV 1234 TS", loai: 2, co: "VN", lat: TAM.lat, lon: TAM.lon, kn: 5, huong: 90, mui: 90, phut: 0, dai: 15, dich: null, mmsi: 574000001, ...o,
});
const ban = (ds: TauAis[], luc = new Date(NOW).toISOString()): TauAisBan => ({ v: 1, luc, soTau: ds.length, tau: ds });

describe("tàu quanh một điểm — gộp lộ trình + bản", () => {
  it("tàu lọt vòng ở một mốc trong 6 giờ ⇒ có, mốc gần nhất + mốc cuối đúng; ngoài vòng / quá 6 giờ ⇒ bỏ", () => {
    const vet = [
      { tau_id: "222", diem: [[TU - 60, TAM.lat, TAM.lon, 3, 0], [TU + 3600, bac(4), TAM.lon, 3, 0], [TU + 7200, bac(2), TAM.lon, 3, 0], [TU + 10800, bac(8), TAM.lon, 3, 0]] },
      { tau_id: "333", diem: [[TU + 3600, bac(7), TAM.lon, 3, 0]] },
      { tau_id: "444", diem: [[TU - 3600, TAM.lat, TAM.lon, 0, 0]] },
    ];
    const ds = gopTauQuanh({ vet, ban: null, tam: TAM, tuGiay: TU });
    expect(ds.map((t) => t.id)).toEqual(["222"]);
    expect(ds[0].gan.t).toBe(TU + 7200);
    expect(ds[0].gan.nm).toBeCloseTo(2, 1);
    expect(ds[0].cuoi).toBe(TU + 7200);
    expect(ds[0].conPhat).toBe(false);
    expect(ds[0].ten).toBeNull();
  });

  it("ghép tên/loại từ bản; tàu chỉ có trong bản (tin mới) cũng vào; gần nhất xếp trước", () => {
    const b = ban([tau({ id: "222", ten: "KH 9999 TS", loai: 7 }), tau({ id: "555", lat: bac(1), phut: 30 }), tau({ id: "666", lat: bac(9) })]);
    const vet = [{ tau_id: "222", diem: [[TU + 3600, bac(3), TAM.lon, 3, 0]] }];
    const ds = gopTauQuanh({ vet, ban: b, tam: TAM, tuGiay: TU });
    expect(ds.map((t) => t.id)).toEqual(["222", "555"]);
    const t222 = ds.find((t) => t.id === "222")!;
    expect(t222).toMatchObject({ ten: "KH 9999 TS", loai: 7, conPhat: true });
    // vị trí trong bản (ngay tâm) gần hơn mốc lộ trình ⇒ thay mốc gần nhất
    expect(t222.gan.nm).toBeLessThan(0.01);
    expect(ds.find((t) => t.id === "555")!.gan.t).toBe(Math.floor(NOW / 1000) - 30 * 60);
  });

  it("dòng hỏng không làm vỡ cả danh sách", () => {
    const vet = [{ tau_id: "", diem: [[TU + 1, TAM.lat, TAM.lon]] }, { tau_id: "777", diem: "x" }, { tau_id: "888", diem: [null, ["a", 1, 2], [TU + 5, TAM.lat, TAM.lon]] }];
    expect(gopTauQuanh({ vet, ban: null, tam: TAM, tuGiay: TU }).map((t) => t.id)).toEqual(["888"]);
  });

  it("tham số hàm SQL: hộp rộng hơn vòng, mốc giờ = now − 6 giờ; tâm ngoài vùng ⇒ chặn", () => {
    const ts = thamSoQuanh(TAM, NOW);
    expect(ts.p_tu).toBe(TU);
    expect(ts.p_km).toBeGreaterThan(6 * KM_PER_NM);
    expect(tamHopLe(10.3, 107.1)).toBe(true);
    expect(tamHopLe(40, 107)).toBe(false);
    expect(tamHopLe(NaN, 107)).toBe(false);
  });

  it("lớp bản đồ có vòng, nhãn, chấm chọn; chấm đang ở nằm ở vị trí mới nhất, có nhãn loại + trạng thái", () => {
    const t: TauQuanh = { id: "1", ten: null, loai: 2, co: null, mmsi: null, gan: { t: TU + 3600, lat: TAM.lat, lon: TAM.lon, nm: 0 }, cuoi: TU + 3600, conPhat: false };
    const o: TauQuanh = { ...t, id: "2", loai: 7, oDay: true, hienTai: { lat: bac(2), lon: TAM.lon, nm: 2 } };
    const g = quanhGeoJson(TAM, [t, o], "1", 6, NOW / 1000);
    expect(g.features.map((f) => f.properties.kind)).toEqual(["vong", "nhan", "tau", "tau"]);
    expect(g.features[2].properties).toMatchObject({ chon: 1, o: 0, nhan: "Cá · 5 giờ" });
    expect(g.features[3].properties).toMatchObject({ o: 1, nhan: "Hàng · đang ở" });
    expect((g.features[3].geometry as GeoJSON.Point).coordinates[1]).toBeCloseTo(bac(2), 5);
  });
});

describe("tàu quanh một điểm — đang ở / đã qua (anh Long 02/11)", () => {
  const nowS = NOW / 1000;
  const base: TauQuanh = { id: "x", ten: null, loai: 2, co: null, mmsi: null, gan: { t: 0, lat: TAM.lat, lon: TAM.lon, nm: 1.24 }, cuoi: 0, conPhat: false };

  it("gộp: tàu trong bản mới nhất còn trong vòng ⇒ đang ở, lên đầu; dau = mốc đầu trong vòng", () => {
    const vet = [{ tau_id: "c", diem: [[TU + 600, bac(1), TAM.lon], [TU + 4200, bac(2), TAM.lon], [TU + 7800, bac(3), TAM.lon]] }];
    const b = ban([tau({ id: "h", loai: 7, lat: bac(4) }), tau({ id: "c", lat: bac(20) })]);
    const ds = gopTauQuanh({ vet, ban: b, tam: TAM, tuGiay: TU });
    expect(ds.map((t) => [t.id, !!t.oDay])).toEqual([["h", true], ["c", false]]);
    expect(ds[1]).toMatchObject({ dau: TU + 600, cuoi: TU + 7800, loai: 2 });
    expect(ds[0].hienTai!.nm).toBeCloseTo(4, 1);
  });

  it("icon cùng bộ lớp AIS: chạy ⇒ tam giác xoay theo mũi, đứng ⇒ thoi; đã qua lấy hướng ở mốc gần nhất", () => {
    const vet = [{ tau_id: "c", diem: [[TU + 600, bac(1), TAM.lon, 8, 200], [TU + 4200, bac(5), TAM.lon, 0.2, 40]] }];
    const b = ban([tau({ id: "h", loai: 7, lat: bac(2), kn: 9, mui: 135 }), tau({ id: "d", loai: 8, lat: bac(3), kn: 0 })]);
    const geo = quanhGeoJson(TAM, gopTauQuanh({ vet, ban: b, tam: TAM, tuGiay: TU }), null, 6, NOW / 1000);
    const p = Object.fromEntries(geo.features.filter((f) => f.properties.kind === "tau").map((f) => [f.properties.id, f.properties]));
    expect(p.h).toMatchObject({ mk: "hang", chay: 1, huong: 135, o: 1 });
    expect(p.d).toMatchObject({ mk: "dau", chay: 0, o: 1 });
    expect(p.c).toMatchObject({ mk: "khac", chay: 1, huong: 200, o: 0 }); // đã rời bản ⇒ chưa rõ loại ⇒ icon xám
  });

  it("câu trạng thái: đang ở · ở quanh ~N giờ · chạy qua", () => {
    expect(trangThaiQuanh({ ...base, loai: 7, oDay: true, hienTai: { lat: 0, lon: 0, nm: 2 } }, nowS)).toEqual({ oDay: true, chip: "Đang ở", cau: "Tàu hàng · đang ở đây, cách 2,0 hải lý" });
    const o3 = trangThaiQuanh({ ...base, dau: nowS - 6 * 3600, cuoi: nowS - 3 * 3600 }, nowS);
    expect(o3).toEqual({ oDay: false, chip: "3 giờ", cau: "Tàu cá · ở quanh đây ~3 giờ, rời 3 giờ trước" });
    const qua = trangThaiQuanh({ ...base, loai: 7, dau: nowS - 5 * 3600, cuoi: nowS - 5 * 3600 }, nowS);
    expect(qua.cau).toBe("Tàu hàng · chạy qua 5 giờ trước, gần nhất 1,2 hải lý");
  });

  it("tóm tắt: bây giờ ai ở đây + đã qua nhóm theo loại, nhóm mới qua trước", () => {
    const ds: TauQuanh[] = [
      { ...base, id: "1", loai: 7, oDay: true },
      { ...base, id: "2", loai: 2, cuoi: nowS - 3 * 3600 },
      { ...base, id: "3", loai: 2, cuoi: nowS - 4 * 3600 },
      { ...base, id: "4", loai: 7, cuoi: nowS - 5 * 3600 },
    ];
    expect(tomTatQuanh(ds, nowS)).toEqual({ bayGio: "Bây giờ: 1 tàu hàng", daQua: "Đã qua: 2 tàu cá (gần nhất 3 giờ trước), 1 tàu hàng (5 giờ trước)" });
    expect(tomTatQuanh(ds.slice(1), nowS).bayGio).toBe("Bây giờ: không có tàu nào phát AIS ở đây");
    // loại 0 = đã rời bản, lộ trình không giữ loại ⇒ nói thật
    expect(trangThaiQuanh({ ...base, loai: 0, cuoi: nowS - 3600 }, nowS).cau).toMatch(/^Tàu chưa rõ loại · chạy qua/);
    expect(quanhGeoJson(TAM, [{ ...base, loai: 0, cuoi: nowS - 3600 }], null, 6, nowS).features[2].properties.nhan).toBe("Chưa rõ · 1 giờ");
  });
});

describe("tàu quanh một điểm — máy", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("mất sóng ⇒ tính từ bản lưu trong máy, cờ chiBan + tuMay; không có bản ⇒ null", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await fetchTauQuanh(TAM, NOW)).toBeNull();
    localStorage.setItem(TAU_AIS_STORE_KEY, JSON.stringify(ban([tau({ id: "555", lat: bac(1) }), tau({ id: "666", lat: bac(9) })])));
    const kq = await fetchTauQuanh(TAM, NOW);
    expect(kq).toMatchObject({ chiBan: true, tuMay: true });
    expect(kq!.tau.map((t) => t.id)).toEqual(["555"]);
  });

  it("máy chủ trả lời ⇒ dùng nguyên danh sách máy chủ", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, luc: "x", chiBan: false, tau: [{ id: "9" }] }), { status: 200 })));
    const kq = await fetchTauQuanh(TAM, NOW);
    expect(kq).toMatchObject({ chiBan: false, tuMay: false, luc: "x" });
    expect(kq!.tau).toHaveLength(1);
  });
});

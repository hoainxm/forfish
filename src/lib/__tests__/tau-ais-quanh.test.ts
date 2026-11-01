// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { KM_PER_NM } from "@/lib/ais-cpa";
import { TAU_AIS_STORE_KEY, type TauAis, type TauAisBan } from "@/lib/tau-ais";
import { QUANH_GIO, dongPhuQuanh, fetchTauQuanh, gopTauQuanh, quanhGeoJson, tamHopLe, thamSoQuanh, type TauQuanh } from "@/lib/tau-ais-quanh";

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

  it("câu phụ giờ VN + lớp bản đồ có vòng, nhãn, chấm chọn", () => {
    const t: TauQuanh = { id: "1", ten: null, loai: 2, co: null, mmsi: null, gan: { t: Date.parse("2026-10-31T07:00:00Z") / 1000, lat: TAM.lat, lon: TAM.lon, nm: 1.24 }, cuoi: 0, conPhat: false };
    expect(dongPhuQuanh(t)).toBe("Gần nhất 1,2 hải lý lúc 14:00 · đã tắt hoặc đi xa");
    const g = quanhGeoJson(TAM, [t], "1");
    expect(g.features.map((f) => f.properties.kind)).toEqual(["vong", "nhan", "tau"]);
    expect(g.features[2].properties.chon).toBe(1);
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

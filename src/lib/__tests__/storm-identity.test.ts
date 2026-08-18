import { describe, expect, it } from "vitest";
import {
  cungCon,
  gopNguonBao,
  nguongTrungKm,
  soBaoTuTen,
  stormKeyOf,
  TRUNG_KM,
  TOC_DO_BAO_KMH,
} from "@/lib/storm-identity";
import { stormKeyFor, type NchmfBulletin } from "@/lib/storm-bulletin";
import type { StormAlert } from "@/lib/storms";

const T0 = Date.UTC(2026, 7, 18, 3, 0);
const H = 3600_000;

function bao(over: Partial<StormAlert> = {}): StormAlert {
  return {
    id: "1001234",
    name: "WUTIP",
    kindLabel: "Bão",
    windKmh: 95,
    lat: 15,
    lon: 112,
    alert: "watch",
    updated: new Date(T0).toISOString(),
    track: [],
    areas: [],
    ...over,
  };
}

describe("cungCon — cùng cơn theo tâm + thời gian, không nhìn tên/nguồn", () => {
  it("cùng lúc, cách 300 km → cùng; 400 km → khác", () => {
    // ~1° vĩ ≈ 111 km
    expect(cungCon({ lat: 15, lon: 112, tMs: T0 }, { lat: 17.7, lon: 112, tMs: T0 })).toBe(true);
    expect(cungCon({ lat: 15, lon: 112, tMs: T0 }, { lat: 18.7, lon: 112, tMs: T0 })).toBe(false);
  });
  it("cách 20 giờ thì nới thêm 20×30 km: 900 km vẫn cùng cơn", () => {
    expect(nguongTrungKm(20)).toBe(TRUNG_KM + 20 * TOC_DO_BAO_KMH);
    expect(cungCon({ lat: 15, lon: 112, tMs: T0 }, { lat: 23, lon: 112, tMs: T0 + 20 * H })).toBe(true);
    // 1.100 km thì không
    expect(cungCon({ lat: 15, lon: 112, tMs: T0 }, { lat: 25, lon: 112, tMs: T0 + 20 * H })).toBe(false);
  });
  it("nới có trần 48 giờ; thiếu giờ thì coi như cùng lúc", () => {
    expect(nguongTrungKm(200)).toBe(nguongTrungKm(48));
    expect(cungCon({ lat: 15, lon: 112 }, { lat: 17, lon: 112 })).toBe(true);
  });
  it("toạ độ rác → không cùng", () => {
    expect(cungCon({ lat: NaN, lon: 112 }, { lat: 15, lon: 112 })).toBe(false);
  });
});

describe("stormKeyOf — cùng khuôn với kho bản tin (stormKeyFor)", () => {
  it("bão số 5 của NCHMF → bao-so-5-2026, trùng khoá kho", () => {
    const s = bao({ id: "nchmf-9", name: "số 5" });
    const b: NchmfBulletin = {
      issuedAt: T0,
      observedAt: T0,
      laBao: true,
      soBao: "5",
      lat: 15,
      lon: 112,
      cap: 9,
      giat: 11,
      dir: null,
      speedKmh: null,
      radiusKm: null,
      danger: null,
      risk: null,
      forecast: [],
      url: null,
    } as NchmfBulletin;
    expect(stormKeyOf(s, T0)).toBe("bao-so-5-2026");
    expect(stormKeyFor(b)).toBe("bao-so-5-2026");
  });
  it("áp thấp không tên → theo ngày + tâm thấy đầu tiên; GDACS → theo tên", () => {
    expect(stormKeyOf(bao({ id: "nchmf-1", name: "" }), T0)).toBe("atnd-20260818-15.0-112.0");
    expect(stormKeyOf(bao(), T0)).toBe("gdacs-wutip");
    expect(stormKeyOf(bao({ name: "" }), T0)).toBe("gdacs-1001234");
  });
  it("soBaoTuTen đọc 'số 3', 'Bão số 12'", () => {
    expect(soBaoTuTen("số 3")).toBe(3);
    expect(soBaoTuTen("Bão số 12")).toBe(12);
    expect(soBaoTuTen("WUTIP")).toBeNull();
  });
});

describe("gopNguonBao — VN trước, GDACS bổ sung, cùng cơn thì mượn track/areas", () => {
  it("cùng cơn: giữ tin VN, mượn polygon GDACS; GDACS không bị lặp", () => {
    const vn = bao({ id: "nchmf-1", name: "số 3", track: [], areas: [] });
    const gd = bao({ lat: 15.5, lon: 112.5, track: [[112, 15]], areas: [[[[1, 1]]]] });
    const out = gopNguonBao([vn], [gd]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("nchmf-1");
    expect(out[0].track).toEqual(gd.track);
    expect(out[0].areas).toEqual(gd.areas);
  });
  it("khác cơn (cách 1.000 km) → cả hai, VN đứng trước", () => {
    const vn = bao({ id: "nchmf-1", name: "số 3", lat: 8, lon: 106 });
    const gd = bao({ lat: 17, lon: 118 });
    expect(gopNguonBao([vn], [gd]).map((s) => s.id)).toEqual(["nchmf-1", "1001234"]);
  });
  it("một GDACS chỉ được ghép cho một tin VN", () => {
    const vn1 = bao({ id: "nchmf-1", name: "số 3", lat: 15, lon: 112 });
    const vn2 = bao({ id: "nchmf-2", name: "", lat: 15.5, lon: 112.5 });
    const gd = bao({ lat: 15.2, lon: 112.2, track: [[1, 1]] });
    const out = gopNguonBao([vn1, vn2], [gd]);
    expect(out).toHaveLength(2);
    expect(out.filter((s) => s.track.length).length).toBe(1);
  });
});

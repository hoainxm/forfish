import { describe, expect, it } from "vitest";
import {
  capGioTuKmh,
  decideStormPushes,
  parseStormPushUrl,
  stormKey,
  stormPushCopy,
  stormPushUrl,
  stormSeverity,
  STORM_REMIND_MS,
  type SentStormRecord,
} from "@/lib/storm-push";
import { capGioSangKmh } from "@/lib/storms-vn";
import type { StormAlert } from "@/lib/storms";

// 10:00 giờ VN 18/08/2026 = 03:00 UTC
const NGAY = Date.UTC(2026, 7, 18, 3, 0);
// 23:30 giờ VN — bão đẩy giờ nào cũng đẩy, KHÔNG có giờ khuya (chủ dự án 2026-08-18b)
const KHUYA = Date.UTC(2026, 7, 18, 16, 30);

function bao(over: Partial<StormAlert> = {}): StormAlert {
  return {
    id: "1001234",
    name: "WUTIP",
    kindLabel: "Bão",
    windKmh: 95,
    lat: 15,
    lon: 112,
    alert: "watch",
    updated: new Date(NGAY - 30 * 60_000).toISOString(),
    track: [],
    areas: [],
    ...over,
  };
}

function daGui(s: StormAlert, atMs: number): SentStormRecord {
  const tMs = Date.parse(s.updated);
  return {
    url: stormPushUrl(stormKey(s, tMs), stormSeverity(s), { lat: s.lat, lon: s.lon, tMs }),
    created_at: new Date(atMs).toISOString(),
  };
}

describe("stormKey — khoá theo CƠN, cùng khuôn với kho bản tin", () => {
  it("GDACS: gdacs-<tên>", () => {
    expect(stormKey(bao(), NGAY)).toBe("gdacs-wutip");
  });
  it("NCHMF: hai bản tin (post khác nhau) cùng 'bão số 3' → cùng khoá bao-so-3-YYYY", () => {
    const a = bao({ id: "nchmf-12345", name: "số 3" });
    const b = bao({ id: "nchmf-12399", name: "số 3" });
    expect(stormKey(a, NGAY)).toBe("bao-so-3-2026");
    expect(stormKey(b, NGAY)).toBe(stormKey(a, NGAY));
  });
  it("NCHMF áp thấp không tên → atnd-YYYYMMDD-lat-lon; hai áp thấp khác chỗ = hai khoá", () => {
    const a = bao({ id: "nchmf-555", name: "", lat: 15, lon: 112 });
    const b = bao({ id: "nchmf-556", name: "", lat: 8, lon: 105 });
    expect(stormKey(a, NGAY)).toBe("atnd-20260818-15.0-112.0");
    expect(stormKey(b, NGAY)).not.toBe(stormKey(a, NGAY));
  });
});

describe("URL vừa là đường mở app vừa là sổ đã gửi", () => {
  it("ghi rồi đọc lại ra đúng khoá + cấp + tâm", () => {
    const s = bao({ alert: "danger", kindLabel: "Bão mạnh" });
    const tMs = Date.parse(s.updated);
    const url = stormPushUrl(stormKey(s, tMs), stormSeverity(s), { lat: s.lat, lon: s.lon, tMs });
    expect(url.startsWith("/ngu-truong?bao=gdacs-wutip&cap=danger")).toBe(true);
    expect(parseStormPushUrl(url)).toEqual({
      key: "gdacs-wutip",
      sev: { alert: 1, kind: 3 },
      tam: { lat: 15, lon: 112, tMs: Math.round(tMs / 1000) * 1000 },
    });
  });
  it("URL đời cũ không có tâm → tam null, vẫn đọc được khoá", () => {
    expect(parseStormPushUrl("/ngu-truong?bao=x&cap=watch&muc=2")).toEqual({
      key: "x",
      sev: { alert: 0, kind: 2 },
      tam: null,
    });
  });
  it("URL không phải bão → null", () => {
    expect(parseStormPushUrl("/tau?tab=san-pham")).toBeNull();
    expect(parseStormPushUrl(null)).toBeNull();
  });
});

describe("capGioTuKmh — khớp hai chiều với capGioSangKmh (storms-vn)", () => {
  it("cap → km/h → cap trả về đúng cấp, 6..17", () => {
    for (let cap = 6; cap <= 17; cap++) {
      const kmh = capGioSangKmh(cap);
      expect(kmh, `cấp ${cap}`).not.toBeNull();
      expect(capGioTuKmh(kmh!), `cấp ${cap} (${kmh} km/h)`).toBe(cap);
    }
  });
  it("dưới cấp 6 hoặc không có số → null", () => {
    expect(capGioTuKmh(20)).toBeNull();
    expect(capGioTuKmh(null)).toBeNull();
  });
});

describe("stormPushCopy — chữ bà con đọc", () => {
  it("bão có tên: tiêu đề + gió + cấp + dặn nghe đài", () => {
    const c = stormPushCopy(bao({ windKmh: 95 }));
    expect(c.title).toBe("Bão WUTIP trên Biển Đông");
    expect(c.body).toBe(
      "Gió mạnh nhất ~95 km/giờ (cấp 10). Đừng ra khơi vùng ảnh hưởng — nghe đài duyên hải.",
    );
  });
  it("áp thấp không tên: không có hai dấu cách", () => {
    const c = stormPushCopy(bao({ id: "nchmf-1", name: "", kindLabel: "Áp thấp nhiệt đới", windKmh: 43 }));
    expect(c.title).toBe("Áp thấp nhiệt đới trên Biển Đông");
    expect(c.body.startsWith("Gió mạnh nhất ~43 km/giờ (cấp 6).")).toBe(true);
  });
  it("không rõ gió → nói thẳng, không bịa số", () => {
    expect(stormPushCopy(bao({ windKmh: null })).body.startsWith("Chưa rõ sức gió.")).toBe(true);
  });
});

describe("decideStormPushes", () => {
  it("bão MỚI (chưa có trong sổ) → đẩy, tag theo khoá, sentAt = giờ phát tin", () => {
    const s = bao();
    const out = decideStormPushes([s], [], NGAY);
    expect(out).toHaveLength(1);
    expect(out[0].reason).toBe("moi");
    expect(out[0].tag).toBe("bao-gdacs-wutip");
    expect(out[0].sentAtMs).toBe(Date.parse(s.updated));
    expect(out[0].url.startsWith("/ngu-truong?bao=gdacs-wutip&cap=watch&muc=2&lat=15.00&lon=112.00&t=")).toBe(true);
  });
  it("đã gửi rồi, không đổi gì → im", () => {
    const s = bao();
    expect(decideStormPushes([s], [daGui(s, NGAY - 3600_000)], NGAY)).toEqual([]);
  });
  it("LÊN CẤP watch → danger → đẩy lại ngay dù vừa gửi", () => {
    const truoc = bao({ alert: "watch" });
    const sau = bao({ alert: "danger" });
    const out = decideStormPushes([sau], [daGui(truoc, NGAY - 10 * 60_000)], NGAY);
    expect(out.map((p) => p.reason)).toEqual(["len-cap"]);
  });
  it("LÊN CẤP nhãn Bão → Bão mạnh (cùng danger) → đẩy lại", () => {
    const truoc = bao({ alert: "danger", kindLabel: "Bão" });
    const sau = bao({ alert: "danger", kindLabel: "Bão mạnh", windKmh: 130 });
    const out = decideStormPushes([sau], [daGui(truoc, NGAY - 10 * 60_000)], NGAY);
    expect(out.map((p) => p.reason)).toEqual(["len-cap"]);
  });
  it("HẠ CẤP danger → watch → im (không nhắc chuyện đỡ nguy hiểm)", () => {
    const truoc = bao({ alert: "danger" });
    const sau = bao({ alert: "watch" });
    expect(decideStormPushes([sau], [daGui(truoc, NGAY - 3600_000)], NGAY)).toEqual([]);
  });
  it("vẫn danger >12h chưa nhắc → NHẮC LẠI; <12h → im; watch lâu → im", () => {
    const d = bao({ alert: "danger" });
    expect(
      decideStormPushes([d], [daGui(d, NGAY - STORM_REMIND_MS - 1)], NGAY).map((p) => p.reason),
    ).toEqual(["nhac-lai"]);
    expect(decideStormPushes([d], [daGui(d, NGAY - STORM_REMIND_MS + 60_000)], NGAY)).toEqual([]);
    const w = bao({ alert: "watch" });
    expect(decideStormPushes([w], [daGui(w, NGAY - 30 * 3600_000)], NGAY)).toEqual([]);
  });
  it("lấy lần gửi CUỐI để so, không phải lần đầu", () => {
    const w = bao({ alert: "watch" });
    const d = bao({ alert: "danger" });
    // đã gửi watch (cũ) rồi danger (mới nhất, 1h trước) → giờ vẫn danger → im
    const so = [daGui(w, NGAY - 20 * 3600_000), daGui(d, NGAY - 3600_000)];
    expect(decideStormPushes([d], so, NGAY)).toEqual([]);
  });
  it("KHÔNG CÓ GIỜ KHUYA: 23:30 watch lẫn danger đều đi", () => {
    const w = bao({ id: "1", name: "A", alert: "watch", lat: 8, lon: 105 });
    const d = bao({ id: "2", name: "B", alert: "danger", lat: 18, lon: 118 });
    const out = decideStormPushes([w, d], [], KHUYA);
    expect(out.map((p) => p.key).sort()).toEqual(["gdacs-a", "gdacs-b"]);
  });
  it("NỐI CƠN theo vị trí: ATNĐ không tên đã gửi → 6h sau thành 'bão số 3' cách 120 km = LÊN CẤP, giữ khoá cũ", () => {
    const atnd = bao({ id: "nchmf-1", name: "", kindLabel: "Áp thấp nhiệt đới", lat: 15, lon: 112,
      updated: new Date(NGAY - 6 * 3600_000).toISOString() });
    const bao3 = bao({ id: "nchmf-2", name: "số 3", kindLabel: "Bão", lat: 15.8, lon: 111.2 });
    const out = decideStormPushes([bao3], [daGui(atnd, NGAY - 6 * 3600_000)], NGAY);
    expect(out.map((p) => p.reason)).toEqual(["len-cap"]);
    expect(out[0].key).toBe(stormKey(atnd, Date.parse(atnd.updated)));
    expect(out[0].tag).toBe(`bao-${out[0].key}`);
  });
  it("NỐI CƠN đổi nguồn: tin VN đã gửi, lượt sau VN hỏng chỉ còn GDACS cùng chỗ → KHÔNG phải bão mới", () => {
    const vn = bao({ id: "nchmf-1", name: "số 3", lat: 15, lon: 112 });
    const gd = bao({ id: "1001234", name: "WUTIP", lat: 15.3, lon: 112.4 });
    expect(decideStormPushes([gd], [daGui(vn, NGAY - 3600_000)], NGAY)).toEqual([]);
  });
  it("hai áp thấp không tên cách 1.000 km trong cùng ngày = HAI cơn, hai push", () => {
    const a = bao({ id: "nchmf-1", name: "", lat: 18, lon: 118 });
    const b = bao({ id: "nchmf-2", name: "", lat: 8, lon: 106 });
    expect(decideStormPushes([a, b], [], NGAY)).toHaveLength(2);
    // đã gửi a; b xuất hiện sau — vẫn là mới
    expect(decideStormPushes([b], [daGui(a, NGAY - 3600_000)], NGAY).map((p) => p.reason)).toEqual(["moi"]);
  });
  it("hai bản tin NCHMF cùng cơn trong một lượt → chỉ một push", () => {
    const a = bao({ id: "nchmf-100", name: "số 3" });
    const b = bao({ id: "nchmf-101", name: "số 3" });
    expect(decideStormPushes([a, b], [], NGAY)).toHaveLength(1);
  });
  it("sổ có url rác / giờ rác → bỏ qua, không sập", () => {
    const s = bao();
    const so: SentStormRecord[] = [
      { url: null, created_at: "x" },
      { url: "/tau", created_at: new Date(NGAY).toISOString() },
      { url: stormPushUrl("gdacs-wutip", { alert: 0, kind: 2 }), created_at: "không phải giờ" },
    ];
    expect(decideStormPushes([s], so, NGAY).map((p) => p.reason)).toEqual(["moi"]);
  });
  it("giờ phát tin ở tương lai / rác → sentAt = now", () => {
    const s = bao({ updated: "rác" });
    expect(decideStormPushes([s], [], NGAY)[0].sentAtMs).toBe(NGAY);
    const t = bao({ updated: new Date(NGAY + 3600_000).toISOString() });
    expect(decideStormPushes([t], [], NGAY)[0].sentAtMs).toBe(NGAY);
  });
});

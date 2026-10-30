import { describe, expect, it } from "vitest";
import { chuanHoaHang, danhSachO, gopTau, gopVet, idCoDinh, khoaGioLuu, kiemGoi, thamSoVet, oTile, rutId, VUNG_QUET } from "@/lib/tau-ais/chuan-hoa.mjs";
import { danhSachSdtHopLe, docDanhSachSdt, duocXemAis } from "@/lib/tau-ais/quyen";
import { validateConfigValue } from "@/lib/app-config-keys";
import { cauVet, chuanTen, coTheXemVet, demTheoNhom, fetchVetTau, moTaTau, vetGeoJson, timTau, tauGanDiem, tuoiTinLabel, tuoiTinPhut, type TauAis } from "@/lib/tau-ais";

const HANG = {
  LAT: "15.836166", LON: "109.15148", SPEED: "41", COURSE: "111", HEADING: "111", ELAPSED: "14",
  DESTINATION: "CLASS B", FLAG: "VN", LENGTH: "17", SHIPNAME: "GIANG LQ 15 C31", SHIPTYPE: "2", SHIP_ID: "9057335",
};

describe("tàu AIS — chuẩn hoá hàng nguồn", () => {
  it("hàng tàu cá VN ⇒ bản ghi gọn, tốc độ ÷10, bỏ 'CLASS B'", () => {
    expect(chuanHoaHang(HANG)).toEqual({
      id: "9057335", ten: "GIANG LQ 15 C31", loai: 2, co: "VN", lat: 15.83617, lon: 109.15148,
      kn: 4.1, huong: 111, mui: 111, phut: 14, dai: 17, dich: null,
    });
  });
  it("tàu vệ tinh không tên ⇒ ten null, id base64 giữ nguyên; thiếu toạ độ ⇒ null", () => {
    const t = chuanHoaHang({ ...HANG, SHIPNAME: "[SAT-AIS]", SHIP_ID: "TWpNd0==", HEADING: null, LENGTH: undefined });
    expect(t?.ten).toBeNull();
    expect(t?.id).toBe("TWpNd0==");
    const dai = "TWpNd056UXhNak13TnpReE1qTXdOdz09LXFPcUdGdlpJN2FEMEVuWkthQWNDZHc9PQ==";
    expect(rutId(dai)).toMatch(/^v[0-9a-z]{6,12}$/);
    expect(rutId(dai)).toBe(rutId(dai));
    expect(chuanHoaHang({ ...HANG, SHIP_ID: dai })?.id).toBe(rutId(dai));
    expect(t?.mui).toBeNull();
    expect(t?.dai).toBeNull();
    expect(chuanHoaHang({ ...HANG, LAT: "abc" })).toBeNull();
    expect(chuanHoaHang({ ...HANG, SHIP_ID: "" })).toBeNull();
    expect(chuanHoaHang({ ...HANG, SHIPTYPE: "5" })?.loai).toBe(0);
  });
  it("gộp ô: cùng id giữ tin mới nhất", () => {
    const a = chuanHoaHang(HANG)!;
    const b = { ...a, phut: 3, lat: 15.9 };
    expect(gopTau([a, b, a])).toEqual([b]);
  });
});

describe("tàu AIS — ô quét", () => {
  it("toạ độ ⇒ ô z:8 của nguồn (ô 512 px; trình duyệt 2026-10-26 ở 14N 112E gọi X:102–103 Y:58–59)", () => {
    expect(oTile(14, 112)).toEqual({ x: 103, y: 58 });
    expect(oTile(14, 112, 7)).toEqual({ x: 51, y: 29 });
  });
  it("hộp cả Biển Đông (0–25N, 99–122E) phủ bằng ~90 ô z:8, mỗi ô một lần", () => {
    const o = danhSachO(VUNG_QUET);
    expect(o.length).toBeGreaterThan(70);
    expect(o.length).toBeLessThan(120);
    expect(new Set(o.map((t) => `${t.x}/${t.y}`)).size).toBe(o.length);
  });
});

describe("tàu AIS — máy chủ kiểm gói", () => {
  it("gói gọn hợp lệ ⇒ bản v1; hàng ngoài vùng / tin quá 4 giờ bị bỏ; gói rỗng/sai ⇒ mã lỗi", () => {
    const r = kiemGoi({ luc: "2026-10-26T02:00:00.000Z", tau: [chuanHoaHang(HANG), { ...chuanHoaHang(HANG)!, id: "xa", lat: 40 }, { ...chuanHoaHang(HANG)!, id: "manila", lat: 14.5, lon: 120.9 }, { ...chuanHoaHang(HANG)!, id: "cu", phut: 600 }, null] });
    // vùng quét cả Biển Đông (29/10): tàu ngoài khơi Manila nay được giữ, lat 40 vẫn bỏ
    expect(r.ok && r.ban?.soTau).toBe(2);
    expect(r.ok && r.ban?.luc).toBe("2026-10-26T02:00:00.000Z");
    expect(kiemGoi({ tau: [] })).toEqual({ ok: false, code: "trong" });
    expect(kiemGoi({ tau: "x" })).toEqual({ ok: false, code: "bad_body" });
    expect(kiemGoi(null)).toEqual({ ok: false, code: "bad_body" });
  });
  it("chấp nhận cả hàng thô của nguồn", () => {
    const r = kiemGoi({ tau: [HANG] });
    expect(r.ok && r.ban?.tau[0].ten).toBe("GIANG LQ 15 C31");
  });
});

describe("tàu AIS — phía máy ngư dân", () => {
  const t: TauAis = { id: "1", ten: "A", loai: 2, co: "VN", lat: 10, lon: 110, kn: 4.1, huong: 120, mui: null, phut: 10, dai: 17, dich: null };
  it("tàu gần điểm chạm trong 3 km, xa hơn ⇒ null", () => {
    expect(tauGanDiem([t], 10.01, 110)?.tau.id).toBe("1");
    expect(tauGanDiem([t], 10.1, 110)).toBeNull();
  });
  it("tuổi tin = tuổi trong nguồn + tuổi bản; nhãn đời thường", () => {
    expect(tuoiTinPhut(t, { luc: "2026-10-26T02:00:00.000Z" }, Date.parse("2026-10-26T02:07:00.000Z"))).toBe(17);
    expect(tuoiTinLabel(1)).toBe("vừa xong");
    expect(tuoiTinLabel(17)).toBe("17 phút trước");
    expect(tuoiTinLabel(150)).toBe("3 giờ trước");
  });
  it("mô tả tàu", () => {
    expect(moTaTau(t)).toBe("Tàu cá · VN · 4,1 hải lý/h về hướng Đông Nam · 17 m");
    expect(moTaTau({ ...t, kn: 0, co: null, dai: null })).toBe("Tàu cá · đang đứng");
  });
});

describe("tàu AIS — chế độ Toàn biển", () => {
  it("đếm theo nhóm màu: cá 2, hàng 7, dầu 8, khách 6/4, còn lại khác", () => {
    expect(demTheoNhom([2, 2, 7, 8, 6, 4, 0, 3].map((loai) => ({ loai })))).toEqual({ ca: 2, hang: 1, dau: 1, khach: 2, khac: 2 });
    expect(demTheoNhom([])).toEqual({ ca: 0, hang: 0, dau: 0, khach: 0, khac: 0 });
  });
});

describe("tàu AIS — tìm theo tên/số hiệu", () => {
  const t = (id: string, ten: string | null) => ({ id, ten, loai: 2, co: "VN", lat: 10, lon: 107, kn: null, huong: null, mui: null, phut: 0, dai: null, dich: null }) as TauAis;
  const ds = [t("1", "BV 92468 TS"), t("2", "KG-92468-TS"), t("3", "ĐỨC LONG 01"), t("4", null), t("5", "TG 90111 TS")];
  it("bỏ dấu, bỏ khoảng trắng/gạch", () => {
    expect(chuanTen("Bv-92468 ts")).toBe("BV92468TS");
    expect(chuanTen("Đức Long")).toBe("DUCLONG");
  });
  it("bắt đầu bằng chuỗi tìm xếp trước, chứa chuỗi tìm sau; dưới 2 ký tự không tìm", () => {
    expect(timTau(ds, "bv92468").map((x) => x.id)).toEqual(["1"]);
    expect(timTau(ds, "92468").map((x) => x.id)).toEqual(["1", "2"]);
    expect(timTau(ds, "duc long").map((x) => x.id)).toEqual(["3"]);
    expect(timTau(ds, "9")).toEqual([]);
    expect(timTau(ds, "TS", 2)).toHaveLength(2);
  });
});

describe("tàu AIS — quyền xem theo tài khoản", () => {
  it("chưa đặt ô ⇒ chỉ chủ dự án", () => {
    expect(duocXemAis("0938635689", null)).toBe(true);
    expect(duocXemAis("+84 938 635 689", "")).toBe(true);
    expect(duocXemAis("0901234567", null)).toBe(false);
    expect(duocXemAis(null, "0901234567")).toBe(false);
  });
  it("đặt danh sách ⇒ đúng những số trong danh sách (kể cả gỡ chủ dự án nếu không ghi)", () => {
    const o = "0938635689, 0901 234 567;84912345678";
    expect(docDanhSachSdt(o)).toEqual(["0938635689", "0901234567", "0912345678"]);
    expect(duocXemAis("0912345678", o)).toBe(true);
    expect(duocXemAis("0909999999", o)).toBe(false);
    expect(duocXemAis("0938635689", "0901234567")).toBe(false);
  });
  it("ô quản trị: mọi mẩu phải là SĐT — gõ sai một số thì chặn", () => {
    expect(danhSachSdtHopLe("0938635689, 0901234567")).toBe(true);
    expect(danhSachSdtHopLe("0938635689, 09012")).toBe(false);
    expect(danhSachSdtHopLe("  ")).toBe(false);
    expect(validateConfigValue("tau_ais_xem", "0938635689")).toBe(true);
    expect(validateConfigValue("tau_ais_xem", "abc")).toBe(false);
  });
});

describe("tàu AIS — kho vĩnh viễn ở máy thu", () => {
  it("mốc giờ + tệp theo NGÀY GIỜ VN (UTC+7)", () => {
    expect(khoaGioLuu("2026-10-29T16:59:00.000Z")).toEqual({ gio: "2026-10-29T23", tep: "2026-10/2026-10-29.ndjson.gz" });
    // 17:05 UTC = 00:05 hôm sau giờ VN ⇒ tệp ngày mới
    expect(khoaGioLuu("2026-10-29T17:05:00.000Z")).toEqual({ gio: "2026-10-30T00", tep: "2026-10/2026-10-30.ndjson.gz" });
    expect(khoaGioLuu("hỏng")).toBeNull();
  });
});

describe("tàu AIS — lộ trình 7 ngày ở máy chủ", () => {
  it("mốc giờ làm tròn xuống đầu giờ; mỗi tàu [id, lat, lon, kn, hướng mũi trước]", () => {
    const t = chuanHoaHang(HANG)!;
    const r = thamSoVet({ luc: "2026-10-29T10:47:12.000Z", tau: [t, { ...t, id: "b", mui: null, huong: 200, kn: null }] });
    expect(r?.p_gio).toBe(Date.parse("2026-10-29T10:00:00.000Z") / 1000);
    expect(r?.p_ds).toEqual([[t.id, t.lat, t.lon, t.kn, 111], ["b", t.lat, t.lon, null, 200]]);
    expect(thamSoVet({ luc: "x", tau: [] })).toBeNull();
  });
});

describe("tàu AIS — xem lại đường đi (2026-10-30)", () => {
  const dai = "X".repeat(80);
  it("mã rút từ mã vệ tinh dài ⇒ không cố định; mã gốc ngắn ⇒ cố định", () => {
    expect(idCoDinh("636012345")).toBe(true);
    expect(idCoDinh(rutId(dai))).toBe(false);
    expect(idCoDinh("")).toBe(false);
    expect(idCoDinh(undefined)).toBe(false);
  });
  it("thamSoVet bỏ tàu mã đổi mỗi bản (không nối được đường, làm phình bảng)", () => {
    const t = chuanHoaHang(HANG)!;
    const r = thamSoVet({ luc: "2026-10-29T10:47:12.000Z", tau: [t, { ...t, id: rutId(dai) }] });
    expect(r?.p_ds.map((x: unknown[]) => x[0])).toEqual([t.id]);
  });
  it("gộp nhiều ngày theo thời gian, bỏ điểm hỏng/trùng giờ, quãng đứng yên chỉ giữ đầu + cuối", () => {
    const ds = gopVet([
      { ngay: "2026-10-30", diem: [[7200, 10, 108, 0, 1], [10800, 10, 108, 0, 1], [14400, 10, 108, 0, 1], [18000, 10.2, 108.1, 6, 1]] },
      { ngay: "2026-10-29", diem: [[0, 9.8, 107.9, 8, 1], [0, 9.8, 107.9, 8, 1], [3600, "x", 108, 1, 1], [3600, 9.9, 108, null, 1]] },
    ]);
    expect(ds.map((p) => p.t)).toEqual([0, 3600, 7200, 14400, 18000]);
    expect(ds[1].kn).toBeNull();
    expect(gopVet(null)).toEqual([]);
  });
});

describe("tàu AIS — đường đi phía máy bà con", () => {
  const T0 = Date.parse("2026-10-29T00:00:00Z") / 1000; // = 07:00 29/10 giờ VN
  const D = [{ t: T0, lat: 10, lon: 108, kn: 5 }, { t: T0 + 3600, lat: 10.1, lon: 108.1, kn: 6 }];
  it("câu tóm tắt nói số ngày, số mốc, giờ VN bắt đầu", () => {
    expect(cauVet(D, (T0 + 30 * 3600) * 1000)).toBe("Đường đi 2 ngày qua · 2 mốc · từ 07:00 29/10");
    expect(cauVet(D.slice(0, 1))).toMatch(/^Chưa đủ mốc/);
  });
  it("GeoJSON: đường + mốc giữa + điểm đầu/cuối có nhãn giờ VN", () => {
    const D3 = [...D, { t: T0 + 7200, lat: 10.2, lon: 108.2, kn: 6 }];
    const g = vetGeoJson(D3);
    expect(g.features.map((f) => f.properties?.k)).toEqual(["duong", "moc", "dau", "cuoi"]);
    expect(g.features[2].properties?.nhan).toBe("Bắt đầu 07:00 29/10");
    expect(g.features[3].properties?.nhan).toBe("Mới nhất 09:00 29/10");
    expect(vetGeoJson(D.slice(0, 1)).features.map((f) => f.properties?.k)).toEqual(["cuoi"]);
  });
  it("tàu mã đổi mỗi bản ⇒ nói không theo được, không gọi mạng", async () => {
    expect(coTheXemVet({ id: rutId("Y".repeat(80)) })).toBe(false);
    expect(await fetchVetTau(rutId("Y".repeat(80)))).toEqual({ ok: false, ly: "khong_theo_duoc" });
  });
  it("mất sóng ⇒ mat_song (không bịa đường)", async () => {
    const g = globalThis.fetch;
    globalThis.fetch = (() => Promise.reject(new TypeError("offline"))) as typeof fetch;
    try {
      expect(await fetchVetTau("999000111")).toEqual({ ok: false, ly: "mat_song" });
    } finally {
      globalThis.fetch = g;
    }
  });
});

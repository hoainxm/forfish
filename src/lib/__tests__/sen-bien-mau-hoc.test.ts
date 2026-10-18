// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEVICE_TOKEN_KEY } from "@/lib/device-token-store";
import { DEVICE_TOKEN_LEN, DEVICE_TOKEN_PREFIX } from "@/lib/device-token";
import {
  LO_GUI,
  MAU_KEY,
  MAU_TRAN,
  boDaGui,
  ghiMauSen,
  guiMauSen,
  lamSachMau,
  themMau,
  tomTatTraLoi,
  type MauSen,
} from "@/lib/sen-bien/mau-hoc";
import { ghepNoiLai } from "../../../scripts/sen-bien-keo-mau.mjs";

/*  MẪU HỌC SEN BIỂN (2026-10-18): ghi trong máy, có sóng mới gửi, chỉ xoá mẫu máy chủ báo đã
    nhận; kiểm khuôn ở ranh giới bằng MỘT hàm cho cả máy lẫn route; không mang toạ độ. */

const mau = (o: Partial<MauSen> = {}): MauSen => ({
  id: "a1",
  t: 1_760_000_000_000,
  phien: "p1",
  cau: "dẫn về cảng sa huỳnh",
  tra: "go",
  ct: "cang",
  gemma: null,
  xn: false,
  chay: false,
  nen: "android",
  ban: "abc",
  ...o,
});

describe("tomTatTraLoi — việc máy làm, không mang toạ độ", () => {
  it("go chỉ giữ loại chỗ", () => {
    const r = tomTatTraLoi({ kind: "go", dest: { name: "Cảng Sa Huỳnh", lat: 14.6, lon: 109.0, kind: "cang" }, say: "Đi" });
    expect(r).toEqual({ tra: "go", ct: "cang" });
    expect(JSON.stringify(r)).not.toContain("14.6");
  });
  it("say mang ý n-gram, hoi mang loại câu hỏi, map mang việc", () => {
    expect(tomTatTraLoi({ kind: "say", say: "x", y: "khong_hieu" })).toEqual({ tra: "say", ct: "khong_hieu" });
    expect(tomTatTraLoi({ kind: "map", lenh: { viec: "phong_to" } })).toEqual({ tra: "map", ct: "phong_to" });
    expect(tomTatTraLoi({ kind: "repeat" })).toEqual({ tra: "repeat" });
  });
});

describe("lamSachMau — kiểm khuôn ở ranh giới", () => {
  it("mẫu đúng đi qua, câu dài bị cắt 200 ký tự", () => {
    expect(lamSachMau(mau())).toEqual(mau());
    expect(lamSachMau(mau({ cau: "a".repeat(500) }))!.cau).toHaveLength(200);
  });
  it("sai khuôn ⇒ null, không sửa đoán", () => {
    expect(lamSachMau(null)).toBeNull();
    expect(lamSachMau(mau({ cau: "   " }))).toBeNull();
    expect(lamSachMau(mau({ tra: "xoa_het" }))).toBeNull();
    expect(lamSachMau(mau({ ct: "<script>" }))).toBeNull();
    expect(lamSachMau(mau({ gemma: "DROP TABLE" }))).toBeNull();
    expect(lamSachMau({ ...mau(), t: "hôm qua" })).toBeNull();
    expect(lamSachMau({ ...mau(), id: "x".repeat(41) })).toBeNull();
  });
  it("chỉ giữ trường đã khai — trường lạ (toạ độ) bị bỏ", () => {
    const m = lamSachMau({ ...mau(), lat: 14.6, lon: 109 }) as Record<string, unknown>;
    expect(m.lat).toBeUndefined();
  });
});

describe("kho trong máy", () => {
  it("themMau giữ tối đa MAU_TRAN mẫu MỚI nhất", () => {
    let ds: MauSen[] = [];
    for (let i = 0; i < MAU_TRAN + 5; i++) ds = themMau(ds, mau({ id: `m${i}` }));
    expect(ds).toHaveLength(MAU_TRAN);
    expect(ds[0].id).toBe("m5");
  });
  it("boDaGui chỉ bỏ id máy chủ đã nhận", () => {
    expect(boDaGui([mau({ id: "a" }), mau({ id: "b" })], ["a"]).map((m) => m.id)).toEqual(["b"]);
  });
});

describe("guiMauSen — có sóng mới gửi, chỉ xoá khi máy chủ nhận", () => {
  const token = DEVICE_TOKEN_PREFIX + "a".repeat(DEVICE_TOKEN_LEN - DEVICE_TOKEN_PREFIX.length);
  const ghi = (cau: string) =>
    ghiMauSen({ phien: "p", cau, r: { kind: "say", say: "x", y: "khong_hieu" }, xn: false, chay: false, nen: "web", ban: "" });

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(DEVICE_TOKEN_KEY, token);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("ghi xong nằm trong kho", () => {
    ghi("chỗ nào nhiều cá");
    const ds = JSON.parse(localStorage.getItem(MAU_KEY)!);
    expect(ds).toHaveLength(1);
    expect(ds[0]).toMatchObject({ cau: "chỗ nào nhiều cá", tra: "say", ct: "khong_hieu" });
  });

  it("máy chủ nhận ⇒ xoá đúng các mẫu đã nhận; gửi ≤ LO_GUI mẫu/lô, kèm chuỗi thiết bị", async () => {
    for (let i = 0; i < LO_GUI + 3; i++) ghi(`câu ${i}`);
    const f = vi.fn(async (_u: string, init: RequestInit) => {
      const lo = JSON.parse(String(init.body)).mau as MauSen[];
      return new Response(JSON.stringify({ ok: true, nhan: lo.map((m) => m.id) }), { status: 200 });
    });
    vi.stubGlobal("fetch", f);
    expect(await guiMauSen(1_000_000)).toBe(LO_GUI);
    const init = f.mock.calls[0][1] as RequestInit;
    expect(JSON.stringify(init.headers)).toContain(token);
    expect(JSON.parse(localStorage.getItem(MAU_KEY)!)).toHaveLength(3);
  });

  it("mất sóng / lỗi máy chủ ⇒ giữ nguyên, 10 phút sau mới thử lại", async () => {
    ghi("về nhà");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    expect(await guiMauSen(1_000_000)).toBe(0);
    expect(JSON.parse(localStorage.getItem(MAU_KEY)!)).toHaveLength(1);
    const f2 = vi.fn(async () => new Response(JSON.stringify({ ok: false }), { status: 500 }));
    vi.stubGlobal("fetch", f2);
    expect(await guiMauSen(1_000_000 + 60_000)).toBe(0);
    expect(f2).not.toHaveBeenCalled(); // chưa đủ 10 phút
    await guiMauSen(1_000_000 + 11 * 60_000);
    expect(f2).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem(MAU_KEY)!)).toHaveLength(1);
  });

  it("chưa đăng nhập ⇒ không gửi, giữ trong máy", async () => {
    localStorage.removeItem(DEVICE_TOKEN_KEY);
    ghi("về nhà");
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    expect(await guiMauSen(1_000_000)).toBe(0);
    expect(f).not.toHaveBeenCalled();
  });
});

describe("ghepNoiLai (scripts/sen-bien-keo-mau.mjs)", () => {
  const h = (id: string, phien: string, s: number, tra: string, cau: string) => ({
    id, phien, tra, cau, noi_luc: new Date(1e12 + s * 1000).toISOString(), nhan_luc: "2026-10-18T00:00:00Z",
  });
  it("câu máy không làm được + nói lại trong 20 s cùng phiên ⇒ nghi sai", () => {
    const ra = ghepNoiLai([
      h("1", "p", 0, "say", "dẫn về xa huyền"),
      h("2", "p", 6, "go", "dẫn về sa huỳnh"),
      h("3", "p", 60, "say", "chào"),
      h("4", "p", 100, "go", "về nhà"),
      h("5", "q", 1, "go", "đi lý sơn"),
    ]);
    const by = Object.fromEntries(ra.map((m: { id: string; nghi_sai: boolean }) => [m.id, m]));
    expect(by["1"]).toMatchObject({ nghi_sai: true, noi_lai: "dẫn về sa huỳnh" });
    expect(by["2"].nghi_sai).toBe(false); // máy đã đi — không phải ca sai
    expect(by["3"].nghi_sai).toBe(false); // quá 20 s
    expect(by["5"].nghi_sai).toBe(false);
  });
});

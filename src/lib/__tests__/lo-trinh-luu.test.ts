import { describe, it, expect, beforeEach } from "vitest";

// localStorage mock (env node) — cùng khuôn saved-routes.test.ts / route-stops.test.ts.
const _ls = (() => {
  const m = new Map<string, string>();
  let full = false;
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => {
      if (full) throw new DOMException("QuotaExceededError");
      m.set(k, String(v));
    },
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
    setFull: (v: boolean) => (full = v),
  } as Storage & { setFull: (v: boolean) => void };
})();
(globalThis as unknown as { window: unknown }).window = { localStorage: _ls };
(globalThis as unknown as { localStorage: Storage }).localStorage = _ls;

import {
  docLoTrinhDaLuu,
  ghiLoTrinhDaLuu,
  loTrinhReadFailed,
  themLoTrinh,
  xoaLoTrinh,
  tenLoTrinh,
  cauTuoiLoTrinh,
  LO_TRINH_KEY,
  MAX_LO_TRINH,
} from "../lo-trinh/luu";
import type { LoTrinhDaLuu } from "../lo-trinh/types";

const CANG = { lat: 13.76, lon: 109.27, ten: "Cảng Quy Nhơn" };

function rec(id: string, taoLuc = "2026-10-29T08:00:00Z"): LoTrinhDaLuu {
  return {
    id,
    ten: `Chuyến ${id}`,
    boatId: null,
    taoLuc,
    tuoiDuLieu: { ca: "2026-10-29T06:00:00Z", bao: null },
    input: {
      cang: CANG,
      ngayDi: "2026-11-02",
      soNgay: 15,
      nghe: "cau-ngu",
      tau: { speedKn: 8, litersPerHour: 25, fuelTankL: null },
      diemQuen: [],
    },
    ketQua: {
      vung: [],
      lich: [{ tuNgay: 1, denNgay: 15, loai: "ve", cau: "Về cảng" }],
      moc: [
        { ...CANG, loai: "cang" },
        { ...CANG, loai: "cang" },
      ],
      haiLy: 0,
      litDau: 0,
      thieuDau: false,
      ngayNenVe: "2026-11-16",
      soNgayTinh: 15,
      chanBao: null,
      ghiChu: [],
    },
  };
}

beforeEach(() => {
  _ls.setFull(false);
  localStorage.clear();
  docLoTrinhDaLuu(); // cờ đọc-hỏng về sạch
});

describe("lo-trinh/luu — forfish.routes.v1", () => {
  it("khoá đúng tên §5c (không đè savedroutes/routestops)", () => {
    expect(LO_TRINH_KEY).toBe("forfish.routes.v1");
  });

  it("chưa có gì ⇒ rỗng, không hỏng", () => {
    expect(docLoTrinhDaLuu()).toEqual([]);
    expect(loTrinhReadFailed()).toBe(false);
  });

  it("thêm rồi ghi rồi đọc lại — mới nhất lên đầu", () => {
    let list = themLoTrinh([], rec("a", "2026-10-28T08:00:00Z"));
    list = themLoTrinh(list, rec("b", "2026-10-29T08:00:00Z"));
    expect(ghiLoTrinhDaLuu(list)).toBe(true);
    expect(docLoTrinhDaLuu().map((r) => r.id)).toEqual(["b", "a"]);
  });

  it("trùng id thì đè, không đẻ bản thứ hai", () => {
    let list = themLoTrinh([], rec("a"));
    list = themLoTrinh(list, { ...rec("a"), ten: "Tên mới" });
    expect(list).toHaveLength(1);
    expect(list[0].ten).toBe("Tên mới");
  });

  it(`quá trần ${MAX_LO_TRINH} ⇒ bỏ bản cũ nhất`, () => {
    let list: LoTrinhDaLuu[] = [];
    for (let i = 0; i < MAX_LO_TRINH + 3; i++) list = themLoTrinh(list, rec(`r${i}`));
    expect(list).toHaveLength(MAX_LO_TRINH);
    expect(list[0].id).toBe(`r${MAX_LO_TRINH + 2}`);
    expect(list.some((r) => r.id === "r0")).toBe(false);
  });

  it("xoá đúng một bản", () => {
    const list = themLoTrinh(themLoTrinh([], rec("a")), rec("b"));
    expect(xoaLoTrinh(list, "a").map((r) => r.id)).toEqual(["b"]);
  });

  it("ĐỌC HỎNG ⇒ khoá cửa ghi, bản gốc còn nguyên (K4)", () => {
    localStorage.setItem(LO_TRINH_KEY, "{hỏng");
    expect(docLoTrinhDaLuu()).toEqual([]);
    expect(loTrinhReadFailed()).toBe(true);
    expect(ghiLoTrinhDaLuu([rec("x")])).toBe(false);
    expect(localStorage.getItem(LO_TRINH_KEY)).toBe("{hỏng");
  });

  it("máy hết chỗ ⇒ trả false (màn phải nói)", () => {
    _ls.setFull(true);
    expect(ghiLoTrinhDaLuu([rec("a")])).toBe(false);
  });

  it("bản ghi méo hình bị bỏ qua khi đọc, bản lành vẫn ra", () => {
    localStorage.setItem(LO_TRINH_KEY, JSON.stringify([{ id: 1 }, rec("ok"), { ...rec("x"), ketQua: { moc: [{ lat: "a" }] } }]));
    expect(docLoTrinhDaLuu().map((r) => r.id)).toEqual(["ok"]);
    expect(loTrinhReadFailed()).toBe(false);
  });

  it("câu tuổi dữ liệu: nói giờ tính, giờ bản đồ cá, bão chưa đối chiếu, bản cũ N ngày", () => {
    const r = { taoLuc: "2026-10-29T08:00:00Z", tuoiDuLieu: { ca: "2026-10-27T06:00:00Z", bao: null } };
    const cau = cauTuoiLoTrinh(r, Date.parse("2026-10-29T09:00:00Z"));
    expect(cau).toMatch(/^Tính lúc \d\d:\d\d \d\d\/\d\d · bản đồ cá lúc \d\d:\d\d 27\/10 · chưa đối chiếu tin bão/);
    expect(cau).toContain("đã 2 ngày");
    const moi = cauTuoiLoTrinh({ ...r, tuoiDuLieu: { ca: "2026-10-29T06:00:00Z", bao: "2026-10-29T07:00:00Z" } }, Date.parse("2026-10-29T09:00:00Z"));
    expect(moi).not.toContain("ngày,");
    expect(moi).not.toContain("bão");
    expect(cauTuoiLoTrinh({ ...r, tuoiDuLieu: { ca: null, bao: null } }, 0)).toContain("chưa có bản đồ cá");
  });

  it("tên gợi ý đời thường", () => {
    expect(tenLoTrinh("Cảng Quy Nhơn", 15, "2026-11-02")).toBe("Quy Nhơn · 15 ngày · 02/11");
  });
});

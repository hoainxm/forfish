import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const _ls = (() => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  } as Storage;
})();
(globalThis as unknown as { window: unknown }).window = { localStorage: _ls };
(globalThis as unknown as { localStorage: Storage }).localStorage = _ls;

import {
  BASEMAP_CACHE,
  BASEMAP_PATH,
  appPretripPoints,
  hasBasemap,
  hasDataKey,
  readyGap,
  readyGapText,
  loiVeMay,
  readyToSail,
} from "../pretrip-ready";
import { DATA_KEY_STORE } from "../data-key";
import { DEFAULT_POINT } from "../ocean-map";

/*  "SẴN SÀNG RA KHƠI" = đủ BỐN thứ (rà offline F2/F3 2026-10-29): dữ liệu · vỏ · khoá SDF2 · nền bản đồ.
    Chip xanh khi thiếu khoá là bà con ra khơi với bản đồ trắng. */

const ID = "0123456789abcdef";
const HEX = "a".repeat(64);
const DU = { dataOk: true, shellOk: true, keyOk: true, basemapOk: true } as const;

beforeEach(() => localStorage.clear());

describe("hasDataKey — chỉ đọc kho máy", () => {
  it("kho trống → chưa có khoá", () => {
    expect(hasDataKey()).toBe(false);
  });
  it("một khoá hợp lệ → có", () => {
    localStorage.setItem(DATA_KEY_STORE, JSON.stringify({ [ID]: HEX }));
    expect(hasDataKey()).toBe(true);
  });
  it("khoá hỏng (sai độ dài / JSON hỏng) → KHÔNG tính là có", () => {
    localStorage.setItem(DATA_KEY_STORE, JSON.stringify({ [ID]: "abc" }));
    expect(hasDataKey()).toBe(false);
    localStorage.setItem(DATA_KEY_STORE, "{hỏng");
    expect(hasDataKey()).toBe(false);
  });
});

describe("readyToSail / readyGap — xanh chỉ khi đủ cả bốn", () => {
  it("đủ bốn → xanh, không thiếu gì", () => {
    expect(readyToSail(DU)).toBe(true);
    expect(readyGap(DU)).toBeNull();
  });
  it("đủ dữ liệu + vỏ + nền nhưng THIẾU KHOÁ → không xanh, nói khoá", () => {
    const p = { ...DU, keyOk: false };
    expect(readyToSail(p)).toBe(false);
    expect(readyGap(p)).toBe("key");
  });
  it("thiếu nền bản đồ → không xanh", () => {
    expect(readyToSail({ ...DU, basemapOk: false })).toBe(false);
    expect(readyGap({ ...DU, basemapOk: false })).toBe("basemap");
  });
  it("chưa đọc xong vỏ / nền (null) → chưa được xanh", () => {
    expect(readyToSail({ ...DU, shellOk: null })).toBe(false);
    expect(readyToSail({ ...DU, basemapOk: null })).toBe(false);
  });
  it("thứ tự: vỏ hỏng nói trước (không mở được app), rồi khoá, rồi nền, rồi dữ liệu", () => {
    expect(readyGap({ dataOk: false, shellOk: false, keyOk: false, basemapOk: false })).toBe("shell");
    expect(readyGap({ dataOk: false, shellOk: true, keyOk: false, basemapOk: false })).toBe("key");
    expect(readyGap({ dataOk: false, shellOk: true, keyOk: true, basemapOk: false })).toBe("basemap");
    expect(readyGap({ ...DU, dataOk: false })).toBe("data");
  });
  it("câu thiếu khoá đời thường; khách thì mời đăng nhập thay vì 'mở lúc có sóng'", () => {
    expect(readyGapText("key")).toBe("Chưa tải được khoá bản đồ — mở app lúc có sóng");
    expect(readyGapText("key", false)).toMatch(/đăng nhập/);
  });
});

describe("hasBasemap — đọc Cache Storage, không tạo kho", () => {
  afterEach(() => {
    delete (globalThis as { caches?: unknown }).caches;
  });
  function fake(store: Record<string, string[]>) {
    const opened: string[] = [];
    (globalThis as { caches?: unknown }).caches = {
      has: async (n: string) => n in store,
      open: async (n: string) => {
        opened.push(n);
        return { match: async (u: string) => ((store[n] ?? []).includes(u) ? new Response("x") : undefined) };
      },
    };
    return opened;
  }
  it("không có Cache Storage → false", async () => {
    expect(await hasBasemap()).toBe(false);
  });
  it("kho chưa có → false, và KHÔNG mở (mở là tạo kho rỗng)", async () => {
    const opened = fake({});
    expect(await hasBasemap()).toBe(false);
    expect(opened).toEqual([]);
  });
  it("kho có file nền → true", async () => {
    fake({ [BASEMAP_CACHE]: [BASEMAP_PATH] });
    expect(await hasBasemap()).toBe(true);
  });
});

describe("đồng bộ với public/sw.js", () => {
  const sw = readFileSync(join(process.cwd(), "public/sw.js"), "utf8");
  it("tên kho nền khớp SDFISH_BASEMAP_V", () => {
    expect(sw).toContain(`const SDFISH_BASEMAP_V = "${BASEMAP_CACHE}";`);
  });
  it("đường dẫn nền là file đầu của PMTILES_ARCHIVES (BASEMAP_ARCHIVE)", () => {
    const m = sw.match(/const PMTILES_ARCHIVES = \[\s*"([^"]+)"/);
    expect(m?.[1]).toBe(BASEMAP_PATH);
  });
});

describe("appPretripPoints — chỗ tải sẵn khi không ở màn Bản đồ", () => {
  it("chưa ghim gì → đúng điểm mặc định bản đồ mở ra", () => {
    expect(appPretripPoints([])).toEqual([{ lat: DEFAULT_POINT.lat, lon: DEFAULT_POINT.lon, name: "Điểm đang xem" }]);
  });
  it("cảng nhà đứng đầu, tên như bản đồ; không thêm chỗ bịa", () => {
    const pts = appPretripPoints([
      { id: "a", name: "Rạn Đá", lat: 10, lon: 109, kind: "spot" },
      { id: "b", name: "Sa Huỳnh", lat: 14.6, lon: 109, kind: "home" },
    ]);
    expect(pts.map((p) => p.name)).toEqual(["Cảng nhà — Sa Huỳnh", "Rạn Đá"]);
  });
});

describe("loiVeMay — thứ tự lời về máy trong viên trạng thái bản đồ (lô 2, 2026-10-29)", () => {
  const matSong = "Mất sóng — đang dùng bản đồ lưu trong máy.";
  const duBao = "Chưa tải được dự báo — chưa có sóng.";

  it("không có gì ⇒ rỗng (viên không mọc ra)", () => {
    expect(loiVeMay({ thieuKhoa: false, coTaiKhoan: true, matSong: null, duBao: null })).toEqual([]);
  });

  it("đủ cả ba ⇒ thiếu khoá > mất sóng > dự báo; dòng gọn là vế trước dấu gạch", () => {
    const r = loiVeMay({ thieuKhoa: true, coTaiKhoan: true, matSong, duBao });
    expect(r.map((g) => g.ngan)).toEqual(["Chưa tải được khoá bản đồ", "Mất sóng", "Chưa tải được dự báo"]);
    expect(r[2].day).toBe(duBao);
    expect(r[0].ben).toBe(true);
    expect(r[1].ben).toBeUndefined();
    expect(r[2].ben).toBeUndefined();
  });

  it("chỉ dự báo hỏng ⇒ một lời, không nằm lì (viên nói 8 s rồi thu)", () => {
    const r = loiVeMay({ thieuKhoa: false, coTaiKhoan: true, matSong: null, duBao });
    expect(r).toEqual([{ ngan: "Chưa tải được dự báo", day: duBao }]);
  });

  it("khách (không tài khoản) thiếu khoá ⇒ câu đăng nhập", () => {
    const r = loiVeMay({ thieuKhoa: true, coTaiKhoan: false, matSong: null, duBao: null });
    expect(r[0].day).toMatch(/đăng nhập/);
  });
});

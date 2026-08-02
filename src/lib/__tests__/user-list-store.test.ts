import { describe, expect, it, beforeEach } from "vitest";

/*
  K4 — "KHÔNG ĐỌC ĐƯỢC" BỊ ĐỘI LỐT "CHƯA CÓ GÌ" (2026-08-02).

  Cảnh thật: `forfish.buyers.v1` (mối quen — tên nậu vựa + SĐT bà con gõ tay) bị
  ghi dở lúc máy đầy/pin sập ⇒ JSON hỏng. Bản cũ `catch` rồi trả `[]`, màn bật cờ
  `ready`, effect ghi ngay `"[]"` ĐÈ LÊN chuỗi gốc ⇒ cú "khôi phục" tự xoá sổ.
  Dữ liệu này KHÔNG tải lại được như dự báo. Luật: đọc không được thì KHÔNG mở
  cửa ghi.
*/

// localStorage mock (env node — không jsdom), khớp mẫu forecast-cache.test
let THROW_ON_READ = false;
const _ls = (() => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => {
      if (THROW_ON_READ) throw new Error("SecurityError");
      return m.has(k) ? m.get(k)! : null;
    },
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

import { readUserList } from "../user-list-store";

const KEY = "forfish.buyers.v1";

beforeEach(() => {
  localStorage.clear();
  THROW_ON_READ = false;
});

describe("readUserList — 'chưa có gì' KHÁC 'không đọc được'", () => {
  it("đọc lại đúng danh sách đã ghi", () => {
    localStorage.setItem(KEY, JSON.stringify([{ id: "a" }, { id: "b" }]));
    const r = readUserList<{ id: string }>(KEY);
    expect(r.ok).toBe(true);
    expect(r.list?.map((x) => x.id)).toEqual(["a", "b"]);
  });

  it("chưa có khoá nào → ĐỌC ĐƯỢC, list = null (màn tự quyết trống hay sổ mẫu)", () => {
    expect(readUserList(KEY)).toEqual({ ok: true, list: null });
  });

  it("mảng rỗng THẬT → ok, list = [] (khác hẳn không đọc được)", () => {
    localStorage.setItem(KEY, "[]");
    expect(readUserList(KEY)).toEqual({ ok: true, list: [] });
  });

  it("JSON hỏng → ok=false, list=null (KHÔNG phải []) ⇒ không mở cửa ghi", () => {
    localStorage.setItem(KEY, '[{"id":"a"');
    const r = readUserList(KEY);
    expect(r.ok).toBe(false);
    expect(r.list).toBeNull();
  });

  it("khoá đang giữ thứ KHÔNG PHẢI mảng → cũng là không đọc được", () => {
    localStorage.setItem(KEY, '{"id":"a"}');
    expect(readUserList(KEY).ok).toBe(false);
  });

  it("getItem NÉM (chế độ riêng tư / storage bị chặn) → không đọc được", () => {
    THROW_ON_READ = true;
    const r = readUserList(KEY);
    expect(r.ok).toBe(false);
    expect(r.list).toBeNull();
  });

  it("chuỗi rỗng → coi như chưa có gì, không phải hỏng", () => {
    localStorage.setItem(KEY, "");
    expect(readUserList(KEY)).toEqual({ ok: true, list: null });
  });
});

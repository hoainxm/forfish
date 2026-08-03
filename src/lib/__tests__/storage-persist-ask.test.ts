import { describe, expect, it, beforeEach, vi } from "vitest";

// localStorage mock (env node — không jsdom), khớp mẫu forecast-cache.test
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
  PERSIST_ASK_KEY,
  ensurePersistentStorage,
  persistAskResult,
  shouldAskPersist,
} from "../storage-persist";

const NGAY = 24 * 60 * 60 * 1000;

/*  `globalThis.navigator` của Node là accessor CHỈ-ĐỌC — gán thẳng là ném
    "Cannot set property navigator". Phải định nghĩa lại thuộc tính. */
function setNavigator(v: unknown): void {
  Object.defineProperty(globalThis, "navigator", {
    value: v,
    configurable: true,
    writable: true,
  });
}

/** Gắn `navigator.storage` giả — trả về cặp spy để soi số lần gọi */
function fakeStorage(opts: {
  persisted: boolean;
  grant?: boolean;
  missing?: boolean;
}) {
  const persist = vi.fn().mockResolvedValue(opts.grant ?? false);
  const persisted = vi.fn().mockResolvedValue(opts.persisted);
  setNavigator(opts.missing ? {} : { storage: { persist, persisted } });
  return { persist, persisted };
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

/*  CỔNG CHO LỖI 2026-08-03 (chủ dự án: *"gọi mount lúc nào, lúc cài và lưu thì
    làm sao, có cơ chế retry hay sao?"*): app gọi `persist()` ĐÚNG MỘT LẦN trong
    `useEffect([])` của layout — mà bản cài PWA bấm Home rồi quay lại KHÔNG nạp
    lại tài liệu, nên máy dùng nhiều tháng chỉ được hỏi vài lần, và lần hỏi đầu
    rơi đúng lúc app vừa cài (lúc dễ bị từ chối nhất). Máy thật đã cài ra màn
    hình chính vẫn báo `persisted = false`. */
describe("shouldAskPersist — cửa chặn hỏi lại", () => {
  it("đã được cấp → KHÔNG hỏi nữa", () => {
    expect(shouldAskPersist(true, null, 1_000)).toBe(false);
    expect(shouldAskPersist(true, 0, 10 * NGAY)).toBe(false);
  });

  it("chưa hỏi lần nào → hỏi", () => {
    expect(shouldAskPersist(false, null, 1_000)).toBe(true);
    expect(shouldAskPersist(null, null, 1_000)).toBe(true);
  });

  it("vừa hỏi trong 24 giờ → thôi (Firefox HIỆN POPUP, đừng quấy)", () => {
    const t = 10 * NGAY;
    expect(shouldAskPersist(false, t, t + NGAY - 1000)).toBe(false);
  });

  it("quá 24 giờ → hỏi lại", () => {
    const t = 10 * NGAY;
    expect(shouldAskPersist(false, t, t + NGAY)).toBe(true);
  });

  it("mốc ở TƯƠNG LAI (đồng hồ máy chỉnh lùi) → hỏi, không kẹt vĩnh viễn", () => {
    expect(shouldAskPersist(false, 20 * NGAY, 10 * NGAY)).toBe(true);
  });
});

describe("ensurePersistentStorage — best-effort, KHÔNG mạng", () => {
  it("đã được cấp → trả true và KHÔNG hỏi lại", async () => {
    const { persist } = fakeStorage({ persisted: true });
    await expect(ensurePersistentStorage()).resolves.toBe(true);
    expect(persist).not.toHaveBeenCalled();
  });

  it("chưa được cấp → hỏi, và NHỚ kết quả để lần sau phân biệt được", async () => {
    const { persist } = fakeStorage({ persisted: false, grant: false });
    await expect(ensurePersistentStorage()).resolves.toBe(false);
    expect(persist).toHaveBeenCalledTimes(1);
    // "đã hỏi và BỊ TỪ CHỐI" — khác hẳn "chưa hỏi lần nào" (null)
    expect(persistAskResult()).toBe(false);
  });

  it("hai lần liền trong ngày → chỉ hỏi MỘT lần", async () => {
    const { persist } = fakeStorage({ persisted: false, grant: false });
    await ensurePersistentStorage();
    await ensurePersistentStorage();
    await ensurePersistentStorage();
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it("được gật → trả true, nhớ kết quả true", async () => {
    fakeStorage({ persisted: false, grant: true });
    await expect(ensurePersistentStorage()).resolves.toBe(true);
    expect(persistAskResult()).toBe(true);
  });

  it("máy KHÔNG có API (WebView cũ) → false, không ném, không ghi gì", async () => {
    fakeStorage({ persisted: false, missing: true });
    await expect(ensurePersistentStorage()).resolves.toBe(false);
    expect(persistAskResult()).toBeNull();
    expect(localStorage.getItem(PERSIST_ASK_KEY)).toBeNull();
  });

  it("API NÉM (ngữ cảnh không bảo mật) → nuốt lỗi, trả false", async () => {
    setNavigator({
      storage: {
        persist: () => Promise.reject(new Error("nổ")),
        persisted: () => Promise.resolve(false),
      },
    });
    await expect(ensurePersistentStorage()).resolves.toBe(false);
  });

  /*  ⚠️ BẤT BIẾN QUAN TRỌNG NHẤT (chủ dự án lo đúng chỗ: *"hỏi lúc offline hay
      hỏi lúc online? tránh nó làm thành request lỗi trong lúc offline rồi chết
      cả app"*). `persist()` là API CỤC BỘ của trình duyệt — hỏi bộ quản lý kho
      ngay trong máy. Nếu người sau lỡ nhét một lời gọi mạng vào đường này thì
      giữa biển nó thành request treo/lỗi trên đúng màn hình cần chạy offline. */
  it("KHÔNG gọi mạng, và chạy bình thường khi máy đang MẤT SÓNG", async () => {
    const persist = vi.fn().mockResolvedValue(true);
    setNavigator({
      onLine: false, // MẤT SÓNG HẲN
      storage: { persist, persisted: vi.fn().mockResolvedValue(false) },
    });
    const spy = vi.fn().mockRejectedValue(new Error("không được gọi mạng"));
    globalThis.fetch = spy as unknown as typeof fetch;
    await expect(ensurePersistentStorage()).resolves.toBe(true);
    expect(spy).not.toHaveBeenCalled();
    expect(persist).toHaveBeenCalledTimes(1);
  });
});

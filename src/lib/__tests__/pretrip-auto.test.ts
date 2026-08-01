import { describe, expect, it, beforeEach } from "vitest";

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
  shouldAttemptAutoPretrip,
  autoPretripLine,
  coverageChipText,
  lastAutoPretripAt,
  markAutoPretripRun,
  pretripSavedText,
  shouldAutoPretrip,
  shouldMarkPretripRun,
  PRETRIP_MIN_INTERVAL_MS,
  PRETRIP_LAST_RUN_KEY,
} from "../pretrip-auto";
import type { PretripResult, SavedCoverage, SavedLayer } from "../pretrip";

const NOW = Date.parse("2026-07-25T03:00:00Z"); // 10:00 ngày 25/7 giờ VN

beforeEach(() => localStorage.clear());

describe("shouldAutoPretrip — TIẾT CHẾ DATA (mỗi lượt ~2,5–3 MB)", () => {
  it("chưa tải lần nào → CHẠY", () => {
    expect(
      shouldAutoPretrip({ lastRunAt: null, nowMs: NOW, online: true }),
    ).toBe(true);
  });

  it("bản trong máy đã CŨ hơn 6 giờ → CHẠY", () => {
    const old = NOW - PRETRIP_MIN_INTERVAL_MS - 60_000;
    expect(shouldAutoPretrip({ lastRunAt: old, nowMs: NOW, online: true })).toBe(
      true,
    );
  });

  it("bản còn MỚI (vừa tải 1 giờ trước) → KHÔNG chạy, không báo gì", () => {
    const fresh = NOW - 60 * 60 * 1000;
    expect(
      shouldAutoPretrip({ lastRunAt: fresh, nowMs: NOW, online: true }),
    ).toBe(false);
  });

  it("đúng mốc 6 giờ → CHẠY (>=, không kẹt ở ranh giới)", () => {
    expect(
      shouldAutoPretrip({
        lastRunAt: NOW - PRETRIP_MIN_INTERVAL_MS,
        nowMs: NOW,
        online: true,
      }),
    ).toBe(true);
  });

  it("MẤT SÓNG → KHÔNG thử tải, kể cả khi bản đã rất cũ", () => {
    expect(
      shouldAutoPretrip({ lastRunAt: null, nowMs: NOW, online: false }),
    ).toBe(false);
    expect(
      shouldAutoPretrip({
        lastRunAt: NOW - 10 * PRETRIP_MIN_INTERVAL_MS,
        nowMs: NOW,
        online: false,
      }),
    ).toBe(false);
  });

  it("mốc nằm ở TƯƠNG LAI (đồng hồ máy bị chỉnh lùi) → vẫn chạy, không kẹt", () => {
    expect(
      shouldAutoPretrip({
        lastRunAt: NOW + 5 * 24 * 60 * 60 * 1000,
        nowMs: NOW,
        online: true,
      }),
    ).toBe(true);
  });

  it("mốc hỏng trong máy → coi như chưa có", () => {
    expect(shouldAutoPretrip({ lastRunAt: NaN, nowMs: NOW, online: true })).toBe(
      true,
    );
  });
});

describe("mốc lần tự tải gần nhất (localStorage)", () => {
  it("chưa ghi → null", () => {
    expect(lastAutoPretripAt()).toBeNull();
  });

  it("ghi rồi đọc lại đúng mốc, dùng key forfish.*", () => {
    markAutoPretripRun(NOW);
    expect(lastAutoPretripAt()).toBe(NOW);
    expect(PRETRIP_LAST_RUN_KEY.startsWith("forfish.")).toBe(true);
    expect(localStorage.getItem(PRETRIP_LAST_RUN_KEY)).toBe(String(NOW));
  });

  it("giá trị rác trong máy → null (không làm cửa chặn kẹt)", () => {
    localStorage.setItem(PRETRIP_LAST_RUN_KEY, "hôm qua");
    expect(lastAutoPretripAt()).toBeNull();
  });

  it("ghi xong thì lần vào trang kế tiếp KHÔNG tải lại", () => {
    markAutoPretripRun(NOW);
    expect(
      shouldAutoPretrip({
        lastRunAt: lastAutoPretripAt(),
        nowMs: NOW + 60_000,
        online: true,
      }),
    ).toBe(false);
  });
});

describe("autoPretripLine — dòng báo tự tắt", () => {
  const saved = { places: 6, untilIso: "2026-08-09", gridDays: [3, 7, 16] };

  it("xong xuôi: nói tới ngày nào, một câu ngắn", () => {
    expect(autoPretripLine({ ok: 10, failed: 0, full: false, saved })).toBe(
      "Đã lưu dự báo tới ngày 9/8.",
    );
  });

  it("hỏng sạch → nói chưa có sóng, KHÔNG khoe bản cũ trong máy", () => {
    expect(autoPretripLine({ ok: 0, failed: 9, full: false, saved })).toBe(
      "Chưa tải được dự báo — chưa có sóng.",
    );
  });

  it("chẳng giữ được gì → không hứa suông", () => {
    expect(
      autoPretripLine({
        ok: 3,
        failed: 6,
        full: false,
        saved: { places: 0, untilIso: null, gridDays: [] },
      }),
    ).toBe("Chưa tải được dự báo — chưa có sóng.");
  });

  it("máy hết chỗ nhớ → nói thật, không báo xong", () => {
    expect(autoPretripLine({ ok: 5, failed: 0, full: true, saved })).toBe(
      "Máy hết chỗ nhớ — xoá bớt điểm đã lưu.",
    );
  });
});

describe("pretripSavedText — nhãn nhỏ thường trực trên box biển động", () => {
  const saved = { places: 6, untilIso: "2026-08-09", gridDays: [3, 7, 16] };

  it("đang tải → 'Đang tải dữ liệu dự báo' (kể cả khi máy đã có bản cũ)", () => {
    expect(pretripSavedText("loading", saved)).toBe("Đang tải dữ liệu dự báo");
    expect(pretripSavedText("loading", null)).toBe("Đang tải dữ liệu dự báo");
  });

  it("đã có bản lưu → nói tới ngày xa nhất", () => {
    expect(pretripSavedText("idle", saved)).toBe(
      "Đã lưu dữ liệu dự báo tới ngày 9/8",
    );
  });

  it("chưa có gì (rỗng/null/thiếu ngày) → 'Chưa tải dữ liệu dự báo'", () => {
    expect(pretripSavedText("idle", null)).toBe("Chưa tải dữ liệu dự báo");
    expect(
      pretripSavedText("idle", { places: 0, untilIso: null, gridDays: [] }),
    ).toBe("Chưa tải dữ liệu dự báo");
    // có chỗ nhưng không có ngày xa nhất → vẫn coi như chưa dùng được
    expect(
      pretripSavedText("idle", { places: 3, untilIso: null, gridDays: [3] }),
    ).toBe("Chưa tải dữ liệu dự báo");
  });
});

/*
  2026-07-29: mở app lúc mất sóng thì TRƯỚC ĐÂY cả phiên không bao giờ tự kéo
  lại (cờ startedThisLoad một-lần). Nay có shouldAttemptAutoPretrip để thử lại
  khi máy có sóng lại / bà con quay lại app, nhưng phải chống mạng chập chờn.
*/
describe("shouldAttemptAutoPretrip — tự kéo lại khi có sóng", () => {
  const HOUR = 60 * 60 * 1000;
  const now = 1_700_000_000_000;

  it("mất sóng → không thử (dù chưa thử lần nào)", () => {
    expect(
      shouldAttemptAutoPretrip({
        lastRunAt: null,
        lastAttemptAt: null,
        nowMs: now,
        online: false,
      }),
    ).toBe(false);
  });

  it("có sóng lại + bản đã cũ + chưa thử lần nào → THỬ", () => {
    expect(
      shouldAttemptAutoPretrip({
        lastRunAt: now - 8 * HOUR,
        lastAttemptAt: null,
        nowMs: now,
        online: true,
      }),
    ).toBe(true);
  });

  it("vừa thử 30 giây trước → KHÔNG bắn lại (mạng chập chờn bật/tắt liên tục)", () => {
    expect(
      shouldAttemptAutoPretrip({
        lastRunAt: now - 8 * HOUR,
        lastAttemptAt: now - 30_000,
        nowMs: now,
        online: true,
      }),
    ).toBe(false);
  });

  it("thử hỏng cách đây 3 phút → THỬ LẠI (lần hỏng không ghi lastRunAt)", () => {
    expect(
      shouldAttemptAutoPretrip({
        lastRunAt: now - 8 * HOUR,
        lastAttemptAt: now - 3 * 60_000,
        nowMs: now,
        online: true,
      }),
    ).toBe(true);
  });

  it("bản trong máy CÒN MỚI → không thử dù online (giữ tiền sóng)", () => {
    expect(
      shouldAttemptAutoPretrip({
        lastRunAt: now - 60_000,
        lastAttemptAt: null,
        nowMs: now,
        online: true,
      }),
    ).toBe(false);
  });
});

describe("coverageChipText — câu chữ TRUNG THỰC theo độ phủ lớp", () => {
  const layer = (over: Partial<SavedLayer>): SavedLayer => ({
    id: "grid",
    label: "x",
    saved: true,
    detail: "",
    savedAt: null,
    sizeBytes: 0,
    fresh: false,
    retriable: true,
    ...over,
  });
  const cov = (over: Partial<SavedCoverage>): SavedCoverage => ({
    layers: [layer({})],
    allSaved: true,
    missing: 0,
    untilIso: null,
    totalBytes: 0,
    savedCount: 1,
    ...over,
  });

  it("đang tải → 'Đang tải dữ liệu dự báo'", () => {
    expect(coverageChipText("loading", null)).toBe("Đang tải dữ liệu dự báo");
  });

  it("máy trống → 'Chưa tải dữ liệu dự báo'", () => {
    expect(
      coverageChipText("idle", cov({ layers: [layer({ saved: false })], allSaved: false, missing: 1 })),
    ).toBe("Chưa tải dữ liệu dự báo");
  });

  it("đủ mọi lớp + có ngày → 'Đã lưu đủ … tới ngày X' (chỉ nói khi allSaved)", () => {
    expect(coverageChipText("idle", cov({ untilIso: "2026-08-13" }))).toBe(
      "Đã lưu đủ dự báo — tới ngày 13/8",
    );
  });

  it("còn thiếu lớp → nói thẳng số lớp, KHÔNG nói 'đã lưu tới ngày X'", () => {
    const c = cov({
      layers: [layer({ saved: true }), layer({ id: "scalar", saved: false })],
      allSaved: false,
      missing: 2,
      untilIso: "2026-08-13",
    });
    expect(coverageChipText("idle", c)).toBe("Còn thiếu 2 lớp — chạm xem");
  });
});

/*
  CỬA CHẶN 6 GIỜ CHỈ ĐƯỢC ĐÓNG KHI MẺ TẢI THẬT SỰ GIỮ ĐƯỢC GÌ (2026-08-01).
  Cảnh thật: 5h sáng chủ tàu mở app ở khu neo khuất sóng, cả mẻ hỏng; 20 phút
  sau ra cửa biển sóng đầy vạch mà app không tải nữa vì mốc đã ghi.
  KHÔNG được gác bằng `r.ok > 0`: hai bước "Nước dâng / xoáy" và "Bản đồ mùa vụ"
  không bao giờ ném nên `ok >= 2` kể cả khi rút cáp mạng.
*/
describe("shouldMarkPretripRun — hỏng sạch thì ĐỪNG khoá 6 giờ", () => {
  const res = (over: Partial<PretripResult> = {}): PretripResult => ({
    ok: 2,
    failed: 9,
    full: false,
    saved: { places: 0, untilIso: null, gridDays: [] },
    ...over,
  });

  it("hỏng vì sóng (không giữ được gì) → KHÔNG ghi mốc, để cửa 2 phút thử lại", () => {
    expect(shouldMarkPretripRun(res())).toBe(false);
  });

  it("có ok>0 mà chẳng lưu được chỗ nào → vẫn KHÔNG ghi mốc", () => {
    expect(shouldMarkPretripRun(res({ ok: 5, failed: 4 }))).toBe(false);
  });

  it("lưu được chỗ + có ngày xa nhất → GHI mốc, nghỉ 6 giờ", () => {
    expect(
      shouldMarkPretripRun(
        res({ saved: { places: 3, untilIso: "2026-08-10", gridDays: [3] } }),
      ),
    ).toBe(true);
  });

  it("máy HẾT CHỖ → GHI mốc (thử lại cũng không giữ được, chỉ tốn tiền sóng)", () => {
    expect(shouldMarkPretripRun(res({ full: true }))).toBe(true);
  });
});

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
  autoPretripTone,
  coverageChipOk,
  coverageChipText,
  lastAutoPretripAt,
  markAutoPretripRun,
  pretripGainedCore,
  pretripKeptCore,
  pretripSavedText,
  shouldAutoPretrip,
  shouldMarkPretripRun,
  PRETRIP_MIN_INTERVAL_MS,
  PRETRIP_MIN_RETRY_MS,
  PRETRIP_PARTIAL_RETRY_MS,
  PRETRIP_LAST_RUN_KEY,
} from "../pretrip-auto";
import type { PretripResult, SavedCoverage, SavedLayer } from "../pretrip";

const NOW = Date.parse("2026-07-25T03:00:00Z"); // 10:00 ngày 25/7 giờ VN

/** Kết quả một mẻ tải sẵn — mặc định "hỏng vì sóng", ghi đè từng vế khi cần. */
const result = (over: Partial<PretripResult> = {}): PretripResult => ({
  ok: 2,
  failed: 9,
  full: false,
  saved: { places: 0, untilIso: null, gridDays: [] },
  gained: {},
  kept: {},
  coreFresh: false,
  timedOut: false,
  ...over,
});

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

  /* C-C6: máy đầy ⇒ setItem ném ⇒ mốc không ghi xuống được ⇒ cửa 6 giờ mất tác
     dụng, mỗi lần liếc điện thoại là một mẻ ~3 MB tiền sóng. Mốc dự phòng trong
     bộ nhớ giữ cửa 6 giờ trong suốt phiên. */
  it("MÁY ĐẦY (ghi không xuống) → vẫn giữ được cửa 6 giờ trong phiên", () => {
    const orig = localStorage.setItem;
    (localStorage as unknown as { setItem: unknown }).setItem = () => {
      const e = new Error("QuotaExceededError");
      e.name = "QuotaExceededError";
      throw e;
    };
    try {
      expect(markAutoPretripRun(NOW)).toBe(false);
      expect(localStorage.getItem(PRETRIP_LAST_RUN_KEY)).toBeNull();
      expect(lastAutoPretripAt()).toBe(NOW);
      expect(
        shouldAutoPretrip({
          lastRunAt: lastAutoPretripAt(),
          nowMs: NOW + 60_000,
          online: true,
        }),
      ).toBe(false);
    } finally {
      (localStorage as unknown as { setItem: unknown }).setItem = orig;
    }
    // ghi xuống được lần nữa → mốc bộ nhớ nhường chỗ cho mốc thật
    const later = NOW + 7 * 60 * 60 * 1000;
    expect(markAutoPretripRun(later)).toBe(true);
    expect(lastAutoPretripAt()).toBe(later);
  });
});

describe("autoPretripLine — dòng báo tự tắt", () => {
  const saved = { places: 6, untilIso: "2026-08-09", gridDays: [3, 7, 16] };
  const gained = { point: 6, grid: 3 };

  it("xong xuôi: nói tới ngày nào, một câu ngắn", () => {
    const r = result({ ok: 10, failed: 0, saved, gained });
    expect(autoPretripLine(r)).toBe("Đã lưu dự báo tới ngày 9/8.");
    expect(autoPretripTone(r)).toBe("ok");
  });

  it("hỏng sạch → nói chưa có sóng, KHÔNG khoe bản cũ trong máy", () => {
    const r = result({ ok: 0, saved });
    expect(autoPretripLine(r)).toBe("Chưa tải được dự báo — chưa có sóng.");
    expect(autoPretripTone(r)).toBe("warn");
  });

  it("chẳng giữ được gì → không hứa suông", () => {
    expect(autoPretripLine(result({ ok: 3, failed: 6 }))).toBe(
      "Chưa tải được dự báo — chưa có sóng.",
    );
  });

  /* LỖI C-5: máy đã có bản CŨ + mẻ này hỏng sạch. `r.ok` không bao giờ bằng 0
     (ba bước không bao giờ ném) và `saved` là ảnh chụp KHO nên vẫn đầy đủ ⇒ dòng
     báo cũ khoe "Đã lưu dự báo tới ngày 9/8" như thể vừa tải xong. */
  it("máy CÓ SẴN bản cũ mà mẻ này hỏng sạch → vẫn phải nói CHƯA TẢI ĐƯỢC", () => {
    expect(autoPretripLine(result({ ok: 3, saved }))).toBe(
      "Chưa tải được dự báo — chưa có sóng.",
    );
  });

  it("vớt được mỗi tin bão / bảng giá → chưa phải là có dự báo đi biển", () => {
    expect(
      autoPretripLine(result({ ok: 4, failed: 8, saved, gained: { storm: 1, price: 2 } })),
    ).toBe("Chưa tải được dự báo — chưa có sóng.");
  });

  it("giữ được lưới cả vùng dù chưa có điểm ghim nào → báo xong", () => {
    expect(
      autoPretripLine(
        result({
          ok: 6,
          failed: 3,
          saved: { places: 0, untilIso: null, gridDays: [3, 16] },
          gained: { grid: 2 },
        }),
      ),
    ).toBe("Đã lưu dự báo mới về máy.");
  });

  it("máy hết chỗ nhớ → nói thật, không báo xong", () => {
    const r = result({ ok: 5, failed: 0, full: true, saved, gained });
    expect(autoPretripLine(r)).toBe("Máy hết chỗ nhớ — xoá bớt điểm đã lưu.");
    expect(autoPretripTone(r)).toBe("warn");
  });

  /* LỖI K3: mẻ bị cắt ở bước 6–7 vẫn có `gained.point > 0` (điểm ghim chạy ĐẦU
     danh sách) ⇒ dòng báo cũ XANH "Đã lưu dự báo tới ngày 9/8" ngay cạnh chip
     vàng "Còn thiếu 6 lớp" — hai chỗ trên cùng màn hình nói ngược nhau. */
  it("BỊ CẮT giữa chừng → nói còn thiếu, tông CẢNH BÁO (dù đã lưu được điểm)", () => {
    const r = result({ ok: 6, failed: 7, saved, gained, timedOut: true });
    expect(autoPretripLine(r)).toBe(
      "Mới tải được một phần — sóng chậm, còn thiếu vài lớp.",
    );
    expect(autoPretripTone(r)).toBe("warn");
  });

  /* LỖI K1: nguồn marine 429, kho đang giữ lưới đầy đủ nên cửa ghi đè TỪ CHỐI —
     chẳng ghi bản nào mới nhưng máy vẫn sẵn sàng đi biển. Không được nói "hỏng",
     cũng không được khoe "đã lưu" cái vốn nằm sẵn trong máy. */
  it("kho đang giữ bản tốt hơn (không ghi thêm) → nói đúng chuyện đó, tông xanh", () => {
    const r = result({ ok: 9, failed: 4, saved, kept: { grid: 3 } });
    expect(autoPretripLine(r)).toBe("Dự báo trong máy vẫn còn dùng được.");
    expect(autoPretripTone(r)).toBe("ok");
  });

  it("mọi lớp còn hiện hành nên không gọi mạng lần nào → cũng nói vậy", () => {
    const r = result({ ok: 13, failed: 0, saved, coreFresh: true });
    expect(autoPretripLine(r)).toBe("Dự báo trong máy vẫn còn dùng được.");
    expect(autoPretripTone(r)).toBe("ok");
  });
});

/*
  K1 — PHÂN BIỆT "KHO ĐANG GIỮ BẢN TỐT HƠN" VỚI "HỎNG VÌ SÓNG".
  Trộn hai thứ này là gốc vòng ĐỐT SÓNG 2 phút/lượt (~2,5–3 MB mỗi lượt).
*/
describe("pretripGainedCore / pretripKeptCore", () => {
  it("ghi được lớp cốt lõi → cả hai đều true", () => {
    const r = result({ gained: { grid: 1 } });
    expect(pretripGainedCore(r)).toBe(true);
    expect(pretripKeptCore(r)).toBe(true);
  });

  it("chỉ TỪ CHỐI GHI vì kho tốt hơn → GIỮ ĐƯỢC, nhưng không phải GHI ĐƯỢC", () => {
    const r = result({ kept: { grid: 3 } });
    expect(pretripGainedCore(r)).toBe(false);
    expect(pretripKeptCore(r)).toBe(true);
  });

  it("kho còn tươi mà không ghi lần nào → vẫn là giữ được", () => {
    expect(pretripKeptCore(result({ coreFresh: true }))).toBe(true);
  });

  it("chỉ từ chối ghi LỚP DẢI MÀU → chưa phải giữ được thứ đi biển", () => {
    expect(pretripKeptCore(result({ kept: { scalar: 5 } }))).toBe(false);
  });

  it("hỏng vì sóng thật → false cả hai", () => {
    expect(pretripKeptCore(result())).toBe(false);
    expect(pretripGainedCore(result())).toBe(false);
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
  // "hôm nay" cố định để test không phụ thuộc ngày chạy
  const TODAY = "2026-08-02";
  const layer = (over: Partial<SavedLayer>): SavedLayer => ({
    id: "grid",
    label: "x",
    saved: true,
    detail: "",
    savedAt: null,
    sizeBytes: 0,
    fresh: true,
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
    expect(coverageChipText("loading", null, TODAY)).toBe(
      "Đang tải dữ liệu dự báo",
    );
  });

  it("máy trống → 'Chưa tải dữ liệu dự báo'", () => {
    expect(
      coverageChipText(
        "idle",
        cov({ layers: [layer({ saved: false })], allSaved: false, missing: 1 }),
        TODAY,
      ),
    ).toBe("Chưa tải dữ liệu dự báo");
  });

  it("đủ mọi lớp + còn mới + có ngày → 'Đã lưu đủ … tới ngày X'", () => {
    expect(
      coverageChipText("idle", cov({ untilIso: "2026-08-13" }), TODAY),
    ).toBe("Đã lưu đủ dự báo — tới ngày 13/8");
    expect(coverageChipOk(cov({ untilIso: "2026-08-13" }), TODAY)).toBe(true);
  });

  it("còn thiếu lớp → nói thẳng số lớp, KHÔNG nói 'đã lưu tới ngày X'", () => {
    const c = cov({
      layers: [layer({ saved: true }), layer({ id: "scalar", saved: false })],
      allSaved: false,
      missing: 2,
      untilIso: "2026-08-13",
    });
    expect(coverageChipText("idle", c, TODAY)).toBe("Còn thiếu 2 lớp — chạm xem");
  });

  /* CHIP NÓI DỐI (2026-08-02): `saved` chỉ nói "có bản trong máy", không nói bản
     đó còn dùng được. Đây là chỗ bà con LIẾC TRƯỚC KHI NHỔ NEO. */
  it("đủ 9 lớp nhưng ngày xa nhất ĐÃ QUA → nói hết hạn, không khoe ngày cũ", () => {
    const c = cov({ untilIso: "2026-07-25" });
    expect(coverageChipText("idle", c, TODAY)).toBe(
      "Dự báo đã lưu hết hạn — chạm tải lại",
    );
    expect(coverageChipOk(c, TODAY)).toBe(false);
  });

  it("hôm nay vẫn còn trong tầm phủ → chưa gọi là hết hạn", () => {
    expect(
      coverageChipText("idle", cov({ untilIso: TODAY }), TODAY),
    ).toBe("Đã lưu đủ dự báo — tới ngày 2/8");
  });

  it("đủ lớp nhưng có lớp QUÁ CHU KỲ cập nhật → nói đã cũ, không nói 'đủ'", () => {
    const c = cov({
      layers: [layer({}), layer({ id: "scalar", fresh: false })],
      untilIso: "2026-08-13",
      savedCount: 2,
    });
    expect(coverageChipText("idle", c, TODAY)).toBe(
      "Dự báo trong máy đã cũ — chạm tải mới",
    );
    expect(coverageChipOk(c, TODAY)).toBe(false);
  });

  it("lớp KHOÁ (bản đồ cá chưa premium) cũ thì kệ — không kéo chip sang vàng", () => {
    const c = cov({
      layers: [layer({}), layer({ id: "fish", fresh: false, retriable: false })],
      untilIso: "2026-08-13",
    });
    expect(coverageChipOk(c, TODAY)).toBe(true);
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
  const res = result;

  it("hỏng vì sóng (không giữ được gì) → KHÔNG ghi mốc, để cửa 2 phút thử lại", () => {
    expect(shouldMarkPretripRun(res())).toBe(false);
  });

  it("có ok>0 mà chẳng lưu được chỗ nào → vẫn KHÔNG ghi mốc", () => {
    expect(shouldMarkPretripRun(res({ ok: 5, failed: 4 }))).toBe(false);
  });

  /* CA THẬT HAY GẶP NHẤT (C-5, thiếu test tới 2026-08-02): máy ĐÃ CÓ bản 3 hôm
     trước, mẻ 5h sáng ở khu neo khuất sóng hỏng SẠCH. Bản cũ đọc KHO nên thấy
     `places > 0` + `untilIso` ⇒ ghi mốc, khoá 6 giờ; 20 phút sau ra cửa biển
     sóng đầy vạch mà app không tải nữa. */
  it("máy CÓ SẴN bản cũ + mẻ hỏng sạch → KHÔNG ghi mốc (không khoá 6 giờ)", () => {
    expect(
      shouldMarkPretripRun(
        res({
          ok: 3,
          saved: { places: 6, untilIso: "2026-08-09", gridDays: [3, 7, 16] },
          gained: {},
        }),
      ),
    ).toBe(false);
  });

  it("mẻ chỉ vớt được tin bão / bảng giá vài KB → KHÔNG khoá 6 giờ", () => {
    expect(shouldMarkPretripRun(res({ gained: { storm: 1, price: 2 } }))).toBe(
      false,
    );
  });

  it("mẻ ghi được dự báo điểm → GHI mốc, nghỉ 6 giờ", () => {
    expect(shouldMarkPretripRun(res({ gained: { point: 3 } }))).toBe(true);
  });

  it("mẻ ghi được lưới cả vùng → GHI mốc (kể cả khi chưa ghim điểm nào)", () => {
    expect(shouldMarkPretripRun(res({ gained: { grid: 1 } }))).toBe(true);
  });

  it("máy HẾT CHỖ → GHI mốc (thử lại cũng không giữ được, chỉ tốn tiền sóng)", () => {
    expect(shouldMarkPretripRun(res({ full: true }))).toBe(true);
  });

  /*
    K1 — VÒNG ĐỐT SÓNG 2 PHÚT/LƯỢT. Nguồn marine 429 (chuyện thường), máy đang
    giữ lưới ĐẦY ĐỦ lưu 7 giờ trước (<24h nên cửa ghi đè từ chối bản mới thiếu
    sóng), bà con chưa ghim điểm nào ⇒ cả 3 khung [3,7,16] đều bị từ chối ⇒
    `gained` rỗng ⇒ không ghi mốc ⇒ mỗi `visibilitychange` lại một mẻ 13 bước
    ~2,5–3 MB. Sim của bà con trả tiền theo dung lượng.
  */
  it("kho đang giữ bản TỐT HƠN (từ chối ghi) → GHI mốc, đừng bắn lại sau 2 phút", () => {
    expect(shouldMarkPretripRun(res({ ok: 9, kept: { grid: 3 } }))).toBe(true);
  });

  it("mọi lớp còn hiện hành, không ghi lần nào → cũng GHI mốc", () => {
    expect(shouldMarkPretripRun(res({ ok: 13, failed: 0, coreFresh: true }))).toBe(
      true,
    );
  });

  it("chỉ từ chối ghi LỚP DẢI MÀU thôi → vẫn KHÔNG khoá 6 giờ", () => {
    expect(shouldMarkPretripRun(res({ kept: { scalar: 5 } }))).toBe(false);
  });

  /*
    K3 — CẮT 240 GIÂY GIỮA CHỪNG VẪN KHOÁ 6 GIỜ. Điểm ghim chạy ĐẦU
    `pretripSteps`, nên ở cảng sóng chậm-mà-sống mẻ ăn hết trần tại bước 6–7 vẫn
    có `gained.point > 0` ⇒ khoá 6 giờ với 6–8 lớp chưa tải.
  */
  it("BỊ CẮT giữa chừng → KHÔNG khoá 6 giờ dù đã lưu được điểm ghim", () => {
    expect(
      shouldMarkPretripRun(
        res({ ok: 6, failed: 7, gained: { point: 6, grid: 1 }, timedOut: true }),
      ),
    ).toBe(false);
  });

  it("bị cắt NHƯNG máy hết chỗ → vẫn ghi mốc (tải tiếp cũng không giữ nổi)", () => {
    expect(shouldMarkPretripRun(res({ full: true, timedOut: true }))).toBe(true);
  });
});

/*
  K3 (vế đi kèm): không khoá 6 giờ thì phải có cửa thử lại RIÊNG, không thì rơi
  về cửa 2 phút và lại đốt sóng. 30 phút — mẻ sau các lớp đã lấy được trả thẳng
  từ kho nên chỉ tải phần còn thiếu.
*/
describe("cửa thử lại sau mẻ BỊ CẮT", () => {
  const HOUR = 60 * 60 * 1000;
  const now = 1_700_000_000_000;
  const gate = (over: Record<string, unknown> = {}) => ({
    lastRunAt: now - 8 * HOUR,
    lastAttemptAt: now - 5 * 60_000,
    nowMs: now,
    online: true,
    ...over,
  });

  it("mẻ trước bị cắt + mới 5 phút → CHƯA thử lại (cửa 30 phút)", () => {
    expect(
      shouldAttemptAutoPretrip(gate({ lastAttemptPartial: true })),
    ).toBe(false);
    // cùng mốc đó mà mẻ trước KHÔNG bị cắt thì được thử (cửa 2 phút)
    expect(shouldAttemptAutoPretrip(gate())).toBe(true);
  });

  it("qua đủ 30 phút → thử tiếp phần còn thiếu", () => {
    expect(
      shouldAttemptAutoPretrip(
        gate({
          lastAttemptPartial: true,
          lastAttemptAt: now - PRETRIP_PARTIAL_RETRY_MS,
        }),
      ),
    ).toBe(true);
  });

  it("cửa mẻ-bị-cắt phải RỘNG HƠN cửa thường (không thì vá bằng không)", () => {
    expect(PRETRIP_PARTIAL_RETRY_MS).toBeGreaterThan(PRETRIP_MIN_RETRY_MS);
  });
});

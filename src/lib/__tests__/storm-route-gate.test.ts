import { describe, expect, it } from "vitest";
import { stormGateForRoute, stormStatus, type StormStatus } from "../storms";

/*  CỔNG CHẶN KHUÔN — "chưa hỏi được tin bão" KHÔNG ĐƯỢC thành "trời quang".
 *
 *  Lỗi gốc (thẩm định 2026-08-16, P0): màn bản đồ nén mọi trạng thái ≠ `co-bao`
 *  thành `storms = []`, rồi `route-planner` đọc mảng rỗng là "tuyến không cắt
 *  vùng bão nào" ⇒ mất sóng giữa biển và biển lặng thật cho ra CÙNG một tuyến,
 *  cùng một màn hình, không một chữ khác nhau.
 *
 *  Bất biến khoá ở đây: chỉ hai trạng thái ĐÃ HỎI ĐƯỢC mới được `known: true`.
 */

const T0 = Date.parse("2026-08-16T10:00:00Z");

describe("stormGateForRoute — chỉ tin bão hỏi được mới coi là đã đối chiếu", () => {
  it("có bão / không bão (tin còn mới) → known", () => {
    const coBao: StormStatus = {
      kind: "co-bao",
      storms: [],
      checkedAt: T0,
      cu: false,
    };
    const khongCo: StormStatus = { kind: "khong-co", checkedAt: T0 };
    expect(stormGateForRoute(coBao, T0)).toEqual({ known: true, warnText: null });
    expect(stormGateForRoute(khongCo, T0)).toEqual({ known: true, warnText: null });
  });

  it("đang hỏi → KHÔNG known, có câu cảnh báo", () => {
    const g = stormGateForRoute({ kind: "dang-hoi" }, T0);
    expect(g.known).toBe(false);
    expect(g.warnText).toContain("KHÔNG đối chiếu bão");
  });

  it("không hỏi được, máy chưa từng có tin → KHÔNG known", () => {
    const g = stormGateForRoute({ kind: "khong-hoi-duoc", checkedAt: null }, T0);
    expect(g.known).toBe(false);
    expect(g.warnText).toContain("chưa có tin bão nào");
  });

  it("tin cũ → nói đúng tuổi bản tin cuối", () => {
    const g = stormGateForRoute(
      { kind: "khong-hoi-duoc", checkedAt: T0 - 20 * 3600_000 },
      T0,
    );
    expect(g.known).toBe(false);
    expect(g.warnText).toContain("20 giờ");
  });

  it("tin cũ hơn hai ngày → đổi sang đơn vị ngày (đừng bắt đọc '73 giờ')", () => {
    const g = stormGateForRoute(
      { kind: "khong-hoi-duoc", checkedAt: T0 - 73 * 3600_000 },
      T0,
    );
    expect(g.warnText).toContain("3 ngày");
  });

  it("đồng hồ máy chạy lùi (mốc ở tương lai) → không bịa tuổi âm", () => {
    const g = stormGateForRoute(
      { kind: "khong-hoi-duoc", checkedAt: T0 + 5 * 3600_000 },
      T0,
    );
    expect(g.known).toBe(false);
    expect(g.warnText).not.toContain("-");
  });

  /*  Đi thẳng từ câu trả lời THẬT của nguồn: bản tin "không có bão" nhưng đã
      quá STORM_MAX_AGE_MS phải rơi về KHÔNG known — đây đúng là ca ngoài biển
      (service worker trả lại bản /api/storms cũ, `ok:true`, storms rỗng). */
  it("bản tin cũ 'không có bão' đi qua stormStatus → vẫn KHÔNG known", () => {
    const st = stormStatus(
      {
        ok: true,
        storms: [],
        checkedAt: new Date(T0 - 30 * 3600_000).toISOString(),
      },
      T0,
    );
    expect(st.kind).toBe("khong-hoi-duoc");
    expect(stormGateForRoute(st, T0).known).toBe(false);
  });
});

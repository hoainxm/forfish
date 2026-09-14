// @vitest-environment jsdom
//
// MÁY TRẠNG THÁI `useAssistant` CHẠY THẬT (14 §5.4) — ba lỗi audit 2026-09-06
// chỉ thấy được khi hook được render đúng như app:
//   · P0-2: React StrictMode (dev) chạy effect hai lần → cleanup `cancel()` huỷ
//     mic 1 ms sau khi mở; bà con phải chạm thêm một lần ở máy chủ dự án.
//   · P1-7 (chốt lead): "ừ" bằng giọng chạy việc hoàn tác được (thêm giỏ), còn
//     gọi điện vẫn phải CHẠM nút Gọi.
//   · P1-4: nói "đổi lại" sau khi đặt cảng nhà = chạm chip "Đổi lại".
// Mic/TTS/mạng đều giả — chỉ đo máy trạng thái.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StrictMode, createElement, type ReactNode } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { AssistantAction, DeviceSnapshot } from "@/lib/assistant/types";

const bus = vi.hoisted(() => ({
  listenCalls: 0,
  abortCalls: 0,
  snap: null as unknown,
  items: [] as unknown[],
  spoken: [] as string[],
  /** URL hook gọi ra mạng — để chứng minh ý định bị chặn KHÔNG bao giờ lên máy chủ (AC-T06) */
  fetchUrls: [] as string[],
  /** tay cầm của lượt nghe cuối — test gọi `onError("no-speech")` như Chrome khi bà con im */
  hooks: null as null | { onError(code: string): void },
}));

vi.mock("@/lib/assistant/speech", () => ({
  sttSupported: () => true,
  listenOnce: (h: { onError(code: string): void }) => {
    bus.listenCalls += 1;
    bus.hooks = h;
    return { stop() {}, abort() { bus.abortCalls += 1; } };
  },
  speak: (t: string) => {
    bus.spoken.push(t);
    return () => {};
  },
  cancelSpeak: () => {},
}));
vi.mock("@/lib/assistant/device-snapshot", () => ({
  gomSnapshot: () => bus.snap,
  stripForServer: (s: unknown) => s,
}));
vi.mock("@/lib/use-auth", () => ({ useAuthUser: () => ({ signedIn: true }) }));
vi.mock("@/lib/use-online", () => ({ isOffline: () => false }));
vi.mock("@/lib/boats", () => ({ loadBoats: () => [] }));
vi.mock("@/lib/device-token-store", () => ({
  authedFetch: async (url: string) => {
    bus.fetchUrls.push(url);
    return { res: null };
  },
}));
vi.mock("@/lib/market/client", () => ({
  marketGet: async () => ({ ok: true, data: { items: bus.items } }),
}));

import { useAssistant } from "@/lib/assistant/use-assistant";

function snap(over: Partial<DeviceSnapshot> = {}): DeviceSnapshot {
  return {
    takenAt: Date.now(), route: "/", online: true, premium: false,
    home: { portId: "quy-nhon", portName: "Quy Nhơn", province: "Gia Lai" },
    weather: null, storm: null, tide: null, boat: null, docs: [], maintenance: [], crew: null,
    cart: { lines: 0, titles: [] }, orders: null, fishPrices: null, fuel: null, inboxUnread: 0, placeNames: [],
    ...over,
  };
}

const product = (id: string, title: string) => ({
  id, title, priceVnd: 100000, shopName: "SDVICO", status: "dang_ban", adminHidden: false, stock: 10, shopPaused: false,
});

async function settle() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 5));
  });
}

function mount(onAction: (a: AssistantAction) => void, strict = false) {
  const wrapper = strict ? ({ children }: { children: ReactNode }) => createElement(StrictMode, null, children) : undefined;
  return renderHook(() => useAssistant({ route: "/", onAction }), { wrapper });
}

beforeEach(() => {
  window.localStorage.clear();
  bus.listenCalls = 0;
  bus.abortCalls = 0;
  bus.snap = snap();
  bus.items = [];
  bus.spoken = [];
  bus.fetchUrls = [];
  bus.hooks = null;
});
afterEach(() => cleanup());

describe("useAssistant — P0-2 StrictMode không huỷ mic lúc mở", () => {
  it("StrictMode: mở mic một lần, cleanup giả của dev KHÔNG abort; unmount thật mới abort", async () => {
    const h = mount(() => {}, true);
    act(() => h.result.current.listen());
    await settle();
    expect(bus.listenCalls, "mic mở đúng một lần").toBe(1);
    expect(bus.abortCalls, "StrictMode cleanup→mount lại không được huỷ mic").toBe(0);
    expect(h.result.current.state.kind).toBe("listening");
    h.unmount();
    await settle();
    expect(bus.abortCalls, "đóng tấm che thật → huỷ mic").toBe(1);
  });

  it("không StrictMode: hành vi như cũ", async () => {
    const h = mount(() => {});
    act(() => h.result.current.listen());
    expect(bus.listenCalls).toBe(1);
    h.unmount();
    await settle();
    expect(bus.abortCalls).toBe(1);
  });
});

describe("useAssistant — P1-7 xác nhận bằng giọng", () => {
  it("gọi điện: 'ừ' KHÔNG gọi, máy bảo chạm nút Gọi, việc vẫn treo; 'thôi' huỷ", async () => {
    const actions: AssistantAction[] = [];
    const h = mount((a) => actions.push(a));
    await act(async () => h.result.current.ask("gọi SDVICO"));
    await settle();
    expect(h.result.current.state).toMatchObject({ kind: "answered", awaitingConfirm: true });
    await act(async () => h.result.current.ask("ừ"));
    await settle();
    expect(actions, "13 §4.3: gọi điện vẫn phải CHẠM").toEqual([]);
    const st = h.result.current.state;
    expect(st.kind).toBe("answered");
    if (st.kind === "answered") {
      expect(st.awaitingConfirm, "việc vẫn treo để bà con chạm").toBe(true);
      expect(st.reply.text).toMatch(/chạm nút Gọi/);
      expect(st.reply.action?.type, "nút Gọi vẫn còn").toBe("call");
    }
    await act(async () => h.result.current.ask("thôi"));
    await settle();
    expect(actions).toEqual([]);
    expect(h.result.current.state).toMatchObject({ kind: "answered", awaitingConfirm: false });
    // chạm nút xác nhận sau đó: không còn việc treo → không gọi
    act(() => h.result.current.confirm(true));
    expect(actions).toEqual([]);
  });

  it("thêm giỏ (1 thẻ): 'ừ' bằng giọng thêm đúng số đã nói; chạm nút thì màn không in 'Bác vừa nói: ừ'", async () => {
    bus.items = [product("p1", "Dầu nhớt Castrol 18L")];
    const actions: AssistantAction[] = [];
    const h = mount((a) => actions.push(a));
    await act(async () => h.result.current.ask("bỏ 2 thùng nhớt vô giỏ"));
    await settle();
    const st = h.result.current.state;
    expect(st.kind).toBe("answered");
    if (st.kind === "answered") {
      expect(st.reply.action).toMatchObject({ type: "addToCart", productId: "p1", qty: 2 });
      expect(st.reply.qty, "reply.qty = số đã nói (14 §3.1)").toBe(2);
      expect(st.awaitingConfirm).toBe(true);
    }
    await act(async () => h.result.current.ask("ừ"));
    await settle();
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({ type: "addToCart", qty: 2 });
    expect(h.result.current.state).toMatchObject({ kind: "answered", text: "ừ", awaitingConfirm: false });

    // lượt mới + chạm nút: text rỗng (P2-1)
    await act(async () => h.result.current.ask("bỏ 1 thùng nhớt vô giỏ"));
    await settle();
    act(() => h.result.current.confirm(true));
    expect(actions).toHaveLength(2);
    expect(h.result.current.state).toMatchObject({ kind: "answered", text: "" });
  });

  it("thêm giỏ (3 thẻ): reply.qty mang số đã nói, không action, 'ừ' không làm gì", async () => {
    bus.items = [product("a", "Đá cây 50kg"), product("b", "Đá xay"), product("c", "Đá viên")];
    const actions: AssistantAction[] = [];
    const h = mount((a) => actions.push(a));
    await act(async () => h.result.current.ask("bỏ 5 cây đá vô giỏ"));
    await settle();
    const st = h.result.current.state;
    if (st.kind === "answered") {
      expect(st.reply.candidates).toHaveLength(3);
      expect(st.reply.qty).toBe(5);
      expect(st.reply.action).toBeUndefined();
    } else throw new Error(`state ${st.kind}`);
    await act(async () => h.result.current.ask("ừ"));
    await settle();
    expect(actions).toEqual([]);
  });
});

describe("useAssistant — P1-N1 nút 'Mở …' giữ lời mời nói 'ừ'", () => {
  it("'giấy nào sắp hết' → KHÔNG tự đi, việc treo; nói 'ừ' → điều hướng ĐÚNG MỘT LẦN", async () => {
    const actions: AssistantAction[] = [];
    bus.snap = snap({ docs: [{ label: "Bảo hiểm", expiresOn: "2026-09-06", daysLeft: 0, level: "expired" }] });
    const h = mount((a) => actions.push(a));
    await act(async () => h.result.current.ask("giấy nào sắp hết"));
    await settle();
    const st = h.result.current.state;
    if (st.kind !== "answered") throw new Error(`state ${st.kind}`);
    expect(st.reply.action?.type, "câu trả lời kèm nút Mở Giấy tờ").toBe("navigate");
    expect(actions, "chưa chạm/chưa nói ừ thì KHÔNG đi đâu").toEqual([]);
    await act(async () => h.result.current.ask("ừ"));
    await settle();
    expect(actions).toEqual([{ type: "navigate", href: "/tau?tab=giay-to" }]);
    // "ừ" lần nữa: việc đã xong, không đi thêm lần hai
    await act(async () => h.result.current.ask("ừ"));
    await settle();
    expect(actions).toHaveLength(1);
  });

  it("'mở giấy tờ' (bà con nói rõ) vẫn đi NGAY, không bắt nói 'ừ'", async () => {
    const actions: AssistantAction[] = [];
    const h = mount((a) => actions.push(a));
    await act(async () => h.result.current.ask("mở giấy tờ"));
    await settle();
    expect(actions).toEqual([{ type: "navigate", href: "/tau?tab=giay-to" }]);
  });
});

describe("useAssistant — P1-18 im lặng phải NÓI 'chưa nghe rõ'", () => {
  it("lần 1: đọc câu + tự mở mic lại sau khi đọc xong; lần 2: đọc câu chip, không mở mic nữa", async () => {
    vi.useFakeTimers();
    try {
      const h = mount(() => {});
      act(() => h.result.current.listen());
      expect(bus.listenCalls).toBe(1);
      // Chrome: im 8 s → sự kiện no-speech
      act(() => bus.hooks!.onError("no-speech"));
      const st = h.result.current.state;
      if (st.kind !== "answered") throw new Error(`state ${st.kind}`);
      expect(st.reply.text).toMatch(/chưa nghe rõ/);
      expect(bus.spoken.at(-1), "phải ĐỌC, không chỉ hiện chữ").toMatch(/chưa nghe rõ/);
      expect(bus.listenCalls, "chưa đọc xong thì chưa mở mic (chữ không bị màn 'Đang nghe…' đè)").toBe(1);
      act(() => vi.advanceTimersByTime(2000));
      expect(bus.listenCalls, "đọc xong mới nghe lại").toBe(2);
      // lần 2 vẫn im → chip, thôi mở mic
      act(() => bus.hooks!.onError("no-speech"));
      expect(bus.spoken.at(-1)).toMatch(/chọn một trong mấy cái này/);
      act(() => vi.advanceTimersByTime(5000));
      expect(bus.listenCalls).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("useAssistant — P1-4 'đổi lại' bằng giọng = chạm chip", () => {
  it("đặt cảng nhà Sa Kỳ (ghi ngay, đúng tỉnh) rồi nói 'đổi lại' → đặt lại Quy Nhơn", async () => {
    const actions: AssistantAction[] = [];
    const h = mount((a) => actions.push(a));
    await act(async () => h.result.current.ask("đặt cảng nhà là Sa Kỳ"));
    await settle();
    expect(actions[0]).toEqual({ type: "setHomePort", portId: "sa-ky", portName: "Sa Kỳ", province: "Quảng Ngãi" });
    await act(async () => h.result.current.ask("đổi lại"));
    await settle();
    expect(actions[1]).toMatchObject({ type: "setHomePort", portId: "quy-nhon", portName: "Quy Nhơn" });
    const st = h.result.current.state;
    if (st.kind === "answered") expect(st.reply.text).toMatch(/Quy Nhơn/);
  });

  it("'đổi lại' khi không có chip nào → hỏi lại như thường, không làm gì", async () => {
    const actions: AssistantAction[] = [];
    const h = mount((a) => actions.push(a));
    await act(async () => h.result.current.ask("đổi lại"));
    await settle();
    expect(actions).toEqual([]);
    expect(h.result.current.state.kind).toBe("answered");
  });
});

describe("AC-T06 — ý định bị chặn KHÔNG BAO GIỜ lên máy chủ", () => {
  /*  13 §6 + `types.NEVER_ONLINE`: câu y tế / pháp lý / tiền / tra người / chính trị
      phải được trả lời NGAY trong máy và tuyệt đối không gửi đi. Trước hôm nay chỉ có
      `expect(NEVER_ONLINE).toContain("ngoai_pham_vi")` — kiểm HẰNG SỐ, không kiểm
      HÀNH VI: đổi một dòng trong `use-assistant` là câu bệnh tật của bà con lên mạng
      mà mọi test vẫn xanh. Ca này đo đường đi thật của hook.

      Kèm ca ĐỐI CHỨNG: một câu hỏi mở bình thường thì PHẢI gọi — không có nó, một
      bản vá kiểu "cấm gọi mạng luôn cho chắc" cũng xanh.  */

  it("câu bị chặn: trả lời trong máy, không một lượt gọi nào ra /api/tro-ly", async () => {
    const h = mount(() => {});
    for (const say of ["uống thuốc gì cho hết say sóng", "phạt bao nhiêu nếu không có nhật ký", "vay tiền ngân hàng lãi suất mấy phần"]) {
      await act(async () => h.result.current.ask(say));
      await settle();
      expect(h.result.current.state.kind, say).toBe("answered");
    }
    expect(bus.fetchUrls.filter((u) => u.includes("/api/tro-ly")), "câu bị chặn đã lên máy chủ").toEqual([]);
  });

  it("ĐỐI CHỨNG: câu hỏi mở bình thường vẫn được gọi lên máy chủ", async () => {
    const h = mount(() => {});
    await act(async () => h.result.current.ask("nhớt nào tốt cho máy Yanmar chạy đường dài"));
    await settle();
    expect(
      bus.fetchUrls.filter((u) => u.includes("/api/tro-ly")).length,
      "câu hỏi mở phải được hỏi tiếp lên máy chủ — nếu 0 thì cổng trên là cổng chết",
    ).toBe(1);
  });
});

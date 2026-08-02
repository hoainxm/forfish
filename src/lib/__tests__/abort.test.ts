import { describe, expect, it, vi, afterEach } from "vitest";
import { timeoutSignal } from "../abort";

/*  ĐỒNG HỒ CHẶN PHẢI CÓ ĐƯỜNG LÙI THẬT.

    `AbortSignal.timeout` chỉ có từ Safari 16 / Chrome 103. Máy cũ của bà con
    (iPhone còn Safari 15 / iOS 15.8, WebView Android đời cũ) ném TypeError NGAY
    TRONG khối try bao quanh lời gọi mạng ⇒ lỗi đội lốt "mất sóng", và nếu hàm
    trả `undefined` cho xong thì lời gọi đó KHÔNG CÒN ĐỒNG HỒ NÀO — promise treo
    vĩnh viễn ở đúng ca "sóng sống mà chết" (bắt được wifi cảng nhưng không ra
    được Internet). Nhóm 40–60 tuổi dùng máy cũ là thật, không phải giả định.  */

type TimeoutFn = ((ms: number) => AbortSignal) | undefined;
const holder = AbortSignal as unknown as { timeout?: TimeoutFn };

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("timeoutSignal", () => {
  it("máy KHÔNG có AbortSignal.timeout → vẫn trả về một AbortSignal thật", () => {
    const real = holder.timeout;
    holder.timeout = undefined;
    try {
      const s = timeoutSignal(1000);
      expect(s).toBeInstanceOf(AbortSignal);
      expect(s!.aborted).toBe(false);
    } finally {
      holder.timeout = real;
    }
  });

  it("máy cũ: tín hiệu TỰ HUỶ sau đúng ms (không treo vĩnh viễn)", () => {
    vi.useFakeTimers();
    const real = holder.timeout;
    holder.timeout = undefined;
    try {
      const s = timeoutSignal(5000)!;
      vi.advanceTimersByTime(4999);
      expect(s.aborted).toBe(false);
      vi.advanceTimersByTime(1);
      expect(s.aborted).toBe(true);
    } finally {
      holder.timeout = real;
    }
  });

  it("AbortSignal.timeout CÓ tên nhưng gọi hỏng → vẫn rơi về đường lùi", () => {
    vi.useFakeTimers();
    const real = holder.timeout;
    holder.timeout = (() => {
      throw new TypeError("không gọi được");
    }) as unknown as TimeoutFn;
    try {
      const s = timeoutSignal(100)!;
      expect(s).toBeInstanceOf(AbortSignal);
      vi.advanceTimersByTime(100);
      expect(s.aborted).toBe(true);
    } finally {
      holder.timeout = real;
    }
  });

  it("máy đời mới: dùng thẳng AbortSignal.timeout", () => {
    const spy = vi.fn(() => new AbortController().signal);
    const real = holder.timeout;
    holder.timeout = spy as unknown as TimeoutFn;
    try {
      timeoutSignal(3000);
      expect(spy).toHaveBeenCalledWith(3000);
    } finally {
      holder.timeout = real;
    }
  });
});

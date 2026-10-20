import { describe, expect, it, vi } from "vitest";
import { lyDoMicro, senMode, SEN_SIGNALS_GOC } from "@/lib/sen-bien-state";
import { micDenied, onMicDeniedChange, setMicDenied } from "@/lib/sen-bien/nghe";

/*  Anh Long 2026-10-20: "sao ko lấy được micro" + "chỉ báo không nghe được khi
    micro bị chặn thật, không báo khi chỉ là chưa xin quyền". */
describe("micro Sen Biển — chỉ báo chặn khi chặn thật, nói đúng nguyên nhân", () => {
  it("chưa xin quyền (cờ chặn tắt) ⇒ icon RẢNH, không phải 'không nghe được'", () => {
    expect(senMode({ ...SEN_SIGNALS_GOC, micBlocked: false })).toBe("ranh");
    expect(senMode({ ...SEN_SIGNALS_GOC, micBlocked: true })).toBe("khong-nghe");
  });

  it("cờ bị chặn: bật/tắt báo cho người nghe, không báo lại khi không đổi", () => {
    const f = vi.fn();
    const huy = onMicDeniedChange(f);
    setMicDenied(false);
    expect(f).not.toHaveBeenCalled();
    setMicDenied(true);
    expect(micDenied()).toBe(true);
    setMicDenied(true);
    setMicDenied(false);
    expect(f.mock.calls).toEqual([[true], [false]]);
    huy();
    setMicDenied(true);
    expect(f).toHaveBeenCalledTimes(2);
    setMicDenied(false);
  });

  it("trang http (không an toàn): nói thẳng trình duyệt cấm micro, chỉ cách mở https", () => {
    expect(lyDoMicro({ code: "not-allowed", secure: false, denied: false })).toMatch(/http.*cấm micro.*https/);
  });
  it("quyền bị chặn cho trang: chỉ chỗ gỡ (ổ khoá cạnh thanh địa chỉ)", () => {
    expect(lyDoMicro({ code: "not-allowed", secure: true, denied: true })).toMatch(/ổ khoá/);
  });
  it("không thấy micro / từ chối hộp hỏi: câu riêng, luôn kèm lối gõ chat", () => {
    expect(lyDoMicro({ code: "audio-capture", secure: true, denied: false })).toMatch(/Không thấy micro/);
    const c = lyDoMicro({ code: "not-allowed", secure: true, denied: false });
    expect(c).toMatch(/cài đặt máy/);
    expect(c).toMatch(/chạm ô chat để gõ/);
  });
});

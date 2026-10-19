import { afterEach, describe, expect, it } from "vitest";
import {
  getSenState,
  resetSenSignals,
  SEN_SIGNALS_GOC,
  senAria,
  senMode,
  senState,
  setSenSignal,
  subscribeSen,
} from "@/lib/sen-bien-state";

const s = (p: Partial<Parameters<typeof senMode>[0]>) => ({ ...SEN_SIGNALS_GOC, ...p });

describe("sen-bien-state — máy trạng thái icon Sen Biển (một nguồn, 2026-10-19)", () => {
  afterEach(() => resetSenSignals());

  it("rảnh khi không có tín hiệu nào", () => {
    expect(senMode(SEN_SIGNALS_GOC)).toBe("ranh");
    expect(senState(SEN_SIGNALS_GOC)).toEqual({ mode: "ranh", canh: false, level: null });
  });

  it("ưu tiên: nghe > nghĩ > nói > không nghe được", () => {
    expect(senMode(s({ listening: true, thinking: true, speaking: true, micBlocked: true }))).toBe("nghe");
    expect(senMode(s({ thinking: true, speaking: true, micBlocked: true }))).toBe("nghi");
    expect(senMode(s({ speaking: true, micBlocked: true }))).toBe("noi");
    expect(senMode(s({ micBlocked: true }))).toBe("khong-nghe");
  });

  it("đang canh là dấu độc lập — đi kèm mọi trạng thái, kể cả lúc im", () => {
    expect(senState(s({ watching: true }))).toEqual({ mode: "ranh", canh: true, level: null });
    expect(senState(s({ watching: true, speaking: true })).canh).toBe(true);
  });

  it("mức âm chỉ hiện lúc đang nghe", () => {
    expect(senState(s({ listening: true, level: 0.4 })).level).toBe(0.4);
    expect(senState(s({ speaking: true, level: 0.4 })).level).toBeNull();
  });

  it("nhãn trợ năng đổi theo trạng thái", () => {
    expect(senAria(senState(SEN_SIGNALS_GOC))).toBe("Sen Biển — chạm để nói");
    expect(senAria(senState(s({ listening: true })))).toBe("Sen Biển đang nghe");
    expect(senAria(senState(s({ micBlocked: true })))).toMatch(/không nghe được/);
    expect(senAria(senState(s({ watching: true })))).toMatch(/đang canh dẫn đường$/);
  });

  it("kho chung: chỉ báo người nghe khi trạng thái hiện ra đổi", () => {
    let n = 0;
    const off = subscribeSen(() => n++);
    setSenSignal({ speaking: true });
    expect(getSenState().mode).toBe("noi");
    expect(n).toBe(1);
    setSenSignal({ level: 0.9 }); // không nghe ⇒ level bị ẩn ⇒ không đổi gì
    expect(n).toBe(1);
    setSenSignal({ speaking: false });
    expect(getSenState().mode).toBe("ranh");
    expect(n).toBe(2);
    off();
    setSenSignal({ watching: true });
    expect(n).toBe(2);
  });
});

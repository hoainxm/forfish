import { describe, it, expect, beforeEach } from "vitest";

/*  NGÕ CỤT "MÁY CHẬT" — chủ dự án chỉ ra chỗ mấu chốt 2026-09-02: *"lúc cấp
    premium thì đã có acc, có sdt, lúc user đăng nhập vào thì ngay thời điểm đó
    đã có token và có premium rồi thì các TH lỗi làm sao xảy ra đc"*.

    Đúng — và chính câu đó loại hết mấy giả thuyết trước (lệch SĐT, chưa deploy,
    cửa 30 phút), để lộ ra đường duy nhất còn lại: GHI HỤT.

    Chuỗi cứng ghi có xác minh (`saveToken` đọc lại), còn dấu hạng thì ghi rồi
    nuốt lỗi. Máy chật ⇒ đăng nhập ĐƯỢC mà dấu hạng KHÔNG ghi được ⇒ "unknown"
    ⇒ rail ẩn Đến điểm/Điểm đã lưu/Dẫn đường ⇒ bà con trả tiền mà không đặt nổi
    điểm đến, không một thông báo nào. */

/** localStorage giả, có công tắc "kho đầy" bật giữa chừng. */
function makeLs() {
  const m = new Map<string, string>();
  let full = false;
  const ls = {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => {
      if (full) throw new Error("QuotaExceededError");
      m.set(k, String(v));
    },
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  } as unknown as Storage;
  return { ls, choDay: (v: boolean) => (full = v), m };
}

const kho = makeLs();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: kho.ls,
  dispatchEvent: () => true,
};
(globalThis as unknown as { localStorage: Storage }).localStorage = kho.ls;

import {
  writePremiumMark,
  readPremiumMark,
  readTierMarkRaw,
  readTierUntilRaw,
  forgetTierMarkCache,
} from "../tier";

beforeEach(() => {
  kho.choDay(false);
  kho.m.clear();
  forgetTierMarkCache();
});

describe("máy chật lúc đăng nhập — dấu hạng KHÔNG được biến mất", () => {
  it("kho ĐẦY: ghi dấu hụt xuống máy, nhưng PHIÊN NÀY vẫn biết là premium", () => {
    kho.choDay(true);
    writePremiumMark(true, "2027-12-31T00:00:00+07:00");

    // kho thật sự trống — ghi đã hụt
    expect(kho.m.size).toBe(0);
    // nhưng câu trả lời vẫn ĐÚNG, không rơi về "unknown"
    expect(readPremiumMark(readTierMarkRaw())).toBe("premium");
    expect(readTierUntilRaw()).toBe("2027-12-31T00:00:00+07:00");
  });

  it("kho ĐẦY + hạng THƯỜNG ⇒ vẫn là 'basic', không thành 'unknown'", () => {
    kho.choDay(true);
    writePremiumMark(false, null);
    expect(readPremiumMark(readTierMarkRaw())).toBe("basic");
  });

  it("kho ghi được ⇒ đọc ra đúng, và bản trong kho là thật (không chỉ bộ nhớ)", () => {
    writePremiumMark(true, "2027-12-31T00:00:00+07:00");
    expect(kho.m.get("forfish.tier.premium.v1")).toBe("1");
    forgetTierMarkCache(); // quên bộ nhớ, buộc đọc từ kho
    expect(readPremiumMark(readTierMarkRaw())).toBe("premium");
  });

  it("CHƯA từng ghi ⇒ vẫn phải là 'unknown' (không mở bừa)", () => {
    expect(readPremiumMark(readTierMarkRaw())).toBe("unknown");
  });

  it("ĐĂNG XUẤT: quên bộ nhớ ⇒ quyền của người CŨ không sống sót", () => {
    kho.choDay(true); // dấu chỉ nằm ở bộ nhớ
    writePremiumMark(true, "2027-12-31T00:00:00+07:00");
    expect(readPremiumMark(readTierMarkRaw())).toBe("premium");
    forgetTierMarkCache(); // đúng thứ `clearTierMark` gọi
    expect(readPremiumMark(readTierMarkRaw())).toBe("unknown");
  });
});

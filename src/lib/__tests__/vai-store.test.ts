// @vitest-environment jsdom
// vai-store — đồng bộ vai lúc mở app (anh Long 09/11 "bỏ mốc đi"): mỗi lần mở app hỏi máy chủ MỘT lần, không chờ 12 giờ.
import { beforeEach, describe, expect, it, vi } from "vitest";

let traVe: unknown = { ok: true, vai: "chu-tau" };
let soGet = 0;
vi.mock("@/lib/device-token-store", () => ({
  authedFetch: async (_url: string, init?: RequestInit) => {
    if ((init?.method ?? "GET") === "GET") {
      soGet += 1;
      return { res: { ok: true, status: 200, json: async () => traVe } };
    }
    return { res: { ok: true, status: 200, json: async () => ({ ok: true }) } };
  },
}));

import { _resetNhipHoi, docVaiMay, dongBoVai } from "@/lib/vai-store";
import { VAI_KEY } from "@/lib/vai";

const SDT = "0900000001";

beforeEach(() => {
  window.localStorage.clear();
  soGet = 0;
  traVe = { ok: true, vai: "chu-tau" };
  _resetNhipHoi();
});

describe("dongBoVai — hỏi vai máy chủ mỗi lần mở app", () => {
  it("máy đang giữ Đi bạn vừa ghi (chưa tới 12 giờ) vẫn hỏi và nhận Chủ tàu nhân viên vừa sửa", async () => {
    window.localStorage.setItem(VAI_KEY, JSON.stringify({ sdt: SDT, vai: "ngu-dan", cho: false, luc: Date.now() }));
    await dongBoVai(SDT);
    expect(soGet).toBe(1);
    expect(docVaiMay(SDT)?.vai).toBe("chu-tau");
  });

  it("nhiều component mount cùng lúc ⇒ chỉ MỘT request", async () => {
    await Promise.all([dongBoVai(SDT), dongBoVai(SDT), dongBoVai(SDT)]);
    await dongBoVai(SDT); // mount trễ trong cùng lần mở app
    expect(soGet).toBe(1);
  });

  it("mở app lần sau (bộ nhớ mới) hỏi lại", async () => {
    await dongBoVai(SDT);
    _resetNhipHoi();
    await dongBoVai(SDT);
    expect(soGet).toBe(2);
  });

  it("vai đang chờ gửi (chọn lúc mất sóng) thì gửi lên, không hỏi đè", async () => {
    window.localStorage.setItem(VAI_KEY, JSON.stringify({ sdt: SDT, vai: "ngu-dan", cho: true, luc: Date.now() }));
    await dongBoVai(SDT);
    expect(soGet).toBe(0);
    expect(docVaiMay(SDT)).toMatchObject({ vai: "ngu-dan", cho: false });
  });

  it("máy chủ trả giá trị lạ ⇒ giữ bản máy", async () => {
    traVe = { ok: true, vai: "thuyen-truong" };
    window.localStorage.setItem(VAI_KEY, JSON.stringify({ sdt: SDT, vai: "ngu-dan", cho: false, luc: 1 }));
    await dongBoVai(SDT);
    expect(docVaiMay(SDT)?.vai).toBe("ngu-dan");
  });
});

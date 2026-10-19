// Gemma CHỌN CÂU HỎI (vai 2, 2026-10-19): prompt khớp từng chữ với lúc train (tro-ly-v5r dung-chon.mjs mau, tron:false),
// đọc chữ số, trần giờ. Plugin Android giả bằng vi.mock.
import { afterEach, describe, expect, it, vi } from "vitest";

const plugin = vi.hoisted(() => ({ hoi: vi.fn(), android: true }));
vi.mock("@capacitor/core", () => ({
  Capacitor: { getPlatform: () => (plugin.android ? "android" : "web"), isPluginAvailable: () => plugin.android },
  registerPlugin: () => ({ hoi: plugin.hoi }),
}));

import { CHON_HAN_MS, chonCauHoi, docSoChon, nguoiChon, SYSTEM_CHON } from "@/lib/sen-bien/gemma";

const HOI = ["Câu một?", "Câu hai?", "Câu ba?", "Câu bốn?", "Câu năm?", "Câu sáu?", "Câu bảy?", "Câu tám?", "Câu chín?"];

describe("prompt chọn câu khớp lúc train", () => {
  it("SYSTEM_CHON y chữ", () =>
    expect(SYSTEM_CHON).toBe(
      "Bộ chọn câu hỏi Sen Biển. Đọc câu ngư dân hỏi và 9 câu hỏi có sẵn, trả đúng một số: số của câu cùng ý, không câu nào cùng ý thì 0.",
    ));
  it("nguoiChon: 'cau: …' rồi '1. …' … '9. …', KHÔNG hạ chữ thường", () =>
    expect(nguoiChon("Tại Sao NHỚT đen", HOI)).toBe(
      "cau: Tại Sao NHỚT đen\n1. Câu một?\n2. Câu hai?\n3. Câu ba?\n4. Câu bốn?\n5. Câu năm?\n6. Câu sáu?\n7. Câu bảy?\n8. Câu tám?\n9. Câu chín?",
    ));
});

describe("docSoChon", () => {
  it.each([
    ["3", 3],
    [" 0\n", 0],
    ["9 vì…", 9],
    ['{"y":"hoi_mo","s":{}}', null], // mô hình hiện tại (chưa học vai chọn) trả JSON
    ["", null],
    ["ba", null],
  ])("%j ⇒ %s", (t, k) => expect(docSoChon(t, 9)).toBe(k));
  it("số lớn hơn số ứng viên ⇒ null", () => expect(docSoChon("7", 5)).toBeNull());
});

describe("chonCauHoi — plugin giả", () => {
  afterEach(() => {
    plugin.hoi.mockReset();
    plugin.android = true;
    vi.useRealTimers();
  });
  it("gửi đúng {he, nguoi}, đọc chữ số", async () => {
    plugin.hoi.mockResolvedValue({ txt: "4", ms: 300 });
    expect(await chonCauHoi("tại sao nhớt đen", HOI)).toBe(4);
    expect(plugin.hoi).toHaveBeenCalledWith({ he: SYSTEM_CHON, nguoi: nguoiChon("tại sao nhớt đen", HOI) });
  });
  it("plugin ném ⇒ null", async () => {
    plugin.hoi.mockRejectedValue(new Error("chưa nạp"));
    expect(await chonCauHoi("x", HOI)).toBeNull();
  });
  it(`quá ${CHON_HAN_MS} ms ⇒ null, không treo`, async () => {
    vi.useFakeTimers();
    plugin.hoi.mockReturnValue(new Promise(() => {}));
    const p = chonCauHoi("x", HOI);
    await vi.advanceTimersByTimeAsync(CHON_HAN_MS + 1);
    expect(await p).toBeNull();
  });
  it("web / iOS (không plugin) ⇒ null, không gọi", async () => {
    plugin.android = false;
    expect(await chonCauHoi("x", HOI)).toBeNull();
    expect(plugin.hoi).not.toHaveBeenCalled();
  });
});

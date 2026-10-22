import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import type { DeviceSnapshot } from "@/lib/assistant/types";
import { SPECIES_META } from "@/lib/fish-predict";
import { senBienReply } from "@/lib/sen-bien/hieu-y";
import { loadNgram } from "@/lib/sen-bien/ngram";
import { traLoiApp, veBanDo } from "@/lib/sen-bien/tra-loi-app";

const NOW = Date.UTC(2026, 9, 18, 3);
const buf = readFileSync("public/data/sen-bien-ngram.v4.bin");
const model = loadNgram(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer)!;
const LOAI = Object.keys(SPECIES_META);
const snap = (over: Partial<DeviceSnapshot> = {}): DeviceSnapshot => ({
  takenAt: NOW, route: "/", online: false, premium: false,
  home: { portId: "quy-nhon", portName: "Quy Nhơn", province: "Gia Lai" },
  weather: null, storm: null, tide: null, boat: null, docs: [], maintenance: [], crew: null,
  cart: { lines: 0, titles: [] }, orders: null, fishPrices: null, fuel: null, inboxUnread: 0, placeNames: [],
  ...over,
});
const CTX = { awaitingConfirm: false, boatNames: [], portNames: [], placeNames: [] };
const r = (c: string) => senBienReply(c, model, [], null, { awaitingGo: false, running: false, loaiCa: LOAI });
const app = (c: string, s = snap()) => traLoiApp(c, r(c), s, CTX, NOW);

describe("veBanDo — việc nào phải sang màn bản đồ", () => {
  it.each(["dẫn về cảng Sa Huỳnh", "gần đảo nào nhất", "xem bản đồ sóng chiều mai", "phóng to"])("%s ⇒ bản đồ", (c) =>
    expect(veBanDo(r(c))).toBe(true));
  it.each(["giấy tờ tàu còn hạn không", "bao giờ thay nhớt", "giá dầu hôm nay"])("%s ⇒ ở lại màn này", (c) =>
    expect(veBanDo(r(c))).toBe(false));
});

describe("traLoiApp — trả lời việc trong app từ dữ liệu trong máy", () => {
  // anh Long 2026-10-22: "gà có mấy chân" ⇒ "Tôi mở chợ tìm '' nhé." (n-gram đoán tim_mon, không tách được món)
  it.each(["gà có mấy chân", "con chó có mấy chân"])("'%s' ⇒ không mở chợ với ô tìm trống", (c) => {
    const a = app(c, snap({ online: true }));
    expect(a?.text ?? "").not.toMatch(/''/);
    expect(a?.action?.type).not.toBe("search");
  });
  it("tìm món có tên vẫn mở chợ đúng món", () => {
    const a = app("tìm lưới rê", snap({ online: true }));
    if (a?.intent === "tim_mon") expect(a.text).toMatch(/lưới/);
  });
  it("giấy tờ: máy có giấy sắp hết hạn ⇒ nói đúng loại", () => {
    const a = app("giấy tờ tàu còn hạn không", snap({ docs: [{ kind: "dang_kiem", label: "Đăng kiểm", level: "warn", daysLeft: 12, expiry: "2026-10-30" }] as never }));
    expect(a?.intent).toBe("giay_to");
    expect(a?.text).toMatch(/[Đđ]ăng kiểm/);
  });
  it("giá dầu: chưa có bản lưu ⇒ nói thật, không bịa số", () => {
    const a = app("giá dầu hôm nay");
    expect(a?.intent).toBe("gia_dau");
    expect(a?.text).not.toMatch(/\d{2}\.\d{3}/);
  });
  it("mở màn ⇒ hành động điều hướng", () => {
    const a = app("mở giấy tờ");
    expect(a?.action).toMatchObject({ type: "navigate" });
  });
  it("chợ vật tư đã gộp ⇒ trả bằng bộ trả lời chợ (không còn câu 'chưa mở')", () => {
    const a = app("mua hai thùng nhớt");
    expect(a?.text ?? "").not.toMatch(/Chợ vật tư chưa mở/);
    expect(a?.intent).toMatch(/them_gio|tim_mon/);
  });
  it("câu đã là trả lời thật (chặn ngoài phạm vi) ⇒ giữ nguyên", () => expect(app("tôi bị đau đầu uống thuốc gì")).toBeNull());
  it("việc bản đồ ⇒ null (để màn bản đồ lo)", () => expect(app("gần đảo nào nhất")).toBeNull());
});

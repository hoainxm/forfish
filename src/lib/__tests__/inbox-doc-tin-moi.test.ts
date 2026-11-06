import { describe, it, expect } from "vitest";
import { tinChuaDocDeDoc, type InboxMessage } from "@/lib/inbox";
import { answerOffline } from "@/lib/assistant/answer";
import type { DeviceSnapshot } from "@/lib/assistant/types";

/*  THÔNG BÁO MỘT CHỖ (2026-11-06, anh Long: cảnh báo giám sát hành trình "tính chung cho các loại thông báo", không làm ô
    đọc riêng trong thẻ Giám sát). Sen Biển đọc tin chưa đọc từ HỘP THƯ CHUNG — cùng luật gom/ẩn/chưa-đọc với màn Trang chủ. */

const NOW = Date.parse("2026-11-06T09:00:00Z"); // 16:00 VN
const tin = (id: string, gioTruoc: number, over: Partial<InboxMessage> = {}): InboxMessage => ({
  id,
  title: `Tin ${id}`,
  body: `Nội dung ${id}`,
  url: null,
  sentAt: new Date(NOW - gioTruoc * 3600_000).toISOString(),
  mine: true,
  ...over,
});

describe("tinChuaDocDeDoc", () => {
  it("bỏ tin đã thấy / đã ẩn / quá 7 ngày, mới nhất trước, ≤3", () => {
    const ds = [tin("a", 1), tin("b", 2), tin("c", 3), tin("d", 4), tin("e", 5), tin("cu", 24 * 8)];
    const r = tinChuaDocDeDoc(ds, new Set(["b"]), new Set(["c"]), NOW);
    expect(r.map((m) => m.id)).toEqual(["a", "d", "e"]);
  });
  it("tin trùng gom một dòng; dòng nào còn một id chưa đọc thì vẫn đọc", () => {
    const same = { title: "Cảnh báo tàu BV-12345-TS", body: "BV-12345-TS: SOS 15:47" };
    const r = tinChuaDocDeDoc([tin("x1", 1, same), tin("x2", 3, same)], new Set(["x1"]), new Set(), NOW);
    expect(r.map((m) => m.id)).toEqual(["x1"]);
  });
  it("không có gì chưa đọc ⇒ rỗng", () => {
    expect(tinChuaDocDeDoc([tin("a", 1)], new Set(["a"]), new Set(), NOW)).toEqual([]);
  });
});

describe("Sen Biển đọc hộp thư — gồm tin giám sát hành trình", () => {
  const snap = (over: Partial<DeviceSnapshot>): DeviceSnapshot => ({
    takenAt: NOW, route: "/", online: true, premium: false, home: null, weather: null, storm: null, tide: null, boat: null,
    docs: [], maintenance: [], crew: null, cart: { lines: 0, titles: [] }, orders: null, fishPrices: null, fuel: null,
    inboxUnread: 0, placeNames: [], ...over,
  });
  const p = (intent: "hop_thu" | "chua_doc") => ({ intent, confidence: 1, slots: {}, normalized: "x" });

  it("đọc tiêu đề + nội dung từng tin, mã tàu đánh vần, SOS/giờ thành chữ nói", () => {
    const r = answerOffline(p("hop_thu"), snap({
      inboxUnread: 2,
      inboxTinMoi: [
        { title: "Cảnh báo tàu BV-12345-TS", body: "BV-12345-TS: SOS 15:47 · Mất GPS 16:02" },
        { title: "Đơn DH-UY3Y đã giao", body: "Shop đã giao hàng." },
      ],
    }), NOW);
    expect(r.text).toContain("• Cảnh báo tàu BV-12345-TS: BV-12345-TS: SOS 15:47 · Mất GPS 16:02");
    expect(r.text).toContain("• Đơn DH-UY3Y đã giao: Shop đã giao hàng");
    expect(r.speak).toMatch(/^2 tin chưa đọc\./);
    expect(r.speak).toContain("ét ô ét 15 giờ 47");
    expect(r.speak).toContain("giê pê ét 16 giờ 2");
    expect(r.speak).not.toContain("BV-12345-TS");
    expect(r.speak.match(/bê vê/g)).toHaveLength(1); // mã tàu không đọc hai lần (tiêu đề + đầu dòng)
    expect(r.speak).toContain("Shop đã giao hàng."); // tin thứ hai không bị cắt bởi luật ≤2 câu
    expect(r.action?.type).toBe("navigate");
  });
  it("tin có dấu chấm giữa vẫn là một câu — tin thứ ba không bị cắt", () => {
    const r = answerOffline(p("hop_thu"), snap({
      inboxUnread: 3,
      inboxTinMoi: [
        { title: "Nhắc cước giám sát hành trình", body: "GL-99280-TS: còn 14 ngày hết cước. Gia hạn trong app hoặc gọi SDVICO." },
        { title: "Tin hai", body: "Một. Hai." },
        { title: "Áp thấp nhiệt đới", body: "Gió cấp 7, giật cấp 9." },
      ],
    }), NOW);
    expect(r.speak).toContain("Gia hạn trong app");
    expect(r.speak).toContain("Áp thấp nhiệt đới: Gió cấp 7, giật cấp 9.");
  });
  it("chua_doc: có tin thì đọc luôn, không chỉ đếm", () => {
    const r = answerOffline(p("chua_doc"), snap({ inboxUnread: 1, inboxTinMoi: [{ title: "Tàu BV-12345-TS mất tín hiệu", body: "Cần có lại trước 19:40 hôm nay." }] }), NOW);
    expect(r.speak).toContain("Có 1 tin chưa đọc.");
    expect(r.speak).toContain("19 giờ 40");
  });
  it("không có nội dung (bản cũ) ⇒ vẫn chỉ đếm như trước", () => {
    expect(answerOffline(p("hop_thu"), snap({ inboxUnread: 2 }), NOW).text).toMatch(/2 tin chưa đọc, bác kéo xuống/);
  });
});

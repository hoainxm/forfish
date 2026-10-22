import { describe, it, expect } from "vitest";
import { gomTinTrung, type InboxMessage } from "@/lib/inbox";

const tin = (id: string, sentAt: string, over: Partial<InboxMessage> = {}): InboxMessage => ({
  id,
  title: "Siêu bão CHAMPI trên Biển Đông",
  body: "Gió mạnh nhất ~296 km/giờ (cấp 17). Đừng ra khơi vùng ảnh hưởng — nghe đài duyên hải.",
  url: null,
  sentAt,
  mine: false,
  ...over,
});

describe("gomTinTrung — một dòng một nội dung (rà Taste 2026-10-22)", () => {
  it("gom tin nhắc lại y hệt chữ thành MỘT nhóm, tin mới nhất đứng đầu", () => {
    const g = gomTinTrung([
      tin("a", "2026-10-21T06:47:00Z"),
      tin("b", "2026-10-22T11:30:00Z"),
      tin("c", "2026-10-21T22:06:00Z"),
    ]);
    expect(g).toHaveLength(1);
    expect(g[0].msg.id).toBe("b");
    expect(g[0].ids[0]).toBe("b");
    expect(new Set(g[0].ids)).toEqual(new Set(["a", "b", "c"]));
  });

  it("khác một chữ, khác đường dẫn ⇒ KHÔNG gom", () => {
    const g = gomTinTrung([
      tin("a", "2026-10-22T10:00:00Z"),
      tin("b", "2026-10-22T09:00:00Z", { body: "Gió mạnh nhất ~300 km/giờ (cấp 17)." }),
      tin("c", "2026-10-22T08:00:00Z", { url: "/ngu-truong" }),
    ]);
    expect(g.map((x) => x.ids)).toEqual([["a"], ["b"], ["c"]]);
  });

  it("thứ tự nhóm theo tin mới nhất của nhóm; giờ hỏng xếp cuối, không văng", () => {
    const g = gomTinTrung([
      tin("cu", "2026-10-01T00:00:00Z", { title: "Tin cũ" }),
      tin("hong", "không-phải-giờ", { title: "Giờ hỏng" }),
      tin("bao1", "2026-10-20T00:00:00Z"),
      tin("bao2", "2026-10-22T00:00:00Z"),
    ]);
    expect(g.map((x) => x.msg.id)).toEqual(["bao2", "cu", "hong"]);
  });

  it("danh sách rỗng ⇒ rỗng", () => {
    expect(gomTinTrung([])).toEqual([]);
  });
});

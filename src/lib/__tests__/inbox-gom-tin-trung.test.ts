import { describe, it, expect } from "vitest";
import { gomTinTrung, khoaBaoTuUrl, type InboxMessage } from "@/lib/inbox";

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

  /* TC-01 (2026-10-25): URL push bão mang lat/lon/t đổi theo từng bản tin, cấp bão
     cũng đổi ⇒ gom theo KHOÁ CƠN (`bao=`), không theo chữ. */
  const bao = (id: string, sentAt: string, key: string, over: Partial<InboxMessage> = {}, q = "") =>
    tin(id, sentAt, { url: `/ngu-truong?bao=${key}&cap=15&muc=2${q}`, ...over });

  it("cùng `bao=` nhưng khác lat/lon/t và khác cấp ⇒ GOM, dòng hiện bản tin mới nhất", () => {
    const g = gomTinTrung([
      bao("a", "2026-10-23T06:00:00Z", "gdacs-champi", { title: "Bão mạnh CHAMPI" }, "&lat=20.1&lon=125.0&t=1792700000"),
      bao("b", "2026-10-25T06:06:00Z", "gdacs-champi", { title: "Siêu bão CHAMPI" }, "&lat=22.7&lon=123.8&t=1792724434"),
      bao("c", "2026-10-24T12:00:00Z", "gdacs-champi", { title: "Siêu bão CHAMPI", body: "Gió ~300 km/giờ." }, "&lat=21.5&lon=124.4&t=1792712000"),
    ]);
    expect(g).toHaveLength(1);
    expect(g[0].msg.id).toBe("b");
    expect(g[0].msg.title).toBe("Siêu bão CHAMPI");
    expect(g[0].ids).toEqual(["b", "a", "c"]);
  });

  it("khác `bao=` ⇒ KHÔNG gom dù chữ y hệt", () => {
    const g = gomTinTrung([
      bao("a", "2026-10-22T10:00:00Z", "gdacs-champi"),
      bao("b", "2026-10-22T09:00:00Z", "gdacs-saudel"),
    ]);
    expect(g.map((x) => x.ids)).toEqual([["a"], ["b"]]);
  });

  it("tin không có `bao=` ⇒ khoá cũ (trùng từng chữ), không lẫn vào nhóm bão", () => {
    const g = gomTinTrung([
      bao("bao", "2026-10-22T10:00:00Z", "gdacs-champi"),
      tin("x", "2026-10-22T09:00:00Z", { url: "/ngu-truong" }),
      tin("y", "2026-10-22T08:00:00Z", { url: "/ngu-truong" }),
      tin("z", "2026-10-22T07:00:00Z", { url: "/ngu-truong?lat=1&lon=2" }),
    ]);
    expect(g.map((x) => x.ids)).toEqual([["bao"], ["x", "y"], ["z"]]);
  });

  it("khoaBaoTuUrl: đọc đúng tham số, thiếu/hỏng ⇒ null", () => {
    expect(khoaBaoTuUrl("/ngu-truong?bao=gdacs-champi&lat=1")).toBe("gdacs-champi");
    expect(khoaBaoTuUrl("/ngu-truong?cap=15&bao=")).toBeNull();
    expect(khoaBaoTuUrl("/ngu-truong")).toBeNull();
    expect(khoaBaoTuUrl(null)).toBeNull();
    expect(khoaBaoTuUrl("/kairos/bai/1?x=1")).toBeNull();
  });
});

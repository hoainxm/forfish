import { beforeEach, describe, expect, it, vi } from "vitest";
import { datCangNha, docCangNha, KAIROS_HABIT_KEY, cangTheoId } from "@/lib/cang-nha";
import { HABIT_KEY } from "@/lib/kairos/thoi-quen";

// Cùng pattern boats.test.ts — stub window.localStorage (không cần jsdom).
const map = new Map<string, string>();
let hong = false;
const store = {
  getItem: (k: string) => map.get(k) ?? null,
  setItem: (k: string, v: string) => {
    if (hong) throw new Error("QuotaExceededError");
    map.set(k, v);
  },
  removeItem: (k: string) => void map.delete(k),
  clear: () => map.clear(),
};
vi.stubGlobal("window", { localStorage: store });

const PLACES = "forfish.places.v1";
const HOME = "forfish.home.v1";

beforeEach(() => {
  map.clear();
  hong = false;
});

it("khoá thói quen Kairos viết lại khớp đúng HABIT_KEY", () => {
  expect(KAIROS_HABIT_KEY).toBe(HABIT_KEY);
});

describe("cangTheoId", () => {
  it("tra danh bạ cảng cá trước (lng → lon), rồi cảng dự báo", () => {
    expect(cangTheoId("sa-huynh")).toMatchObject({ id: "sa-huynh", name: "Sa Huỳnh", province: "Quảng Ngãi" });
    expect(cangTheoId("sa-ky")).toMatchObject({ id: "sa-ky", lat: 15.22, lon: 108.95 }); // chỉ có trong PORTS
    expect(cangTheoId("khong-co")).toBeNull();
    expect(cangTheoId(undefined)).toBeNull();
  });
});

describe("docCangNha — đọc lùi mọi kho cũ", () => {
  it("chưa khai ở đâu ⇒ null", () => {
    expect(docCangNha()).toBeNull();
  });

  it("BUG GỐC: Sen Biển chỉ ghi forfish.home.v1 ⇒ vẫn đọc ra cảng (thẻ Biển hôm nay hiện)", () => {
    map.set(HOME, JSON.stringify({ portId: "quy-nhon", province: "Bình Định" }));
    expect(docCangNha()).toMatchObject({ portId: "quy-nhon", name: "Quy Nhơn" });
  });

  it("ghim 'home' thắng các kho khác, kèm portId khi trùng toạ độ danh mục", () => {
    map.set(HOME, JSON.stringify({ portId: "quy-nhon" }));
    map.set(PLACES, JSON.stringify([{ id: "14.674,109.070", name: "Sa Huỳnh", lat: 14.673556, lon: 109.069755, kind: "home" }]));
    expect(docCangNha()).toMatchObject({ name: "Sa Huỳnh", portId: "sa-huynh" });
  });

  it("ghim tay không trùng cảng nào ⇒ vẫn trả toạ độ, không bịa portId", () => {
    map.set(PLACES, JSON.stringify([{ id: "1,1", name: "Bến nhà", lat: 12.5, lon: 109.5, kind: "home" }]));
    const c = docCangNha();
    expect(c).toMatchObject({ name: "Bến nhà", lat: 12.5, lon: 109.5 });
    expect(c?.portId).toBeUndefined();
  });

  it("hồ sơ tàu đang chọn (homePortId) khi chưa có ghim/Sen Biển", () => {
    map.set("forfish.boats.v1", JSON.stringify([{ id: "a", name: "A", homePortId: "sa-huynh" }]));
    expect(docCangNha()).toMatchObject({ portId: "sa-huynh" });
  });

  it("Kairos 'Cảng nhà' là kho cuối", () => {
    map.set(HABIT_KEY, JSON.stringify({ v: 1, chips: {}, topics: {}, home: { port: "sa-huynh", province: "quang-ngai" } }));
    expect(docCangNha()).toMatchObject({ portId: "sa-huynh" });
  });

  it("kho hỏng (JSON rác, null) không ném — lùi kho sau", () => {
    map.set(HOME, "null");
    map.set(HABIT_KEY, "{rác");
    expect(docCangNha()).toBeNull();
    map.set(PLACES, "{rác");
    map.set("forfish.boats.v1", JSON.stringify([{ id: "a", name: "A", homePortId: "sa-huynh" }]));
    expect(docCangNha()).toMatchObject({ portId: "sa-huynh" });
  });
});

describe("datCangNha — một cửa ghi", () => {
  it("ghi CẢ ghim 'home' và forfish.home.v1 ⇒ đọc lại ra đúng cảng", () => {
    expect(datCangNha("sa-huynh")).toBe(true);
    expect(JSON.parse(map.get(HOME)!)).toMatchObject({ portId: "sa-huynh", province: "Quảng Ngãi" });
    const places = JSON.parse(map.get(PLACES)!) as { kind: string; name: string }[];
    expect(places.filter((p) => p.kind === "home").map((p) => p.name)).toEqual(["Sa Huỳnh"]);
    expect(docCangNha()).toMatchObject({ portId: "sa-huynh" });
  });

  it("đổi cảng: hạ cảng nhà cũ thành điểm thường, không mất điểm ghim khác", () => {
    map.set(PLACES, JSON.stringify([{ id: "9.000,105.000", name: "Bãi quen", lat: 9, lon: 105, kind: "spot" }]));
    datCangNha("sa-huynh");
    datCangNha("quy-nhon");
    const places = JSON.parse(map.get(PLACES)!) as { kind: string; name: string }[];
    expect(places.filter((p) => p.kind === "home").map((p) => p.name)).toEqual(["Quy Nhơn"]);
    expect(places.map((p) => p.name).sort()).toEqual(["Bãi quen", "Quy Nhơn", "Sa Huỳnh"]);
    expect(docCangNha()).toMatchObject({ portId: "quy-nhon" });
  });

  it("giữ tỉnh/khóa khác trong forfish.home.v1 không liên quan", () => {
    map.set(HOME, JSON.stringify({ province: "Bình Định", portId: "x" }));
    datCangNha("sa-huynh");
    expect(JSON.parse(map.get(HOME)!)).toEqual({ province: "Quảng Ngãi", portId: "sa-huynh" });
  });

  it("id lạ ⇒ false, không ghi gì", () => {
    expect(datCangNha("khong-co")).toBe(false);
    expect(map.size).toBe(0);
  });

  it("máy hết chỗ ⇒ false (chỗ gọi phải nói ra)", () => {
    hong = true;
    expect(datCangNha("sa-huynh")).toBe(false);
  });
});

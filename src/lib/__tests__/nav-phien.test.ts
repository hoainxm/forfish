// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  docPhien,
  gioPhut,
  luuPhien,
  napPhien,
  taoPhien,
  xoaPhien,
  NAV_PHIEN_HAN_MS,
  NAV_PHIEN_KEY,
} from "@/lib/nav-phien";

const route = {
  plan: { waypoints: [{ lat: 10, lon: 107 }, { lat: 10.2, lon: 107.3 }] },
  stops: [{ lat: 10.2, lon: 107.3 }],
  stopWpIdx: [1],
  legBoundsKm: [38],
  startLabel: "Cảng nhà",
};
const T = Date.UTC(2026, 10, 2, 3);

beforeEach(() => localStorage.clear());

describe("docPhien — bản ghi hỏng hay quá hạn thì không hỏi", () => {
  it("bản đúng ⇒ đọc được, giữ thêm trường của tuyến", () => {
    const p = docPhien<typeof route>(taoPhien(route, " Hòn Mê ", T), T + 60_000);
    expect(p?.tenDich).toBe("Hòn Mê");
    expect(p?.route.startLabel).toBe("Cảng nhà");
  });
  it("quá hạn ⇒ null", () => {
    expect(docPhien(taoPhien(route, null, T), T + NAV_PHIEN_HAN_MS + 1)).toBeNull();
  });
  it("mốc ghi ở tương lai xa (đồng hồ máy nhảy) ⇒ null", () => {
    expect(docPhien(taoPhien(route, null, T + 3600_000), T)).toBeNull();
  });
  it("thiếu điểm, toạ độ hỏng, sai phiên bản ⇒ null", () => {
    expect(docPhien({ ...taoPhien(route, null, T), v: 2 }, T)).toBeNull();
    expect(docPhien(taoPhien({ ...route, plan: { waypoints: [{ lat: 10, lon: 107 }] } }, null, T), T)).toBeNull();
    expect(docPhien(taoPhien({ ...route, stops: [{ lat: 99, lon: 0 }] }, null, T), T)).toBeNull();
    expect(docPhien(null, T)).toBeNull();
    expect(docPhien("rác", T)).toBeNull();
  });
  it("tên rỗng ⇒ null", () => {
    expect(docPhien(taoPhien(route, "  ", T), T)?.tenDich).toBeNull();
  });
});

describe("kho máy", () => {
  it("lưu → nạp → xoá", () => {
    expect(luuPhien(taoPhien(route, "Hòn Mê", Date.now()))).toBe(true);
    expect(napPhien()?.tenDich).toBe("Hòn Mê");
    xoaPhien();
    expect(napPhien()).toBeNull();
  });
  it("chuỗi JSON hỏng trong kho ⇒ null, không ném", () => {
    localStorage.setItem(NAV_PHIEN_KEY, "{hỏng");
    expect(napPhien()).toBeNull();
  });
});

it("gioPhut", () => {
  expect(gioPhut(new Date(2026, 0, 1, 7, 5).getTime())).toBe("7:05");
});

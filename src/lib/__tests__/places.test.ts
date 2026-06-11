import { describe, expect, it } from "vitest";
import {
  homeOf,
  makeHome,
  placeAt,
  placeId,
  removePlace,
  renamePlace,
  sortedPlaces,
  upsertPlace,
  type SavedPlace,
} from "../places";

describe("placeId", () => {
  it("ổn định theo toạ độ làm tròn 3 số → cùng chỗ không trùng id", () => {
    expect(placeId(13.0001, 110.5004)).toBe("13.000,110.500");
    expect(placeId(13.0001, 110.5004)).toBe(placeId(13, 110.5));
  });
});

describe("upsertPlace", () => {
  it("ghim điểm thường, không trùng khi ghim lại cùng chỗ", () => {
    let list: SavedPlace[] = [];
    list = upsertPlace(list, { name: "Rạn ông Tư", lat: 13, lon: 110.5 });
    expect(list).toHaveLength(1);
    expect(list[0].kind).toBe("spot");
    list = upsertPlace(list, { name: "Rạn ông Tư (đổi)", lat: 13.0004, lon: 110.4996 });
    expect(list).toHaveLength(1); // cùng id → ghi đè
    expect(list[0].name).toBe("Rạn ông Tư (đổi)");
  });

  it("đặt cảng nhà → chỉ MỘT cảng nhà, cái cũ bị hạ cấp", () => {
    let list: SavedPlace[] = [];
    list = upsertPlace(list, { name: "Cảng A", lat: 10, lon: 107, asHome: true });
    list = upsertPlace(list, { name: "Cảng B", lat: 16, lon: 108, asHome: true });
    expect(list.filter((p) => p.kind === "home")).toHaveLength(1);
    expect(homeOf(list)?.name).toBe("Cảng B");
  });

  it("tên trống → đặt tên mặc định, không để rỗng", () => {
    const list = upsertPlace([], { name: "   ", lat: 9, lon: 105 });
    expect(list[0].name.length).toBeGreaterThan(0);
  });
});

describe("placeAt / homeOf", () => {
  const list = upsertPlace(
    upsertPlace([], { name: "Nhà", lat: 10.34, lon: 107.09, asHome: true }),
    { name: "Bãi mực", lat: 13, lon: 110.5 },
  );
  it("tìm đúng điểm theo toạ độ (kể cả lệch <100 m)", () => {
    expect(placeAt(list, 13.0003, 110.4998)?.name).toBe("Bãi mực");
    expect(placeAt(list, 20, 108)).toBeNull();
  });
  it("homeOf trả đúng cảng nhà", () => {
    expect(homeOf(list)?.name).toBe("Nhà");
  });
});

describe("makeHome / rename / remove", () => {
  let list = upsertPlace(
    upsertPlace([], { name: "Nhà cũ", lat: 10, lon: 107, asHome: true }),
    { name: "Bãi xa", lat: 13, lon: 110.5 },
  );
  it("makeHome chuyển cảng nhà, hạ cấp cái cũ", () => {
    const bai = placeAt(list, 13, 110.5)!;
    list = makeHome(list, bai.id);
    expect(homeOf(list)?.name).toBe("Bãi xa");
    expect(list.filter((p) => p.kind === "home")).toHaveLength(1);
  });
  it("rename + remove", () => {
    const bai = placeAt(list, 13, 110.5)!;
    list = renamePlace(list, bai.id, "Bãi gần");
    expect(placeAt(list, 13, 110.5)?.name).toBe("Bãi gần");
    list = removePlace(list, bai.id);
    expect(placeAt(list, 13, 110.5)).toBeNull();
  });
});

describe("sortedPlaces", () => {
  it("cảng nhà đứng đầu, còn lại theo tên", () => {
    let list: SavedPlace[] = [];
    list = upsertPlace(list, { name: "Zebra", lat: 12, lon: 110 });
    list = upsertPlace(list, { name: "Alpha", lat: 13, lon: 111 });
    list = upsertPlace(list, { name: "Nhà", lat: 10, lon: 107, asHome: true });
    const s = sortedPlaces(list);
    expect(s[0].kind).toBe("home");
    expect(s[1].name).toBe("Alpha");
    expect(s[2].name).toBe("Zebra");
  });
});

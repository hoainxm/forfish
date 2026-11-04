// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { SPECIES_META } from "@/lib/fish-predict";
import {
  LOAI_THEO_NGHE,
  MAX_FISH_PICKS,
  diemTheoBo,
  goiYTheoNghe,
  loadFishPicks,
  loaiNoiTheoBo,
  ngheCuaBo,
  saveFishPicks,
  togglePick,
} from "@/lib/fish-picks";

const ALL = Object.keys(SPECIES_META);

describe("fish-picks", () => {
  beforeEach(() => localStorage.clear());

  it("mọi loài theo nghề đều có trong SPECIES_META (đổi tên loài là đỏ ở đây)", () => {
    for (const ds of Object.values(LOAI_THEO_NGHE)) for (const s of ds) expect(ALL).toContain(s);
  });

  it("gợi ý theo nghề: tối đa 3, loài đang vụ lên trước, bỏ loài bản đồ không có", () => {
    const g = goiYTheoNghe("luoi-vay", ALL, new Set(["cá sòng"]));
    expect(g).toHaveLength(MAX_FISH_PICKS);
    expect(g[0]).toBe("cá sòng");
    expect(goiYTheoNghe("chup-muc", ["mực ống"], new Set())).toEqual(["mực ống"]);
  });

  it("ngheCuaBo nhận lại đúng nghề, bộ tự chọn ⇒ null", () => {
    const vu = new Set<string>();
    expect(ngheCuaBo(goiYTheoNghe("cau-ngu", ALL, vu), ALL, vu)).toBe("cau-ngu");
    expect(ngheCuaBo(["cá hồng"], ALL, vu)).toBeNull();
    expect(ngheCuaBo([], ALL, vu)).toBeNull();
  });

  it("togglePick giữ trần 3", () => {
    let p = togglePick([], "a");
    p = togglePick(p, "b");
    p = togglePick(p, "c");
    expect(togglePick(p, "d")).toEqual(["a", "b", "c"]);
    expect(togglePick(p, "b")).toEqual(["a", "c"]);
  });

  it("điểm ô = cao nhất trong bộ; bộ rỗng = điểm chung", () => {
    const c = { s: 90, top: ["x"], sp: { a: 40, b: 70 } };
    expect(diemTheoBo(c, ["a", "b"])).toBe(70);
    expect(diemTheoBo(c, ["z"])).toBe(0);
    expect(diemTheoBo(c, [])).toBe(90);
    expect(loaiNoiTheoBo(c, ["a", "b", "z"])).toEqual(["b", "a"]);
    expect(loaiNoiTheoBo(c, [])).toEqual(["x"]);
  });

  it("lưu/đọc kho; chưa lưu hoặc hỏng ⇒ null", () => {
    expect(loadFishPicks()).toBeNull();
    expect(saveFishPicks(["a", "b", "c", "d"])).toBe(true);
    expect(loadFishPicks()).toEqual(["a", "b", "c"]);
    localStorage.setItem("forfish.fishPicks.v1", "{hỏng");
    expect(loadFishPicks()).toBeNull();
    localStorage.setItem("forfish.fishPicks.v1", "[]");
    expect(loadFishPicks()).toBeNull();
  });
});

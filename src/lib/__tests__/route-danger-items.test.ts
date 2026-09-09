/*  BẢNG CẢNH BÁO CỦA THẺ TUYẾN (Đợt 2, 2026-09-04).

    Vì sao phải test một hàm "chỉ ghép chữ": THỨ TỰ và MỨC (đỏ/vàng) ở đây
    quyết định bà con đọc được gì trong ba giây đầu, và dải ghim đáy chỉ in ĐÚNG
    MỘT nhãn — nhãn của ý đỏ đầu tiên. Đảo một dòng là đổi thứ được đọc. Trước
    Đợt 2 bảng này nằm trong một `useMemo` giữa 2.400 dòng JSX và chưa từng có
    một dòng test nào.
*/
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  MAX_HIT_LINES,
  MAX_WILL_MEET,
  KHO_HAU_KIEM,
  buildDangerItems,
  buildWillMeet,
  moTaThieu,
} from "@/lib/route-danger-items";
import { buildHazardList } from "@/lib/hazards";
import type { RouteHit } from "@/lib/route-hazards";
import type { RoutePlan } from "@/lib/route-plan";

function plan(over: Partial<RoutePlan> = {}): RoutePlan {
  return {
    waypoints: [
      { lat: 10, lon: 107 },
      { lat: 9, lon: 107 },
    ],
    distKm: 111,
    hours: 8,
    fuelL: 160,
    maxWaveM: 1.2,
    maxWindKmh: 20,
    hasRoughLeg: false,
    hasShallowLeg: false,
    hasVeryShallowLeg: false,
    hasDraftShallowLeg: false,
    nearPortOnly: false,
    hoursAt: [0, 8],
    hazardChecked: true,
    hasHazardLeg: false,
    hasHazardNearPortLeg: false,
    hasNearLandLeg: false,
    hasFollowingSeaRisk: false,
    depthChecked: true,
    cappedToDirect: false,
    direct: null,
    fuelDeltaL: null,
    beyondForecastH: 0,
    bestEffortSeas: false,
    segRisks: [],
    ...over,
  };
}

let dem = 0;
function hit(over: Partial<RouteHit> & Pick<RouteHit, "loai" | "muc">): RouteHit {
  return {
    id: `h${dem++}`,
    ten: null,
    km: 0.4,
    alongKm: 12,
    cau: "Câu mẫu.",
    etaH: 2,
    ...over,
  };
}

const keys = (p: RoutePlan, hits: RouteHit[] | null = null) =>
  buildDangerItems(p, hits).map((i) => i.key);

describe("thứ tự cố định", () => {
  it("đỏ trước vàng, đúng bảng đã chốt", () => {
    const items = buildDangerItems(
      plan({
        hasRoughLeg: true,
        hasVeryShallowLeg: true,
        hasNearLandLeg: true,
        hasShallowLeg: true,
        hasDraftShallowLeg: true,
        hasHazardNearPortLeg: true,
      }),
      [
        hit({ loai: "ranh-gioi", muc: "do" }),
        hit({ loai: "xac-tau", muc: "do" }),
        hit({ loai: "gian-khoan", muc: "do" }),
        hit({ loai: "cam-vao", muc: "do" }),
        hit({ loai: "do-sau", muc: "do" }),
        hit({ loai: "cap-ong", muc: "vang" }),
        hit({ loai: "vung-han-che", muc: "vang" }),
        hit({ loai: "con-nuoc", muc: "vang", cau: "Lúc xuất phát: đang là lúc nước ròng." }),
      ],
    );
    expect(items.map((i) => i.key)).toEqual([
      "song-du",
      "ranh-gioi",
      "vat-chan",
      "gian-khoan",
      "vung-cam",
      "rat-can",
      "de-bo",
      "thieu-nuoc",
      "nuoc-nong",
      "can-mon",
      "cap-ong",
      "cam-neo",
      "con-nuoc",
      "sat-cang",
    ]);
    expect(items.find((i) => i.key === "con-nuoc")).toMatchObject({ label: "Con nước", danger: false });
  });

  it("con nước mức 'tin' KHÔNG lên khối cảnh báo — nằm ở 'sẽ gặp' để đối chiếu", () => {
    const h = hit({ loai: "con-nuoc", muc: "tin", alongKm: 0, cau: "Lúc xuất phát, con nước ở Vũng Tàu: 3,3 m, nước đang lên." });
    expect(buildDangerItems(plan(), [h])).toEqual([]);
    expect(buildWillMeet([h])).toEqual([h.cau]);
  });

  /*  BẤT BIẾN CỦA DẢI GHIM ĐÁY: nó chỉ in MỘT nhãn — nhãn của ý đỏ đầu tiên
      (`find(danger)`). Muốn nhãn đó luôn là mối nguy nặng nhất thì MỌI ý đỏ
      phải đứng trước MỌI ý vàng. Bảng cũ không giữ được điều này (sóng dồn đuôi
      vàng đứng trước bãi rất cạn đỏ) nên mới phải dùng `find`; bảng mới giữ
      được, và test này là thứ canh cho nó khỏi trôi lại. */
  it("mọi ý ĐỎ đứng trước mọi ý vàng", () => {
    const items = buildDangerItems(
      plan({
        hasFollowingSeaRisk: true,
        hasVeryShallowLeg: true,
        hasShallowLeg: true,
        hasRoughLeg: true,
      }),
      [hit({ loai: "do-sau", muc: "do" })],
    );
    const cuoiDo = items.map((i) => i.danger).lastIndexOf(true);
    const dauVang = items.findIndex((i) => !i.danger);
    expect(cuoiDo).toBeGreaterThanOrEqual(0);
    expect(dauVang).toBeGreaterThan(cuoiDo);
    expect(items.find((i) => i.danger)?.key).toBe("song-du");
  });

  it("tuyến sạch → không ý nào (khối cảnh báo biến mất hẳn)", () => {
    expect(buildDangerItems(plan(), [])).toEqual([]);
    expect(buildDangerItems(null, [])).toEqual([]);
  });
});

describe("luật SÁT CẢNG — gộp hai mục đỏ thành một dòng vàng", () => {
  const p = plan({
    hasVeryShallowLeg: true,
    hasNearLandLeg: true,
    nearPortOnly: true,
  });

  it("cạn/bờ chỉ ở hai đầu → bỏ 'Bãi rất cạn' + 'Đè lên bờ', thêm dòng vàng", () => {
    const items = buildDangerItems(p, null);
    expect(items.map((i) => i.key)).toEqual(["sat-cang"]);
    expect(items[0].danger).toBe(false);
    expect(items[0].label).toBe("Sát cảng");
  });

  it("cùng cờ đó mà cạn GIỮA ĐƯỜNG (nearPortOnly false) → hai mục đỏ trở lại", () => {
    const items = buildDangerItems(plan({ ...p, nearPortOnly: false }), null);
    expect(items.map((i) => i.key)).toEqual(["rat-can", "de-bo"]);
    expect(items.every((i) => i.danger)).toBe(true);
  });

  it("vật chặn sát bến cũng nói ở đúng dòng đó, không im", () => {
    const items = buildDangerItems(plan({ hasHazardNearPortLeg: true }), null);
    expect(items.map((i) => i.key)).toEqual(["sat-cang"]);
    expect(items[0].text).toMatch(/lồng bè|đăng đáy|xác tàu/);
  });
});

describe("cờ hasHazardLeg — tuyến lọt lưới thì phải kêu, kể cả không có hit", () => {
  it("không hit nào mà cờ bật → vẫn một dòng ĐỎ", () => {
    const items = buildDangerItems(plan({ hasHazardLeg: true }), []);
    expect(items.map((i) => i.key)).toEqual(["vat-chan"]);
    expect(items[0].danger).toBe(true);
    expect(items[0].text).toMatch(/KHÔNG né được/);
  });
});

describe("gộp nhiều vật một hàng", () => {
  it(`quá ${MAX_HIT_LINES} vật thì nói "…và N chỗ nữa", giữ vật NẶNG và GẶP SỚM`, () => {
    const hits = [
      hit({ loai: "xac-tau", muc: "vang", alongKm: 5, cau: "V5." }),
      hit({ loai: "xac-tau", muc: "vang", alongKm: 9, cau: "V9." }),
      hit({ loai: "xac-tau", muc: "vang", alongKm: 20, cau: "V20." }),
      hit({ loai: "xac-tau", muc: "vang", alongKm: 30, cau: "V30." }),
      hit({ loai: "xac-tau", muc: "do", alongKm: 60, cau: "ĐỎ60." }),
    ];
    const [item] = buildDangerItems(plan(), hits);
    expect(item.danger).toBe(true);
    expect(item.text).toContain("ĐỎ60.");
    expect(item.text).toContain("V5.");
    expect(item.text).not.toContain("V30.");
    expect(item.text).toContain("…và 2 chỗ nữa cùng loại.");
  });

  it("gắn km dọc tuyến vào đầu câu, dưới 1 km thì thôi", () => {
    const [a] = buildDangerItems(plan(), [
      hit({ loai: "xac-tau", muc: "do", alongKm: 12.4, cau: "Xác tàu X." }),
    ]);
    expect(a.text).toBe("Km 12: Xác tàu X.");
    const [b] = buildDangerItems(plan(), [
      hit({ loai: "xac-tau", muc: "do", alongKm: 0.2, cau: "Xác tàu X." }),
    ]);
    expect(b.text).toBe("Xác tàu X.");
  });

  it("loai lạ KHÔNG bị nuốt — rơi vào hàng 'Lưu ý khác'", () => {
    expect(keys(plan(), [hit({ loai: "kho-moi-nao-do", muc: "vang" })])).toEqual([
      "khac",
    ]);
  });

  it("loai lạ mức ĐỎ vẫn được kéo lên trước mọi ý vàng", () => {
    const items = buildDangerItems(plan({ hasShallowLeg: true }), [
      hit({ loai: "kho-moi-nao-do", muc: "do" }),
    ]);
    expect(items.map((i) => i.key)).toEqual(["khac", "nuoc-nong"]);
    expect(items[0].danger).toBe(true);
  });

  it("hit mức 'tin' KHÔNG lên khối cảnh báo", () => {
    expect(keys(plan(), [hit({ loai: "phao", muc: "tin" })])).toEqual([]);
    expect(keys(plan(), [hit({ loai: "xac-tau", muc: "tin" })])).toEqual([]);
  });
});

describe("khối 'Trên đường sẽ gặp'", () => {
  it("chỉ mức tin, xếp theo thứ tự gặp", () => {
    const out = buildWillMeet([
      hit({ loai: "phao", muc: "tin", alongKm: 30, cau: "Phao B." }),
      hit({ loai: "xac-tau", muc: "do", alongKm: 1, cau: "Không phải tin." }),
      hit({ loai: "phao", muc: "tin", alongKm: 10, cau: "Phao A." }),
    ]);
    expect(out).toEqual(["Km 10: Phao A.", "Km 30: Phao B."]);
  });

  it(`trần ${MAX_WILL_MEET} dòng, dòng cuối gộp phần còn lại`, () => {
    const nhieu = Array.from({ length: 20 }, (_, i) =>
      hit({ loai: "phao", muc: "tin", alongKm: i + 1, cau: `P${i}.` }),
    );
    const out = buildWillMeet(nhieu);
    expect(out).toHaveLength(MAX_WILL_MEET);
    expect(out[out.length - 1]).toBe("…và 13 chỗ nữa dọc tuyến.");
  });

  it("không có gì thì rỗng (khối không hiện)", () => {
    expect(buildWillMeet(null)).toEqual([]);
    expect(buildWillMeet([])).toEqual([]);
  });
});

describe("kho chưa soi được", () => {
  it("gọi TÊN kho bằng tiếng Việt, gộp một câu, khử trùng", () => {
    const s = moTaThieu(["xac-tau", "thuy-trieu", "xac-tau", "tuyen"]);
    expect(s).toContain("xác tàu");
    expect(s).toContain("con nước");
    expect(s!.match(/xác tàu/g)).toHaveLength(1);
  });

  it("mã lạ vẫn được nói ra, KHÔNG im", () => {
    expect(moTaThieu(["kho-la"])).toContain("kho-la");
  });

  it("không thiếu gì → null (không thêm dòng nào)", () => {
    expect(moTaThieu([])).toBeNull();
    expect(moTaThieu(null)).toBeNull();
    expect(moTaThieu(["tuyen"])).toBeNull();
  });

  /*  HẬU KIỂM NÉM (review đợt 4, N1). Thẻ tuyến từng đặt `audit = null` trong
      nhánh `catch`, mà `null` đi vào ĐÚNG hai hàm này y hệt "đã soi và sạch".
      Ca test ghim đúng khoảng cách giữa hai trạng thái đó. */
  it("hậu kiểm chết ⇒ có dòng 'chưa soi', KHÁC HẲN audit = null (im)", () => {
    const imLang = moTaThieu(null);
    const noiThat = moTaThieu([KHO_HAU_KIEM]);
    expect(imLang).toBeNull();
    expect(noiThat).not.toBeNull();
    // phải là chữ bà con đọc được, không phải mã máy lọt ra màn hình
    expect(noiThat).toContain("hậu kiểm");
    expect(noiThat).not.toContain(KHO_HAU_KIEM);
  });

  it("hits rỗng KHÔNG phải là 'sạch': mục hiểm hoạ im nhưng dòng thiếu vẫn nói", () => {
    // đúng cặp giá trị nhánh `catch` đặt: hits [] + missing có mã hậu kiểm
    expect(buildDangerItems(plan(), [])).toEqual(buildDangerItems(plan(), null));
    expect(moTaThieu([KHO_HAU_KIEM, "xac-tau"])).toContain("xác tàu");
  });
});

/*  CANH CHÍNH NHÁNH `catch` CỦA THẺ TUYẾN. Hai hàm trên chỉ chứng minh `null`
    và `{hits:[],missing:[…]}` cho ra hai màn hình khác nhau; còn việc component
    chọn cái nào thì chỉ đọc nguồn mới thấy — `route-planner.tsx` là component
    2.500 dòng, không dựng được trong test thuần. `setAudit(null)` vẫn HỢP LỆ ở
    chỗ khác (xoá tuyến, đổi chuỗi điểm, bắt đầu lượt tính mới): chỉ cấm đúng
    trong nhánh `catch` của hậu kiểm. */
describe("thẻ tuyến không được im khi hậu kiểm chết", () => {
  const src = readFileSync(
    join(process.cwd(), "src", "components", "route-planner.tsx"),
    "utf8",
  );
  /** Đoạn nguồn từ lượt gọi `auditRoute` tới hết `try/catch` của nó. */
  const khoiHauKiem = (() => {
    const i = src.indexOf("auditRoute({");
    expect(i, "không tìm thấy lượt gọi auditRoute — đổi tên rồi?").toBeGreaterThan(0);
    const j = src.indexOf("const r: PlannedRoute", i);
    expect(j, "không tìm thấy mốc cuối khối hậu kiểm").toBeGreaterThan(i);
    return src.slice(i, j);
  })();

  it("nhánh catch KHÔNG đặt audit về null (null = im như đã soi sạch)", () => {
    // chú thích trong mã có nhắc chuỗi này, nên chỉ soi dòng CHẠY được
    const dongChay = khoiHauKiem
      .split(/\r?\n/)
      .filter((d) => !d.trimStart().startsWith("*") && !d.trimStart().startsWith("/*"));
    expect(dongChay.join("\n")).not.toContain("setAudit(null)");
  });

  it("nhánh catch để lại mã kho hậu kiểm trong missing", () => {
    expect(khoiHauKiem).toContain("KHO_HAU_KIEM");
  });

  /*  NÚT "TÍNH ĐƯỜNG" KHÔNG ĐƯỢC ĐỨNG CHỜ KHO (review đợt 4, N4). Chín kho hải
      đồ tải song song, nhưng `Promise.all` chờ cái chậm nhất và lượt `await`
      nằm TRƯỚC vòng nở khung ⇒ một kho chưa vào kho SW làm nút đứng tới 20 s
      trước khi thanh "Đang tính…" chạy. */
  it("lượt chờ kho có trần ngắn, không phải await trần trụi", () => {
    const i = src.indexOf("const khoPromise");
    const j = src.indexOf("const needM", i);
    const khoi = src.slice(i, j);
    expect(khoi).toContain("Promise.race");
    expect(khoi).not.toMatch(/await khoPromise\s*;/);
    const tran = khoi.match(/KHO_CHO_MS = (\d+)/);
    expect(tran, "không thấy trần chờ kho").not.toBeNull();
    expect(Number(tran![1])).toBeLessThanOrEqual(5000);
  });
});

/*  Hết giờ chờ kho thì lượt tính vẫn chạy — nhưng phải NÓI RA kho nào chưa soi.
    Ca dưới đi đúng đường mã chạy lúc hết giờ: mọi kho `null`. */
describe("hết giờ chờ kho — tính tiếp nhưng gọi tên kho vắng", () => {
  it("không kho nào về ⇒ dòng 'chưa soi' gọi đủ ba kho vật chặn", () => {
    const kho = buildHazardList({}, null);
    expect(kho.hazards).toEqual([]);
    expect(kho.missing).toEqual(["xac-tau", "sea-lanes", "seamarks"]);
    const s = moTaThieu(kho.missing);
    expect(s).toContain("xác tàu");
    expect(s).toContain("giàn khoan");
    expect(s).toContain("phao");
  });
});

describe("giọng văn — không ra lệnh lái, không phán đi hay không", () => {
  it("mọi câu tự sinh đều tránh 'bẻ lái' / 'ngay'", () => {
    const items = buildDangerItems(
      plan({
        hasRoughLeg: true,
        hasShallowLeg: true,
        hasDraftShallowLeg: true,
        hasNearLandLeg: true,
        hasVeryShallowLeg: true,
        hasFollowingSeaRisk: true,
        hasHazardNearPortLeg: true,
        hasHazardLeg: true,
      }),
      [],
    );
    expect(items.length).toBeGreaterThan(4);
    for (const i of items) {
      expect(i.text).not.toMatch(/bẻ lái/i);
      expect(i.text).not.toMatch(/\bngay\b/i);
      expect(i.label.length).toBeLessThanOrEqual(14);
    }
  });
});

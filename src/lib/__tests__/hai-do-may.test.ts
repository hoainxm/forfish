import { describe, expect, it } from "vitest";
import {
  canKeu,
  doPvCuLy,
  donXacNhan,
  dsBaoDong,
  fmtPv,
  gocCamera,
  huongKeTiep,
  khoangCachM,
  lamMuotHuong,
  nongHonAnToan,
  thongSoMob,
  vongTron,
  xepCham,
  xetNeo,
  type TinhHinh,
} from "../hai-do/may";
import { docMob, docNeo } from "../hai-do/tam";
import { diemTheoPhuongVi } from "../hai-do/an-toan";

describe("hướng bản đồ", () => {
  it("xoay vòng; không tuyến thì bỏ Tuyến lên", () => {
    expect(huongKeTiep("bac", false)).toBe("huong-di");
    expect(huongKeTiep("huong-di", false)).toBe("bac");
    expect(huongKeTiep("huong-di", true)).toBe("tuyen");
    expect(huongKeTiep("tuyen", true)).toBe("bac");
    expect(huongKeTiep("tuyen", false)).toBe("bac");
  });
  it("làm mượt qua 0° không quay ngược cả vòng", () => {
    const h = lamMuotHuong(350, 10, 0.5);
    expect(h).toBeCloseTo(0, 5);
    expect(lamMuotHuong(null, 370)).toBe(10);
  });
  it("camera: Bắc = 0; tàu đứng giữ góc cũ; tuyến lên theo chặng", () => {
    expect(gocCamera("bac", 90, 45, 30)).toBe(0);
    expect(gocCamera("huong-di", null, null, 30)).toBe(30);
    expect(gocCamera("huong-di", 90, null, 30)).toBe(90);
    expect(gocCamera("tuyen", 90, 45, 30)).toBe(45);
  });
  it("phương vị 3 số", () => {
    expect(fmtPv(5)).toBe("005°");
    expect(fmtPv(359.6)).toBe("000°");
    expect(fmtPv(null)).toBe("—");
  });
});

describe("độ sâu so đường an toàn", () => {
  it("chỉ báo khi CHẮC nông hơn", () => {
    expect(nongHonAnToan(2, 10)).toBe(true);
    expect(nongHonAnToan(3, 10)).toBe(true);
    expect(nongHonAnToan(4, 10)).toBe(false); // 4–12 m: không chắc
    expect(nongHonAnToan(4, 20)).toBe(true);
    expect(nongHonAnToan(5, 50)).toBe(false);
    expect(nongHonAnToan(null, 10)).toBe(false);
  });
});

describe("canh neo", () => {
  const neo = { lat: 10, lon: 107, banKinhM: 50, luc: 0 };
  const ra = diemTheoPhuongVi(neo, 90, 0.08); // 80 m
  const trong = diemTheoPhuongVi(neo, 90, 0.02); // 20 m
  it("phải vượt 3 lần liên tiếp mới báo trôi", () => {
    let d = 0;
    for (let k = 1; k <= 2; k++) {
      const r = xetNeo(neo, ra, 5, d);
      d = r.dem;
      expect(r.troi).toBe(false);
    }
    const r3 = xetNeo(neo, ra, 5, d);
    expect(r3.troi).toBe(true);
    expect(Math.round(r3.cachM)).toBe(80);
  });
  it("về lại trong vòng ⇒ xoá đếm", () => {
    expect(xetNeo(neo, trong, 5, 2).dem).toBe(0);
  });
  it("fix kém (sai số > nửa bán kính) không cộng, không xoá", () => {
    const r = xetNeo(neo, ra, 40, 2);
    expect(r.dem).toBe(2);
    expect(r.troi).toBe(false);
  });
  it("khoảng cách mét", () => {
    expect(Math.round(khoangCachM(neo, trong))).toBe(20);
  });
});

describe("MOB", () => {
  it("phương vị + cự ly + phút + thời gian tới", () => {
    const mob = { lat: 10, lon: 107, luc: 0 };
    const pos = diemTheoPhuongVi(mob, 270, 1.852); // tàu ở phía Tây 1 hải lý
    const t = thongSoMob(mob, pos, 5 * 60000 + 10, 18.52);
    expect(Math.round(t.pvDeg)).toBe(90);
    expect(t.cuLyKm).toBeCloseTo(1.852, 2);
    expect(t.phut).toBe(5);
    expect(t.toiPhut).toBe(6);
    expect(thongSoMob(mob, pos, 0, null).toiPhut).toBeNull();
  });
});

describe("đo + vòng", () => {
  it("đo phương vị cự ly", () => {
    const a = { lat: 10, lon: 107 };
    const r = doPvCuLy(a, diemTheoPhuongVi(a, 45, 5));
    expect(Math.round(r.pvDeg)).toBe(45);
    expect(r.cuLyKm).toBeCloseTo(5, 3);
  });
  it("vòng tròn khép kín, bán kính đúng", () => {
    const tam = { lat: 10, lon: 107 };
    const v = vongTron(tam, 1);
    const r = v.geometry.coordinates[0];
    expect(r[0]).toEqual(r[r.length - 1]);
    expect(khoangCachM(tam, { lat: r[10][1], lon: r[10][0] })).toBeCloseTo(1000, 0);
  });
});

describe("báo động chung", () => {
  const goc: TinhHinh = {
    mob: null,
    neoTroi: false,
    neoCachM: null,
    baoGan: null,
    doSau: 5,
    anToanM: 10,
    gpsMat: false,
    cpa: null,
    lechTuyen: null,
    hetTuyen: false,
  };
  it("yên ổn ⇒ rỗng", () => {
    expect(dsBaoDong(goc)).toEqual([]);
  });
  it("MOB luôn đứng đầu; đỏ trước vàng", () => {
    const ds = dsBaoDong({ ...goc, gpsMat: true, neoTroi: true, neoCachM: 72, mob: { lat: 1, lon: 1, luc: 0 } });
    expect(ds.map((b) => b.ma)).toEqual(["mob", "neo", "gps"]);
    expect(ds[1].chu).toContain("72 m");
  });
  it("công trình (neo gần cáp / vòng giàn) là báo đỏ", () => {
    const ds = dsBaoDong({ ...goc, congTrinh: "Neo cách cáp quang ngầm 300 m — dễ móc" });
    expect(ds).toEqual([{ ma: "cong-trinh", muc: "do", chu: "Neo cách cáp quang ngầm 300 m — dễ móc" }]);
  });
  it("rạn khác nông; trên bờ không báo nông", () => {
    expect(dsBaoDong({ ...goc, doSau: 1 })[0].ma).toBe("ran");
    expect(dsBaoDong({ ...goc, doSau: 2 })[0].ma).toBe("nong");
    expect(dsBaoDong({ ...goc, doSau: 0 })).toEqual([]);
  });
  it("chuông: chỉ kêu khi có đỏ chưa xác nhận; hết báo thì quên xác nhận", () => {
    const ds = dsBaoDong({ ...goc, doSau: 2, gpsMat: true });
    expect(canKeu(ds, new Set())).toBe(true);
    expect(canKeu(ds, new Set(["nong"]))).toBe(false);
    expect(canKeu(dsBaoDong({ ...goc, gpsMat: true }), new Set())).toBe(false);
    expect([...donXacNhan(dsBaoDong(goc), new Set(["nong"]))]).toEqual([]);
  });
});

describe("tấm chạm gom", () => {
  it("an toàn trước, cùng hạng gần nhất thắng, bỏ trùng tầng, lớp lạ bỏ", () => {
    const r = xepCham([
      { lop: "hd-den-bien", i: 1, px: 1 },
      { lop: "hd-seamark-mid", i: 7, px: 9 },
      { lop: "hd-seamark-near", i: 7, px: 3 },
      { lop: "hd-seamark-near", i: 2, px: 4 },
      { lop: "hd-xac-tau", i: 0, px: 12 },
      { lop: "water", i: 0, px: 0 },
    ]);
    expect(r.map((v) => `${v.lop}:${v.i}`)).toEqual(["hd-xac-tau:0", "hd-seamark-near:7", "hd-seamark-near:2", "hd-den-bien:1"]);
  });
});

describe("lưu neo / MOB", () => {
  it("bản lưu hỏng ⇒ null, không bịa toạ độ", () => {
    expect(docNeo(null)).toBeNull();
    expect(docNeo("{")).toBeNull();
    expect(docNeo(JSON.stringify({ lat: 99, lon: 1, banKinhM: 50, luc: 1 }))).toBeNull();
    expect(docNeo(JSON.stringify({ lat: 1, lon: 1, banKinhM: 0, luc: 1 }))).toBeNull();
    expect(docMob(JSON.stringify({ lat: 1, lon: "x", luc: 1 }))).toBeNull();
  });
  it("bản đúng đọc lại nguyên", () => {
    const n = { lat: 10.1, lon: 107.2, banKinhM: 50, luc: 123 };
    expect(docNeo(JSON.stringify(n))).toEqual(n);
    const m = { lat: 10.1, lon: 107.2, luc: 9 };
    expect(docMob(JSON.stringify(m))).toEqual(m);
  });
});

import { chamTuAn, mucKhay, nutNoi } from "../hai-do/cot-nut";
describe("cột nút thông minh", () => {
  const yen = { coBaoDong: false, dangNeo: false, dangDo: false, nutZoom: false };
  it("lúc yên chỉ 3 nút: Hướng · Về tàu · Thêm", () => {
    expect(nutNoi(yen)).toEqual(["huong", "viTri", "them"]);
  });
  it("có việc mới nổi thêm, đúng thứ tự", () => {
    expect(nutNoi({ coBaoDong: true, dangNeo: true, dangDo: true, nutZoom: true })).toEqual([
      "zoom",
      "huong",
      "chuong",
      "neo",
      "do",
      "viTri",
      "them",
    ]);
  });
  it("mục Tàu (danh sách AIS) chỉ có khi lớp AIS đang bật, đứng sau Lớp", () => {
    expect(mucKhay(yen, { lop: true, tau: true, tuyen: true, vet: true }).slice(0, 5)).toEqual(["mau", "do", "neo", "lop", "tau"]);
    expect(mucKhay(yen, { lop: true, tau: false, tuyen: true, vet: true })).not.toContain("tau");
  });
  it("khay không lặp nút đang nổi; mục chưa có thì không hiện", () => {
    expect(mucKhay(yen, { lop: false, tuyen: false, vet: false })).toEqual(["mau", "do", "neo", "caiDat", "banDo"]);
    expect(mucKhay({ ...yen, dangNeo: true, dangDo: true }, { lop: true, tuyen: true, vet: true })).toEqual([
      "mau",
      "lop",
      "tuyen",
      "vet",
      "caiDat",
      "banDo",
    ]);
  });
});

describe("chamTuAn — tấm chạm tự ẩn như sheet bản đồ thường", () => {
  it("dòng thường ⇒ tự ẩn", () => {
    expect(chamTuAn([{}, {}])).toBe(true);
  });
  it("có cảnh báo hoặc nút việc ⇒ giữ", () => {
    expect(chamTuAn([{}, { canh: true }])).toBe(false);
    expect(chamTuAn([{ viec: {} }])).toBe(false);
  });
  it("trống ⇒ không đếm", () => {
    expect(chamTuAn([])).toBe(false);
  });
});

import { demNhinTruoc } from "../hai-do/may";
describe("nhìn trước (look-ahead)", () => {
  it("xoay theo hướng đi / tuyến + đang chạy ⇒ đệm trên ~1/3 màn (tàu xuống ~2/3)", () => {
    expect(demNhinTruoc("huong-di", 13, 700)).toBe(238);
    expect(demNhinTruoc("tuyen", 13, 700)).toBe(238);
  });
  it("Bắc lên, tàu đứng / chưa rõ tốc độ, màn chưa đo ⇒ 0 (tàu giữa màn)", () => {
    expect(demNhinTruoc("bac", 13, 700)).toBe(0);
    expect(demNhinTruoc("huong-di", 1, 700)).toBe(0);
    expect(demNhinTruoc("huong-di", null, 700)).toBe(0);
    expect(demNhinTruoc("huong-di", 13, 0)).toBe(0);
  });
});

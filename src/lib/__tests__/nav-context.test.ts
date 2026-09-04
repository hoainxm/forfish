// @vitest-environment jsdom
//
/*  KHO TRA CỨU CỦA DẪN ĐƯỜNG LIVE — chạy trên DỮ LIỆU THẬT trong public/data.

    jsdom vì có một ca đụng `localStorage` (cờ rung); phần còn lại thuần JS.

    Vì sao dữ liệu thật chứ không fixture: cái file này đang gánh là lời hứa
    "bấm Bắt đầu dẫn đường thì máy không đứng hình". Con số duy nhất trả lời
    được câu đó là thời gian dựng chỉ mục trên ĐÚNG số bản ghi đang có trong
    repo (43 xác tàu + 41 giàn khoan + 5.851 phao OSM + 1.447 phao nhà nước +
    ~1.950 đoạn cáp/ống). Fixture 10 dòng thì test nào cũng xanh.

    Ca giả vẫn cần cho nhánh KHÔNG có trong dữ liệu thật (kho thiếu, vùng cấm
    neo có tên, phao không suy được bên) — mục dưới cùng. */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  buildNavContext,
  cableKmAt,
  cableSegments,
  denBienTin,
  khuTruBaoGan,
  navRungOn,
  phaoKeTiep,
  pickHudLines,
  restrictedAt,
  restrictedZones,
  sameAlerts,
  setNavRungOn,
  NAV_RUNG_KEY,
  type NavContext,
} from "@/lib/nav-context";
import { decodeXacTau } from "@/lib/xac-tau";
import { decodeSeamarks, type Seamark } from "@/lib/seamarks";
import { decodeVnAids, type VnAid } from "@/lib/vn-aids";
import { decodeDenBien, type DenBien } from "@/lib/den-bien";
import { decodeKhuTruBao, type KhuTruBao } from "@/lib/khu-tru-bao";
import { requiredDepthM } from "@/lib/hazards";
import type { NavAlert } from "@/lib/nav-hazards";
import { fmtDist } from "@/lib/map-prefs";

const DATA = join(process.cwd(), "public", "data");
const readJson = (f: string) => JSON.parse(readFileSync(join(DATA, f), "utf8"));

const xacTau = decodeXacTau(readJson("xac-tau.v1.json"));
const laneFeatures = readJson("vn-sea-lanes.v1.json").features as GeoJSON.Feature[];
const seamarks = decodeSeamarks(readJson("seamarks.v1.json"));
const vnAids = decodeVnAids(readJson("vn-aids.v1.json"));
const denBien = decodeDenBien(readJson("den-bien.v1.json"));
const khuTruBao = decodeKhuTruBao(readJson("khu-tru-bao.v1.json"));

/** Năm cố định — test không được đổi kết quả theo lịch máy. */
const NAM_NAY = 2026;
const KHO = { xacTau, laneFeatures, seamarks, vnAids, denBien, khuTruBao };

/** Đơn vị mặc định của bà con là hải lý — dùng đúng bản `map-prefs`, không tự chế. */
const fmt = (km: number) => fmtDist(km, "nm", 1);

const ctx: NavContext = buildNavContext(KHO, requiredDepthM(2.2, null), NAM_NAY);

describe("buildNavContext trên dữ liệu thật", () => {
  it("gom đủ sáu lớp, không lớp nào rỗng", () => {
    console.debug("nav-context counts", ctx.counts, "buildMs", ctx.buildMs);
    // 43 xác tàu (trừ cái qua được với mớn 2,2 m) + 41 giàn + phao nguy hiểm/lồng bè
    expect(ctx.counts.hazards).toBeGreaterThanOrEqual(80);
    expect(ctx.counts.noGo).toBeGreaterThanOrEqual(1);
    // 103 đường cáp/ống → ~1.950 đoạn
    expect(ctx.counts.cableSegs).toBeGreaterThanOrEqual(1500);
    expect(ctx.counts.restricted).toBe(8); // 7 cấm neo + 1 cấm đánh bắt (đa giác)
    expect(ctx.counts.khu).toBe(khuTruBao.length);
    expect(ctx.counts.den).toBe(denBien.length);
    // phao gộp hai nguồn, đã bỏ bản OSM trùng chỗ bản nhà nước (≤100 m)
    expect(ctx.counts.aids).toBeGreaterThan(5000);
    expect(ctx.counts.aids).toBeLessThanOrEqual(seamarks.length + vnAids.length);
    expect(ctx.missing).toEqual([]);
  });

  it("dựng xong dưới 50 ms (máy bàn) — bấm Dẫn đường không được đứng hình", () => {
    // đo lại 3 lượt, lấy nhanh nhất: lượt đầu còn dính chi phí nạp module
    let best = Infinity;
    for (let i = 0; i < 3; i++) {
      const c = buildNavContext(KHO, requiredDepthM(2.2, null), NAM_NAY);
      best = Math.min(best, c.buildMs);
    }
    console.debug("nav-context buildMs (nhanh nhất/3)", best);
    expect(best).toBeLessThan(50);
  });

  it("kho THIẾU thì ghi tên vào missing chứ không ném", () => {
    const trong = buildNavContext({}, null, NAM_NAY);
    expect(trong.hazards).toBeNull();
    expect(trong.cables).toBeNull();
    expect(trong.aids).toBeNull();
    expect(trong.khu).toBeNull();
    expect(trong.missing).toContain("xac-tau");
    expect(trong.missing).toContain("sea-lanes");
    expect(trong.missing).toContain("seamarks");
    expect(trong.missing).toContain("vn-aids");
    expect(trong.missing).toContain("den-bien");
    expect(trong.missing).toContain("khu-tru-bao");
    // và mọi hàm tra cứu phải im chứ không nổ
    const p = { lat: 10.3, lon: 107.1 };
    expect(cableKmAt(trong, p)).toBeNull();
    expect(restrictedAt(trong, p)).toBeNull();
    expect(phaoKeTiep(trong, p, 0, fmt)).toBeNull();
    expect(denBienTin(trong, p, fmt)).toBeNull();
    expect(khuTruBaoGan(trong, p, 12, fmt)).toEqual([]);
    expect(cableKmAt(null, p)).toBeNull();
    expect(khuTruBaoGan(null, p, 12, fmt)).toEqual([]);
  });
});

describe("cáp/ống + vùng hạn chế", () => {
  it("cắt chuỗi ở đỉnh hỏng chứ không nối bừa qua", () => {
    const segs = cableSegments([
      {
        type: "Feature",
        properties: { kind: "cap", loai: "quang", ten: "Cáp thử" },
        geometry: {
          type: "LineString",
          coordinates: [
            [107, 10],
            [107.1, 10],
            [999, 999], // đỉnh hỏng
            [107.3, 10],
            [107.4, 10],
          ],
        },
      } as GeoJSON.Feature,
    ]);
    // 2 đoạn: (107,10)→(107.1,10) và (107.3,10)→(107.4,10). KHÔNG có đoạn nối
    // 107.1 → 107.3 (sợi cáp không có thật chạy ngang biển).
    expect(segs).toHaveLength(2);
    expect(segs[1].a.lon).toBeCloseTo(107.3, 6);
    expect(segs[0].ref.kind).toBe("cap");
  });

  it("đứng NGAY TRÊN một đoạn cáp thật thì đo ra ~0 km", () => {
    const seg = cableSegments(laneFeatures)[0];
    const giua = {
      lat: (seg.a.lat + seg.b.lat) / 2,
      lon: (seg.a.lon + seg.b.lon) / 2,
    };
    const km = cableKmAt(ctx, giua);
    expect(km).not.toBeNull();
    expect(km!).toBeLessThan(0.05);
  });

  it("giữa Biển Đông thì không có cáp nào trong tầm hỏi", () => {
    expect(cableKmAt(ctx, { lat: 13.5, lon: 113.5 })).toBeNull();
  });

  it("vùng cấm neo: trong thì có tên, ngoài thì null", () => {
    const z = restrictedZones(laneFeatures)[0];
    expect(z.ten).toMatch(/vùng (cấm neo|cấm đánh bắt|hạn chế)/);
    // trọng tâm vòng ngoài — với các đa giác lồi trong nguồn này là điểm TRONG
    const n = z.ring.length;
    const c = z.ring.reduce(
      (a, [lon, lat]) => ({ lat: a.lat + lat / n, lon: a.lon + lon / n }),
      { lat: 0, lon: 0 },
    );
    expect(restrictedAt(ctx, c)).toBe(z.ten);
    expect(restrictedAt(ctx, { lat: 13.5, lon: 113.5 })).toBeNull();
  });

  it("đường HỞ (cam-neo dạng LineString) không vào danh sách — không xét 'trong' được", () => {
    const ho = laneFeatures.filter(
      (f) =>
        (f.properties as { kind?: string })?.kind === "vungcam" &&
        f.geometry.type === "LineString",
    );
    expect(ho.length).toBeGreaterThan(0); // nguồn thật CÓ ca này
    expect(restrictedZones(ho)).toEqual([]);
  });
});

describe("khu trú bão gần nhất", () => {
  const vungTau = { lat: 10.33, lon: 107.08 };

  it("3 khu gần nhất, gần trước, có giờ khi tàu đang chạy", () => {
    const rows = khuTruBaoGan(ctx, vungTau, 13, fmt);
    expect(rows).toHaveLength(3);
    expect(rows[0].km).toBeLessThanOrEqual(rows[1].km);
    expect(rows[1].km).toBeLessThanOrEqual(rows[2].km);
    expect(rows[0].khoang).toMatch(/hải lý$/);
    expect(rows[0].gio).toMatch(/giờ|phút/);
    expect(rows[0].tinh).not.toMatch(/^[A-ZÀ-Ỹ ]+$/u); // "Bà Rịa…" chứ không "BÀ RỊA…"
  });

  it("tàu chưa chạy thì KHÔNG bịa giờ", () => {
    for (const v of [null, 0, 0.4]) {
      const rows = khuTruBaoGan(ctx, vungTau, v, fmt);
      expect(rows[0].gio).toBeNull();
    }
  });

  it("cỡ tàu: chỉ nói khi quy hoạch có ghi, không ghi thì null (không phải 0)", () => {
    const rows = khuTruBaoGan(ctx, vungTau, 13, fmt, khuTruBao.length + 5, 4000);
    expect(rows).toHaveLength(khuTruBao.length);
    for (const r of rows) {
      expect(r.tauDaiM === null || r.tauDaiM > 0).toBe(true);
    }
    expect(rows.some((r) => r.tauDaiM != null)).toBe(true);
  });

  it("quy hoạch KHÔNG ghi cỡ tàu → null, màn hình im về cỡ tàu", () => {
    // nguồn thật hôm nay khu nào cũng có `coTauM`, nên nhánh "không ghi" phải
    // kiểm bằng ca giả — không có nó thì mai nguồn bỏ trống một ô là ra "0 m"
    const khuTrong: KhuTruBao = {
      lat: 10.3,
      lon: 107.1,
      ten: "Khu thử",
      tinh: "BÀ RỊA - VŨNG TÀU",
      cap: "tinh",
      sucChua: null,
      coTauM: null,
      ghiChu: null,
      tin: "vua",
      nguonToaDo: "thử",
    };
    const c = buildNavContext({ khuTruBao: [khuTrong] }, null, NAM_NAY);
    const [r] = khuTruBaoGan(c, { lat: 10.33, lon: 107.08 }, 13, fmt);
    expect(r.tauDaiM).toBeNull();
    expect(r.ganDung).toBe(true);
    expect(r.tinh).toBe("Bà Rịa - Vũng Tàu");
  });

  it("toạ độ tin VỪA được đánh dấu để câu chữ nói '(vị trí gần đúng)'", () => {
    const rows = khuTruBaoGan(ctx, vungTau, 13, fmt, 60);
    const vua = khuTruBao.filter((k: KhuTruBao) => k.tin === "vua");
    expect(vua.length).toBeGreaterThan(0);
    expect(rows.some((r) => r.ganDung)).toBe(true);
  });
});

describe("dòng tin: phao kế tiếp · đèn biển", () => {
  it("phao trong 2 km: có tên, có hướng so với mũi tàu, có bên đi qua nếu suy được", () => {
    // lấy một phao luồng THẬT của Cục Hàng hải rồi đứng cách nó ~300 m
    const phao = vnAids.find(
      (m: VnAid) => m.type === "buoy_lateral" && m.tacDung,
    );
    expect(phao).toBeTruthy();
    const pos = { lat: phao!.lat - 0.003, lon: phao!.lon };
    const line = phaoKeTiep(ctx, pos, 0, fmt); // mũi hướng Bắc → phao phía trước
    expect(line).not.toBeNull();
    expect(line!.cau).toMatch(/phía trước/);
    expect(line!.id.startsWith("phao:")).toBe(true);
    // không bịa bên: hoặc có câu "để … bên", hoặc im hẳn về bên
    expect(line!.cau).toMatch(/bên (TRÁI|PHẢI)|phía (BẮC|NAM|ĐÔNG|TÂY)|\.$/);
  });

  it("phao báo nguy hiểm cô lập KHÔNG vào dòng tin (đã là hiểm hoạ bậc 1)", () => {
    const cach = seamarks.find(
      (m: Seamark) => m.type === "buoy_isolated_danger",
    );
    if (!cach) return; // dữ liệu đổi thì bỏ qua chứ không đỏ oan
    const line = phaoKeTiep(ctx, { lat: cach.lat, lon: cach.lon }, null, fmt, 0.2);
    if (line) expect(line.cau).not.toMatch(/nguy hiểm ngay dưới/i);
  });

  it("giữa Biển Đông thì không có phao nào trong 2 km", () => {
    expect(phaoKeTiep(ctx, { lat: 13.5, lon: 113.5 }, 0, fmt)).toBeNull();
  });

  it("đèn biển: gọi ĐÚNG TÊN, chỉ nói khi tầm hiệu lực còn với tới chỗ tàu", () => {
    // một ngọn CÓ TÊN, tầm vừa phải, ngoài khơi cho khỏi dính đèn khác gần hơn
    const den = denBien.find(
      (d: DenBien) =>
        d.ten && typeof d.light?.range === "number" && d.light.range >= 8,
    );
    expect(den).toBeTruthy();
    const tamKm = den!.light!.range! * 1.852;
    // dịch ra biển theo vĩ độ; 0,25 tầm là chắc chắn trong tầm
    const gan = { lat: den!.lat + (tamKm * 0.25) / 111, lon: den!.lon };
    const line = denBienTin(ctx, gan, fmt);
    expect(line).not.toBeNull();
    expect(line!.cau).toMatch(/^Đèn biển .+ hướng .+, cách chừng .+ hải lý\.$/);
    expect(line!.id.startsWith("den:")).toBe(true);
  });

  it("đèn biển: ra ngoài tầm mọi ngọn đèn thì IM (không hứa 'nhìn là thấy')", () => {
    // giữa Biển Đông: ngọn gần nhất cách hàng trăm hải lý
    expect(denBienTin(ctx, { lat: 13.5, lon: 113.5 }, fmt)).toBeNull();
  });
});

describe("pickHudLines", () => {
  const al = (id: string, muc: NavAlert["muc"], bac: NavAlert["bac"] = 1): NavAlert => ({
    id,
    bac,
    muc,
    cau: `câu ${id}`,
    chuong: false,
    rung: false,
    distKm: 1,
    etaMin: null,
  });

  it("giữ nguyên thứ tự của nav-hazards, đỏ thì KHOÁ (không thu được)", () => {
    const out = pickHudLines([al("a", "do"), al("b", "vang", 3)], false, null);
    expect(out.map((l) => l.id)).toEqual(["a", "b"]);
    expect(out[0].khoa).toBe(true);
    expect(out[1].khoa).toBe(false);
  });

  it("cả hai đỏ thì hiện hai dòng đỏ — không hạ bớt cho đỡ đỏ mắt", () => {
    const out = pickHudLines([al("a", "do"), al("b", "do")], false, null);
    expect(out.filter((l) => l.khoa)).toHaveLength(2);
  });

  it("còn slot trống mới tới lượt dòng tin", () => {
    expect(pickHudLines([], false, "Phao số 7 phía trước 600 m.")).toEqual([
      { id: "tin:live", cau: "Phao số 7 phía trước 600 m.", muc: "tin", khoa: false },
    ]);
    // hết slot → bỏ dòng tin
    const day = pickHudLines([al("a", "do"), al("b", "vang", 3)], false, "tin");
    expect(day).toHaveLength(2);
    expect(day.some((l) => l.muc === "tin")).toBe(false);
  });

  it("sát ranh giới (≤6 hải lý) thì bỏ dòng tin — đừng kể chuyện phao lúc đó", () => {
    expect(pickHudLines([], true, "Phao số 7 phía trước 600 m.")).toEqual([]);
    // nhưng cảnh báo hiểm hoạ thì vẫn giữ nguyên
    expect(pickHudLines([al("a", "do")], true, "tin")).toHaveLength(1);
  });

  it("không có gì thì trả mảng rỗng, nhận cả null/undefined", () => {
    expect(pickHudLines(null, false, null)).toEqual([]);
    expect(pickHudLines(undefined, false, null)).toEqual([]);
  });

  it("sameAlerts so id + mức + câu (để khỏi setState mỗi nhịp GPS)", () => {
    const a = [al("x", "do")];
    expect(sameAlerts(a, [al("x", "do")])).toBe(true);
    expect(sameAlerts(a, [al("x", "vang")])).toBe(false);
    expect(sameAlerts(a, [])).toBe(false);
  });
});

describe("cờ rung", () => {
  it("mặc định BẬT, tắt/bật giữ được, khoá đúng tên đã đăng ký", () => {
    localStorage.removeItem(NAV_RUNG_KEY);
    expect(navRungOn()).toBe(true);
    setNavRungOn(false);
    expect(localStorage.getItem(NAV_RUNG_KEY)).toBe("0");
    expect(navRungOn()).toBe(false);
    setNavRungOn(true);
    expect(navRungOn()).toBe(true);
    localStorage.removeItem(NAV_RUNG_KEY);
  });
});

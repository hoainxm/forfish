/*  DANH SÁCH HIỂM HOẠ — kiểm luật bán kính trên dữ liệu giả có chủ ý, và đếm
    trên DỮ LIỆU THẬT trong public/data (số đếm in ra để đưa vào doc 02).

    Vì sao phải kiểm luật bằng ca giả: dữ liệu thật hôm nay không có xác tàu
    nào ghi bán kính, chỉ MỘT cái ghi độ sâu — nếu chỉ chạy trên file thật thì
    nhánh "×2 khi tin vừa", "banKinhCamM", "qua được khi biết mớn" không bao
    giờ được đi qua, mà đó là các nhánh quyết định vòng tránh rộng hay hẹp. */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  buildHazardList,
  hazardsInBBox,
  moTaHazard,
  noGoFromLanes,
  packHazards,
  requiredDepthM,
  unpackHazards,
  HAZARD_R_KM,
  TIN_VUA_NHAN,
  type Hazard,
} from "@/lib/hazards";
import { decodeXacTau, type XacTau } from "@/lib/xac-tau";
import { decodeSeamarks, type Seamark } from "@/lib/seamarks";

const DATA = join(process.cwd(), "public", "data");
const readJson = (f: string) => JSON.parse(readFileSync(join(DATA, f), "utf8"));

const xacTau = decodeXacTau(readJson("xac-tau.v1.json"));
const lanes = readJson("vn-sea-lanes.v1.json").features as GeoJSON.Feature[];
const seamarks = decodeSeamarks(readJson("seamarks.v1.json"));

/** Năm cố định để test không đổi kết quả theo lịch máy. */
const NAM_NAY = 2026;

function xt(over: Partial<XacTau> = {}): XacTau {
  return {
    lon: 106.5,
    lat: 9.5,
    loai: "xac-tau",
    nam: NAM_NAY,
    prov: { origin: { source: "tbhh", at: "2026-09-02" } },
    ...over,
  };
}

const CAU_CAM = [/bẻ lái/i, /\bngay\b/i];

describe("luật bán kính xác tàu", () => {
  it("nguồn không ghi bán kính → sàn 500 m; tin mới, có toạ độ → không phải tin vừa", () => {
    const { hazards } = buildHazardList({ xacTau: [xt()] }, null, NAM_NAY);
    expect(hazards).toHaveLength(1);
    expect(hazards[0].rKm).toBe(HAZARD_R_KM.xacTauMin);
    expect(hazards[0].tinVua).toBe(false);
    expect(hazards[0].loai).toBe("xac-tau");
  });

  it("nguồn ghi bán kính lớn hơn sàn thì lấy của nguồn", () => {
    const { hazards } = buildHazardList({ xacTau: [xt({ banKinhCamM: 800 })] }, null, NAM_NAY);
    expect(hazards[0].rKm).toBeCloseTo(0.8, 9);
  });

  it("nguồn ghi bán kính NHỎ hơn sàn thì vẫn giữ sàn 500 m", () => {
    const { hazards } = buildHazardList({ xacTau: [xt({ banKinhCamM: 100 })] }, null, NAM_NAY);
    expect(hazards[0].rKm).toBe(HAZARD_R_KM.xacTauMin);
  });

  it('vị trí "theo phao" → tin vừa, bán kính ×2', () => {
    const { hazards } = buildHazardList(
      { xacTau: [xt({ ghi: "Vị trí theo Phao 5 luồng Cửa Gianh" })] },
      null,
      NAM_NAY,
    );
    expect(hazards[0].tinVua).toBe(true);
    expect(hazards[0].rKm).toBe(HAZARD_R_KM.xacTauMin * TIN_VUA_NHAN);
  });

  it("tin quá 3 năm → tin vừa ×2; đúng 3 năm thì chưa", () => {
    const cu = buildHazardList({ xacTau: [xt({ nam: NAM_NAY - 4 })] }, null, NAM_NAY).hazards[0];
    expect(cu.tinVua).toBe(true);
    expect(cu.rKm).toBe(1);
    const vua = buildHazardList({ xacTau: [xt({ nam: NAM_NAY - 3 })] }, null, NAM_NAY).hazards[0];
    expect(vua.tinVua).toBe(false);
  });

  it("không ghi năm → không biết tuổi tin → đi về phía an toàn (tin vừa)", () => {
    const h = buildHazardList({ xacTau: [xt({ nam: undefined })] }, null, NAM_NAY).hazards[0];
    expect(h.tinVua).toBe(true);
    expect(h.nam).toBeNull();
  });

  it("bán kính nguồn + tin vừa: nhân đôi trên bán kính nguồn", () => {
    const h = buildHazardList(
      { xacTau: [xt({ banKinhCamM: 700, nam: 2019 })] },
      null,
      NAM_NAY,
    ).hazards[0];
    expect(h.rKm).toBeCloseTo(1.4, 9);
  });
});

describe("nước trên vật và mớn tàu", () => {
  const sau = xt({ doSauVuotQua: 6.8, ten: "MINH KHÁNH 01" });

  it("KHÔNG biết mớn → vẫn chặn (không nới theo mớn khi chưa khai)", () => {
    const r = buildHazardList({ xacTau: [sau] }, null, NAM_NAY);
    expect(r.hazards).toHaveLength(1);
    expect(r.passable).toHaveLength(0);
    expect(r.hazards[0].doSauM).toBe(6.8);
  });

  it("biết mớn, nước trên vật ≥ cần → sang passable, không chặn", () => {
    const r = buildHazardList({ xacTau: [sau] }, 2.9, NAM_NAY);
    expect(r.hazards).toHaveLength(0);
    expect(r.passable).toHaveLength(1);
    expect(r.passable[0].ten).toBe("MINH KHÁNH 01");
  });

  it("biết mớn nhưng nước trên vật < cần → vẫn chặn", () => {
    const r = buildHazardList({ xacTau: [sau] }, 7.5, NAM_NAY);
    expect(r.hazards).toHaveLength(1);
    expect(r.passable).toHaveLength(0);
  });

  it("requiredDepthM: mớn + 0,5 + ½·min(Hs, 3); không mớn → null", () => {
    expect(requiredDepthM(null, 1)).toBeNull();
    expect(requiredDepthM(0, 1)).toBeNull();
    expect(requiredDepthM(2, null)).toBe(2.5);
    expect(requiredDepthM(2, 1)).toBe(3);
    expect(requiredDepthM(2, 5)).toBe(4); // Hs kẹp 3 m
  });
});

describe("kho thiếu và toạ độ hỏng", () => {
  it("kho null → ghi missing, không ném, các kho còn lại vẫn đọc", () => {
    const r = buildHazardList({ xacTau: null, laneFeatures: null, seamarks: [] }, null, NAM_NAY);
    expect(r.missing).toEqual(["xac-tau", "sea-lanes"]);
    expect(r.hazards).toEqual([]);
  });

  it("hàng toạ độ hỏng bị bỏ, không làm mất cả lớp", () => {
    const r = buildHazardList(
      { xacTau: [xt({ lat: Number.NaN }), xt({ lon: 999 }), xt()] },
      null,
      NAM_NAY,
    );
    expect(r.hazards).toHaveLength(1);
  });

  it("seamarks: phao/tiêu hiểm hoạ cô lập 300 m, lồng bè 200 m, platform bỏ", () => {
    const sm: Seamark[] = [
      { lat: 10, lon: 107, type: "buoy_isolated_danger" },
      { lat: 10, lon: 107.1, type: "beacon_isolated_danger" },
      { lat: 10, lon: 107.2, type: "marine_farm" },
      { lat: 10, lon: 107.3, type: "platform" },
      { lat: 10, lon: 107.4, type: "buoy_lateral" },
    ];
    const r = buildHazardList({ seamarks: sm }, null, NAM_NAY);
    expect(r.hazards.map((h) => [h.loai, h.rKm])).toEqual([
      ["phao-nguy-hiem", 0.3],
      ["phao-nguy-hiem", 0.3],
      ["long-be", 0.2],
    ]);
    expect(r.hazards.every((h) => h.nguon === "osm")).toBe(true);
  });
});

describe("vn-sea-lanes: giàn khoan + vùng cấm vào", () => {
  it("giàn khoan là điểm bán kính 1 km, nguồn sea-lanes", () => {
    const r = buildHazardList({ laneFeatures: lanes }, null, NAM_NAY);
    const gian = r.hazards.filter((h) => h.loai === "gian-khoan");
    expect(gian.length).toBeGreaterThan(10);
    expect(gian.every((h) => h.rKm === HAZARD_R_KM.gianKhoan && h.nguon === "sea-lanes")).toBe(true);
  });

  it("cấm vào: Polygon thành NoGoZone có bbox; LineString hở vào khongXacDinh, KHÔNG thành vùng", () => {
    const ng = noGoFromLanes(lanes);
    expect(ng.zones.length).toBeGreaterThan(0);
    for (const z of ng.zones) {
      expect(z.ring.length).toBeGreaterThanOrEqual(3);
      expect(z.bbox.latMin).toBeLessThanOrEqual(z.bbox.latMax);
      expect(z.bbox.lonMin).toBeLessThanOrEqual(z.bbox.lonMax);
      for (const [lon, lat] of z.ring) {
        expect(lat).toBeGreaterThanOrEqual(z.bbox.latMin);
        expect(lat).toBeLessThanOrEqual(z.bbox.latMax);
        expect(lon).toBeGreaterThanOrEqual(z.bbox.lonMin);
        expect(lon).toBeLessThanOrEqual(z.bbox.lonMax);
      }
    }
    expect(ng.hoDang.length).toBeGreaterThan(0);
    expect(ng.khongXacDinh.length).toBeGreaterThan(0);
    // cấm neo / cấm đánh bắt / hạn chế KHÔNG phải cấm vào
    const soCamVaoPolygon = lanes.filter(
      (f) => f.properties?.kind === "vungcam" && f.properties?.loai === "cam-vao" && f.geometry.type === "Polygon",
    ).length;
    expect(ng.zones).toHaveLength(soCamVaoPolygon);
  });
});

describe("câu cho bà con", () => {
  it("có tên, năm, nước trên vật, bán kính; KHÔNG ra lệnh lái", () => {
    const h = buildHazardList(
      { xacTau: [xt({ ten: "MINH KHÁNH 01", doSauVuotQua: 1.1, nam: 2026 })] },
      null,
      NAM_NAY,
    ).hazards[0];
    const cau = moTaHazard(h);
    expect(cau).toContain("Xác tàu chìm MINH KHÁNH 01");
    expect(cau).toContain("tin năm 2026");
    expect(cau).toContain("nước trên vật 1,1 m");
    expect(cau).toContain("500 m");
    expect(cau).not.toContain("(vị trí gần đúng)");
    for (const re of CAU_CAM) expect(cau).not.toMatch(re);
  });

  it('tin vừa → "(vị trí gần đúng)" và bán kính đã nhân đôi', () => {
    const h = buildHazardList({ xacTau: [xt({ nam: 2019 })] }, null, NAM_NAY).hazards[0];
    const cau = moTaHazard(h);
    expect(cau).toContain("(vị trí gần đúng)");
    expect(cau).toContain("1 km");
  });

  it("giàn khoan / phao / lồng bè: nhãn tiếng Việt, không lộ mã", () => {
    const r = buildHazardList(
      {
        laneFeatures: [
          {
            type: "Feature",
            properties: { kind: "giankhoan", ten: "Giàn khoan / công trình biển — Biển Đông (bắc)" },
            geometry: { type: "Point", coordinates: [112.1, 21.4] },
          },
        ],
        seamarks: [
          { lat: 10, lon: 107, type: "buoy_isolated_danger" },
          { lat: 10, lon: 107.2, type: "marine_farm" },
        ],
      },
      null,
      NAM_NAY,
    );
    const caus = r.hazards.map(moTaHazard);
    expect(caus[0]).toBe("Giàn khoan — tránh xa chừng 1 km");
    expect(caus[1]).toContain("Phao báo chỗ nguy hiểm");
    expect(caus[2]).toContain("Lồng bè nuôi");
    for (const c of caus) {
      expect(c).not.toMatch(/gian-khoan|phao-nguy-hiem|long-be|buoy|marine/);
      for (const re of CAU_CAM) expect(c).not.toMatch(re);
    }
  });

  it("mọi hiểm hoạ THẬT: câu không rỗng, không ra lệnh lái", () => {
    const r = buildHazardList({ xacTau, laneFeatures: lanes, seamarks }, null, NAM_NAY);
    for (const h of r.hazards) {
      const c = moTaHazard(h);
      expect(c.length).toBeGreaterThan(5);
      for (const re of CAU_CAM) expect(c).not.toMatch(re);
    }
  });
});

describe("đóng gói sang worker", () => {
  it("pack → unpack giữ đúng thứ tự và từng đối tượng; id lạ bị bỏ, không ném", () => {
    const r = buildHazardList({ xacTau, laneFeatures: lanes, seamarks }, null, NAM_NAY);
    const p = packHazards(r.hazards);
    expect(p.lat).toBeInstanceOf(Float64Array);
    expect(p.lat.length).toBe(r.hazards.length);
    expect(p.rKm.length).toBe(r.hazards.length);
    for (let i = 0; i < r.hazards.length; i++) {
      expect(p.lat[i]).toBe(r.hazards[i].lat);
      expect(p.lon[i]).toBe(r.hazards[i].lon);
      expect(p.rKm[i]).toBe(r.hazards[i].rKm);
      expect(p.ids[i]).toBe(r.hazards[i].id);
    }
    const back = unpackHazards(p, r.hazards);
    expect(back).toHaveLength(r.hazards.length);
    back.forEach((h, i) => expect(h).toBe(r.hazards[i]));
    // gói từ một kho cũ hơn: id không còn → bỏ, phần còn lại vẫn về
    const la = { ...p, ids: [...p.ids.slice(0, 3), "khong-co"] };
    expect(unpackHazards(la, r.hazards)).toHaveLength(3);
  });

  it("id là duy nhất trong cả danh sách", () => {
    const r = buildHazardList({ xacTau, laneFeatures: lanes, seamarks }, null, NAM_NAY);
    const ids = new Set(r.hazards.map((h) => h.id));
    expect(ids.size).toBe(r.hazards.length);
  });
});

describe("lọc theo khung", () => {
  const h = (lat: number, lon: number, rKm = 0.5): Hazard => ({
    id: `${lat}:${lon}`,
    lat,
    lon,
    rKm,
    loai: "xac-tau",
    ten: null,
    nam: null,
    doSauM: null,
    tinVua: false,
    nguon: "tbhh",
  });
  const bbox = { latMin: 10, latMax: 11, lonMin: 107, lonMax: 108 };

  it("trong khung giữ, xa khung bỏ, sát mép + bán kính/đệm vẫn giữ", () => {
    const list = [
      h(10.5, 107.5),
      h(12, 109),
      h(11.004, 107.5), // ~0,45 km ngoài mép bắc, r 0,5 → chạm khung
      h(11.03, 107.5, 0.5), // ~3,3 km ngoài, r 0,5, đệm 0 → không chạm
    ];
    const got = hazardsInBBox(list, bbox, 0);
    expect(got.map((x) => x.id)).toEqual(["10.5:107.5", "11.004:107.5"]);
    const rong = hazardsInBBox(list, bbox, 5);
    expect(rong.map((x) => x.id)).toEqual(["10.5:107.5", "11.004:107.5", "11.03:107.5"]);
  });

  it("khung hỏng → rỗng, không ném", () => {
    expect(hazardsInBBox([h(10.5, 107.5)], { latMin: Number.NaN, latMax: 11, lonMin: 107, lonMax: 108 }, 1)).toEqual([]);
  });
});

/* ── SỐ ĐẾM TRÊN DỮ LIỆU THẬT — in ra để R1 dán vào doc 02 ─────────────── */
describe("dữ liệu thật public/data", () => {
  it("dựng được từ cả ba kho, không ném, và in số theo loại", () => {
    const t0 = performance.now();
    const r = buildHazardList({ xacTau, laneFeatures: lanes, seamarks }, null, NAM_NAY);
    const ms = performance.now() - t0;
    const dem: Record<string, number> = {};
    for (const x of r.hazards) dem[x.loai] = (dem[x.loai] ?? 0) + 1;
    const tinVua = r.hazards.filter((x) => x.tinVua).length;
    console.log(
      [
        "",
        `  hiểm hoạ từ dữ liệu thật (năm ${NAM_NAY}): ${r.hazards.length} chặn · ${r.passable.length} qua được · ${r.noGo.length} vùng cấm vào · ${r.khongXacDinh.length} ranh hở`,
        `  theo loại: ${Object.entries(dem)
          .map(([k, v]) => `${k} ${v}`)
          .join(" · ")}`,
        `  xác tàu tin vừa (×2): ${tinVua}/${xacTau.length} · dựng ${ms.toFixed(1)} ms`,
        "",
      ].join("\n"),
    );
    expect(r.missing).toEqual([]);
    expect(dem["gian-khoan"]).toBeGreaterThan(10);
    expect(dem["phao-nguy-hiem"]).toBeGreaterThan(0);
    expect(dem["long-be"]).toBeGreaterThan(0);
    expect((dem["xac-tau"] ?? 0) + (dem["chuong-ngai"] ?? 0) + (dem["vat-chim"] ?? 0)).toBe(xacTau.length);
    // mọi bán kính hữu hạn dương, không cái nào > 5 km (nguồn ghi sai đơn vị sẽ lộ ở đây)
    for (const x of r.hazards) {
      expect(x.rKm).toBeGreaterThan(0);
      expect(x.rKm).toBeLessThanOrEqual(5);
    }
  });
});

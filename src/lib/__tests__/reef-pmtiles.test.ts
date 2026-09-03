/**
 * LỚP RẠN DẠNG VECTOR TILE — cổng nghiệm thu trên FILE THẬT.
 *
 * `public/data/reef-shapes-aca.v1.pmtiles` do `scripts/reef-to-pmtiles.mjs` cắt
 * ra từ `public/data/reef-shapes-aca.v1.bin`. Nó tồn tại để MapLibre không phải
 * nuốt 4.030.270 đỉnh một lượt mới vẽ được cái rạn đầu tiên (đo:
 * `docs/research/ran-vector-tile-2026-08.md`).
 *
 * Đổi cách lưu một lớp CẢNH BÁO VẬT CẢN thì rủi ro không phải là "chậm" mà là
 * "im lặng": một mảnh rạn rơi mất trong lúc cắt ô vẫn cho ra file hợp lệ, bản đồ
 * vẫn vẽ đẹp, chỉ có chỗ đó ngoài biển là trống. Nên bộ này KHÔNG kiểm bằng
 * fixture và KHÔNG tin số liệu mà chính script ghi vào metadata — nó dựng lại kỳ
 * vọng TỪ FILE .bin NGUỒN rồi soi vào file .pmtiles ĐÃ PHÁT HÀNH:
 *
 *   (1) file mở được bằng ĐÚNG gói `pmtiles` mà app đăng ký cho MapLibre;
 *   (2) mọi mảnh đa giác của nguồn đều có mặt ở mức nét đầy đủ — đếm đủ 88.840,
 *       không phải "đủ gần";
 *   (3) toạ độ ở mức nét đầy đủ không xê dịch quá lưới ô (≈1,2 m);
 *   (4) zoom thấp phải NHẸ THẬT — nếu z6 vẫn nặng như z13 thì cả việc này vô
 *       nghĩa, vì đó chính là thứ đường GeoJSON đang làm sai.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PMTiles } from "pmtiles";
import { VectorTile } from "@mapbox/vector-tile";
import Pbf from "pbf";
import { decodeReefShapes } from "@/lib/reef-bin.mjs";
import { GeoJSONVT } from "@maplibre/geojson-vt";
import {
  REEF_TILE_LAYER,
  REEF_TILE_MINZOOM,
  REEF_TILE_MAXZOOM,
  bufferSource,
  ringDeviationM,
  explodeParts,
  walkTiles,
} from "../../../scripts/reef-to-pmtiles.mjs";

const PMT_FILE = path.join(process.cwd(), "public/data/reef-shapes-aca.v1.pmtiles");
const BIN_FILE = path.join(process.cwd(), "public/data/reef-shapes-aca.v1.bin");

type Ring = [number, number][];

const archive = new PMTiles(bufferSource(readFileSync(PMT_FILE), PMT_FILE));
const source = decodeReefShapes(readFileSync(BIN_FILE)) as unknown as {
  properties: { bbox: [number, number, number, number] };
  features: { properties: { kind: string }; geometry: { coordinates: Ring[][] } }[];
};
const parts = explodeParts(source) as unknown as {
  features: { properties: { kind: string; pid: number }; geometry: { coordinates: Ring[] } }[];
  parts: number;
};

/** Ô nào ở mức nét đầy đủ mà một mảnh chạm tới — suy TỪ NGUỒN, không hỏi file. */
function tilesTouchedAtMaxZoom() {
  const n = 2 ** REEF_TILE_MAXZOOM;
  const lon2x = (lon: number) => Math.min(n - 1, Math.max(0, Math.floor(((lon + 180) / 360) * n)));
  const lat2y = (lat: number) => {
    const r = (lat * Math.PI) / 180;
    const t = (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2;
    return Math.min(n - 1, Math.max(0, Math.floor(t * n)));
  };
  const keys = new Set<number>();
  for (const f of parts.features) {
    let w = Infinity;
    let e = -Infinity;
    let s = Infinity;
    let nn = -Infinity;
    for (const ring of f.geometry.coordinates) {
      for (const [x, y] of ring) {
        if (x < w) w = x;
        if (x > e) e = x;
        if (y < s) s = y;
        if (y > nn) nn = y;
      }
    }
    for (let x = lon2x(w); x <= lon2x(e); x++) {
      for (let y = lat2y(nn); y <= lat2y(s); y++) keys.add(x * n + y);
    }
  }
  return [...keys].map((k) => ({ x: Math.floor(k / n), y: k % n }));
}

/** Đọc một ô và trả về lớp MVT bên trong (undefined nếu ô không tồn tại). */
async function layerAt(z: number, x: number, y: number) {
  const r = await archive.getZxy(z, x, y);
  if (!r) return undefined;
  return new VectorTile(new Pbf(new Uint8Array(r.data))).layers[REEF_TILE_LAYER];
}

describe("reef-shapes-aca.v1.pmtiles — kho vector tile lớp rạn", () => {
  it("mở được bằng đúng gói pmtiles app đăng ký cho MapLibre", async () => {
    const h = await archive.getHeader();
    expect(h.specVersion).toBe(3);
    expect(h.tileType).toBe(1); // MVT
    expect(h.tileCompression).toBe(2); // gzip
    expect(h.clustered).toBe(true);
    expect(h.minZoom).toBe(REEF_TILE_MINZOOM);
    expect(h.maxZoom).toBe(REEF_TILE_MAXZOOM);
    // Khung phải là khung của chính bộ nguồn — lệch khung là MapLibre bỏ qua ô
    // ngoài khung mà không báo gì.
    const [W, S, E, N] = source.properties.bbox;
    expect(h.minLon).toBeCloseTo(W, 5);
    expect(h.minLat).toBeCloseTo(S, 5);
    expect(h.maxLon).toBeCloseTo(E, 5);
    expect(h.maxLat).toBeCloseTo(N, 5);
  });

  it("khai báo lớp đúng tên và đúng dải zoom cho style bên app", async () => {
    const meta = (await archive.getMetadata()) as {
      vector_layers?: { id: string; minzoom: number; maxzoom: number }[];
    };
    const layer = meta.vector_layers?.find((l) => l.id === REEF_TILE_LAYER);
    expect(layer, `thiếu vector_layers "${REEF_TILE_LAYER}"`).toBeTruthy();
    expect(layer?.minzoom).toBe(REEF_TILE_MINZOOM);
    expect(layer?.maxzoom).toBe(REEF_TILE_MAXZOOM);
  });

  it("KHÔNG MẤT MỘT MẢNH NÀO ở mức nét đầy đủ", async () => {
    /*  Bất biến quan trọng nhất của cả việc này. Kỳ vọng dựng từ file .bin
        nguồn: mỗi mảnh phải xuất hiện ở ít nhất một ô z13. Đếm chứ không lấy
        mẫu — 88.839/88.840 vẫn là một vật cản không ai nhìn thấy.  */
    const seen = new Set<number>();
    for (const { x, y } of tilesTouchedAtMaxZoom()) {
      const layer = await layerAt(REEF_TILE_MAXZOOM, x, y);
      if (!layer) continue;
      for (let i = 0; i < layer.length; i++) seen.add(Number(layer.feature(i).properties.pid));
    }
    expect(seen.size).toBe(parts.parts);
  }, 120_000);

  it("toạ độ ở mức nét đầy đủ không xê dịch quá lưới ô", async () => {
    /*  Lấy mẫu các mảnh NẰM GỌN trong lòng ô (mảnh bị cắt biên có đỉnh mới sinh
        trên đường biên — so từng đỉnh với nguồn là so hai thứ khác nhau).
        Ngưỡng 2 m = một đơn vị lưới ô z13 (1,19 m) cộng chỗ hở làm tròn.  */
    const n = 2 ** REEF_TILE_MAXZOOM;
    const bounds = (x: number, y: number) => {
      const lat = (t: number) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * t) / n))) * 180) / Math.PI;
      return { w: (x / n) * 360 - 180, e: ((x + 1) / n) * 360 - 180, n: lat(y), s: lat(y + 1) };
    };
    let compared = 0;
    let worst = 0;
    for (const { x, y } of tilesTouchedAtMaxZoom().slice(0, 200)) {
      const layer = await layerAt(REEF_TILE_MAXZOOM, x, y);
      if (!layer) continue;
      const b = bounds(x, y);
      for (let i = 0; i < layer.length; i++) {
        const feat = layer.feature(i);
        const src = parts.features[Number(feat.properties.pid)].geometry.coordinates;
        const inside = src.every((r) => r.every(([px, py]) => px > b.w && px < b.e && py > b.s && py < b.n));
        if (!inside) continue;
        const gj = feat.toGeoJSON(x, y, REEF_TILE_MAXZOOM);
        if (gj.geometry.type !== "Polygon") continue;
        const got = gj.geometry.coordinates as Ring[];
        if (got.length !== src.length) continue;
        if (src.some((r, k) => r.length !== got[k].length)) continue;
        compared++;
        for (let r = 0; r < src.length; r++) worst = Math.max(worst, ringDeviationM(src[r], got[r]));
      }
    }
    // Mẫu rỗng thì mọi khẳng định phía dưới là lời hứa suông, nên soi luôn cỡ mẫu.
    expect(compared).toBeGreaterThan(500);
    expect(worst).toBeLessThan(2);
  }, 60_000);

  it("zoom thấp nhẹ hơn zoom sâu hàng trăm lần — lý do cả việc này tồn tại", async () => {
    /*  Nếu ô z6 nặng ngang ô z13 thì vector tile chỉ đang chia nhỏ đúng gánh
        nặng cũ. Đo trên cùng một chỗ (Trường Sa) qua các mức zoom.  */
    const n = (z: number) => 1 << z;
    const tx = (lon: number, z: number) => Math.floor(((lon + 180) / 360) * n(z));
    const ty = (lat: number, z: number) => {
      const r = (lat * Math.PI) / 180;
      return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n(z));
    };
    const vertsAt = async (z: number) => {
      const layer = await layerAt(z, tx(114.3, z), ty(9.7, z));
      if (!layer) return 0;
      let v = 0;
      for (let i = 0; i < layer.length; i++) {
        for (const ring of layer.feature(i).loadGeometry()) v += ring.length;
      }
      return v;
    };
    const z6 = await vertsAt(6);
    const z13 = await vertsAt(REEF_TILE_MAXZOOM);
    expect(z6).toBeGreaterThan(0); // có vẽ, không phải rỗng cho nhẹ
    expect(z13).toBeGreaterThan(0);
    // Một ô z6 phủ 2^14 lần diện tích một ô z13 mà chỉ được nặng hơn vài lần.
    expect(z6).toBeLessThan(z13 * 20);
  }, 30_000);
});

describe("scripts/reef-to-pmtiles — hai chỗ đã sai thật lúc dựng", () => {
  /*  Hai ca dưới đây không phải "test cho đủ": mỗi ca là một lỗi ĐÃ XẢY RA trong
      lúc làm, và cả hai đều thuộc loại KHÔNG BÁO LỖI — file vẫn ghi ra, cổng
      đếm vẫn xanh, chỉ có bản đồ là sai. Đúng loại phải có test canh.  */

  it("đi cây ô cắt nhánh theo 'không có dữ liệu', KHÔNG theo 'ô rỗng'", () => {
    /*  Bản đầu tiên dừng ở ô nào có `features.length === 0`. Với bộ rạn thật, ô
        z0 đúng là như vậy (mọi mảnh đều bé hơn một pixel ở z0) ⇒ cắt nhánh ngay
        từ gốc và sinh ra một kho RỖNG mà mọi cổng vẫn xanh.  */
    const tiny = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { kind: "reef", pid: 0 },
          geometry: {
            type: "Polygon",
            // ~200 m ở giữa Biển Đông: nhìn thấy ở z13, tan biến ở z0
            coordinates: [
              [
                [114.3, 9.7],
                [114.302, 9.7],
                [114.302, 9.702],
                [114.3, 9.702],
                [114.3, 9.7],
              ],
            ],
          },
        },
      ],
    };
    const idx = new GeoJSONVT(tiny as never, {
      maxZoom: 13,
      indexMaxZoom: 5,
      indexMaxPoints: 100_000,
      tolerance: 8,
      extent: 4096,
      buffer: 64,
    });
    expect(idx.getTile(0, 0, 0)?.features.length).toBe(0); // ô gốc RỖNG mà vẫn có dữ liệu
    const hit: number[] = [];
    walkTiles(idx, 3, 13, (z: number) => hit.push(z));
    expect(hit).toContain(13); // vẫn xuống được tới mức nét đầy đủ
  });

  it("so hai vòng bỏ qua phép xoay và đảo chiều của bước mã hoá MVT", () => {
    /*  Vòng ra khỏi bước cắt ô có thể vừa đảo chiều vừa đổi đỉnh bắt đầu (mảnh
        88.596 của bộ thật). So thẳng theo chỉ số thì báo lệch hàng trăm mét
        trong khi hình không xê dịch một li — và một cổng báo động giả thì sớm
        muộn cũng bị tắt đi.  */
    const ring: [number, number][] = [
      [114.3, 9.7],
      [114.31, 9.7],
      [114.31, 9.71],
      [114.3, 9.71],
      [114.3, 9.7],
    ];
    const open = ring.slice(0, 4);
    const rotatedReversed = [...open.slice(2).reverse(), ...open.slice(0, 2).reverse()];
    const closed = [...rotatedReversed, rotatedReversed[0]] as [number, number][];
    expect(ringDeviationM(ring, closed)).toBeLessThan(0.001);

    // ...nhưng một đỉnh xê dịch thật thì vẫn phải bắt được
    const moved = closed.map((p, i) => (i === 1 ? [p[0] + 0.001, p[1]] : p)) as [number, number][];
    expect(ringDeviationM(ring, moved)).toBeGreaterThan(50);
  });
});

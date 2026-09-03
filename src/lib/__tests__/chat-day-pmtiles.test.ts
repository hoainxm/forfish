/**
 * LỚP CHẤT ĐÁY DẠNG VECTOR TILE — cổng nghiệm thu trên FILE THẬT.
 *
 * `public/data/chat-day.v1.pmtiles` do `scripts/chat-day-to-pmtiles.mjs` cắt
 * ra từ `public/data/chat-day.v1.json` (362.743 điểm) — cùng lý do đã trả giá
 * ở lớp rạn (`reef-pmtiles.test.ts`): một FeatureCollection lớn nhồi thẳng vào
 * MapLibre kiểu `type: "geojson"` bắt máy khách tự cắt ô, máy yếu chết trước
 * khi vẽ được chấm đầu tiên.
 *
 * Khác lớp rạn (đa giác — mảnh có thể bị CẮT BIÊN ô), một ĐIỂM chỉ có MỘT toạ
 * độ nên không có khái niệm "cắt biên" — nhưng geojson-vt NHÂN ĐÔI điểm sát mép
 * ô vào dải `buffer` của ô liền kề để vẽ liền mạch, nên "không mất điểm" phải
 * đếm bằng ĐỊNH DANH nguồn (khớp toạ độ về đúng điểm nguồn), không phải cộng
 * thẳng số feature trên từng ô — cùng bài học `scripts/chat-day-to-pmtiles.mjs`
 * đã dính lúc build (386.782 "điểm vẽ" cho 362.743 điểm nguồn).
 *
 * Bộ test này KHÔNG tin số liệu script tự ghi vào metadata — dựng lại kỳ vọng
 * TỪ FILE JSON NGUỒN rồi soi vào file .pmtiles ĐÃ PHÁT HÀNH, đọc bằng ĐÚNG gói
 * `pmtiles` mà `src/lib/pmtiles-protocol.ts` đăng ký cho MapLibre.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { PMTiles } from "pmtiles";
import { VectorTile } from "@mapbox/vector-tile";
import Pbf from "pbf";
import { bufferSource } from "../../../scripts/reef-to-pmtiles.mjs";
import {
  CHATDAY_TILE_LAYER,
  CHATDAY_TILE_MINZOOM,
  CHATDAY_TILE_MAXZOOM,
  pointsToFeatures,
} from "../../../scripts/chat-day-to-pmtiles.mjs";
import type { ChatDayFile } from "@/lib/chat-day";

const PMT_FILE = path.join(process.cwd(), "public/data/chat-day.v1.pmtiles");
const JSON_FILE = path.join(process.cwd(), "public/data/chat-day.v1.json");
const CO_FILE = existsSync(PMT_FILE) && existsSync(JSON_FILE);

if (CO_FILE) {
  const archive = new PMTiles(bufferSource(readFileSync(PMT_FILE), PMT_FILE));
  const raw = JSON.parse(readFileSync(JSON_FILE, "utf8")) as ChatDayFile;
  const features = pointsToFeatures(raw) as unknown as {
    properties: { ma: string; tyLe: number; soManh: number };
    geometry: { type: "Point"; coordinates: [number, number] };
  }[];

  /** Ô slippy-tile chứa một toạ độ ở zoom z (Web Mercator chuẩn). */
  function tileXY(lon: number, lat: number, z: number) {
    const n = 2 ** z;
    const x = Math.min(n - 1, Math.max(0, Math.floor(((lon + 180) / 360) * n)));
    const r = (lat * Math.PI) / 180;
    const t = (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2;
    const y = Math.min(n - 1, Math.max(0, Math.floor(t * n)));
    return { x, y };
  }

  const R_EARTH_M = 6_371_008.8;
  const rad = (d: number) => (d * Math.PI) / 180;
  function degToM(aLon: number, aLat: number, bLon: number, bLat: number) {
    const dLat = rad(bLat - aLat);
    const dLon = rad(bLon - aLon);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
    return 2 * R_EARTH_M * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  /** "Ô nhà" của từng điểm nguồn ở mức nét đầy đủ — mọi điểm PHẢI có mặt ở đây
   *  (điểm cũng có thể xuất hiện THÊM ở ô liền kề qua dải buffer — không sao,
   *  đó là chủ đích, không phải lỗi). */
  const homeTiles = new Map<string, { x: number; y: number }>();
  for (const f of features) {
    const [lon, lat] = f.geometry.coordinates;
    const { x, y } = tileXY(lon, lat, CHATDAY_TILE_MAXZOOM);
    homeTiles.set(`${x},${y}`, { x, y });
  }

  const keyOf = (lon: number, lat: number) => `${Math.round(lon * 10000)},${Math.round(lat * 10000)}`;
  const bySourceKey = new Map<string, (typeof features)[number]>();
  for (const f of features) bySourceKey.set(keyOf(...f.geometry.coordinates), f);

  async function layerAt(z: number, x: number, y: number) {
    const r = await archive.getZxy(z, x, y);
    if (!r) return undefined;
    return new VectorTile(new Pbf(new Uint8Array(r.data))).layers[CHATDAY_TILE_LAYER];
  }

  describe("chat-day.v1.pmtiles — kho vector tile lớp chất đáy", () => {
    it("mở được bằng đúng gói pmtiles app đăng ký cho MapLibre", async () => {
      const h = await archive.getHeader();
      expect(h.specVersion).toBe(3);
      expect(h.tileType).toBe(1); // MVT
      expect(h.tileCompression).toBe(2); // gzip
      expect(h.clustered).toBe(true);
      expect(h.minZoom).toBe(CHATDAY_TILE_MINZOOM);
      expect(h.maxZoom).toBe(CHATDAY_TILE_MAXZOOM);
    });

    it("khai báo lớp đúng tên, đúng field, đúng dải zoom cho style bên app", async () => {
      const meta = (await archive.getMetadata()) as {
        vector_layers?: { id: string; fields: Record<string, string>; minzoom: number; maxzoom: number }[];
      };
      const layer = meta.vector_layers?.find((l) => l.id === CHATDAY_TILE_LAYER);
      expect(layer, `thiếu vector_layers "${CHATDAY_TILE_LAYER}"`).toBeTruthy();
      expect(layer?.minzoom).toBe(CHATDAY_TILE_MINZOOM);
      expect(layer?.maxzoom).toBe(CHATDAY_TILE_MAXZOOM);
      // Tên + kiểu CHÍNH XÁC từng property key — đây là hợp đồng Lead đọc bằng
      // queryRenderedFeatures, sai một chữ là màn tap-xem đọc ra `undefined`.
      expect(layer?.fields).toEqual({ ma: "String", tyLe: "Number", soManh: "Number" });
    });

    it(
      "KHÔNG MẤT MỘT ĐIỂM NÀO ở mức nét đầy đủ — đếm theo ĐỊNH DANH nguồn, không phải theo feature",
      async () => {
        const matched = new Set<string>();
        let maxDevM = 0;
        for (const { x, y } of homeTiles.values()) {
          const layer = await layerAt(CHATDAY_TILE_MAXZOOM, x, y);
          if (!layer) continue;
          for (let i = 0; i < layer.length; i++) {
            const feat = layer.feature(i);
            const gj = feat.toGeoJSON(x, y, CHATDAY_TILE_MAXZOOM);
            if (gj.geometry.type !== "Point") continue;
            const [glon, glat] = gj.geometry.coordinates as [number, number];
            const gx = Math.round(glon * 10000);
            const gy = Math.round(glat * 10000);
            let bestKey: string | null = null;
            let best = Infinity;
            for (let dx = -1; dx <= 1; dx++) {
              for (let dy = -1; dy <= 1; dy++) {
                const k = `${gx + dx},${gy + dy}`;
                const cand = bySourceKey.get(k);
                if (!cand) continue;
                const d = degToM(cand.geometry.coordinates[0], cand.geometry.coordinates[1], glon, glat);
                if (d < best) {
                  best = d;
                  bestKey = k;
                }
              }
            }
            if (bestKey !== null) {
              matched.add(bestKey);
              maxDevM = Math.max(maxDevM, best);
            }
          }
        }
        expect(matched.size).toBe(raw.points.length);
        // Lệch tối đa phải nhỏ hơn cạnh ô lưới NGUỒN (111 m) — đây là trần rất
        // rộng rãi (script sinh dùng trần chặt hơn, 6 m); test độc lập chỉ cần
        // bắt được lỗi HỆ THỐNG (sai đơn vị/scale), không lặp lại đúng số của script.
        expect(maxDevM).toBeLessThan(111);
      },
      120_000,
    );

    it("thuộc tính đọc lại ĐÚNG GIÁ TRỊ nguồn, không chỉ đúng kiểu — mẫu 500 điểm", async () => {
      let checked = 0;
      let mismatches = 0;
      for (const { x, y } of [...homeTiles.values()].slice(0, 50)) {
        const layer = await layerAt(CHATDAY_TILE_MAXZOOM, x, y);
        if (!layer) continue;
        for (let i = 0; i < layer.length && checked < 500; i++) {
          const feat = layer.feature(i);
          const gj = feat.toGeoJSON(x, y, CHATDAY_TILE_MAXZOOM);
          if (gj.geometry.type !== "Point") continue;
          const [glon, glat] = gj.geometry.coordinates as [number, number];
          const src = bySourceKey.get(keyOf(glon, glat));
          if (!src) continue;
          checked++;
          const p = feat.properties as { ma: string; tyLe: number; soManh: number };
          if (p.ma !== src.properties.ma || p.tyLe !== src.properties.tyLe || p.soManh !== src.properties.soManh) {
            mismatches++;
          }
        }
        if (checked >= 500) break;
      }
      expect(checked).toBeGreaterThan(100);
      expect(mismatches).toBe(0);
    });

    it("một ô ở MINZOOM tải được với dung lượng hợp lý (bà con phóng to là đủ nhẹ)", async () => {
      // Không kỳ vọng z-thấp nhẹ hơn z-cao NHIỀU LẦN như lớp rạn: geojson-vt
      // không rút bớt ĐIỂM theo zoom (không có "đỉnh" để giản lược như đa
      // giác) — cái PMTiles cho lớp điểm là NẠP THEO VÙNG ĐANG XEM (vài ô,
      // không phải cả 362K điểm), không phải "zoom thấp tự nhiên nhẹ hơn".
      // Nên cổng đúng ở đây là: MỘT ô đơn lẻ vẫn đủ nhẹ để tải qua sóng yếu.
      // Trường Sa (114,3°Đ / 9,7°B) — vùng ĐẬM điểm nhất trong bộ (139.529
      // điểm ở dải 6-9°N), nên đây là ca XẤU NHẤT chứ không phải ca dễ.
      const { x, y } = tileXY(114.3, 9.7, CHATDAY_TILE_MINZOOM);
      const r = await archive.getZxy(CHATDAY_TILE_MINZOOM, x, y);
      expect(r).toBeTruthy();
      if (r) expect(r.data.byteLength).toBeLessThan(2 * 1024 * 1024);
    });
  });
} else {
  describe.skip("chat-day.v1.pmtiles — file chưa sinh (chạy scripts/chat-day-to-pmtiles.mjs trước)", () => {
    it("bỏ qua", () => {});
  });
}

/*  CỔNG CHỐNG "sinh-mà-không-nối" (bệnh tái phát 4 lần trong dự án: lớp độ sâu ·
    bộ ký hiệu · kết quả đối chiếu · lớp báo hiệu). Soi MÃ NGUỒN — chạy kể cả khi
    chưa có file .pmtiles — để một lớp chất đáy có dữ liệu nhưng không được vẽ /
    không bắt chạm / không cache offline sẽ ĐỎ ngay, không chờ ai phát hiện bằng
    mắt. Cùng khuôn với den-bien.test.ts. */
describe("chất đáy — nối đủ ba phần vào app (không mồ côi)", () => {
  const doc = (p: string) => readFileSync(path.join(process.cwd(), p), "utf8");

  it("component VẼ lớp chất đáy (source-layer + url pmtiles)", () => {
    const v = doc("src/components/fishing-map-view.tsx");
    expect(v, "chưa dùng CHAT_DAY_PMTILES_URL").toContain("CHAT_DAY_PMTILES_URL");
    expect(v, "chưa vẽ source-layer chat-day").toContain('source-layer="chat-day"');
  });

  it("lớp chất đáy vào danh sách BẮT CHẠM (tap-xem loại đáy)", () => {
    const v = doc("src/components/fishing-map-view.tsx");
    expect(v, "chưa bắt chạm chat-day-dot").toContain('ids.push("chat-day-dot")');
  });

  it("pmtiles chất đáy nằm trong PMTILES_ARCHIVES của sw.js (offline)", () => {
    const sw = doc("public/sw.js");
    const m = sw.match(/const PMTILES_ARCHIVES = \[([\s\S]*?)\];/);
    expect(m, "sw.js phải có PMTILES_ARCHIVES").toBeTruthy();
    expect(m![1], "chat-day.v1.pmtiles chưa được cache offline").toContain(
      "/data/chat-day.v1.pmtiles",
    );
  });
});

// CHẤT ĐÁY → VECTOR TILE (PMTiles v3):
//
//   node scripts/chat-day-to-pmtiles.mjs
//
// Đọc : public/data/chat-day.v1.json      (362.743 điểm, xem generate-chat-day.mjs)
// Ghi : public/data/chat-day.v1.pmtiles   (MVT điểm, gzip từng ô, z9–z12)
//
// ═══ VÌ SAO ════════════════════════════════════════════════════════════════
// Bài học đã trả giá ở lớp rạn (xem reef-to-pmtiles.mjs): nhồi thẳng một
// FeatureCollection lớn vào MapLibre kiểu `type: "geojson"` bắt máy khách tự
// dựng chỉ mục + tự cắt ô ở MỌI zoom — máy yếu của bà con bị hệ điều hành giết
// tab trước khi thấy chấm chất đáy đầu tiên. 362.743 điểm × ~5 thuộc tính là
// đúng quy mô sẽ lặp lại lỗi đó. Cắt sẵn LÚC BUILD, máy chỉ tải đúng vài ô
// đang nhìn.
//
// ═══ CÙNG PIPELINE LỚP RẠN, KHÔNG THÊM DEPENDENCY ═════════════════════════
// `walkTiles` + `bufferSource` từ `reef-to-pmtiles.mjs` là hàm THUẦN (không
// dính hình học rạn) — import lại nguyên, không chép (nguyên tắc 15 bậc 3:
// grep trùng nghĩa thì dùng lại). Import một script khác KHÔNG chạy khối
// `if (isMain)` của nó (đã kiểm bằng chính cách `reef-pmtiles.test.ts` đang
// làm) nên an toàn, không tải lại `reef-shapes-aca.v1.bin`.
//
// Phần ĐÓNG GÓI PMTiles v3 (header 127 byte + mục lục varint) ở
// `reef-to-pmtiles.mjs` là hàm RIÊNG (không export) — đây là bộ mã hoá viết
// tay theo đúng spec nhị phân cố định, không phải logic nghiệp vụ sẽ trôi
// theo thời gian, nên chép lại ~90 dòng ở đây rẻ hơn và an toàn hơn sửa một
// file KHÔNG thuộc phạm vi việc này (đang có việc khác chạm reef-shapes song
// song) chỉ để export thêm 4 hàm cho MỘT người gọi thứ hai.
//
// ═══ ĐIỂM, KHÔNG PHẢI ĐA GIÁC — ĐƠN GIẢN HƠN LỚP RẠN ═══════════════════════
// Không cần `explodeParts` (mỗi điểm nguồn đã là MỘT feature nguyên tử, không
// có khái niệm "mảnh của một cụm"). Không cần so lệch VÒNG (ringDeviationM) —
// một điểm chỉ có MỘT toạ độ, so lệch trực tiếp.
//
// ═══ THUỘC TÍNH NHÚNG THẲNG VÀO TILE (Lead đọc bằng queryRenderedFeatures,
// KHÔNG cần tải lại 9 MB JSON) ═══════════════════════════════════════════
//   source-layer: "chat-day"
//   ma      String  — mã chất đáy ĐÃ GIẢI ("S"|"R"|"Co"|"G"|"Sg"|"Ma"|"khac"),
//                     không phải số index — Lead đọc thẳng không cần bảng tra
//   tyLe    Number  — % diện tích loại thắng trong ô nguồn (độ THUẦN, 0-100)
//   soManh  Number  — số mảnh ACA gộp vào ô nguồn (độ dày mẫu)
//
// ═══ ZOOM: LỚP CHI TIẾT, KHÔNG HIỆN Ở TOÀN CẢNH ═══════════════════════════
// Chủ dự án/Lead chốt: chất đáy không cần thấy ở z4-8 (toàn cảnh Biển Đông,
// tất cả 362K điểm dồn vào vài ô gây nặng + rối mắt vô ích — bà con phóng to
// đúng nơi định thả neo mới cần chấm chất đáy). MINZOOM=9 cắt sạch dải đó.
// MAXZOOM=12: đo thật bên dưới — độ chính xác NGUỒN chỉ tới mức ô lưới gom
// 0,001° (≈111 m, làm tròn 4 số thập phân ≈11 m, xem generate-chat-day.mjs) —
// khác lớp rạn (nguồn tới 1,1 m nên cần z13). Lưới MVT ở z12 ≈ 4,7 m/đơn vị,
// đã MỊN HƠN sai số làm tròn nguồn (11 m) — thêm z13 chỉ là số thập phân
// không có thật (đúng lý do reef-to-pmtiles.mjs bỏ z14).

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { gzipSync, gunzipSync } from "node:zlib";
import { GeoJSONVT } from "@maplibre/geojson-vt";
import { fromGeojsonVt } from "@maplibre/vt-pbf";
import { VectorTile } from "@mapbox/vector-tile";
import Pbf from "pbf";
import { PMTiles, zxyToTileId } from "pmtiles";
import { walkTiles, bufferSource } from "./reef-to-pmtiles.mjs";

const SRC = "public/data/chat-day.v1.json";
const OUT = "public/data/chat-day.v1.pmtiles";

/** Tên lớp bên trong ô — style bên app trỏ vào bằng `source-layer`. */
export const CHATDAY_TILE_LAYER = "chat-day";
/** Dưới z9 KHÔNG cắt ô — lớp chi tiết, không cần hiện ở toàn cảnh (xem trên). */
export const CHATDAY_TILE_MINZOOM = 9;
/** z12 = mịn hơn sai số làm tròn của nguồn (11 m) — xem giải thích ở đầu file. */
export const CHATDAY_TILE_MAXZOOM = 12;
const EXTENT = 4096;
/** Điểm không bị Douglas-Peucker giản lược (không có cạnh để giản lược) —
 *  ngưỡng này chỉ ảnh hưởng chỉ mục nội bộ của geojson-vt, giữ mặc định. */
const TOLERANCE = 3;
/** Trần một file trong public/data — cùng con số hook đang chặn. */
const FILE_MAX = 20 * 1024 * 1024;
/** Trần độ lệch toạ độ ở mức nét đầy đủ — một đơn vị lưới z12 (≈4,7 m) cộng
 *  chỗ hở làm tròn. Vượt nghĩa là lưới ô đang thô hơn chính nguồn. */
const MAX_DEV_M = 6;

const isMain = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;

// ── PMTiles v3: ghi mục lục — CHÉP TỪ reef-to-pmtiles.mjs (spec cố định,
// KHÔNG phải logic nghiệp vụ, xem giải thích ở đầu file) ───────────────────

/** Varint LEB128. `% 128` chứ không `& 0x7f` — xem lý do trong reef-to-pmtiles.mjs. */
function putVarint(out, v) {
  let n = v;
  while (n >= 128) {
    out.push((n % 128) + 128);
    n = Math.floor(n / 128);
  }
  out.push(n);
}

function serializeDirectory(entries) {
  const out = [];
  putVarint(out, entries.length);
  let last = 0;
  for (const e of entries) {
    putVarint(out, e.tileId - last);
    last = e.tileId;
  }
  for (const e of entries) putVarint(out, e.runLength);
  for (const e of entries) putVarint(out, e.length);
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const prev = entries[i - 1];
    if (i > 0 && e.offset === prev.offset + prev.length) putVarint(out, 0);
    else putVarint(out, e.offset + 1);
  }
  return gzipSync(Uint8Array.from(out));
}

const ROOT_MAX = 16384 - 127;

function buildDirectories(entries) {
  const whole = serializeDirectory(entries);
  if (whole.length <= ROOT_MAX) {
    return { root: whole, leaves: new Uint8Array(0), numLeaves: 0 };
  }
  for (let leafSize = 4096; leafSize <= 1 << 22; leafSize *= 2) {
    const leafBlobs = [];
    const rootEntries = [];
    let at = 0;
    for (let i = 0; i < entries.length; i += leafSize) {
      const chunk = entries.slice(i, i + leafSize);
      const blob = serializeDirectory(chunk);
      leafBlobs.push(blob);
      rootEntries.push({ tileId: chunk[0].tileId, offset: at, length: blob.length, runLength: 0 });
      at += blob.length;
    }
    const root = serializeDirectory(rootEntries);
    if (root.length > ROOT_MAX) continue;
    const leaves = new Uint8Array(at);
    let p = 0;
    for (const b of leafBlobs) {
      leaves.set(b, p);
      p += b.length;
    }
    return { root, leaves, numLeaves: leafBlobs.length };
  }
  throw new Error("pmtiles: không chia nổi mục lục gốc xuống dưới 16 KB");
}

function buildPmtiles(spec) {
  const sorted = spec.tiles
    .map((t) => ({ ...t, tileId: zxyToTileId(t.z, t.x, t.y) }))
    .sort((a, b) => a.tileId - b.tileId);

  const entries = [];
  const blobs = [];
  const seen = new Map();
  let dataLen = 0;
  for (const t of sorted) {
    const key = Buffer.from(t.data).toString("base64");
    const hit = seen.get(key);
    if (hit) {
      entries.push({ tileId: t.tileId, offset: hit.offset, length: hit.length, runLength: 1 });
      continue;
    }
    const offset = dataLen;
    blobs.push(t.data);
    dataLen += t.data.length;
    seen.set(key, { offset, length: t.data.length });
    entries.push({ tileId: t.tileId, offset, length: t.data.length, runLength: 1 });
  }

  const { root, leaves, numLeaves } = buildDirectories(entries);
  const meta = gzipSync(Buffer.from(JSON.stringify(spec.metadata), "utf8"));

  const rootOff = 127;
  const metaOff = rootOff + root.length;
  const leafOff = metaOff + meta.length;
  const dataOff = leafOff + leaves.length;

  const header = new Uint8Array(127);
  const v = new DataView(header.buffer);
  header.set([0x50, 0x4d, 0x54, 0x69, 0x6c, 0x65, 0x73], 0); // "PMTiles"
  v.setUint8(7, 3);
  const u64 = (o, n) => v.setBigUint64(o, BigInt(n), true);
  u64(8, rootOff);
  u64(16, root.length);
  u64(24, metaOff);
  u64(32, meta.length);
  u64(40, leafOff);
  u64(48, leaves.length);
  u64(56, dataOff);
  u64(64, dataLen);
  u64(72, entries.length);
  u64(80, entries.length);
  u64(88, blobs.length);
  v.setUint8(96, 1); // clustered
  v.setUint8(97, 2); // mục lục nén gzip
  v.setUint8(98, 2); // ô nén gzip
  v.setUint8(99, 1); // kiểu ô = MVT
  v.setUint8(100, spec.minZoom);
  v.setUint8(101, spec.maxZoom);
  const e7 = (o, deg) => v.setInt32(o, Math.round(deg * 1e7), true);
  e7(102, spec.bbox[0]);
  e7(106, spec.bbox[1]);
  e7(110, spec.bbox[2]);
  e7(114, spec.bbox[3]);
  v.setUint8(118, spec.centerZoom);
  e7(119, (spec.bbox[0] + spec.bbox[2]) / 2);
  e7(123, (spec.bbox[1] + spec.bbox[3]) / 2);

  const file = new Uint8Array(dataOff + dataLen);
  file.set(header, 0);
  file.set(root, rootOff);
  file.set(meta, metaOff);
  file.set(leaves, leafOff);
  let p = dataOff;
  for (const b of blobs) {
    file.set(b, p);
    p += b.length;
  }
  return { file, entries: entries.length, contents: blobs.length, numLeaves, dataLen };
}

// ── Nguồn → GeoJSON điểm ────────────────────────────────────────────────────

/**
 * `chat-day.v1.json` → mảng Feature điểm cho geojson-vt.
 *
 * `ma` giải THẲNG ra chuỗi (không giữ index) — đúng yêu cầu Lead đọc được từ
 * `queryRenderedFeatures` mà không cần tải bảng `codes` riêng. Mã lạ/ngoài
 * bảng rơi về "khac" — CÙNG luật với `decodeChatDay` (src/lib/chat-day.ts),
 * không phải một luật khác cho tile.
 * @param {{codes:string[], points:number[][]}} file
 */
export function pointsToFeatures(file) {
  const MA_HOP_LE = new Set(["S", "R", "Co", "G", "Sg", "Ma", "khac"]);
  const out = [];
  for (const row of file.points) {
    const [lon, lat, idx, tyLe, soManh] = row;
    const raw = file.codes[idx];
    const ma = MA_HOP_LE.has(raw) ? raw : "khac";
    out.push({
      type: "Feature",
      properties: { ma, tyLe, soManh },
      geometry: { type: "Point", coordinates: [lon, lat] },
    });
  }
  return out;
}

// ── Chạy ───────────────────────────────────────────────────────────────────

if (isMain) {
  if (!existsSync(SRC)) {
    throw new Error(`Thiếu ${SRC} — chạy scripts/generate-chat-day.mjs trước.`);
  }
  const t0 = Date.now();
  const raw = JSON.parse(readFileSync(SRC, "utf8"));
  const features = pointsToFeatures(raw);
  console.log(`Nguồn ${SRC}: ${raw.points.length.toLocaleString("vi-VN")} điểm`);

  const idx = new GeoJSONVT(
    { type: "FeatureCollection", features },
    {
      maxZoom: CHATDAY_TILE_MAXZOOM,
      indexMaxZoom: 5,
      indexMaxPoints: 100000,
      tolerance: TOLERANCE,
      extent: EXTENT,
      buffer: 64,
    },
  );
  console.log(`Chỉ mục cắt ô: ${((Date.now() - t0) / 1000).toFixed(1)} s`);

  const tiles = [];
  const perZoom = {};
  walkTiles(idx, CHATDAY_TILE_MINZOOM, CHATDAY_TILE_MAXZOOM, (z, x, y, tile) => {
    const data = gzipSync(fromGeojsonVt({ [CHATDAY_TILE_LAYER]: tile }, { extent: EXTENT }));
    tiles.push({ z, x, y, data });
    const s = (perZoom[z] ??= { tiles: 0, bytes: 0, feats: 0 });
    s.tiles++;
    s.bytes += data.length;
    s.feats += tile.features.length;
  });
  console.log(`Cắt xong: ${tiles.length.toLocaleString("vi-VN")} ô · ${((Date.now() - t0) / 1000).toFixed(1)} s`);

  // ── (a) KHÔNG MẤT MỘT ĐIỂM NÀO ở mức nét đầy đủ ────────────────────────
  // Điểm khác đa giác: MỘT toạ độ chỉ thuộc ĐÚNG MỘT ô ở bất kỳ zoom nào (không
  // có chuyện bị "cắt biên" như một cạnh đa giác), nên bất biến đơn giản hơn
  // hẳn reef-to-pmtiles.mjs — KHÔNG cần theo dõi pid: tổng feature trên mọi ô
  // z=maxzoom PHẢI đúng bằng tổng điểm nguồn, không hơn không kém.
  let maxDevM = 0;
  const R_EARTH_M = 6_371_008.8;
  const rad = (d) => (d * Math.PI) / 180;
  const degToM = (aLon, aLat, bLon, bLat) => {
    const dLat = rad(bLat - aLat);
    const dLon = rad(bLon - aLon);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
    return 2 * R_EARTH_M * Math.asin(Math.min(1, Math.sqrt(h)));
  };
  // Tra O(1) thay vì quét tuyến tính 362K điểm cho MỖI feature (hàng tỷ phép
  // so nếu làm ngây thơ). Nguồn nằm ĐÚNG tâm lưới 0,001° (xem
  // generate-chat-day.mjs) nên khoá theo 1e-4 độ (1/10 cạnh ô) là duy nhất cho
  // mỗi điểm; dò 3×3 ô lân cận đủ bắt điểm sau khi bị lệch bởi lượng tử hoá MVT
  // (trần lệch MAX_DEV_M ≈ 6 m ≪ cạnh ô lưới nguồn 111 m).
  const keyOf = (lon, lat) => `${Math.round(lon * 10000)},${Math.round(lat * 10000)}`;
  const bySourceKey = new Map();
  for (const f of features) bySourceKey.set(keyOf(...f.geometry.coordinates), f);

  // Đếm bằng SET các điểm NGUỒN đã khớp được, KHÔNG cộng dồn số feature từng
  // ô: geojson-vt nhân đôi feature nằm trong dải `buffer` (64 đơn vị) sang ô
  // liền kề để vẽ liền mạch qua biên — đếm thẳng ra 386.782 cho 362.743 điểm
  // nguồn (đã dính thật lúc viết). Điểm ở biên xuất hiện ở ≥2 ô là ĐÚNG Ý ĐỒ
  // (không phải lỗi trùng), nên phải quy về ĐỊNH DANH nguồn rồi mới đếm — cùng
  // lý do reef-to-pmtiles.mjs đếm bằng `Set<pid>` chứ không cộng `layer.length`.
  const matched = new Set();
  for (const t of tiles) {
    if (t.z !== CHATDAY_TILE_MAXZOOM) continue;
    const layer = new VectorTile(new Pbf(gunzipSync(t.data))).layers[CHATDAY_TILE_LAYER];
    if (!layer) continue;
    for (let i = 0; i < layer.length; i++) {
      const feat = layer.feature(i);
      const gj = feat.toGeoJSON(t.x, t.y, t.z);
      if (gj.geometry.type !== "Point") continue;
      const [glon, glat] = gj.geometry.coordinates;
      const gx = Math.round(glon * 10000);
      const gy = Math.round(glat * 10000);
      let bestKey = null;
      let best = Infinity;
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const k = `${gx + dx},${gy + dy}`;
          const cand = bySourceKey.get(k);
          if (!cand) continue;
          const [slon, slat] = cand.geometry.coordinates;
          const d = degToM(slon, slat, glon, glat);
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
  const atMaxZoom = matched.size;
  if (atMaxZoom !== raw.points.length) {
    throw new Error(
      `CHẶN (a): z${CHATDAY_TILE_MAXZOOM} khớp được ${atMaxZoom.toLocaleString("vi-VN")} điểm nguồn, ` +
        `nguồn có ${raw.points.length.toLocaleString("vi-VN")}. Mất điểm là sai chất đáy ngoài biển.`,
    );
  }
  if (maxDevM > MAX_DEV_M) {
    throw new Error(
      `CHẶN (b): điểm lệch tới ${maxDevM.toFixed(2)} m so với nguồn (trần ${MAX_DEV_M} m).`,
    );
  }
  console.log(
    `Soi lại ô z${CHATDAY_TILE_MAXZOOM}: ${atMaxZoom.toLocaleString("vi-VN")}/${raw.points.length.toLocaleString("vi-VN")} điểm khớp · ` +
      `lệch tối đa ${maxDevM.toFixed(2)} m`,
  );

  const built = buildPmtiles({
    tiles,
    metadata: {
      name: "SDFish · chất đáy vùng rạn/đảo (Allen Coral Atlas)",
      description:
        "Chất đáy (cát/đá/san hô/vụn/cỏ biển) vùng RẠN/ĐẢO biển Việt Nam — " +
        "KHÔNG phủ đáy bùn/cát cửa sông ven bờ. Cắt sẵn thành vector tile bởi " +
        "scripts/chat-day-to-pmtiles.mjs từ public/data/chat-day.v1.json.",
      attribution: "Allen Coral Atlas (CC BY 4.0)",
      version: "1",
      vector_layers: [
        {
          id: CHATDAY_TILE_LAYER,
          description: "Điểm chất đáy — ma (mã), tyLe (% thuần), soManh (số mảnh gộp)",
          fields: { ma: "String", tyLe: "Number", soManh: "Number" },
          minzoom: CHATDAY_TILE_MINZOOM,
          maxzoom: CHATDAY_TILE_MAXZOOM,
        },
      ],
      sdfish: {
        source: SRC,
        sourcePoints: raw.points.length,
        extent: EXTENT,
        codes: raw.codes,
      },
    },
    minZoom: CHATDAY_TILE_MINZOOM,
    maxZoom: CHATDAY_TILE_MAXZOOM,
    bbox: [102.0, 4.0, 118.0, 24.0],
    centerZoom: 10,
  });

  console.log(
    `\n${OUT}\n` +
      `  ${(built.file.length / 1e6).toFixed(2)} MB · ${built.entries.toLocaleString("vi-VN")} ô · ` +
      `${built.contents.toLocaleString("vi-VN")} ô khác nhau · ${built.numLeaves} mục lục lá\n` +
      `  z${CHATDAY_TILE_MINZOOM}–z${CHATDAY_TILE_MAXZOOM} · lớp "${CHATDAY_TILE_LAYER}" · ` +
      `${atMaxZoom.toLocaleString("vi-VN")}/${raw.points.length.toLocaleString("vi-VN")} điểm có mặt ở z${CHATDAY_TILE_MAXZOOM}\n` +
      `  ${((Date.now() - t0) / 1000).toFixed(1)} s`,
  );
  console.log("\n  zoom │    ô │   dung lượng │ điểm vẽ (tổng)");
  for (const z of Object.keys(perZoom).map(Number).sort((a, b) => a - b)) {
    const s = perZoom[z];
    console.log(
      `  z${String(z).padStart(2)}  │ ${String(s.tiles).padStart(5)} │ ` +
        `${(s.bytes / 1e6).toFixed(2).padStart(8)} MB │ ${s.feats.toLocaleString("vi-VN").padStart(11)}`,
    );
  }

  // ── (c) TRẦN 20 MB/FILE ──────────────────────────────────────────────────
  if (built.file.length > FILE_MAX) {
    throw new Error(
      `CHẶN (c): ${(built.file.length / 1e6).toFixed(1)} MB vượt trần 20 MB/file.\n` +
        `KHÔNG tự hạ độ nét và KHÔNG tự nới trần — báo Lead kèm số đo này.`,
    );
  }

  writeFileSync(OUT, built.file);

  // ── (d) ĐỌC LẠI BẰNG CHÍNH BỘ ĐỌC APP SẼ DÙNG ────────────────────────────
  const back = new PMTiles(bufferSource(readFileSync(OUT), OUT));
  const backHeader = await back.getHeader();
  if (backHeader.minZoom !== CHATDAY_TILE_MINZOOM || backHeader.maxZoom !== CHATDAY_TILE_MAXZOOM) {
    throw new Error(`CHẶN (d): đọc lại ra zoom ${backHeader.minZoom}–${backHeader.maxZoom}`);
  }
  const probe = tiles.find((t) => t.z === CHATDAY_TILE_MAXZOOM);
  const got = await back.getZxy(probe.z, probe.x, probe.y);
  if (!got) throw new Error(`CHẶN (d): đọc lại không thấy ô z${probe.z}/${probe.x}/${probe.y}`);
  const backLayer = new VectorTile(new Pbf(new Uint8Array(got.data))).layers[CHATDAY_TILE_LAYER];
  if (!backLayer?.length) throw new Error(`CHẶN (d): ô đọc lại không có lớp "${CHATDAY_TILE_LAYER}"`);
  const sample = backLayer.feature(0).properties;
  if (typeof sample.ma !== "string" || typeof sample.tyLe !== "number" || typeof sample.soManh !== "number") {
    throw new Error(`CHẶN (d): thuộc tính đọc lại sai kiểu — ${JSON.stringify(sample)}`);
  }

  console.log(
    `\nĐã ghi ${OUT}. Đọc lại bằng gói pmtiles: z${backHeader.minZoom}–z${backHeader.maxZoom}, ` +
      `ô mẫu z${probe.z}/${probe.x}/${probe.y} có ${backLayer.length} feature, ` +
      `mẫu thuộc tính ${JSON.stringify(sample)}.`,
  );
}

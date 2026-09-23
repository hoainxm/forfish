/*
  MÃ HOÁ HÌNH RẠN DẠNG NHỊ PHÂN — delta + zigzag + varint (khuôn của MVT/Protobuf).

  VÌ SAO CÓ FILE NÀY
  Bộ hình rạn dạng JSON nặng 76 MB / 4.030.270 đỉnh = 19,8 byte mỗi đỉnh. Nó to
  KHÔNG phải vì dữ liệu nhiều mà vì mỗi toạ độ đang là một chuỗi chữ số
  (`[112.34568,9.87654]` ≈ 22 ký tự cho hai con số). Dữ liệu bản đồ phải nằm
  TRONG CODE (chủ dự án chốt 2026-08-29, không dùng Vercel Blob), mà hook chặn
  file `public/data/**` quá 20 MB, nên câu hỏi đúng không phải "cất ở đâu" mà là
  "lưu bằng định dạng gì".

  KHÔNG MẤT MỘT LI NÀO KHI LƯỢNG TỬ HOÁ
  Bộ nguồn đã được làm tròn 5 số thập phân ngay lúc sinh (`ROUND = 5` trong
  `scripts/generate-reef-shapes-aca.mjs`, đúng bằng bước lưới 0,00005°). Nên
  `scale = 100000` là ĐÚNG độ phân giải sẵn có: mọi toạ độ là bội nguyên của
  1e-5, `Math.round(x * 1e5)` không làm tròn gì cả, và chia lại cho 1e5 ra đúng
  con số cũ. Sai số lượng tử hoá = 0 m, không phải "nhỏ".
  Vì vậy KHÔNG dùng scale mịn hơn (1e6/1e7): mịn hơn không thêm được thông tin
  nào — bên dưới 1e-5 không có gì để giữ — mà nhân mọi hiệu số lên 10 lần, tức
  cộng thêm ~1 byte cho mỗi đỉnh. Đó là trả tiền cho số 0.
  Bộ mã hoá ĐẾM sai số lượng tử hoá thật (`maxQuantErrDeg`) và trả ra ngoài, để
  người chạy nhìn thấy con số chứ không phải tin lời hứa này.

  KHUÔN FILE (mọi số nguyên = varint LEB128; số có dấu = zigzag rồi varint)
    "SDRF"                        4 byte nhận dạng
    u8  phiên bản                 = 1
    varint scale                  mẫu số lượng tử hoá (100000)
    varint độ dài header
    header JSON (UTF-8)           properties của bộ + bảng `kinds` + bảng `provs`
    varint số feature
    mỗi feature:
      varint chỉ số kind          (vào bảng kinds: "reef" | "shoal")
      varint chỉ số prov          (vào bảng provs — lý lịch nguồn, KHÔNG được mất)
      varint số mảnh đa giác
      mỗi mảnh: varint số vòng
        mỗi vòng: varint số đỉnh  (KHÔNG kể đỉnh đóng vòng — bộ giải tự nối lại,
                                   nên vòng luôn kín, không nhờ dữ liệu kín hộ)
          mỗi đỉnh: zigzag varint dx, dy — hiệu so với đỉnh TRƯỚC ĐÓ

  Con trỏ delta chạy suốt cả file (hết vòng này sang vòng khác, hết feature này
  sang feature khác) chứ không reset về 0 mỗi vòng: các mảnh của cùng một cụm rạn
  nằm sát nhau ngoài đời nên bước nhảy giữa chúng vẫn nhỏ, giữ được varint 1–2 byte.

  File này là ESM thuần (không phải .ts) có chủ ý: MỘT bản cài đặt duy nhất dùng
  chung cho ba nơi — app đọc bản đồ (import qua `@/lib/reef-bin.mjs`), bước sinh
  các script sinh dữ liệu (import thẳng bằng đường dẫn), và
  test. Viết bằng .ts thì script build của Node không nạp được, mà chép ra hai
  bản thì sớm muộn hai bản lệch nhau — lệch bộ mã hoá là bản đồ méo im lặng.
*/

/** Bốn byte nhận dạng — file lạ mà đọc bừa thì ra hình rác, không ra lỗi. */
export const REEF_BIN_MAGIC = "SDRF";
export const REEF_BIN_VERSION = 1;
/** 1e-5 độ ≈ 1,1 m — ĐÚNG độ phân giải bộ nguồn đang có, không hơn không kém. */
export const REEF_BIN_SCALE = 100000;

// ── VARINT ─────────────────────────────────────────────────────────────────

/**
 * Nới bộ đệm gấp đôi khi chật. Bắt đầu 1 MB: bộ thật ~10 MB nên chỉ nới vài lần.
 * @param {{ buf: Uint8Array, len: number }} w
 * @param {number} need
 */
function ensure(w, need) {
  if (w.len + need <= w.buf.length) return;
  let cap = w.buf.length || 1;
  while (cap < w.len + need) cap *= 2;
  const next = new Uint8Array(cap);
  next.set(w.buf.subarray(0, w.len));
  w.buf = next;
}

/**
 * @param {{ buf: Uint8Array, len: number }} w
 * @param {number} v số nguyên KHÔNG âm
 */
function writeVarint(w, v) {
  ensure(w, 5);
  // `% 128` chứ không `& 0x7f`: toán tử bit của JS ép về int32, nên `&` sẽ sai
  // âm thầm với số ≥ 2^31. Ở bộ này chưa số nào tới đó, nhưng "chưa" không phải
  // "không", và sai một byte varint là hỏng cả phần đuôi file.
  let n = v;
  while (n >= 128) {
    w.buf[w.len++] = (n % 128) + 128;
    n = Math.floor(n / 128);
  }
  w.buf[w.len++] = n;
}

/**
 * @param {{ buf: Uint8Array, len: number }} w
 * @param {number} v số nguyên có dấu (hiệu toạ độ)
 */
function writeZigzag(w, v) {
  writeVarint(w, v < 0 ? -2 * v - 1 : 2 * v);
}

/**
 * @param {{ buf: Uint8Array, pos: number }} r
 * @returns {number}
 */
function readVarint(r) {
  let out = 0;
  let shift = 1;
  for (;;) {
    if (r.pos >= r.buf.length) throw new Error("reef-bin: file cụt giữa một số varint");
    const b = r.buf[r.pos++];
    out += (b & 0x7f) * shift;
    if ((b & 0x80) === 0) return out;
    shift *= 128;
    if (shift > 2 ** 53) throw new Error("reef-bin: varint dài quá mức hợp lệ");
  }
}

/**
 * @param {{ buf: Uint8Array, pos: number }} r
 * @returns {number}
 */
function readZigzag(r) {
  const n = readVarint(r);
  return n % 2 === 1 ? -(n + 1) / 2 : n / 2;
}

// ── MÃ HOÁ ─────────────────────────────────────────────────────────────────

/**
 * @typedef {[number, number]} Pt
 * @typedef {Pt[]} Ring
 * @typedef {{ type: "Feature", properties: Record<string, unknown>,
 *             geometry: { type: "MultiPolygon", coordinates: Ring[][] } }} ReefFeature
 * @typedef {{ type: "FeatureCollection", properties: Record<string, unknown>,
 *             features: ReefFeature[] }} ReefCollection
 * @typedef {ReefCollection & { scale: number }} DecodedCollection
 */

/**
 * FeatureCollection hình rạn → byte.
 *
 * Trả kèm SỐ ĐO thay vì chỉ mảng byte: người gọi cần đếm mảnh/vòng/đỉnh để soi
 * bất biến ba mức, mà những con số đó đã đi qua tay hàm này rồi — bắt họ quét
 * lại lần nữa là vừa tốn vừa mở đường cho hai cách đếm lệch nhau.
 *
 * @param {ReefCollection} fc
 * @param {{ scale?: number }} [opts]
 * @returns {{ bytes: Uint8Array, scale: number, features: number, polygons: number,
 *             rings: number, vertices: number, maxQuantErrDeg: number }}
 */
export function encodeReefShapes(fc, opts = {}) {
  const scale = opts.scale ?? REEF_BIN_SCALE;
  if (!Number.isInteger(scale) || scale <= 0) {
    throw new Error(`reef-bin: scale phải là số nguyên dương, nhận ${scale}`);
  }
  const feats = fc.features ?? [];

  // Bảng tra: `kind` chỉ có hai giá trị, `prov` lặp lại theo cụm. Bộ này chỉ có
  // ~1.500 feature nên bảng prov để nguyên JSON trong header là rẻ và KHÔNG MẤT
  // GÌ — lý lịch nguồn là thứ cả bộ dữ liệu sinh ra để mang, không được nén ẩu.
  /** @type {string[]} */
  const kinds = [];
  const kindIdx = new Map();
  /** @type {unknown[]} */
  const provs = [];
  const provIdx = new Map();
  /** @type {number[]} */
  const featKind = [];
  /** @type {number[]} */
  const featProv = [];
  for (const f of feats) {
    const kind = String(f.properties?.kind ?? "reef");
    if (!kindIdx.has(kind)) {
      kindIdx.set(kind, kinds.length);
      kinds.push(kind);
    }
    featKind.push(kindIdx.get(kind));
    const provKey = JSON.stringify(f.properties?.prov ?? null);
    if (!provIdx.has(provKey)) {
      provIdx.set(provKey, provs.length);
      provs.push(f.properties?.prov ?? null);
    }
    featProv.push(provIdx.get(provKey));
  }

  const props = { ...(fc.properties ?? {}) };
  const headerBytes = new TextEncoder().encode(JSON.stringify({ ...props, kinds, provs }));

  const w = { buf: new Uint8Array(1 << 20), len: 0 };
  ensure(w, 5);
  for (const ch of REEF_BIN_MAGIC) w.buf[w.len++] = ch.charCodeAt(0);
  w.buf[w.len++] = REEF_BIN_VERSION;
  writeVarint(w, scale);
  writeVarint(w, headerBytes.length);
  ensure(w, headerBytes.length);
  w.buf.set(headerBytes, w.len);
  w.len += headerBytes.length;
  writeVarint(w, feats.length);

  let cx = 0;
  let cy = 0;
  let polygons = 0;
  let rings = 0;
  let vertices = 0;
  let maxQuantErrDeg = 0;

  for (let i = 0; i < feats.length; i++) {
    const f = feats[i];
    writeVarint(w, featKind[i]);
    writeVarint(w, featProv[i]);
    const polys = f.geometry?.coordinates ?? [];
    writeVarint(w, polys.length);
    for (const poly of polys) {
      polygons++;
      writeVarint(w, poly.length);
      for (const ring of poly) {
        rings++;
        // Đỉnh cuối trùng đỉnh đầu (GeoJSON đòi vòng kín) — KHÔNG ghi, bộ giải
        // tự nối. Vòng nào lỡ không kín thì giữ nguyên đủ đỉnh rồi mới đóng, để
        // không âm thầm cắt mất một cạnh của vật cản.
        const n = ring.length;
        const closed =
          n >= 2 && ring[0][0] === ring[n - 1][0] && ring[0][1] === ring[n - 1][1];
        const keep = closed ? n - 1 : n;
        writeVarint(w, keep);
        for (let k = 0; k < keep; k++) {
          const qx = Math.round(ring[k][0] * scale);
          const qy = Math.round(ring[k][1] * scale);
          const ex = Math.abs(ring[k][0] - qx / scale);
          const ey = Math.abs(ring[k][1] - qy / scale);
          if (ex > maxQuantErrDeg) maxQuantErrDeg = ex;
          if (ey > maxQuantErrDeg) maxQuantErrDeg = ey;
          writeZigzag(w, qx - cx);
          writeZigzag(w, qy - cy);
          cx = qx;
          cy = qy;
        }
        // Đếm theo thứ BỘ GIẢI sẽ dựng ra (keep + đỉnh đóng vòng), không theo
        // thứ vừa ghi: số đỉnh báo ra phải khớp với hình mà app thật sự nhận,
        // không thì cổng bất biến ba mức so nhầm hai đơn vị khác nhau.
        vertices += keep > 0 ? keep + 1 : 0;
      }
    }
  }

  return {
    bytes: w.buf.slice(0, w.len),
    scale,
    features: feats.length,
    polygons,
    rings,
    vertices,
    maxQuantErrDeg,
  };
}

// ── GIẢI MÃ ────────────────────────────────────────────────────────────────

/**
 * Byte → FeatureCollection y như bản JSON.
 *
 * Mọi lỗi đều NÉM, không trả về bộ rỗng: lớp này là lớp cảnh báo vật cản, một
 * bản đồ "tải xong mà trống" nguy hơn hẳn một màn báo lỗi.
 *
 * Trả kèm `scale` (ngoài `properties`, để so sánh với bản GeoJSON vẫn khít):
 * bước sinh mức nhẹ hơn phải mã hoá lại ĐÚNG lưới lượng tử của nguồn, chứ không
 * phải lưới mặc định — nếu không, đổi scale ở nguồn sẽ âm thầm đổi độ chính xác
 * của hai mức kia.
 *
 * @param {Uint8Array | ArrayBuffer} input
 * @returns {DecodedCollection}
 */
export function decodeReefShapes(input) {
  const buf = input instanceof Uint8Array ? input : new Uint8Array(input);
  const r = { buf, pos: 0 };
  if (buf.length < 6) throw new Error("reef-bin: file quá ngắn");
  const magic = String.fromCharCode(buf[0], buf[1], buf[2], buf[3]);
  if (magic !== REEF_BIN_MAGIC) {
    throw new Error(`reef-bin: sai nhận dạng ("${magic}", cần "${REEF_BIN_MAGIC}")`);
  }
  r.pos = 4;
  const version = buf[r.pos++];
  if (version !== REEF_BIN_VERSION) {
    throw new Error(`reef-bin: phiên bản ${version} lạ (bộ giải hiểu ${REEF_BIN_VERSION})`);
  }
  const scale = readVarint(r);
  if (scale <= 0) throw new Error("reef-bin: scale không hợp lệ");
  const headerLen = readVarint(r);
  if (r.pos + headerLen > buf.length) throw new Error("reef-bin: header cụt");
  const header = JSON.parse(new TextDecoder().decode(buf.subarray(r.pos, r.pos + headerLen)));
  r.pos += headerLen;

  const { kinds, provs, ...properties } = header;
  if (!Array.isArray(kinds) || !Array.isArray(provs)) {
    throw new Error("reef-bin: header thiếu bảng kinds/provs");
  }

  const count = readVarint(r);
  /** @type {ReefFeature[]} */
  const features = [];
  let cx = 0;
  let cy = 0;

  for (let i = 0; i < count; i++) {
    const kind = kinds[readVarint(r)];
    const prov = provs[readVarint(r)];
    if (kind === undefined) throw new Error(`reef-bin: feature ${i} trỏ vào kind không có`);
    const polyCount = readVarint(r);
    /** @type {Ring[][]} */
    const coordinates = [];
    for (let p = 0; p < polyCount; p++) {
      const ringCount = readVarint(r);
      /** @type {Ring[]} */
      const poly = [];
      for (let g = 0; g < ringCount; g++) {
        const n = readVarint(r);
        /** @type {Ring} */
        const ring = [];
        for (let k = 0; k < n; k++) {
          cx += readZigzag(r);
          cy += readZigzag(r);
          ring.push([cx / scale, cy / scale]);
        }
        if (ring.length) ring.push(ring[0]); // đóng vòng — luôn kín, không nhờ dữ liệu
        poly.push(ring);
      }
      coordinates.push(poly);
    }
    features.push({
      type: "Feature",
      properties: { kind, prov },
      geometry: { type: "MultiPolygon", coordinates },
    });
  }

  return { type: "FeatureCollection", properties, features, scale };
}

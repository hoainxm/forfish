/**
 * CỔNG CHẶN cho bộ ký hiệu hải đồ.
 *
 * Test này KHÔNG kiểm tra ý định — nó mở CHÍNH tấm sprite đã sinh
 * (`public/icons/chart-sprite*.png`), giải nén, đọc từng pixel, rồi đo. Lý do:
 * ba kiểu hỏng dưới đây đều vô hình với mọi cách soát thông thường (đọc code
 * thấy đúng, nhìn màn hình trong phòng thấy đẹp), và chỉ lộ ra khi bà con đã ở
 * ngoài biển:
 *
 *   (a) THÊM LOẠI, QUÊN VẼ — OSM/Cục Hàng hải thêm một loại báo hiệu, không ai
 *       thêm hình, nó lặng lẽ rơi về ký hiệu "chưa rõ". Không lỗi, không cảnh
 *       báo, chỉ mất thông tin.
 *   (b) MẤT NÉT DƯỚI NẮNG — đổi một mã màu cho "đẹp hơn", tương phản tụt dưới
 *       3:1, ký hiệu tan vào nền nước. Trong phòng máy lạnh vẫn thấy rõ.
 *   (c) GỘP HÌNH TRỤ VÀ HÌNH NÓN — ai đó thấy hai ký hiệu luồng "chỉ khác màu"
 *       nên gộp cho gọn. Đỏ và xanh lục chênh nhau 1,05:1 độ sáng: người mù
 *       màu đỏ–lục mất sạch thông tin bên luồng. Đây là lỗi giết người.
 */

import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { inflateSync } from "node:zlib";
import { REEF_DOT_COLOR, SEA_MASK_COLOR } from "../ocean-map";
import { SEAMARK_LABEL, decodeSeamarks, type Seamark } from "../seamarks";
import {
  CHART_CONTRAST_FLOOR,
  CHART_FALLBACK_ICON,
  CHART_FEATURE_ICON,
  CHART_ICON_BASE_PX,
  CHART_ICON_MIN_PX,
  CHART_ICON_SIZE,
  CHART_INK,
  CHART_PALETTE,
  CHART_SPRITE_FILES,
  CHART_SPRITE_URL,
  cardinalFromPurposeVN,
  chartSymbolId,
  diaDanhNgamSymbolId,
  lighthouseSymbolId,
  quadrantFromBodyColour,
  reefSymbolId,
  sideFromBodyColour,
  sideFromLightColour,
  sideFromPurposeVN,
  TIDE_ICON_IDS,
  tideSymbolId,
  wreckSymbolId,
} from "../chart-symbols";

/* ── ĐỌC ARTEFACT THẬT ───────────────────────────────────────────────────── */

const ICONS = path.join(process.cwd(), "public", "icons");
const readJson = (f: string) =>
  JSON.parse(readFileSync(path.join(ICONS, f), "utf8")) as Record<
    string,
    { x: number; y: number; width: number; height: number; pixelRatio: number }
  >;

const SHEET_1X = readJson("chart-sprite.json");
const SHEET_2X = readJson("chart-sprite@2x.json");

/**
 * Giải mã PNG bằng `node:zlib` — KHÔNG kéo thêm thư viện. Sprite do sharp sinh
 * luôn là RGBA 8 bit, không xen kẽ; gặp dạng khác thì ném để lộ ra ngay thay vì
 * đo trên rác.
 */
function decodePng(file: string) {
  const buf = readFileSync(path.join(ICONS, file));
  expect(buf.subarray(0, 8).toString("hex"), `${file} không phải PNG`).toBe(
    "89504e470d0a1a0a",
  );
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colourType = 0;
  const idat: Buffer[] = [];
  for (let p = 8; p + 8 <= buf.length; ) {
    const len = buf.readUInt32BE(p);
    const type = buf.subarray(p + 4, p + 8).toString("latin1");
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colourType = data[9];
      expect(data[12], `${file}: PNG xen kẽ, decoder này không đọc được`).toBe(0);
    } else if (type === "IDAT") idat.push(Buffer.from(data));
    else if (type === "IEND") break;
    p += 12 + len;
  }
  expect(bitDepth, `${file}: cần PNG 8 bit`).toBe(8);
  expect(colourType, `${file}: cần PNG RGBA`).toBe(6);

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const px = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= 4 ? px[y * stride + i - 4] : 0;
      const b = y > 0 ? px[(y - 1) * stride + i] : 0;
      const c = i >= 4 && y > 0 ? px[(y - 1) * stride + i - 4] : 0;
      let v = line[i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p0 = a + b - c;
        const pa = Math.abs(p0 - a);
        const pb = Math.abs(p0 - b);
        const pc = Math.abs(p0 - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      px[y * stride + i] = v & 0xff;
    }
  }
  return { width, height, stride, px };
}

const PNG_1X = decodePng("chart-sprite.png");
const PNG_2X = decodePng("chart-sprite@2x.png");

/* ── PHÉP ĐO TƯƠNG PHẢN (dùng lại đúng khuôn của ocean-map.test.ts) ──────── */

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lum = (c: number[]) => {
  const s = c.map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];
};
const ratio = (a: number[], b: number[]) => {
  const [l1, l2] = [lum(a), lum(b)];
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};
/** Pha lên nền — ký hiệu có viền mềm, phải đo SAU KHI pha mới đúng thực tế. */
const over = (fg: number[], bg: number[], a: number) =>
  fg.map((v, i) => v * a + bg[i] * (1 - a));

const SEA = hex(SEA_MASK_COLOR);

/** Lấy một ô ký hiệu ra khỏi tấm sprite. */
function cellOf(png: typeof PNG_1X, box: { x: number; y: number; width: number; height: number }) {
  const { width: w, height: h } = box;
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const src = (box.y + y) * png.stride + (box.x + x) * 4;
      out.set(png.px.subarray(src, src + 4), (y * w + x) * 4);
    }
  }
  return { w, h, px: out };
}

const alphaAt = (c: ReturnType<typeof cellOf>, x: number, y: number) =>
  x < 0 || y < 0 || x >= c.w || y >= c.h ? 0 : c.px[(y * c.w + x) * 4 + 3];

/** Bóng đen của một ký hiệu: 1 nếu có mực, 0 nếu trong suốt. */
const silhouette = (id: string) => {
  const c = cellOf(PNG_2X, SHEET_2X[id]);
  const m = new Uint8Array(c.w * c.h);
  for (let i = 0; i < m.length; i++) m[i] = c.px[i * 4 + 3] > 120 ? 1 : 0;
  return m;
};

/** Tỉ lệ pixel khác nhau giữa hai bóng, trên phần có mực của ít nhất một bên. */
const differ = (a: Uint8Array, b: Uint8Array) => {
  let d = 0;
  let n = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] || b[i]) n++;
    if (a[i] !== b[i]) d++;
  }
  return d / n;
};

/* ── 1. PHỦ SÓNG: KHÔNG LOẠI NÀO RƠI VỀ "CHƯA RÕ" TRONG IM LẶNG ─────────── */

describe("mọi loại báo hiệu đều có ký hiệu riêng", () => {
  const types = Object.keys(SEAMARK_LABEL);

  it.each(types)("%s có ký hiệu, không rơi về chấm mặc định", (type) => {
    const id = chartSymbolId({ type } as Seamark);
    expect(
      id,
      `loại "${type}" (${SEAMARK_LABEL[type as keyof typeof SEAMARK_LABEL]}) chưa có hình riêng ` +
        `⇒ nó rơi về "${CHART_FALLBACK_ICON}" mà KHÔNG báo gì. Thêm hình vào ` +
        `scripts/build-chart-sprite.mjs rồi khai báo trong PLAIN_ICON của chart-symbols.ts.`,
    ).not.toBe(CHART_FALLBACK_ICON);
    expect(SHEET_2X[id], `ký hiệu "${id}" khai trong .ts nhưng KHÔNG có trong sprite`).toBeTruthy();
  });

  it("mọi ký hiệu sinh ra từ mọi tổ hợp màu + đèn đều có trong sprite", () => {
    const colours = [
      undefined,
      "red",
      "green",
      "yellow",
      "black",
      "red;green;red",
      "green;red;green",
      "black;yellow",
      "yellow;black",
      "black;yellow;black",
      "yellow;black;yellow",
      "red;white",
      "black;red;black",
      "chuỗi lạ OSM chưa từng thấy",
    ];
    const missing: string[] = [];
    for (const type of [...types, "tag_moi_cua_osm"]) {
      for (const colour of colours) {
        for (const light of [undefined, { character: "Fl" }]) {
          const id = chartSymbolId({ type, colour, light } as Seamark);
          if (!SHEET_2X[id]) missing.push(`${type}/${colour}/${light ? "đèn" : "tắt"} → ${id}`);
        }
      }
    }
    expect(missing, `ký hiệu được chọn nhưng KHÔNG có trong sprite:\n${missing.join("\n")}`).toEqual(
      [],
    );
  });

  it("loại lạ rơi về ký hiệu 'chưa rõ' CÓ HÌNH, không phải chấm trơn", () => {
    expect(chartSymbolId({ type: "osm_them_tag_moi" } as Seamark)).toBe(CHART_FALLBACK_ICON);
    expect(SHEET_2X[CHART_FALLBACK_ICON]).toBeTruthy();
  });
});

/* ── 2. DỮ LIỆU THẬT CỦA CỤC HÀNG HẢI ────────────────────────────────────── */

type VnAids = {
  types: string[];
  colours: string[];
  purposes: string[];
  marks: number[][];
};
const VN = JSON.parse(
  readFileSync(path.join(process.cwd(), "public", "data", "vn-aids.v1.json"), "utf8"),
) as VnAids;
const vnMarks = decodeSeamarks(VN);
const purposeOf = (i: number) => {
  const pp = VN.marks[i][11];
  return typeof pp === "number" && pp >= 0 ? VN.purposes[pp] : undefined;
};

describe("437 báo hiệu Cục Hàng hải", () => {
  it("mọi loại trong vn-aids.v1.json đều có ký hiệu trong sprite", () => {
    const bad: string[] = [];
    for (const t of new Set(VN.types)) {
      const id = chartSymbolId({ type: t } as Seamark);
      if (id === CHART_FALLBACK_ICON) bad.push(`${t} → chưa có hình`);
      else if (!SHEET_2X[id]) bad.push(`${t} → "${id}" thiếu trong sprite`);
    }
    expect(bad, bad.join("\n")).toEqual([]);
  });

  it("mọi báo hiệu đều ra một ký hiệu có thật", () => {
    const bad: string[] = [];
    vnMarks.forEach((m, i) => {
      const id = chartSymbolId(m, purposeOf(i));
      if (!SHEET_2X[id]) bad.push(`#${i} ${m.type} → ${id}`);
    });
    expect(bad, bad.slice(0, 10).join("\n")).toEqual([]);
  });

  it("câu 'tác dụng' của nhà nước cứu được bên luồng mà nguồn không cho màu thân", () => {
    // Nguồn Cục Hàng hải KHÔNG công bố màu thân (cột `bc` luôn -1). Không đọc
    // câu tác dụng thì MỌI phao luồng Việt Nam đều thành "chưa rõ bên" — bộ ký
    // hiệu vô dụng đúng chỗ nó cần nhất.
    let known = 0;
    let lateral = 0;
    vnMarks.forEach((m, i) => {
      if (m.type !== "buoy_lateral" && m.type !== "beacon_lateral") return;
      lateral++;
      if (!chartSymbolId(m, purposeOf(i)).includes("unknown")) known++;
    });
    expect(lateral).toBeGreaterThan(300);
    expect(
      known / lateral,
      `chỉ ${known}/${lateral} phao luồng biết được bên — dưới 90%. ` +
        `Kiểm lại sideFromPurposeVN: câu tác dụng của nguồn có thể đã đổi cách viết.`,
    ).toBeGreaterThanOrEqual(0.9);
  });

  it("dữ liệu thật xác nhận Việt Nam theo IALA vùng A (đỏ trái, lục phải)", () => {
    // Không tin "nghe nói": đếm ngay trong dữ liệu nhà nước.
    let rightGreen = 0;
    let rightRed = 0;
    let leftRed = 0;
    let leftGreen = 0;
    vnMarks.forEach((m, i) => {
      const side = sideFromPurposeVN(purposeOf(i));
      const lc = m.light?.colour;
      if (side === "stbd" && lc === "green") rightGreen++;
      if (side === "stbd" && lc === "red") rightRed++;
      if (side === "port" && lc === "red") leftRed++;
      if (side === "port" && lc === "green") leftGreen++;
    });
    expect(rightGreen).toBeGreaterThan(rightRed * 5);
    expect(leftRed).toBeGreaterThan(leftGreen * 5);
  });
});

/* ── 3. PHÂN GIẢI BÊN LUỒNG / HƯỚNG ─────────────────────────────────────── */

describe("đọc bên luồng và hướng phương vị", () => {
  it("màu thân → bên luồng (IALA vùng A)", () => {
    expect(sideFromBodyColour("red")).toBe("port");
    expect(sideFromBodyColour("green")).toBe("stbd");
    expect(sideFromBodyColour("red;green;red")).toBe("pref-stbd");
    expect(sideFromBodyColour("green;red;green")).toBe("pref-port");
    expect(sideFromBodyColour("black")).toBe("unknown");
    expect(sideFromBodyColour(undefined)).toBe("unknown");
  });

  it("màu ánh đèn chỉ dùng khi CHỈ CÓ MỘT màu — 'white;red' là chưa rõ", () => {
    expect(sideFromLightColour("red")).toBe("port");
    expect(sideFromLightColour("green")).toBe("stbd");
    expect(sideFromLightColour("white;red")).toBe("unknown");
    expect(sideFromLightColour("white")).toBe("unknown");
  });

  it("câu tác dụng tiếng Việt → bên luồng", () => {
    expect(sideFromPurposeVN("Báo hiệu phía phải luồng")).toBe("stbd");
    expect(sideFromPurposeVN("Báo hiệu phía trái luồng")).toBe("port");
    expect(sideFromPurposeVN("Giới hạn phía trái luồng")).toBe("port");
    expect(sideFromPurposeVN("BH bên phải luồng (NĐ)")).toBe("stbd");
    expect(sideFromPurposeVN("Báo hiệu hướng luồng chính chuyển sang phải")).toBe("pref-stbd");
    expect(sideFromPurposeVN("Báo hiệu hướng luồng chính chuyển sang trái")).toBe("pref-port");
    // Câu nói CẢ HAI BÊN thì phải nhận là chưa rõ — đoán bừa ở đây là lái tàu
    // vào chỗ cạn.
    expect(sideFromPurposeVN("Báo hiệu phía phải trái luồng")).toBe("unknown");
    expect(sideFromPurposeVN("Báo hiệu chuyên dùng")).toBe("unknown");
  });

  it("màu thân → hướng phương vị (nón chỉ vào phía màu đen)", () => {
    expect(quadrantFromBodyColour("black;yellow")).toBe("n");
    expect(quadrantFromBodyColour("yellow;black")).toBe("s");
    expect(quadrantFromBodyColour("black;yellow;black")).toBe("e");
    expect(quadrantFromBodyColour("yellow;black;yellow")).toBe("w");
    expect(quadrantFromBodyColour("red")).toBe("unknown");
  });

  it("câu tác dụng → hướng, lấy hướng CUỐI câu", () => {
    expect(cardinalFromPurposeVN("BH an toàn phía Nam")).toBe("s");
    expect(cardinalFromPurposeVN("Báo hiệu an toàn hướng Bắc")).toBe("n");
    expect(cardinalFromPurposeVN("Báo hiệu an toàn phía Đông")).toBe("e");
    expect(cardinalFromPurposeVN("Báo hiệu an toàn phía tây")).toBe("w");
    // "Nam Định" ở đầu không được cướp mất hướng thật ở cuối câu
    expect(cardinalFromPurposeVN("Luồng Nam Định — báo hiệu an toàn phía Đông")).toBe("e");
    expect(cardinalFromPurposeVN("Báo hiệu chuyên dùng")).toBe("unknown");
  });

  it("ưu tiên: lời nhà nước > màu thân > màu đèn", () => {
    const m = {
      type: "buoy_lateral",
      colour: "green",
      light: { colour: "red" },
    } as Seamark;
    expect(chartSymbolId(m, "Báo hiệu phía trái luồng")).toBe("lat-port-lit");
    expect(chartSymbolId(m)).toBe("lat-stbd-lit"); // hết câu thì theo màu thân
    expect(chartSymbolId({ type: "buoy_lateral", light: { colour: "red" } } as Seamark)).toBe(
      "lat-port-lit",
    );
  });

  it("có đèn thì thêm chấm hồng sen; loại vốn là đèn/vùng thì không nhân đôi", () => {
    expect(chartSymbolId({ type: "buoy_lateral", colour: "red" } as Seamark)).toBe("lat-port");
    expect(
      chartSymbolId({ type: "buoy_lateral", colour: "red", light: { period: 6 } } as Seamark),
    ).toBe("lat-port-lit");
    expect(chartSymbolId({ type: "light_major", light: { character: "Fl" } } as Seamark)).toBe(
      "light-major",
    );
    expect(chartSymbolId({ type: "anchorage", light: { character: "Fl" } } as Seamark)).toBe(
      "anchorage",
    );
  });
});

/* ── 4. SPRITE JSON ↔ PNG ────────────────────────────────────────────────── */

describe("sprite json khớp png", () => {
  it("hai bản 1x và @2x cùng danh sách ký hiệu", () => {
    expect(Object.keys(SHEET_2X).sort()).toEqual(Object.keys(SHEET_1X).sort());
  });

  it("@2x đúng gấp đôi 1x về mọi toạ độ và kích thước", () => {
    for (const [id, a] of Object.entries(SHEET_1X)) {
      const b = SHEET_2X[id];
      expect({ id, ...b }).toEqual({
        id,
        x: a.x * 2,
        y: a.y * 2,
        width: a.width * 2,
        height: a.height * 2,
        pixelRatio: 2,
      });
      expect(a.pixelRatio).toBe(1);
    }
  });

  it.each([
    ["chart-sprite.png", SHEET_1X, PNG_1X, CHART_ICON_BASE_PX],
    ["chart-sprite@2x.png", SHEET_2X, PNG_2X, CHART_ICON_BASE_PX * 2],
  ] as const)("%s: mọi ô nằm trong ảnh và đúng cạnh ô", (file, sheet, png, cell) => {
    for (const [id, b] of Object.entries(sheet)) {
      expect({ id, w: b.width, h: b.height }).toEqual({ id, w: cell, h: cell });
      expect(b.x + b.width, `${id} tràn phải ${file}`).toBeLessThanOrEqual(png.width);
      expect(b.y + b.height, `${id} tràn đáy ${file}`).toBeLessThanOrEqual(png.height);
    }
  });

  it("các ô không chồng lên nhau", () => {
    const boxes = Object.entries(SHEET_2X);
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const [ai, a] = boxes[i];
        const [bi, b] = boxes[j];
        const apart =
          a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;
        expect(apart, `ô "${ai}" chồng lên "${bi}"`).toBe(true);
      }
    }
  });

  it("không ô nào rỗng — sinh hỏng một hình thì lộ ra ngay", () => {
    for (const [id, b] of Object.entries(SHEET_2X)) {
      const c = cellOf(PNG_2X, b);
      let ink = 0;
      for (let i = 3; i < c.px.length; i += 4) if (c.px[i] > 200) ink++;
      expect(ink, `ký hiệu "${id}" gần như trống (${ink} px)`).toBeGreaterThan(60);
    }
  });

  it("đường dẫn sprite trong .ts trỏ đúng bốn file có thật", () => {
    expect(CHART_SPRITE_URL).toBe("/icons/chart-sprite");
    for (const f of CHART_SPRITE_FILES) {
      expect(f.startsWith(`${CHART_SPRITE_URL}`)).toBe(true);
      expect(() => readFileSync(path.join(process.cwd(), "public", f))).not.toThrow();
    }
  });
});

/* ── 5. ĐỌC ĐƯỢC DƯỚI NẮNG ──────────────────────────────────────────────── */

describe("tương phản trên nền nước (đo trên pixel thật, sau khi pha độ mờ)", () => {
  it("bảng màu: viền và mọi ruột đạt sàn của mình", () => {
    expect(ratio(hex(CHART_INK), SEA), "viền INK phải nổi trên nền nước").toBeGreaterThanOrEqual(
      CHART_CONTRAST_FLOOR,
    );
    for (const [name, c] of Object.entries(CHART_PALETTE)) {
      if (name === "ink") continue;
      // Vàng và trắng là màu CHUẨN IALA — không được đổi hue. Chúng chỉ cần
      // nổi trên VIỀN; phần tương phản với nước do viền gánh.
      expect(
        ratio(hex(c), hex(CHART_INK)),
        `màu "${name}" (${c}) chỉ đạt ${ratio(hex(c), hex(CHART_INK)).toFixed(2)}:1 với viền ` +
          `⇒ ruột lẫn vào viền, mất chi tiết trong ký hiệu`,
      ).toBeGreaterThanOrEqual(CHART_CONTRAST_FLOOR);
    }
  });

  it("phép đo không rỗng — bắt được đúng cấu hình gây lỗi", () => {
    // Xanh thép nhạt kiểu "cho dịu mắt" là kiểu hỏng hay gặp nhất.
    expect(ratio(hex("#9fc4d6"), SEA)).toBeLessThan(CHART_CONTRAST_FLOOR);
    expect(ratio(hex(CHART_PALETTE.slate), SEA)).toBeGreaterThanOrEqual(CHART_CONTRAST_FLOOR);
    // Đúng đường tính mà phép đo vành dùng (pha alpha 230/255 rồi mới so):
    // vành nhạt PHẢI trượt, vành INK PHẢI đạt — nếu không thì cổng vành vô dụng.
    expect(ratio(over(hex("#8fb6c4"), SEA, 230 / 255), SEA)).toBeLessThan(CHART_CONTRAST_FLOOR);
    expect(ratio(over(hex(CHART_INK), SEA, 230 / 255), SEA)).toBeGreaterThanOrEqual(
      CHART_CONTRAST_FLOOR,
    );
  });

  /*  ĐO CÁI GÌ, VÀ VÌ SAO KHÔNG ĐO VIỀN MỜ.
      Mép hình vẽ ra luôn có một dải khử răng cưa (alpha 60–230). Dải đó pha
      loãng với nền nên tương phản của NÓ thấp là chuyện đương nhiên của mọi
      hình vẽ, không phải lỗi thiết kế — đo dải đó thì mọi hình chéo đều "trượt"
      và cổng thành ra vô nghĩa.
      Thứ quyết định "có nhìn ra hình trên mặt nước hay không" là VÀNH ĐẶC ngay
      sau dải mờ. Nên: lấy pixel gần như đục hẳn (alpha ≥ 230) nằm sát rìa
      (cách chỗ trong suốt ≤ 2 px) — đó là vành thật. */
  it.each(Object.keys(SHEET_2X))("%s: vành ngoài tách hẳn khỏi mặt nước", (id) => {
    const c = cellOf(PNG_2X, SHEET_2X[id]);
    const nearOutside = (x: number, y: number) => {
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) if (alphaAt(c, x + dx, y + dy) < 60) return true;
      return false;
    };
    let rim = 0;
    let ok = 0;
    let worst = Infinity;
    for (let y = 0; y < c.h; y++) {
      for (let x = 0; x < c.w; x++) {
        const i = (y * c.w + x) * 4;
        const a = c.px[i + 3];
        if (a < 230 || !nearOutside(x, y)) continue;
        rim++;
        const r = ratio(over([c.px[i], c.px[i + 1], c.px[i + 2]], SEA, a / 255), SEA);
        if (r >= CHART_CONTRAST_FLOOR) ok++;
        else worst = Math.min(worst, r);
      }
    }
    expect(rim, `"${id}" không có vành đặc nào — hình sinh hỏng?`).toBeGreaterThan(20);
    expect(
      ok / rim,
      `"${id}": chỉ ${((ok / rim) * 100).toFixed(0)}% pixel vành đạt ${CHART_CONTRAST_FLOOR}:1 ` +
        `trên nền nước (chỗ tệ nhất ${worst.toFixed(2)}:1). Ký hiệu này sẽ tan vào mặt nước ` +
        `dưới nắng. ĐỪNG đổi màu ruột — hãy bảo đảm hình có VIỀN ${CHART_INK} khép kín.`,
    ).toBeGreaterThanOrEqual(0.95);
  });

  it("mọi màu đặc trong sprite đều thuộc bảng màu đã khai", () => {
    const palette = Object.values(CHART_PALETTE).map(hex);
    /*  Chấp nhận cả màu nằm TRÊN ĐOẠN NỐI hai màu trong bảng: đó chính là pixel
        khử răng cưa ở ranh giới ruột–viền (vàng gặp INK sinh ra rgb(174,138,16)
        …). Ngoài đoạn nối thì là màu ai đó lén thêm — mới là thứ cần chặn. */
    const onPalette = (rgb: number[]) =>
      palette.some((p) =>
        palette.some((q) => {
          const d = [q[0] - p[0], q[1] - p[1], q[2] - p[2]];
          const len2 = d[0] ** 2 + d[1] ** 2 + d[2] ** 2;
          const t = len2
            ? Math.max(
                0,
                Math.min(1, ((rgb[0] - p[0]) * d[0] + (rgb[1] - p[1]) * d[1] + (rgb[2] - p[2]) * d[2]) / len2),
              )
            : 0;
          return (
            Math.hypot(rgb[0] - (p[0] + t * d[0]), rgb[1] - (p[1] + t * d[1]), rgb[2] - (p[2] + t * d[2])) <= 14
          );
        }),
      );
    const strays: string[] = [];
    for (const [id, b] of Object.entries(SHEET_2X)) {
      const c = cellOf(PNG_2X, b);
      const tally = new Map<string, number>();
      let total = 0;
      for (let i = 0; i < c.px.length; i += 4) {
        if (c.px[i + 3] < 250) continue;
        total++;
        const k = `${c.px[i]},${c.px[i + 1]},${c.px[i + 2]}`;
        tally.set(k, (tally.get(k) ?? 0) + 1);
      }
      for (const [k, n] of tally) {
        if (n / total < 0.01) continue; // bỏ qua pixel lẻ tẻ
        const rgb = k.split(",").map(Number);
        if (!onPalette(rgb)) strays.push(`${id}: rgb(${k}) chiếm ${((n / total) * 100).toFixed(0)}%`);
      }
    }
    expect(
      strays,
      `màu lạ trong sprite — bảng màu của chart-symbols.ts và của ` +
        `scripts/build-chart-sprite.mjs đã lệch nhau:\n${strays.join("\n")}`,
    ).toEqual([]);
  });
});

/* ── 6. HÌNH LÀ ĐƯỜNG SỐNG CHO NGƯỜI MÙ MÀU ─────────────────────────────── */

describe("phao trái và phao phải luồng phân biệt được KHÔNG CẦN MÀU", () => {
  it("đỏ và xanh lục KHÔNG tách được bằng độ sáng — đây là lý do phải khác hình", () => {
    const r = ratio(hex(CHART_PALETTE.red), hex(CHART_PALETTE.green));
    expect(
      r,
      `đỏ/lục đạt ${r.toFixed(2)}:1 — nếu con số này bỗng ≥3 thì ai đó đã đổi màu ` +
        `khỏi chuẩn IALA. Đọc lại đã, đừng vội sửa test.`,
    ).toBeLessThan(2);
  });

  it.each([
    ["lat-port", "lat-stbd"],
    ["bcn-lat-port", "bcn-lat-stbd"],
    ["lat-pref-port", "lat-pref-stbd"],
  ])("bóng của %s khác hẳn bóng của %s", (a, b) => {
    const d = differ(silhouette(a), silhouette(b));
    expect(
      d,
      `"${a}" và "${b}" chỉ khác nhau ${(d * 100).toFixed(0)}% về HÌNH. Đỏ và xanh lục ` +
        `chênh nhau 1,05:1 độ sáng ⇒ người mù màu đỏ–lục (~8% đàn ông) sẽ thấy hai ` +
        `khối xám giống hệt và không biết bên nào của luồng. Trụ (trái) và nón (phải) ` +
        `phải giữ nguyên là hai hình khác nhau.`,
    ).toBeGreaterThan(0.25);
  });

  it("bốn hướng phương vị có bốn dấu hiệu đỉnh khác nhau", () => {
    const ids = ["card-n", "card-e", "card-s", "card-w"];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const d = differ(silhouette(ids[i]), silhouette(ids[j]));
        expect(d, `"${ids[i]}" và "${ids[j]}" gần như cùng một bóng`).toBeGreaterThan(0.04);
      }
    }
  });
});

/* ── 6b. XÁC TÀU · CHƯỚNG NGẠI · HẢI ĐĂNG ──────────────────────────────── */

describe("ký hiệu xác tàu / chướng ngại / hải đăng", () => {
  it("loại của lớp xác tàu → ký hiệu, và ký hiệu CÓ THẬT trong sprite", () => {
    expect(wreckSymbolId("xac-tau")).toBe("wreck");
    expect(wreckSymbolId("xac-tau", 6.8)).toBe("wreck-depth");
    // -1 là quy ước "nguồn không công bố" của xac-tau.v1.json — không phải 0 m
    expect(wreckSymbolId("xac-tau", -1)).toBe("wreck");
    expect(wreckSymbolId("xac-tau", 0)).toBe("wreck");
    expect(wreckSymbolId("chuong-ngai")).toBe("obstruction");
    expect(wreckSymbolId("vat-chim")).toBe("obstruction");
    // loại lạ vẫn là "thứ phải tránh" — cùng chiều an toàn với xacTauLabel
    expect(wreckSymbolId(undefined)).toBe("obstruction");
    expect(wreckSymbolId("loai_moi_chua_biet")).toBe("obstruction");
    for (const id of ["wreck", "wreck-depth", "obstruction"]) {
      expect(SHEET_1X[id], `"${id}" thiếu trong sprite 1x`).toBeTruthy();
      expect(SHEET_2X[id], `"${id}" thiếu trong sprite @2x`).toBeTruthy();
    }
  });

  it("đèn biển: light_major → lighthouse; loại khác đi đường cũ", () => {
    expect(lighthouseSymbolId({ type: "light_major" } as Seamark)).toBe("lighthouse");
    expect(SHEET_2X.lighthouse).toBeTruthy();
    expect(lighthouseSymbolId({ type: "light_minor" } as Seamark)).toBe("light-minor");
    expect(lighthouseSymbolId({ type: "tag_la" } as Seamark)).toBe(CHART_FALLBACK_ICON);
    // Hành vi CŨ của chartSymbolId phải giữ nguyên: seamarks OSM + vn-aids
    // vẫn nhận light-major, chỉ lớp đèn biển mới lấy lighthouse.
    expect(chartSymbolId({ type: "light_major" } as Seamark)).toBe("light-major");
  });

  it("wreck-depth CHỪA TRỐNG phần phải của ô để dán số độ sâu", () => {
    // Hợp đồng với layer: số "6,8 m" dán đè từ x = 15/24 của ô trở đi.
    // Hình lấn vào vùng này là số đè lên hình — mất cả hai.
    const c = cellOf(PNG_2X, SHEET_2X["wreck-depth"]);
    const clearFromX = Math.round((15 / 24) * c.w); // = 30 ở ô 48 px
    for (let y = 0; y < c.h; y++)
      for (let x = clearFromX; x < c.w; x++)
        expect(
          alphaAt(c, x, y),
          `wreck-depth có mực ở (${x},${y}) — lấn vào chỗ dán số độ sâu`,
        ).toBeLessThan(60);
    // ...và phần trái vẫn phải là một hình thật, không phải ô gần rỗng
    let ink = 0;
    for (let i = 3; i < c.px.length; i += 4) if (c.px[i] > 200) ink++;
    expect(ink).toBeGreaterThan(60);
  });

  it.each([
    ["wreck", "obstruction"],
    ["wreck", "iso-danger"],
    ["obstruction", "iso-danger"],
    ["wreck", "wreck-depth"],
    ["lighthouse", "light-major"],
  ])("bóng của %s khác hẳn bóng của %s — không nhầm được dưới nắng", (a, b) => {
    const d = differ(silhouette(a), silhouette(b));
    expect(
      d,
      `"${a}" và "${b}" chỉ khác nhau ${(d * 100).toFixed(0)}% về HÌNH. Ba ký hiệu nguy ` +
        `hiểm (xác tàu / chướng ngại / nguy hiểm biệt lập) mà trông giống nhau thì bà con ` +
        `không biết đang tránh CÁI GÌ — mỗi loại phải giữ một bóng riêng.`,
    ).toBeGreaterThan(0.25);
  });
});

/* ── 6c. ĐÁ · BÃI · RẠN · CẤM NEO · CÁP CẬP BỜ · ỐNG DẪN (2026-09) ─────── */

describe("ký hiệu đá/bãi/rạn và công trình tuyến", () => {
  const NEW_IDS = Object.values(CHART_FEATURE_ICON);

  it("sáu tên hằng đều có trong sprite 1x lẫn @2x, đúng cạnh ô, không rỗng", () => {
    for (const id of NEW_IDS) {
      expect(SHEET_1X[id], `"${id}" thiếu trong sprite 1x`).toBeTruthy();
      expect(SHEET_2X[id], `"${id}" thiếu trong sprite @2x`).toBeTruthy();
      expect(SHEET_1X[id].width).toBe(CHART_ICON_BASE_PX);
      expect(SHEET_2X[id].width).toBe(CHART_ICON_BASE_PX * 2);
      const c = cellOf(PNG_2X, SHEET_2X[id]);
      let ink = 0;
      for (let i = 3; i < c.px.length; i += 4) if (c.px[i] > 200) ink++;
      expect(ink, `"${id}" gần như trống (${ink} px)`).toBeGreaterThan(60);
    }
  });

  it("là địa hình / công trình nên KHÔNG có biến thể -lit", () => {
    for (const id of NEW_IDS)
      expect(SHEET_2X[`${id}-lit`], `"${id}-lit" là ô vô nghĩa — đá không có đèn`).toBeUndefined();
  });

  it("teal của icon rạn = đúng màu chấm rạn cũ (REEF_DOT_COLOR) — một thứ, một màu", () => {
    expect(CHART_PALETTE.teal).toBe(REEF_DOT_COLOR);
  });

  it("type của coral-reefs → ký hiệu: đá nguy hiểm, rạn san hô, còn lại là bãi", () => {
    expect(reefSymbolId("da")).toBe("rock-awash");
    expect(reefSymbolId("ran")).toBe("coral-reef");
    expect(reefSymbolId("bai")).toBe("bank");
    expect(reefSymbolId("con")).toBe("bank");
    // chuỗi thô từ GeoJSON: hoa/thường, khoảng trắng thừa không được làm đá rơi về bãi
    expect(reefSymbolId(" Da ")).toBe("rock-awash");
    // loại lạ → bãi (hình mềm nhất, KHÔNG giả vờ là đá) — chốt Lead 2026-09
    expect(reefSymbolId("loai_moi")).toBe("bank");
    expect(reefSymbolId("")).toBe("bank");
    expect(reefSymbolId(undefined as unknown as string)).toBe("bank");
    for (const t of ["da", "ran", "bai", "con"]) expect(SHEET_2X[reefSymbolId(t)]).toBeTruthy();
  });

  it.each([
    // ba loại địa hình phải khác nhau — đây là toàn bộ lý do có ba icon
    ["rock-awash", "bank"],
    ["rock-awash", "coral-reef"],
    ["bank", "coral-reef"],
    // đá ngầm không được nhầm với ba ký hiệu nguy hiểm đã có
    ["rock-awash", "obstruction"],
    ["rock-awash", "wreck"],
    ["rock-awash", "iso-danger"],
    // cấm neo vs cho neo — nhầm chiều này là neo đúng chỗ cấm
    ["no-anchor", "anchorage"],
    ["no-anchor", "harbour"],
    // dấu ống / cáp cập bờ không được trông như "báo hiệu chưa rõ"
    ["pipeline-mark", "aid-unknown"],
    ["cable-landing", "aid-unknown"],
    ["cable-landing", "pipeline-mark"],
  ])("bóng của %s khác hẳn bóng của %s", (a, b) => {
    const d = differ(silhouette(a), silhouette(b));
    expect(d, `"${a}" và "${b}" chỉ khác nhau ${(d * 100).toFixed(0)}% về HÌNH`).toBeGreaterThan(0.25);
  });
});

/* ── 6e. ĐỊA DANH NGẦM (Thông tư 33/2024) — 2026-09 ─────────────────────── */

describe("ký hiệu địa danh ngầm", () => {
  const TERRAIN = ["seamount", "knoll", "ridge", "guyot", "deep", "valley", "escarpment"] as const;

  it("bảy hình có trong sprite 1x lẫn @2x, không rỗng, không -lit", () => {
    for (const id of TERRAIN) {
      expect(SHEET_1X[id], `"${id}" thiếu trong sprite 1x`).toBeTruthy();
      expect(SHEET_2X[id], `"${id}" thiếu trong sprite @2x`).toBeTruthy();
      expect(SHEET_2X[`${id}-lit`], `"${id}-lit" là ô vô nghĩa — địa hình không có đèn`).toBeUndefined();
      const c = cellOf(PNG_2X, SHEET_2X[id]);
      let ink = 0;
      for (let i = 3; i < c.px.length; i += 4) if (c.px[i] > 200) ink++;
      expect(ink, `"${id}" gần như trống (${ink} px)`).toBeGreaterThan(60);
    }
  });

  it("13 mã loai → ký hiệu; loại hiếm gom theo hình dạng; lạ → knoll", () => {
    expect(diaDanhNgamSymbolId("nui")).toBe("seamount");
    expect(diaDanhNgamSymbolId("day")).toBe("seamount");
    expect(diaDanhNgamSymbolId("doi")).toBe("knoll");
    expect(diaDanhNgamSymbolId("song")).toBe("ridge");
    expect(diaDanhNgamSymbolId("guyot")).toBe("guyot");
    expect(diaDanhNgamSymbolId("ho")).toBe("deep");
    expect(diaDanhNgamSymbolId("thunglung")).toBe("valley");
    expect(diaDanhNgamSymbolId("hem")).toBe("valley");
    expect(diaDanhNgamSymbolId("kenh")).toBe("valley");
    expect(diaDanhNgamSymbolId("vach")).toBe("escarpment");
    expect(diaDanhNgamSymbolId("doc")).toBe("escarpment");
    expect(diaDanhNgamSymbolId("deo")).toBe("escarpment");
    expect(diaDanhNgamSymbolId("baivenbo")).toBe("bank"); // dùng lại icon bãi cạn
    expect(diaDanhNgamSymbolId(" Doi ")).toBe("knoll");
    expect(diaDanhNgamSymbolId("ma_moi")).toBe("knoll");
    expect(diaDanhNgamSymbolId("")).toBe("knoll");
    expect(diaDanhNgamSymbolId(undefined as unknown as string)).toBe("knoll");
  });

  it("mọi mã DiaDanhNgamLoai đều ra ký hiệu có thật trong sprite", async () => {
    const { DIA_DANH_NGAM_LABEL } = await import("../dia-danh-ngam");
    for (const loai of Object.keys(DIA_DANH_NGAM_LABEL)) {
      const id = diaDanhNgamSymbolId(loai);
      expect(SHEET_2X[id], `loai "${loai}" → "${id}" không có trong sprite`).toBeTruthy();
    }
  });

  it.each([
    // địa hình thuần thông tin KHÔNG được nhầm với ba icon rạn/bãi/đá
    ...TERRAIN.flatMap((t) => [
      [t, "bank"],
      [t, "rock-awash"],
      [t, "coral-reef"],
    ]),
    // và các dáng lồi/lõm phải khác nhau — không thì bảy icon là một
    ["seamount", "guyot"],
    ["seamount", "ridge"],
    ["seamount", "knoll"],
    ["knoll", "guyot"],
    ["ridge", "guyot"],
    ["deep", "valley"],
    ["deep", "escarpment"],
    ["valley", "escarpment"],
  ])("bóng của %s khác hẳn bóng của %s", (a, b) => {
    const d = differ(silhouette(a), silhouette(b));
    expect(d, `"${a}" và "${b}" chỉ khác nhau ${(d * 100).toFixed(0)}% về HÌNH`).toBeGreaterThan(0.25);
  });
});

/* ── 6e. TRẠM CON NƯỚC — CỘT NƯỚC (2026-09-04) ──────────────────────────── */

describe("ký hiệu trạm con nước (cột nước, kiểu máy hải đồ)", () => {
  it("18 ô có trong sprite 1x lẫn @2x, không rỗng, không -lit", () => {
    expect(TIDE_ICON_IDS).toHaveLength(18);
    for (const id of TIDE_ICON_IDS) {
      expect(SHEET_1X[id], `thiếu ${id} 1x`).toBeTruthy();
      expect(SHEET_2X[id], `thiếu ${id} @2x`).toBeTruthy();
      expect(SHEET_2X[`${id}-lit`], `${id} không được có -lit`).toBeUndefined();
      let ink = 0;
      const c = cellOf(PNG_2X, SHEET_2X[id]);
      for (let i = 3; i < c.px.length; i += 4) if (c.px[i] > 200) ink++;
      expect(ink, `${id} gần rỗng`).toBeGreaterThan(200);
    }
  });

  it("tideSymbolId: chiều + mực + ước tính → đúng id có thật", () => {
    expect(tideSymbolId("len", 0.1, false)).toBe("tide-up-1");
    expect(tideSymbolId("len", 0.5, false)).toBe("tide-up-2");
    expect(tideSymbolId("xuong", 0.9, false)).toBe("tide-down-3");
    expect(tideSymbolId("dung", NaN, true)).toBe("tide-flat-2-uoc");
    expect(tideSymbolId("len", 1.4, true)).toBe("tide-up-3-uoc");
    for (const t of ["len", "xuong", "dung"] as const)
      for (const f of [0, 0.5, 1])
        for (const m of [false, true]) expect(SHEET_2X[tideSymbolId(t, f, m)]).toBeTruthy();
  });

  it("mực nước cao thì cột đầy hơn — đếm pixel màu ruột", () => {
    const ruot = (id: string) => {
      const c = cellOf(PNG_2X, SHEET_2X[id]);
      let n = 0;
      for (let i = 0; i < c.px.length; i += 4) {
        // pixel xanh dương/đỏ đặc (không phải trắng, không phải INK)
        if (c.px[i + 3] > 250 && !(c.px[i] > 240 && c.px[i + 1] > 240) && c.px[i] + c.px[i + 1] + c.px[i + 2] > 120) n++;
      }
      return n;
    };
    expect(ruot("tide-up-1")).toBeLessThan(ruot("tide-up-2"));
    expect(ruot("tide-up-2")).toBeLessThan(ruot("tide-up-3"));
    // ước tính kẻ sọc ⇒ ít pixel màu hơn bản đặc cùng mực
    expect(ruot("tide-up-3-uoc")).toBeLessThan(ruot("tide-up-3"));
  });

  /*  Lên/xuống cùng một BÓNG cột (chỉ khác màu ruột + chiều mũi tên) là cố ý:
      cùng một vật, hai trạng thái — nên không so bóng hai cái với nhau. Cái
      phải khác bóng là các ký hiệu CỘT/TRỤ khác đang có trong bộ. */
  it.each([
    ["tide-up-2", "pile"],
    ["tide-up-2", "mooring"],
    ["tide-flat-2", "gate"],
    ["tide-up-3", "platform"],
  ])("bóng của %s khác bóng của %s", (a, b) => {
    const d = differ(silhouette(a), silhouette(b));
    expect(d, `"${a}" và "${b}" chỉ khác nhau ${(d * 100).toFixed(0)}% về HÌNH`).toBeGreaterThan(0.2);
  });

  it("màu nhãn trạm (ocean-map) = BLUE của bảng màu sprite", async () => {
    const m = await import("../ocean-map");
    expect(m.TIDE_STATION_COLOR).toBe(CHART_PALETTE.blue);
  });
});

/* ── 6f. MỌI KÝ HIỆU ĐÃ CHỐT KHOÁ TỪNG PIXEL ──────────────────────────────
   Thêm ô vào tấm sprite là toạ độ mọi ô đổi ⇒ hash CẢ FILE đổi là chuyện
   đương nhiên, không nói lên gì. Cái phải bất biến là PIXEL TRONG TỪNG Ô:
   mỗi ô rasterise riêng từ SVG của nó, không phụ thuộc vị trí. Bảng dưới chốt
   2026-09-03 (sha256 16 hex đầu của ô 1x nối ô @2x): 74 ký hiệu gốc + 6 rạn/
   công trình + 7 địa danh ngầm. Đổi một hình có chủ ý thì cập nhật đúng dòng
   đó trong CÙNG commit — đổi "tình cờ" (sửa helper dùng chung, đổi K, đổi
   màu) thì lộ ra ở đây, không phải ngoài biển. Thêm hình mới: thêm dòng. */
const LOCKED_CELLS: Record<string, string> = {
  "aid-unknown": "1af26907bdedab64",
  "aid-unknown-lit": "b49140c696ea5f0d",
  anchorage: "6a56389f8acd34db",
  bank: "b1eab7810a165aef",
  "bcn-card-e": "db1aaab790a4fa41",
  "bcn-card-e-lit": "f10cf6198872ef57",
  "bcn-card-n": "1f164fdd7519f787",
  "bcn-card-n-lit": "5b13e93ddd60de47",
  "bcn-card-s": "7cde16872e4118e7",
  "bcn-card-s-lit": "42545a48e27bfae9",
  "bcn-card-unknown": "175f26a0262438ed",
  "bcn-card-unknown-lit": "7bbb48c798f31984",
  "bcn-card-w": "2c00184fc533bb3b",
  "bcn-card-w-lit": "b31283fae01a26ea",
  "bcn-iso-danger": "9e16d52fdeb23ab0",
  "bcn-iso-danger-lit": "9d352e88b9736a00",
  "bcn-lat-port": "887a410b0e88332d",
  "bcn-lat-port-lit": "9a8bf19074f01ee3",
  "bcn-lat-stbd": "3fe66c7bc9b7e1c5",
  "bcn-lat-stbd-lit": "da93538a7f6d51b1",
  "bcn-lat-unknown": "48c85fef95a7faaf",
  "bcn-lat-unknown-lit": "f99ab6afe55428a4",
  "bcn-safe-water": "b11fa24915faf28f",
  "bcn-safe-water-lit": "6deb1d97042ed083",
  "bcn-special": "8c1d2ea19cf9cf87",
  "bcn-special-lit": "c7c49be52a6864e8",
  beacon: "4a52b92120773860",
  "beacon-lit": "8b77d24ed55472c2",
  "cable-landing": "f8ca34733f9dbd5b",
  "card-e": "e70d4814b31af07a",
  "card-e-lit": "22cd361601f3ed52",
  "card-n": "0eedf86a4da337c1",
  "card-n-lit": "25f564b1cba3498d",
  "card-s": "027b75c591134c21",
  "card-s-lit": "7e2bcf1301fd27d2",
  "card-unknown": "71a56d5710c20298",
  "card-unknown-lit": "ddc5402a0afbab25",
  "card-w": "7c34411ec7f24c12",
  "card-w-lit": "fb11cffed1b65bfb",
  "coral-reef": "5783e523cc3a6bbb",
  deep: "01241a9a716266d6",
  escarpment: "a3f8edcebc57a6f0",
  gate: "4fd539ac96056594",
  guyot: "2fda2d75ddd23c02",
  harbour: "1d0773f4058cc6bd",
  installation: "04430ac4eb12e355",
  "installation-lit": "33e19315c9ffa4fd",
  "iso-danger": "f357d29a2e93e96c",
  "iso-danger-lit": "a7a7d2bbcf46315b",
  knoll: "b2faf4c25bda87ed",
  landmark: "60215378cd88f70f",
  "lat-port": "8055f07b55c028fb",
  "lat-port-lit": "f9d7b5b6abb80f9c",
  "lat-pref-port": "e53a251152082976",
  "lat-pref-port-lit": "2516cc3a58cee7bc",
  "lat-pref-stbd": "593548173c0d89bc",
  "lat-pref-stbd-lit": "019068cf50d0acab",
  "lat-stbd": "35f2bce8c6a3749e",
  "lat-stbd-lit": "1fb6b69780e6608d",
  "lat-unknown": "a6aecdc2d1f0e803",
  "lat-unknown-lit": "8699837012fdfb41",
  "light-float": "448d5adfe860631b",
  "light-major": "c8ad81594196ff67",
  "light-minor": "06873b36af66a8c8",
  "light-vessel": "8ca02d5e27eaeb0a",
  lighthouse: "1ad15c381252af0b",
  "marine-farm": "89c05893de7879cf",
  mooring: "59ed42f0568db066",
  "mooring-lit": "e1b3b14dce440756",
  "no-anchor": "e977c1ff3271e198",
  obstruction: "1ee3732c48214311",
  pile: "cff964d89a65cd8d",
  "pile-lit": "eefaf2f8a4421bb5",
  "pipeline-mark": "4a03aaa5edde5744",
  platform: "eb50291e0de980e3",
  "platform-lit": "ac8aaaffb302b0b3",
  ridge: "ac9d7fbe6c242e8a",
  "rock-awash": "20989bf23ae2cb5b",
  "safe-water": "4697b915a7c96f50",
  "safe-water-lit": "8e56aa2ff16b1a0a",
  seamount: "b4ccd161053519bc",
  special: "8bc906850d5cb590",
  "special-lit": "c0209f6eed307856",
  valley: "a64c18d59325dc51",
  "virtual-aton": "a6a11dddb78b6f1e",
  wreck: "eb6bbc053ac6262c",
  "wreck-depth": "1cb5068266a3148c",
  // trạm con nước — cột nước (2026-09-04): 3 chiều × 3 mực × {đo, ước tính}
  "tide-up-1": "a225361944ee96d8",
  "tide-up-1-uoc": "4e3d198fece5b3a7",
  "tide-up-2": "feb6e5674978b419",
  "tide-up-2-uoc": "bb1d88c66bf057de",
  "tide-up-3": "6792c85889f31a28",
  "tide-up-3-uoc": "7e37eb8e82645755",
  "tide-down-1": "c741b34cf3ab0fab",
  "tide-down-1-uoc": "af232508418339c2",
  "tide-down-2": "f551171f86f62266",
  "tide-down-2-uoc": "d8c37c1f4025e0ae",
  "tide-down-3": "5d45c0e3a1e830d9",
  "tide-down-3-uoc": "5cbbaebd66ae896d",
  "tide-flat-1": "188fac2f9910e30c",
  "tide-flat-1-uoc": "01fc5cdb1dbe4b81",
  "tide-flat-2": "3275e7e1a7c8e082",
  "tide-flat-2-uoc": "8811fa8e02960ca4",
  "tide-flat-3": "3e4659f3cc6f9c87",
  "tide-flat-3-uoc": "1a0f52676e370e48",
};

describe("mọi ký hiệu đã chốt giữ nguyên từng pixel", () => {
  const cellHash = (id: string) =>
    createHash("sha256")
      .update(cellOf(PNG_1X, SHEET_1X[id]).px)
      .update(cellOf(PNG_2X, SHEET_2X[id]).px)
      .digest("hex")
      .slice(0, 16);

  it("bảng khoá phủ ĐỦ mọi ô trong sprite — thêm hình mà không khoá là lọt", () => {
    expect(Object.keys(LOCKED_CELLS).sort()).toEqual(Object.keys(SHEET_2X).sort());
    expect(Object.keys(LOCKED_CELLS)).toHaveLength(105);
  });

  it.each(Object.keys(LOCKED_CELLS))("%s: pixel y nguyên so với bản chốt", (id) => {
    expect(SHEET_1X[id] && SHEET_2X[id], `"${id}" đã BIẾN MẤT khỏi sprite`).toBeTruthy();
    expect(
      cellHash(id),
      `"${id}" đổi pixel so với bản chốt. Cố ý thì cập nhật LOCKED_CELLS cùng commit; ` +
        `không cố ý thì có helper/hằng dùng chung (K, màu, fixedBase…) vừa bị đụng.`,
    ).toBe(LOCKED_CELLS[id]);
  });
});

/* ── 7. SÀN CỠ CHỮ / CỠ HÌNH ────────────────────────────────────────────── */

describe("cỡ ký hiệu không được xuống dưới sàn đọc được", () => {
  it("sàn 16 px và cỡ gốc 24 px giữ nguyên", () => {
    expect(CHART_ICON_MIN_PX).toBeGreaterThanOrEqual(16);
    expect(CHART_ICON_BASE_PX).toBeGreaterThanOrEqual(CHART_ICON_MIN_PX);
  });

  it("mọi nấc zoom của icon-size đều trên sàn", () => {
    const stops = CHART_ICON_SIZE.slice(3) as unknown as number[];
    for (let i = 1; i < stops.length; i += 2) {
      const px = stops[i] * CHART_ICON_BASE_PX;
      expect(
        px,
        `ở zoom ${stops[i - 1]} ký hiệu chỉ còn ${px.toFixed(1)} px — dưới sàn ` +
          `${CHART_ICON_MIN_PX} px thì hình phức tạp không phân biệt được trên tàu lắc. ` +
          `Muốn nhỏ hơn thì ĐỪNG VẼ NỮA (nâng minzoom của lớp), đừng thu nhỏ.`,
      ).toBeGreaterThanOrEqual(CHART_ICON_MIN_PX);
    }
    expect(stops[stops.length - 1] * CHART_ICON_BASE_PX).toBe(CHART_ICON_BASE_PX);
  });

  it("ô sprite @2x đủ pixel cho cỡ gốc trên màn hình dpr 2", () => {
    const cell = Object.values(SHEET_2X)[0];
    expect(cell.width / cell.pixelRatio).toBe(CHART_ICON_BASE_PX);
  });
});

/*
  ĐÃ NỐI VÀO BẢN ĐỒ CHƯA (2026-09-01).

  Mọi test phía trên chứng minh bộ ký hiệu ĐÚNG. Không cái nào chứng minh nó
  được DÙNG — và đó đúng là chỗ đã hỏng: bốn file sprite sinh xong từ hôm trước,
  nằm trong `public/icons/`, mà `buildMapStyle` không có dòng `sprite` nào.

  Kiểu hỏng ở đây tệ hơn "không đẹp": MapLibre thiếu sprite thì **im lặng bỏ mọi
  icon-image**, không ném lỗi, không cảnh báo. Ba lớp báo hiệu biến mất khỏi bản
  đồ — mà chuyển từ `circle` sang `symbol` nghĩa là mất luôn cả chấm tròn cũ.
  Ngoài biển ban đêm, không phao nào hiện, không dòng lỗi nào.
*/
describe("bộ ký hiệu phải được NỐI, không chỉ nằm trong public/", () => {
  const root = process.cwd();
  const src = (p: string) => readFileSync(path.join(root, p), "utf8");
  const strip = (s: string) =>
    s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

  it("style KHAI BÁO sprite — thiếu là mọi ký hiệu câm lặng", async () => {
    const { buildMapStyle } = await import("../ocean-map");
    for (const layerId of ["bathymetry", "sst", "chlorophyll", null] as const) {
      const style = buildMapStyle(layerId, new Date("2026-06-10T12:00:00Z")) as {
        sprite?: string;
      };
      expect(
        style.sprite,
        `layerId=${layerId}: style thiếu 'sprite' ⇒ MapLibre bỏ mọi icon-image mà KHÔNG kêu`,
      ).toBeTruthy();
    }
  });

  it("ba lớp báo hiệu vẽ bằng KÝ HIỆU, không phải chấm tròn", () => {
    const v = strip(src("src/components/fishing-map-view.tsx"));
    expect(v, "chưa gắn icon-image cho lớp báo hiệu").toContain('"icon-image"');
    expect(v, "chưa tính sẵn tên ký hiệu vào thuộc tính").toContain("chartSymbolId(");
  });

  it("bốn file sprite nằm trong vỏ SỐNG-CÒN — mất sóng vẫn vẽ được phao", () => {
    const sw = src("public/sw.js");
    const critical = sw.slice(
      sw.indexOf("const CRITICAL_SHELL"),
      sw.indexOf("const SHELL"),
    );
    for (const f of [
      "/icons/chart-sprite.png",
      "/icons/chart-sprite.json",
      "/icons/chart-sprite@2x.png",
      "/icons/chart-sprite@2x.json",
    ])
      expect(
        critical,
        `${f} chưa vào vỏ — ngoài khơi mất sóng là mất TRẮNG cả lớp báo hiệu`,
      ).toContain(f);
  });
});

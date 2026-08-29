import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { hasForbiddenChars, coordInVNSea, FORBIDDEN_NAME_RE } from "../islands";
import {
  SEAMARK_LABEL,
  seamarkLabel,
  colourLabel,
  parseLightString,
  describeLight,
  describeSeamark,
  decodeSeamarks,
  type SeamarkFile,
  type SeamarkType,
} from "../seamarks";

const FILE = join(process.cwd(), "public", "data", "seamarks.v1.json");
const rawText = readFileSync(FILE, "utf8");
const data = JSON.parse(rawText) as SeamarkFile;
const marks = decodeSeamarks(data);

/* ── DATASET THẬT ĐANG SHIP ──────────────────────────────────────────────── */

describe("dataset seamarks.v1.json — báo hiệu hàng hải ship thật", () => {
  it("giải mã ra đủ báo hiệu (sinh lại không được làm rơi lớp báo hiệu)", () => {
    expect(data.v).toBe(1);
    expect(marks.length).toBe(data.marks.length);
    expect(marks.length).toBeGreaterThanOrEqual(5000);
  });

  // ── CHỦ QUYỀN ────────────────────────────────────────────────────────────
  // File sinh từ OSM — vùng tranh chấp gắn tên nước ngoài/chữ Hán. Quét cả file
  // thô, không chỉ những field mình nhớ tới.
  it("KHÔNG một ký tự Hán/CJK nào trong TOÀN BỘ file (quét chuỗi thô)", () => {
    const hit = rawText.match(FORBIDDEN_NAME_RE);
    expect(
      hasForbiddenChars(rawText),
      hit ? `ký tự "${hit[0]}" ở vị trí ${hit.index}` : "",
    ).toBe(false);
  });

  it("KHÔNG có trường tên nào lọt vào file (name / seamark:name bị bỏ lúc sinh)", () => {
    expect(rawText).not.toContain('"name"');
    expect(rawText).not.toContain("seamark:name");
    expect(rawText).not.toContain("national_name");
  });

  // ── NHÃN TIẾNG VIỆT ──────────────────────────────────────────────────────
  it("MỌI loại trong file đều có nhãn tiếng Việt — không rơi ra chuỗi Anh thô", () => {
    expect(data.types.length).toBeGreaterThan(0);
    for (const t of data.types) {
      expect(
        Object.keys(SEAMARK_LABEL),
        `loại "${t}" chưa có nhãn tiếng Việt trong SEAMARK_LABEL`,
      ).toContain(t);
      const label = seamarkLabel(t);
      expect(label).not.toBe(t);
      expect(label).not.toBe("Báo hiệu hàng hải"); // không được rơi về mặc định
      // không sót jargon hàng hải tiếng Anh trong câu bà con đọc
      expect(label).not.toMatch(
        /\b(buoy|beacon|light|lateral|cardinal|aton|landmark|harbour|mooring|platform|farm|gate|anchorage|pile)\b/i,
      );
      expect(label).not.toContain("_");
    }
  });

  it("MỌI màu trong file dịch được sang tiếng Việt (không in chữ Anh lên màn hình)", () => {
    for (const c of data.colours) {
      const vi = colourLabel(c);
      expect(vi, `màu "${c}" chưa có từ tiếng Việt`).not.toBe("");
      expect(vi.split("–").length).toBe(c.split(";").length);
      expect(vi).not.toMatch(
        /\b(white|red|green|yellow|black|blue|grey|gray|orange|amber|violet|magenta)\b/i,
      );
    }
  });

  it("MỌI đặc tính đèn trong file dịch được thành câu tiếng Việt", () => {
    for (const ch of data.chars) {
      const câu = describeLight({ character: ch });
      expect(câu, `đặc tính "${ch}" chưa có câu tiếng Việt`).not.toBe("");
      expect(câu).not.toBe(ch);
      // không sót viết tắt hải đồ (Fl, Oc, Iso, VQ…) trong câu bà con đọc
      expect(câu).not.toMatch(/\b(Fl|Oc|Iso|VQ|UQ|IQ|LFl|FFl|Al|Q)\b/);
    }
  });

  // ── TOẠ ĐỘ ───────────────────────────────────────────────────────────────
  it("MỌI toạ độ nằm trong khung biển VN", () => {
    for (const m of marks) {
      expect(
        coordInVNSea(m.lon, m.lat),
        `toạ độ ngoài khung VN [${m.lon},${m.lat}]`,
      ).toBe(true);
    }
  });

  it("toạ độ làm tròn 5 số thập phân (~1 m — báo hiệu cần chính xác hơn rạn)", () => {
    for (const m of marks) {
      expect(Number(m.lon.toFixed(5))).toBe(m.lon);
      expect(Number(m.lat.toFixed(5))).toBe(m.lat);
    }
  });

  // ── NGÂN SÁCH OFFLINE ────────────────────────────────────────────────────
  it("cỡ file trong ngân sách 400 KB (tải qua sóng 3G ngoài khơi)", () => {
    const bytes = Buffer.byteLength(rawText);
    expect(
      bytes,
      `${Math.round(bytes / 1024)} KB — vượt trần thì HỎI LEAD, đừng tự nâng`,
    ).toBeLessThanOrEqual(400 * 1024);
  });

  // ── LỌC THEO GIÁ TRỊ ĐI BIỂN ─────────────────────────────────────────────
  it("bỏ thứ chỉ có nghĩa trong bến cảng (berth…), giữ thứ ngoài khơi cần", () => {
    expect(data.types).not.toContain("berth");
    expect(data.types).not.toContain("small_craft_facility");
    const PHAI_CO = [
      "buoy_lateral",
      "light_major",
      "marine_farm",
      "virtual_aton",
    ];
    for (const t of PHAI_CO) {
      expect(data.types, `thiếu loại quan trọng: ${t}`).toContain(t);
    }
  });

  it("mốc trên bờ (landmark) chỉ giữ cái CÓ ĐÈN — 2.100 mốc trơn không vào file", () => {
    const landmarks = marks.filter((m) => m.type === "landmark");
    expect(landmarks.length).toBeGreaterThan(0);
    // 107 cái có đèn / 2.104 mốc trong khung — lọt quá nhiều là filter hỏng
    expect(landmarks.length).toBeLessThan(300);
    // Vài mốc chỉ khai `seamark:light:height` (vẫn là mốc CÓ đèn, nhưng không
    // có phần nào dựng được câu) → không đòi 100%, đòi đại đa số.
    const lit = landmarks.filter((m) => m.light);
    expect(lit.length / landmarks.length).toBeGreaterThan(0.8);
  });

  it("dữ liệu đèn thật đọc lên thành câu có nghĩa (không rỗng hàng loạt)", () => {
    const lit = marks.filter((m) => m.light?.character);
    expect(lit.length).toBeGreaterThanOrEqual(3000);
    for (const m of lit.slice(0, 200)) {
      expect(describeLight(m.light)).not.toBe("");
      // mở đầu bằng nhãn tiếng Việt, không phải chuỗi loại của OSM
      expect(describeSeamark(m).startsWith(seamarkLabel(m.type))).toBe(true);
      expect(describeSeamark(m)).not.toMatch(/[_;]/);
    }
  });
});

/* ── DỊCH ĐẶC TÍNH ĐÈN ───────────────────────────────────────────────────── */

describe("describeLight — dịch đặc tính đèn sang câu bà con đọc được", () => {
  it("nuốt được chuỗi hải đồ đầy đủ", () => {
    expect(describeLight("Fl(2)W.10s14M")).toBe(
      "Chớp 2 nhịp, ánh trắng, 10 giây một vòng, xa 14 hải lý",
    );
    expect(describeLight("Oc(3)W.15s10M")).toBe(
      "Sáng liên tục, ngắt 3 nhịp, ánh trắng, 15 giây một vòng, xa 10 hải lý",
    );
    expect(describeLight("LFl.W.10s")).toBe(
      "Chớp dài, ánh trắng, 10 giây một vòng",
    );
    expect(describeLight("Q.R")).toBe("Chớp nhanh, ánh đỏ");
    expect(describeLight("F.R")).toBe("Sáng liên tục, ánh đỏ");
    expect(describeLight("Iso.4s")).toBe(
      "Sáng và tắt đều nhau, 4 giây một vòng",
    );
    expect(describeLight("VQ(9)10s")).toBe(
      "Chớp rất nhanh 9 nhịp, 10 giây một vòng",
    );
    expect(describeLight("Mo(A)W")).toBe(
      "Chớp theo tín hiệu Morse chữ A, ánh trắng",
    );
    expect(describeLight("Fl(2+1)R.6s")).toBe(
      "Chớp 2 nhịp rồi 1 nhịp, ánh đỏ, 6 giây một vòng",
    );
  });

  it("nuốt được dạng tách sẵn của OSM (mẫu THẬT trong file)", () => {
    // [lon,lat, buoy_lateral, Fl, "2", red, 6s, 5M, thân đỏ] — phao luồng Bạch Long Vĩ
    expect(
      describeLight({
        character: "Fl",
        group: "2",
        colour: "red",
        period: 6,
        range: 5,
      }),
    ).toBe("Chớp 2 nhịp, ánh đỏ, 6 giây một vòng, xa 5 hải lý");
    expect(
      describeSeamark({
        lon: 109.81272,
        lat: 20.50378,
        type: "buoy_lateral",
        colour: "red",
        light: { character: "Fl", group: "2", colour: "red", period: 6 },
      }),
    ).toBe("Phao luồng · thân đỏ · Chớp 2 nhịp, ánh đỏ, 6 giây một vòng");
  });

  it("KHÔNG bịa khi nguồn để trống — thiếu phần nào bỏ phần đó", () => {
    expect(describeLight()).toBe("");
    expect(describeLight("")).toBe("");
    expect(describeLight({})).toBe("");
    expect(describeLight({ period: 0, range: 0 })).toBe("");
    expect(describeLight({ character: "Fl" })).toBe("Chớp");
    expect(describeLight({ colour: "white" })).toBe("ánh trắng");
  });

  it("dấu chấm phân cách KHÔNG bị đọc thành số lẻ (\".15s\" ≠ 0,15 giây)", () => {
    expect(parseLightString("Oc(3)W.15s10M")).toEqual({
      character: "Oc",
      group: "3",
      colour: "white",
      period: 15,
      range: 10,
    });
    // `m` thường = chiều cao đèn, KHÔNG phải hải lý — không được nhận nhầm
    expect(parseLightString("Fl.W.5s20m").range).toBeUndefined();
  });

  it("loại lạ không lộ chuỗi tiếng Anh ra màn hình", () => {
    expect(seamarkLabel("cargo_terminal_9000")).toBe("Báo hiệu hàng hải");
    expect(colourLabel("chartreuse")).toBe("");
  });
});

/* ── GIẢI MÃ ─────────────────────────────────────────────────────────────── */

describe("decodeSeamarks — hàng hỏng không được làm mất cả lớp", () => {
  const table: SeamarkFile = {
    v: 1,
    types: ["buoy_lateral"] as SeamarkType[] as string[],
    chars: ["Fl"],
    groups: ["2"],
    colours: ["red"],
    marks: [],
  };

  it("bỏ qua hàng thiếu/hỏng, giữ hàng lành", () => {
    const got = decodeSeamarks({
      ...table,
      marks: [
        [108.1, 12.2, 0], // đủ ngắn — phao không đèn
        [108.2, 12.3], // thiếu loại → bỏ
        [108.3, 12.4, 9], // chỉ số loại ngoài bảng → bỏ
        ["x", 12.5, 0] as unknown as number[], // toạ độ hỏng → bỏ
        [108.5, 12.6, 0, 0, 0, 0, 6, 5, 0], // đủ phần
      ],
    });
    expect(got.length).toBe(2);
    expect(got[0]).toEqual({ lon: 108.1, lat: 12.2, type: "buoy_lateral" });
    expect(got[1].light).toEqual({
      character: "Fl",
      group: "2",
      colour: "red",
      period: 6,
      range: 5,
    });
    expect(got[1].colour).toBe("red");
  });

  it("đầu vào rác trả mảng rỗng thay vì ném (mất lớp ≠ sập bản đồ)", () => {
    expect(decodeSeamarks(null)).toEqual([]);
    expect(decodeSeamarks({})).toEqual([]);
    expect(decodeSeamarks({ marks: "nope" })).toEqual([]);
  });
});

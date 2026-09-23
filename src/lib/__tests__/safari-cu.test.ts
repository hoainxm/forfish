import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { parseCoordinate, parseSoundingRow, ocrCoordLine } from "@/lib/soundings";

/*  CỔNG "MÁY CŨ CỦA BÀ CON CÒN MỞ ĐƯỢC APP KHÔNG"
    ────────────────────────────────────────────────────────────────────────────
    SỰ CỐ THẬT 2026-09-04: ảnh báo về từ Bình Định — iPhone 12, vào tab "Ra khơi"
    ra MÀN HÌNH TRẮNG TRƠN, chỉ còn cái dock. Gốc: `lib/soundings.ts` dùng regex
    LOOKBEHIND. Safari chỉ hiểu lookbehind từ 16.4 (03/2023); máy cũ hơn ném
    `SyntaxError` lúc PARSE nguyên file .js chứa nó. File đó nằm trong chunk lazy
    của `fishing-map-view` ⇒ bản đồ không mount ⇒ trắng, và KHÔNG một chữ báo
    lỗi, vì lỗi parse không rơi vào error boundary của React.

    Vì sao phải là CỔNG QUÉT chứ không phải vài ca test: lookbehind chết ở tầng
    PARSE, nên chỉ cần một người viết lại nó ở BẤT KỲ file nào trong `src/` là
    cả màn trắng lại — mà `npm test` vẫn xanh 100%, vì Node hiểu lookbehind từ
    lâu. Không có cổng này thì lỗi chỉ lộ ở đúng chỗ không ai kiểm: điện thoại
    của bà con, ngoài biển.

    Ngưỡng là KHÔNG, và danh sách nợ cố ý không tồn tại — một chỗ dùng là một
    màn trắng, không có mức "chấp nhận được".

    HAI CHI TIẾT KỸ THUẬT, đừng "dọn" mất:
    · khuôn dò dựng bằng `new RegExp(...)` chứ không viết literal — viết literal
      thì chính file này chứa chuỗi bị cấm và cổng tự bắt mình;
    · quét trên bản ĐÃ BÓC CHÚ THÍCH — cảnh báo "đừng viết lookbehind" trong
      comment của `soundings.ts` là thứ phải GIỮ, không phải thứ phải chặn. */

const SRC = join(process.cwd(), "src");

function moiFileNguon(dir: string, ra: string[] = []): string[] {
  for (const ten of readdirSync(dir)) {
    const p = join(dir, ten);
    if (statSync(p).isDirectory()) moiFileNguon(p, ra);
    else if (/\.(ts|tsx)$/.test(ten)) ra.push(p);
  }
  return ra;
}

/** Bóc chú thích để cảnh báo trong comment không bị tính là chỗ dùng thật. */
function bocChuThich(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    // `[^:]` chừa `https://…` trong chuỗi ra, đừng cắt nhầm nửa dòng
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/** Cú pháp Safari <16.4 ném lỗi NGAY LÚC PARSE — tức giết cả file, cả chunk. */
const CHET_LUC_PARSE: Array<{ ten: string; khuon: RegExp; tuKhi: string }> = [
  { ten: "regex lookbehind", khuon: new RegExp("\\(\\?<[=!]"), tuKhi: "Safari 16.4" },
  { ten: "khối `static { }` trong class", khuon: /^\s*static\s*\{/m, tuKhi: "Safari 16.4" },
];

describe("máy cũ: cú pháp giết cả chunk", () => {
  const files = moiFileNguon(SRC);

  it("quét được cây nguồn (cổng không rỗng ruột)", () => {
    expect(files.length).toBeGreaterThan(100);
  });

  for (const { ten, khuon, tuKhi } of CHET_LUC_PARSE) {
    it(`không file nguồn nào dùng ${ten} (chỉ có từ ${tuKhi})`, () => {
      const dinh = files
        .filter((f) => khuon.test(bocChuThich(readFileSync(f, "utf8"))))
        .map((f) => relative(process.cwd(), f));
      expect(dinh, `${dinh.join(", ")} — máy cũ sẽ ra màn trắng`).toEqual([]);
    });
  }
});

/*  Bản vá bỏ lookbehind phải GIỮ NGUYÊN nghĩa: "khuôn toạ độ không được bắt đầu
    ở giữa một con số khác". Các ca dưới là đúng cái bẫy mà lookbehind sinh ra để
    chặn — cột ĐỘ SÂU đứng ngay trước cột toạ độ trong bảng thông báo hàng hải.
    Mất chốt này thì `7,5 10°44'…` đọc ra 510 độ, hoặc tệ hơn: ra một toạ độ
    TRÔNG HỢP LỆ ở sai chỗ, đặt một điểm cạn vào chỗ không có thật. */
describe("chốt 'không bắt đầu giữa một con số' sau khi bỏ lookbehind", () => {
  // 10 + 44/60 + 39,04/3600 · 106 + 44/60 + 42,29/3600
  const LAT = 10.744178;
  const LON = 106.745081;

  it("không nuốt chữ số của cột đứng trước", () => {
    // "5" của độ sâu 7,5 không được ghép vào "10" thành 510 độ
    expect(parseCoordinate(`7,5 10°44'39,04"N`, "lat")).toBeCloseTo(LAT, 5);
  });

  it("vẫn đọc đúng toạ độ đứng một mình", () => {
    expect(parseCoordinate(`10°44'39,04"N`, "lat")).toBeCloseTo(LAT, 5);
    expect(parseCoordinate(`106°44'42,29"E`, "lon")).toBeCloseTo(LON, 5);
  });

  it("hàng bảng có cột độ sâu vẫn ra đúng cặp", () => {
    const row = parseSoundingRow(`7,5 10°44'39,04"N 106°44'42,29"E`);
    expect(row).not.toBeNull();
    expect(row!.depthM).toBe(7.5);
    expect(row!.pairs).toHaveLength(1);
    expect(row!.pairs[0].lat).toBeCloseTo(LAT, 5);
    expect(row!.pairs[0].lon).toBeCloseTo(LON, 5);
  });

  it("hai toạ độ DÍNH LIỀN không mất cái thứ hai", () => {
    /*  Đây là lý do KHÔNG được thay lookbehind bằng một nhóm ĂN ký tự kiểu
        `(?:^|[^\d.,])`: cách đó nuốt mất ký tự phân cách, nên cái thứ hai
        trượt. Chốt kiểm-ký-tự-đứng-trước thì không. */
    const row = parseSoundingRow(`10°44'39,04"N106°44'42,29"E`);
    expect(row).not.toBeNull();
    expect(row!.pairs).toHaveLength(1);
    expect(row!.pairs[0].lon).toBeCloseTo(LON, 5);
  });

  it("ocrCoordLine vẫn chạy, không ném", () => {
    expect(() => ocrCoordLine("1044 39,04 10644 42,29")).not.toThrow();
  });
});

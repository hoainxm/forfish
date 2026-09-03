import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { buildMapStyle } from "@/lib/ocean-map";

/*
  NỀN BẢN ĐỒ VECTOR TRONG SERVICE WORKER — bẫy im lặng cần test canh.

  `pmtiles` xin từng lát bằng header `Range`. Cache API BỎ QUA header đó, nên
  nhánh asset tĩnh cũ sẽ trả nguyên 16,9 MB cho một yêu cầu xin 16 KB, và thư
  viện ném lỗi ("content-length exceeding request") ⇒ mất sóng giữa biển là mất
  nền bản đồ, mà không một dòng lỗi nào của app hiện ra. sw.js là file tĩnh
  (không import được), nên test đọc thẳng mã nguồn — y như sw-cache-policy.
*/

const sw = readFileSync(join(process.cwd(), "public", "sw.js"), "utf8");

/** Bốc hàm THUẦN `parseByteRange` ra khỏi sw.js để chạy thật */
function loadParseByteRange(): (
  header: string | null,
  size: number,
) => [number, number] | null {
  const m = sw.match(
    /function parseByteRange\(header, size\) \{[\s\S]*?\n\}/,
  );
  expect(m, "sw.js phải còn hàm parseByteRange").toBeTruthy();
  return new Function(`${m![0]}; return parseByteRange;`)() as never;
}

describe("parseByteRange — cắt lát đúng chuẩn byte serving", () => {
  const parse = loadParseByteRange();
  const SIZE = 16_882_044; // đúng cỡ vn-basemap.pmtiles hiện tại

  it("lát đầu (pmtiles luôn xin 16 KB đầu để đọc header)", () => {
    expect(parse("bytes=0-16383", SIZE)).toEqual([0, 16383]);
  });

  it("lát giữa file", () => {
    expect(parse("bytes=1000-1999", SIZE)).toEqual([1000, 1999]);
  });

  it("không có vế cuối → tới hết file", () => {
    expect(parse("bytes=100-", SIZE)).toEqual([100, SIZE - 1]);
  });

  it("dạng hậu tố `bytes=-N` = N byte CUỐI", () => {
    expect(parse("bytes=-100", SIZE)).toEqual([SIZE - 100, SIZE - 1]);
  });

  it("xin quá đuôi → cắt về đuôi, KHÔNG trả null (đúng RFC 7233)", () => {
    expect(parse(`bytes=${SIZE - 10}-${SIZE + 999}`, SIZE)).toEqual([
      SIZE - 10,
      SIZE - 1,
    ]);
  });

  it("VÔ LÝ → null (để nhánh phục vụ trả 416, đừng đoán bừa)", () => {
    expect(parse(`bytes=${SIZE}-`, SIZE)).toBeNull(); // bắt đầu ngoài file
    expect(parse("bytes=5-3", SIZE)).toBeNull(); // đầu sau cuối
    expect(parse("bytes=-0", SIZE)).toBeNull(); // hậu tố 0 byte
    expect(parse("bytes=-", SIZE)).toBeNull();
    expect(parse("bytes=abc-def", SIZE)).toBeNull();
    expect(parse("items=0-1", SIZE)).toBeNull(); // đơn vị khác byte
    expect(parse(null, SIZE)).toBeNull();
    expect(parse("", SIZE)).toBeNull();
  });

  it("nhiều khoảng (`bytes=0-1,5-6`) → null — ta CỐ Ý không hỗ trợ", () => {
    // pmtiles không bao giờ xin nhiều khoảng; đoán bừa ở đây là trả sai byte.
    expect(parse("bytes=0-1,5-6", SIZE)).toBeNull();
  });
});

describe("sw.js — mọi kho pmtiles phải sống qua bump vỏ và đứng trước nhánh tĩnh", () => {
  /** Danh sách kho .pmtiles đọc thẳng từ sw.js — nguồn sự thật duy nhất */
  const archives = (() => {
    const m = sw.match(/const PMTILES_ARCHIVES = \[([\s\S]*?)\];/);
    expect(m, "sw.js phải có const PMTILES_ARCHIVES").toBeTruthy();
    return [...m![1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
  })();

  it("nền bản đồ trong danh sách KHỚP url pmtiles:// của style", () => {
    const src = buildMapStyle(null, new Date("2026-06-10T12:00:00Z")).sources
      .basemap as { url?: string };
    expect(archives).toContain(String(src.url).replace("pmtiles://", ""));
  });

  /*  CỔNG CHỐNG TÁI PHÁT (2026-08-30) — cái bẫy suýt dính.

      Nhánh Range trước đây gắn cứng MỘT đường dẫn. Thêm file `.pmtiles` thứ
      hai mà quên sửa thì trên bàn làm việc VẪN XANH (có mạng, nhánh tĩnh trả
      200, trình duyệt tự xử lý Range) nhưng NGOÀI BIỂN mất sóng thì service
      worker trả nguyên file cho một yêu cầu xin 16 KB ⇒ `pmtiles` ném ⇒ lớp đó
      CHẾT HẲN, không một dòng lỗi nào tới tay bà con.

      Nên cổng này bắt theo hướng ngược lại: quét MỌI file `.pmtiles` có thật
      trong `public/data/`, file nào không nằm trong danh sách là ĐỎ. */
  it("MỌI file .pmtiles trong public/data đều nằm trong PMTILES_ARCHIVES", () => {
    const dir = join(process.cwd(), "public", "data");
    const onDisk = readdirSync(dir)
      .filter((f) => f.endsWith(".pmtiles"))
      .map((f) => `/data/${f}`);
    expect(onDisk.length, "không tìm thấy file .pmtiles nào — đọc nhầm chỗ?").toBeGreaterThan(0);
    for (const f of onDisk) {
      expect(
        archives,
        `'${f}' có trên đĩa nhưng KHÔNG nằm trong PMTILES_ARCHIVES của sw.js — ` +
          `mất sóng là lớp này chết câm. Thêm nó vào danh sách.`,
      ).toContain(f);
    }
  });

  it("KHO RIÊNG được chừa trong activate — bump vỏ KHÔNG xoá dữ liệu đã tải", () => {
    const block = sw.match(/addEventListener\("activate"[\s\S]*?\n\}\);/);
    expect(block).toBeTruthy();
    expect(block![0]).toContain("k !== SDFISH_BASEMAP_V");
  });

  it("nhánh pmtiles ĐỨNG TRƯỚC nhánh asset tĩnh cache-first", () => {
    const fetchHandler = sw.slice(sw.indexOf('addEventListener("fetch"'));
    const iPm = fetchHandler.indexOf("PMTILES_ARCHIVES.includes");
    const iStatic = fetchHandler.indexOf("// asset tĩnh → cache-first");
    expect(iPm).toBeGreaterThan(-1);
    expect(iStatic).toBeGreaterThan(-1);
    expect(iPm).toBeLessThan(iStatic);
  });

  it("CHỈ cất bản 200 — Cache API ném với 206, cất nhầm là hỏng kho", () => {
    const fill = sw.match(/function fillBasemapArchive\(path\)[\s\S]*?\n\}/);
    expect(fill).toBeTruthy();
    expect(fill![0]).toContain("res.status !== 200");
    // và lượt kéo về KHÔNG được kèm header Range
    expect(fill![0]).not.toContain("range");
  });
});

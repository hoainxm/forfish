/**
 * LỚP NÓI THẬT VỀ SỐ ĐO SÂU — cổng canh (2026-09-01).
 *
 * Hai chuyện file này canh, và cả hai đều là chuyện ĐÃ XẢY RA:
 *
 * 1. Bước đối chiếu chấm 17 điểm là NGHI LỖI (chữ số lẻ rơi mất lúc bóc PDF:
 *    7,7 m đọc thành 7 m ở 16/17 số của một thông báo). Kết luận đó nằm trong
 *    repo mà `src/` không đọc, nên bản đồ vẫn vẽ chúng như sự thật.
 *
 * 2. 147/149 điểm quá một năm tuổi rơi trúng dải 4–12 m — ĐÚNG dải ra quyết
 *    định của tàu mớn 1,5–3 m — mà lớp vẽ ra không mang một chữ nào về tuổi,
 *    và không chạm được để hỏi.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  decodeVerdicts,
  verdictKey,
  isStale,
  ageText,
  ageLine,
  SOUNDING_STALE_DAYS,
  SUSPECT,
  VERDICT_FILES,
} from "@/lib/soundings-verified";

/** Thân phản hồi dạng byte — fetchDataJson đọc arrayBuffer rồi giải mã (bản rõ trả nguyên). */
const jsonBytes = (o: unknown) => new TextEncoder().encode(JSON.stringify(o)).buffer;

const root = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");
const RAW = JSON.parse(read("public/data/soundings-verified.v1.json"));

describe("giải mã kết quả đối chiếu", () => {
  const idx = decodeVerdicts(RAW);

  it("đọc được mọi mục của file thật", () => {
    expect(idx.size).toBe(RAW.muc.length);
  });

  it("khoá tra gồm CẢ ba phần — thiếu file thì hai bộ đè lên nhau", () => {
    // `diem[3]` của soundings.v1.json và của soundings-cangvu.v1.json là hai
    // điểm khác nhau ở hai chỗ khác nhau trên biển.
    expect(verdictKey(0, "diem", 3)).not.toBe(verdictKey(1, "diem", 3));
    expect(idx.get(verdictKey(0, "diem", 0))).toBeTruthy();
  });

  it("thứ tự tệp nguồn khớp file thật — lệch một bậc là chấm nhầm cả bộ", () => {
    expect(RAW.tep).toEqual([...VERDICT_FILES]);
  });

  it("bỏ QUA mục hỏng thay vì ném — một dòng lỗi không làm mất cả lớp", () => {
    const bad = decodeVerdicts({
      muc: [
        { tep: 0, loai: "diem", i: 0, kq: "khop", tinCay: 80, bac: "A" },
        { tep: 0, loai: "khong-co-loai-nay", i: 1, kq: "khop" },
        { tep: "x", loai: "diem", i: 2, kq: "khop" },
        null,
      ],
    });
    expect(bad.size).toBe(1);
  });

  it("dữ liệu rác trả bảng RỖNG, không ném", () => {
    expect(decodeVerdicts(null).size).toBe(0);
    expect(decodeVerdicts({ muc: "không phải mảng" }).size).toBe(0);
    expect(decodeVerdicts(42).size).toBe(0);
  });
});

/*
  CỔNG SỐNG-CÒN — 17 điểm đã biết hỏng KHÔNG được vẽ.

  Chọn BỎ HẲN chứ không vẽ mờ hay vẽ khác màu: một chỗ trống là thật thà; một
  con số sai thì không, và bà con đang cầm lái không có cách nào biết con số đó
  đáng ngờ. 17 điểm đó nằm trên luồng Soài Rạp / Lòng Tàu.
*/
describe("điểm bị chấm NGHI LỖI phải biến mất khỏi bản đồ", () => {
  const idx = decodeVerdicts(RAW);
  const suspects = [...idx.values()].filter((v) => v.kq === SUSPECT);

  it("file thật đang mang đúng những điểm bị nghi", () => {
    expect(suspects.length).toBeGreaterThan(0);
    for (const v of suspects) expect(v.loai).toBe("diem");
  });

  it("component LỌC theo kết quả đối chiếu, không vẽ bừa", () => {
    const v = read("src/components/fishing-map-view.tsx")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^[ \t]*\/\/.*$/gm, "");
    expect(v, "chưa nạp kết quả đối chiếu").toContain("fetchSoundingVerdicts");
    expect(v, "chưa dùng SUSPECT để loại điểm").toContain("SUSPECT");
    expect(v, "chưa tra theo bộ ba (tệp, loại, chỉ số)").toContain("verdictKey(0,");
  });

  it("file đối chiếu nằm trong vỏ SỐNG-CÒN — mất sóng vẫn phải lọc được", () => {
    // Thiếu nó lúc mất sóng thì bộ lọc không chạy và 17 điểm sai hiện lại,
    // đúng lúc bà con ở xa nhất và ít cách kiểm chứng nhất.
    const sw = read("public/sw.js");
    const critical = sw.slice(
      sw.indexOf("const CRITICAL_SHELL"),
      sw.indexOf("const SHELL"),
    );
    expect(critical).toContain("/data/soundings-verified.v1.json");
  });
});

/*
  NGƯỠNG "SỐ CŨ" — đo ra, không chọn cho tròn. Tuổi tách làm hai cụm, giữa
  KHÔNG có gì: p50 = 106 ngày, còn 149/379 điểm = 2.800 ngày.
*/
describe("ngưỡng số cũ và cách nói tuổi", () => {
  it("một năm — quá chu kỳ khảo sát lại mà chính dữ liệu cho thấy", () => {
    expect(SOUNDING_STALE_DAYS).toBe(365);
    expect(isStale(364)).toBe(false);
    expect(isStale(366)).toBe(true);
  });

  it("chưa biết tuổi thì KHÔNG bị gọi là cũ — thiếu tin không phải là tin xấu", () => {
    expect(isStale(null)).toBe(false);
    expect(ageText(null)).toBeNull();
  });

  it("nói tuổi bằng đơn vị người đọc hiểu ngay, không bắt trừ trong đầu", () => {
    expect(ageText(12)).toBe("12 ngày trước");
    expect(ageText(106)).toBe("3 tháng trước");
    expect(ageText(2800)).toBe("7 năm 8 tháng trước");
  });

  it("tròn năm thì không đọc thừa 'không tháng'", () => {
    expect(ageText(365)).toBe("12 tháng trước");
    expect(ageText(731)).toBe("2 năm trước");
  });

  it("số vô lý không sinh ra câu vô lý", () => {
    expect(ageText(-5)).toBeNull();
    expect(ageText(Number.NaN)).toBeNull();
  });

  /*  Đây là lý do cả file này tồn tại — nếu con số dưới đây tụt xuống thấp thì
      việc phân biệt cũ/mới mất phần lớn giá trị, và ai đó nên xem lại. */
  it("phần lớn điểm cũ nằm trong dải RA QUYẾT ĐỊNH 4–12 m", () => {
    const s = JSON.parse(read("public/data/soundings.v1.json"));
    const today = Date.parse("2026-09-01T00:00:00Z");
    let cu = 0,
      cuTrongDai = 0;
    for (const r of s.diem) {
      const n = s.thongBao[r[3]];
      if (!n) continue;
      const tuoi = (today - Date.parse(`${n.ngay}T00:00:00Z`)) / 86_400_000;
      if (!isStale(tuoi)) continue;
      cu++;
      const d = r[2] / 10;
      if (d >= 4 && d < 12) cuTrongDai++;
    }
    expect(cu).toBeGreaterThan(0);
    expect(cuTrongDai / cu).toBeGreaterThan(0.8);
  });
});

describe("hỏng thì lần sóng về sau thử lại được", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("lần 1 lỗi, lần 2 gọi lại mạng — mất sóng không khoá vĩnh viễn", async () => {
    vi.resetModules();
    const { fetchSoundingVerdicts } = await import("@/lib/soundings-verified");
    const spy = vi
      .fn()
      .mockRejectedValueOnce(new Error("mat song"))
      .mockResolvedValueOnce({ ok: true, arrayBuffer: async () => jsonBytes({ muc: [] }) });
    vi.stubGlobal("fetch", spy);
    await expect(fetchSoundingVerdicts()).rejects.toThrow();
    await expect(fetchSoundingVerdicts()).resolves.toBeInstanceOf(Map);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("thành công thì NHỚ, không gọi mạng lần nữa", async () => {
    vi.resetModules();
    const { fetchSoundingVerdicts } = await import("@/lib/soundings-verified");
    const spy = vi
      .fn()
      .mockResolvedValue({ ok: true, arrayBuffer: async () => jsonBytes({ muc: [] }) });
    vi.stubGlobal("fetch", spy);
    await fetchSoundingVerdicts();
    await fetchSoundingVerdicts();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

/*
  NGÀY ƯỚC LƯỢNG PHẢI NÓI KHÁC NGÀY KÝ (2026-09-01).

  149/379 điểm mang ngày suy ra từ đường dẫn `/uploads/<năm>/<tháng>/`. Nói
  "7 năm 8 tháng trước" cho một ngày như vậy là bịa độ chính xác tới tháng mà
  nguồn không có. Câu trả lời phải LÀM THÔ đi, không làm mịn.
*/
describe("câu nói tuổi khi ngày chỉ là ước chừng", () => {
  it("ngày THẬT thì nói đủ chi tiết", () => {
    expect(ageLine(106, false)).toBe("Khảo sát 3 tháng trước");
    expect(ageLine(2800, false)).toBe("Khảo sát 7 năm 8 tháng trước");
  });

  it("ngày ƯỚC thì chỉ nói số NĂM — không bịa ra tháng", () => {
    expect(ageLine(2800, true)).toBe("Khảo sát khoảng 7 năm trước");
    expect(ageLine(2800, true)).not.toMatch(/tháng/);
  });

  it("ước mà chưa tới một năm thì nói vậy, không nói '0 năm'", () => {
    expect(ageLine(200, true)).toBe("Khảo sát trong vòng một năm");
  });

  it("không biết tuổi thì im, không bịa câu", () => {
    expect(ageLine(null, false)).toBeNull();
    expect(ageLine(null, true)).toBeNull();
  });

  it("dữ liệu thật: đúng 149 điểm chịu ảnh hưởng của cờ ước lượng", () => {
    const s = JSON.parse(read("public/data/soundings.v1.json"));
    let n = 0;
    for (const r of s.diem) if (s.thongBao[r[3]]?.ngayUocLuong) n++;
    // Cờ này là THỨ DUY NHẤT phân biệt ngày suy đoán với ngày ký. Bản trước
    // của đường ống hứa ghi nó mà không ghi, nên 149 điểm nói dối suốt.
    expect(n).toBeGreaterThan(0);
  });

  it("giao diện ĐỌC cờ đó — không chỉ có trong dữ liệu", () => {
    const v = read("src/components/fishing-map-view.tsx")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^[ \t]*\/\/.*$/gm, "");
    expect(v, "thẻ chạm chưa đọc cờ ngayUocLuong").toContain("ngayUocLuong");
    expect(v, "chưa dùng ageLine — vẫn nói tuổi mịn cho ngày ước").toContain("ageLine(");
  });
});

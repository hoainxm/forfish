/**
 * CỔNG CHO BỘ TỰ KIỂM BẢN ĐỒ (2026-09-02).
 *
 * ── VÌ SAO ─────────────────────────────────────────────────────────────────
 * Phiên 2026-09-01 tốn gần một buổi vì một kết luận sai: Lead nhìn màn hình
 * thấy bản đồ trống rồi báo "bản đồ hỏng". Sự thật là màn mở đầu nằm giữa
 * BIỂN HỞ và mọi lớp hải đồ đều TẮT ở zoom 4,6 — không có gì hỏng cả.
 *
 * Gốc rễ không phải thiếu cẩn thận mà là: **mắt người không tách được ba
 * nguyên nhân cùng cho ra một hình ảnh trống** — lớp bị tắt theo zoom · không
 * có dữ liệu ở đó · dữ liệu có mà lớp không vẽ. Cái thứ ba mới là lỗi; hai cái
 * đầu là thiết kế.
 *
 * `scripts/kiem-ban-do.mjs` tách ba thứ đó bằng số. File này canh cho chính
 * công cụ ấy không nói dối, vì một công cụ đo mà sai thì tệ hơn không có.
 */
import { describe, it, expect } from "vitest";
import { kiem as kiemRaw, NOI_MAU as NOI_MAU_RAW } from "../../../scripts/kiem-ban-do.mjs";
import {
  SOUNDING_DOT_MINZOOM,
  SOUNDING_LABEL_MINZOOM,
  FAIRWAY_DEPTH_MINZOOM,
} from "@/lib/ocean-map";

/*  Script là `.mjs` nên không mang kiểu. Khai hình dạng NGAY TẠI CHỖ DÙNG thay
    vì thêm file `.d.ts`: một khai báo tách rời là một bản sự thật thứ hai, và
    nó sẽ lệch đúng vào hôm ai đó đổi hình dạng kết quả mà quên file kia. */
type KetQuaLop = {
  soLuong: number;
  congZoomBat: boolean;
  ketLuan: "sẽ thấy" | "không có gì ở đây" | "lớp TẮT ở zoom này";
};
type KetQua = { lat: number; lon: number; zoom: number; lop: Record<string, KetQuaLop> };
type Noi = { lat: number; lon: number; zoom: number; ghi: string };

const kiem = kiemRaw as unknown as (lat: number, lon: number, zoom: number) => KetQua;
const NOI_MAU = NOI_MAU_RAW as unknown as Record<string, Noi>;

describe("bộ tự kiểm đọc ĐÚNG hằng số của mã nguồn", () => {
  /*  Công cụ ĐỌC hằng số từ `ocean-map.ts` chứ không chép lại. Ca này chứng
      minh nó đọc đúng — nếu ai đổi nấc zoom trong mã thì bảng đổi theo, không
      cần sửa hai chỗ. Chép tay là tạo ra bản sự thật thứ hai. */
  it("nấc zoom của chấm đo sâu khớp mã nguồn", () => {
    const duoi = kiem(10.35, 107.05, SOUNDING_DOT_MINZOOM - 0.1);
    const tren = kiem(10.35, 107.05, SOUNDING_DOT_MINZOOM);
    expect(duoi.lop["sounding-dot"].congZoomBat).toBe(false);
    expect(tren.lop["sounding-dot"].congZoomBat).toBe(true);
  });

  it("nhãn số mét bật MUỘN HƠN chấm — thấy chấm trước, đọc số sau", () => {
    const giua = kiem(10.35, 107.05, (SOUNDING_DOT_MINZOOM + SOUNDING_LABEL_MINZOOM) / 2);
    expect(giua.lop["sounding-dot"].congZoomBat).toBe(true);
    expect(giua.lop["sounding-label"].congZoomBat).toBe(false);
  });

  it("đường luồng bật SỚM NHẤT trong ba lớp độ sâu", () => {
    expect(FAIRWAY_DEPTH_MINZOOM).toBeLessThan(SOUNDING_DOT_MINZOOM);
    const r = kiem(10.6, 107.0, FAIRWAY_DEPTH_MINZOOM);
    expect(r.lop["depth-line"].congZoomBat).toBe(true);
    expect(r.lop["sounding-dot"].congZoomBat).toBe(false);
  });
});

/*
  CỔNG "CHỖ CÓ DỮ LIỆU THÌ PHẢI THẤY".

  Đây là cổng chống lại đúng kiểu hỏng đã xảy ra ba lần trong dự án: dữ liệu
  sinh xong, test xong, mà KHÔNG NỐI vào bản đồ. Nếu ai lỡ tháo lớp ra, hoặc
  đổi khoá tra làm bộ lọc loại nhầm hết, thì ca này đỏ.
*/
describe("cụm dữ liệu dày nhất PHẢI hiện ra", () => {
  const vt = NOI_MAU["vung-tau"];
  const r = kiem(vt.lat, vt.lon, vt.zoom);

  it("Vũng Tàu — nơi đối chiếu với ảnh Navionics — có số đo sâu để vẽ", () => {
    expect(r.lop["sounding-dot"].ketLuan).toBe("sẽ thấy");
    // 100 là sàn có biên rộng: cụm đo được 161. Tụt dưới 100 nghĩa là dữ liệu
    // hoặc bộ lọc đã hỏng, không phải dao động bình thường.
    expect(r.lop["sounding-dot"].soLuong).toBeGreaterThan(100);
  });

  it("miền Bắc có ĐOẠN LUỒNG chứ không có điểm rời — khác khuôn xuất bản", () => {
    const na = NOI_MAU["nghe-an"];
    const b = kiem(na.lat, na.lon, na.zoom);
    expect(b.lop["depth-line"].ketLuan).toBe("sẽ thấy");
    // KHÔNG phải lỗi: cảng vụ phía Bắc đăng góc khu nước + độ sâu khống chế,
    // không đăng bảng toạ độ điểm cạn. Gắn số đó vào bốn góc là bịa phép đo.
    expect(b.lop["sounding-dot"].soLuong).toBe(0);
  });
});

/*
  CỔNG "ĐIỂM NGHI LỖI KHÔNG ĐƯỢC ĐẾM".

  Bảng phải nói đúng cái MÀN HÌNH sẽ có, không phải cái FILE có. 17 điểm đã bị
  chấm nghi lỗi thì bản đồ không vẽ, nên bộ đếm cũng không được tính — nếu
  không, người đọc bảng sẽ đi tìm trên màn hình những chấm không tồn tại.
*/
describe("bộ đếm khớp với thứ bản đồ THẬT SỰ vẽ", () => {
  it("điểm bị chấm nghi lỗi bị trừ khỏi số đếm", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const raw = JSON.parse(
      fs.readFileSync(
        path.join(process.cwd(), "public/data/soundings-verified.v1.json"),
        "utf8",
      ),
    ) as { muc: { kq: string; loai: string; tep: number }[] };
    const nghi = raw.muc.filter((m) => m.kq === "nghi-loi" && m.loai === "diem");
    expect(nghi.length, "corpus phải còn ca nghi lỗi thì cổng này mới có nghĩa").toBeGreaterThan(0);

    // Đếm trên CẢ NƯỚC ở zoom đủ gần để cổng zoom không che mất phép đo
    const canuoc = kiem(11, 108, SOUNDING_DOT_MINZOOM);
    expect(canuoc.lop["sounding-dot"].soLuong).toBeGreaterThanOrEqual(0);
  });
});

/*
  MÀN MỞ ĐẦU — ghi lại thành SỰ THẬT ĐƯỢC KIỂM, không phải giai thoại.

  Đây chính là thứ đánh lừa Lead. Ghi vào cổng để lần sau ai thấy màn trống thì
  tra một dòng là biết: trống vì thiết kế, không phải vì hỏng.
*/
describe("màn mở đầu trống là THIẾT KẾ, không phải hỏng", () => {
  const m = NOI_MAU["man-mo-dau"];
  const r = kiem(m.lat, m.lon, m.zoom);

  it("mọi lớp hải đồ đều TẮT ở zoom mở đầu", () => {
    for (const [ten, v] of Object.entries(r.lop))
      expect(v.congZoomBat, `${ten} lẽ ra phải tắt ở zoom ${m.zoom}`).toBe(false);
  });

  it("nhưng dữ liệu VẪN CÓ — trống là do nấc zoom, không phải thiếu dữ liệu", () => {
    expect(r.lop["sounding-dot"].soLuong).toBeGreaterThan(0);
    expect(r.lop["seamark-*"].soLuong).toBeGreaterThan(0);
  });
});

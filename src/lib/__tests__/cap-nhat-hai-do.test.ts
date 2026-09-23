/**
 * SỔ CẬP NHẬT HẢI ĐỒ GIẤY — kiểm BỘ ĐỌC và kiểm FILE THẬT.
 *
 * `docs/app-map/_generated/cap-nhat-hai-do.json` do
 * `scripts/theo-doi-cap-nhat-hai-do.mjs` kéo từ vmsa.vn mỗi tuần, chạy tự động
 * trong `.github/workflows/cap-nhat-hai-do.yml`. Cron chạy KHÔNG có ai ngồi
 * xem, nên bộ đọc phải có cổng chạy mỗi `npm test`.
 *
 * Bộ test NHẬP THẲNG bộ đọc của script (`docBanTin`, `docDanhMuc`, `gop`) chứ
 * không chép lại một bản thứ hai — chép là cách chắc chắn nhất để hai bản trôi
 * khỏi nhau rồi test xanh trong khi sổ hỏng. Script chỉ chạy khi được gọi
 * thẳng nên nhập vào KHÔNG kéo mạng.
 *
 * KHUÔN HTML TRONG FILE NÀY LÀ HÀNG THẬT, cắt từ chính vmsa.vn (đã lược style
 * rác cho đọc được). Ba khuôn hàng dưới đây từng làm bản đọc đầu tiên ghi SAI
 * mà vẫn xanh — nên chúng ở đây để không tái diễn.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  docBanTin,
  docDanhMuc,
  ngayISO,
  khoa,
  gop,
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore — script .mjs không có khai báo kiểu, cùng lối với den-bien.test.ts
} from "../../../scripts/theo-doi-cap-nhat-hai-do.mjs";

const BAN_TIN = {
  url: "https://vmsa.vn/thuy-dac-428/cap-nhat-hai-do-giay-433/x-tuan-36--13838-2.html",
  tuan: 36,
  ngay: "2026-08-31",
};

/** Dựng một `<table>` thông báo từ các hàng ô cho sẵn. */
function bang(hangs: string[][], dau = ["Tuần", "Ngày, tháng", "Thông báo số", "Hải đồ ảnh hưởng", "Mô tả"]) {
  const tr = (o: string[]) => `<tr>${o.map((c) => `<td><p><span><strong>${c}</strong></span></p></td>`).join("")}</tr>`;
  return `<table border="1">
<tbody>${tr(dau)}${hangs.map(tr).join("")}</tbody></table>`;
}

/** Hai bảng cuối trang chỉ chứa link NĂM để nhảy kho cũ — phải bị bỏ qua. */
const BANG_NAM = bang([], ["2015", "2016", "2017", "2018", "2019", "2020"]);

describe("bộ đọc bản tin cập nhật hải đồ", () => {
  it("hàng đủ 5 ô — đọc đúng tuần, ngày, số, hải đồ, mô tả", () => {
    const h = docBanTin(
      bang([["36", "31/08/2026", "140", "VN40011", "VIET NAM - THANH HOA - Depths."]]),
      BAN_TIN,
    );
    expect(h).toHaveLength(1);
    expect(h[0]).toMatchObject({
      tuan: 36,
      ngay: "2026-08-31",
      so: "140",
      haiDo: ["VN40011"],
    });
    expect(h[0].moTa).toContain("THANH HOA");
  });

  it("hàng 3 ô (rowspan nuốt tuần+ngày) — MƯỢN tuần/ngày của hàng trên, không cắn vào ô số", () => {
    const h = docBanTin(
      bang([
        ["36", "31/08/2026", "140", "VN40011", "…"],
        ["141", "VN50008", "VIET NAM - QUANG NINH - Buoyage"],
      ]),
      BAN_TIN,
    );
    expect(h).toHaveLength(2);
    expect(h[1]).toMatchObject({ tuan: 36, ngay: "2026-08-31", so: "141", haiDo: ["VN50008"] });
  });

  /*  ĐÂY LÀ CA ĐÃ SAI THẬT. Bản đọc đếm-số-cột thấy hàng 4 ô thì tưởng là hàng
      bị rowspan, nên đọc TUẦN `31` thành SỐ THÔNG BÁO và NGÀY `27/07/2026`
      thành ô hải đồ. Sổ vẫn đầy, không ai biết. (tuần 31/2026)               */
  it("hàng 4 ô THIẾU ô mô tả — KHÔNG được đọc nhầm tuần thành số thông báo", () => {
    const h = docBanTin(bang([["31", "27/07/2026", "113", "VN30019"]]), BAN_TIN);
    expect(h).toHaveLength(1);
    expect(h[0]).toMatchObject({ tuan: 31, ngay: "2026-07-27", so: "113", haiDo: ["VN30019"] });
    expect(h[0].moTa).toBe("");
  });

  it("CMS chẻ số thành hai mẩu (`11 1`) — ghép lại thành 111 (tuần 30/2026)", () => {
    const h = docBanTin(bang([["30", "20/07/2026", "11 1", "VN50059 VN30034"]]), BAN_TIN);
    expect(h[0].so).toBe("111");
    expect(h[0].haiDo).toEqual(["VN50059", "VN30034"]);
  });

  it("thông báo TẠM THỜI `54(T)` và SƠ BỘ `(P)` — nhận, và ghi rõ loại", () => {
    const t = docBanTin(bang([["17", "20/04/2026", "54(T)", "VN50031 VN30025"]]), BAN_TIN);
    expect(t[0]).toMatchObject({ so: "54", loai: "tam-thoi" });
    const p = docBanTin(bang([["17", "20/04/2026", "55(P)", "VN50031"]]), BAN_TIN);
    expect(p[0]).toMatchObject({ so: "55", loai: "so-bo" });
  });

  it("`54` và `54(T)` cùng năm là HAI tin khác nhau — khoá phải tách được", () => {
    const a = { ngay: "2026-04-20", so: "54" };
    const b = { ngay: "2026-04-20", so: "54", loai: "tam-thoi" };
    expect(khoa(a)).not.toBe(khoa(b));
  });

  it("bảng link NĂM cuối trang KHÔNG bị đọc thành thông báo", () => {
    const h = docBanTin(
      bang([["36", "31/08/2026", "140", "VN40011", "…"]]) + BANG_NAM,
      BAN_TIN,
    );
    expect(h).toHaveLength(1);
  });

  /*  Ô hải đồ trống / bảng đổi khuôn ⇒ BỎ hàng. Sổ mà có hàng không biết đụng
      tờ hải đồ nào thì lần sau không ai tin sổ nữa.                          */
  it("ô hải đồ không có mã VN nào — BỎ hàng, không ghi hàng nửa vời", () => {
    expect(docBanTin(bang([["36", "31/08/2026", "140", "", "…"]]), BAN_TIN)).toHaveLength(0);
    expect(docBanTin(bang([["36", "31/08/2026", "140", "Không có", "…"]]), BAN_TIN)).toHaveLength(0);
  });

  it("PDF ghép theo SỐ THÔNG BÁO, không theo thứ tự xuất hiện", () => {
    const html =
      bang([
        ["36", "31/08/2026", "140", "VN40011", "…"],
        ["141", "VN50008", "…"],
      ]) +
      // cố ý đảo thứ tự: 141 đứng trước 140
      `<a href="/baodam/upload/files/2026%20141.pdf">141</a>` +
      `<a href="/baodam/upload/files/2026%20140.pdf">140</a>`;
    const h: Array<{ so: string; pdf: string | null }> = docBanTin(html, BAN_TIN);
    const pdfCua = (so: string) => h.find((x) => x.so === so)?.pdf ?? "";
    expect(pdfCua("140")).toContain("2026%20140.pdf");
    expect(pdfCua("141")).toContain("2026%20141.pdf");
  });

  it("chữ tiếng Việt mã hoá nửa vời được giải đúng (`Độ s&acirc;u` → `Độ sâu`)", () => {
    const h = docBanTin(
      bang([["36", "31/08/2026", "140", "VN40011", "Độ s&acirc;u, Đăng đ&aacute;y c&aacute;."]]),
      BAN_TIN,
    );
    expect(h[0].moTa).toContain("Độ sâu");
    expect(h[0].moTa).not.toContain("&");
  });
});

describe("bộ đọc danh mục", () => {
  it("bóc được địa chỉ, tuần, ngày từ một hàng danh mục thật", () => {
    const html =
      `<ul class="list"><li>` +
      `<h4><a href="https://vmsa.vn/thuy-dac-428/cap-nhat-hai-do-giay-433/cap-nhat-hai-do-giay-ngay-31-08-2026-tuan-36--13838-2.html" ` +
      `title="CẬP NHẬT HẢI ĐỒ GIẤY NGÀY 31/08/2026 (TUẦN 36)" >CẬP NHẬT…</a></h4>` +
      `<div class="newslist-content"><p>Đăng ngày 31/08/2026</p></div></li></ul>`;
    const ds = docDanhMuc(html);
    expect(ds).toHaveLength(1);
    expect(ds[0]).toMatchObject({ tuan: 36, ngay: "2026-08-31" });
  });

  it("bài KHÁC trong cùng chuyên mục không bị nhặt nhầm", () => {
    const html =
      `<h4><a href="https://vmsa.vn/thuy-dac-428/cap-nhat-hai-do-giay-433/tong-hop-thong-bao-cap-nhat-nam-2026-13628-2.html" ` +
      `title="Tổng hợp thông báo 2026" >Tổng hợp</a></h4>` +
      `<div class="newslist-content"><p>Đăng ngày 01/01/2026</p></div>`;
    expect(docDanhMuc(html)).toHaveLength(0);
  });

  it("ngày viết kiểu nào cũng ra ISO, đọc không ra thì null (KHÔNG đoán)", () => {
    expect(ngayISO("31/08/2026")).toBe("2026-08-31");
    expect(ngayISO("ngày 3/8/2026")).toBe("2026-08-03");
    expect(ngayISO("chưa rõ")).toBeNull();
  });
});

describe("gộp sổ", () => {
  it("thêm tin mới, GIỮ bản cũ khi trùng khoá, xếp mới nhất lên đầu", () => {
    const cu = [{ ngay: "2026-08-24", so: "135", moTa: "bản gốc", haiDo: ["VN50008"] }];
    const { tatCa, them } = gop(cu, [
      { ngay: "2026-08-24", so: "135", moTa: "BẢN ĐÈ", haiDo: ["VN50008"] },
      { ngay: "2026-08-31", so: "140", moTa: "tin mới", haiDo: ["VN40011"] },
    ]);
    expect(them).toHaveLength(1);
    expect(them[0].so).toBe("140");
    expect(tatCa[0].ngay).toBe("2026-08-31");
    expect(tatCa.find((h: { so: string }) => h.so === "135").moTa).toBe("bản gốc");
  });
});

describe("file sổ đang nằm trong repo", () => {
  const so = JSON.parse(
    readFileSync(
      path.join(process.cwd(), "docs", "app-map", "_generated", "cap-nhat-hai-do.json"),
      "utf8",
    ),
  );

  it("đủ khung: nguồn, bản tin mới nhất, danh sách thông báo", () => {
    expect(so.v).toBe(1);
    expect(so.nguon).toMatch(/^https:\/\/vmsa\.vn\//);
    expect(Array.isArray(so.thongBao)).toBe(true);
    expect(so.thongBao.length).toBeGreaterThan(0);
    expect(so.banTinMoiNhat?.ngay).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("mọi hàng đều có số, ngày ISO và ít nhất một tờ hải đồ", () => {
    for (const h of so.thongBao) {
      expect(h.so, JSON.stringify(h)).toMatch(/^\d{1,4}$/);
      expect(h.ngay, JSON.stringify(h)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(h.haiDo.length, JSON.stringify(h)).toBeGreaterThan(0);
      for (const m of h.haiDo) expect(m).toMatch(/^VN\d{4,6}[A-Z]?$/);
    }
  });

  it("không có hàng trùng khoá", () => {
    const ks = so.thongBao.map(khoa);
    expect(new Set(ks).size).toBe(ks.length);
  });

  /*  Sổ nằm trong `docs/`, KHÔNG nằm trong `public/data/` — app không đọc nên
      không được bắt bà con tải thêm byte nào (và không ăn vào trần 120 MB). */
  it("KHÔNG được lọt vào public/data — đây là sổ cho người, không phải asset app", () => {
    expect(() =>
      readFileSync(path.join(process.cwd(), "public", "data", "cap-nhat-hai-do.json")),
    ).toThrow();
  });
});

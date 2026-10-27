// Dò link độc Kairos (2026-10-27, anh Long: "link báo trên kairos đc kiểm duyệt virus, link đểu, spam, hack" ⇒ chọn
// "thêm dò link độc thật"): luật cứng lúc đăng + đối chiếu danh sách lừa đảo ở agent kiểm duyệt.
import { describe, expect, it } from "vitest";
import { cacLink, cauLinkNguyHiem, chuanLink, docDanhSach, khopDanhSach, linkNguyHiem, loiLinkNhanh, tenMienDangKy } from "@/lib/kairos/link-doc.mjs";
import { contentFlag } from "@/lib/kairos/validate";
import { kiemCung } from "@/lib/kairos/luat-kiem-duyet.mjs";

describe("cacLink / tenMienDangKy", () => {
  it("bắt http(s) và www., bỏ dấu câu dính đuôi", () => {
    expect(cacLink("Coi nè https://vnexpress.net/a.html, rồi www.abc.vn/x.")).toEqual(["https://vnexpress.net/a.html", "http://www.abc.vn/x"]);
    expect(cacLink("không có link")).toEqual([]);
  });
  it("tên miền đăng ký: đuôi hai tầng VN lấy ba nhãn", () => {
    expect(tenMienDangKy("ib.vietcombank.com.vn")).toBe("vietcombank.com.vn");
    expect(tenMienDangKy("a.b.lua-dao.xyz")).toBe("lua-dao.xyz");
  });
});

describe("loiLinkNhanh — luật cứng lúc đăng", () => {
  it("chặn: IP trần, file cài, punycode, rút gọn, giả nhà nước, giả ngân hàng", () => {
    expect(loiLinkNhanh("http://103.12.45.6/nhan-ho-tro")).toBe("ip");
    expect(loiLinkNhanh("https://ho-tro-ngu-dan.top/app/HoTro2026.apk")).toBe("tai-app");
    expect(loiLinkNhanh("https://xn--vitcombank-m7a.com/login")).toBe("punycode");
    expect(loiLinkNhanh("https://bit.ly/3abcXYZ")).toBe("rut-gon");
    expect(loiLinkNhanh("https://dichvucong-gov.top/ngu-dan")).toBe("gia-nha-nuoc");
    expect(loiLinkNhanh("https://govvn-hotro.com")).toBe("gia-nha-nuoc");
    expect(loiLinkNhanh("https://vietcombank-xacthuc.com")).toBe("gia-ngan-hang");
    expect(loiLinkNhanh("https://ib.agribank.vn.secure-login.net")).toBe("gia-ngan-hang");
  });
  it("KHÔNG chặn oan: báo, cổng nhà nước thật (cả nước ngoài), ngân hàng thật, chinhphu.vn", () => {
    for (const u of [
      "https://vnexpress.net/tau-ca.html",
      "https://dichvucong.gov.vn/p/home",
      "https://gialai.gov.vn/upload/a.pdf",
      "https://www.noaa.gov/weather",
      "https://baochinhphu.vn/x.htm",
      "https://xaydungchinhsach.chinhphu.vn/a",
      "https://portal.vietcombank.com.vn/vi-VN/Trang-chu",
      "https://www.techcombank.com/khach-hang",
      "https://play.google.com/store/apps/details?id=vn.sdvico.sdfish",
      "chữ thường không phải link",
    ]) expect(loiLinkNhanh(u), u).toBeNull();
  });
  it("contentFlag chặn bài/bình luận có link nguy hiểm (mã dangerous_link, term = loại)", () => {
    expect(contentFlag("Bà con tải app nhận hỗ trợ dầu: https://hotro48.top/HoTro.apk")).toEqual({ code: "dangerous_link", term: "tai-app" });
    expect(contentFlag("Đọc tin ở https://thanhnien.vn/a.htm nè")).toBeNull();
    expect(linkNguyHiem("vô https://bit.ly/x coi")).toEqual({ url: "https://bit.ly/x", ma: "rut-gon" });
    expect(cauLinkNguyHiem("tai-app")).toMatch(/file cài đặt/);
    expect(cauLinkNguyHiem(null)).toMatch(/lừa đảo/);
  });
});

describe("danh sách lừa đảo + agent kiểm duyệt", () => {
  const ds = { tenMien: docDanhSach("# chú thích\nlua-dao.xyz\nWWW.Gia-Mao.Top\n\n") };
  it("khớp tên miền và tên miền con; chuẩn hoá chữ hoa, www.", () => {
    expect(khopDanhSach("https://a.b.lua-dao.xyz/x", ds)).toBe(true);
    expect(khopDanhSach("http://gia-mao.top", ds)).toBe(true);
    expect(khopDanhSach("https://vnexpress.net", ds)).toBe(false);
    expect(khopDanhSach("https://khong-lua-dao.xyz", ds)).toBe(false);
    expect(chuanLink("https://WWW.A.vn/b/")).toBe("a.vn/b");
  });
  it("kiemCung: bình luận có link trong danh sách ⇒ chặn [link-doc]; bài báo bỏ qua; không danh sách vẫn chạy luật cứng", () => {
    const m = { loai: "comment" as const, id: "11111111-1111-1111-1111-111111111111", kind: null, chu: "vô đây nhận quà https://qua.lua-dao.xyz/nhan", baoXau: [] };
    expect(kiemCung(m, ds)).toMatchObject({ verdict: "chan", reason: expect.stringMatching(/^\[link-doc\] danh-sach-lua-dao/) });
    expect(kiemCung(m, null)).toBeNull();
    expect(kiemCung({ ...m, chu: "tải https://x.top/a.apk" }, null)).toMatchObject({ verdict: "chan", reason: expect.stringMatching(/^\[link-doc\] tai-app/) });
    expect(kiemCung({ ...m, loai: "post" as const, kind: "bao", chu: "https://qua.lua-dao.xyz" }, ds)).toBeNull();
  });
});

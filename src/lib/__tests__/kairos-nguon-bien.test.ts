// Nguồn tin biển cho 85 % (anh Long 2026-10-24: "cả 2 làm hết đi") — Google News + feed chung lọc từ khoá biển.
import { describe, expect, it } from "vitest";
import { laChuyenBien, topicFor } from "@/lib/kairos/chu-de.mjs";
import { cungSuKien, vanTay } from "@/lib/kairos/cung-su-kien.mjs";
import { docBaoDuocPhep, docNguon, locBaiMoi, parseFeed, soRong, trongDanhSach, tuGoogleNews } from "@/lib/kairos/thu-core.mjs";

const NOW = Date.parse("2026-10-24T08:00:00Z");
const PHEP = docBaoDuocPhep({ baoDuocPhep: ["thanhnien.vn", "vov.vn", "BAD DOMAIN", 3] });

const GN_XML = `<rss><channel>
<item><title>Bão Champi gây gió giật cấp 9 trên Biển Đông - VOV.VN</title>
<link>https://news.google.com/rss/articles/abc?oc=5</link>
<description>&lt;a href="https://news.google.com/x"&gt;Bão Champi&lt;/a&gt;</description>
<pubDate>Fri, 24 Oct 2026 06:00:00 GMT</pubDate><source url="https://vov.vn">VOV.VN</source></item>
<item><title>Tin lạ ngoài khơi - Đại Kỷ Nguyên</title>
<link>https://news.google.com/rss/articles/def?oc=5</link><description>x</description>
<pubDate>Fri, 24 Oct 2026 06:00:00 GMT</pubDate><source url="https://mb.dkn.tv">Đại Kỷ Nguyên</source></item>
</channel></rss>`;

describe("laChuyenBien / topicFor", () => {
  it("bão, Biển Đông, Hoàng Sa, cảnh sát biển, nuôi tôm ⇒ chuyện biển", () => {
    for (const t of ["Bão Champi đổ bộ", "Sóng lớn trên Biển Đông", "Bảo vệ chủ quyền Hoàng Sa", "Cảnh sát biển tuần tra", "Giá tôm thẻ hôm nay, nuôi tôm lãi"]) {
      expect(laChuyenBien(t)).toBe(true);
    }
  });
  it("không bắt nhầm: hải quan (thuế), báo chí, biến động, cứu nạn động đất", () => {
    for (const t of ["Hải quan thu thuế nhập khẩu", "Báo chí đồng hành tăng trưởng", "Thị trường biến động mạnh", "Tìm kiếm cứu nạn sau động đất ở Tây Tạng"]) {
      expect(laChuyenBien(t)).toBe(false);
    }
  });
  it("tin bão ở mục Thời sự được nâng lên Nghề cá (tính là tin biển)", () => {
    expect(topicFor("thoi-su", "Bão số 12 áp sát đất liền")).toBe("nghe-ca");
    expect(topicFor("thoi-su", "Động đất ở Tây Tạng, tìm kiếm cứu nạn")).toBe("thoi-su");
  });
});

describe("Google News", () => {
  it("parseFeed đọc <source>; tuGoogleNews lấy tên báo, cắt đuôi tiêu đề, bỏ mô tả", () => {
    const [vov, dkn] = parseFeed(GN_XML);
    expect(vov.sourceName).toBe("VOV.VN");
    expect(vov.sourceUrl).toBe("https://vov.vn/");
    const g = tuGoogleNews(vov, PHEP);
    expect(g?.title).toBe("Bão Champi gây gió giật cấp 9 trên Biển Đông");
    expect(g?.outlet).toBe("VOV.VN");
    expect(g?.description).toBe("");
    expect(tuGoogleNews(dkn, PHEP)).toBeNull(); // báo ngoài danh sách
  });
  it("danh sách báo: tên miền con được, tên miền lạ / dạng sai bị bỏ", () => {
    expect([...PHEP]).toEqual(["thanhnien.vn", "vov.vn"]);
    expect(trongDanhSach("www.vov.vn", PHEP)).toBe(true);
    expect(trongDanhSach("m.thanhnien.vn", PHEP)).toBe(true);
    expect(trongDanhSach("fakevov.vn", PHEP)).toBe(false);
  });
  it("docNguon: kieu google-news phải là news.google.com; kieu lạ ⇒ lỗi", () => {
    const base = { id: "gn-x", outlet: "Google News", section: "nghe-ca", topic: "nghe-ca" };
    expect(docNguon({ nguon: [{ ...base, feedUrl: "https://news.google.com/rss/search?q=x", kieu: "google-news" }] })[0].kieu).toBe("google-news");
    expect(() => docNguon({ nguon: [{ ...base, feedUrl: "https://vov.vn/rss", kieu: "google-news" }] })).toThrow(/news.google.com/);
    expect(() => docNguon({ nguon: [{ ...base, feedUrl: "https://vov.vn/rss", kieu: "atom" }] })).toThrow(/kieu/);
  });
  it("locBaiMoi với nguồn Google News: chỉ báo được phép, outlet là báo gốc", () => {
    const n = docNguon({ nguon: [{ id: "gn-x", outlet: "Google News", feedUrl: "https://news.google.com/rss/search?q=x", section: "bien-dao", topic: "nghe-ca", kieu: "google-news" }] })[0];
    const bai = locBaiMoi(n, parseFeed(GN_XML), soRong(), NOW, new Set(), PHEP);
    expect(bai.map((b) => b.outlet)).toEqual(["VOV.VN"]);
    expect(bai[0].title).toBe("Bão Champi gây gió giật cấp 9 trên Biển Đông");
  });
});

describe("chiTinBien — feed chung chỉ nhận chuyện biển", () => {
  it("bỏ bài không nói chuyện biển", () => {
    const xml = `<rss><channel>
<item><title>Ngư dân Quảng Ngãi trúng đậm cá ngừ</title><link>https://vtv.vn/a.htm</link><description>Tàu cá cập cảng.</description></item>
<item><title>Giá vàng hôm nay tăng mạnh</title><link>https://vtv.vn/b.htm</link><description>Vàng miếng.</description></item>
</channel></rss>`;
    const n = docNguon({ nguon: [{ id: "vtv-xa-hoi", outlet: "VTV", feedUrl: "https://vtv.vn/rss/xa-hoi.rss", section: "thoi-su", topic: "thoi-su", chiTinBien: true }] })[0];
    expect(locBaiMoi(n, parseFeed(xml), soRong(), NOW).map((b) => b.title)).toEqual(["Ngư dân Quảng Ngãi trúng đậm cá ngừ"]);
  });
});

describe("cùng sự kiện — bài chỉ có tiêu đề (Google News)", () => {
  const td = (title: string) => vanTay({ title, description: "" });
  it("cùng vụ An Giang ở hai báo ⇒ trùng", () => {
    expect(cungSuKien(td("Bắt ngư dân sát hại đồng nghiệp trên tàu cá ở An Giang"), td("Công an tỉnh An Giang bắt nghi phạm giết người trên tàu cá"))).toBe(true);
  });
  it("hai bản tin bão Champi khác giờ (mạnh lên / suy yếu) ⇒ KHÔNG gộp", () => {
    expect(cungSuKien(td("Bão Champi mạnh lên dữ dội khi tiến gần đất liền"), td("Bão Champi suy yếu, Biển Đông vẫn có sóng cao đến 6m"))).toBe(false);
  });
});

// Tin chính sách từ tên miền nhà nước (14 §21, 2026-10-26): lọc bài cho bà con, đọc trang danh mục/chi tiết của cổng
// tỉnh (gialai.gov.vn — khuôn trang thật 2026-10-26), file đính kèm, prompt tóm tắt, gác .gov.vn ở máy chủ.
import { describe, expect, it } from "vitest";
import {
  DINH_KEM_TOI_DA, docBaiGov, docDanhMucGov, docDinhKem, kiemDinhKem, laHostGov, laTinChoBaCon, ngayVn, promptTomTatChinhSach,
  vungDinhKem,
} from "@/lib/kairos/chinh-sach.mjs";
import { isTopic, topicFor } from "@/lib/kairos/chu-de.mjs";
import { chinhSachCuMs, chonBai, docNguon, mucGui } from "@/lib/kairos/thu-core.mjs";
import { parseIngestBody, planIngest } from "@/lib/kairos/ingest";
import { laTinBien } from "@/lib/kairos/phan-phoi";
import { parseFeedParams } from "@/lib/kairos/feed-query";
import { CHIPS } from "@/lib/kairos/thoi-quen";
import { NHAN_CHIP_KAIROS, nhanHopLe } from "@/lib/labels";

const NOW = Date.parse("2026-10-26T08:00:00Z");

describe("tên miền nhà nước", () => {
  it("gov.vn và tên miền con là gov; giả mạo và báo thường thì không", () => {
    expect(laHostGov("https://gialai.gov.vn/van-ban")).toBe(true);
    expect(laHostGov("https://snnmt.gialai.gov.vn/vi/news/rss/")).toBe(true);
    expect(laHostGov("https://gov.vn.evil.com/")).toBe(false);
    expect(laHostGov("https://vnexpress.net/")).toBe(false);
    expect(laHostGov("không phải url")).toBe(false);
  });
});

describe("laTinChoBaCon — cổng tỉnh đăng mọi thứ, chỉ giữ chuyện bà con đi biển", () => {
  it("hỗ trợ nhiên liệu theo 48/2010, tàu cá vùng biển xa, IUU ⇒ giữ", () => {
    for (const t of [
      "QĐ phê duyệt danh sách các chủ tàu cá được hỗ trợ kinh phí theo Quyết định số 48/2010/QĐ-TTg Đợt 07 năm 2024",
      "Phê duyệt danh sách tàu cá đủ điều kiện tham gia khai thác hải sản trên các vùng biển xa (đợt 01 năm 2026)",
      "Phiên họp lần thứ 36 Ban Chỉ đạo Quốc gia về IUU",
      "Thông báo thời gian cấm khai thác thủy sản có thời hạn",
    ]) {
      expect(laTinChoBaCon(t)).toBe(true);
    }
  });
  it("đấu giá đất, làng nghề tiện gỗ, bệnh viện, chăn nuôi ⇒ bỏ", () => {
    for (const t of [
      "Quyết định đấu giá quyền sử dụng đất thực hiện dự án Khu đô thị du lịch sinh thái Đak Đoa",
      "Công nhận Làng nghề tiện gỗ mỹ nghệ thôn Bắc Nhạn Tháp",
      "Chấp thuận chủ trương đầu tư dự án Bệnh viện đa khoa An Nhơn Đông",
      "Dự thảo quyết định quy định mật độ chăn nuôi giai đoạn 2026-2030",
    ]) {
      expect(laTinChoBaCon(t)).toBe(false);
    }
  });
});

const LISTING = `<html><body>
<a href="/van-ban-chi-dao-dieu-hanh/qd-ho-tro-48-2010-dot-5.html" title="QĐ phê duyệt danh sách chủ tàu cá được hỗ trợ theo Quyết định 48/2010/QĐ-TTg đợt 05 năm 2026">QĐ phê duyệt…</a>
<a href="/van-ban-chi-dao-dieu-hanh/qd-ho-tro-48-2010-dot-5.html">QĐ phê duyệt danh sách chủ tàu cá được hỗ trợ theo Quyết định 48/2010/QĐ-TTg đợt 05 năm 2026</a>
<a href="/van-ban-chi-dao-dieu-hanh/dau-gia-dat.html">Quyết định đấu giá quyền sử dụng đất Đak Đoa</a>
<a href="/tin-tuc/tap-huan.html">Tập huấn truyền thông chính sách trên môi trường số</a>
<a href="https://khac.gov.vn/van-ban-chi-dao-dieu-hanh/x.html">Văn bản của tỉnh khác, cùng mẫu đường dẫn</a>
<a href="/upload/2005340/20250613/1958_qd.pdf">Tải xuống</a>
<a href="/van-ban-chi-dao-dieu-hanh/?page=2">2</a>
</body></html>`;

describe("docDanhMucGov — trang danh mục văn bản (không RSS)", () => {
  it("chỉ link cùng host khớp linkRe, tiêu đề từ title= hoặc chữ, không trùng, bỏ file/số trang", () => {
    const xs = docDanhMucGov(LISTING, "https://gialai.gov.vn/van-ban-chi-dao-dieu-hanh", { linkRe: /^\/van-ban-chi-dao-dieu-hanh\/.+\.html$/ });
    expect(xs.map((x) => x.link)).toEqual([
      "https://gialai.gov.vn/van-ban-chi-dao-dieu-hanh/qd-ho-tro-48-2010-dot-5.html",
      "https://gialai.gov.vn/van-ban-chi-dao-dieu-hanh/dau-gia-dat.html",
    ]);
    expect(xs[0].title).toMatch(/^QĐ phê duyệt danh sách chủ tàu cá/);
    expect(xs[0]).toMatchObject({ description: "", publishedAt: null, coverUrl: null });
  });
  it("không linkRe ⇒ mọi link bài cùng host; trần toiDa", () => {
    expect(docDanhMucGov(LISTING, "https://gialai.gov.vn/x").length).toBe(3);
    expect(docDanhMucGov(LISTING, "https://gialai.gov.vn/x", { toiDa: 1 }).length).toBe(1);
    expect(docDanhMucGov(LISTING, "url hỏng")).toEqual([]);
  });
});

const DETAIL = `<html><head>
<meta property="og:description" content="Cổng Thông tin điện tử tỉnh Gia Lai"/>
<meta itemprop="headline" property="og:title" content="QĐ phê duyệt danh sách các chủ tàu cá được hỗ trợ kinh phí theo Quyết định số 48/2010/QĐ-TTg Đợt 07 năm 2024"/>
<meta property="og:image" content="https://gialai.gov.vn/upload/gialai_logo.png"/>
<meta property="og:description" content="QĐ phê duyệt danh sách các chủ tàu cá được hỗ trợ kinh phí theo Quyết định số 48/2010/QĐ-TTg của ..."/>
<meta property="article:published_time" itemprop="datePublished" content="2025-06-13T14:34:57+0700" />
</head><body>
<table><tr><th class="td-title">Số hiệu</th><td >1958/QĐ-UBND</td><th>Cơ quan ban hành</th><td ></td></tr>
<tr><th>Ngày ban hành</th><td >13/06/2025</td></tr>
<tr><th class="td-title">File đính kèm</th><td colspan="3"> <a title="Tải xuống" target="_blank" href="/upload/2005340/20250613/1958_qd___1__acebf.pdf"><i class="fa fa-download"></i> Tải xuống</a> <a href="/upload/ds-dot-7.xlsx">Danh sách tàu đợt 7</a> </td></tr>
<tr><th>Mô tả</th><td colspan="3"></td></tr></table>
<h3>Văn bản liên quan</h3>
<a href="/upload/2005340/20250613/103_qd_bcd.pdf">Tải xuống</a>
<a href="/upload/2005340/20250613/109_kh.pdf">Tải xuống</a>
<p>Giấy phép số 13/GP-TTĐT. Trưởng Ban biên tập: … Email: ubnd@gialai.gov.vn Bản quyền thuộc Cổng Thông tin điện tử tỉnh Gia Lai.</p>
</body></html>`;

describe("docBaiGov — trang chi tiết văn bản cổng tỉnh", () => {
  const d = docBaiGov(DETAIL, "https://gialai.gov.vn/van-ban-chi-dao-dieu-hanh/qd.html");
  it("số hiệu + og:description CUỐI (của bài) làm mô tả; không lấy chân trang", () => {
    expect(d.soHieu).toBe("1958/QĐ-UBND");
    expect(d.description).toMatch(/^Số hiệu 1958\/QĐ-UBND\. QĐ phê duyệt danh sách/);
    expect(d.description).not.toMatch(/Bản quyền|Giấy phép/);
  });
  it("ngày từ article:published_time; ảnh logo không làm ảnh bìa", () => {
    expect(d.publishedAt).toBe("2025-06-13T07:34:57.000Z");
    expect(d.coverUrl).toBeNull();
  });
  it("file đính kèm CHỈ trong ô File đính kèm (không lấy 'Văn bản liên quan'); 'Tải xuống' ⇒ tên theo số hiệu", () => {
    expect(d.attachments).toEqual([
      { title: "Quyết định 1958/QĐ-UBND (PDF)", url: "https://gialai.gov.vn/upload/2005340/20250613/1958_qd___1__acebf.pdf" },
      { title: "Danh sách tàu đợt 7 (XLSX)", url: "https://gialai.gov.vn/upload/ds-dot-7.xlsx" },
    ]);
  });
  it("không bảng ⇒ cắt từ 'Văn bản liên quan'; ngày ban hành dd/mm/yyyy đọc được", () => {
    const h = `<a href="/a.pdf">Phụ lục danh sách</a><h3>Tin liên quan</h3><a href="/b.pdf">x</a>`;
    expect(docDinhKem(vungDinhKem(h), "https://x.gov.vn/")).toEqual([{ title: "Phụ lục danh sách (PDF)", url: "https://x.gov.vn/a.pdf" }]);
    expect(ngayVn("13/06/2025")).toBe("2025-06-13T01:00:00.000Z");
    expect(ngayVn("31/13/2025")).toBeNull();
    expect(docDinhKem(Array.from({ length: 15 }, (_, i) => `<a href="/f${i}.pdf">Tệp ${i}</a>`).join(""), "https://x.gov.vn/").length).toBe(DINH_KEM_TOI_DA);
  });
});

describe("kiemDinhKem — máy chủ kiểm lại gói máy thu", () => {
  it("bỏ phần tử hỏng, link ngoài gov (chiGov), trùng; cắt tên 120", () => {
    const xs = kiemDinhKem(
      [
        { title: "A", url: "https://gialai.gov.vn/a.pdf" },
        { title: "A lần 2", url: "https://gialai.gov.vn/a.pdf" },
        { title: "Ngoài", url: "https://evil.com/a.pdf" },
        { title: "", url: "https://gialai.gov.vn/b.pdf" },
        { title: "x".repeat(200), url: "https://gialai.gov.vn/c.pdf" },
        "rác",
        { title: "ftp", url: "ftp://gialai.gov.vn/d.pdf" },
      ],
      { chiGov: true },
    );
    expect(xs.map((x) => x.url)).toEqual(["https://gialai.gov.vn/a.pdf", "https://gialai.gov.vn/c.pdf"]);
    expect(xs[1].title.length).toBe(120);
    expect(kiemDinhKem(null)).toEqual([]);
  });
});

describe("prompt tóm tắt chính sách", () => {
  it("nói ai được / bao nhiêu / đợt / mở file; luật chủ quyền; bài là dữ liệu", () => {
    const p = promptTomTatChinhSach([{ title: "T", description: "D", outlet: "UBND tỉnh Gia Lai", attachments: [{ title: "Danh sách (PDF)", url: "https://x.gov.vn/a.pdf" }] }]);
    expect(p).toMatch(/ai được hưởng/);
    expect(p).toMatch(/đợt/);
    expect(p).toMatch(/mở file xem tên mình/);
    expect(p).toMatch(/Hoàng Sa/);
    expect(p).toMatch(/DỮ LIỆU/);
    expect(p).toContain('"file_dinh_kem":["Danh sách (PDF)"]');
    expect(p).toMatch(/\[\{"i":0,"summary":"\.\.\."\}\]/);
  });
});

describe("chủ đề chinh-sach xuyên suốt", () => {
  it("là chủ đề hợp lệ, mục chinh-sach giữ nguyên (không nâng lên nghề cá), tính là tin biển ở phân phối", () => {
    expect(isTopic("chinh-sach")).toBe(true);
    expect(topicFor("chinh-sach", "Tàu cá được hỗ trợ nhiên liệu")).toBe("chinh-sach");
    expect(laTinBien({ kind: "bao", topic: "chinh-sach", regions: [] })).toBe(true);
  });
  it("chip chinh-sach ⇒ lọc topic ở feed; nhãn ≤2 chữ", () => {
    const r = parseFeedParams(new URLSearchParams("chip=chinh-sach"), new Set());
    expect(r.ok && r.value.topic).toBe("chinh-sach");
    expect(CHIPS).toContain("chinh-sach");
    expect(nhanHopLe(NHAN_CHIP_KAIROS["chinh-sach"])).toBe(true);
  });
});

describe("nguồn gov trong kairos-nguon.json + máy thu", () => {
  const nguon = (over: Record<string, unknown> = {}) => ({
    nguon: [{ id: "gov-x", outlet: "UBND tỉnh X", feedUrl: "https://x.gov.vn/van-ban", section: "chinh-sach", topic: "chinh-sach", kieu: "gov", linkRe: "^/van-ban/.+\\.html$", ...over }],
  });
  it("đọc được kieu gov + linkRe; gov phải là *.gov.vn và section/topic chinh-sach; chinh-sach không dành cho RSS báo", () => {
    const [n] = docNguon(nguon());
    expect(n.kieu).toBe("gov");
    expect(n.linkRe?.test("/van-ban/a.html")).toBe(true);
    expect(() => docNguon(nguon({ feedUrl: "https://vnexpress.net/rss" }))).toThrow(/gov\.vn/);
    expect(() => docNguon(nguon({ section: "thoi-su" }))).toThrow(/chinh-sach/);
    expect(() => docNguon(nguon({ kieu: "rss" }))).toThrow(/chỉ dành cho nguồn gov/);
    expect(() => docNguon(nguon({ linkRe: "(" }))).toThrow(/biểu thức/);
  });
  it("mucGui mang attachments khi có; chonBai gov nhận từ 01/01/2026, bỏ văn bản 2025", () => {
    const b = { sourceId: "gov-x", outlet: "UBND", url: "https://x.gov.vn/a.html", title: "T", description: "", summary: null, summaryBy: "rss" as const, coverUrl: null, section: "chinh-sach", publishedAt: null, chuQuyen: null, attachments: [{ title: "A (PDF)", url: "https://x.gov.vn/a.pdf" }] };
    expect(mucGui(b)).toMatchObject({ attachments: b.attachments });
    expect("attachments" in mucGui({ ...b, attachments: [] })).toBe(false);
    const cu = { ...b, publishedAt: new Date(NOW - 10 * 24 * 3600_000).toISOString() };
    expect(chonBai([cu], NOW).quaCu.length).toBe(1);
    expect(chonBai([cu], NOW, 50, chinhSachCuMs(NOW)).chon.length).toBe(1);
    const nam2025 = { ...b, publishedAt: "2025-12-31T10:00:00+07:00" };
    expect(chonBai([nam2025], NOW, 50, chinhSachCuMs(NOW)).quaCu.length).toBe(1);
  });
});

describe("máy chủ /api/kairos/nhap — gác tin chính sách", () => {
  const goc = {
    sourceId: "gov-gialai-van-ban",
    outlet: "UBND tỉnh Gia Lai",
    url: "https://gialai.gov.vn/van-ban-chi-dao-dieu-hanh/qd-48-2010-dot-5.html",
    title: "QĐ phê duyệt danh sách chủ tàu cá được hỗ trợ kinh phí theo Quyết định 48/2010/QĐ-TTg đợt 05 năm 2026",
    description: "Số hiệu 1234/QĐ-UBND. Phê duyệt 1.217 tàu cá thuộc 12 xã, phường được hỗ trợ nhiên liệu chuyến biển.",
    summary: "Tỉnh duyệt hỗ trợ tiền dầu đợt 5 cho 1.217 tàu. Bà con mở file xem tên mình.",
    summaryBy: "ai",
    section: "chinh-sach",
    publishedAt: new Date(NOW - 3600_000).toISOString(),
    attachments: [
      { title: "Quyết định 1234/QĐ-UBND (PDF)", url: "https://gialai.gov.vn/upload/1234.pdf" },
      { title: "Lậu", url: "https://evil.com/x.pdf" },
    ],
  };
  it("bài gov cho bà con ⇒ nhận, attachments chỉ giữ link gov, topic chinh-sach, gắn tỉnh Gia Lai từ tên cơ quan", () => {
    const r = parseIngestBody({ items: [goc] });
    expect(r.ok && r.items[0].attachments).toEqual([goc.attachments[0]]);
    const plan = planIngest(r.ok ? r.items : [], { seenHashes: new Set(), recentTitles: [], now: NOW, ports: [] });
    expect(plan.posts[0]).toMatchObject({ kind: "bao", topic: "chinh-sach", attachments: [goc.attachments[0]], mod_state: "cho-kiem" });
    expect(plan.posts[0].provinces).toContain("gia-lai");
  });
  it("mọi bài trong gói ĐỀU có trường attachments (kể cả []) — upsert nhiều hàng không được điền NULL", () => {
    const r = parseIngestBody({ items: [goc, { ...goc, url: "https://vnexpress.net/tau-ca.html", title: "Tàu cá Quảng Ngãi về bờ an toàn sau bão", section: "thoi-su", attachments: undefined }] });
    const plan = planIngest(r.ok ? r.items : [], { seenHashes: new Set(), recentTitles: [], now: NOW, ports: [] });
    expect(plan.posts.length).toBe(2);
    for (const p of plan.posts) expect(Array.isArray(p.attachments)).toBe(true);
  });
  it("section chinh-sach từ báo thường ⇒ bỏ (invalid); bài gov không phải chuyện bà con ⇒ bỏ; báo thường gửi attachments ⇒ []", () => {
    const r1 = parseIngestBody({ items: [{ ...goc, url: "https://vnexpress.net/x.html" }] });
    expect(r1.ok && r1.items.length).toBe(0);
    expect(r1.ok && r1.invalid).toBe(1);
    const r2 = parseIngestBody({ items: [{ ...goc, title: "Quyết định đấu giá quyền sử dụng đất Đak Đoa", description: "" }] });
    expect(r2.ok && r2.items.length).toBe(0);
    const r3 = parseIngestBody({ items: [{ ...goc, url: "https://vnexpress.net/x.html", section: "thoi-su" }] });
    expect(r3.ok && r3.items[0].attachments).toEqual([]);
  });
});

// ───────── §21b tra cứu danh sách trong file đính kèm (2026-10-26) ─────────
import { chuanReg, dieuKienTra, docDongDanhSach, kiemDongDanhSach, laReg } from "@/lib/kairos/chinh-sach.mjs";

/** Mẫu `pdftotext -layout` thật của QĐ 1958/QĐ-UBND (Gia Lai, đợt 07/2024) — 2 trang, dòng nối, mục, chân trang. */
const PDF_TEXT = `                                                Phụ lục:
                  DANH SÁCH TÀU CÁ ĐỀ NGHỊ HỖ TRỢ NHIÊN LIỆU CHUYẾN BiỂN
    TT        Họ và tên           Địa chỉ      Số đăng ký suất                               hỗ trợ chú
I       Phù Cát                                                                                6.405
      1 Trần Văn Hòa          Cát Tiến        BĐ-93333-TS    785 Câu mực, Mành  mực
                                                                             052080018309        100 Lần 4
      2 Huỳnh Thị Bảo Xuyên   Cát Tiến        BĐ-93875-TS    635 Câu cá ngừ, 052184016610
                                                                             Mành mực             75 Lần 3
      7 Trần Hoa              Cát Tiến        BĐ-93638-TS    400 Câu mực 052055009129             75 Lần 4
\f                                                                          Số: 1958/QĐ-UBND
II    Phù Mỹ                                                                       12.760
 961 Trương Nhựt Hưng    Tam Quan Bắc   BĐ-97805-TS   723 Câu cá ngừ 052079027870    100 Lần 1
 46 Nguyễn Đình Hổ       Trần Phú       BĐ-91597-TS   774 Vây cá ngừ 052064018479    100 Lần 1
                                        SỞ NÔNG NGHIỆP VÀ MÔI TRƯỜNG 32
 Nơi nhận:
 - Như Điều 3;
`;

describe("docDongDanhSach — chữ pdftotext ⇒ dòng tàu", () => {
  const rows = docDongDanhSach(PDF_TEXT);
  it("mỗi STT một dòng, dòng nối gộp vào, mục/tiêu đề/chân trang bỏ, trang đếm theo \\f", () => {
    expect(rows.map((r) => r.reg)).toEqual(["BĐ-93333-TS", "BĐ-93875-TS", "BĐ-93638-TS", "BĐ-97805-TS", "BĐ-91597-TS"]);
    expect(rows[0]).toMatchObject({ stt: 1, ten: "Trần Văn Hòa", page: 1 });
    expect(rows[3].page).toBe(2);
    expect(rows[4].noiDung).not.toMatch(/SỞ NÔNG NGHIỆP/);
  });
  it("CCCD che giữa, tiền + lần giữ nguyên", () => {
    expect(rows[0].noiDung).toBe("1 Trần Văn Hòa Cát Tiến BĐ-93333-TS 785 Câu mực, Mành mực 052******309 100 Lần 4");
    expect(rows[1].noiDung).toMatch(/052\*{6}610 Mành mực 75 Lần 3$/);
  });
  it("trần số dòng; chữ rỗng ⇒ []", () => {
    expect(docDongDanhSach(PDF_TEXT, 2).length).toBe(2);
    expect(docDongDanhSach("")).toEqual([]);
  });
});

describe("chuẩn hoá số đăng ký + điều kiện tra", () => {
  it("BĐ/BD, gạch, khoảng trắng, hoa thường ⇒ một chuẩn", () => {
    for (const s of ["BĐ-93333-TS", "bd 93333 ts", "BĐ93333TS", " Bđ-93333-Ts "]) expect(chuanReg(s)).toBe("BD93333TS");
  });
  it("có ≥4 số ⇒ tra theo số đăng ký, không thì theo tên bỏ dấu; quá ngắn/dài ⇒ null", () => {
    expect(laReg("93333")).toBe(true);
    expect(dieuKienTra("93333")).toEqual({ regNorm: "93333" });
    expect(dieuKienTra("Trần Văn Hòa")).toEqual({ tenNorm: "tran van hoa" });
    expect(dieuKienTra("a")).toBeNull();
    expect(dieuKienTra("x".repeat(41))).toBeNull();
  });
});

describe("kiemDongDanhSach — máy chủ kiểm gói máy thu", () => {
  it("giữ dòng đúng dạng (kèm *_norm), bỏ dòng hỏng, cắt trần", () => {
    const xs = kiemDongDanhSach([
      { stt: 1, ten: "Trần Văn Hòa", reg: "BĐ-93333-TS", noiDung: "1 Trần Văn Hòa …", page: 3 },
      { stt: 2, ten: "x", reg: "không phải", noiDung: "x", page: 1 },
      { stt: -1, ten: 5, reg: "BĐ-1-TS", noiDung: "", page: 0 },
      { stt: 100000, ten: "Lê", reg: "QNg-90123-TS", noiDung: "ok", page: 99999 },
      "rác",
    ]);
    expect(xs.length).toBe(2);
    expect(xs[0]).toMatchObject({ regNorm: "BD93333TS", tenNorm: "tran van hoa", page: 3 });
    expect(xs[1]).toMatchObject({ stt: 0, page: 1, regNorm: "QNG90123TS" });
    expect(kiemDongDanhSach("x")).toEqual([]);
  });
});

describe("feed-client — tab Chính sách theo tỉnh (14 §21c)", () => {
  it("feedQuery gửi province khi có tỉnh, không có ⇒ cả nước; filterCached lọc bản lưu cùng luật", async () => {
    const { feedQuery, filterCached } = await import("@/lib/kairos/feed-client");
    const home = { port: null, province: null };
    const q1 = feedQuery("chinh-sach", home, { tinh: "gia-lai" });
    expect(q1.ok && q1.params.toString()).toBe("chip=chinh-sach&province=gia-lai");
    const q2 = feedQuery("chinh-sach", home, { tinh: null });
    expect(q2.ok && q2.params.toString()).toBe("chip=chinh-sach");
    const p = (id: string, topic: string, provinces: string[]) => ({ id, topic, provinces, ports: [], regions: [] }) as never;
    const ds = [p("a", "chinh-sach", ["gia-lai"]), p("b", "chinh-sach", []), p("c", "chinh-sach", ["khanh-hoa"]), p("d", "nghe-ca", ["gia-lai"])];
    expect(filterCached(ds, "chinh-sach", home, undefined, "gia-lai").map((x: { id: string }) => x.id)).toEqual(["a", "b"]);
    expect(filterCached(ds, "chinh-sach", home, undefined, null).map((x: { id: string }) => x.id)).toEqual(["a", "b", "c"]);
  });
});

// ───────── §21d loại tin (2026-10-26) ─────────
import { LOAI_TIN, loaiTin } from "@/lib/kairos/chinh-sach.mjs";
import { NHAN_LOAI_TIN } from "@/lib/labels";

describe("loaiTin — phân loại thông báo theo từ khoá (tiêu đề thật 2026-10-26)", () => {
  it("chỉ số hiệu 48/2010 cũng ra tiền dầu (foldVi đổi '/' thành khoảng trắng)", () => {
    expect(loaiTin("QĐ phê duyệt danh sách các chủ tàu cá được hỗ trợ kinh phí theo Quyết định số 48/2010/QĐ-TTg")).toContain("dau");
    expect(laTinChoBaCon("Đề nghị xem xét theo Quyết định 48/2010/QĐ-TTg")).toBe(true);
  });
  it("tiền dầu / hỗ trợ / danh sách", () => {
    const l = loaiTin("Quyết định V/v phê duyệt đợt 05 năm 2025 các tàu cá được hỗ trợ chi phí nhiên liệu chuyến biển theo Quyết định số 48/2010/QĐ-TTg");
    expect(l).toEqual(expect.arrayContaining(["dau", "ho-tro", "danh-sach"]));
  });
  it("cảnh báo: gió mạnh, mất tích, bão (còn dấu — 'báo cáo' KHÔNG là bão)", () => {
    expect(loaiTin("Chủ động ứng phó với gió mạnh, sóng lớn trên biển (57/BCĐ-BNNMT)")).toEqual(["canh-bao"]);
    expect(loaiTin("Thông báo tàu cá thuộc diện mất tích của thành phố Đà Nẵng")).toEqual(["canh-bao"]);
    expect(loaiTin("Bão số 12 gây gió giật")).toContain("canh-bao");
    expect(loaiTin("Báo cáo tình hình")).toEqual([]);
  });
  it("quy định, IUU; coDanhSach ⇒ luôn có danh-sach", () => {
    expect(loaiTin("Quyết định quy định Danh mục nghề, ngư cụ cấm sử dụng khai thác thủy sản")).toContain("quy-dinh");
    expect(loaiTin("Phiên họp lần thứ 36 Ban Chỉ đạo Quốc gia về IUU")).toEqual(["iuu"]);
    expect(loaiTin("Văn bản bất kỳ", true)).toEqual(["danh-sach"]);
  });
  it("mỗi loại có nhãn ≤2 chữ", () => {
    for (const l of LOAI_TIN) expect(nhanHopLe(NHAN_LOAI_TIN[l])).toBe(true);
  });
});

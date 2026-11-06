// 14 §21g (2026-11-06): nguồn văn bản cổng Liferay "sdt-vanban-portlet" (HCM, Đà Nẵng) — JSON có sẵn file đính kèm.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { docVbdh, ngayJava, urlChiTietVbdh, urlVbdh, VBDH_TOI_DA } from "@/lib/kairos/chinh-sach.mjs";
import { docNguon, locBaiMoi } from "@/lib/kairos/thu-core.mjs";
import { parseIngestBody, planIngest } from "@/lib/kairos/ingest";

const NOW = Date.parse("2026-11-06T08:00:00Z");
const TRANG = "https://hochiminhcity.gov.vn/van-ban-chi-dao-dieu-hanh";

/** một hàng thật rút gọn từ hochiminhcity.gov.vn (dò 2026-11-06) */
const HANG = {
  trichYeu:
    "Triển khai thực hiện Nghị quyết số 31/2026/NQ-HĐND ngày 27 tháng 8 năm 2026 của Hội đồng nhân dân Thành phố Hồ Chí Minh chính sách hỗ trợ lắp đặt, thay thế thiết bị giám sát hành trình tàu cá",
  soKyHieu: "Số: 583/KH-UBND",
  vanBanDieuHanhId: 11268,
  ngayBanHanh: "Fri Oct 23 00:00:00 ICT 2026",
  vanBanDieuHanhDinhKems: [
    { tenFile: "KH 583 trien khai NQ 31_signed.pdf", typeFile: "pdf", fileDinhKem: "https://hochiminhcity.gov.vn/documents/39403/198301/KH 583 trien khai NQ 31_signed.pdf" },
    { tenFile: "lạ", typeFile: "pdf", fileDinhKem: "https://evil.example.com/x.pdf" },
  ],
};

describe("cổng vbdh — URL", () => {
  it("URL hỏi JSON giữ đúng tham số portlet + từ khoá + trần, bỏ query cũ", () => {
    const u = new URL(urlVbdh(`${TRANG}?a=1`, "tàu cá"));
    expect(u.origin + u.pathname).toBe(TRANG);
    expect(u.searchParams.get("p_p_id")).toBe("VBDH_WAR_sdtvanbanportlet");
    expect(u.searchParams.get("p_p_resource_id")).toBe("loadVanBanDieuHanh");
    expect(u.searchParams.get("txtSearch")).toBe("tàu cá");
    expect(u.searchParams.get("limit")).toBe(String(VBDH_TOI_DA));
    expect(u.searchParams.get("a")).toBeNull();
  });
  it("URL chi tiết = đường 'Xem chi tiết' của cổng", () => {
    const u = new URL(urlChiTietVbdh(TRANG, 11268));
    expect(u.searchParams.get("_VBDH_WAR_sdtvanbanportlet_action")).toBe("themMoi");
    expect(u.searchParams.get("id")).toBe("11268");
    expect(u.searchParams.get("view")).toBe("details");
  });
});

describe("cổng vbdh — đọc JSON", () => {
  it("ngày kiểu Java ⇒ ISO 08:00 giờ VN; dd/mm/yyyy vẫn nhận; rác ⇒ null", () => {
    expect(ngayJava("Thu Nov 05 00:00:00 ICT 2026")).toBe("2026-11-05T01:00:00.000Z");
    expect(ngayJava("05/11/2026")).toBe("2026-11-05T01:00:00.000Z");
    expect(ngayJava("Thu Xyz 05 00:00:00 ICT 2026")).toBeNull();
    expect(ngayJava(undefined)).toBeNull();
  });
  it("hàng ⇒ tiêu đề 'trích yếu (số hiệu)', link chi tiết, ngày, file gov mã hoá dấu cách; file ngoài gov bỏ", () => {
    const [it] = docVbdh({ total: 1, rows: [HANG] }, TRANG);
    expect(it.title).toMatch(/^Triển khai thực hiện Nghị quyết số 31\/2026.*\(583\/KH-UBND\)$/);
    expect(it.description).toBe(HANG.trichYeu);
    expect(it.link).toBe(urlChiTietVbdh(TRANG, 11268));
    expect(it.publishedAt).toBe("2026-10-23T01:00:00.000Z");
    expect(it.attachments).toEqual([
      { title: "KH 583 trien khai NQ 31_signed.pdf", url: "https://hochiminhcity.gov.vn/documents/39403/198301/KH%20583%20trien%20khai%20NQ%2031_signed.pdf" },
    ]);
  });
  it("JSON hỏng / thiếu rows / hàng thiếu id hay trích yếu quá ngắn ⇒ bỏ, không ném", () => {
    expect(docVbdh("{không phải json", TRANG)).toEqual([]);
    expect(docVbdh({ total: 0 }, TRANG)).toEqual([]);
    expect(docVbdh(null, TRANG)).toEqual([]);
    expect(docVbdh({ rows: [{ ...HANG, vanBanDieuHanhId: "x" }, { ...HANG, trichYeu: "ngắn" }, null] }, TRANG)).toEqual([]);
    const [khongSo] = docVbdh(JSON.stringify({ rows: [{ ...HANG, soKyHieu: "", vanBanDieuHanhDinhKems: undefined }] }), TRANG);
    expect(khongSo.title).toBe(HANG.trichYeu);
    expect(khongSo.attachments).toEqual([]);
  });
});

describe("cổng vbdh — cấu hình + máy thu + máy chủ", () => {
  const nguon = (over: Record<string, unknown> = {}) => ({
    nguon: [{ id: "gov-hcm", outlet: "UBND TP Hồ Chí Minh", feedUrl: TRANG, section: "chinh-sach", topic: "chinh-sach", kieu: "gov", vbdh: ["tàu cá", " IUU "], ...over }],
  });
  it("docNguon giữ vbdh (cắt khoảng trắng); chỉ nguồn gov; 1–8 từ khoá hợp lệ", () => {
    expect(docNguon(nguon())[0].vbdh).toEqual(["tàu cá", "IUU"]);
    expect("vbdh" in docNguon(nguon({ vbdh: undefined }))[0]).toBe(false);
    expect(() => docNguon(nguon({ vbdh: [] }))).toThrow(/1–8/);
    expect(() => docNguon(nguon({ vbdh: Array(9).fill("tàu") }))).toThrow(/1–8/);
    expect(() => docNguon(nguon({ vbdh: ["x"] }))).toThrow(/từ khoá sai/);
    expect(() => docNguon(nguon({ kieu: "rss", topic: "thoi-su", section: "thoi-su", feedUrl: "https://vnexpress.net/rss" }))).toThrow(/chỉ dành cho nguồn gov/);
  });
  it("kairos-nguon.json thật: HCM + Đà Nẵng có vbdh và đọc qua được docNguon", () => {
    const ds = docNguon(JSON.parse(readFileSync("scripts/kairos-nguon.json", "utf8")));
    for (const id of ["gov-hcm-van-ban", "gov-danang-van-ban"]) {
      const n = ds.find((x) => x.id === id);
      expect(n?.kieu).toBe("gov");
      expect(n?.vbdh?.length).toBeGreaterThan(0);
    }
  });
  it("locBaiMoi mang file đính kèm của JSON đi tiếp; máy chủ gắn tỉnh TP HCM từ tên cơ quan", () => {
    const [n] = docNguon(nguon());
    const so = { links: {}, titles: [] };
    const [b] = locBaiMoi(n, docVbdh({ rows: [HANG] }, TRANG), so as never, NOW);
    expect(b.attachments?.length).toBe(1);
    const r = parseIngestBody({ items: [{ ...b, summary: null, summaryBy: "rss" }] });
    expect(r.ok && r.items.length).toBe(1);
    const plan = planIngest(r.ok ? r.items : [], { seenHashes: new Set(), recentTitles: [], now: NOW, ports: [] });
    expect(plan.posts[0]).toMatchObject({ topic: "chinh-sach", attachments: b.attachments });
    expect(plan.posts[0].provinces).toContain("ho-chi-minh");
  });
});

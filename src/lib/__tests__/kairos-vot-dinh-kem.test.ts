import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

/*  VỚT FILE ĐÍNH KÈM (14 §21b, 2026-11-13). Bà con Bình Định báo "bữa gõ mã tàu dễ mà nay ko gõ tìm được": QĐ 4475
    Gia Lai đợt 06/2026 vào kho KHÔNG file vì tường lửa F5 trả 200 + "Request Rejected" cho máy GPU ⇒ không dòng ⇒
    không ô Tra cứu. Soi: nhận ra trang chặn · hàng vớt xoay vòng · máy chủ chỉ gắn file cho bài còn trống · gắn xong
    thì dòng gửi vào được và bài có ô tra (coDanhSach). */

const h = vi.hoisted(() => ({ store: null as unknown, key: "k".repeat(40) as string | null }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/api-identity", () => ({ identityFromRequest: async () => ({ ok: true, phone: null }) }));
vi.mock("@/lib/app-config", () => ({ getConfigValue: async () => h.key }));
vi.mock("@/lib/kairos/store", async (orig) => ({ ...(await orig<object>()), getKairosStore: async () => h.store }));

vi.stubEnv("MARKET_STORE", "file");
vi.stubEnv("VERCEL", "");
vi.stubEnv("KAIROS_INGEST_KEY", "");

import {
  dieuKienTra, docDongDanhSach, ganDinhKem, gopHangVot, kiemDongDanhSach, laTrangChan, loiReg, VOT_GIU_MS, VOT_TOI_DA,
} from "@/lib/kairos/chinh-sach.mjs";
import { urlHash } from "@/lib/kairos/lien-ket.mjs";
import { createKairosFileStore } from "@/lib/kairos/file-store";
import type { KairosStore } from "@/lib/kairos/store";
import { hydratePosts } from "@/lib/kairos/server";
import { PUT as dinhKemPut } from "@/app/api/kairos/dinh-kem/route";

const NOW = Date.parse("2026-11-13T02:00:00Z");
const BAI = "https://gialai.gov.vn/van-ban-chi-dao-dieu-hanh/quyet-dinh-phe-duyet-danh-sach-tau-ca-dot-06.html";
const QD = { title: "Quyết định 4475/QĐ-UBND (PDF)", url: "https://gialai.gov.vn/upload/2005340/20261029/4475_QD_UBND_e75b7.pdf" };
const PL = { title: "Phụ lục Quyết định 4475/QĐ-UBND (PDF)", url: "https://gialai.gov.vn/upload/2005340/20261029/PL_4475_bf612.pdf" };
const F5 =
  "<html><head><title>Request Rejected</title></head><body>The requested URL was rejected. Please consult with your administrator.<br><br>Your support ID is: <14438174768203075098><br><br><a href='javascript:history.back();'>[Go Back]</body></html>";

describe("laTrangChan — trang chặn của tường lửa không phải văn bản", () => {
  it("F5 'Request Rejected' 245 byte (đo thật 13/11 từ máy GPU) ⇒ chặn", () => {
    expect(laTrangChan(F5)).toBe(true);
  });
  it("rỗng / quá ngắn ⇒ chặn; trang dài có chữ chặn ở đầu ⇒ chặn", () => {
    expect(laTrangChan("")).toBe(true);
    expect(laTrangChan(null)).toBe(true);
    expect(laTrangChan("<html>ok</html>")).toBe(true);
    expect(laTrangChan(`<html><title>Just a moment...</title>${" ".repeat(3000)}</html>`)).toBe(true);
  });
  it("trang văn bản thật (dài, không chữ chặn) ⇒ không chặn", () => {
    const that = `<html><head><title>Quyết định 4475</title></head><body><table><tr><th>File đính kèm</th><td><a href="${QD.url}">Tải xuống</a></td></tr></table>${"<p>nội dung</p>".repeat(200)}</body></html>`;
    expect(laTrangChan(that)).toBe(false);
  });
});

describe("ganDinhKem — máy chủ chỉ gắn file cho bài còn TRỐNG", () => {
  it("bài trống + file gov ⇒ ghi", () => {
    expect(ganDinhKem([], [QD, PL])).toEqual([QD, PL]);
    expect(ganDinhKem(undefined, [QD])).toEqual([QD]);
  });
  it("bài đã có file ⇒ không đè (dòng đã gắn theo băm link file)", () => {
    expect(ganDinhKem([QD], [PL])).toBeNull();
  });
  it("file không trên tên miền nhà nước / hỏng ⇒ bỏ; không còn gì ⇒ null", () => {
    expect(ganDinhKem([], [{ title: "Lạ", url: "https://evil.example/ds.pdf" }, { title: "", url: QD.url }])).toBeNull();
    expect(ganDinhKem([], "không phải mảng")).toBeNull();
  });
});

describe("gopHangVot — hàng đợi vớt của máy thu", () => {
  it("gộp, bỏ trùng giữ mốc vào hàng cũ nhất, bỏ link không https", () => {
    const q = gopHangVot([{ postUrl: BAI, ts: NOW - 1000, thu: 0 }, { postUrl: "http://x.gov.vn/a", ts: NOW }], [BAI], NOW);
    expect(q).toEqual([{ postUrl: BAI, ts: NOW - 1000, thu: 0 }]);
  });
  it("quá 14 ngày ⇒ bỏ", () => {
    expect(gopHangVot([{ postUrl: BAI, ts: NOW - VOT_GIU_MS - 1, thu: 0 }], [], NOW)).toEqual([]);
  });
  it("bài lâu chưa thử lên đầu — bài bị chặn mãi không giữ chỗ bài mới", () => {
    const cu = [
      { postUrl: "https://a.gov.vn/1", ts: NOW - 5000, thu: NOW - 100 },
      { postUrl: "https://a.gov.vn/2", ts: NOW - 4000, thu: NOW - 100 },
    ];
    const q = gopHangVot(cu, ["https://a.gov.vn/3"], NOW);
    expect(q.map((x) => x.postUrl)).toEqual(["https://a.gov.vn/3", "https://a.gov.vn/1", "https://a.gov.vn/2"]);
  });
  it(`giữ ≤ ${VOT_TOI_DA} bài vào hàng gần nhất`, () => {
    const cu = Array.from({ length: VOT_TOI_DA + 5 }, (_, i) => ({ postUrl: `https://a.gov.vn/${i}`, ts: NOW - (VOT_TOI_DA + 5 - i) * 1000, thu: 0 }));
    const q = gopHangVot(cu, [], NOW);
    expect(q).toHaveLength(VOT_TOI_DA);
    expect(q.some((x) => x.postUrl === "https://a.gov.vn/0")).toBe(false);
  });
});

describe("PUT /api/kairos/dinh-kem — vớt file rồi gửi dòng", () => {
  let dir: string;
  let store: KairosStore;
  const put = (body: unknown, key: string | null = h.key) =>
    dinhKemPut(
      new Request("http://x/api/kairos/dinh-kem", {
        method: "PUT",
        headers: { "content-type": "application/json", ...(key ? { "x-kairos-key": key } : {}) },
        body: JSON.stringify(body),
      }),
    );
  const dong = [{ stt: 1, ten: "Nguyễn Văn A", reg: "BĐ-97123-TS", noiDung: "1 Nguyễn Văn A Hoài Nhơn BĐ-97123-TS 829 CV", page: 1 }];

  beforeAll(async () => {
    dir = mkdtempSync(path.join(os.tmpdir(), "kairos-vot-"));
    store = createKairosFileStore({ dir });
    h.store = store;
    await store.insertBao([
      {
        kind: "bao", author_phone: null, source_id: "gov-gialai-van-ban", outlet: "UBND tỉnh Gia Lai", url: BAI, url_hash: urlHash(BAI),
        title: "Quyết định phê duyệt danh sách tàu cá đủ điều kiện (đợt 06 năm 2026)", title_norm: "qd", summary: "Tỉnh Gia Lai vừa duyệt danh sách tàu cá.",
        summary_by: "ai", body: "", images: [], topic: "chinh-sach", regions: ["mien-trung"], provinces: ["gia-lai"], ports: [], reshare_of: null,
        mod_state: "dat", attachments: [],
      } as never,
    ]);
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));

  it("sai khoá ⇒ 401; thiếu cả url lẫn dinhKem ⇒ 400; bài chưa vào kho ⇒ 404", async () => {
    expect((await put({ postUrl: BAI, dinhKem: [QD] }, "sai".repeat(14))).status).toBe(401);
    expect((await put({ postUrl: BAI })).status).toBe(400);
    expect((await put({ postUrl: "https://gialai.gov.vn/chua-co.html", dinhKem: [QD] })).status).toBe(404);
  });

  it("bài trống file: dòng gửi trước khi vớt bị từ chối (400) — đúng chuyện đã xảy ra với đợt 06", async () => {
    expect((await put({ postUrl: BAI, url: PL.url, rows: dong })).status).toBe(400);
  });

  it("vớt: gắn file ⇒ dòng vào được ⇒ thẻ có ô Tra cứu (coDanhSach)", async () => {
    const r = await put({ postUrl: BAI, dinhKem: [QD, PL] });
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ ok: true, gan: 2 });
    const p = await store.postByUrlHash(urlHash(BAI)!);
    expect(p?.attachments).toEqual([QD, PL]);

    const d = await put({ postUrl: BAI, url: PL.url, rows: dong });
    expect(d.status).toBe(200);
    expect(await d.json()).toMatchObject({ ok: true, inserted: 1 });

    const [dto] = await hydratePosts(store, [p!], null, []);
    expect(dto.coDanhSach).toBe(true);
    const tim = await store.traDinhKemDong(p!.id, { regNorm: "BD97123TS" }, 20);
    expect(tim.map((x) => x.reg)).toEqual(["BĐ-97123-TS"]);
  });

  it("bài đã có file ⇒ gửi vớt lần nữa không đè (gan 0)", async () => {
    const r = await put({ postUrl: BAI, dinhKem: [{ title: "Khác (PDF)", url: "https://gialai.gov.vn/upload/khac.pdf" }] });
    expect(await r.json()).toMatchObject({ ok: true, gan: 0 });
    expect((await store.postByUrlHash(urlHash(BAI)!))?.attachments).toEqual([QD, PL]);
  });
});

describe("docDongDanhSach — bảng ô nhiều dòng (QĐ 4475 Gia Lai đợt 06/2026, chữ pdftotext -layout thật)", () => {
  // tên nằm trên + dưới dòng STT, số đăng ký tách "GL-" / "83050-TS", 2 trang — cách đọc theo dòng STT cũ ra 0 dòng
  const text = readFileSync(path.join(__dirname, "fixtures/kairos-pl-4475-gia-lai-dot06-2026.txt"), "utf8");
  const rows = docDongDanhSach(text);
  it("đủ 20 tàu, STT 1→20, trang 1 và 2", () => {
    expect(rows.map((r) => r.stt)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    expect(rows.filter((r) => r.page === 2).map((r) => r.stt)).toEqual([15, 16, 17, 18, 19, 20]);
  });
  it("ghép số đăng ký tách dòng + tên hai dòng", () => {
    expect(rows[0]).toMatchObject({ reg: "GL-83050-TS", ten: "Phạm Hùng Vương" });
    expect(rows[6]).toMatchObject({ reg: "GL-99341-TS", ten: "Trần Thị Ái Hằng" });
    expect(rows[16]).toMatchObject({ reg: "GL-96785-TS", ten: "Trịnh Văn Nhơn" });
    expect(rows[19]).toMatchObject({ reg: "GL-99377-TS", ten: "Trần Hữu Nghị" });
    expect(rows[0].noiDung).toContain("Cát Tiến");
    expect(rows[0].noiDung).toContain("740");
  });
  it("dòng qua được máy chủ (kiemDongDanhSach) và tra theo lõi số", () => {
    const k = kiemDongDanhSach(rows);
    expect(k).toHaveLength(20);
    expect(k[4].regNorm).toBe("GL99338TS");
    const dk = dieuKienTra("BĐ-99338-TS");
    const loi = dk && "regNorm" in dk ? dk.regNorm : "";
    expect(k.filter((r) => r.regNorm.includes(loi)).map((r) => r.reg)).toEqual(["GL-99338-TS"]);
  });
});

describe("loiReg / dieuKienTra — số đăng ký so theo lõi số (sáp nhập BĐ ⇒ GL)", () => {
  it("chữ tỉnh cũ, gạch, khoảng trắng đều ra cùng lõi số", () => {
    expect(loiReg("BĐ-99338-TS")).toBe("99338");
    expect(loiReg("gl 99338 ts")).toBe("99338");
    expect(loiReg("99338")).toBe("99338");
    expect(loiReg("Trần Văn")).toBe("");
    expect(dieuKienTra("BĐ-99338-TS")).toEqual({ regNorm: "99338" });
    expect(dieuKienTra("Trần Hữu Nghị")).toEqual({ tenNorm: "tran huu nghi" });
  });
});

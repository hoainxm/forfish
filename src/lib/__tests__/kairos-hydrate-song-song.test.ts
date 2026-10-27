import { afterAll, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

/*  hydratePosts: bài gốc ∥ kemTheoBai (top bình luận + đếm đính kèm CẢ TRANG trong MỘT lượt) — 2026-10-27. Máy chủ
    sdvico ở VN gọi Supabase Seoul 0,35–2 s+ mỗi request; trước đây bình luận nổi bật + đếm đính kèm là một request
    MỖI BÀI (dòng tin 21 request ⇒ 10–40 s, quá hạn 12 s của app). Test đỏ nếu quay lại gọi từng bài hoặc nối tiếp. */

vi.mock("server-only", () => ({}));
vi.stubEnv("MARKET_STORE", "file");
vi.stubEnv("VERCEL", "");

import { createKairosFileStore } from "@/lib/kairos/file-store";
import { hydratePosts } from "@/lib/kairos/server";
import type { NewPost } from "@/lib/kairos/store";

const dir = mkdtempSync(path.join(os.tmpdir(), "kairos-song-song-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const bai = (url: string, topic: "chinh-sach" | "tin", attachments: { title: string; url: string }[]): NewPost => ({
  kind: "bao", author_phone: null, body: "", images: [], topic, regions: [], provinces: ["gia-lai"], ports: [],
  reshare_of: null, outlet: "UBND tỉnh Gia Lai", url, url_hash: url, title: url, title_norm: url, summary: "s", summary_by: "ai",
  attachments, mod_state: "dat",
});

async function dung() {
  const store = createKairosFileStore({ dir: mkdtempSync(path.join(dir, "k-")) });
  await store.insertBao([
    bai("https://gialai.gov.vn/goc", "tin", []),
    bai("https://gialai.gov.vn/cs", "chinh-sach", [{ title: "QĐ (PDF)", url: "https://gialai.gov.vn/a.pdf" }]),
  ]);
  const goc = (await store.postByUrlHash("https://gialai.gov.vn/goc"))!;
  const cs = (await store.postByUrlHash("https://gialai.gov.vn/cs"))!;
  await store.replaceDinhKemDong(cs.id, "h", [
    { stt: 1, ten: "Trần Văn Hòa", tenNorm: "tran van hoa", reg: "BĐ-93333-TS", regNorm: "BD93333TS", noiDung: "1 Trần Văn Hòa …", page: 3 },
  ]);
  // bài đăng lại (⇒ getPosts) có bình luận; bài chính sách có đính kèm + có dòng danh sách
  const rows = [{ ...goc, id: "dang-lai-1", reshare_of: cs.id, comment_count: 1 }, { ...cs, comment_count: 2 }];
  return { store, rows };
}

describe("hydratePosts — một lượt cho cả trang", () => {
  it("bài gốc ∥ kemTheoBai cùng lúc; KHÔNG gọi topComments / demDinhKemDong từng bài", async () => {
    const { store, rows } = await dung();
    const daGoi = new Set<string>();
    const tungBai: string[] = [];
    let mo!: () => void;
    const cong = new Promise<void>((r) => (mo = r));
    const duPhong = setTimeout(() => mo(), 400); // nối tiếp ⇒ chỉ thoát nhờ hẹn giờ này
    let soDaGoiKhiMo = 0;
    const boc = <A extends unknown[], R>(ten: string, fn: (...a: A) => Promise<R>) => async (...a: A): Promise<R> => {
      daGoi.add(ten);
      if (daGoi.size === 2) mo();
      await cong;
      if (!soDaGoiKhiMo) soDaGoiKhiMo = daGoi.size;
      return fn(...a);
    };
    let kemIds: string[] = [];
    const gia = {
      ...store,
      getPosts: boc("getPosts", store.getPosts),
      kemTheoBai: boc("kemTheoBai", (ids: string[], n: number, ex: string[], dem: boolean) => ((kemIds = ids), store.kemTheoBai(ids, n, ex, dem))),
      topComments: async (...a: Parameters<typeof store.topComments>) => (tungBai.push("topComments"), store.topComments(...a)),
      demDinhKemDong: async (id: string) => (tungBai.push("demDinhKemDong"), store.demDinhKemDong(id)),
    };
    const ps = await hydratePosts(gia, rows, null, []);
    clearTimeout(duPhong);
    expect(ps).toHaveLength(2);
    expect(soDaGoiKhiMo).toBe(2);
    expect(new Set(kemIds)).toEqual(new Set(rows.map((r) => r.id)));
    // hydratePosts không gọi từng bài (kho file tự dùng bản GỐC bên trong kemTheoBai, không qua bản bọc này)
    expect(tungBai).toEqual([]);
    expect(ps[1].coDanhSach).toBe(true);
    expect(ps[0].coDanhSach).toBeUndefined();
  });

  it("chỉ đếm đính kèm hỏng (trang không cần bình luận) ⇒ không ô Tra cứu, dòng tin vẫn trả", async () => {
    const { store, rows } = await dung();
    const gia = { ...store, kemTheoBai: async () => { throw new Error("mạng"); } };
    const ps = await hydratePosts(gia, rows.map((r) => ({ ...r, comment_count: 0 })), null, []);
    expect(ps.map((p) => !!p.coDanhSach)).toEqual([false, false]);
  });

  it("bình luận hỏng ⇒ ném như topComments cũ", async () => {
    const { store, rows } = await dung();
    const gia = { ...store, kemTheoBai: async () => { throw new Error("mạng"); } };
    await expect(hydratePosts(gia, rows, null, [])).rejects.toThrow("mạng");
  });
});

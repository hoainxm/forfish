import { afterAll, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

/*  hydratePosts chạy bài gốc · bình luận nổi bật · đếm đính kèm trong MỘT chặng (2026-10-27): máy chủ sdvico ở VN
    gọi Supabase Seoul 0,35–2 s mỗi lượt ⇒ mỗi chặng nối tiếp là một lượt chờ; dòng tin từng 7–13 s, quá hạn 12 s của
    app. Test này đỏ nếu ai đó viết lại thành await lần lượt. */

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

describe("hydratePosts — ba việc độc lập chạy cùng lúc", () => {
  it("getPosts, topComments, demDinhKemDong đều đã được gọi trước khi việc nào xong", async () => {
    const store = createKairosFileStore({ dir });
    await store.insertBao([
      bai("https://gialai.gov.vn/goc", "tin", []),
      bai("https://gialai.gov.vn/cs", "chinh-sach", [{ title: "QĐ (PDF)", url: "https://gialai.gov.vn/a.pdf" }]),
    ]);
    const goc = (await store.postByUrlHash("https://gialai.gov.vn/goc"))!;
    const cs = (await store.postByUrlHash("https://gialai.gov.vn/cs"))!;

    const daGoi = new Set<string>();
    let mo!: () => void;
    const cong = new Promise<void>((r) => (mo = r));
    const duPhong = setTimeout(() => mo(), 400); // nối tiếp ⇒ chỉ thoát nhờ hẹn giờ này
    let soDaGoiKhiMo = 0;
    const boc = <A extends unknown[], R>(ten: string, fn: (...a: A) => Promise<R>) => async (...a: A): Promise<R> => {
      daGoi.add(ten);
      if (daGoi.size === 3) mo();
      await cong;
      if (!soDaGoiKhiMo) soDaGoiKhiMo = daGoi.size;
      return fn(...a);
    };
    const gia = {
      ...store,
      getPosts: boc("getPosts", store.getPosts),
      topComments: boc("topComments", store.topComments),
      demDinhKemDong: boc("demDinhKemDong", store.demDinhKemDong),
    };

    // bài đăng lại (⇒ getPosts) có bình luận (⇒ topComments); bài chính sách có đính kèm (⇒ demDinhKemDong)
    const rows = [{ ...goc, id: "dang-lai-1", reshare_of: cs.id, comment_count: 1 }, cs];
    const ps = await hydratePosts(gia, rows, null, []);
    clearTimeout(duPhong);
    expect(ps).toHaveLength(2);
    expect(soDaGoiKhiMo).toBe(3);
  });
});

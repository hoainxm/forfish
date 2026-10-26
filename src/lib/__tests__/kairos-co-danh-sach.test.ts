import { afterAll, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

/*  Ô Tra cứu chỉ cho bài CÓ danh sách tàu cá / bà con (14 §21b, anh Long 2026-10-26: "cái nào có danh sách tàu cá hay
    danh sách bà con thì mới tra cứu"): hydratePosts gắn `coDanhSach` khi bảng dòng (0075) có dòng của bài. */

vi.mock("server-only", () => ({}));
vi.stubEnv("MARKET_STORE", "file");
vi.stubEnv("VERCEL", "");

import { createKairosFileStore } from "@/lib/kairos/file-store";
import { hydratePosts } from "@/lib/kairos/server";
import type { NewPost } from "@/lib/kairos/store";

const dir = mkdtempSync(path.join(os.tmpdir(), "kairos-cds-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const bai = (url: string, attachments: { title: string; url: string }[]): NewPost => ({
  kind: "bao", author_phone: null, body: "", images: [], topic: "chinh-sach", regions: [], provinces: ["gia-lai"], ports: [],
  reshare_of: null, outlet: "UBND tỉnh Gia Lai", url, url_hash: url, title: url, title_norm: url, summary: "s", summary_by: "ai",
  attachments, mod_state: "dat",
});

describe("hydratePosts — coDanhSach", () => {
  it("chỉ bài chinh-sach có đính kèm VÀ đã có dòng danh sách mới mang cờ", async () => {
    const store = createKairosFileStore({ dir });
    const f = { title: "QĐ (PDF)", url: "https://gialai.gov.vn/a.pdf" };
    await store.insertBao([bai("https://gialai.gov.vn/co-ds", [f]), bai("https://gialai.gov.vn/khong-ds", [f]), bai("https://gialai.gov.vn/khong-file", [])]);
    const co = (await store.postByUrlHash("https://gialai.gov.vn/co-ds"))!;
    await store.replaceDinhKemDong(co.id, "h", [
      { stt: 1, ten: "Trần Văn Hòa", tenNorm: "tran van hoa", reg: "BĐ-93333-TS", regNorm: "BD93333TS", noiDung: "1 Trần Văn Hòa …", page: 3 },
    ]);
    const rows = await Promise.all(["co-ds", "khong-ds", "khong-file"].map((k) => store.postByUrlHash(`https://gialai.gov.vn/${k}`)));
    const ps = await hydratePosts(store, rows.map((r) => r!), null, [], { topComments: false });
    expect(ps.map((p) => !!p.coDanhSach)).toEqual([true, false, false]);
    expect("coDanhSach" in ps[1]).toBe(false);
  });
});

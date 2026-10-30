import { describe, it, expect, vi, beforeEach } from "vitest";

/*  Rà 28/10 mục A9 — POST /api/me/docs/photo chọn loại ảnh theo MAGIC BYTES, không theo `file.type` máy khai.
    File khai "image/jpeg" mà nội dung là chữ ⇒ 400 bad_type, không lên kho. Ảnh thật khai sai/bỏ trống ⇒ nhận,
    lưu với loại đọc từ nội dung. */

vi.mock("server-only", () => ({}));
const upload = vi.fn(async () => ({ error: null }));
vi.mock("@/lib/api-identity", () => ({
  identityFromRequest: async () => ({ ok: true, phone: "0901234567" }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ storage: { from: () => ({ upload }) } }),
}));

import { POST } from "@/app/api/me/docs/photo/route";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);

function goi(bytes: Uint8Array<ArrayBuffer>, type: string) {
  const f = new FormData();
  f.set("docId", "giay-1");
  f.set("file", new Blob([bytes], { type }), "a");
  return POST(new Request("http://x/api/me/docs/photo", { method: "POST", body: f }));
}

beforeEach(() => upload.mockClear());

describe("ảnh giấy tờ — kiểm theo nội dung", () => {
  it("khai jpeg mà nội dung là chữ ⇒ 400 bad_type, không tải lên", async () => {
    const r = await goi(new TextEncoder().encode("<script>alert(1)</script>"), "image/jpeg");
    expect(r.status).toBe(400);
    expect(await r.json()).toMatchObject({ code: "bad_type" });
    expect(upload).not.toHaveBeenCalled();
  });
  it("ảnh PNG thật khai sai là jpeg ⇒ nhận, lưu đuôi .png và contentType png", async () => {
    const r = await goi(PNG, "image/jpeg");
    expect(r.status).toBe(200);
    const j = (await r.json()) as { path: string };
    expect(j.path).toMatch(/^0901234567\/giay-1\/.+\.png$/);
    expect(upload).toHaveBeenCalledWith(j.path, expect.any(Uint8Array), { contentType: "image/png", upsert: false });
  });
  it("ảnh JPEG khai trống (WebView) ⇒ nhận", async () => {
    const r = await goi(JPEG, "");
    expect(r.status).toBe(200);
    expect(((await r.json()) as { path: string }).path).toMatch(/\.jpg$/);
  });
});

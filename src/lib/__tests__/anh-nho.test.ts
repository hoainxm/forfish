import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { anhNho, luiAnhGoc } from "@/lib/anh-nho";

const PUB = join(process.cwd(), "public");

describe("anhNho — ảnh nhỏ cho sản phẩm SDVICO trên chợ", () => {
  it("ảnh SDVICO nội bộ png/jpg ⇒ bản webp nhỏ", () => {
    expect(anhNho("/sdvico/adnano.png")).toBe("/sdvico/nho/adnano.webp");
    expect(anhNho("/sdvico/loc-dau.jpg")).toBe("/sdvico/nho/loc-dau.webp");
    expect(anhNho("/sdvico/X.JPEG")).toBe("/sdvico/nho/X.webp");
  });

  it("ảnh ngoài / đường khác / đã là bản nhỏ ⇒ giữ nguyên", () => {
    for (const u of [
      "https://abc.supabase.co/storage/v1/object/public/cho/a.png",
      "/khac/a.png",
      "/sdvico/nho/adnano.webp",
      "/sdvico/a/b.png",
      "",
    ])
      expect(anhNho(u)).toBe(u);
  });

  it("luiAnhGoc: bản nhỏ hỏng ⇒ đổi về gốc MỘT lần; ảnh ngoài / đã lùi ⇒ báo hỏng", () => {
    const el = { src: "/sdvico/nho/adnano.webp", dataset: {} as DOMStringMap };
    expect(luiAnhGoc(el, "/sdvico/adnano.png")).toBe(true);
    expect(el.src).toBe("/sdvico/adnano.png");
    expect(luiAnhGoc(el, "/sdvico/adnano.png")).toBe(false); // gốc cũng hỏng
    const ngoai = { src: "https://x/a.png", dataset: {} as DOMStringMap };
    expect(luiAnhGoc(ngoai, "https://x/a.png")).toBe(false);
    expect(ngoai.src).toBe("https://x/a.png");
  });

  it("CỔNG: MỌI ảnh gốc public/sdvico có bản nhỏ (thêm ảnh ⇒ chạy scripts/anh-nho-sdvico.mjs)", () => {
    const goc = readdirSync(join(PUB, "sdvico")).filter((f) => /\.(png|jpe?g)$/i.test(f));
    expect(goc.length).toBeGreaterThan(0);
    for (const f of goc) expect(existsSync(join(PUB, anhNho(`/sdvico/${f}`))), f).toBe(true);
  });

  it("CỔNG: tổng bản nhỏ dưới 200 KB, mỗi ảnh dưới 30 KB", () => {
    const dir = join(PUB, "sdvico", "nho");
    const kich = readdirSync(dir).map((f) => statSync(join(dir, f)).size);
    for (const k of kich) expect(k).toBeLessThan(30 * 1024);
    expect(kich.reduce((a, b) => a + b, 0)).toBeLessThan(200 * 1024);
  });
});

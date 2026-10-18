// GET /api/dev/uploads/[name] — phát ảnh đã tải ở dev (`.local/market-uploads/`).
// CHỈ file mode. Chống path traversal hai lớp (12 §6.4): tên khớp regex (dấu
// chấm CHỈ ở đuôi ⇒ không có `..`) + đường dẫn resolve phải nằm trong thư mục.
import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { isDevFileMode } from "@/lib/market/dev-mode";
import { devUploadDir } from "@/lib/market/file-store";

type Ctx = { params: Promise<{ name: string }> };

const NAME_OK = /^[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$/;
const TYPE: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

export async function GET(_req: Request, ctx: Ctx) {
  if (!isDevFileMode()) return NextResponse.json({ ok: false, code: "not_found" }, { status: 404 });
  const { name } = await ctx.params;
  if (!NAME_OK.test(name)) return NextResponse.json({ ok: false, code: "not_found" }, { status: 404 });
  const dir = path.resolve(devUploadDir());
  const full = path.resolve(dir, name);
  if (!full.startsWith(dir + path.sep)) return NextResponse.json({ ok: false, code: "not_found" }, { status: 404 });
  try {
    const bytes = await fs.readFile(full);
    const ext = name.slice(name.lastIndexOf(".") + 1).toLowerCase();
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: { "Content-Type": TYPE[ext] ?? "application/octet-stream", "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ ok: false, code: "not_found" }, { status: 404 });
  }
}

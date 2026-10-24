// GET /api/dev/kairos-media/[name] — phát ảnh Kairos đã tải ở máy dev (`.local/kairos-uploads/`).
// CHỈ kho file (isDevFileMode). Khuôn /api/dev/uploads: tên khớp regex (không `..`) + đường
// resolve phải nằm trong thư mục. Prod dùng URL công khai của bucket kairos-media.
import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { isDevFileMode } from "@/lib/market/dev-mode";
import { kairosDevUploadDir } from "@/lib/kairos/file-store";

type Ctx = { params: Promise<{ name: string }> };

const NAME_OK = /^[0-9a-f-]{36}__[0-9a-f-]{36}\.(jpg|png|webp)$/i;
const TYPE: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };
const nf = () => NextResponse.json({ ok: false, code: "not_found" }, { status: 404 });

export async function GET(_req: Request, ctx: Ctx) {
  if (!isDevFileMode()) return nf();
  const { name } = await ctx.params;
  if (!NAME_OK.test(name)) return nf();
  const dir = path.resolve(kairosDevUploadDir());
  const full = path.resolve(dir, name);
  if (!full.startsWith(dir + path.sep)) return nf();
  try {
    const bytes = await fs.readFile(full);
    const ext = name.slice(name.lastIndexOf(".") + 1).toLowerCase();
    return new NextResponse(new Uint8Array(bytes), { status: 200, headers: { "Content-Type": TYPE[ext] ?? "application/octet-stream", "Cache-Control": "no-store" } });
  } catch {
    return nf();
  }
}

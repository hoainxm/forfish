// GET /api/kairos/users?q=<chữ> — TÌM NGƯỜI ĐỂ NHẮC TÊN "@Tên" (14 §3.12, 0071).
// Khách gọi được (cùng trần đọc `readerOf`) nhưng ô viết chỉ mở cho người đã đăng nhập. Trả ≤8 người khớp tên gọi
// (bỏ dấu, chứa chữ gõ): id công khai, tên, ảnh, cờ AI — KHÔNG SĐT. Bỏ chính mình + người mình chặn. q < 1 ký tự
// hoặc > 30 ⇒ danh sách rỗng (không quét kho).
import { NextResponse } from "next/server";
import { authorDto } from "@/lib/kairos/dto";
import { kairosErrorResponse, readerOf, storeOr503 } from "@/lib/kairos/server";
import { handleNorm } from "@/lib/kairos/ten-goi";

const TOI_DA = 8;

export async function GET(req: Request) {
  const who = await readerOf(req);
  if (!who.ok) return who.res;
  const q = handleNorm(new URL(req.url).searchParams.get("q") ?? "");
  if (!q || q.length > 30) return NextResponse.json({ ok: true, users: [] });
  const s = await storeOr503();
  if (!s.ok) return s.res;
  const { store } = s;
  try {
    const bo = who.phone ? [who.phone, ...(await store.edgesFrom("block", who.phone))] : [];
    const rows = await store.searchProfiles(q, TOI_DA, bo);
    const ctx = { viewer: who.phone, profiles: new Map(rows.map((r) => [r.phone, r])), mediaUrl: (p: string) => store.mediaUrl(p) };
    const users = rows.map((r) => {
      const a = authorDto(r.phone, ctx);
      return { id: a.profileId, ten: a.handle, avatarUrl: a.avatarUrl, isAgent: !!a.isAgent, official: a.official };
    });
    return NextResponse.json({ ok: true, users });
  } catch (e) {
    return kairosErrorResponse(e);
  }
}

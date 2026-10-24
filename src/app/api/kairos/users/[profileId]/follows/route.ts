// GET /api/kairos/users/[profileId]/follows?dir=followers|following — DANH SÁCH THEO DÕI của
// một người (14 §3.8, AC13 — sheet mở từ "N người theo dõi · M đang theo dõi").
// Khách đọc được (như trang người dùng). Trả tác giả công khai (profileId, tên, dòng phụ, ảnh —
// KHÔNG SĐT, AC21), mới nhất trước, tối đa 100 người; bỏ người mình đã chặn. `more` = còn nữa.
import { NextResponse } from "next/server";
import { authorsOf, kErr, kairosErrorResponse, readerOf, storeOr503 } from "@/lib/kairos/server";
import { isUuid } from "@/lib/kairos/validate";

type Ctx = { params: Promise<{ profileId: string }> };

// nợ: một trang 100 người, không cuộn tiếp — đủ cho làng chài; thêm cursor theo created_at khi có người >100 theo dõi
const FOLLOW_LIST_MAX = 100;

export async function GET(req: Request, ctx: Ctx) {
  const { profileId } = await ctx.params;
  if (!isUuid(profileId)) return kErr(404, "not_found");
  const dir = new URL(req.url).searchParams.get("dir");
  if (dir !== "followers" && dir !== "following") return kErr(400, "bad_body");
  const who = await readerOf(req);
  if (!who.ok) return who.res;
  const s = await storeOr503();
  if (!s.ok) return s.res;
  const { store } = s;
  try {
    const prof = await store.profileById(profileId.toLowerCase());
    if (!prof) return kErr(404, "not_found");
    const [phones, blocked] = await Promise.all([
      store.followList(dir, prof.phone, FOLLOW_LIST_MAX + 1),
      who.phone ? store.edgesFrom("block", who.phone) : Promise.resolve([] as string[]),
    ]);
    const shown = phones.slice(0, FOLLOW_LIST_MAX).filter((p) => !blocked.includes(p));
    return NextResponse.json({ ok: true, people: await authorsOf(store, shown), more: phones.length > FOLLOW_LIST_MAX });
  } catch (e) {
    return kairosErrorResponse(e);
  }
}

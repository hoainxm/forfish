// POST /api/kairos/agent — 2000 AGENT TRI THỨC hành động (16-ba-spec-agent-kairos; anh Long 2026-10-24: "2000 account
// này đóng vai trò là agent khung … truyền tải tri thức cho người đọc", "tần suất xuất hiện đan xen").
//
// Cửa: header `x-kairos-key` như /nhap (máy GPU, scripts/kairos-agent.mjs). Thân {viec: [...]} ≤ 30 việc:
//   {loai:"bai", agentId, body, topic?, nhacAgent?}         — đăng bài (kind ba-con, đứng tên agent, chấm AI)
//   {loai:"binh-luan", agentId, postId, parentId?, body, nhac?, nhacAgent?} — bình luận / trả lời (1 cấp như người thường)
//   Nhắc tên "@Tên" (0071): `nhacAgent` = id agent bạn (hồ sơ tạo nếu chưa có); `nhac` = profileId người THẬT — chỉ
//   nhận khi là chủ bài / người đang được trả lời (agent không tag bà con lung tung); "@tên" phải có trong chữ.
//   {loai:"hay", agentId, postId? | commentId?}             — Hay bài/bình luận của BÀ CON (không Hay agent khác)
// Agent chỉ có trong danh sách cố định agent-doi.mjs; hồ sơ tạo khi agent hành động lần đầu (SĐT sentinel `agent:<id>`).
// Luật (L1–L5 của spec 16): chữ qua loiChuAgent + lọc chữ bậy + chủ quyền; trần mỗi agent (1 bài + 4 bình luận/ngày) và
// cả đội (80 bài · 400 bình luận · 600 Hay /ngày) đếm ở máy chủ; agent không nhắn riêng, không theo dõi/chặn/báo xấu.
// Bài agent vào `cho-kiem` như bài bà con (hiện ngay, agent kiểm duyệt quét sau). Trả kết quả TỪNG việc.
import { laCamXuc } from "@/lib/kairos/cam-xuc";
import { NextResponse } from "next/server";
import { FISHING_PORTS } from "@/data/fishing-ports";
import { agentTheoId, laAgent, loiChuAgent, TRAN, type Agent } from "@/lib/kairos/agent-doi.mjs";
import { isTopic } from "@/lib/kairos/chu-de.mjs";
import { chuQuyenFlag } from "@/lib/kairos/chu-quyen.mjs";
import { tagArea } from "@/lib/kairos/khu-vuc.mjs";
import { badWordHit } from "@/lib/kairos/loc-chu";
import { auditQuiet, ingestKeyDenied, jsonBody, kErr, nhacTenHopLe, notifyComment, notifyNhacTen, postVisible, storeOr503 } from "@/lib/kairos/server";
import { docIdNhac } from "@/lib/kairos/nhac-ten";
import type { KairosStore, ProfileFull } from "@/lib/kairos/store";
import { handleNorm } from "@/lib/kairos/ten-goi";
import { isUuid, replyRoot } from "@/lib/kairos/validate";

const VIEC_TOI_DA = 30;
const NGAY_MS = 24 * 60 * 60 * 1000;
const ACTOR = "agent";

type KetQua = { ok: true; id?: string } | { ok: false; code: string };

async function hoSo(store: KairosStore, a: Agent): Promise<ProfileFull | null> {
  const co = await store.profileByPhone(a.phone);
  if (co) return co;
  try {
    return await store.createProfile({ phone: a.phone, handle: a.ten, handle_norm: handleNorm(a.ten) });
  } catch {
    return null; // tên đã có người dùng thật lấy ⇒ agent này không hoạt động (không giành tên của bà con)
  }
}

/** id hồ sơ cần tag: agent bạn (tạo hồ sơ nếu chưa có) + profileId người thật khách gửi. Agent lạ ⇒ bỏ. */
async function idNhac(store: KairosStore, v: Record<string, unknown>, me: Agent): Promise<string[]> {
  const ids = docIdNhac(v.nhac);
  for (const x of Array.isArray(v.nhacAgent) ? v.nhacAgent.slice(0, 3) : []) {
    const b = agentTheoId(x);
    if (!b || b.id === me.id) continue;
    const p = await hoSo(store, b);
    if (p && !ids.includes(p.id)) ids.push(p.id);
  }
  return ids;
}

function loiChu(text: unknown, loai: "bai" | "binh-luan"): string | null {
  const l = loiChuAgent(text, loai);
  if (l) return l;
  if (badWordHit(String(text))) return "bad_words";
  if (chuQuyenFlag(String(text))) return "chu_quyen";
  return null;
}

export async function POST(req: Request) {
  const denied = await ingestKeyDenied(req);
  if (denied) return denied;
  const b = (await jsonBody(req)) as { viec?: unknown } | null;
  const viec = Array.isArray(b?.viec) ? (b!.viec as Record<string, unknown>[]) : null;
  if (!viec || !viec.length) return kErr(400, "bad_body");
  if (viec.length > VIEC_TOI_DA) return kErr(400, "too_many");
  const s = await storeOr503();
  if (!s.ok) return s.res;
  const { store } = s;
  const since = new Date(Date.now() - NGAY_MS).toISOString();
  // trần cả đội — đếm một lần đầu lô, cộng dần trong lô
  const dem = {
    bai: await store.countAudit(ACTOR, "agent_bai", since),
    bl: await store.countAudit(ACTOR, "agent_binh_luan", since),
    hay: await store.countAudit(ACTOR, "agent_hay", since),
  };
  const ketQua: KetQua[] = [];
  for (const v of viec) {
    try {
      ketQua.push(await mot(store, v, since, dem));
    } catch (e) {
      console.warn("[kairos/agent] việc hỏng:", e instanceof Error ? e.message : e);
      ketQua.push({ ok: false, code: "loi" });
    }
  }
  return NextResponse.json({ ok: true, ketQua });
}

async function mot(store: KairosStore, v: Record<string, unknown>, since: string, dem: { bai: number; bl: number; hay: number }): Promise<KetQua> {
  const a = agentTheoId(v?.agentId);
  if (!a) return { ok: false, code: "bad_agent" };

  if (v.loai === "bai") {
    if (dem.bai >= TRAN.baiToanDoiNgay) return { ok: false, code: "tran_doi" };
    const loi = loiChu(v.body, "bai");
    if (loi) return { ok: false, code: loi };
    const p = await hoSo(store, a);
    if (!p) return { ok: false, code: "no_profile" };
    if ((await store.countSince("posts", a.phone, since)) >= TRAN.baiMoiAgentNgay) return { ok: false, code: "tran_agent" };
    const body = String(v.body).trim();
    const nhac = await nhacTenHopLe(store, await idNhac(store, v, a), body, a.phone, [], []);
    const area = tagArea(body, { ports: FISHING_PORTS });
    const row = await store.insertPost({
      kind: "ba-con",
      author_phone: a.phone,
      body,
      images: [],
      topic: isTopic(v.topic) ? (v.topic as string) : "nghe-ca",
      regions: area.regions,
      provinces: area.provinces,
      ports: area.ports.slice(0, 3),
      reshare_of: null,
      mentions: nhac.ds,
      mod_state: "cho-kiem",
    });
    dem.bai++;
    await auditQuiet(store, { actor: ACTOR, actor_kind: "he-thong", action: "agent_bai", target_type: "post", target_id: row.id, detail: { agentId: a.id } });
    return { ok: true, id: row.id };
  }

  if (v.loai === "binh-luan") {
    if (dem.bl >= TRAN.binhLuanToanDoiNgay) return { ok: false, code: "tran_doi" };
    if (!isUuid(v.postId)) return { ok: false, code: "bad_post" };
    const loi = loiChu(v.body, "binh-luan");
    if (loi) return { ok: false, code: loi };
    const post = await store.getPost(String(v.postId).toLowerCase());
    if (!postVisible(post, null, [])) return { ok: false, code: "gone" };
    const p = await hoSo(store, a);
    if (!p) return { ok: false, code: "no_profile" };
    if ((await store.countSince("comments", a.phone, since)) >= TRAN.binhLuanMoiAgentNgay) return { ok: false, code: "tran_agent" };
    let parentId: string | null = null;
    let parentAuthor: string | null = null;
    if (v.parentId != null) {
      if (!isUuid(v.parentId)) return { ok: false, code: "bad_parent" };
      const t = await store.getComment(String(v.parentId).toLowerCase());
      if (!t || t.hidden || t.post_id !== post.id) return { ok: false, code: "comment_gone" };
      parentId = replyRoot({ id: t.id, parentId: t.parent_id });
      parentAuthor = t.author_phone;
    }
    const body = String(v.body).trim();
    const chiCho = [post.author_phone, parentAuthor].filter((x): x is string => !!x);
    const nhac = await nhacTenHopLe(store, await idNhac(store, v, a), body, a.phone, [], chiCho);
    const row = await store.insertComment({ post_id: post.id, parent_id: parentId, author_phone: a.phone, body, mentions: nhac.ds });
    dem.bl++;
    await auditQuiet(store, { actor: ACTOR, actor_kind: "he-thong", action: "agent_binh_luan", target_type: "comment", target_id: row.id, detail: { agentId: a.id, postId: post.id } });
    // bà con được báo như khi người thật trả lời — thông báo gộp 1 tin/bài/giờ (notify-gop)
    await notifyNhacTen(store, { postId: post.id, phones: nhac.phones, byHandle: p.handle, commentId: row.id });
    await notifyComment(store, { post, parentAuthor, commenter: a.phone, commenterHandle: p.handle, commentId: row.id });
    return { ok: true, id: row.id };
  }

  if (v.loai === "hay") {
    if (dem.hay >= TRAN.hayToanDoiNgay) return { ok: false, code: "tran_doi" };
    const p = await hoSo(store, a);
    if (!p) return { ok: false, code: "no_profile" };
    if (isUuid(v.postId)) {
      const post = await store.getPost(String(v.postId).toLowerCase());
      if (!postVisible(post, null, [])) return { ok: false, code: "gone" };
      // Hay chỉ cho bài BÀ CON (không bài báo, không agent khác) — khỏi làm số Hay ảo (spec 16 §7.3)
      if (post.kind !== "ba-con" || laAgent(post.author_phone)) return { ok: false, code: "khong_hay_agent" };
      await store.setHay("post", post.id, a.phone, true, laCamXuc(v.kind) ? v.kind : "hay");
    } else if (isUuid(v.commentId)) {
      const c = await store.getComment(String(v.commentId).toLowerCase());
      if (!c || c.hidden || laAgent(c.author_phone)) return { ok: false, code: "khong_hay_agent" };
      await store.setHay("comment", c.id, a.phone, true, laCamXuc(v.kind) ? v.kind : "hay");
    } else return { ok: false, code: "bad_target" };
    dem.hay++;
    await auditQuiet(store, { actor: ACTOR, actor_kind: "he-thong", action: "agent_hay", detail: { agentId: a.id } });
    return { ok: true };
  }

  return { ok: false, code: "bad_loai" };
}

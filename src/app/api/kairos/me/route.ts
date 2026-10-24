// /api/kairos/me — "TÊN TRÊN KAIROS" của chính mình (14 §3.7, §7, AC08/AC12).
//
// GET   SĐT: hồ sơ (tự tạo lần đầu với tên mặc định) + đã đồng ý nội quy chưa + hạn đổi tên +
//       trạng thái cấm. Trả `profileId` — KHÔNG trả SĐT (máy đã biết SĐT của mình).
// PATCH SĐT: tên gọi (2–20, không trùng không phân biệt hoa/dấu, cấm giả danh, chữ bậy; đổi
//       1 lần/30 ngày ⇒ 429 `handle_cooldown` kèm `nextAt`; trùng ⇒ 409 `handle_taken`) · ảnh
//       đại diện + ảnh bìa (đường kho của mình | null) · `showBoat` · `acceptRules: true` ·
//       Giới thiệu (0067): `queTinh` · `nghe` · `homePort` · `gioiThieu` ≤150 (null = xoá).
//       Cột 0067 chưa có ⇒ ghi trường mới trả 503 `fields_missing`, đọc vẫn chạy (trường trống).
//       Lần đổi ĐẦU TIÊN rời tên mặc định ("Bà con 5689") không tính hạn 30 ngày (lần đặt đầu).
//       SDVICO (hồ sơ Chính thức) không đổi tên.
import { NextResponse } from "next/server";
import { identityFromRequest } from "@/lib/api-identity";
import { normalizeVnPhone } from "@/lib/phone";
import { validateMePatch } from "@/lib/kairos/me-patch";
import { isBanned } from "@/lib/kairos/rate";
import { isDefaultHandle, shouldAskName } from "@/lib/kairos/ho-so";
import { canChangeHandle } from "@/lib/kairos/ten-goi";
import {
  auditQuiet, clientIp, ensureProfile, jsonBody, kErr, kairosErrorResponse, PORT_IDS, profileCard, requireWriter, storeOr503,
} from "@/lib/kairos/server";
import type { KairosStore, ProfileFull, ProfilePatch } from "@/lib/kairos/store";

async function meJson(store: KairosStore, p: ProfileFull) {
  const now = Date.now();
  const change = canChangeHandle(p.handle_changed_at, now);
  const card = await profileCard(store, p);
  return {
    ok: true,
    me: {
      ...card.author,
      about: card.about,
      askName: shouldAskName(p),
      showBoat: p.show_boat,
      rulesAccepted: !!p.rules_accepted_at,
      handleNextChangeAt: change.ok ? null : change.nextAt,
      bannedUntil: isBanned(p.banned_until, now) ? p.banned_until : null,
      banReason: isBanned(p.banned_until, now) ? p.ban_reason : null,
      postCount: await store.countAuthorPosts(p.phone),
    },
  };
}

export async function GET(req: Request) {
  const who = await identityFromRequest(req);
  if (!who.ok) return who.res;
  const s = await storeOr503();
  if (!s.ok) return s.res;
  try {
    const p = await ensureProfile(s.store, normalizeVnPhone(who.phone));
    return NextResponse.json(await meJson(s.store, p));
  } catch (e) {
    return kairosErrorResponse(e);
  }
}

export async function PATCH(req: Request) {
  const w = await requireWriter(req);
  if (!w.ok) return w.res;
  const { store, phone, profile } = w;
  const v = validateMePatch(await jsonBody(req), profile.id, PORT_IDS);
  if (!v.ok) return kErr(400, v.code);
  const patch: ProfilePatch = {};
  const now = Date.now();
  try {
    if (v.value.handle && v.value.handle.handle !== profile.handle) {
      if (profile.official) return kErr(403, "official_fixed");
      const can = canChangeHandle(profile.handle_changed_at, now);
      if (!can.ok) return kErr(429, "handle_cooldown", { nextAt: can.nextAt });
      if (v.value.handle.norm !== profile.handle_norm && (await store.takenNorms([v.value.handle.norm])).size) return kErr(409, "handle_taken");
      patch.handle = v.value.handle.handle;
      patch.handle_norm = v.value.handle.norm;
      // rời tên máy đặt lần đầu = "lần đặt đầu" (AC12) ⇒ chưa tính hạn 30 ngày
      if (profile.handle_changed_at || !isDefaultHandle(profile.handle)) patch.handle_changed_at = new Date(now).toISOString();
    }
    if (v.value.avatarPath !== undefined) patch.avatar_path = v.value.avatarPath;
    if (v.value.coverPath !== undefined) patch.cover_path = v.value.coverPath;
    if (v.value.queTinh !== undefined) patch.que_tinh = v.value.queTinh;
    if (v.value.nghe !== undefined) patch.nghe = v.value.nghe;
    if (v.value.homePort !== undefined) patch.home_port = v.value.homePort;
    if (v.value.gioiThieu !== undefined) patch.gioi_thieu = v.value.gioiThieu;
    if (v.value.showBoat !== undefined) patch.show_boat = v.value.showBoat;
    if (v.value.acceptRules && !profile.rules_accepted_at) patch.rules_accepted_at = new Date(now).toISOString();
    if (!Object.keys(patch).length) return NextResponse.json(await meJson(store, profile));

    const updated = await store.updateProfile(phone, patch);
    // hồ sơ đã lưu — ảnh cũ (đại diện / bìa) mồ côi chỉ tốn chỗ kho ⇒ xoá, hỏng thì log
    const stale = [
      patch.avatar_path !== undefined && profile.avatar_path !== patch.avatar_path ? profile.avatar_path : null,
      patch.cover_path !== undefined && profile.cover_path !== patch.cover_path ? profile.cover_path : null,
    ].filter((x): x is string => !!x);
    if (stale.length) {
      await store.removeImages(stale).catch((e) => console.error("[kairos] xoá ảnh hồ sơ cũ hỏng:", (e as Error)?.message));
    }
    await auditQuiet(store, {
      actor: phone, actor_kind: "ba-con", action: patch.handle ? "handle_change" : "profile_edit", target_type: "profile", target_id: profile.id,
      detail: { fields: Object.keys(patch), ...(patch.handle ? { from: profile.handle, to: patch.handle } : {}) }, ip: clientIp(req),
    });
    return NextResponse.json(await meJson(store, updated));
  } catch (e) {
    return kairosErrorResponse(e);
  }
}

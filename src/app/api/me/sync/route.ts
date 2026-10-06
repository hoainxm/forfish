// /api/me/sync — ĐỒNG BỘ SỔ per-máy lên server theo SĐT (P1).
//
// Cùng luật market_listings/devices: app bỏ phiên Supabase (0037) → auth.uid()
// NULL → mọi truy cập đi SERVICE-ROLE + identityFromRequest lọc owner_phone.
// Bảng user_docs (0050) RLS đóng hẳn: client ẩn danh không đọc được của ai.
//
// GET  = kéo MỌI kind của SĐT đang đăng nhập.
// PUT  = ghi 1 kind (body {kind, data, clientUpdatedAt, baseIds?}).
//        · CÓ `baseIds` (máy đời 2026-10-06+): GỘP 3 CHIỀU THEO `id`
//          (`mergeById`, lib/user-sync-core) — máy thêm/xoá gì, máy khác
//          thêm/xoá gì đều giữ; mục có ở cả hai thì bên GHI SAU thắng. Trả
//          `server` = cuốn đã gộp + mốc mới để máy nhận về.
//        · KHÔNG có `baseIds` (bản app cũ còn ngoài biển): giữ LAST-WRITE-WINS
//          nguyên cuốn như trước — server mới hơn thì trả stale.
//
// ⚠️ KHÔNG cache ở service worker (gắn danh tính, dữ liệu riêng tư).
import { NextResponse } from "next/server";
import { identityFromRequest } from "@/lib/api-identity";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeVnPhone } from "@/lib/phone";
import {
  invalidPut,
  isValidBaseIds,
  mergeById,
  type SyncKind,
} from "@/lib/user-sync-core";

import { keepDeleted, stripDeleted } from "@/lib/sync-tombstone";

const TABLE = "user_docs";

const err = (status: number, code: string) =>
  NextResponse.json({ ok: false, code }, { status });

export async function GET(req: Request) {
  const who = await identityFromRequest(req);
  if (!who.ok) return who.res;
  const phone = normalizeVnPhone(who.phone);

  const admin = createAdminClient();
  if (!admin) return err(503, "unavailable");

  const { data, error } = await admin
    .from(TABLE)
    .select("kind,data,client_updated_at")
    .eq("owner_phone", phone);
  if (error) return err(500, "query_failed");

  const items = (data as { kind: SyncKind; data: unknown; client_updated_at: number }[]).map(
    /*  LỌC BỎ BẢN ĐÃ XOÁ trước khi trả cho máy — server giữ để phân tích,
        nhưng bà con đã bỏ thì không được thấy lại (chủ dự án 2026-09-01). */
    (r) => ({
      kind: r.kind,
      data: stripDeleted(r.data),
      clientUpdatedAt: r.client_updated_at,
    }),
  );
  // `phone` = chủ của các cuốn này (chính người đang gọi). Máy so với chủ của
  // sổ đang nằm trong máy: khác người ⇒ sổ trong máy là của tài khoản TRƯỚC
  // (máy bị đá rồi người khác đăng nhập) ⇒ dọn trước khi kéo/đẩy. Không lộ gì
  // thêm: người gọi vốn biết SĐT của chính mình.
  return NextResponse.json({ ok: true, phone, items });
}

export async function PUT(req: Request) {
  const who = await identityFromRequest(req);
  if (!who.ok) return who.res;
  const phone = normalizeVnPhone(who.phone);

  const body = (await req.json().catch(() => null)) as {
    kind?: SyncKind;
    data?: unknown;
    clientUpdatedAt?: number;
    baseIds?: unknown;
  } | null;
  const bad = invalidPut(body);
  if (bad) return err(400, bad);
  const hasBase = !!body && "baseIds" in body;
  if (hasBase && !isValidBaseIds(body!.baseIds)) return err(400, "bad_base");
  const { kind, data, clientUpdatedAt } = body as {
    kind: SyncKind;
    data: unknown;
    clientUpdatedAt: number;
  };

  const admin = createAdminClient();
  if (!admin) return err(503, "unavailable");

  // LAST-WRITE-WINS: bản server mới hơn thì KHÔNG đè — trả về để client nhận.
  const { data: cur, error: readErr } = await admin
    .from(TABLE)
    .select("data,client_updated_at")
    .eq("owner_phone", phone)
    .eq("kind", kind)
    .maybeSingle();
  if (readErr) return err(500, "query_failed");

  /*  GỘP THEO MỤC (máy mới gửi `baseIds`). Cuốn không phải mảng mục có `id`
      ⇒ mergeById trả null ⇒ rơi xuống luật cũ bên dưới. */
  if (hasBase && cur) {
    const curAt = Number(cur.client_updated_at) || 0;
    const merged = mergeById(
      cur.data,
      data,
      (body!.baseIds as string[] | null) ?? null,
      clientUpdatedAt >= curAt,
    );
    if (merged) {
      const serverLive = stripDeleted(cur.data);
      // Gộp xong y hệt server ⇒ không ghi, chỉ trả về để máy nhận cho khớp.
      if (JSON.stringify(merged) === JSON.stringify(serverLive)) {
        return NextResponse.json({
          ok: true,
          server: { kind, data: serverLive, clientUpdatedAt: curAt },
        });
      }
      // Mốc mới PHẢI lớn hơn mốc server: máy khác so `server > mốc của mình`
      // để biết có bản mới mà kéo về.
      const newAt = Math.max(clientUpdatedAt, curAt + 1);
      const { error } = await admin.from(TABLE).upsert(
        {
          owner_phone: phone,
          kind,
          data: keepDeleted(cur.data, merged, new Date().toISOString()),
          client_updated_at: newAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "owner_phone,kind" },
      );
      if (error) return err(500, "write_failed");
      return NextResponse.json({
        ok: true,
        merged: true,
        server: { kind, data: merged, clientUpdatedAt: newAt },
      });
    }
  }

  if (cur && cur.client_updated_at > clientUpdatedAt) {
    return NextResponse.json({
      ok: true,
      stale: true,
      // cùng luật với GET: bản trả về cho máy KHÔNG mang theo thứ đã xoá
      server: {
        kind,
        data: stripDeleted(cur.data),
        clientUpdatedAt: cur.client_updated_at,
      },
    });
  }

  /*  GIỮ BẢN ĐÃ XOÁ Ở SERVER (chủ dự án 2026-09-01: *"đã xoá thì xoá ở máy còn
      trên server vẫn có"*). Bản ghi biến mất so với lần đẩy trước thì Ở LẠI
      trong chính cuốn sổ này, chỉ thêm cờ `_deleted` + `_deletedAt` — không
      bảng mới, không migration, vì `data` vốn là `jsonb`.
      Máy bà con không thấy lại: nhánh GET đã lọc bỏ trước khi trả về. */
  const dataGiuVet = keepDeleted(cur?.data, data, new Date().toISOString());

  const { error } = await admin.from(TABLE).upsert(
    {
      owner_phone: phone,
      kind,
      data: dataGiuVet,
      client_updated_at: clientUpdatedAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "owner_phone,kind" },
  );
  if (error) return err(500, "write_failed");

  return NextResponse.json({ ok: true });
}

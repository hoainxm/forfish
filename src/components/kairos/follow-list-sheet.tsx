"use client";

/*
  DANH SÁCH THEO DÕI (14 §3.8, AC13 bản 2026-10-24) — mở từ "N người theo dõi · M đang theo
  dõi" trên trang người dùng. GET /api/kairos/users/[id]/follows?dir=… (khách đọc được, KHÔNG
  SĐT). Chạm một người ⇒ trang của họ. Đủ trạng thái: đang tải · trống · lỗi + Thử lại · mất
  sóng (danh sách không lưu trong máy — chỉ báo "Cần sóng").
*/

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import type { KairosAuthor } from "@/lib/kairos/types";
import { kairosSend } from "@/lib/kairos/write-client";
import { NHAN } from "@/lib/labels";
import { KairosAvatar } from "./kairos-avatar";

type State = { s: "loading" } | { s: "ok"; people: KairosAuthor[]; more: boolean } | { s: "offline" } | { s: "error" };

export function FollowListSheet({
  profileId,
  dir,
  onClose,
}: {
  profileId: string;
  dir: "followers" | "following";
  onClose: () => void;
}) {
  const [st, setSt] = useState<State>({ s: "loading" });

  const load = useCallback(async () => {
    setSt({ s: "loading" });
    const r = await kairosSend<{ people: KairosAuthor[]; more: boolean }>(
      "GET",
      `/api/kairos/users/${encodeURIComponent(profileId)}/follows?dir=${dir}`,
    );
    if (r.ok) setSt({ s: "ok", people: r.data.people, more: r.data.more });
    else setSt(r.offline ? { s: "offline" } : { s: "error" });
  }, [profileId, dir]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <BottomSheet title={dir === "followers" ? "Người theo dõi" : "Đang theo dõi"} onClose={onClose}>
      {st.s === "loading" && (
        <ul aria-busy className="space-y-3 py-2">
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex items-center gap-3">
              <span className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-field" />
              <span className="h-4 w-40 animate-pulse rounded bg-field" />
            </li>
          ))}
        </ul>
      )}
      {st.s === "offline" && <p className="py-6 text-center text-foreground/65">Mất sóng. Có sóng sẽ xem được danh sách.</p>}
      {st.s === "error" && (
        <div className="py-6 text-center">
          <p className="mb-3">Chưa tải được danh sách.</p>
          <button type="button" onClick={() => void load()} className="h-11 rounded-xl border border-line px-4 font-semibold text-sea">
            {NHAN.thuLai}
          </button>
        </div>
      )}
      {st.s === "ok" &&
        (st.people.length === 0 ? (
          <p className="py-6 text-center text-foreground/65">{dir === "followers" ? "Chưa có ai theo dõi." : "Chưa theo dõi ai."}</p>
        ) : (
          <>
            <ul className="divide-y divide-line">
              {st.people.map((p) => (
                <li key={p.profileId}>
                  <Link href={`/kairos/u/${p.profileId}`} onClick={onClose} className="flex min-h-14 items-center gap-3 py-2">
                    <KairosAvatar id={p.profileId} name={p.handle} url={p.avatarUrl} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-navy">{p.handle}</span>
                      {p.subline && <span className="block truncate text-[0.8125rem] text-foreground/65">{p.subline}</span>}
                    </span>
                    {p.official && <span className="shrink-0 rounded-full bg-sea/12 px-2 py-0.5 text-[0.75rem] font-bold text-sea">{NHAN.chinhThuc}</span>}
                  </Link>
                </li>
              ))}
            </ul>
            {st.more && <p className="pt-3 text-center text-[0.8125rem] text-foreground/65">Hiện 100 người mới nhất.</p>}
          </>
        ))}
    </BottomSheet>
  );
}

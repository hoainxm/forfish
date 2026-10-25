"use client";

/*
  CHI TIẾT BÀI + BÌNH LUẬN `/kairos/p/[id]` (14 §3.4, §10; AC09 · AC10 · AC15 · AC19).

   · Bình luận: khối dùng chung `comment-thread.tsx` (cũng mở INLINE dưới thẻ ở dòng tin, như FB);
     ô viết dính đáy màn trên dock / trên bàn phím (khối tự lo, K3-01).
   · ĐỌC: bài ẩn / đã xoá / người mình chặn ⇒ "Bài này không còn".
   · MẤT SÓNG: lấy bài trong bản lưu dòng tin (`forfish.kairos.v1`, có 2 bình luận nổi) — ô
     bình luận "Cần sóng", chữ vào nháp `forfish.kairos.nhap.v1` (khoá `bl:<id>`); có sóng lại
     tự tải lại bài, KHÔNG tự gửi bình luận.
*/

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { EmptyState } from "@/components/ui/primitives";
import { OfflineLine } from "@/components/ui/offline-line";
import { countLabel, loadFeedCache } from "@/lib/kairos/feed-client";
import type { KairosComment, KairosPost } from "@/lib/kairos/types";
import { kairosSend } from "@/lib/kairos/write-client";
import { NHAN } from "@/lib/labels";
import { useAuthUser } from "@/lib/use-auth";
import { PostCard } from "./post-card";
import { PostSkeleton } from "./post-skeleton";
import { CommentThread } from "./comment-thread";
import { usePostActions } from "./use-post-actions";

type Load = "loading" | "ready" | "gone" | "error" | "offline";

export function PostDetail({ id }: { id: string }) {
  const router = useRouter();
  const { phone, ready: authReady } = useAuthUser();
  const a = usePostActions({ onDeleted: () => router.replace("/kairos") });
  const [post, setPost] = useState<KairosPost | null>(null);
  const [comments, setComments] = useState<KairosComment[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [load, setLoad] = useState<Load>("loading");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  /** đổi mỗi lần tải bài xong ⇒ khối bình luận nhận danh sách mới */
  const [loadedAt, setLoadedAt] = useState(0);
  const view = post ? a.view([post])[0] ?? null : null;

  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  const fetchPost = useCallback(async () => {
    setLoad((l) => (l === "ready" ? l : "loading"));
    const r = await kairosSend<{ post: KairosPost; comments: KairosComment[]; next: string | null }>("GET", `/api/kairos/posts/${encodeURIComponent(id)}`);
    setNow(Date.now());
    if (r.ok) {
      setPost(r.data.post);
      setComments(r.data.comments ?? []);
      setNext(r.data.next ?? null);
      setSavedAt(null);
      setLoad("ready");
      setLoadedAt(Date.now());
      return;
    }
    if (r.status === 404) {
      setLoad("gone");
      return;
    }
    if (r.offline) {
      const cache = loadFeedCache(phone);
      const hit = cache?.posts.find((p) => p.id === id) ?? null;
      setPost((cur) => cur ?? hit);
      setComments((cur) => (cur.length ? cur : hit?.topComments ?? []));
      setSavedAt(hit && cache ? cache.savedAt : null);
      setLoad("offline");
      return;
    }
    setLoad("error");
  }, [id, phone]);

  useEffect(() => {
    if (authReady) void fetchPost();
  }, [authReady, fetchPost]);

  // Có sóng lại khi đang mất sóng/lỗi ⇒ tự tải lại bài (không tự gửi bình luận).
  useEffect(() => {
    const on = () => {
      if (loadRef.current === "offline" || loadRef.current === "error") void fetchPost();
    };
    window.addEventListener("online", on);
    return () => window.removeEventListener("online", on);
  }, [fetchPost]);


  return (
    <div className="space-y-3 px-4 pb-6">
      {load === "offline" && post && (
        <OfflineLine savedAt={savedAt} />
      )}

      {!post && load === "loading" && <PostSkeleton count={1} />}
      {load === "gone" && <EmptyState>Bài này không còn.</EmptyState>}
      {!post && load === "offline" && <EmptyState>Mất sóng. Bài này chưa lưu trong máy — có sóng sẽ tải.</EmptyState>}
      {load === "error" && (
        <div className="surface p-4 text-center">
          <p className="mb-3">Chưa tải được bài.</p>
          <button type="button" onClick={() => void fetchPost()} className="h-11 rounded-xl border border-line px-4 font-semibold text-sea">
            {NHAN.thuLai}
          </button>
        </div>
      )}

      {view && load !== "gone" && (
        <>
          <PostCard post={view} now={now} actions={a.actions} inDetail />

          <section aria-label={NHAN.binhLuan} className="surface p-4">
            <h2 className="mb-3 font-bold text-navy">
              {NHAN.binhLuan} {view.commentCount > 0 && <span className="tabular-nums text-foreground/65">{countLabel(view.commentCount)}</span>}
            </h2>

            <CommentThread
              key={loadedAt}
              post={view}
              initial={comments}
              initialNext={next}
              kit={{ notify: a.notify, report: a.report, patch: a.patch }}
              canWrite={load === "ready"}
              now={now}
            />
          </section>
        </>
      )}
      {a.ui}
    </div>
  );
}

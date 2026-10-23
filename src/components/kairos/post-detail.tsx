"use client";

/*
  CHI TIẾT BÀI + BÌNH LUẬN `/kairos/p/[id]` (14 §3.4, §10; AC09 · AC10 · AC15 · AC19).

   · Bình luận dưới MỌI bài, kể cả bài báo. Trả lời 1 cấp: trả lời một trả lời ⇒ gắn vào bình
     luận gốc kèm "@tên" (write-client.replyTarget; máy chủ cũng quy về gốc). Trang 30, "Xem thêm".
   · Hay bình luận lạc quan + hoàn tác; xoá bình luận của mình (xác nhận ngay tại chỗ); báo
     xấu bình luận người khác.
   · ĐỌC: bài ẩn / đã xoá / người mình chặn ⇒ "Bài này không còn".
   · MẤT SÓNG: lấy bài trong bản lưu dòng tin (`forfish.kairos.v1`, có 2 bình luận nổi) — ô
     bình luận "Cần sóng", chữ vào nháp `forfish.kairos.nhap.v1` (khoá `bl:<id>`); có sóng lại
     tự tải lại bài, KHÔNG tự gửi bình luận.
*/

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ThumbIcon } from "@/components/icons";
import { EmptyState, inputClass } from "@/components/ui/primitives";
import { StatusBanner } from "@/components/ui/status-banner";
import { draftKey } from "@/lib/kairos/cache";
import { countLabel, loadFeedCache, postTimeLabel, savedAtLabel } from "@/lib/kairos/feed-client";
import { LIMITS, type KairosComment, type KairosPost } from "@/lib/kairos/types";
import { charLen } from "@/lib/kairos/validate";
import {
  dropComment,
  errorText,
  flipHay,
  kairosSend,
  loadDraft,
  replyTarget,
  saveDraft,
  settleHay,
  threadComments,
} from "@/lib/kairos/write-client";
import { NHAN } from "@/lib/labels";
import { useAuthUser } from "@/lib/use-auth";
import { useOnline } from "@/lib/use-online";
import { KairosAvatar } from "./kairos-avatar";
import { PostCard } from "./post-card";
import { PostSkeleton } from "./post-skeleton";
import { RulesBox } from "./rules-box";
import { usePostActions } from "./use-post-actions";

type Load = "loading" | "ready" | "gone" | "error" | "offline";

function CommentRow({
  c,
  now,
  reply,
  onHay,
  onReply,
  onDelete,
  onReport,
}: {
  c: KairosComment;
  now: number;
  reply?: boolean;
  onHay: (c: KairosComment) => void;
  onReply: (c: KairosComment) => void;
  onDelete: (c: KairosComment) => Promise<boolean>;
  onReport: (c: KairosComment) => void;
}) {
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const small = "h-9 px-2 text-[0.8125rem] font-semibold";
  return (
    <li className={`flex gap-2 ${reply ? "pl-10" : ""}`}>
      <Link href={`/kairos/u/${c.author.profileId}`} aria-label={c.author.handle} className="shrink-0">
        <KairosAvatar id={c.author.profileId || c.id} name={c.author.handle} url={c.author.avatarUrl} small />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="rounded-2xl bg-field px-3 py-1.5">
          <Link href={`/kairos/u/${c.author.profileId}`} className="block truncate text-[0.8125rem] font-bold text-navy">
            {c.author.handle}
            {c.author.official && <span className="ml-1.5 text-sea">{NHAN.chinhThuc}</span>}
          </Link>
          <p className="whitespace-pre-line break-words text-[1rem]">{c.body}</p>
        </div>
        {ask ? (
          <div className="flex items-center gap-2 py-1" role="group" aria-label="Xác nhận xoá bình luận">
            <span className="text-[0.8125rem] text-danger">Xoá bình luận{reply ? "" : " và các trả lời"}?</span>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const ok = await onDelete(c);
                setBusy(false);
                if (!ok) setAsk(false);
              }}
              className={`${small} rounded-lg bg-danger text-white disabled:opacity-40`}
            >
              {busy ? NHAN.dangGui : NHAN.xoa}
            </button>
            <button type="button" onClick={() => setAsk(false)} className={`${small} rounded-lg bg-card text-foreground/75`}>
              {NHAN.huy}
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-1 text-foreground/65">
            <span className="px-2 text-[0.8125rem]">{postTimeLabel(c.createdAt, now)}</span>
            <button
              type="button"
              aria-pressed={c.hayByMe}
              aria-label={`${NHAN.hay}, ${c.hayCount}`}
              onClick={() => onHay(c)}
              className={`${small} flex items-center gap-1 ${c.hayByMe ? "text-sea" : ""}`}
            >
              <ThumbIcon className="h-4 w-4" />
              {NHAN.hay}
              {c.hayCount > 0 && <span className="tabular-nums">{countLabel(c.hayCount)}</span>}
            </button>
            <button type="button" onClick={() => onReply(c)} className={small}>
              {NHAN.traLoi}
            </button>
            {c.mine ? (
              <button type="button" onClick={() => setAsk(true)} className={`${small} text-danger`}>
                {NHAN.xoa}
              </button>
            ) : (
              <button type="button" onClick={() => onReport(c)} className={small}>
                {NHAN.baoXau}
              </button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

export function PostDetail({ id }: { id: string }) {
  const router = useRouter();
  const { phone, signedIn, ready: authReady } = useAuthUser();
  const online = useOnline();
  const a = usePostActions({ onDeleted: () => router.replace("/kairos") });
  const [post, setPost] = useState<KairosPost | null>(null);
  const [comments, setComments] = useState<KairosComment[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [load, setLoad] = useState<Load>("loading");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [more, setMore] = useState<"idle" | "loading" | "error">("idle");
  const [now, setNow] = useState(() => Date.now());
  const view = post ? a.view([post])[0] ?? null : null;

  const dKey = draftKey("bl", id);
  const [text, setText] = useState("");
  const [draftFail, setDraftFail] = useState(false);
  const [replyTo, setReplyTo] = useState<{ parentId: string; handle: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [sendErr, setSendErr] = useState("");
  const [needRules, setNeedRules] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);
  const hayBusy = useRef(new Set<string>());
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  useEffect(() => setText(loadDraft(phone, dKey)), [phone, dKey]);

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

  const loadMore = async () => {
    if (!next) return;
    setMore("loading");
    const r = await kairosSend<{ comments: KairosComment[]; next: string | null }>(
      "GET",
      `/api/kairos/posts/${encodeURIComponent(id)}/comments?cursor=${encodeURIComponent(next)}`,
    );
    if (!r.ok) {
      setMore("error");
      return;
    }
    setComments((cur) => [...cur, ...r.data.comments]);
    setNext(r.data.next ?? null);
    setMore("idle");
  };

  const onText = (v: string) => {
    setText(v);
    setSendErr("");
    setDraftFail(!saveDraft(phone, dKey, v));
  };

  const startReply = (c: KairosComment) => {
    const t = replyTarget(c);
    setReplyTo({ parentId: t.parentId, handle: c.author.handle });
    if (t.prefix && !text.startsWith(t.prefix)) onText(`${t.prefix}${text}`);
    box.current?.focus();
  };

  const len = charLen(text.trim());
  const left = LIMITS.commentBody - len;
  const canSend = online && signedIn && !sending && len > 0 && left >= 0 && !needRules && load === "ready";

  const send = async () => {
    if (!canSend) return;
    setSending(true);
    setSendErr("");
    const r = await kairosSend<{ comment: KairosComment }>("POST", `/api/kairos/posts/${encodeURIComponent(id)}/comments`, {
      body: text,
      parentId: replyTo?.parentId ?? null,
    });
    setSending(false);
    if (!r.ok) {
      if (r.code === "rules") setNeedRules(true);
      setSendErr(errorText(r, "binh-luan"));
      return;
    }
    setComments((cur) => [...cur, r.data.comment]);
    if (post) a.patch(post.id, { commentCount: (view?.commentCount ?? post.commentCount) + 1 });
    setText("");
    saveDraft(phone, dKey, "");
    setReplyTo(null);
  };

  const hayComment = async (c: KairosComment) => {
    if (!signedIn) {
      a.notify("Đăng nhập để bấm Hay.", true);
      return;
    }
    if (hayBusy.current.has(c.id)) return;
    hayBusy.current.add(c.id);
    const before = { hayByMe: c.hayByMe, hayCount: c.hayCount };
    const set = (s: typeof before) => setComments((cur) => cur.map((x) => (x.id === c.id ? { ...x, ...s } : x)));
    set(flipHay(before));
    const r = await kairosSend<{ on: boolean; hayCount: number }>("PUT", `/api/kairos/comments/${c.id}/hay`, { on: !c.hayByMe });
    hayBusy.current.delete(c.id);
    set(settleHay(before, r));
    if (!r.ok) a.notify(errorText(r, "hay"), true);
  };

  const deleteComment = async (c: KairosComment) => {
    const r = await kairosSend("DELETE", `/api/kairos/comments/${c.id}`);
    if (!r.ok) {
      a.notify(errorText(r, "xoa"), true);
      return false;
    }
    const gone = comments.length - dropComment(comments, c.id).length;
    setComments((cur) => dropComment(cur, c.id));
    if (post) a.patch(post.id, { commentCount: Math.max(0, (view?.commentCount ?? post.commentCount) - gone) });
    a.notify("Đã xoá bình luận.");
    return true;
  };

  const threads = threadComments(comments);

  return (
    <div className="space-y-3 px-4 pb-6">
      {load === "offline" && post && (
        <StatusBanner level="warn">{savedAt ? `Mất sóng — bài lưu lúc ${savedAtLabel(savedAt)}` : "Mất sóng — đang xem bài đã tải"}</StatusBanner>
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

            {threads.length === 0 ? (
              <p className="mb-3 text-foreground/65">{load === "offline" ? "Bình luận chưa lưu trong máy." : "Chưa có bình luận. Bà con nói trước nhé."}</p>
            ) : (
              <ul className="mb-3 space-y-3">
                {threads.map((t) => (
                  <li key={t.root.id}>
                    <ul className="space-y-2">
                      <CommentRow c={t.root} now={now} onHay={hayComment} onReply={startReply} onDelete={deleteComment} onReport={(c) => a.report({ type: "comment", id: c.id })} />
                      {t.replies.map((r) => (
                        <CommentRow key={r.id} c={r} now={now} reply onHay={hayComment} onReply={startReply} onDelete={deleteComment} onReport={(c) => a.report({ type: "comment", id: c.id })} />
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
            {next && (
              <button
                type="button"
                onClick={() => void loadMore()}
                disabled={more === "loading"}
                className="mb-3 h-10 rounded-xl border border-line px-3 text-[0.875rem] font-semibold text-sea disabled:opacity-40"
              >
                {more === "loading" ? NHAN.dangTai : more === "error" ? NHAN.thuLai : NHAN.xemThem}
              </button>
            )}

            {authReady && !signedIn ? (
              <p className="text-[1rem]">
                <Link href="/login" className="font-semibold text-sea">
                  {NHAN.dangNhap}
                </Link>{" "}
                để bình luận.
              </p>
            ) : (
              <div>
                {needRules && (
                  <div className="mb-3">
                    <RulesBox onAccepted={() => setNeedRules(false)} />
                  </div>
                )}
                {replyTo && (
                  <div className="mb-1.5 flex items-center gap-2 text-[0.8125rem]">
                    <span className="text-foreground/65">
                      Trả lời <span className="font-semibold text-navy">{replyTo.handle}</span>
                    </span>
                    <button type="button" onClick={() => setReplyTo(null)} className="h-8 px-2 font-semibold text-sea">
                      {NHAN.huy}
                    </button>
                  </div>
                )}
                <label htmlFor="kairos-bl" className="sr-only">
                  Viết bình luận
                </label>
                <textarea
                  id="kairos-bl"
                  ref={box}
                  rows={2}
                  value={text}
                  onChange={(e) => onText(e.target.value)}
                  placeholder="Viết bình luận…"
                  className={`${inputClass} h-auto min-h-20 py-2 leading-relaxed`}
                />
                <div className="mt-1 flex min-h-5 items-center justify-between gap-2 text-[0.8125rem]">
                  <span className="text-foreground/65">
                    {draftFail ? "Máy đầy — nháp chưa lưu được" : !online && text.trim() ? "Đã giữ nháp trong máy" : ""}
                  </span>
                  {left <= 100 && <span className={`font-semibold tabular-nums ${left < 0 ? "text-danger" : "text-foreground/65"}`}>{left}</span>}
                </div>
                {sendErr && (
                  <p role="alert" className="mt-1 text-[0.875rem] font-semibold text-danger">
                    {sendErr}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => void send()}
                  disabled={!canSend}
                  aria-busy={sending}
                  className="mt-2 h-11 w-full rounded-xl bg-sea font-semibold text-white disabled:opacity-40"
                >
                  {!online || load === "offline" ? NHAN.canSong : sending ? NHAN.dangGui : NHAN.gui}
                </button>
              </div>
            )}
          </section>
        </>
      )}
      {a.ui}
    </div>
  );
}

"use client";

/*
  KHỐI BÌNH LUẬN DÙNG CHUNG (14 §3.4, AC09 · AC10 · AC15) — INLINE NGAY DƯỚI THẺ BÀI như Facebook (anh Long
  2026-10-24: "thao tác bình luận các kiểu giống fb, inline chứ đừng nhảy ra tab khác") và ở /kairos/p/[id].

   · Trả lời 1 cấp: trả lời một trả lời ⇒ gắn vào bình luận gốc kèm "@tên" (write-client.replyTarget).
   · Hay lạc quan + hoàn tác; xoá của mình (xác nhận tại chỗ); báo xấu của người khác.
   · Ô viết dạng viên (như FB): chữ + nút gửi; Enter xuống dòng (bàn phím điện thoại), bấm nút mới gửi.
   · Nháp theo bài `forfish.kairos.nhap.v1` khoá `bl:<id>` — mất sóng vẫn giữ chữ, KHÔNG tự gửi khi có sóng lại.
   · `initialNext === undefined` ⇒ tự tải trang bình luận đầu (dùng ở thẻ dòng tin: thẻ chỉ mang 2 bình luận nổi).
*/

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { SendIcon, ThumbIcon } from "@/components/icons";
import { draftKey } from "@/lib/kairos/cache";
import { countLabel, postTimeLabel } from "@/lib/kairos/feed-client";
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
import { RulesBox } from "./rules-box";

/** Việc của màn chứa (usePostActions): báo một dòng, mở hộp báo xấu, sửa số bình luận của bài đang hiện. */
export interface CommentKit {
  notify: (text: string, bad?: boolean) => void;
  report: (t: { type: "post" | "comment"; id: string }) => void;
  patch: (id: string, p: Partial<KairosPost>) => void;
}

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
        <div className="inline-block max-w-full rounded-2xl bg-field px-3 py-1.5">
          <Link href={`/kairos/u/${c.author.profileId}`} className="block truncate text-[0.8125rem] font-bold text-navy">
            {c.author.handle}
            {c.author.official && <span className="ml-1.5 text-sea">{NHAN.chinhThuc}</span>}
            {c.author.isAgent && <span title="Trợ lý AI" className="ml-1.5 rounded-full bg-navy/10 px-1.5 text-[0.6875rem] font-bold text-navy">AI</span>}
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

export function CommentThread({
  post,
  initial,
  initialNext,
  kit,
  canWrite = true,
  autoFocus = false,
  now,
}: {
  post: KairosPost;
  initial: KairosComment[];
  /** con trỏ trang sau; `undefined` = chưa tải ⇒ khối tự tải trang đầu */
  initialNext?: string | null;
  kit: CommentKit;
  /** bài đang là bản lưu (mất sóng) ⇒ ô viết "Cần sóng" */
  canWrite?: boolean;
  autoFocus?: boolean;
  now: number;
}) {
  const { phone, signedIn, ready: authReady } = useAuthUser();
  const online = useOnline();
  const id = post.id;
  const [comments, setComments] = useState<KairosComment[]>(initial);
  const [next, setNext] = useState<string | null>(initialNext ?? null);
  const [first, setFirst] = useState<"idle" | "loading" | "error">(initialNext === undefined ? "loading" : "idle");
  const [more, setMore] = useState<"idle" | "loading" | "error">("idle");
  const dKey = draftKey("bl", id);
  const [text, setText] = useState("");
  const [draftFail, setDraftFail] = useState(false);
  const [replyTo, setReplyTo] = useState<{ parentId: string; handle: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [sendErr, setSendErr] = useState("");
  const [needRules, setNeedRules] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);
  const hayBusy = useRef(new Set<string>());

  useEffect(() => setText(loadDraft(phone, dKey)), [phone, dKey]);

  const loadFirst = useCallback(async () => {
    setFirst("loading");
    const r = await kairosSend<{ comments: KairosComment[]; next: string | null }>("GET", `/api/kairos/posts/${encodeURIComponent(id)}/comments`);
    if (!r.ok) {
      setFirst("error");
      return;
    }
    setComments(r.data.comments);
    setNext(r.data.next ?? null);
    setFirst("idle");
  }, [id]);

  useEffect(() => {
    if (initialNext === undefined) void loadFirst();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ lúc mở khối
  }, []);

  useEffect(() => {
    if (autoFocus) box.current?.focus({ preventScroll: false });
  }, [autoFocus]);

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
    setComments((cur) => [...cur, ...r.data.comments.filter((c) => !cur.some((x) => x.id === c.id))]);
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
  const canSend = online && signedIn && canWrite && !sending && len > 0 && left >= 0 && !needRules;

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
    kit.patch(id, { commentCount: post.commentCount + 1 });
    setText("");
    saveDraft(phone, dKey, "");
    setReplyTo(null);
  };

  const hayComment = async (c: KairosComment) => {
    if (!signedIn) {
      kit.notify("Đăng nhập để bấm Hay.", true);
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
    if (!r.ok) kit.notify(errorText(r, "hay"), true);
  };

  const deleteComment = async (c: KairosComment) => {
    const r = await kairosSend("DELETE", `/api/kairos/comments/${c.id}`);
    if (!r.ok) {
      kit.notify(errorText(r, "xoa"), true);
      return false;
    }
    const gone = comments.length - dropComment(comments, c.id).length;
    setComments((cur) => dropComment(cur, c.id));
    kit.patch(id, { commentCount: Math.max(0, post.commentCount - gone) });
    kit.notify("Đã xoá bình luận.");
    return true;
  };

  const threads = threadComments(comments);
  const report = (c: KairosComment) => kit.report({ type: "comment", id: c.id });
  const sendLabel = !online || !canWrite ? NHAN.canSong : sending ? NHAN.dangGui : NHAN.gui;

  return (
    <div className="space-y-3">
      {first === "loading" && comments.length === 0 && <p className="text-[0.875rem] text-foreground/65">{NHAN.dangTai}</p>}
      {first === "error" && (
        <button type="button" onClick={() => void loadFirst()} className="h-10 rounded-xl border border-line px-3 text-[0.875rem] font-semibold text-sea">
          Chưa tải được bình luận — {NHAN.thuLai}
        </button>
      )}
      {threads.length === 0 && first === "idle" && (
        <p className="text-[0.875rem] text-foreground/65">{canWrite ? "Chưa có bình luận. Bà con nói trước nhé." : "Bình luận chưa lưu trong máy."}</p>
      )}
      {threads.length > 0 && (
        <ul className="space-y-3">
          {threads.map((t) => (
            <li key={t.root.id}>
              <ul className="space-y-2">
                <CommentRow c={t.root} now={now} onHay={hayComment} onReply={startReply} onDelete={deleteComment} onReport={report} />
                {t.replies.map((r) => (
                  <CommentRow key={r.id} c={r} now={now} reply onHay={hayComment} onReply={startReply} onDelete={deleteComment} onReport={report} />
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
          className="text-[0.875rem] font-semibold text-foreground/65 disabled:opacity-40"
        >
          {more === "loading" ? NHAN.dangTai : more === "error" ? `Chưa tải được — ${NHAN.thuLai}` : "Xem thêm bình luận"}
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
            <div className="mb-1 flex items-center gap-2 text-[0.8125rem]">
              <span className="text-foreground/65">
                Trả lời <span className="font-semibold text-navy">{replyTo.handle}</span>
              </span>
              <button type="button" onClick={() => setReplyTo(null)} className="h-8 px-2 font-semibold text-sea">
                {NHAN.huy}
              </button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <label htmlFor={`kairos-bl-${id}`} className="sr-only">
              Viết bình luận
            </label>
            <textarea
              id={`kairos-bl-${id}`}
              ref={box}
              rows={1}
              value={text}
              onChange={(e) => onText(e.target.value)}
              placeholder="Viết bình luận…"
              className="max-h-32 min-h-11 flex-1 resize-none rounded-3xl border border-line bg-field px-4 py-2.5 text-[1rem] leading-snug outline-none focus-visible:ring-2 focus-visible:ring-sea"
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={!canSend}
              aria-busy={sending}
              aria-label={sendLabel}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sea text-white disabled:opacity-40"
            >
              <SendIcon className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-1 flex min-h-5 items-center justify-between gap-2 px-2 text-[0.8125rem]">
            <span className="text-foreground/65">
              {draftFail
                ? "Máy đầy — nháp chưa lưu được"
                : !online || !canWrite
                  ? text.trim()
                    ? "Mất sóng — đã giữ nháp trong máy"
                    : "Mất sóng — có sóng mới gửi được"
                  : ""}
            </span>
            {left <= 100 && <span className={`font-semibold tabular-nums ${left < 0 ? "text-danger" : "text-foreground/65"}`}>{left}</span>}
          </div>
          {sendErr && (
            <p role="alert" className="mt-1 px-2 text-[0.875rem] font-semibold text-danger">
              {sendErr}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

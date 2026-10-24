"use client";

/*
  THẺ BÀI KAIROS (14-ba-spec-kairos §3.2 bảng "Thẻ bài 3 loại", AC02). Chung khung `.surface`,
  khác ĐẦU THẺ:
   · `bao`        — tên báo + giờ + chủ đề · tiêu đề + tóm tắt + ảnh bìa · "Đọc bài gốc"
   · `chinh-thuc` — "SDVICO" + dấu Chính thức + Ghim · chữ + ảnh
   · `ba-con`     — ảnh đại diện chữ cái + tên gọi + dòng phụ + giờ · chữ (6 dòng, Xem thêm)
                    + lưới ảnh + thẻ bài gốc khi đăng lại
  Chân: Hay · Bình luận · Chia sẻ + 2 bình luận nhiều Hay nhất + "Xem N bình luận".

  HÀNH VI Hay / Chia sẻ / ba chấm do màn gọi truyền vào (`actions`) — thiếu thì nút vẫn hiện
  số đếm nhưng không bấm được (agent sau nối hành vi, khung không đổi).
  BÌNH LUẬN INLINE như Facebook (anh Long 2026-10-24: "inline chứ đừng nhảy ra tab khác"): màn có
  `actions.binhLuan` ⇒ bấm Bình luận / "Xem N bình luận" mở khối comment-thread NGAY DƯỚI THẺ (tải đủ
  bình luận, trả lời, Hay, xoá, ô viết có sẵn con trỏ); không có ⇒ liên kết sang /kairos/p/[id] như cũ.

  BẢN LƯU MẤT SÓNG chỉ có chữ (cache.ts): `images` rỗng + `imageCount` ⇒ dòng "Có N ảnh —
  cần sóng", ảnh đại diện về chữ cái, ảnh bìa bỏ.
*/

import Link from "next/link";
import { useState } from "react";
import { CommentIcon, ShareIcon, ThumbIcon } from "@/components/icons";
import { areaTag, countLabel, portLabel, postTimeLabel } from "@/lib/kairos/feed-client";
import type { KairosComment, KairosPost } from "@/lib/kairos/types";
import { NHAN, NHAN_CHIP_KAIROS } from "@/lib/labels";
import { isPinned } from "@/lib/kairos/xep-bai";
import { KairosAvatar } from "./kairos-avatar";
import { CommentThread, type CommentKit } from "./comment-thread";

export interface PostActions {
  /** có ⇒ bình luận mở INLINE dưới thẻ (comment-thread) thay vì sang trang bài */
  binhLuan?: CommentKit;
  onHay?: (p: KairosPost) => void;
  onShare?: (p: KairosPost) => void;
  /** ba chấm: Sửa/Xoá (bài mình) hoặc Báo xấu/Chặn */
  onMore?: (p: KairosPost) => void;
}

const topicLabel = (t: string) => (NHAN_CHIP_KAIROS as Record<string, string>)[t] ?? "";

/** Thân bài dài: hơn ~6 dòng thì cắt + "Xem thêm" (14 §10 cực đoan: 2.000 ký tự). */
const isLong = (s: string) => s.length > 280 || s.split("\n").length > 6;

function Body({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  const long = isLong(text);
  return (
    <div className="px-4 pb-2">
      <p className={`whitespace-pre-line break-words text-[1rem] leading-relaxed ${long && !open ? "line-clamp-6" : ""}`}>{text}</p>
      {long && (
        <button type="button" onClick={() => setOpen((v) => !v)} className="mt-1 text-[0.875rem] font-semibold text-sea">
          {open ? NHAN.thuGon : NHAN.xemThem}
        </button>
      )}
    </div>
  );
}

/** Lưới ảnh 1 / 2 / 3+ (≤5; quá 3 hiện "+N" trên ô cuối). */
function Images({ urls, count }: { urls: string[]; count: number }) {
  if (!urls.length) {
    return count > 0 ? <p className="px-4 pb-2 text-[0.875rem] text-foreground/65">Có {count} ảnh — cần sóng để xem</p> : null;
  }
  const shown = urls.slice(0, 3);
  const extra = urls.length - shown.length;
  return (
    <div className={`grid gap-0.5 pb-2 ${shown.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
      {shown.map((u, i) => (
        <div key={u} className={`relative bg-field ${shown.length === 3 && i === 0 ? "col-span-2 aspect-[16/9]" : shown.length === 1 ? "aspect-[4/3]" : "aspect-square"}`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- ảnh kho kairos-media, đã nén ở máy (image-resize) */}
          <img src={u} alt={`Ảnh ${i + 1}`} loading="lazy" className="h-full w-full object-cover" />
          {extra > 0 && i === shown.length - 1 && (
            <span className="absolute inset-0 flex items-center justify-center bg-navy/55 text-[1.5rem] font-bold text-white">+{extra}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function Head({ post, now }: { post: KairosPost; now: number }) {
  const time = postTimeLabel(post.publishedAt, now);
  const topic = topicLabel(post.topic);
  if (post.kind === "bao") {
    return (
      <div className="flex items-baseline gap-2 px-4 pt-3 pb-1 text-[0.875rem]">
        <span className="min-w-0 truncate font-bold text-navy">{post.outlet || "Báo"}</span>
        <span className="shrink-0 text-foreground/65">{time}</span>
        {topic && <span className="ml-auto shrink-0 font-semibold text-sea">{topic}</span>}
      </div>
    );
  }
  const a = post.author;
  const official = post.kind === "chinh-thuc" || !!a?.official;
  const name = official ? "SDVICO" : a?.handle || "Bà con";
  const sub = [a?.subline, a?.boatReg].filter(Boolean).join(" · ");
  const pinned = isPinned(post, now);
  const head = (
    <>
      <KairosAvatar id={a?.profileId || post.id} name={name} url={a?.avatarUrl ?? null} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="min-w-0 truncate font-bold text-navy">{name}</span>
          {official && (
            <span className="shrink-0 rounded-full bg-sea/12 px-2 py-0.5 text-[0.75rem] font-bold text-sea">{NHAN.chinhThuc}</span>
          )}
          {pinned && (
            <span className="shrink-0 rounded-full bg-sun/20 px-2 py-0.5 text-[0.75rem] font-bold text-navy">{NHAN.ghim}</span>
          )}
        </div>
        <p className="truncate text-[0.8125rem] text-foreground/65">
          {[sub, time, post.editedAt ? "đã sửa" : ""].filter(Boolean).join(" · ")}
        </p>
      </div>
    </>
  );
  return (
    <div className="flex items-center gap-3 px-4 pt-3 pb-2">
      {a?.profileId && !official ? (
        <Link href={`/kairos/u/${a.profileId}`} className="flex min-w-0 flex-1 items-center gap-3">
          {head}
        </Link>
      ) : (
        head
      )}
    </div>
  );
}

/** Thẻ bài gốc khi đăng lại (1 tầng, A11). */
function Reshare({ post, now }: { post: KairosPost; now: number }) {
  if (post.reshareGone) {
    return <p className="mx-4 mb-2 rounded-2xl border border-line px-3 py-3 text-[0.875rem] text-foreground/65">Bài gốc không còn</p>;
  }
  const r = post.reshareOf;
  if (!r) return null;
  return (
    <div className="mx-4 mb-2 overflow-hidden rounded-2xl border border-line">
      <Head post={r} now={now} />
      {r.title && <p className="px-4 pb-1 font-bold text-navy">{r.title}</p>}
      <p className="line-clamp-3 px-4 pb-3 text-[1rem]">{r.kind === "bao" ? r.summary || r.body : r.body}</p>
    </div>
  );
}

function TopComment({ c }: { c: KairosComment }) {
  return (
    <li className="flex gap-2">
      <KairosAvatar id={c.author.profileId || c.id} name={c.author.handle} url={c.author.avatarUrl} small />
      <div className="min-w-0 rounded-2xl bg-field px-3 py-1.5">
        <p className="truncate text-[0.8125rem] font-bold text-navy">{c.author.handle}</p>
        <p className="line-clamp-3 break-words text-[1rem]">{c.body}</p>
      </div>
    </li>
  );
}

export function PostCard({
  post,
  now,
  actions = {},
  onRead,
  inDetail = false,
  benPort,
}: {
  post: KairosPost;
  now: number;
  actions?: PostActions;
  /** đang ở /kairos/p/[id] — bình luận đầy đủ nằm ngay dưới, bỏ khối 2 bình luận nổi */
  inDetail?: boolean;
  /** đang ở Bến này — không hiện lại lối vào chính nó */
  benPort?: string;
  /** mở đọc (Đọc bài gốc / xem bình luận) — để ghi thói quen chủ đề TRONG MÁY */
  onRead?: (p: KairosPost) => void;
}) {
  const btn = "flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl text-[0.875rem] font-semibold transition active:scale-[0.97]";
  const detail = `/kairos/p/${post.id}`;
  const inline = !inDetail && !!actions.binhLuan;
  const [moBL, setMoBL] = useState(false);
  const moBinhLuan = () => {
    onRead?.(post);
    setMoBL(true);
  };
  const area = areaTag(post);
  return (
    <article className="surface overflow-hidden" aria-label={post.kind === "bao" ? post.title ?? "Bài báo" : "Bài đăng"}>
      <Head post={post} now={now} />

      {post.kind === "bao" ? (
        <>
          {post.title && <h2 className="px-4 pb-1 text-[1.125rem] font-bold leading-snug text-navy">{post.title}</h2>}
          {(post.summary || post.body) && <p className="px-4 pb-2 text-[1rem] leading-relaxed">{post.summary || post.body}</p>}
          {post.coverUrl && (
            <div className="aspect-[16/9] bg-field">
              {/* eslint-disable-next-line @next/next/no-img-element -- ảnh bìa là link RSS của báo (A12), không qua next/image */}
              <img src={post.coverUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
            </div>
          )}
          {post.url && (
            <a
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onRead?.(post)}
              className="mx-4 my-2 flex h-11 items-center justify-center gap-2 rounded-xl border border-line text-[1rem] font-semibold text-sea"
            >
              Đọc bài gốc
              <ShareIcon className="h-4 w-4" />
            </a>
          )}
        </>
      ) : (
        <>
          <Body text={post.body} />
          <Images urls={post.images} count={post.imageCount ?? post.images.length} />
          <Reshare post={post} now={now} />
        </>
      )}

      {benPort !== post.ports?.[0] && portLabel(post.ports?.[0]) && (
        <Link href={`/kairos/ben/${post.ports[0]}`} className="mx-4 mb-2 inline-flex h-8 items-center rounded-full bg-field px-3 text-[0.8125rem] font-semibold text-sea">
          Bến {portLabel(post.ports[0])}
        </Link>
      )}
      {area && (
        <span className="mx-4 mb-2 inline-flex h-8 items-center rounded-full bg-field px-3 text-[0.8125rem] font-semibold text-foreground/70">
          {NHAN[area]}
        </span>
      )}

      <div className="flex items-center gap-1 border-t border-line px-2 py-1">
        <button
          type="button"
          aria-pressed={post.hayByMe}
          aria-label={`${NHAN.hay}, ${post.hayCount}`}
          disabled={!actions.onHay}
          onClick={() => actions.onHay?.(post)}
          className={`${btn} ${post.hayByMe ? "text-sea" : "text-foreground/75"} disabled:active:scale-100`}
        >
          <ThumbIcon className="h-5 w-5" />
          {NHAN.hay}
          {post.hayCount > 0 && <span className="tabular-nums">{countLabel(post.hayCount)}</span>}
        </button>
        {inline ? (
          <button type="button" aria-expanded={moBL} onClick={() => (moBL ? setMoBL(false) : moBinhLuan())} className={`${btn} ${moBL ? "text-sea" : "text-foreground/75"}`}>
            <CommentIcon className="h-5 w-5" />
            {NHAN.binhLuan}
            {post.commentCount > 0 && <span className="tabular-nums">{countLabel(post.commentCount)}</span>}
          </button>
        ) : (
          <Link href={detail} onClick={() => onRead?.(post)} className={`${btn} text-foreground/75`}>
            <CommentIcon className="h-5 w-5" />
            {NHAN.binhLuan}
          </Link>
        )}
        <button
          type="button"
          disabled={!actions.onShare}
          onClick={() => actions.onShare?.(post)}
          className={`${btn} text-foreground/75 disabled:active:scale-100`}
        >
          <ShareIcon className="h-5 w-5" />
          {NHAN.chiaSe}
        </button>
        {actions.onMore && (
          <button
            type="button"
            aria-label="Thêm việc"
            onClick={() => actions.onMore?.(post)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[1.25rem] font-bold text-foreground/65"
          >
            ⋯
          </button>
        )}
      </div>

      {inline && moBL && actions.binhLuan && (
        <div className="border-t border-line px-4 py-3">
          <CommentThread post={post} initial={post.topComments} kit={actions.binhLuan} now={now} autoFocus />
        </div>
      )}

      {!inDetail && !moBL && (post.topComments.length > 0 || post.commentCount > 0) && (
        <div className="px-4 pb-3">
          {post.topComments.length > 0 && (
            <ul className="mb-1.5 space-y-2">
              {post.topComments.map((c) => (
                <TopComment key={c.id} c={c} />
              ))}
            </ul>
          )}
          {post.commentCount > post.topComments.length &&
            (inline ? (
              <button type="button" onClick={moBinhLuan} className="text-[0.875rem] font-semibold text-foreground/65">
                Xem {countLabel(post.commentCount)} bình luận
              </button>
            ) : (
              <Link href={detail} onClick={() => onRead?.(post)} className="text-[0.875rem] font-semibold text-foreground/65">
                Xem {countLabel(post.commentCount)} bình luận
              </Link>
            ))}
        </div>
      )}
    </article>
  );
}

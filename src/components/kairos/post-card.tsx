"use client";

/*
  THẺ BÀI KAIROS (14-ba-spec-kairos §3.2 bảng "Thẻ bài 3 loại", AC02). Chung khung `.surface`,
  khác ĐẦU THẺ:
   · `bao`        — tên báo + giờ + chủ đề · tiêu đề + tóm tắt + ảnh bìa · "Đọc bài gốc"
   · `chinh-thuc` — tên hồ sơ (SDVICO / Sen Biển) + dấu Chính thức + Ghim · chữ + ảnh
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

import type { CamXuc } from "@/lib/kairos/cam-xuc";
import Link from "next/link";
import { useState } from "react";
import { CommentIcon, ShareIcon } from "@/components/icons";
import { areaTag, countLabel, portLabel, postTimeLabel } from "@/lib/kairos/feed-client";
import type { KairosComment, KairosPost } from "@/lib/kairos/types";
import { NHAN, NHAN_CHIP_KAIROS } from "@/lib/labels";
import { isPinned } from "@/lib/kairos/xep-bai";
import { ChuXemThem } from "./chu-xem-them";
import { DongCamXuc, NutCamXuc } from "./nut-cam-xuc";
import { KairosAvatar } from "./kairos-avatar";
import { CommentThread, type CommentKit } from "./comment-thread";
import { KhungAnh, NutNghe, useHoanAnh } from "./de-dung";

export interface PostActions {
  /** có ⇒ bình luận mở INLINE dưới thẻ (comment-thread) thay vì sang trang bài */
  binhLuan?: CommentKit;
  /** cảm xúc (mặc định 👍 Hay); trùng loại đang có ⇒ gỡ */
  onHay?: (p: KairosPost, kind?: CamXuc) => void;
  onShare?: (p: KairosPost) => void;
  /** ba chấm: Sửa/Xoá (bài mình) hoặc Báo xấu/Chặn */
  onMore?: (p: KairosPost) => void;
}

const topicLabel = (t: string) => (NHAN_CHIP_KAIROS as Record<string, string>)[t] ?? "";

/** Thân bài bà con: cắt 6 dòng + "… Xem thêm" kiểu FB (đo tràn thật — chu-xem-them). */
function Body({ text }: { text: string }) {
  if (!text) return null;
  return (
    <div className="px-4 pb-2">
      <ChuXemThem text={text} dong={6} className="text-[1rem] leading-relaxed" />
    </div>
  );
}

/** Lưới ảnh 1 / 2 / 3+ (≤5; quá 3 hiện "+N" trên ô cuối). */
function Images({ urls, count }: { urls: string[]; count: number }) {
  const hoan = useHoanAnh();
  const [xem, setXem] = useState(false);
  if (!urls.length) {
    return count > 0 ? <p className="px-4 pb-2 text-[0.875rem] text-foreground/65">Có {count} ảnh — cần sóng để xem</p> : null;
  }
  if (hoan && !xem) return <KhungAnh soAnh={urls.length} onXem={() => setXem(true)} className="mb-2 h-24" />;
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

/** `nghe=false` trong thẻ bài gốc đăng lại (Reshare cũng dùng Head) — một thẻ một nút Nghe. */
function Head({ post, now, nghe = true }: { post: KairosPost; now: number; nghe?: boolean }) {
  const time = postTimeLabel(post.publishedAt, now);
  const topic = topicLabel(post.topic);
  if (post.kind === "bao") {
    return (
      <div className="flex items-center gap-2 pl-4 pr-1 pt-1.5 text-[0.875rem]">
        <span className="min-w-0 truncate font-bold text-navy">{post.outlet || "Báo"}</span>
        <span className="shrink-0 text-foreground/65">{time}</span>
        {post.nong && <span className="shrink-0 rounded-full bg-danger-bg px-2 py-0.5 text-[0.75rem] font-bold text-danger">{NHAN.dangNong}</span>}
        {topic && <span className="ml-auto shrink-0 font-semibold text-sea">{topic}</span>}
        {nghe ? (
          <span className={topic ? "" : "ml-auto"}>
            <NutNghe post={post} />
          </span>
        ) : (
          <span className="h-9" />
        )}
      </div>
    );
  }
  const a = post.author;
  const official = post.kind === "chinh-thuc" || !!a?.official;
  // tên theo HỒ SƠ người đăng — bài Chính thức có thể là SDVICO hoặc Sen Biển (2026-10-24: bài Sen Biển từng
  // hiện nhầm "SDVICO" vì tên gắn cứng); thiếu hồ sơ mới lùi về "SDVICO"/"Bà con"
  const name = a?.handle || (official ? "SDVICO" : "Bà con");
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
          {/* agent tri thức (16-ba-spec-agent-kairos) — chấm AI nhỏ như dấu tích, không làm tên khó đọc */}
          {a?.isAgent && <span title="Trợ lý AI" className="shrink-0 rounded-full bg-navy/10 px-1.5 text-[0.6875rem] font-bold text-navy">AI</span>}
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
      {a?.profileId ? (
        <Link href={`/kairos/u/${a.profileId}`} className="flex min-w-0 flex-1 items-center gap-3">
          {head}
        </Link>
      ) : (
        head
      )}
      {nghe && <NutNghe post={post} />}
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
      <Head post={r} now={now} nghe={false} />
      {r.title && <p className="px-4 pb-1 font-bold text-navy">{r.title}</p>}
      <div className="px-4 pb-3">
        <ChuXemThem text={(r.kind === "bao" ? r.summary || r.body : r.body) ?? ""} dong={3} className="text-[1rem]" />
      </div>
    </div>
  );
}

function TopComment({ c }: { c: KairosComment }) {
  return (
    <li className="flex gap-2">
      <KairosAvatar id={c.author.profileId || c.id} name={c.author.handle} url={c.author.avatarUrl} small />
      <div className="min-w-0 rounded-2xl bg-field px-3 py-1.5">
        <p className="truncate text-[0.8125rem] font-bold text-navy">{c.author.handle}</p>
        <ChuXemThem text={c.body} dong={3} nen="field" className="text-[1rem]" />
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
  const btn = "flex h-11 min-w-0 flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-xl px-1 [&>svg]:shrink-0 text-[0.875rem] font-semibold transition active:scale-[0.97]"; // không gãy "Bình luận 3" làm hai dòng ở máy 360–375px
  const detail = `/kairos/p/${post.id}`;
  const inline = !inDetail && !!actions.binhLuan;
  const [moBL, setMoBL] = useState(false);
  const moBinhLuan = () => {
    onRead?.(post);
    setMoBL(true);
  };
  const area = areaTag(post);
  const hoanAnh = useHoanAnh();
  const [xemBia, setXemBia] = useState(false);
  return (
    <article className="surface overflow-hidden" aria-label={post.kind === "bao" ? post.title ?? "Bài báo" : "Bài đăng"}>
      <Head post={post} now={now} />

      {post.kind === "bao" ? (
        <>
          {post.title && <h2 className="px-4 pb-1 text-[1.125rem] font-bold leading-snug text-navy">{post.title}</h2>}
          {(post.summary || post.body) && (
            <div className="px-4 pb-2">
              <ChuXemThem text={(post.summary || post.body) ?? ""} dong={inDetail ? 8 : 4} className="text-[1rem] leading-relaxed" />
            </div>
          )}
          {post.coverUrl && hoanAnh && !xemBia && <KhungAnh soAnh={1} onXem={() => setXemBia(true)} className="h-16" />}
          {post.coverUrl && (!hoanAnh || xemBia) && (
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

      {post.hayCount > 0 && (
        <div className="px-4 pb-1.5">
          <DongCamXuc camXuc={post.camXuc} tong={post.hayCount} />
        </div>
      )}
      <div className="flex items-center gap-1 border-t border-line px-2 py-1">
        <NutCamXuc
          my={post.myCamXuc ?? (post.hayByMe ? "hay" : null)}
          disabled={!actions.onHay}
          onChon={(k) => actions.onHay?.(post, k)}
          className={`${btn} w-full`}
        />
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

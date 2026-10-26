"use client";

/*
  THẺ BÀI KAIROS (14-ba-spec-kairos §3.2 bảng "Thẻ bài 3 loại", AC02). Chung khung `.surface`,
  khác ĐẦU THẺ:
   · `bao`        — MỘT KHUÔN đầu thẻ với bà con (K3-02, 2026-10-25): ảnh tròn chữ cái tên báo · tên báo đậm
                    nguyên dòng · dòng 2 mờ "3 giờ · Thời sự" + chip Đang nóng nhỏ · tóm tắt · THẺ LINK (K3-04:
                    ảnh bìa + dải xám tên miền + tiêu đề, chạm cả khối mở bài gốc; không còn nút "Đọc bài gốc")
   · `chinh-thuc` — tên hồ sơ (SDVICO / Sen Biển) + dấu Chính thức + Ghim · chữ + ảnh
   · `ba-con`     — ảnh đại diện chữ cái + tên gọi + dòng phụ + giờ · chữ (6 dòng, Xem thêm)
                    + lưới ảnh + thẻ bài gốc khi đăng lại
  Đầu thẻ kiểu FB: `Tên ▸ Bến X` (bài gắn cảng trong danh mục — chạm sang Bến, như tên nhóm FB; bài chỉ gắn
  tỉnh/vùng/"cả nước" KHÔNG có nhãn nơi chốn — bỏ nhãn "Cả nước" 2026-10-24) · Nghe · ⋯ sát phải.
  Lưới ảnh kiểu FB (anh-luoi.boCucAnh), chạm ô ảnh ⇒ trình xem toàn màn (xem-anh).
  Dòng tổng: cảm xúc (trái) · "N bình luận" (phải, mở bình luận KHÔNG bật bàn phím). Chân: Hay · Bình luận
  (mở + con trỏ sẵn trong ô viết) · Chia sẻ + 2 bình luận nhiều Hay nhất.

  HÀNH VI Hay / Chia sẻ / ba chấm do màn gọi truyền vào (`actions`) — thiếu thì nút vẫn hiện
  số đếm nhưng không bấm được (agent sau nối hành vi, khung không đổi).
  BÌNH LUẬN INLINE như Facebook (anh Long 2026-10-24: "inline chứ đừng nhảy ra tab khác"): màn có
  `actions.binhLuan` ⇒ bấm Bình luận / "N bình luận" (dòng tổng) mở khối comment-thread NGAY DƯỚI THẺ (tải đủ
  bình luận, trả lời, Hay, xoá; con trỏ vào ô viết CHỈ khi bấm nút Bình luận); không có ⇒ liên kết sang /kairos/p/[id] như cũ.
  Mở khối ⇒ cuộn đầu khối vào tầm (chừa dock + ô viết); ô viết trong khối DÍNH ĐÁY trên dock nên thẻ KHÔNG được
  `overflow-hidden` (K3-01). Dưới 2 bình luận nổi: "Xem thêm bình luận" khi bài còn bình luận khác (K3-07).
  ⋯ truyền kèm chính nút ⇒ màn mở Popover neo cạnh nút (03 §6 mục 9, K3-05).

  BẢN LƯU MẤT SÓNG chỉ có chữ (cache.ts): `images` rỗng + `imageCount` ⇒ dòng "Có N ảnh —
  cần sóng", ảnh đại diện về chữ cái, ảnh bìa bỏ.
*/

import type { CamXuc } from "@/lib/kairos/cam-xuc";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { CommentIcon, DocIcon, ShareIcon } from "@/components/icons";
import { boCucAnh } from "@/lib/kairos/anh-luoi";
import { countLabel, portLabel, postTimeLabel } from "@/lib/kairos/feed-client";
import type { KairosComment, KairosPost } from "@/lib/kairos/types";
import { NHAN, NHAN_CHIP_KAIROS } from "@/lib/labels";
import { isPinned } from "@/lib/kairos/xep-bai";
import type { NhacTen } from "@/lib/kairos/nhac-ten";
import { tenMien } from "@/lib/kairos/social";
import { useOnline } from "@/lib/use-online";
import { ChuXemThem } from "./chu-xem-them";
import { DongCamXuc, NutCamXuc } from "./nut-cam-xuc";
import { KairosAvatar } from "./kairos-avatar";
import { CommentThread, type CommentKit } from "./comment-thread";
import { KhungAnh, NutNghe, useHoanAnh } from "./de-dung";
import { TraCuuDanhSach } from "./tra-cuu-danh-sach";
import { XemAnh } from "./xem-anh";

export interface PostActions {
  /** có ⇒ bình luận mở INLINE dưới thẻ (comment-thread) thay vì sang trang bài */
  binhLuan?: CommentKit;
  /** cảm xúc (mặc định 👍 Hay); trùng loại đang có ⇒ gỡ */
  onHay?: (p: KairosPost, kind?: CamXuc) => void;
  onShare?: (p: KairosPost) => void;
  /** ba chấm: Sửa/Xoá (bài mình) hoặc Báo xấu/Chặn — kèm nút để màn neo Popover cạnh nút */
  onMore?: (p: KairosPost, anchor: HTMLElement) => void;
}

const topicLabel = (t: string) => (NHAN_CHIP_KAIROS as Record<string, string>)[t] ?? "";

/** Thân bài bà con: cắt 6 dòng + "… Xem thêm" kiểu FB (đo tràn thật — chu-xem-them). */
function Body({ text, nhac }: { text: string; nhac?: NhacTen[] }) {
  if (!text) return null;
  return (
    <div className="px-4 pb-2">
      <ChuXemThem text={text} dong={6} nhac={nhac} className="text-[1rem] leading-relaxed" />
    </div>
  );
}

/**
 * Lưới ảnh kiểu FB (anh-luoi.boCucAnh): 1 ảnh theo tỉ lệ thật (dọc 4:5, ngang theo ảnh, kẹp cao) · 2 ảnh hai
 * cột vuông · 3 ảnh ô trái cao hai hàng · ≥4 ảnh lưới 2×2, ô thứ tư phủ "+N". Mỗi ô là nút mở trình xem toàn màn.
 */
function Images({ urls, count, chan }: { urls: string[]; count: number; chan?: (dong: (sau?: () => void) => void) => ReactNode }) {
  const hoan = useHoanAnh();
  const [xem, setXem] = useState(false);
  const [mo, setMo] = useState<number | null>(null);
  const [tiLe, setTiLe] = useState<{ w: number; h: number } | null>(null);
  if (!urls.length) {
    return count > 0 ? <p className="px-4 pb-2 text-[0.875rem] text-foreground/65">Có {count} ảnh — cần sóng để xem</p> : null;
  }
  if (hoan && !xem) return <KhungAnh soAnh={urls.length} onXem={() => setXem(true)} className="mb-2 h-24" />;
  const tong = Math.max(count, urls.length);
  const bc = boCucAnh(urls.length);
  const shown = urls.slice(0, bc.so);
  const them = Math.max(bc.them, bc.so === 4 ? tong - 4 : 0);
  const doc = tiLe ? tiLe.h > tiLe.w : false;
  const khung =
    bc.kieu === "mot"
      ? `max-h-[34rem] min-h-[12rem] ${tiLe ? (doc ? "aspect-[4/5]" : "") : "aspect-[4/3]"}`
      : bc.kieu === "hai"
        ? "grid grid-cols-2"
        : "grid aspect-square grid-cols-2 grid-rows-2";
  return (
    <div className="pb-2">
      <div className={`gap-0.5 overflow-hidden ${khung}`} style={bc.kieu === "mot" && tiLe && !doc ? { aspectRatio: `${tiLe.w} / ${tiLe.h}` } : undefined}>
        {shown.map((u, i) => (
          <button
            key={`${u}-${i}`}
            type="button"
            aria-label={`Xem ảnh ${i + 1}/${tong}`}
            onClick={() => setMo(i)}
            className={`relative block w-full overflow-hidden bg-field ${bc.kieu === "hai" ? "aspect-square" : "h-full"} ${bc.kieu === "ba" && i === 0 ? "row-span-2" : ""}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- ảnh kho kairos-media, đã nén ở máy (image-resize) */}
            <img
              src={u}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              onLoad={bc.kieu === "mot" ? (e) => {
                const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
                if (w > 0 && h > 0) setTiLe({ w, h });
              } : undefined}
              className="h-full w-full object-cover"
            />
            {them > 0 && i === shown.length - 1 && (
              <span className="absolute inset-0 flex items-center justify-center bg-navy/60 text-[1.5rem] font-bold text-white">+{them}</span>
            )}
          </button>
        ))}
      </div>
      {mo !== null && <XemAnh urls={urls} start={mo} onClose={() => setMo(null)} chan={chan} />}
    </div>
  );
}

/** Nút ⋯ đầu thẻ (Sửa/Xoá bài mình · Báo xấu/Chặn) — sát phải cạnh Nghe, như FB. */
function NutThem({ onMore }: { onMore: (anchor: HTMLElement) => void }) {
  return (
    <button
      type="button"
      aria-label="Thêm"
      aria-haspopup="menu"
      onClick={(e) => onMore(e.currentTarget)}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[1.25rem] font-bold text-foreground/65 transition active:scale-[0.95]"
    >
      ⋯
    </button>
  );
}

/**
 * "▸ Bến X" kiểu tên nhóm FB: chỉ khi bài gắn CẢNG trong danh mục và không phải đang đứng ở chính Bến đó. Liên
 * kết RIÊNG (không lồng trong liên kết trang cá nhân). Vùng chạm 2,75rem nhờ đệm dọc + lề âm — dòng tên không cao lên.
 */
function NhanBen({ post, benPort }: { post: KairosPost; benPort?: string }) {
  const id = post.ports?.[0];
  const ten = id && id !== benPort ? portLabel(id) : null;
  if (!ten) return null;
  return (
    <>
      <span aria-hidden className="shrink-0 text-[0.75rem] text-foreground/50">
        ▸
      </span>
      <Link
        href={`/kairos/ben/${id}`}
        className="-mx-1 -my-3 shrink-0 rounded-lg px-1 py-3 font-semibold text-sea focus-visible:ring-2 focus-visible:ring-sea"
      >
        Bến {ten}
      </Link>
    </>
  );
}

/**
 * `nghe=false` trong thẻ bài gốc đăng lại (Reshare cũng dùng Head) — một thẻ một nút Nghe, và không có ⋯.
 * `onMore` có ⇒ nút ⋯ sát phải. MỘT khuôn cho cả ba loại (K3-02): ảnh tròn · tên đậm nguyên dòng (co trước
 * nhãn Bến/Chính thức) · dòng 2 mờ. Báo: chữ cái tên báo (bỏ "Báo " để không báo nào cũng "B"), màu băm theo
 * tên ⇒ cùng báo cùng màu; dòng 2 "3 giờ · Thời sự" + chip Đang nóng nhỏ (hết chữ "Báo …" bị cắt).
 */
function Head({
  post,
  now,
  nghe = true,
  benPort,
  onMore,
}: {
  post: KairosPost;
  now: number;
  nghe?: boolean;
  benPort?: string;
  onMore?: (anchor: HTMLElement) => void;
}) {
  const time = postTimeLabel(post.publishedAt, now);
  const topic = topicLabel(post.topic);
  const nut = (
    <>
      {nghe && <NutNghe post={post} />}
      {nghe && onMore && <NutThem onMore={onMore} />}
    </>
  );
  const bao = post.kind === "bao";
  const a = post.author;
  const official = !bao && (post.kind === "chinh-thuc" || !!a?.official);
  // tên theo HỒ SƠ người đăng — bài Chính thức có thể là SDVICO hoặc Sen Biển (2026-10-24: bài Sen Biển từng
  // hiện nhầm "SDVICO" vì tên gắn cứng); thiếu hồ sơ mới lùi về "SDVICO"/"Bà con"
  const name = bao ? post.outlet || "Báo" : a?.handle || (official ? "SDVICO" : "Bà con");
  const sub = (bao ? [time, topic] : [[a?.subline, a?.boatReg].filter(Boolean).join(" · "), time, post.editedAt ? "đã sửa" : ""])
    .filter(Boolean)
    .join(" · ");
  const pinned = !bao && isPinned(post, now);
  const hoSo = !bao && a?.profileId ? `/kairos/u/${a.profileId}` : null;
  const avatar = (
    <KairosAvatar id={bao ? `bao:${name}` : a?.profileId || post.id} name={bao ? name.replace(/^báo\s+/i, "") : name} url={bao ? null : (a?.avatarUrl ?? null)} />
  );
  return (
    <div className="flex items-center gap-3 pl-4 pr-1 pt-3 pb-2">
      {hoSo ? (
        // ảnh đại diện và tên cùng dẫn trang cá nhân; ảnh bỏ khỏi thứ tự Tab (tên đã là lối vào)
        <Link href={hoSo} tabIndex={-1} aria-hidden className="shrink-0">
          {avatar}
        </Link>
      ) : (
        avatar
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {hoSo ? (
            <Link href={hoSo} className="min-w-0 truncate rounded font-bold text-navy">
              {name}
            </Link>
          ) : (
            <span className="min-w-0 truncate font-bold text-navy">{name}</span>
          )}
          {official && (
            <span className="shrink-0 rounded-full bg-sea/12 px-2 py-0.5 text-[0.75rem] font-bold text-sea">{NHAN.chinhThuc}</span>
          )}
          {/* agent tri thức (16-ba-spec-agent-kairos) — chấm AI nhỏ như dấu tích, không làm tên khó đọc */}
          {a?.isAgent && <span title="Trợ lý AI" className="shrink-0 rounded-full bg-navy/10 px-1.5 text-[0.6875rem] font-bold text-navy">AI</span>}
          <NhanBen post={post} benPort={benPort} />
          {pinned && (
            <span className="shrink-0 rounded-full bg-sun/20 px-2 py-0.5 text-[0.75rem] font-bold text-navy">{NHAN.ghim}</span>
          )}
        </div>
        <p className="flex items-center gap-1.5 text-[0.8125rem] text-foreground/65">
          <span className="truncate">{sub}</span>
          {bao && post.nong && <span className="shrink-0 rounded-full bg-danger-bg px-1.5 text-[0.6875rem] font-bold leading-4 text-danger">{NHAN.dangNong}</span>}
          {/* thông báo nhà nước (topic chinh-sach, 14 §21) — nhãn nhỏ cùng khuôn "Đang nóng", màu sea cho khác tin nóng */}
          {bao && post.topic === "chinh-sach" && <span className="shrink-0 rounded-full bg-sea/12 px-1.5 text-[0.6875rem] font-bold leading-4 text-sea">{NHAN.nhaNuoc}</span>}
        </p>
      </div>
      {nut}
    </div>
  );
}

/**
 * FILE ĐÍNH KÈM thông báo nhà nước (14 §21): mỗi file một hàng chạm được (≥44px) — icon tài liệu + tên ("Quyết định
 * 1958/QĐ-UBND (PDF)"). Có sóng mở tab mới (PDF danh sách tàu được duyệt theo đợt — bà con tìm tên mình); mất sóng báo
 * "Cần sóng". Chỉ bài có `attachments`.
 */
function DinhKemList({ post, notify }: { post: KairosPost; notify?: (text: string, bad?: boolean) => void }) {
  const online = useOnline();
  const ds = post.attachments ?? [];
  if (!ds.length) return null;
  const lop = "flex min-h-11 w-full items-center gap-2 px-4 py-2 text-left text-[0.9375rem] font-semibold text-navy transition active:bg-line/40";
  return (
    <ul className="mb-2 border-b border-line" aria-label={NHAN.dinhKem}>
      {ds.map((f) => (
        <li key={f.url}>
          {online ? (
            <a href={f.url} target="_blank" rel="noopener noreferrer" className={lop}>
              <DocIcon className="h-5 w-5 shrink-0 text-sea" />
              <span className="min-w-0 flex-1 break-words">{f.title}</span>
            </a>
          ) : (
            <button type="button" onClick={() => notify?.("Cần sóng để mở file.", true)} className={lop}>
              <DocIcon className="h-5 w-5 shrink-0 text-sea" />
              <span className="min-w-0 flex-1 break-words">{f.title}</span>
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * THẺ LINK bài báo kiểu FB (K3-04): ảnh bìa + dải xám (tên miền mờ · tiêu đề 2 dòng) — chạm CẢ KHỐI mở bài gốc
 * (giữ `onRead` ghi thói quen). Mất sóng / bản lưu (không ảnh bìa): dải xám vẫn hiện, chạm báo "Cần sóng".
 * Tiết kiệm dữ liệu: khung "chạm xem ảnh" đứng NGOÀI liên kết (nút trong liên kết là lồng tương tác).
 */
function TheBao({ post, onRead, notify }: { post: KairosPost; onRead?: (p: KairosPost) => void; notify?: (text: string, bad?: boolean) => void }) {
  const online = useOnline();
  const hoan = useHoanAnh();
  const [xem, setXem] = useState(false);
  const mien = tenMien(post.url);
  if (!post.title && !post.coverUrl) return null;
  const anh = post.coverUrl && (!hoan || xem) && (
    <span className="block aspect-[16/9] bg-field">
      {/* eslint-disable-next-line @next/next/no-img-element -- ảnh bìa là link RSS của báo (A12), không qua next/image */}
      <img src={post.coverUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
    </span>
  );
  const dai = (
    <span className="flex flex-col gap-0.5 bg-field px-4 py-2 text-left">
      {mien && <span className="truncate text-[0.75rem] uppercase tracking-wide text-foreground/55">{mien}</span>}
      {post.title && <span className="line-clamp-2 text-[1rem] font-bold leading-snug text-navy">{post.title}</span>}
    </span>
  );
  const lop = "block w-full border-y border-line transition active:bg-line/40";
  return (
    <div className="mb-2">
      {post.coverUrl && hoan && !xem && <KhungAnh soAnh={1} onXem={() => setXem(true)} className="h-16" />}
      {post.url && online ? (
        <a href={post.url} target="_blank" rel="noopener noreferrer" onClick={() => onRead?.(post)} className={lop}>
          {anh}
          {dai}
        </a>
      ) : post.url ? (
        <button type="button" onClick={() => notify?.("Cần sóng để mở bài gốc.", true)} className={lop}>
          {anh}
          {dai}
        </button>
      ) : (
        <div className={lop}>
          {anh}
          {dai}
        </div>
      )}
    </div>
  );
}

/**
 * Thẻ bài gốc khi đăng lại (1 tầng, A11): đầu thẻ dẫn trang người đăng, chữ/tiêu đề dẫn sang bài gốc
 * /kairos/p/[id], ảnh (bài bà con/chính thức) hoặc ảnh bìa (bài báo) chạm mở trình xem. Bản lưu mất sóng
 * không có ảnh ⇒ dòng "Có N ảnh — cần sóng".
 */
function Reshare({ post, now, benPort }: { post: KairosPost; now: number; benPort?: string }) {
  if (post.reshareGone) {
    return <p className="mx-4 mb-2 rounded-2xl border border-line px-3 py-3 text-[0.875rem] text-foreground/65">Bài gốc không còn</p>;
  }
  const r = post.reshareOf;
  if (!r) return null;
  const chu = (r.kind === "bao" ? r.summary || r.body : r.body) ?? "";
  return (
    <div className="mx-4 mb-2 overflow-hidden rounded-2xl border border-line">
      <Head post={r} now={now} nghe={false} benPort={benPort} />
      {(r.title || chu) && (
        // chữ cắt 3 dòng KHÔNG có "Xem thêm" (nút trong liên kết là lồng tương tác) — đọc hết ở bài gốc
        <Link href={`/kairos/p/${r.id}`} className="block px-4 pb-3">
          {r.title && <span className="block pb-1 font-bold text-navy">{r.title}</span>}
          {chu && <span className="line-clamp-3 whitespace-pre-line break-words text-[1rem]">{chu}</span>}
        </Link>
      )}
      {r.kind === "bao" ? (
        <Images urls={r.coverUrl ? [r.coverUrl] : []} count={r.coverUrl ? 1 : 0} />
      ) : (
        <Images urls={r.images} count={r.imageCount ?? r.images.length} />
      )}
    </div>
  );
}

function TopComment({ c }: { c: KairosComment }) {
  return (
    <li className="flex gap-2">
      <KairosAvatar id={c.author.profileId || c.id} name={c.author.handle} url={c.author.avatarUrl} small />
      <div className="min-w-0 rounded-2xl bg-field px-3 py-1.5">
        <p className="truncate text-[0.8125rem] font-bold text-navy">{c.author.handle}</p>
        {c.body ? (
          <ChuXemThem text={c.body} dong={3} nen="field" nhac={c.mentions} className="text-[1rem]" />
        ) : (
          !c.image && <p className="text-[1rem] text-foreground/65">Đã gửi một ảnh</p>
        )}
        {c.image && (
          // eslint-disable-next-line @next/next/no-img-element -- ảnh kho kairos-media; bản lưu offline đã bỏ ảnh
          <img src={c.image} alt="Ảnh bình luận" loading="lazy" className="mt-1 h-16 w-16 rounded-lg object-cover" />
        )}
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
  // ba nút chia đều; số bình luận đã lên dòng tổng nên "Bình luận" không còn kèm số, khỏi ép một dòng
  const btn = "flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl px-2.5 [&>svg]:shrink-0 text-[0.9375rem] font-semibold transition active:scale-[0.97]"; // kiểu FB mới: icon + số, dồn trái, không chia đều
  const detail = `/kairos/p/${post.id}`;
  const inline = !inDetail && !!actions.binhLuan;
  const router = useRouter();
  const [moBL, setMoBL] = useState(false);
  // true ⇒ ô viết nhận con trỏ (bàn phím bật) — chỉ khi bấm nút Bình luận; chạm "N bình luận" chỉ để ĐỌC
  const [vietNgay, setVietNgay] = useState(false);
  const moBinhLuan = (viet: boolean) => {
    onRead?.(post);
    setVietNgay(viet);
    setMoBL(true);
  };
  /**
   * Hàng chân kiểu FB — dùng ở thẻ VÀ ở đáy trình xem ảnh (`dongXem` có ⇒ nền tối: chữ trắng; Bình luận / Chia sẻ
   * đóng trình xem rồi mới mở, khỏi chồng bảng lên ảnh).
   */
  const hangChan = (dongXem?: (sau?: () => void) => void) => {
    const mau = dongXem ? "text-white/90" : "text-foreground/75";
    const nhanBL = `${NHAN.binhLuan}${post.commentCount ? `, ${post.commentCount}` : ""}`;
    const soBL = post.commentCount > 0 && <span className="tabular-nums">{countLabel(post.commentCount)}</span>;
    return (
      <>
        <NutCamXuc
          my={post.myCamXuc ?? (post.hayByMe ? "hay" : null)}
          disabled={!actions.onHay}
          onChon={(k) => actions.onHay?.(post, k)}
          dem={post.hayCount}
          toi={!!dongXem}
          className={btn}
        />
        {dongXem ? (
          <button
            type="button"
            aria-label={nhanBL}
            onClick={() => dongXem(inline ? () => moBinhLuan(post.commentCount === 0) : inDetail ? undefined : () => router.push(detail))}
            className={`${btn} ${mau}`}
          >
            <CommentIcon className="h-5 w-5" />
            {soBL}
          </button>
        ) : inline ? (
          <button
            type="button"
            aria-expanded={moBL}
            aria-label={nhanBL}
            onClick={() => (moBL ? setMoBL(false) : moBinhLuan(post.commentCount === 0))}
            className={`${btn} ${moBL ? "text-sea" : mau}`}
          >
            <CommentIcon className="h-5 w-5" />
            {soBL}
          </button>
        ) : (
          <Link href={detail} onClick={() => onRead?.(post)} aria-label={nhanBL} className={`${btn} ${mau}`}>
            <CommentIcon className="h-5 w-5" />
            {soBL}
          </Link>
        )}
        <button
          type="button"
          disabled={!actions.onShare}
          aria-label={NHAN.chiaSe}
          onClick={() => (dongXem ? dongXem(() => actions.onShare?.(post)) : actions.onShare?.(post))}
          className={`${btn} ${mau} disabled:active:scale-100`}
        >
          <ShareIcon className="h-5 w-5" />
        </button>
        {post.hayCount > 0 && (
          <span className="ml-auto pr-2">
            <DongCamXuc camXuc={post.camXuc} tong={post.hayCount} chiBieuTuong />
          </span>
        )}
      </>
    );
  };

  /** Đáy trình xem ảnh kiểu FB: tên người đăng + giờ, rồi hàng chân. */
  const chanXemAnh = (dongXem: (sau?: () => void) => void) => (
    <div className="px-2">
      <p className="truncate px-2 text-[1rem] font-bold">
        {post.author?.handle ?? (post.kind === "chinh-thuc" ? "SDVICO" : "")}
        {(post.kind === "chinh-thuc" || post.author?.official) && <span className="ml-1.5 text-[0.8125rem] font-semibold text-white/80">{NHAN.chinhThuc}</span>}
      </p>
      <p className="px-2 text-[0.8125rem] text-white/70">{postTimeLabel(post.publishedAt, now)}</p>
      <div className="mt-1 flex items-center gap-1">{hangChan(dongXem)}</div>
    </div>
  );

  const onMore = actions.onMore ? (anchor: HTMLElement) => actions.onMore?.(post, anchor) : undefined;
  const khoiBL = useRef<HTMLDivElement>(null);
  // Mở khối bình luận ⇒ đưa đầu khối vào tầm, chừa đáy = dock + ô viết (scroll-mb); ô viết dính đáy trong khối
  // tự lo phần còn lại. Không cuộn lần hai khi khối tải xong (bài sẽ nhảy).
  useEffect(() => {
    if (moBL) khoiBL.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [moBL]);
  // KHÔNG `overflow-hidden`: ô viết bình luận sticky cần thẻ không phải khung cuộn (K3-01); con nào chạm góc tự bo
  return (
    <article className="surface" aria-label={post.kind === "bao" ? post.title ?? "Bài báo" : "Bài đăng"}>
      <Head post={post} now={now} benPort={benPort} onMore={onMore} />

      {post.kind === "bao" ? (
        <>
          {(post.summary || post.body) && (
            <div className="px-4 pb-2">
              <ChuXemThem text={(post.summary || post.body) ?? ""} dong={inDetail ? 8 : 4} className="text-[1rem] leading-relaxed" />
            </div>
          )}
          <TheBao post={post} onRead={onRead} notify={actions.binhLuan?.notify} />
          <DinhKemList post={post} notify={actions.binhLuan?.notify} />
          {/* CHỈ bài có danh sách tàu cá / bà con đọc được (máy chủ đếm dòng 0075 ⇒ coDanhSach) mới có ô tra + tự so tàu
              trong sổ (14 §21b; anh Long 2026-10-26: "cái nào có danh sách tàu cá hay danh sách bà con thì mới tra cứu") */}
          {post.topic === "chinh-sach" && post.coDanhSach && <TraCuuDanhSach post={post} notify={actions.binhLuan?.notify} />}
        </>
      ) : (
        <>
          <Body text={post.body} nhac={post.mentions} />
          <Images urls={post.images} count={post.imageCount ?? post.images.length} chan={chanXemAnh} />
          <Reshare post={post} now={now} benPort={benPort} />
        </>
      )}

      {/*  CHÂN THẺ KIỂU FACEBOOK MỚI (mẫu anh Long gửi 2026-10-24): MỘT hàng — cảm xúc + số · bình luận + số · chia sẻ,
          cụm biểu tượng cảm xúc nhiều nhất bên phải. Chạm số bình luận = mở đọc (không bật bàn phím); chạm lại = gập. */}
      <div className="flex items-center gap-1 border-t border-line px-2 py-1">{hangChan()}</div>

      {inline && moBL && actions.binhLuan && (
        <div ref={khoiBL} className="scroll-mb-[calc(var(--dock-total)+7rem)] border-t border-line px-4 pt-3">
          <CommentThread post={post} initial={post.topComments} kit={actions.binhLuan} now={now} autoFocus={vietNgay} />
        </div>
      )}

      {!inDetail && !moBL && (post.topComments.length > 0 || post.commentCount > post.topComments.length) && (
        <div className="space-y-2 px-4 pb-3">
          {post.topComments.length > 0 && (
            <ul className="space-y-2">
              {post.topComments.map((c) => (
                <TopComment key={c.id} c={c} />
              ))}
            </ul>
          )}
          {/* còn bình luận ngoài 2 bình luận nổi ⇒ lối mở ĐỌC (không bật bàn phím — A98) */}
          {post.commentCount > post.topComments.length &&
            (inline ? (
              <button type="button" onClick={() => moBinhLuan(false)} className="flex h-9 items-center text-[0.875rem] font-semibold text-foreground/65">
                Xem thêm bình luận
              </button>
            ) : (
              <Link href={detail} onClick={() => onRead?.(post)} className="flex h-9 items-center text-[0.875rem] font-semibold text-foreground/65">
                Xem thêm bình luận
              </Link>
            ))}
        </div>
      )}
    </article>
  );
}

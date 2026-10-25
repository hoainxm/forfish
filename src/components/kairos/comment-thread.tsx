"use client";

/*
  KHỐI BÌNH LUẬN DÙNG CHUNG (14 §3.4, AC09 · AC10 · AC15) — INLINE NGAY DƯỚI THẺ BÀI như Facebook (anh Long
  2026-10-24: "thao tác bình luận các kiểu giống fb, inline chứ đừng nhảy ra tab khác") và ở /kairos/p/[id].

   · Trả lời 1 cấp: trả lời một trả lời ⇒ gắn vào bình luận gốc kèm "@tên" — KHÔNG chèn vào ô (viên
     "Trả lời …" + × nói thay), chỉ ghép lúc gửi (social.ghepTraLoi). Đổi người trả lời / huỷ giữ chữ.
   · Luồng ≥2 trả lời gập thành "Xem N phản hồi" (social.traLoiHien); `#bl-<id>` hoặc mình vừa trả lời ⇒ bung.
   · `dinhDay` (trang chi tiết): ô viết dính đáy trên dock, bàn phím mở thì dịch lên theo use-vung-nhin.
   · Hay lạc quan + hoàn tác; xoá của mình (xác nhận tại chỗ); báo xấu của người khác.
   · Ô viết dạng viên (như FB): chữ + nút gửi; Enter xuống dòng (bàn phím điện thoại), bấm nút mới gửi.
   · Nháp theo bài `forfish.kairos.nhap.v1` khoá `bl:<id>` — mất sóng vẫn giữ chữ, KHÔNG tự gửi khi có sóng lại.
   · Bình luận nhanh (14 §15): ô trống ⇒ hàng câu có sẵn (Cảm ơn · Đúng rồi…) một chạm là gửi; nút micro
     nói để viết — chữ nghe được ĐIỀN vào ô, bà con xem lại rồi mới bấm gửi.
   · `initialNext === undefined` ⇒ tự tải trang bình luận đầu (dùng ở thẻ dòng tin: thẻ chỉ mang 2 bình luận nổi).
   · Ảnh + link kiểu FB (0070): nút ảnh trong ô viết (≤1 ảnh, nén như ảnh bài, tải lên khi CHỌN; bỏ ảnh ⇒ xoá khỏi
     kho), chạm ảnh ⇒ trình xem toàn màn; link trong chữ ⇒ thẻ xem trước máy chủ đã đọc lúc ghi. Ảnh KHÔNG vào
     nháp (nháp chỉ chữ). `#bl-<id>` ⇒ cuộn tới bình luận đó khi đã tải.
*/

import { chonCamXuc, chotCamXuc, type CamXuc, type CamXucState } from "@/lib/kairos/cam-xuc";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { CloseIcon, ImageIcon, SendIcon } from "@/components/icons";
import { resizeForMarket } from "@/lib/market/image-resize";
import { draftKey } from "@/lib/kairos/cache";
import { countLabel, postTimeLabel } from "@/lib/kairos/feed-client";
import { LIMITS, type KairosComment, type KairosPost } from "@/lib/kairos/types";
import { charLen } from "@/lib/kairos/validate";
import {
  bocTienTo,
  discardUploads,
  dropComment,
  errorText,
  ghepTraLoi,
  kairosSend,
  kairosUpload,
  loadDraft,
  replyTarget,
  saveDraft,
  threadComments,
  traLoiHien,
} from "@/lib/kairos/write-client";
import { NHAN } from "@/lib/labels";
import { useAuthUser } from "@/lib/use-auth";
import { useOnline } from "@/lib/use-online";
import { ChuXemThem } from "./chu-xem-them";
import { DongCamXuc, NutCamXuc } from "./nut-cam-xuc";
import { KairosAvatar } from "./kairos-avatar";
import { RulesBox } from "./rules-box";
import { NutMic } from "./de-dung";
import { BL_NHANH } from "@/lib/kairos/de-dung";
import { useVungNhin } from "./use-vung-nhin";
import { useNhacTen, type NguoiNhac } from "./nhac-ten-o-viet";
import { XemAnh } from "./xem-anh";
import { laNoiBo, type LinkPreview } from "@/lib/kairos/types";

/** Thẻ xem trước link (máy chủ đã đọc lúc ghi) — ảnh trái, tên trang + tiêu đề phải; mở tab mới. */
export function TheLink({ l }: { l: LinkPreview }) {
  const [hong, setHong] = useState(false);
  // THẺ NỘI BỘ (SDVICO trực khách, 14 §3.14): mở NGAY trong app, ảnh sản phẩm to phía trên + nút hành động
  if (laNoiBo(l.url))
    return (
      <Link href={l.url} onClick={(e) => e.stopPropagation()} className="mt-1 block max-w-[16rem] overflow-hidden rounded-xl border border-line bg-card">
        {l.image && !hong && (
          // eslint-disable-next-line @next/next/no-img-element -- ảnh sản phẩm tĩnh /sdvico (public)
          <img src={l.image} alt="" loading="lazy" onError={() => setHong(true)} className="aspect-[4/3] w-full bg-white object-contain" />
        )}
        <span className="flex flex-col gap-0.5 px-3 py-2">
          <span className="text-[0.75rem] text-foreground/65">{l.site}</span>
          <span className="line-clamp-2 text-[0.875rem] font-semibold leading-snug text-navy">{l.title}</span>
          <span className="mt-1 flex h-9 items-center justify-center rounded-lg bg-sea text-[0.875rem] font-semibold text-white">Để lại thông tin</span>
        </span>
      </Link>
    );
  return (
    <a
      href={l.url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="mt-1 flex max-w-[20rem] overflow-hidden rounded-xl border border-line bg-card"
    >
      {l.image && !hong && (
        // eslint-disable-next-line @next/next/no-img-element -- ảnh trang ngoài, không qua next/image
        <img src={l.image} alt="" loading="lazy" onError={() => setHong(true)} className="h-20 w-20 shrink-0 object-cover" />
      )}
      <span className="flex min-w-0 flex-col justify-center gap-0.5 px-3 py-2">
        <span className="truncate text-[0.75rem] text-foreground/65">{l.site}</span>
        <span className="line-clamp-2 text-[0.875rem] font-semibold leading-snug text-navy">{l.title}</span>
      </span>
    </a>
  );
}

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
  onHay: (c: KairosComment, kind?: CamXuc) => void;
  onReply: (c: KairosComment) => void;
  onDelete: (c: KairosComment) => Promise<boolean>;
  onReport: (c: KairosComment) => void;
}) {
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [xem, setXem] = useState(false);
  const [anhHong, setAnhHong] = useState(false);
  const small = "h-9 px-2 text-[0.8125rem] font-semibold";
  return (
    <li id={`bl-${c.id}`} className={`flex scroll-mt-20 gap-2 ${reply ? "pl-10" : ""}`}>
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
          {c.body ? (
            <ChuXemThem text={c.body} dong={8} nen="field" nhac={c.mentions} className="text-[1rem]" />
          ) : (
            !c.image && <p className="text-[1rem] text-foreground/65">Đã gửi một ảnh</p>
          )}
        </div>
        {c.image && (
          <button type="button" onClick={() => setXem(true)} aria-label="Xem ảnh bình luận" className="mt-1 block overflow-hidden rounded-2xl">
            {anhHong ? (
              <span className="flex h-24 w-40 items-center justify-center bg-field text-[0.8125rem] text-foreground/65">Cần sóng để xem ảnh</span>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- ảnh kho kairos-media, cùng cách thẻ bài
              <img src={c.image} alt="" loading="lazy" onError={() => setAnhHong(true)} className="max-h-60 max-w-[15rem] object-cover" />
            )}
          </button>
        )}
        {xem && c.image && <XemAnh urls={[c.image]} start={0} onClose={() => setXem(false)} />}
        {c.link && <TheLink l={c.link} />}
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
            <NutCamXuc nho my={c.myCamXuc ?? (c.hayByMe ? "hay" : null)} onChon={(k) => onHay(c, k)} className={`${small} flex items-center gap-1`} />
            {c.hayCount > 0 && <DongCamXuc nho camXuc={c.camXuc} tong={c.hayCount} />}
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
  dinhDay = false,
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
  /** trang chi tiết bài: ô viết dính đáy màn (trên dock / trên bàn phím) như Facebook */
  dinhDay?: boolean;
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
  /** `sau` = đang trả lời MỘT TRẢ LỜI (lúc gửi mới ghép "@tên ") */
  const [replyTo, setReplyTo] = useState<{ parentId: string; handle: string; sau: boolean } | null>(null);
  /** id gốc các luồng đang bung "Xem N phản hồi" */
  const [mo, setMo] = useState<Set<string>>(() => new Set());
  const [troToi, setTroToi] = useState<string | null>(null);
  const vung = useVungNhin();
  /** nháp cũ (bản chèn "@tên " vào ô) chờ bóc khi biết tên trong luồng */
  const bocRef = useRef(false);
  const [sending, setSending] = useState(false);
  const [sendErr, setSendErr] = useState("");
  const [needRules, setNeedRules] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);
  /** ảnh đính kèm đang chờ gửi (đã tải lên kho) */
  const [anh, setAnh] = useState<{ url: string; path: string } | null>(null);
  const [anhBusy, setAnhBusy] = useState(false);
  const chonAnh = useRef<HTMLInputElement>(null);
  const daCuon = useRef(false);
  const hayBusy = useRef(new Set<string>());

  useEffect(() => {
    const t = loadDraft(phone, dKey);
    bocRef.current = t.startsWith("@");
    setText(t);
  }, [phone, dKey]);

  // Nháp cũ lỡ mở đầu bằng "@tên " ⇒ bóc khi danh sách có tên đó (chỉ một lần, bà con gõ là thôi).
  useEffect(() => {
    if (!bocRef.current || !comments.length) return;
    const t = bocTienTo(text, comments.map((c) => c.author.handle));
    if (t === text) return;
    bocRef.current = false;
    setText(t);
    setDraftFail(!saveDraft(phone, dKey, t));
  }, [comments, text, phone, dKey]);

  // Thông báo trỏ tới `#bl-<id>` ⇒ bung luồng chứa nó.
  useEffect(() => {
    const h = window.location.hash;
    if (h.startsWith("#bl-")) setTroToi(decodeURIComponent(h.slice(4)));
  }, []);
  // …và cuộn tới nó một lần khi đã có trong danh sách (luồng vừa bung ở lượt vẽ này).
  useEffect(() => {
    if (!troToi || daCuon.current || !comments.some((c) => c.id === troToi)) return;
    daCuon.current = true;
    // Ảnh bài phía trên tải sau đẩy bình luận xuống (lúc đầu trang còn ngắn, cuộn không tới) ⇒ canh lại
    // mỗi lần trang đổi cao trong 2,5 s đầu; bà con tự chạm/cuộn là thôi.
    const go = () => document.getElementById(`bl-${troToi}`)?.scrollIntoView({ block: "center" });
    let thoi = false;
    const dung = () => {
      thoi = true;
    };
    // hẹn giờ thường (không rAF: rAF đứng khi trang chưa hiện) + mốc phòng khi ResizeObserver không có
    for (const ms of [60, 400, 1200]) setTimeout(() => !thoi && go(), ms);
    window.addEventListener("touchstart", dung, { once: true, passive: true });
    window.addEventListener("wheel", dung, { once: true, passive: true });
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => !thoi && go());
    ro?.observe(document.body);
    setTimeout(() => {
      ro?.disconnect();
      window.removeEventListener("touchstart", dung);
      window.removeEventListener("wheel", dung);
    }, 2500);
  }, [troToi, comments]);
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
    bocRef.current = false;
    setText(v);
    setSendErr("");
    setDraftFail(!saveDraft(phone, dKey, v));
  };

  // người trong bài để gợi ý "@" trước (chủ bài + người đã bình luận, trừ mình) — có sẵn, không mạng
  const quen: NguoiNhac[] = [];
  for (const a of [post.author, ...comments.filter((c) => !c.mine).map((c) => c.author)]) {
    if (a?.profileId && !quen.some((x) => x.id === a.profileId)) quen.push({ id: a.profileId, ten: a.handle, avatarUrl: a.avatarUrl, isAgent: a.isAgent });
  }
  const nt = useNhacTen({ text, setText: onText, box, quen, nguoc: true });

  /** Chỉ đổi người đang trả lời — chữ đang gõ giữ nguyên, không chèn "@tên" vào ô. */
  const startReply = (c: KairosComment) => {
    const t = replyTarget(c);
    setReplyTo({ parentId: t.parentId, handle: c.author.handle, sau: !!t.prefix });
    box.current?.focus();
  };

  const len = charLen(text.trim());
  const left = LIMITS.commentBody - len;
  const canSend = online && signedIn && canWrite && !sending && !anhBusy && (len > 0 || !!anh) && left >= 0 && !needRules;
  const canQuick = online && signedIn && canWrite && !sending && !needRules;

  const layAnh = async (f: File | undefined) => {
    if (!f) return;
    setAnhBusy(true);
    setSendErr("");
    try {
      const r = await kairosUpload(await resizeForMarket(f));
      if (!r.ok) {
        if (r.code === "rules") setNeedRules(true);
        setSendErr(r.offline ? "Cần sóng để gửi ảnh." : errorText(r, "anh"));
        return;
      }
      if (anh) void discardUploads([anh.path]);
      setAnh({ url: r.data.url, path: r.data.path });
    } catch {
      setSendErr("Ảnh này không đọc được — chọn ảnh khác.");
    } finally {
      setAnhBusy(false);
    }
  };

  const boAnh = () => {
    if (anh) void discardUploads([anh.path]);
    setAnh(null);
  };

  /** `nhanh` = câu bình luận nhanh (gửi thẳng, không qua ô); không có ⇒ gửi chữ trong ô. */
  const send = async (nhanh?: string) => {
    if (nhanh ? !canQuick : !canSend) return;
    setSending(true);
    setSendErr("");
    const r = await kairosSend<{ comment: KairosComment; kem?: KairosComment }>("POST", `/api/kairos/posts/${encodeURIComponent(id)}/comments`, {
      body: (nhanh ?? text).trim() ? ghepTraLoi(nhanh ?? text, replyTo, !!replyTo?.sau) : "",
      parentId: replyTo?.parentId ?? null,
      ...(!nhanh && anh ? { image: anh.path } : {}),
      ...(!nhanh && nt.nhac.length ? { mentions: nt.nhac.map((m) => m.id) } : {}),
    });
    setSending(false);
    if (!r.ok) {
      if (r.code === "rules") setNeedRules(true);
      setSendErr(errorText(r, "binh-luan"));
      return;
    }
    // `kem` = SDVICO trực khách trả lời ngay (14 §3.14) — hiện liền, bung luồng chứa nó
    const kem = r.data.kem;
    setComments((cur) => [...cur, r.data.comment, ...(kem ? [kem] : [])]);
    const goc = replyTo?.parentId ?? (kem ? kem.parentId : null);
    if (goc) setMo((m) => (m.has(goc) ? m : new Set(m).add(goc)));
    kit.patch(id, { commentCount: post.commentCount + (kem ? 2 : 1) });
    if (!nhanh) {
      setText("");
      saveDraft(phone, dKey, "");
      setAnh(null);
      nt.xoa();
    }
    setReplyTo(null);
  };

  const hayComment = async (c: KairosComment, kind: CamXuc = "hay") => {
    if (!signedIn) {
      kit.notify("Đăng nhập để bày tỏ cảm xúc.", true);
      return;
    }
    if (hayBusy.current.has(c.id)) return;
    hayBusy.current.add(c.id);
    const before: CamXucState = { myCamXuc: c.myCamXuc ?? (c.hayByMe ? "hay" : null), hayCount: c.hayCount, camXuc: c.camXuc ?? [] };
    const set = (s: CamXucState) => setComments((cur) => cur.map((x) => (x.id === c.id ? { ...x, ...s, hayByMe: !!s.myCamXuc } : x)));
    const next = chonCamXuc(before, kind);
    set(next);
    const r = await kairosSend<{ on: boolean; kind?: string | null; hayCount: number; camXuc?: Record<string, number> }>(
      "PUT",
      `/api/kairos/comments/${c.id}/hay`,
      next.myCamXuc ? { on: true, kind: next.myCamXuc } : { on: false },
    );
    hayBusy.current.delete(c.id);
    set(chotCamXuc(before, r));
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
  const toi = comments.find((c) => c.mine)?.author ?? null;
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
                {traLoiHien(t, mo, troToi).map((r) => (
                  <CommentRow key={r.id} c={r} now={now} reply onHay={hayComment} onReply={startReply} onDelete={deleteComment} onReport={report} />
                ))}
                {traLoiHien(t, mo, troToi).length < t.replies.length && (
                  <li className="pl-10">
                    <button
                      type="button"
                      onClick={() => setMo((m) => new Set(m).add(t.root.id))}
                      className="flex h-11 items-center gap-2 rounded-lg pr-2 text-[0.8125rem] font-semibold text-foreground/75"
                    >
                      <KairosAvatar
                        id={t.replies[t.replies.length - 1].author.profileId || t.replies[t.replies.length - 1].id}
                        name={t.replies[t.replies.length - 1].author.handle}
                        url={t.replies[t.replies.length - 1].author.avatarUrl}
                        small
                      />
                      {`Xem ${countLabel(t.replies.length)} phản hồi`}
                    </button>
                  </li>
                )}
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
        <>
          {needRules && (
            <div className="mb-3">
              <RulesBox onAccepted={() => setNeedRules(false)} />
            </div>
          )}
          {/* Thanh viết là con TRỰC TIẾP của khối gốc (bao cả danh sách bình luận): sticky chỉ dính
              trong khối cha, bọc thêm <div> riêng là nó đứng yên ở cuối (lỗi vòng kiểm 2026-10-24). */}
          <div
            className={dinhDay ? "sticky z-10 -mx-4 border-t border-line bg-card px-4 pb-2 pt-2" : ""}
            // trên dock nổi — --dock-total đã gồm safe-area đáy (--dock-safe), không cộng env() lần hai;
            // bàn phím mở (vùng nhìn thấy < innerHeight) ⇒ đứng ngay trên bàn phím
            style={dinhDay ? { bottom: vung && vung.ban > 0 ? vung.ban : "var(--dock-total)" } : undefined}
          >
            {replyTo && (
              <div className="mb-1 flex items-center gap-1 pl-10 text-[0.8125rem]">
                <span className="min-w-0 truncate text-foreground/65">
                  Trả lời <span className="font-semibold text-navy">{replyTo.handle}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setReplyTo(null)}
                  aria-label="Huỷ trả lời"
                  className="-m-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-foreground/65"
                >
                  <CloseIcon className="h-4 w-4" />
                </button>
              </div>
            )}
            {anh && (
              <div className="relative mb-2 ml-12 inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element -- ảnh vừa tải lên kho */}
                <img src={anh.url} alt="Ảnh sẽ gửi kèm" className="h-24 w-24 rounded-xl object-cover" />
                <button
                  type="button"
                  onClick={boAnh}
                  aria-label="Bỏ ảnh"
                  className="absolute -right-3 -top-3 flex h-11 w-11 items-center justify-center"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-navy text-white">
                    <CloseIcon className="h-3.5 w-3.5" />
                  </span>
                </button>
              </div>
            )}
            {nt.danhSach}
            {!text.trim() && !anh && canQuick && (
              <div className="mb-2 flex gap-2 overflow-x-auto" role="group" aria-label="Bình luận nhanh">
                {BL_NHANH.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => void send(c)}
                    className="h-9 shrink-0 rounded-full border border-line px-3 text-[0.875rem] font-semibold text-navy transition active:scale-[0.97]"
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-end gap-2">
              {/* avatar của mình — chỉ từ dữ liệu sẵn có (bình luận của mình trong luồng), không gọi thêm mạng */}
              <span className="flex h-11 shrink-0 items-center">
                <KairosAvatar id={toi?.profileId || "toi"} name={toi?.handle || "Tôi"} url={toi?.avatarUrl ?? null} small />
              </span>
              <label htmlFor={`kairos-bl-${id}`} className="sr-only">
                Viết bình luận
              </label>
              <textarea
                id={`kairos-bl-${id}`}
                ref={box}
                rows={1}
                value={text}
                onChange={(e) => {
                  onText(e.target.value);
                  nt.theoDoi(e.target.value, e.target.selectionStart);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape" && nt.mo) {
                    e.stopPropagation();
                    nt.dong();
                  }
                }}
                placeholder={toi?.handle ? `Bình luận với tên ${toi.handle}` : "Viết bình luận…"}
                className="max-h-32 min-h-11 flex-1 resize-none rounded-3xl border border-line bg-field px-4 py-2.5 text-[1rem] leading-snug outline-none focus-visible:ring-2 focus-visible:ring-sea"
              />
              <input
                ref={chonAnh}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  void layAnh(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => chonAnh.current?.click()}
                disabled={!online || !canWrite || sending || anhBusy || needRules}
                aria-busy={anhBusy}
                aria-label={anh ? "Đổi ảnh" : "Gửi ảnh"}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-foreground/65 disabled:opacity-40"
              >
                <ImageIcon className="h-6 w-6" />
              </button>
              <NutMic
                disabled={sending}
                onChu={(t) => {
                  onText(text.trim() ? `${text.trimEnd()} ${t}` : t);
                  box.current?.focus();
                }}
                onLoi={(t) => setSendErr(t)}
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
        </>
      )}
    </div>
  );
}

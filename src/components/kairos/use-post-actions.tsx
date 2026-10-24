"use client";

/*
  HÀNH VI TRÊN THẺ BÀI — một chỗ cho mọi màn Kairos (dòng tin, Bến, trang người dùng, chi tiết).
  Trả `actions` cho PostCard + `view()` áp thay đổi lên danh sách màn đang giữ + `ui` (các
  bảng/hộp) + `compose()` mở khung soạn.

   · Hay (AC09): LẠC QUAN — đếm đổi ngay, máy chủ trả số thật; hỏng ⇒ trả về như trước bấm +
     câu lỗi thật. Bấm lại khi lượt trước chưa về ⇒ bỏ qua (chống bấm trùng; DB có PK cặp).
   · Ba chấm: bài mình ⇒ Sửa / Xoá (xác nhận; xoá luôn ảnh kho — máy chủ lo); bài người khác
     ⇒ Báo xấu / Chặn (xác nhận). Bài báo ⇒ Báo xấu.
   · Chặn ⇒ ẩn NGAY mọi bài của người đó trên màn, cả 2 bình luận nổi của họ dưới bài người
     khác và thẻ bài gốc của họ trong bài đăng lại (social.hideBlocked; máy chủ lọc từ lần tải sau).
   · Chia sẻ ⇒ ShareSheet; Đăng lại ⇒ khung soạn kiểu `reshare`.
  KHÔNG gửi ngầm: mọi request đi từ một cú bấm.
*/

import { useCallback, useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import type { KairosPost } from "@/lib/kairos/types";
import { errorText, flipHay, hideBlocked, kairosSend, settleHay, type HayState } from "@/lib/kairos/write-client";
import { NHAN } from "@/lib/labels";
import { useAuthUser } from "@/lib/use-auth";
import { ComposerSheet, type ComposeMode } from "./composer-sheet";
import type { PostActions } from "./post-card";
import { ReportSheet } from "./report-sheet";
import { ShareSheet } from "./share-sheet";

type Notice = { text: string; bad?: boolean } | null;

export function usePostActions(opts: { onDeleted?: (id: string) => void; onPosted?: (p: KairosPost) => void } = {}) {
  const { signedIn } = useAuthUser();
  const [over, setOver] = useState<Record<string, Partial<KairosPost>>>({});
  const [removed, setRemoved] = useState<Set<string>>(() => new Set());
  const [blockedAuthors, setBlockedAuthors] = useState<Set<string>>(() => new Set());
  const [added, setAdded] = useState<KairosPost[]>([]);
  const [compose, setCompose] = useState<ComposeMode | null>(null);
  const [share, setShare] = useState<KairosPost | null>(null);
  const [more, setMore] = useState<KairosPost | null>(null);
  const [report, setReport] = useState<{ type: "post" | "comment"; id: string } | null>(null);
  const [confirmDel, setConfirmDel] = useState<KairosPost | null>(null);
  const [confirmBlock, setConfirmBlock] = useState<KairosPost | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const inflight = useRef(new Set<string>());
  const optsRef = useRef(opts);
  useEffect(() => {
    optsRef.current = opts;
  });

  // Thông báo nhỏ tự tắt sau 5 s (không chặn màn).
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(t);
  }, [notice]);

  const patch = useCallback((id: string, p: Partial<KairosPost>) => setOver((o) => ({ ...o, [id]: { ...o[id], ...p } })), []);

  const onHay = useCallback(
    async (p: KairosPost) => {
      if (!signedIn) {
        setNotice({ text: "Đăng nhập để bấm Hay.", bad: true });
        return;
      }
      if (inflight.current.has(p.id)) return;
      inflight.current.add(p.id);
      const before: HayState = { hayByMe: p.hayByMe, hayCount: p.hayCount };
      const next = flipHay(before);
      patch(p.id, next);
      const r = await kairosSend<{ on: boolean; hayCount: number }>("PUT", `/api/kairos/posts/${p.id}/hay`, { on: next.hayByMe });
      inflight.current.delete(p.id);
      patch(p.id, settleHay(before, r));
      if (!r.ok) setNotice({ text: errorText(r, "hay"), bad: true });
    },
    [signedIn, patch],
  );

  const actions: PostActions = {
    // bình luận INLINE dưới thẻ (comment-thread) — cùng hộp báo, hộp báo xấu, sửa số đếm với màn này
    binhLuan: {
      notify: (text, bad = false) => setNotice({ text, bad }),
      report: (t) => (needLogin("báo xấu") ? undefined : setReport(t)),
      patch,
    },
    onHay: (p) => void onHay(p),
    onShare: (p) => setShare(p),
    onMore: (p) => setMore(p),
  };

  /** Áp thay đổi cục bộ (Hay, sửa, xoá, chặn) lên danh sách màn đang giữ. */
  const view = useCallback(
    (list: readonly KairosPost[]) =>
      hideBlocked(
        list.filter((p) => !removed.has(p.id)).map((p) => (over[p.id] ? { ...p, ...over[p.id] } : p)),
        blockedAuthors,
      ),
    [over, removed, blockedAuthors],
  );

  const doDelete = async (p: KairosPost) => {
    setNotice({ text: "Đang xoá…" });
    const r = await kairosSend("DELETE", `/api/kairos/posts/${p.id}`);
    if (!r.ok) {
      setNotice({ text: errorText(r, "xoa"), bad: true });
      return;
    }
    setRemoved((s) => new Set(s).add(p.id));
    setAdded((a) => a.filter((x) => x.id !== p.id));
    setNotice({ text: "Đã xoá bài và ảnh." });
    optsRef.current.onDeleted?.(p.id);
  };

  const doBlock = async (p: KairosPost) => {
    const pid = p.author?.profileId;
    if (!pid) return;
    setNotice({ text: "Đang chặn…" });
    const r = await kairosSend("PUT", `/api/kairos/blocks/${pid}`);
    if (!r.ok) {
      setNotice({ text: errorText(r, "chan"), bad: true });
      return;
    }
    setBlockedAuthors((s) => new Set(s).add(pid));
    setNotice({ text: `Đã chặn ${p.author?.handle ?? "người này"}. Bỏ chặn ở trang của họ.` });
  };

  const onDone = (post: KairosPost) => {
    const mode = compose;
    setCompose(null);
    if (mode?.kind === "edit") {
      patch(post.id, post);
      setNotice({ text: "Đã lưu bài." });
    } else {
      setAdded((a) => [post, ...a.filter((x) => x.id !== post.id)]);
      setNotice({ text: mode?.kind === "reshare" ? "Đã đăng lại." : "Đã đăng." });
      optsRef.current.onPosted?.(post);
    }
  };

  const needLogin = (what: string) => {
    if (signedIn) return false;
    setMore(null);
    setNotice({ text: `Đăng nhập để ${what}.`, bad: true });
    return true;
  };

  const sheetBtn = "flex min-h-14 w-full items-center rounded-xl px-3 text-left text-[1rem] font-semibold active:bg-field";
  const ui = (
    <>
      {compose && <ComposerSheet mode={compose} onClose={() => setCompose(null)} onDone={onDone} />}
      {share && (
        <ShareSheet
          post={share}
          onClose={() => setShare(null)}
          onReshare={(p) => {
            setShare(null);
            setCompose({ kind: "reshare", post: p.reshareOf && !p.reshareGone ? p.reshareOf : p });
          }}
        />
      )}
      {more && (
        <BottomSheet title="Thêm việc" onClose={() => setMore(null)}>
          <div className="divide-y divide-line">
            {more.mine ? (
              <>
                <button type="button" className={`${sheetBtn} text-navy`} onClick={() => (setCompose({ kind: "edit", post: more }), setMore(null))}>
                  {NHAN.sua}
                </button>
                <button type="button" className={`${sheetBtn} text-danger`} onClick={() => (setConfirmDel(more), setMore(null))}>
                  {NHAN.xoa}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className={`${sheetBtn} text-danger`}
                  onClick={() => {
                    if (needLogin("báo xấu")) return;
                    setReport({ type: "post", id: more.id });
                    setMore(null);
                  }}
                >
                  {NHAN.baoXau}
                </button>
                {more.kind === "ba-con" && more.author && !more.author.official && (
                  <button
                    type="button"
                    className={`${sheetBtn} text-navy`}
                    onClick={() => {
                      if (needLogin("chặn")) return;
                      setConfirmBlock(more);
                      setMore(null);
                    }}
                  >
                    {NHAN.chan} {more.author.handle}
                  </button>
                )}
              </>
            )}
          </div>
        </BottomSheet>
      )}
      {report && <ReportSheet target={report} onClose={() => setReport(null)} />}
      {confirmDel && (
        <ConfirmDialog
          title="Xoá bài này?"
          message="Xoá luôn ảnh, bình luận và Hay của bài. Không lấy lại được."
          confirmLabel={NHAN.xoa}
          onCancel={() => setConfirmDel(null)}
          onConfirm={() => {
            const p = confirmDel;
            setConfirmDel(null);
            void doDelete(p);
          }}
        />
      )}
      {confirmBlock && (
        <ConfirmDialog
          title={`Chặn ${confirmBlock.author?.handle ?? "người này"}?`}
          message="Bạn sẽ không thấy bài và bình luận của họ nữa. Hai bên tự bỏ theo dõi nhau."
          confirmLabel={NHAN.chan}
          onCancel={() => setConfirmBlock(null)}
          onConfirm={() => {
            const p = confirmBlock;
            setConfirmBlock(null);
            void doBlock(p);
          }}
        />
      )}
      {notice && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-40 flex justify-center px-4">
          <p
            role="status"
            className={`pointer-events-auto max-w-(--w-app) rounded-2xl px-4 py-3 text-[1rem] font-semibold shadow-md ${
              notice.bad ? "bg-danger-bg text-danger" : "bg-navy text-white"
            }`}
          >
            {notice.text}
          </p>
        </div>
      )}
    </>
  );

  return {
    actions,
    view,
    /** bài mình vừa đăng ở màn này — hiện trên đầu dòng tin (máy chủ có từ lần tải sau) */
    added: view(added),
    ui,
    compose: (m: ComposeMode) => setCompose(m),
    report: (t: { type: "post" | "comment"; id: string }) => (needLogin("báo xấu") ? undefined : setReport(t)),
    notify: (text: string, bad = false) => setNotice({ text, bad }),
    patch,
  };
}

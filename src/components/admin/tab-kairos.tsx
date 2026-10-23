"use client";

/*
  TAB "Kairos" của /quan-tri — nhóm Nội dung (14 §3.11, AC16/AC24).

  Năm mục: Báo xấu (gộp theo đích, nhiều lượt trước) · Hàng chờ (agent kiểm duyệt chặn/nghi,
  kèm lý do + điểm + phiên bản luật — người trực đảo lại) · Bài (tìm, Ẩn/Hiện bài + bình luận,
  Ghim bài Chính thức) · Chính thức (SDVICO đăng) · Cờ chủ quyền (chỉ xem + sức khoẻ máy thu tin).
  Dòng nhắc đầu tab khi quá 2 giờ không có bài báo mới (máy GPU tắt / hết hạn mức / khoá lệch).

  Quyền (staff-permissions, tab kairos): view = xem · edit = ẩn/hiện/ghim/xử lý/đảo quyết định ·
  delete = cấm SĐT · create = đăng Chính thức. Nút không có quyền thì KHÔNG hiện; máy chủ vẫn
  chặn lại (requirePermission). Mọi thao tác ghi nhật ký kairos_audit ở route (trước khi làm).
  Không có SĐT nào ở đây: người đăng = profileId + tên gọi.
*/

import { useCallback, useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ImagePicker } from "@/components/market/shared/image-picker";
import { inputClass } from "@/components/ui/primitives";
import { REPORT_REASON_TEXT } from "@/components/kairos/report-sheet";
import { fmtDT } from "@/components/admin/quan-tri-chung";
import { EmptyBox, ErrorBox, FilterChip, LoadingBox, ReasonDialog } from "@/components/admin/market-admin-shared";
import { timeoutSignal } from "@/lib/abort";
import { apiUrl } from "@/lib/api-base";
import { tokenHeader } from "@/lib/device-token-store";
import { newsStaleText } from "@/lib/kairos/admin-action";
import { mediaPathFromUrl } from "@/lib/kairos/social";
import { LIMITS, type KairosComment, type KairosPost, type ReportReason } from "@/lib/kairos/types";
import { kairosUpload } from "@/lib/kairos/write-client";
import { NHAN, NHAN_CHIP_KAIROS } from "@/lib/labels";
import { type TabPerms } from "@/lib/staff-permissions";

type AdminPost = KairosPost & { hidden: boolean; hiddenReason: string | null; modState: string; createdAt: string };
type AdminComment = KairosComment & { hidden: boolean; modState: string };
type Target = AdminPost | AdminComment;

type ReportGroup = {
  targetType: "post" | "comment"; targetId: string; count: number; reasons: Record<string, number>; notes: string[]; latestAt: string;
  target: Target | null;
};
type QueueItem = {
  decisionId: number; targetType: "post" | "comment"; targetId: string; verdict: "nghi" | "chan"; reason: string | null;
  score: number | null; rulesVersion: string | null; model: string | null; at: string; target: Target | null;
};
type Flag = { sourceId: string | null; titleNorm: string | null; term: string | null; at: string | null };
type SourceStat = { id: string; outlet: string; section: string; enabled: boolean; lastOkAt: string | null; lastError: string | null };

type Section = "bao-xau" | "hang-cho" | "bai" | "chinh-thuc" | "co";
const SECTIONS: [Section, string][] = [
  ["bao-xau", "Báo xấu"],
  ["hang-cho", "Hàng chờ"],
  ["bai", "Bài"],
  ["chinh-thuc", "Chính thức"],
  ["co", "Cờ chủ quyền"],
];

const READ_MS = 12_000;
const WRITE_MS = 20_000;

const CODE_TEXT: Record<string, string> = {
  login_required: "Phiên đăng nhập đã hết — đăng nhập lại.",
  staff_only: "Tài khoản này không có quyền quản trị.",
  no_permission: "Bạn chưa được cấp quyền làm việc này ở tab Kairos.",
  not_found: "Không tìm thấy — có thể vừa bị xoá.",
  unavailable: "Chưa tra được kho Kairos — thử lại.",
  not_configured: "Chưa cấu hình Supabase — Kairos cần kho thật (migration 0065).",
  audit_failed: "Chưa ghi được nhật ký nên CHƯA làm — thử lại.",
  reason_required: "Cần ghi lý do.",
  bad_until: "Ngày hết hạn không hợp lệ (ghim tối đa 30 ngày).",
  official: "Không cấm được hồ sơ Chính thức.",
  not_official: "Chỉ ghim được bài Chính thức.",
  no_sdvico_profile: "Chưa có hồ sơ SDVICO trong kho (migration 0065 chưa chạy).",
  empty: "Bài đang trống.",
  too_long: "Bài dài quá 2.000 ký tự.",
  bad_words: "Bài có chữ không phù hợp.",
  sovereignty: "Bài gọi sai tên Biển Đông hoặc quần đảo Hoàng Sa, Trường Sa của Việt Nam.",
  too_many_images: "Tối đa 5 ảnh.",
  bad_image: "Có ảnh không hợp lệ — bỏ ảnh đó rồi đăng lại.",
  rules: "Tài khoản của bạn chưa đồng ý nội quy Kairos — mở app, vào Kairos đồng ý một lần rồi tải ảnh lại.",
  internal: "Máy chủ đang lỗi — thử lại.",
};
const errText = (code?: string) => (code && CODE_TEXT[code]) || "Chưa làm được — thử lại.";

async function call<T>(path: string, init: RequestInit, ms: number): Promise<T> {
  const r = await fetch(apiUrl(path), { ...init, headers: { ...(init.headers ?? {}), ...tokenHeader() }, signal: timeoutSignal(ms) }).catch(() => null);
  if (!r) throw new Error("Không có mạng hoặc máy chủ không trả lời — thử lại.");
  const j = (await r.json().catch(() => null)) as ({ ok?: boolean; code?: string } & Record<string, unknown>) | null;
  if (!r.ok || !j?.ok) throw new Error(errText(j?.code));
  return j as T;
}
const get = <T,>(path: string) => call<T>(path, { method: "GET", cache: "no-store" }, READ_MS);
const post = <T,>(path: string, body: unknown) =>
  call<T>(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }, WRITE_MS);

/** Một thao tác người trực (route action). Ném Error có câu tiếng Việt. */
const act = (body: Record<string, unknown>) => post<{ ok: true }>("/api/admin/kairos/action", body);

const isPost = (t: Target): t is AdminPost => "kind" in t;

// ── Thẻ nội dung (bài hoặc bình luận) ─────────────────────────────────────

function StateChip({ hidden, modState }: { hidden: boolean; modState: string }) {
  const [cls, text] = hidden
    ? ["bg-danger-bg text-danger", "Đang ẩn"]
    : modState === "cho-kiem"
      ? ["bg-warn-bg text-warn", "Chờ kiểm"]
      : modState === "nghi"
        ? ["bg-warn-bg text-warn", "Nghi"]
        : ["bg-ok-bg text-ok", "Đang hiện"];
  return <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-[0.75rem] font-bold ${cls}`}>{text}</span>;
}

function TargetView({ t, kind }: { t: Target | null; kind: "post" | "comment" }) {
  if (!t) return <p className="text-[0.875rem] text-foreground/60">Nội dung không còn (đã bị xoá).</p>;
  const who = isPost(t) ? (t.kind === "bao" ? t.outlet ?? "Báo" : t.author?.handle ?? "—") : t.author.handle;
  const text = isPost(t) ? [t.title, t.summary, t.body].filter(Boolean).join(" — ") : t.body;
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[0.875rem] font-bold text-navy">{who}</span>
        <span className="text-[0.75rem] text-foreground/60">
          {kind === "post" ? (isPost(t) && t.kind === "bao" ? "Bài báo" : isPost(t) && t.kind === "chinh-thuc" ? "Chính thức" : "Bài") : "Bình luận"}
          {" · "}
          {fmtDT(isPost(t) ? t.publishedAt : t.createdAt)}
        </span>
        <StateChip hidden={t.hidden} modState={t.modState} />
      </div>
      <p className="mt-1 line-clamp-4 whitespace-pre-line break-words text-[0.9375rem] leading-snug text-foreground/85">{text || "(không có chữ)"}</p>
      {isPost(t) && t.images.length > 0 && <p className="mt-1 text-[0.8125rem] text-foreground/60">Có {t.images.length} ảnh</p>}
      {isPost(t) && t.url && (
        <a href={t.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-[0.8125rem] font-semibold text-sea underline">
          Mở bài gốc
        </a>
      )}
    </div>
  );
}

const btn = "min-h-[2.5rem] rounded-xl px-4 text-[0.875rem] font-bold disabled:opacity-50";
const btnMain = `${btn} bg-navy text-white`;
const btnSoft = `${btn} bg-field text-foreground/80`;
const btnDanger = `${btn} bg-danger-bg text-danger`;

// ── Hộp cấm người đăng (thời hạn + lý do) ─────────────────────────────────

function BanDialog({ handle, onCancel, onConfirm }: { handle: string; onCancel: () => void; onConfirm: (until: string, reason: string) => void }) {
  const [until, setUntil] = useState<"7d" | "30d" | "forever">("7d");
  const [reason, setReason] = useState("");
  const [nhac, setNhac] = useState(false);
  return (
    <ConfirmDialog
      title={`Cấm ${handle} đăng bài?`}
      message="Bị cấm vẫn đọc được, nhưng không đăng, bình luận, bấm Hay hay báo xấu được."
      confirmLabel="Cấm"
      cancelLabel="Không"
      danger
      onCancel={onCancel}
      onConfirm={() => (reason.trim().length < 5 ? setNhac(true) : onConfirm(until, reason.trim()))}
    >
      <div className="mt-1 space-y-2 text-left">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["7d", "7 ngày"],
              ["30d", "30 ngày"],
              ["forever", "Vĩnh viễn"],
            ] as const
          ).map(([v, l]) => (
            <FilterChip key={v} label={l} active={until === v} onClick={() => setUntil(v)} />
          ))}
        </div>
        <textarea
          className={`${inputClass} min-h-[5rem]`}
          maxLength={300}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Lý do (người bị cấm sẽ thấy)"
          aria-label="Lý do cấm"
        />
        {nhac && <p className="text-[0.8125rem] font-semibold text-danger">Ghi lý do ít nhất 5 ký tự.</p>}
      </div>
    </ConfirmDialog>
  );
}

// ── Tab ───────────────────────────────────────────────────────────────────

export function KairosTab({ perms }: { perms: TabPerms }) {
  const [section, setSection] = useState<Section>("bao-xau");
  const [news, setNews] = useState<{ flags: Flag[]; lastBaoAt: string | null; sources: SourceStat[]; stale: string | null } | null>(null);
  const [newsErr, setNewsErr] = useState<string | null>(null);

  const loadNews = useCallback(() => {
    setNewsErr(null);
    get<{ items: Flag[]; lastBaoAt: string | null; sources: SourceStat[] }>("/api/admin/kairos/flags")
      // tính dòng nhắc lúc NHẬN dữ liệu (không gọi Date.now trong lúc vẽ)
      .then((j) => setNews({ flags: j.items, lastBaoAt: j.lastBaoAt, sources: j.sources, stale: newsStaleText(j.lastBaoAt, Date.now()) }))
      .catch((e: Error) => setNewsErr(e.message));
  }, []);
  useEffect(loadNews, [loadNews]);

  const stale = news?.stale ?? null;
  const sections = SECTIONS.filter(([id]) => id !== "chinh-thuc" || perms.create);

  return (
    <section className="mt-4 space-y-4">
      {stale && (
        <p role="status" className="rounded-2xl bg-warn-bg px-4 py-3 text-[0.9375rem] font-semibold leading-snug text-warn">
          {stale}
        </p>
      )}
      <div className="flex flex-wrap gap-1.5">
        {sections.map(([id, label]) => (
          <FilterChip key={id} label={label} active={section === id} onClick={() => setSection(id)} />
        ))}
      </div>
      {section === "bao-xau" && <ReportsSection perms={perms} />}
      {section === "hang-cho" && <QueueSection perms={perms} />}
      {section === "bai" && <PostsSection perms={perms} />}
      {section === "chinh-thuc" && perms.create && <OfficialSection />}
      {section === "co" &&
        (newsErr ? (
          <ErrorBox text={newsErr} onRetry={loadNews} />
        ) : !news ? (
          <LoadingBox what="cờ chủ quyền" />
        ) : (
          <FlagsSection flags={news.flags} sources={news.sources} lastBaoAt={news.lastBaoAt} />
        ))}
    </section>
  );
}

// ── Báo xấu ───────────────────────────────────────────────────────────────

function ReportsSection({ perms }: { perms: TabPerms }) {
  const [status, setStatus] = useState<"moi" | "da-an" | "bo-qua">("moi");
  const [items, setItems] = useState<ReportGroup[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actErr, setActErr] = useState<string | null>(null);
  const [banFor, setBanFor] = useState<{ profileId: string; handle: string } | null>(null);
  const [hideFor, setHideFor] = useState<ReportGroup | null>(null);

  const load = useCallback(() => {
    setErr(null);
    setItems(null);
    get<{ items: ReportGroup[] }>(`/api/admin/kairos/reports?status=${status}`)
      .then((j) => setItems(j.items))
      .catch((e: Error) => setErr(e.message));
  }, [status]);
  useEffect(load, [load]);

  const run = async (key: string, body: Record<string, unknown>) => {
    setBusy(key);
    setActErr(null);
    try {
      await act(body);
      load();
    } catch (e) {
      setActErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ["moi", "Chưa xử lý"],
            ["da-an", "Đã ẩn"],
            ["bo-qua", "Bỏ qua"],
          ] as const
        ).map(([v, l]) => (
          <FilterChip key={v} label={l} active={status === v} onClick={() => setStatus(v)} />
        ))}
      </div>
      <p className="text-[0.8125rem] leading-snug text-foreground/65">
        Gỡ trong 48 giờ kể từ khi bị báo (NĐ 147/2024). Từ 5 người báo trở lên, bài tự ẩn chờ người trực.
      </p>
      {actErr && <p className="text-[0.875rem] font-semibold text-danger">{actErr}</p>}
      {err ? (
        <ErrorBox text={err} onRetry={load} />
      ) : !items ? (
        <LoadingBox what="báo xấu" />
      ) : items.length === 0 ? (
        <EmptyBox text="Không có báo xấu nào." />
      ) : (
        items.map((g) => {
          const key = `${g.targetType}:${g.targetId}`;
          const author = g.target ? (isPost(g.target) ? g.target.author : g.target.author) : null;
          return (
            <article key={key} className="surface space-y-2 px-4 py-3">
              <p className="text-[0.875rem] font-bold text-danger">
                {g.count} người báo ·{" "}
                {Object.entries(g.reasons)
                  .map(([r, n]) => `${REPORT_REASON_TEXT[r as ReportReason] ?? r} ${n}`)
                  .join(" · ")}
                <span className="font-normal text-foreground/60"> · gần nhất {fmtDT(g.latestAt)}</span>
              </p>
              {g.notes.length > 0 && <p className="text-[0.8125rem] italic text-foreground/70">“{g.notes.join("” · “")}”</p>}
              <TargetView t={g.target} kind={g.targetType} />
              {status === "moi" && (
                <div className="flex flex-wrap gap-2">
                  {perms.edit && g.target && !g.target.hidden && (
                    <button type="button" className={btnDanger} disabled={busy === key} onClick={() => setHideFor(g)}>
                      Ẩn
                    </button>
                  )}
                  {perms.edit && (
                    <button type="button" className={btnSoft} disabled={busy === key} onClick={() => run(key, { action: "resolve", targetType: g.targetType, targetId: g.targetId, status: "bo-qua" })}>
                      Bỏ qua
                    </button>
                  )}
                  {perms.delete && author && !author.official && (
                    <button type="button" className={btnSoft} disabled={busy === key} onClick={() => setBanFor({ profileId: author.profileId, handle: author.handle })}>
                      Cấm người đăng
                    </button>
                  )}
                </div>
              )}
            </article>
          );
        })
      )}
      {hideFor && (
        <ReasonDialog
          title="Ẩn nội dung này?"
          message="Ẩn với mọi người, đóng các báo xấu đang mở. Hiện lại được ở mục Bài."
          confirmLabel="Ẩn"
          placeholder="Lý do ẩn"
          suggestions={["Lừa đảo", "Nội dung bậy bạ", "Sai sự thật", "Xúc phạm người khác", "Quảng cáo trá hình"]}
          onCancel={() => setHideFor(null)}
          onConfirm={(reason) => {
            const g = hideFor;
            setHideFor(null);
            void run(`${g.targetType}:${g.targetId}`, { action: "hide", targetType: g.targetType, targetId: g.targetId, reason });
          }}
        />
      )}
      {banFor && (
        <BanDialog
          handle={banFor.handle}
          onCancel={() => setBanFor(null)}
          onConfirm={(until, reason) => {
            const b = banFor;
            setBanFor(null);
            void run(`ban:${b.profileId}`, { action: "ban", profileId: b.profileId, until, reason });
          }}
        />
      )}
    </div>
  );
}

// ── Hàng chờ agent kiểm duyệt ─────────────────────────────────────────────

function QueueSection({ perms }: { perms: TabPerms }) {
  const [items, setItems] = useState<QueueItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [actErr, setActErr] = useState<string | null>(null);
  const [blockFor, setBlockFor] = useState<QueueItem | null>(null);

  const load = useCallback(() => {
    setErr(null);
    setItems(null);
    get<{ items: QueueItem[] }>("/api/admin/kairos/queue")
      .then((j) => setItems(j.items))
      .catch((e: Error) => setErr(e.message));
  }, []);
  useEffect(load, [load]);

  const verdict = async (q: QueueItem, v: "dat" | "chan", reason: string | null) => {
    setBusy(q.decisionId);
    setActErr(null);
    try {
      await act({ action: "verdict", decisionId: q.decisionId, verdict: v, reason });
      load();
    } catch (e) {
      setActErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-[0.8125rem] leading-snug text-foreground/65">
        Những gì agent kiểm duyệt chặn hoặc còn nghi. Bài báo bị nghi chưa lên dòng tin; bài bà con bị chặn đã tự ẩn và người đăng đã được báo lý do. Người quyết thì agent không đè lại.
      </p>
      {actErr && <p className="text-[0.875rem] font-semibold text-danger">{actErr}</p>}
      {err ? (
        <ErrorBox text={err} onRetry={load} />
      ) : !items ? (
        <LoadingBox what="hàng chờ" />
      ) : items.length === 0 ? (
        <EmptyBox text="Hàng chờ trống — agent chưa chặn hay nghi gì." />
      ) : (
        items.map((q) => (
          <article key={q.decisionId} className="surface space-y-2 px-4 py-3">
            <p className="text-[0.875rem] font-bold">
              <span className={q.verdict === "chan" ? "text-danger" : "text-warn"}>{q.verdict === "chan" ? "Agent đã chặn" : "Agent nghi"}</span>
              {q.score != null && <span className="text-foreground/70"> · điểm {Math.round(q.score * 100)}/100</span>}
              <span className="font-normal text-foreground/60">
                {" "}
                · {fmtDT(q.at)} · luật {q.rulesVersion ?? "—"} · {q.model ?? "—"}
              </span>
            </p>
            {q.reason && <p className="text-[0.875rem] text-foreground/80">Lý do: {q.reason}</p>}
            <TargetView t={q.target} kind={q.targetType} />
            {perms.edit && q.target && (
              <div className="flex flex-wrap gap-2">
                <button type="button" className={btnMain} disabled={busy === q.decisionId} onClick={() => verdict(q, "dat", null)}>
                  Cho đạt
                </button>
                {q.verdict !== "chan" && (
                  <button type="button" className={btnDanger} disabled={busy === q.decisionId} onClick={() => setBlockFor(q)}>
                    Chặn
                  </button>
                )}
              </div>
            )}
          </article>
        ))
      )}
      {blockFor && (
        <ReasonDialog
          title="Chặn nội dung này?"
          message="Ẩn với mọi người. Bài báo sẽ không lên dòng tin."
          confirmLabel="Chặn"
          placeholder="Lý do chặn"
          onCancel={() => setBlockFor(null)}
          onConfirm={(reason) => {
            const q = blockFor;
            setBlockFor(null);
            void verdict(q, "chan", reason);
          }}
        />
      )}
    </div>
  );
}

// ── Bài: tìm, ẩn/hiện, ghim; bình luận của một bài ───────────────────────

const PIN_DAYS = [1, 3, 7, 14, 30] as const;

function PostsSection({ perms }: { perms: TabPerms }) {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<AdminPost[] | null>(null);
  const [loadedAt, setLoadedAt] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actErr, setActErr] = useState<string | null>(null);
  const [open, setOpen] = useState<{ post: AdminPost; comments: AdminComment[] | null; err: string | null } | null>(null);
  const [hideFor, setHideFor] = useState<{ type: "post" | "comment"; id: string } | null>(null);
  const [pinFor, setPinFor] = useState<AdminPost | null>(null);
  const [pinDays, setPinDays] = useState<number>(7);

  const load = useCallback(() => {
    setErr(null);
    setItems(null);
    get<{ posts: AdminPost[] }>(`/api/admin/kairos/posts?q=${encodeURIComponent(query)}`)
      .then((j) => {
        setItems(j.posts);
        setLoadedAt(Date.now());
      })
      .catch((e: Error) => setErr(e.message));
  }, [query]);
  useEffect(load, [load]);

  const loadComments = useCallback((p: AdminPost) => {
    setOpen({ post: p, comments: null, err: null });
    get<{ post: AdminPost; comments: AdminComment[] }>(`/api/admin/kairos/posts?postId=${p.id}`)
      .then((j) => setOpen({ post: j.post, comments: j.comments, err: null }))
      .catch((e: Error) => setOpen({ post: p, comments: null, err: e.message }));
  }, []);

  const run = async (key: string, body: Record<string, unknown>) => {
    setBusy(key);
    setActErr(null);
    try {
      await act(body);
      load();
      if (open) loadComments(open.post);
    } catch (e) {
      setActErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const pinned = (p: AdminPost) => !!p.pinnedUntil && Date.parse(p.pinnedUntil) > loadedAt;

  return (
    <div className="space-y-3">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(q.trim());
        }}
      >
        <input className={inputClass} value={q} onChange={(e) => setQ(e.target.value)} maxLength={80} placeholder="Tìm theo chữ trong bài, tiêu đề, tên báo" aria-label="Tìm bài" />
        <button type="submit" className={btnMain}>
          Tìm
        </button>
      </form>
      {actErr && <p className="text-[0.875rem] font-semibold text-danger">{actErr}</p>}
      {err ? (
        <ErrorBox text={err} onRetry={load} />
      ) : !items ? (
        <LoadingBox what="bài" />
      ) : items.length === 0 ? (
        <EmptyBox text={query ? "Không có bài nào khớp." : "Chưa có bài nào."} />
      ) : (
        items.map((p) => (
          <article key={p.id} className="surface space-y-2 px-4 py-3">
            <TargetView t={p} kind="post" />
            {p.hidden && p.hiddenReason && <p className="text-[0.8125rem] text-danger">Lý do ẩn: {p.hiddenReason}</p>}
            {pinned(p) && <p className="text-[0.8125rem] font-semibold text-sea">Đang ghim tới {fmtDT(p.pinnedUntil)}</p>}
            <div className="flex flex-wrap gap-2">
              <button type="button" className={btnSoft} onClick={() => loadComments(p)}>
                Bình luận ({p.commentCount})
              </button>
              {perms.edit &&
                (p.hidden ? (
                  <button type="button" className={btnMain} disabled={busy === p.id} onClick={() => run(p.id, { action: "unhide", targetType: "post", targetId: p.id })}>
                    Hiện lại
                  </button>
                ) : (
                  <button type="button" className={btnDanger} disabled={busy === p.id} onClick={() => setHideFor({ type: "post", id: p.id })}>
                    Ẩn
                  </button>
                ))}
              {perms.edit && p.kind === "chinh-thuc" &&
                (pinned(p) ? (
                  <button type="button" className={btnSoft} disabled={busy === p.id} onClick={() => run(p.id, { action: "unpin", postId: p.id })}>
                    Bỏ ghim
                  </button>
                ) : (
                  <button type="button" className={btnSoft} disabled={busy === p.id} onClick={() => setPinFor(p)}>
                    Ghim
                  </button>
                ))}
            </div>
            {open?.post.id === p.id && (
              <div className="space-y-2 border-t border-line pt-2">
                {open.err ? (
                  <ErrorBox text={open.err} onRetry={() => loadComments(p)} />
                ) : !open.comments ? (
                  <p className="text-[0.875rem] text-foreground/60">Đang tải bình luận…</p>
                ) : open.comments.length === 0 ? (
                  <p className="text-[0.875rem] text-foreground/60">Chưa có bình luận.</p>
                ) : (
                  open.comments.map((c) => (
                    <div key={c.id} className={`flex items-start justify-between gap-3 ${c.parentId ? "pl-6" : ""}`}>
                      <TargetView t={c} kind="comment" />
                      {perms.edit &&
                        (c.hidden ? (
                          <button type="button" className={btnSoft} disabled={busy === c.id} onClick={() => run(c.id, { action: "unhide", targetType: "comment", targetId: c.id })}>
                            Hiện lại
                          </button>
                        ) : (
                          <button type="button" className={btnDanger} disabled={busy === c.id} onClick={() => setHideFor({ type: "comment", id: c.id })}>
                            Ẩn
                          </button>
                        ))}
                    </div>
                  ))
                )}
              </div>
            )}
          </article>
        ))
      )}
      {hideFor && (
        <ReasonDialog
          title={hideFor.type === "post" ? "Ẩn bài này?" : "Ẩn bình luận này?"}
          message="Ẩn với mọi người. Hiện lại được bất cứ lúc nào."
          confirmLabel="Ẩn"
          placeholder="Lý do ẩn"
          onCancel={() => setHideFor(null)}
          onConfirm={(reason) => {
            const h = hideFor;
            setHideFor(null);
            void run(h.id, { action: "hide", targetType: h.type, targetId: h.id, reason });
          }}
        />
      )}
      {pinFor && (
        <ConfirmDialog
          title="Ghim bài Chính thức"
          message="Bài ghim nằm trên đầu dòng tin của mọi người tới hết hạn."
          confirmLabel="Ghim"
          cancelLabel="Không"
          danger={false}
          onCancel={() => setPinFor(null)}
          onConfirm={() => {
            const p = pinFor;
            setPinFor(null);
            void run(p.id, { action: "pin", postId: p.id, until: new Date(Date.now() + pinDays * 86_400_000 - 60_000).toISOString() });
          }}
        >
          <div className="mt-1 flex flex-wrap gap-1.5">
            {PIN_DAYS.map((d) => (
              <FilterChip key={d} label={`${d} ngày`} active={pinDays === d} onClick={() => setPinDays(d)} />
            ))}
          </div>
        </ConfirmDialog>
      )}
    </div>
  );
}

// ── Chính thức: SDVICO đăng bài ───────────────────────────────────────────

const TOPICS = ["nghe-ca", "thoi-su", "phap-luat", "doi-song", "the-thao", "giai-tri", "kinh-te"] as const;

function OfficialSection() {
  const [body, setBody] = useState("");
  const [topic, setTopic] = useState<(typeof TOPICS)[number]>("nghe-ca");
  const [images, setImages] = useState<string[]>([]);
  const [pinDays, setPinDays] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const len = [...body].length;

  const upload = async (blob: Blob) => {
    const r = await kairosUpload(blob);
    if (!r.ok) throw new Error(r.offline ? "Cần sóng để tải ảnh" : errText(r.code));
    return r.data.url;
  };

  const submit = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await post("/api/admin/kairos/official", {
        body,
        topic,
        ports: [],
        images: images.map(mediaPathFromUrl).filter((x): x is string => !!x),
        ...(pinDays ? { pinnedUntil: new Date(Date.now() + pinDays * 86_400_000 - 60_000).toISOString() } : {}),
      });
      setBody("");
      setImages([]);
      setPinDays(null);
      setMsg({ ok: true, text: "Đã đăng bài Chính thức." });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="surface space-y-3 px-4 py-4">
      <p className="text-[0.875rem] leading-snug text-foreground/70">
        Bài đứng tên <b>SDVICO</b> kèm dấu Chính thức, lên ngay không qua agent. Ảnh tải bằng tài khoản của bạn (không lộ SĐT).
      </p>
      <textarea
        className={`${inputClass} min-h-[8rem]`}
        value={body}
        maxLength={LIMITS.postBody}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Nội dung thông báo cho bà con"
        aria-label="Nội dung bài Chính thức"
      />
      {len > LIMITS.postBody - 200 && <p className="text-[0.8125rem] text-foreground/60">Còn {LIMITS.postBody - len} ký tự</p>}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Chủ đề">
        {TOPICS.map((t) => (
          <FilterChip key={t} label={NHAN_CHIP_KAIROS[t]} active={topic === t} onClick={() => setTopic(t)} />
        ))}
      </div>
      <ImagePicker value={images} onChange={setImages} max={LIMITS.images} upload={upload} label="Ảnh (tuỳ chọn)" />
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Ghim">
        <span className="text-[0.875rem] font-semibold text-foreground/70">Ghim:</span>
        <FilterChip label="Không" active={pinDays === null} onClick={() => setPinDays(null)} />
        {PIN_DAYS.map((d) => (
          <FilterChip key={d} label={`${d} ngày`} active={pinDays === d} onClick={() => setPinDays(d)} />
        ))}
      </div>
      {msg && <p className={`text-[0.875rem] font-semibold ${msg.ok ? "text-ok" : "text-danger"}`}>{msg.text}</p>}
      <button type="button" className={btnMain} disabled={busy || (!body.trim() && images.length === 0)} onClick={submit}>
        {busy ? NHAN.dangGui : NHAN.dang}
      </button>
    </div>
  );
}

// ── Cờ chủ quyền + sức khoẻ máy thu tin ──────────────────────────────────

function FlagsSection({ flags, sources, lastBaoAt }: { flags: Flag[]; sources: SourceStat[]; lastBaoAt: string | null }) {
  const dead = sources.filter((s) => s.enabled && s.lastError);
  return (
    <div className="space-y-3">
      <div className="surface px-4 py-3 text-[0.875rem] leading-snug text-foreground/75">
        <p>
          Bài báo mới nhất vào kho: <b>{lastBaoAt ? fmtDT(lastBaoAt) : "chưa có"}</b> · {sources.length} nguồn RSS
          {dead.length > 0 && <span className="font-semibold text-danger"> · {dead.length} nguồn đang lỗi</span>}
        </p>
        {dead.map((s) => (
          <p key={s.id} className="mt-1 text-[0.8125rem] text-danger">
            {s.outlet} ({s.section}): {s.lastError} — đọc được lần cuối {s.lastOkAt ? fmtDT(s.lastOkAt) : "chưa bao giờ"}
          </p>
        ))}
      </div>
      <p className="text-[0.8125rem] leading-snug text-foreground/65">
        Bài báo bị loại vì gọi sai tên Biển Đông hoặc quần đảo Hoàng Sa, Trường Sa (cột “Cụm trúng” ghi cách gọi sai). Không lên dòng tin — chỉ để xem.
      </p>
      {flags.length === 0 ? (
        <EmptyBox text="Chưa có bài nào bị cờ chủ quyền." />
      ) : (
        <div className="surface overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-[0.875rem]">
            <thead>
              <tr className="border-b border-line text-foreground/60">
                <th className="px-4 py-2 font-semibold">Lúc</th>
                <th className="px-2 py-2 font-semibold">Nguồn</th>
                <th className="px-2 py-2 font-semibold">Cụm trúng</th>
                <th className="px-4 py-2 font-semibold">Tiêu đề (bỏ dấu)</th>
              </tr>
            </thead>
            <tbody>
              {flags.map((f, i) => (
                <tr key={i} className="border-b border-line last:border-0">
                  <td className="whitespace-nowrap px-4 py-2 text-foreground/70">{fmtDT(f.at)}</td>
                  <td className="px-2 py-2">{f.sourceId ?? "—"}</td>
                  <td className="px-2 py-2 font-bold text-danger">{f.term ?? "—"}</td>
                  <td className="px-4 py-2 text-foreground/80">{f.titleNorm ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

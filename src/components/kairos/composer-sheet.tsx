"use client";

/*
  KHUNG SOẠN BÀI KAIROS (14 §3.3, §3.5, §10; AC07 · AC08 · AC11 · AC14 · AC19).

  Ba kiểu: `new` (ô mời / Bến — cảng điền sẵn) · `edit` (sửa bài của mình) · `reshare` (Đăng
  lại kèm lời mình, thẻ bài gốc bên dưới).
   · chữ ≤2.000 ký tự, đếm lùi khi còn ≤200 · ≤5 ảnh qua ImagePicker (nén image-resize, tải
     TỪNG ảnh ngay khi chọn, lỗi ⇒ Thử lại ảnh đó) · chủ đề (mặc định Nghề cá) · cảng.
   · LẦN ĐẦU: nội quy + Đồng ý (RulesBox). Route trả 409 `rules` cũng mở lại nội quy.
   · MẤT SÓNG: nút Đăng xám "Cần sóng"; chữ vào nháp `forfish.kairos.nhap.v1` từng phím;
     có sóng lại KHÔNG tự gửi — bà con bấm Đăng. Mở khung lúc mất sóng: `/me` chưa về ⇒ nút
     Thử lại; sự kiện `online` tự hỏi lại `/me` ⇒ nút Đăng sáng lại, khỏi đóng khung
     (social.composerGate — luật thuần có test).
   · HUỶ khi đã tải ảnh: ảnh vừa tải trong phiên này (chưa thuộc bài nào) xoá khỏi kho qua
     DELETE /api/kairos/upload — không để ảnh mồ côi. Ảnh sót (mất sóng lúc Huỷ, đóng app)
     agent kiểm duyệt dọn sau 24 giờ.
   · Lỗi: câu theo mã ngay trên nút (bad_words, sovereignty, too_long, rate_limited, banned…),
     chữ vẫn nguyên để sửa.
  Chưa đăng nhập ⇒ mời đăng nhập (đọc không cần tài khoản, ghi thì cần).
*/

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ImagePicker } from "@/components/market/shared/image-picker";
import { ChevronDownIcon, CloseIcon, ImageIcon, NewsIcon, PinIcon } from "@/components/icons";
import { lockBodyScroll, unlockBodyScroll } from "@/lib/dialog-focus";
import { FISHING_PORTS } from "@/data/fishing-ports";
import { loadBoats, loadCurrentBoatId } from "@/lib/boats";
import { laChuyenBien, TOPICS, type Topic } from "@/lib/kairos/chu-de.mjs";
import { draftKey } from "@/lib/kairos/cache";
import { loadHabit } from "@/lib/kairos/feed-client";
import { LIMITS, type KairosPost } from "@/lib/kairos/types";
import { charLen } from "@/lib/kairos/validate";
import {
  composerGate,
  discardUploads,
  errorText,
  kairosSend,
  kairosUpload,
  khungCoThayDoi,
  loadDraftFull,
  mediaPathFromUrl,
  meRefetchOnOnline,
  orphanUploads,
  saveDraft,
  type ComposerMe,
  type KairosMe,
} from "@/lib/kairos/write-client";
import { NHAN, NHAN_CHIP_KAIROS } from "@/lib/labels";
import { useAuthUser } from "@/lib/use-auth";
import { useOnline } from "@/lib/use-online";
import { HomePortSheet } from "./home-port-sheet";
import { RulesBox } from "./rules-box";
import { NutMic } from "./de-dung";
import { KairosAvatar } from "./kairos-avatar";
import { useVungNhin } from "./use-vung-nhin";
import { useNhacTen } from "./nhac-ten-o-viet";

export type ComposeMode =
  | { kind: "new"; port?: string }
  | { kind: "edit"; post: KairosPost }
  | { kind: "reshare"; post: KairosPost };

const PORT_NAME = new Map(FISHING_PORTS.map((p) => [p.id, p.name]));
const TOPIC_OPTIONS = TOPICS.map((id) => ({ id, label: NHAN_CHIP_KAIROS[id] }));

/** Cảng nhà: thói quen trong máy (đã lấy từ sổ tàu ở dòng tin), không thì sổ tàu. */
function homePort(): string | null {
  const h = loadHabit().home.port;
  if (h) return h;
  const boats = loadBoats();
  const b = boats.find((x) => x.id === loadCurrentBoatId()) ?? boats[0];
  return b?.homePortId && PORT_NAME.has(b.homePortId) ? b.homePortId : null;
}

/** Chủ đề tự đoán khi bà con chưa tự chọn: có chuyện biển/nghề ⇒ Nghề cá, không thì Đời sống (FB không bắt chọn). */
export function doanChuDe(text: string): Topic {
  return laChuyenBien(text) || RE_CHUYEN_BIEN.test(text.toLowerCase()) ? "nghe-ca" : "doi-song";
}
/** Từ bà con hay viết khi kể chuyện đi biển (bổ sung cho laChuyenBien vốn soạn cho tin báo). */
const RE_CHUYEN_BIEN = /(ra khơi|đi biển|ngoài khơi|ghe|tàu|thuyền|lưới|câu mực|mực|cá |cá$|tôm|cua|ghẹ|sóng|gió|bão|biển|cảng|bến|neo|hải sản|ngư trường|luồng cá)/u;

function keyOf(mode: ComposeMode): string {
  if (mode.kind === "edit") return draftKey("sua", mode.post.id);
  if (mode.kind === "reshare") return `lai:${mode.post.id}`;
  return mode.port ? `ben:${mode.port}` : draftKey("bai");
}

export function ComposerSheet({
  mode,
  onClose,
  onDone,
}: {
  mode: ComposeMode;
  onClose: () => void;
  /** bài máy chủ trả về sau khi đăng/sửa */
  onDone: (post: KairosPost) => void;
}) {
  const { phone, signedIn, ready } = useAuthUser();
  const online = useOnline();
  const editing = mode.kind === "edit" ? mode.post : null;
  const dKey = keyOf(mode);

  // Nháp đọc MỘT lần lúc mở khung: chữ + ảnh đã "Lưu nháp" (nháp cũ chỉ có chữ vẫn đọc được).
  const [nhap] = useState(() => loadDraftFull(phone, dKey));
  const anhCu = editing?.images.filter((u) => mediaPathFromUrl(u)) ?? [];
  const [text, setText] = useState(() => nhap?.text || editing?.body || "");
  const [draftFail, setDraftFail] = useState(false);
  const [images, setImages] = useState<string[]>(() => (nhap?.images.length ? nhap.images.filter((u) => mediaPathFromUrl(u)) : anhCu));
  // Ảnh của nháp (không thuộc bài đang sửa) tính như ảnh tải trong phiên ⇒ Bỏ bài / gỡ khỏi bài thì xoá khỏi kho.
  const [pathsDau] = useState(() => {
    const m = new Map<string, string>();
    for (const u of nhap?.images ?? []) {
      const p = mediaPathFromUrl(u);
      if (p && !editing?.images.includes(u)) m.set(u, p);
    }
    return m;
  });
  const paths = useRef(pathsDau);
  const [hoiDong, setHoiDong] = useState(false);
  // chủ đề TỰ ĐOÁN theo chữ tới khi bà con tự chọn (sửa bài: giữ chủ đề cũ)
  const [topicTay, setTopicTay] = useState<Topic | null>(() => (editing && (TOPICS as readonly string[]).includes(editing.topic) ? (editing.topic as Topic) : null));
  const [pickTopic, setPickTopic] = useState(false);
  const anhMo = useRef<(() => void) | null>(null);
  const oChu = useRef<HTMLTextAreaElement>(null);
  const tieuDeId = useId();
  const vung = useVungNhin();
  const [port, setPort] = useState<string | null>(() =>
    editing ? editing.ports[0] ?? null : mode.kind === "new" && mode.port ? mode.port : null,
  );
  const [pickPort, setPickPort] = useState(false);
  const [me, setMe] = useState<ComposerMe>({ s: "loading" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [needRules, setNeedRules] = useState(false);

  // Cảng nhà điền sẵn (đọc máy lúc mở khung — không có ở lần vẽ phía máy chủ).
  useEffect(() => {
    if (mode.kind === "new" && !mode.port) setPort((p) => p ?? homePort());
  }, [mode]);

  // Hồ sơ của mình — biết đã đồng ý nội quy chưa. Chỉ gọi khi bà con MỞ khung (không lúc mở app).
  // Một lượt một lúc (bấm Thử lại dồn + sự kiện online không bắn hai request).
  const meBusy = useRef(false);
  const loadMe = useCallback(async () => {
    if (meBusy.current) return;
    meBusy.current = true;
    setMe({ s: "loading" });
    const r = await kairosSend<{ me: KairosMe }>("GET", "/api/kairos/me");
    meBusy.current = false;
    if (r.ok) setMe({ s: "ok", me: r.data.me });
    else if (r.offline) setMe({ s: "offline" });
    else setMe({ s: "error", text: errorText(r) });
  }, []);
  useEffect(() => {
    if (ready && signedIn) void loadMe();
  }, [ready, signedIn, loadMe]);
  // Mở khung lúc mất sóng ⇒ có sóng lại (sự kiện `online`) thì tự hỏi lại, khỏi đóng/mở khung
  // (AC07). Nghe SỰ KIỆN, không nghe cờ: máy báo "có sóng" mà sóng chết thì `/me` về offline
  // lại — nghe cờ sẽ hỏi lại liên tục không nghỉ.
  const meRef = useRef(me);
  useEffect(() => {
    meRef.current = me;
  });
  useEffect(() => {
    if (!ready || !signedIn) return;
    const on = () => {
      if (meRefetchOnOnline(meRef.current)) void loadMe();
    };
    window.addEventListener("online", on);
    return () => window.removeEventListener("online", on);
  }, [ready, signedIn, loadMe]);

  const onText = (v: string) => {
    setText(v);
    setErr("");
    setDraftFail(!saveDraft(phone, dKey, v));
  };

  const nt = useNhacTen({ text, setText: onText, box: oChu, dau: editing?.mentions ?? [] });

  const upload = async (blob: Blob) => {
    const r = await kairosUpload(blob);
    if (!r.ok) {
      if (r.code === "rules") setNeedRules(true);
      throw new Error(r.offline ? "Cần sóng" : errorText(r, "anh"));
    }
    paths.current.set(r.data.url, r.data.path);
    return r.data.url;
  };

  const topic: Topic = topicTay ?? doanChuDe(text);
  const len = charLen(text.trim());
  const left = LIMITS.postBody - len;
  const tooLong = left < 0;
  const empty = !text.trim() && images.length === 0 && mode.kind !== "reshare";
  const gate = composerGate({ online, me, busy, empty, tooLong, needRules });
  const canSend = gate.canSend;

  const submit = async () => {
    if (!canSend) return;
    setBusy(true);
    setErr("");
    const imgPaths = images.map((u) => paths.current.get(u) ?? mediaPathFromUrl(u)).filter((p): p is string => !!p);
    const body = { body: text, images: imgPaths, topic, ports: port ? [port] : [], mentions: nt.nhac.map((m) => m.id) };
    const r = editing
      ? await kairosSend<{ post: KairosPost }>("PATCH", `/api/kairos/posts/${editing.id}`, body)
      : await kairosSend<{ post: KairosPost }>("POST", "/api/kairos/posts", mode.kind === "reshare" ? { ...body, reshareOf: mode.post.id } : body);
    setBusy(false);
    if (r.ok) {
      saveDraft(phone, dKey, "");
      // ảnh đã tải rồi gỡ khỏi khung trước khi Đăng ⇒ không thuộc bài nào
      void discardUploads(orphanUploads(paths.current.values(), imgPaths));
      paths.current.clear();
      onDone(r.data.post);
      return;
    }
    if (r.code === "rules") setNeedRules(true);
    setErr(errorText(r, "bai"));
  };

  // Khung toàn màn: khoá cuộn trang dưới, đặt con trỏ vào ô chữ (bàn phím bật như FB), Escape đóng. Chạy MỘT LẦN.
  const cancelRef = useRef<() => void>(() => {});
  useEffect(() => {
    lockBodyScroll();
    oChu.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      // Escape đang dành cho ngăn con (chọn chủ đề / cảng) thì để ngăn đó đóng, không đóng cả khung soạn.
      if (e.key === "Escape" && document.querySelectorAll('[role="dialog"]').length <= 1) cancelRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      unlockBodyScroll();
    };
  }, []);

  /** Bỏ bài: ảnh vừa tải trong phiên này (và ảnh của nháp) chưa thuộc bài nào ⇒ xoá khỏi kho. */
  const cancel = () => {
    void discardUploads(orphanUploads(paths.current.values(), []));
    paths.current.clear();
    onClose();
  };
  /** × / Escape: có chữ hay ảnh (sửa bài: khác bản cũ) ⇒ hỏi Lưu nháp · Bỏ bài · Viết tiếp; trống ⇒ đóng ngay. */
  const dong = () => {
    if (khungCoThayDoi(text, images, editing ? { body: editing.body, images: anhCu } : null)) setHoiDong(true);
    else cancel();
  };
  const luuNhap = () => {
    if (!saveDraft(phone, dKey, text, Date.now(), images)) {
      setHoiDong(false);
      setDraftFail(true);
      setErr("Máy đầy — nháp chưa lưu được. Đăng luôn hoặc bỏ bớt ảnh.");
      return;
    }
    // GIỮ ảnh trên kho (nháp còn dùng) — KHÔNG discardUploads.
    // nợ: ảnh nháp quá 24 giờ có thể bị agent dọn ảnh mồ côi xoá; nâng cấp khi kho biết ảnh thuộc nháp.
    paths.current.clear();
    onClose();
  };
  const boBai = () => {
    saveDraft(phone, dKey, "", Date.now(), []);
    cancel();
  };
  useEffect(() => {
    cancelRef.current = dong;
  });

  // Ô chữ tự cao theo chữ — theo `text` (gõ, micro, nháp mở lại đều cao theo), không cuộn trong ô nhỏ.
  useEffect(() => {
    const el = oChu.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);

  const title = editing ? "Sửa bài" : mode.kind === "reshare" ? "Đăng lại" : mode.kind === "new" && mode.port ? `Đăng vào Bến ${PORT_NAME.get(mode.port) ?? ""}` : "Đăng bài";

  if (ready && !signedIn) {
    return (
      <BottomSheet title={title} onClose={onClose}>
        <p className="mb-4 text-[1rem]">Đọc Kairos không cần tài khoản. Muốn đăng bài, Hay, bình luận thì cần đăng nhập.</p>
        <Link href="/login" className="flex h-(--h-cta) w-full items-center justify-center rounded-xl bg-sea font-semibold text-white">
          {NHAN.dangNhap}
        </Link>
      </BottomSheet>
    );
  }

  const nutDang = gate.button === "dang" && editing ? NHAN.luu : NHAN[gate.button];
  const tenToi = me.s === "ok" ? me.me.handle : "";
  const chuTo = !images.length && mode.kind !== "reshare" && charLen(text) < 90; // bài ngắn chữ to như FB
  const nutPhu = "flex h-8 items-center gap-1 rounded-lg bg-field px-2.5 text-[0.8125rem] font-semibold text-foreground/80";
  const nutCong = "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-navy transition active:scale-[0.95] disabled:opacity-40";

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={tieuDeId}
      className="anim-sheet-in fixed inset-x-0 z-30 mx-auto flex w-full max-w-(--w-app) flex-col bg-background"
      style={vung ? { top: vung.top, height: vung.height } : { top: 0, height: "100dvh" }}
    >
      {/* THANH TRÊN — ✕ · tên khung · Đăng (luôn thấy, kể cả khi bàn phím mở) */}
      <header className="flex h-14 shrink-0 items-center gap-1 border-b border-line px-2 pt-[env(safe-area-inset-top)]">
        <button type="button" onClick={dong} aria-label={NHAN.dong} className={nutCong}>
          <CloseIcon className="h-6 w-6" />
        </button>
        <h2 id={tieuDeId} className="min-w-0 flex-1 truncate text-center text-[1.0625rem] font-semibold text-navy">
          {title}
        </h2>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!canSend}
          aria-busy={busy}
          className="h-10 min-w-20 rounded-xl bg-sea px-4 font-semibold text-white disabled:opacity-40"
        >
          {nutDang}
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-3 [overscroll-behavior:contain]">
        {me.s === "ok" && me.me.bannedUntil && (
          <p role="alert" className="mb-3 rounded-xl bg-danger-bg px-3 py-2 text-[0.875rem] font-semibold text-danger">
            {errorText({ code: "banned", status: 403, offline: false, extra: { until: me.me.bannedUntil } })}
            {me.me.banReason ? ` Lý do: ${me.me.banReason}` : ""}
          </p>
        )}
        {(needRules || (me.s === "ok" && !me.me.rulesAccepted)) && (
          <div className="mb-3">
            <RulesBox
              onAccepted={(m) => {
                setMe({ s: "ok", me: m });
                setNeedRules(false);
              }}
            />
          </div>
        )}
        {gate.retry && (
          <div className={`mb-3 flex items-center gap-2 rounded-xl px-3 py-2 ${me.s === "error" ? "bg-danger-bg" : "bg-field"}`}>
            <p className={`flex-1 text-[0.875rem] font-semibold ${me.s === "error" ? "text-danger" : "text-foreground/75"}`}>
              {me.s === "error" ? me.text : "Mất sóng — viết trước, có sóng bấm Đăng."}
            </p>
            <button type="button" onClick={() => void loadMe()} className="h-10 rounded-xl bg-card px-3 font-semibold text-sea">
              {NHAN.thuLai}
            </button>
          </div>
        )}

        {/* NGƯỜI ĐĂNG + chủ đề + cảng (như dòng "Công khai ▾" của FB) */}
        <div className="mb-2 flex items-center gap-3">
          <KairosAvatar id={me.s === "ok" ? me.me.profileId : "toi"} name={tenToi || "Tôi"} url={me.s === "ok" ? me.me.avatarUrl : null} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[1rem] font-semibold text-navy">{tenToi || " "}</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <button type="button" onClick={() => setPickTopic(true)} className={nutPhu} aria-label={`Chủ đề: ${NHAN_CHIP_KAIROS[topic]}. Đổi`}>
                {NHAN_CHIP_KAIROS[topic]}
                <ChevronDownIcon className="h-3.5 w-3.5" />
              </button>
              {mode.kind !== "reshare" && (
                <span className="flex items-center gap-0.5">
                  <button type="button" onClick={() => setPickPort(true)} className={nutPhu} aria-label={port ? `Cảng ${PORT_NAME.get(port) ?? port}. Đổi` : "Gắn cảng"}>
                    <PinIcon className="h-3.5 w-3.5" />
                    {port ? (PORT_NAME.get(port) ?? port) : "Gắn cảng"}
                    <ChevronDownIcon className="h-3.5 w-3.5" />
                  </button>
                  {port && (
                    <button
                      type="button"
                      onClick={() => setPort(null)}
                      aria-label={`Gỡ cảng ${PORT_NAME.get(port) ?? port}`}
                      className="-m-1.5 flex h-11 w-11 items-center justify-center rounded-full text-foreground/65"
                    >
                      <CloseIcon className="h-4 w-4" />
                    </button>
                  )}
                </span>
              )}
            </div>
          </div>
        </div>

        <textarea
          ref={oChu}
          id="kairos-soan"
          aria-label={mode.kind === "reshare" ? "Lời của bạn" : "Nội dung bài"}
          value={text}
          onChange={(e) => {
            onText(e.target.value);
            nt.theoDoi(e.target.value, e.target.selectionStart);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape" && nt.mo) {
              e.stopPropagation(); // đóng danh sách "@", không đóng cả khung soạn
              nt.dong();
            }
          }}
          rows={4}
          placeholder={mode.kind === "reshare" ? "Bà con nghĩ gì về bài này?" : "Bà con muốn chia sẻ gì?"}
          aria-describedby="kairos-soan-dem"
          className="block w-full resize-none rounded-lg border-0 bg-transparent p-0 leading-snug text-foreground placeholder:text-foreground/45"
          // cỡ chữ đặt inline: luật `textarea { font-size: max(16px,1em) }` của globals.css nằm ngoài @layer nên thắng
          // utility. Viền tiêu điểm GIỮ (không huỷ trắng) nhưng nhạt — ô chữ toàn màn không trông như ô biểu mẫu.
          style={{ fontSize: chuTo ? "1.5rem" : "1.0625rem", outlineWidth: 2, outlineColor: "var(--line)", outlineOffset: 6 }}
        />
        {nt.danhSach && <div className="mt-2">{nt.danhSach}</div>}
        <div id="kairos-soan-dem" className="mb-2 mt-1 flex min-h-5 justify-between gap-2 text-[0.8125rem]">
          <span className="text-foreground/65">{draftFail ? "Máy đầy — nháp chưa lưu được" : !online && text.trim() ? "Đã giữ nháp trong máy" : ""}</span>
          {left <= 200 && <span className={`font-semibold tabular-nums ${tooLong ? "text-danger" : "text-foreground/65"}`}>{left}</span>}
        </div>

        {mode.kind === "reshare" ? (
          <div className="mb-3 rounded-2xl border border-line px-3 py-2">
            <p className="truncate text-[0.8125rem] font-semibold text-foreground/65">
              {mode.post.kind === "bao" ? mode.post.outlet : mode.post.author?.handle || (mode.post.kind === "chinh-thuc" ? "SDVICO" : "")}
            </p>
            <p className="line-clamp-2 text-[1rem]">{mode.post.title || mode.post.summary || mode.post.body}</p>
          </div>
        ) : (
          <ImagePicker value={images} onChange={setImages} max={LIMITS.images} upload={upload} label="Ảnh" openRef={anhMo} chiAnh />
        )}

        {err && (
          <p role="alert" className="mt-2 text-[0.875rem] font-semibold text-danger">
            {err}
          </p>
        )}
      </div>

      {/* THANH CÔNG CỤ — dính trên bàn phím: Ảnh · Nói · Cảng · Chủ đề */}
      <div className="flex shrink-0 items-center gap-1 border-t border-line bg-card px-2 py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]">
        <span className="px-2 text-[0.875rem] text-foreground/65">Thêm vào bài</span>
        <span className="flex-1" />
        {mode.kind !== "reshare" && (
          <button type="button" onClick={() => anhMo.current?.()} disabled={images.length >= LIMITS.images} aria-label={NHAN.anh} className={nutCong}>
            <ImageIcon className="h-6 w-6" />
          </button>
        )}
        <NutMic khongVien onChu={(t) => onText(text.trim() ? `${text.trimEnd()} ${t}` : t)} onLoi={setErr} />
        {mode.kind !== "reshare" && (
          <button type="button" onClick={() => setPickPort(true)} aria-label="Gắn cảng" className={nutCong}>
            <PinIcon className="h-6 w-6" />
          </button>
        )}
        <button type="button" onClick={() => setPickTopic(true)} aria-label="Chủ đề" className={nutCong}>
          <NewsIcon className="h-6 w-6" />
        </button>
      </div>

      {pickTopic && (
        <BottomSheet title="Chủ đề bài" onClose={() => setPickTopic(false)}>
          <p className="mb-2 text-[0.875rem] text-foreground/65">Không chọn thì máy tự đoán theo chữ bà con viết.</p>
          <div className="grid gap-1">
            {TOPIC_OPTIONS.map((o) => (
              <button
                key={o.id}
                type="button"
                aria-pressed={topic === o.id}
                onClick={() => {
                  setTopicTay(o.id as Topic);
                  setPickTopic(false);
                }}
                className={`flex h-12 items-center rounded-xl px-3 text-left text-[1rem] font-semibold ${topic === o.id ? "bg-sea/12 text-sea" : "text-navy"}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </BottomSheet>
      )}
      {pickPort && (
        <HomePortSheet
          title="Gắn cảng cho bài"
          note="Bài sẽ hiện ở Bến của cảng này."
          choBo
          onPick={(id) => {
            setPort(id);
            setPickPort(false);
          }}
          onClose={() => setPickPort(false)}
        />
      )}
      {hoiDong && (
        <BottomSheet title={editing ? "Bỏ phần đã sửa?" : "Bỏ bài đang viết?"} onClose={() => setHoiDong(false)}>
          <p className="mb-3 text-[0.875rem] text-foreground/65">Lưu nháp thì lần sau mở lại viết tiếp được, kể cả ảnh.</p>
          <div className="grid gap-2">
            <button type="button" onClick={luuNhap} className="h-(--h-cta) rounded-xl bg-sea font-semibold text-white">
              {NHAN.luuNhap}
            </button>
            <button type="button" onClick={boBai} className="h-(--h-cta) rounded-xl border border-line font-semibold text-danger">
              {NHAN.boBai}
            </button>
            <button type="button" onClick={() => setHoiDong(false)} className="h-(--h-cta) rounded-xl font-semibold text-navy">
              {NHAN.vietTiep}
            </button>
          </div>
        </BottomSheet>
      )}
    </div>,
    document.body,
  );
}

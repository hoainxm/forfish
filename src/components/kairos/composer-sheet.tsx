"use client";

/*
  KHUNG SOẠN BÀI KAIROS (14 §3.3, §3.5, §10; AC07 · AC08 · AC11 · AC14 · AC19).

  Ba kiểu: `new` (ô mời / Bến — cảng điền sẵn) · `edit` (sửa bài của mình) · `reshare` (Đăng
  lại kèm lời mình, thẻ bài gốc bên dưới).
   · chữ ≤2.000 ký tự, đếm lùi khi còn ≤200 · ≤5 ảnh qua ImagePicker (nén image-resize, tải
     TỪNG ảnh ngay khi chọn, lỗi ⇒ Thử lại ảnh đó) · chủ đề (mặc định Nghề cá) · cảng.
   · LẦN ĐẦU: nội quy + Đồng ý (RulesBox). Route trả 409 `rules` cũng mở lại nội quy.
   · MẤT SÓNG: nút Đăng xám "Cần sóng"; chữ vào nháp `forfish.kairos.nhap.v1` từng phím;
     có sóng lại KHÔNG tự gửi — bà con bấm Đăng.
   · Lỗi: câu theo mã ngay trên nút (bad_words, sovereignty, too_long, rate_limited, banned…),
     chữ vẫn nguyên để sửa.
  Chưa đăng nhập ⇒ mời đăng nhập (đọc không cần tài khoản, ghi thì cần).
*/

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ChipRow } from "@/components/ui/chip-row";
import { ImagePicker } from "@/components/market/shared/image-picker";
import { inputClass } from "@/components/ui/primitives";
import { FISHING_PORTS } from "@/data/fishing-ports";
import { loadBoats, loadCurrentBoatId } from "@/lib/boats";
import { TOPICS, type Topic } from "@/lib/kairos/chu-de.mjs";
import { draftKey } from "@/lib/kairos/cache";
import { loadHabit } from "@/lib/kairos/feed-client";
import { LIMITS, type KairosPost } from "@/lib/kairos/types";
import { charLen } from "@/lib/kairos/validate";
import {
  errorText,
  kairosSend,
  kairosUpload,
  loadDraft,
  mediaPathFromUrl,
  saveDraft,
  type KairosMe,
} from "@/lib/kairos/write-client";
import { NHAN, NHAN_CHIP_KAIROS } from "@/lib/labels";
import { useAuthUser } from "@/lib/use-auth";
import { useOnline } from "@/lib/use-online";
import { HomePortSheet } from "./home-port-sheet";
import { RulesBox } from "./rules-box";

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

function keyOf(mode: ComposeMode): string {
  if (mode.kind === "edit") return draftKey("sua", mode.post.id);
  if (mode.kind === "reshare") return `lai:${mode.post.id}`;
  return mode.port ? `ben:${mode.port}` : draftKey("bai");
}

type MeState = { s: "loading" } | { s: "ok"; me: KairosMe } | { s: "offline" } | { s: "error"; text: string };

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

  const [text, setText] = useState(() => loadDraft(phone, dKey) || editing?.body || "");
  const [draftFail, setDraftFail] = useState(false);
  const [images, setImages] = useState<string[]>(() => editing?.images.filter((u) => mediaPathFromUrl(u)) ?? []);
  const paths = useRef(new Map<string, string>());
  const [topic, setTopic] = useState<Topic>(() => (editing && (TOPICS as readonly string[]).includes(editing.topic) ? (editing.topic as Topic) : "nghe-ca"));
  const [port, setPort] = useState<string | null>(() =>
    editing ? editing.ports[0] ?? null : mode.kind === "new" && mode.port ? mode.port : null,
  );
  const [pickPort, setPickPort] = useState(false);
  const [me, setMe] = useState<MeState>({ s: "loading" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [needRules, setNeedRules] = useState(false);

  // Cảng nhà điền sẵn (đọc máy lúc mở khung — không có ở lần vẽ phía máy chủ).
  useEffect(() => {
    if (mode.kind === "new" && !mode.port) setPort((p) => p ?? homePort());
  }, [mode]);

  // Hồ sơ của mình — biết đã đồng ý nội quy chưa. Chỉ gọi khi bà con MỞ khung (không lúc mở app).
  const loadMe = async () => {
    setMe({ s: "loading" });
    const r = await kairosSend<{ me: KairosMe }>("GET", "/api/kairos/me");
    if (r.ok) setMe({ s: "ok", me: r.data.me });
    else if (r.offline) setMe({ s: "offline" });
    else setMe({ s: "error", text: errorText(r) });
  };
  useEffect(() => {
    if (ready && signedIn) void loadMe();
  }, [ready, signedIn]);
  // Mở khung lúc mất sóng ⇒ có sóng lại thì tự hỏi lại, khỏi đóng/mở khung (AC07).
  const meS = me.s;
  useEffect(() => {
    if (online && ready && signedIn && meS === "offline") void loadMe();
  }, [online, ready, signedIn, meS]);

  const onText = (v: string) => {
    setText(v);
    setErr("");
    setDraftFail(!saveDraft(phone, dKey, v));
  };

  const upload = async (blob: Blob) => {
    const r = await kairosUpload(blob);
    if (!r.ok) {
      if (r.code === "rules") setNeedRules(true);
      throw new Error(r.offline ? "Cần sóng" : errorText(r, "anh"));
    }
    paths.current.set(r.data.url, r.data.path);
    return r.data.url;
  };

  const len = charLen(text.trim());
  const left = LIMITS.postBody - len;
  const tooLong = left < 0;
  const empty = !text.trim() && images.length === 0 && mode.kind !== "reshare";
  const rulesOk = me.s === "ok" && me.me.rulesAccepted && !needRules;
  const canSend = online && !busy && !empty && !tooLong && rulesOk;

  const submit = async () => {
    if (!canSend) return;
    setBusy(true);
    setErr("");
    const imgPaths = images.map((u) => paths.current.get(u) ?? mediaPathFromUrl(u)).filter((p): p is string => !!p);
    const body = { body: text, images: imgPaths, topic, ports: port ? [port] : [] };
    const r = editing
      ? await kairosSend<{ post: KairosPost }>("PATCH", `/api/kairos/posts/${editing.id}`, body)
      : await kairosSend<{ post: KairosPost }>("POST", "/api/kairos/posts", mode.kind === "reshare" ? { ...body, reshareOf: mode.post.id } : body);
    setBusy(false);
    if (r.ok) {
      saveDraft(phone, dKey, "");
      onDone(r.data.post);
      return;
    }
    if (r.code === "rules") setNeedRules(true);
    setErr(errorText(r, "bai"));
  };

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

  return (
    <BottomSheet title={title} onClose={onClose} kieu="form">
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
      {me.s === "error" && (
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-danger-bg px-3 py-2">
          <p className="flex-1 text-[0.875rem] font-semibold text-danger">{me.text}</p>
          <button type="button" onClick={() => void loadMe()} className="h-10 rounded-xl bg-card px-3 font-semibold text-sea">
            {NHAN.thuLai}
          </button>
        </div>
      )}

      <label className="mb-1 block text-[0.875rem] font-semibold text-navy" htmlFor="kairos-soan">
        {mode.kind === "reshare" ? "Lời của bạn" : "Nội dung"}
      </label>
      <textarea
        id="kairos-soan"
        value={text}
        onChange={(e) => onText(e.target.value)}
        rows={5}
        placeholder={mode.kind === "reshare" ? "Bà con nghĩ gì về bài này?" : "Bà con có chuyện gì?"}
        aria-describedby="kairos-soan-dem"
        className={`${inputClass} h-auto min-h-32 py-3 leading-relaxed`}
      />
      <div id="kairos-soan-dem" className="mb-3 flex min-h-5 justify-between gap-2 text-[0.8125rem]">
        <span className="text-foreground/65">{draftFail ? "Máy đầy — nháp chưa lưu được" : !online && text.trim() ? "Đã giữ nháp trong máy" : ""}</span>
        {left <= 200 && <span className={`font-semibold tabular-nums ${tooLong ? "text-danger" : "text-foreground/65"}`}>{left}</span>}
      </div>

      {mode.kind === "reshare" ? (
        <div className="mb-3 rounded-2xl border border-line px-3 py-2">
          <p className="truncate text-[0.8125rem] font-semibold text-foreground/65">
            {mode.post.kind === "bao" ? mode.post.outlet : mode.post.kind === "chinh-thuc" ? "SDVICO" : mode.post.author?.handle}
          </p>
          <p className="line-clamp-2 text-[1rem]">{mode.post.title || mode.post.summary || mode.post.body}</p>
        </div>
      ) : (
        <ImagePicker value={images} onChange={setImages} max={LIMITS.images} upload={upload} label="Ảnh" />
      )}

      <p className="mb-1.5 text-[0.875rem] font-semibold text-navy">Chủ đề</p>
      <div className="-mx-5 mb-3">
        <ChipRow options={TOPIC_OPTIONS} value={topic} onChange={(t) => setTopic(t as Topic)} ariaLabel="Chủ đề bài" />
      </div>

      <div className="mb-4 flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-[1rem]">
          <span className="text-foreground/65">Cảng: </span>
          <span className="font-semibold text-navy">{port ? `Cảng ${PORT_NAME.get(port) ?? port}` : "Không gắn"}</span>
        </p>
        <button type="button" onClick={() => setPickPort(true)} className="h-10 rounded-xl border border-line px-3 font-semibold text-sea">
          {NHAN.doi}
        </button>
        {port && (
          <button type="button" onClick={() => setPort(null)} className="h-10 rounded-xl border border-line px-3 font-semibold text-foreground/75">
            {NHAN.bo}
          </button>
        )}
      </div>

      {err && (
        <p role="alert" className="mb-2 text-[0.875rem] font-semibold text-danger">
          {err}
        </p>
      )}
      {me.s === "offline" && <p className="mb-2 text-[0.875rem] text-foreground/65">Mất sóng — viết trước, có sóng bấm Đăng.</p>}

      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={onClose} className="h-(--h-cta) rounded-xl bg-field font-semibold text-foreground/75">
          {NHAN.huy}
        </button>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!canSend}
          aria-busy={busy}
          className="h-(--h-cta) rounded-xl bg-sea font-semibold text-white disabled:opacity-40"
        >
          {!online ? NHAN.canSong : busy ? NHAN.dangGui : editing ? NHAN.luu : NHAN.dang}
        </button>
      </div>

      {pickPort && (
        <HomePortSheet
          title="Gắn cảng cho bài"
          note="Bài sẽ hiện ở Bến của cảng này."
          onPick={(id) => {
            setPort(id);
            setPickPort(false);
          }}
          onClose={() => setPickPort(false)}
        />
      )}
    </BottomSheet>
  );
}

"use client";

/*
  "TÊN TRÊN KAIROS" (14 §3.7, AC12) — mở từ trang người dùng của chính mình.
   · Tên gọi: kiểm NGAY khi gõ bằng luật chung `ten-goi.validateHandle` (2–20 ký tự, chữ/số/
     . - _, cấm giả danh báo/cơ quan/SDVICO, chữ bậy) — câu lỗi nằm DƯỚI Ô. Trùng tên và hạn
     30 ngày chỉ máy chủ biết ⇒ câu lỗi từ mã route (handle_taken / handle_cooldown kèm ngày).
   · Ảnh đại diện tuỳ chọn: nén image-resize ⇒ /api/kairos/upload ⇒ lưu đường kho; Bỏ ảnh ⇒
     về chữ cái đầu trên nền màu.
   · Bật/tắt "Hiện số hiệu tàu" (lấy từ sổ tàu đồng bộ — A23).
  Chỉ gửi trường đã đổi. Mất sóng ⇒ nút Lưu "Cần sóng".
*/

import { useEffect, useRef, useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { inputClass } from "@/components/ui/primitives";
import { resizeForMarket } from "@/lib/market/image-resize";
import { validateHandle } from "@/lib/kairos/ten-goi";
import { errorText, kairosSend, kairosUpload, type KairosMe } from "@/lib/kairos/write-client";
import { LIMITS } from "@/lib/kairos/types";
import { NHAN } from "@/lib/labels";
import { useOnline } from "@/lib/use-online";
import { KairosAvatar } from "./kairos-avatar";

const pad = (n: number) => String(n).padStart(2, "0");
const day = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};

export function ProfileSheet({ me, onClose, onSaved }: { me: KairosMe; onClose: () => void; onSaved: (me: KairosMe) => void }) {
  const online = useOnline();
  const [handle, setHandle] = useState(me.handle);
  const [showBoat, setShowBoat] = useState(me.showBoat);
  /** undefined = không đổi ảnh; null = bỏ ảnh; string = đường kho mới */
  const [avatarPath, setAvatarPath] = useState<string | null | undefined>(undefined);
  const [avatarUrl, setAvatarUrl] = useState(me.avatarUrl);
  const [photo, setPhoto] = useState<"idle" | "busy">("idle");
  const [photoErr, setPhotoErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [handleErr, setHandleErr] = useState("");
  const file = useRef<HTMLInputElement>(null);

  const changedHandle = handle.replace(/\s+/g, " ").trim() !== me.handle;
  const local = changedHandle ? validateHandle(handle) : null;
  const localErr = local && !local.ok ? errorText({ code: local.code, status: 400, offline: false }, "ten") : "";
  // máy chủ trả handleNextChangeAt = null khi đổi được ngay (route /me — canChangeHandle)
  const locked = !!me.handleNextChangeAt;

  // câu lỗi của máy chủ chỉ đúng với chữ đã gửi — gõ tiếp thì bỏ
  useEffect(() => setHandleErr(""), [handle]);

  // nợ: ảnh đã tải mà bà con bấm Huỷ thì nằm lại trong kho (chỉ tốn chỗ, không lộ gì), nâng khi có việc dọn ảnh mồ côi theo lịch
  const pickPhoto = async (f: File | undefined) => {
    if (!f) return;
    setPhoto("busy");
    setPhotoErr("");
    try {
      const blob = await resizeForMarket(f);
      const r = await kairosUpload(blob);
      if (!r.ok) setPhotoErr(errorText(r, "anh"));
      else {
        setAvatarPath(r.data.path);
        setAvatarUrl(r.data.url);
      }
    } catch (e) {
      setPhotoErr((e as Error)?.message || "Không nén được ảnh");
    }
    setPhoto("idle");
    if (file.current) file.current.value = "";
  };

  const body: Record<string, unknown> = {};
  if (changedHandle) body.handle = handle;
  if (showBoat !== me.showBoat) body.showBoat = showBoat;
  if (avatarPath !== undefined) body.avatarPath = avatarPath;
  const dirty = Object.keys(body).length > 0;
  const canSave = online && dirty && !busy && !localErr && photo === "idle" && !(changedHandle && locked);

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    setErr("");
    const r = await kairosSend<{ me: KairosMe }>("PATCH", "/api/kairos/me", body);
    setBusy(false);
    if (r.ok) {
      onSaved(r.data.me);
      return;
    }
    if (r.code.startsWith("handle_") || r.code === "bad_words" || r.code === "sovereignty") setHandleErr(errorText(r, "ten"));
    else setErr(errorText(r, "ten"));
  };

  return (
    <BottomSheet title="Tên trên Kairos" onClose={onClose} kieu="form">
      <div className="mb-4 flex items-center gap-4">
        <KairosAvatar id={me.profileId} name={handle || me.handle} url={avatarUrl} large />
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => file.current?.click()}
            disabled={!online || photo === "busy"}
            className="h-10 rounded-xl border border-line px-3 font-semibold text-sea disabled:opacity-40"
          >
            {photo === "busy" ? NHAN.dangGui : !online ? NHAN.canSong : NHAN.doiAnh}
          </button>
          {avatarUrl && (
            <button
              type="button"
              onClick={() => {
                setAvatarPath(null);
                setAvatarUrl(null);
              }}
              className="h-10 rounded-xl border border-line px-3 font-semibold text-foreground/75"
            >
              {NHAN.boAnh}
            </button>
          )}
        </div>
        <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => void pickPhoto(e.target.files?.[0])} />
      </div>
      {photoErr && (
        <p role="alert" className="-mt-2 mb-3 text-[0.875rem] font-semibold text-danger">
          {photoErr}
        </p>
      )}

      <label htmlFor="kairos-ten" className="mb-1 block text-[0.875rem] font-semibold text-navy">
        Tên gọi
      </label>
      <input
        id="kairos-ten"
        value={handle}
        onChange={(e) => setHandle(e.target.value)}
        maxLength={LIMITS.handleMax + 10}
        disabled={me.official}
        aria-invalid={!!(localErr || handleErr)}
        aria-describedby="kairos-ten-goi-y"
        className={inputClass}
      />
      <p id="kairos-ten-goi-y" className={`mt-1 mb-3 text-[0.8125rem] ${localErr || handleErr ? "font-semibold text-danger" : "text-foreground/65"}`}>
        {me.official
          ? "Tên SDVICO cố định."
          : localErr || handleErr || (locked ? `Đổi lại được từ ${day(me.handleNextChangeAt!)}.` : `${LIMITS.handleMin}–${LIMITS.handleMax} ký tự. 30 ngày đổi 1 lần.`)}
      </p>

      <label className="mb-4 flex min-h-12 items-center gap-3 rounded-xl border border-line px-3">
        <input type="checkbox" checked={showBoat} onChange={(e) => setShowBoat(e.target.checked)} className="h-5 w-5 accent-sea" />
        <span className="flex-1">
          <span className="block font-semibold text-navy">Hiện số hiệu tàu</span>
          <span className="block text-[0.8125rem] text-foreground/65">Lấy từ sổ tàu của bạn, hiện cạnh tên.</span>
        </span>
      </label>

      {err && (
        <p role="alert" className="mb-2 text-[0.875rem] font-semibold text-danger">
          {err}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={onClose} className="h-(--h-cta) rounded-xl bg-field font-semibold text-foreground/75">
          {NHAN.huy}
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={!canSave}
          aria-busy={busy}
          className="h-(--h-cta) rounded-xl bg-sea font-semibold text-white disabled:opacity-40"
        >
          {!online ? NHAN.canSong : busy ? NHAN.dangGui : NHAN.luu}
        </button>
      </div>
    </BottomSheet>
  );
}

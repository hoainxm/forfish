"use client";

/*
  "TÊN TRÊN KAIROS" (14 §3.7, AC12) — mở từ trang người dùng của chính mình.
   · Tên gọi: kiểm NGAY khi gõ bằng luật chung `ten-goi.validateHandle` (2–20 ký tự, chữ/số/
     . - _, cấm giả danh báo/cơ quan/SDVICO, chữ bậy) — câu lỗi nằm DƯỚI Ô. Trùng tên và hạn
     30 ngày chỉ máy chủ biết ⇒ câu lỗi từ mã route (handle_taken / handle_cooldown kèm ngày).
   · Ảnh đại diện tuỳ chọn: nén image-resize ⇒ /api/kairos/upload ⇒ lưu đường kho; Bỏ ảnh ⇒
     về chữ cái đầu trên nền màu.
   · Bật/tắt "Hiện số hiệu tàu" (lấy từ sổ tàu đồng bộ — A23).
   · GIỚI THIỆU (0067, AC13 bản 2026-10-24): quê (34 tỉnh — khu-vuc.mjs) · cảng nhà (HomePortSheet,
     danh mục fishing-ports; thắng cảng theo sổ tàu) · nghề (ho-so.NGHE) · một dòng tự giới thiệu
     ≤150 ký tự (đếm ngược dưới ô). Máy chủ chưa có cột ⇒ câu `fields_missing`.
  Chỉ gửi trường đã đổi. Mất sóng ⇒ nút Lưu "Cần sóng".
*/

import { useEffect, useRef, useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { inputClass } from "@/components/ui/primitives";
import { FISHING_PORTS } from "@/data/fishing-ports";
import { GIOI_THIEU_MAX, NGHE, TINH_LIST } from "@/lib/kairos/ho-so";
import { charLen } from "@/lib/kairos/validate";
import { resizeForMarket } from "@/lib/market/image-resize";
import { validateHandle } from "@/lib/kairos/ten-goi";
import { errorText, kairosSend, kairosUpload, type KairosMe } from "@/lib/kairos/write-client";
import { LIMITS } from "@/lib/kairos/types";
import { NHAN } from "@/lib/labels";
import { useOnline } from "@/lib/use-online";
import { HomePortSheet } from "./home-port-sheet";
import { KairosAvatar } from "./kairos-avatar";

const PORT_NAME = new Map(FISHING_PORTS.map((p) => [p.id, p.name]));

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
  const [queTinh, setQueTinh] = useState(me.about.queTinh ?? "");
  const [nghe, setNghe] = useState(me.about.nghe ?? "");
  const [homePort, setHomePort] = useState(me.about.homePort ?? "");
  const [gioiThieu, setGioiThieu] = useState(me.about.gioiThieu);
  const [pickPort, setPickPort] = useState(false);
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
  if (queTinh !== (me.about.queTinh ?? "")) body.queTinh = queTinh || null;
  if (nghe !== (me.about.nghe ?? "")) body.nghe = nghe || null;
  if (homePort !== (me.about.homePort ?? "")) body.homePort = homePort || null;
  const bio = gioiThieu.replace(/\s+/g, " ").trim();
  if (bio !== me.about.gioiThieu) body.gioiThieu = bio || null;
  const bioLeft = GIOI_THIEU_MAX - charLen(bio);
  const dirty = Object.keys(body).length > 0;
  const canSave = online && dirty && !busy && !localErr && photo === "idle" && !(changedHandle && locked) && bioLeft >= 0;

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
    else setErr(errorText(r, "gioiThieu" in body && r.code === "too_long" ? "ho-so" : "ten"));
  };

  return (
    <BottomSheet title="Sửa trang" onClose={onClose} kieu="form">
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

      <h3 className="mb-2 font-bold text-navy">{NHAN.gioiThieu}</h3>
      <label htmlFor="kairos-que" className="mb-1 block text-[0.875rem] font-semibold text-navy">
        Quê
      </label>
      <select id="kairos-que" value={queTinh} onChange={(e) => setQueTinh(e.target.value)} className={`${inputClass} mb-3`}>
        <option value="">Chưa chọn</option>
        {TINH_LIST.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>

      <span className="mb-1 block text-[0.875rem] font-semibold text-navy">Cảng nhà</span>
      <div className="mb-3 flex gap-2">
        <button
          type="button"
          onClick={() => setPickPort(true)}
          className={`${inputClass} flex-1 text-left ${homePort ? "text-navy" : "text-foreground/65"}`}
        >
          {homePort ? `Cảng ${PORT_NAME.get(homePort) ?? homePort}` : "Chưa chọn"}
        </button>
        {homePort && (
          <button type="button" onClick={() => setHomePort("")} className="shrink-0 rounded-xl border border-line px-3 font-semibold text-foreground/75">
            {NHAN.bo}
          </button>
        )}
      </div>

      <label htmlFor="kairos-nghe" className="mb-1 block text-[0.875rem] font-semibold text-navy">
        Nghề
      </label>
      <select id="kairos-nghe" value={nghe} onChange={(e) => setNghe(e.target.value)} className={`${inputClass} mb-3`}>
        <option value="">Chưa chọn</option>
        {NGHE.map((n) => (
          <option key={n.id} value={n.id}>
            {n.name}
          </option>
        ))}
      </select>

      <label htmlFor="kairos-gioi-thieu" className="mb-1 block text-[0.875rem] font-semibold text-navy">
        Đôi dòng về bạn
      </label>
      <textarea
        id="kairos-gioi-thieu"
        value={gioiThieu}
        onChange={(e) => setGioiThieu(e.target.value)}
        rows={2}
        maxLength={GIOI_THIEU_MAX + 20}
        placeholder="Vd: Đi biển 20 năm, chuyên câu mực"
        aria-describedby="kairos-gioi-thieu-dem"
        aria-invalid={bioLeft < 0}
        className={`${inputClass.replace("h-(--h-ctl)", "min-h-(--h-ctl)")} py-2`}
      />
      <p id="kairos-gioi-thieu-dem" className={`mt-1 mb-4 text-right text-[0.8125rem] ${bioLeft < 0 ? "font-semibold text-danger" : "text-foreground/65"}`}>
        {bioLeft < 0 ? `Dài quá ${-bioLeft} ký tự` : `Còn ${bioLeft} ký tự`}
      </p>

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
      {pickPort && (
        <HomePortSheet
          title="Cảng nhà"
          note="Hiện dưới tên bạn trên Kairos, thay cảng theo sổ tàu."
          onClose={() => setPickPort(false)}
          onPick={(id) => {
            setHomePort(id);
            setPickPort(false);
          }}
        />
      )}
    </BottomSheet>
  );
}

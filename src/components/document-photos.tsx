"use client";

import { useEffect, useRef, useState } from "react";
import {
  compressImage,
  uploadDocPhoto,
  docPhotoUrl,
  deleteDocPhoto,
} from "@/lib/doc-photos";
import { CloseIcon } from "@/components/icons";

// Dải ẢNH GIẤY TỜ của một giấy tờ (P3). Xem lib/doc-photos + /api/me/docs/photo.
// v1: cần CÓ SÓNG để thêm/xem ảnh (signed URL). Offline → chặn thêm + báo rõ.

const MAX_PHOTOS = 4;

/** Một ảnh: lấy signed URL rồi hiện; mất sóng → placeholder, KHÔNG vỡ layout. */
function Thumb({
  path,
  onDelete,
  canDelete,
}: {
  path: string;
  onDelete: () => void;
  canDelete: boolean;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    docPhotoUrl(path).then((u) => {
      if (!alive) return;
      setUrl(u);
      setFailed(!u);
    });
    return () => {
      alive = false;
    };
  }, [path]);

  return (
    <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-line bg-field">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed URL động
        <img src={url} alt="Ảnh giấy tờ" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center px-1 text-center text-[0.75rem] text-navy/60">
          {failed ? "Cần sóng để xem" : "Đang tải…"}
        </div>
      )}
      {canDelete && (
        <button
          type="button"
          onClick={onDelete}
          aria-label="Xoá ảnh này"
          className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-full bg-navy/70 text-white active:scale-95"
        >
          <CloseIcon className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}

export function DocPhotoStrip({
  docId,
  photos,
  onChange,
  online,
}: {
  docId: string;
  photos: string[];
  onChange: (photos: string[]) => void;
  online: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // cho phép chọn lại cùng file
    if (!file) return;
    setErr(null);
    setBusy(true);
    try {
      const blob = await compressImage(file);
      const path = await uploadDocPhoto(docId, blob);
      if (!path) {
        setErr("Chưa tải được ảnh lên — cần có sóng, thử lại khi có mạng.");
        return;
      }
      onChange([...photos, path]);
    } catch {
      setErr("Ảnh không đọc được — thử ảnh khác giúp nhé.");
    } finally {
      setBusy(false);
    }
  }

  function onDel(path: string) {
    onChange(photos.filter((p) => p !== path)); // gỡ khỏi sổ NGAY (đồng bộ liền)
    void deleteDocPhoto(path); // dọn Storage nền — best-effort, không chặn
  }

  return (
    <div className="mt-2.5">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {photos.map((p) => (
          <Thumb key={p} path={p} onDelete={() => onDel(p)} canDelete={online} />
        ))}
        {online && photos.length < MAX_PHOTOS && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="flex h-24 w-24 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-line text-[0.8125rem] font-semibold text-navy/70 active:scale-[0.98] disabled:opacity-60"
          >
            {busy ? (
              "Đang tải…"
            ) : (
              <>
                <span className="text-[1.5rem] leading-none">+</span>
                Thêm ảnh
              </>
            )}
          </button>
        )}
      </div>
      {!online && (
        <p className="text-[0.8125rem] text-navy/60">
          {photos.length ? "Cần sóng để xem/sửa ảnh." : "Thêm ảnh giấy tờ khi có sóng."}
        </p>
      )}
      {err && <p className="mt-1 text-[0.8125rem] text-danger">{err}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onPick}
        className="hidden"
      />
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import {
  compressImage,
  uploadDocPhoto,
  docPhotoUrl,
  deleteDocPhoto,
} from "@/lib/doc-photos";
import { CloseIcon, PlusIcon, TrashIcon } from "@/components/icons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

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
        <img src={url} alt="Ảnh chụp giấy tờ" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center px-1 text-center text-[0.75rem] text-navy/60">
          {failed ? "Cần có mạng để xem" : "Đang tải…"}
        </div>
      )}
      {canDelete && (
        <button
          type="button"
          onClick={onDelete}
          aria-label="Xoá ảnh này"
          /*  56px chứ không 44px (luật A5): nút này nằm ĐÈ lên ảnh 96px, tay
              ướt trượt một cái là mất ảnh giấy tờ thật. */
          className="absolute right-1 top-1 flex h-14 w-14 items-center justify-center rounded-full bg-navy/70 text-white active:scale-95"
        >
          <CloseIcon className="h-6 w-6" />
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
  /*  Ảnh giấy tờ THẬT: gỡ khỏi sổ là `deleteDocPhoto` xoá luôn trên Storage,
      không hoàn tác được — mất là phải lôi giấy ra chụp lại, mà chụp lại còn
      cần có sóng. Mọi hành động phá huỷ khác của /tau đều qua ConfirmDialog
      (document-vault, maintenance-reminders, boat-products, boat-switcher);
      hai hàng kề nhau không được chạy hai luật (2026-08-29, luật D2). */
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

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
        setErr("Ảnh chưa tải lên được. Bà con chờ có mạng rồi thử lại nhé.");
        return;
      }
      onChange([...photos, path]);
    } catch {
      setErr("Định dạng ảnh không hỗ trợ, bà con thử chọn ảnh khác nhé.");
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
          <Thumb
            key={p}
            path={p}
            onDelete={() => setConfirmDel(p)}
            canDelete={online}
          />
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
                {/* icon stroke như mọi nút khác — không dùng ký tự "+" cỡ
                    ngoài type-ramp (03-design-system §Type ramp) */}
                <PlusIcon className="h-6 w-6" />
                Thêm ảnh
              </>
            )}
          </button>
        )}
      </div>
      {!online && (
        <p className="text-[0.8125rem] text-navy/60">
          {photos.length ? "Cần có mạng để xem hoặc sửa ảnh." : "Bà con có thể thêm ảnh giấy tờ khi điện thoại kết nối mạng."}
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
      {confirmDel && (
        <ConfirmDialog
          icon={<TrashIcon className="h-8 w-8 text-danger" />}
          title="Xác nhận xoá ảnh này?"
          message="Nếu xoá, bà con sẽ cần chụp lại và cần có mạng để tải lên lần nữa."
          cancelLabel="Không xoá"
          confirmLabel="Xác nhận xoá"
          onCancel={() => setConfirmDel(null)}
          onConfirm={() => {
            onDel(confirmDel);
            setConfirmDel(null);
          }}
        />
      )}
    </div>
  );
}

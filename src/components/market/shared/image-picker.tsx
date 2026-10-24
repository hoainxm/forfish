"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { PlusIcon } from "@/components/icons";
import { CloseButton } from "@/components/ui/close-button";
import { resizeForMarket } from "@/lib/market/image-resize";
import { PRODUCT_IMAGE_MAX } from "@/lib/market/validate";

type Pending = { key: string; file: File; state: "dang_nen" | "dang_tai" | "loi"; error?: string; preview: string };

/**
 * Chọn + nén + tải ảnh sản phẩm (12 §8.1). Mỗi ảnh đi riêng: nén qua
 * `resizeForMarket` rồi gọi `upload`; ảnh lỗi ⇒ thẻ đỏ + Thử lại ảnh đó (không
 * chặn ảnh khác). Hàng ảnh cuộn ngang, nút X `<CloseButton>` để bỏ ảnh đã lên.
 */
export function ImagePicker({
  value,
  onChange,
  max = PRODUCT_IMAGE_MAX,
  upload,
  label = "Ảnh sản phẩm",
  openRef,
  chiAnh = false,
}: {
  value: string[];
  onChange: (urls: string[]) => void;
  max?: number;
  upload: (blob: Blob) => Promise<string>;
  label?: string;
  /** bên ngoài mở hộp chọn ảnh (vd nút Ảnh ở thanh công cụ khung soạn Kairos) */
  openRef?: MutableRefObject<(() => void) | null>;
  /** chỉ hiện ảnh (to hơn), không nhãn, không ô "Thêm ảnh" — nút thêm nằm chỗ khác */
  chiAnh?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!openRef) return;
    openRef.current = () => inputRef.current?.click();
    return () => {
      openRef.current = null;
    };
  }, [openRef]);
  const [pending, setPending] = useState<Pending[]>([]);
  // `value` đổi giữa chừng (bà con bỏ một ảnh lúc ảnh khác đang tải) ⇒ luôn
  // cộng vào bản MỚI NHẤT, không đè bằng bản cũ trong closure.
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  }, [value]);

  const room = Math.max(0, max - value.length - pending.filter((p) => p.state !== "loi").length);

  const patch = (key: string, p: Partial<Pending>) =>
    setPending((cur) => cur.map((x) => (x.key === key ? { ...x, ...p } : x)));

  async function run(item: Pending) {
    patch(item.key, { state: "dang_nen", error: undefined });
    let blob: Blob;
    try {
      blob = await resizeForMarket(item.file);
    } catch (e) {
      patch(item.key, { state: "loi", error: (e as Error)?.message || "Không nén được ảnh" });
      return;
    }
    patch(item.key, { state: "dang_tai" });
    try {
      const url = await upload(blob);
      if (!url) throw new Error("Máy chủ không trả đường dẫn ảnh");
      onChange([...latest.current, url]);
      setPending((cur) => cur.filter((x) => x.key !== item.key));
      URL.revokeObjectURL(item.preview);
    } catch (e) {
      patch(item.key, { state: "loi", error: (e as Error)?.message || "Chưa tải được — cần sóng" });
    }
  }

  function pick(files: FileList | null) {
    if (!files || files.length === 0) return;
    const take = Array.from(files).slice(0, room);
    const items: Pending[] = take.map((file) => ({
      key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      state: "dang_nen",
      preview: URL.createObjectURL(file),
    }));
    setPending((cur) => [...cur, ...items]);
    for (const it of items) void run(it);
    if (inputRef.current) inputRef.current.value = "";
  }

  const remove = (url: string) => onChange(latest.current.filter((u) => u !== url));
  const dropPending = (key: string) =>
    setPending((cur) => {
      const it = cur.find((x) => x.key === key);
      if (it) URL.revokeObjectURL(it.preview);
      return cur.filter((x) => x.key !== key);
    });

  const o = chiAnh ? "h-36 w-36" : "h-28 w-28";
  const coAnh = value.length + pending.length > 0;
  return (
    <div className={chiAnh ? (coAnh ? "mb-2" : "") : "mb-3.5"}>
      {!chiAnh && (
        <p className="mb-1.5 text-[1rem] font-semibold text-navy">
          {label} <span className="font-normal text-foreground/65">({value.length}/{max})</span>
        </p>
      )}
      <div className={`-mx-4 flex gap-2 overflow-x-auto cuon-an px-4 ${coAnh || !chiAnh ? "pb-1" : "hidden"}`}>
        {value.map((url, i) => (
          <div key={url} className={`relative ${o} shrink-0 overflow-hidden rounded-2xl bg-field`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- ảnh vừa tải lên bucket public / dev */}
            <img src={url} alt={`Ảnh ${i + 1}`} className="h-full w-full object-cover" />
            {i === 0 && !chiAnh && (
              <span className="absolute bottom-1 left-1 rounded-full px-2 py-0.5 text-[0.75rem] font-semibold" style={{ backgroundColor: "var(--card)", color: "var(--navy)" }}>
                Ảnh bìa
              </span>
            )}
            <CloseButton onClose={() => remove(url)} label={`Bỏ ảnh ${i + 1}`} className="absolute right-0 top-0 bg-card/80" />
          </div>
        ))}
        {pending.map((p) => (
          <div
            key={p.key}
            className={`relative ${o} shrink-0 overflow-hidden rounded-2xl`}
            style={p.state === "loi" ? { backgroundColor: "var(--danger-bg)" } : { backgroundColor: "var(--field)" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- xem trước từ máy (blob:) */}
            <img src={p.preview} alt="" className={`h-full w-full object-cover ${p.state === "loi" ? "opacity-30" : "opacity-60"}`} />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-1 text-center">
              {p.state === "loi" ? (
                <>
                  <span className="text-[0.75rem] font-semibold" style={{ color: "var(--danger)" }}>{p.error}</span>
                  <button
                    type="button"
                    onClick={() => void run(p)}
                    className="min-h-[2.75rem] rounded-full px-3 text-[0.875rem] font-semibold"
                    style={{ backgroundColor: "var(--card)", color: "var(--navy)" }}
                  >
                    Thử lại
                  </button>
                </>
              ) : (
                <span className="rounded-full px-2 py-1 text-[0.8125rem] font-semibold" style={{ backgroundColor: "var(--card)", color: "var(--navy)" }}>
                  {p.state === "dang_nen" ? "Đang nén…" : "Đang tải…"}
                </span>
              )}
            </div>
            {p.state === "loi" && <CloseButton onClose={() => dropPending(p.key)} label="Bỏ ảnh lỗi" className="absolute right-0 top-0" />}
          </div>
        ))}
        {room > 0 && !chiAnh && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex h-28 w-28 shrink-0 flex-col items-center justify-center gap-1 rounded-2xl bg-field text-[0.875rem] font-semibold text-navy transition active:scale-95"
            aria-label="Thêm ảnh"
          >
            <PlusIcon className="h-7 w-7" />
            Thêm ảnh
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={max > 1}
        className="hidden"
        onChange={(e) => pick(e.target.files)}
      />
    </div>
  );
}

"use client";
/*
  THẺ NỔI QUẢNG BÁ Ở BẢN ĐỒ (2026-10-31, anh Long: "lâu lâu đẩy ở màn bản đồ kiểu notify (hiện mấy s đợi click rồi ẩn)").
  · Ngồi Bản đồ đủ CHO_MS (20 s) mới hiện — mở bản đồ để coi biển, không bị chặn ngay.
  · Tối đa một lần mỗi CACH_MS (4 giờ) trên máy này (`forfish.km.xoay.v1 › banDo`); hiện HIEN_MS (7 s) rồi tự ẩn.
  · KHÔNG hiện khi đang dẫn đường / chạy / Sen Biển mở (`an`) — lúc đó mắt phải ở hải đồ.
  · CHỈ KHI CÓ SÓNG (anh Long: "quảng cáo bản đồ chỉ lúc online thôi nhé, đừng có làm gánh nặng offline") — mất sóng thì
    không đếm giờ, không ghi kho, không vẽ; đang hiện mà rớt sóng thì ẩn luôn.
  · Bấm thẻ ⇒ Trang chủ `/?km=<id>` (khuyen-mai-card mở clip hoặc ngăn Đăng ký). × chấm nhỏ góc trên phải (luật thẻ nổi 03 §6
    mục 8): đóng sớm, cũng tính là đã hiện.
*/
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { chonQuangCao, docXoay, ghiXoay } from "@/components/khuyen-mai-card";
import { CloseIcon, PlayIcon } from "@/components/icons";
import { tienVn, type KhuyenMai } from "@/data/khuyen-mai";
import { useOnline } from "@/lib/use-online";

export const CHO_MS = 20_000;
export const HIEN_MS = 7_000;
export const CACH_MS = 4 * 3600_000;

/** Tới lượt bật thẻ nổi chưa — THUẦN (test được). */
export function toiLuotBanDo(lanCuoi: number | undefined, now: number): boolean {
  return !lanCuoi || now - lanCuoi >= CACH_MS;
}

export function QuangCaoNoi({ an }: { an: boolean }) {
  const router = useRouter();
  const online = useOnline();
  const [k, setK] = useState<KhuyenMai | null>(null);
  const tat = an || !online;

  useEffect(() => {
    if (tat) return;
    const t = window.setTimeout(() => {
      if (!toiLuotBanDo(docXoay().banDo, Date.now())) return;
      const mon = chonQuangCao();
      if (!mon) return;
      ghiXoay({ banDo: Date.now() });
      setK(mon);
    }, CHO_MS);
    return () => window.clearTimeout(t);
  }, [tat]);

  useEffect(() => {
    if (!k) return;
    const t = window.setTimeout(() => setK(null), HIEN_MS);
    return () => window.clearTimeout(t);
  }, [k]);

  if (!k || tat) return null;
  return (
    <div
      role="status"
      className="fixed left-4 right-16 z-40 max-w-[22rem]"
      style={{ bottom: "calc(var(--dock-total) + 5rem)" }}
    >
      <div className="surface relative flex items-center gap-3 rounded-2xl px-3 py-2.5 shadow-lg">
        <button
          type="button"
          onClick={() => {
            setK(null);
            router.push(`/?km=${k.id}`);
          }}
          aria-label={k.video ? `Xem video ${k.ten}` : `Đăng ký ${k.ten}`}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl">
            <Image src={k.image} alt="" width={k.imgW} height={k.imgH} sizes="3rem" className="h-full w-full object-cover" />
            {k.video && (
              <span className="absolute inset-0 flex items-center justify-center bg-navy/35 text-white">
                <PlayIcon className="ml-0.5 h-5 w-5" />
              </span>
            )}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[1rem] font-semibold text-navy">{k.ten}</span>
            <span className="block text-[0.875rem] font-semibold text-t3">
              {k.giaTu ? "Từ " : ""}
              {tienVn(k.giaApp)}
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => setK(null)}
          aria-label="Đóng"
          className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-navy text-white"
        >
          <CloseIcon className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

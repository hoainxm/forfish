"use client";

/*
  THẺ "ĐÃ LƯU" — bài bà con lưu MANG THEO (14 §18). Chỉ đọc trong máy (`forfish.kairos.luu.v1`, ngăn SĐT;
  khách có ngăn khách), KHÔNG request nào ⇒ mất sóng mở vẫn y nguyên. Ảnh: thẻ bài giữ URL gốc, sw.js trả
  từ kho `kairos-luu-anh-v1`; ảnh chưa lưu được thì thẻ ghi "Có N ảnh — cần sóng".
  Đọc lại khi bấm Lưu/Bỏ lưu ở bất kỳ thẻ nào (sự kiện `kairos:luu`) hoặc tab khác đổi khoá (storage).
*/

import { useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/primitives";
import { LUU_KEY, LUU_MAX_ANH_BYTES, LUU_MAX_POSTS, type BaiLuu } from "@/lib/kairos/luu-bai";
import { docBaiLuu, LUU_EVENT } from "@/lib/kairos/luu-client";
import type { KairosPost } from "@/lib/kairos/types";
import { PostCard, type PostActions } from "./post-card";

const mb = (b: number) => (b / (1024 * 1024)).toFixed(b < 10 * 1024 * 1024 ? 1 : 0).replace(".", ",");

export function SavedPosts({
  phone,
  now,
  actions,
  view,
}: {
  phone: string | null;
  now: number;
  actions?: PostActions;
  /** áp Hay/sửa/xoá/chặn cục bộ (use-post-actions) */
  view?: (list: readonly KairosPost[]) => KairosPost[];
}) {
  const [list, setList] = useState<BaiLuu[] | null>(null);
  useEffect(() => {
    const doc = () => setList(docBaiLuu(phone));
    doc();
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === LUU_KEY) doc();
    };
    window.addEventListener(LUU_EVENT, doc);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(LUU_EVENT, doc);
      window.removeEventListener("storage", onStorage);
    };
  }, [phone]);

  if (!list) return null;
  if (!list.length) {
    return (
      <div className="px-4">
        <EmptyState>Chưa lưu bài nào. Bấm ⋯ trên bài rồi chọn Lưu — ra khơi mất sóng vẫn đọc được, cả ảnh.</EmptyState>
      </div>
    );
  }
  const anh = list.reduce((n, e) => n + e.anh.reduce((m, a) => m + a.bytes, 0), 0);
  const posts = view ? view(list.map((e) => e.post)) : list.map((e) => e.post);
  return (
    <div className="space-y-3 px-4">
      <p className="text-[0.875rem] text-foreground/65">
        {list.length}/{LUU_MAX_POSTS} bài · ảnh {mb(anh)}/{mb(LUU_MAX_ANH_BYTES)} MB — mất sóng vẫn đọc được
      </p>
      {posts.map((p) => (
        <PostCard key={p.id} post={p} now={now} actions={actions} />
      ))}
    </div>
  );
}

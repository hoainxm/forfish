"use client";

/*
  MỤC "ĐÁNH GIÁ" của tab Chợ vật tư — HÀNG ĐỢI KIỂM DUYỆT CẢ SÀN (2026-09-07).

  Vì sao có mục này: 11 §7 giao cho admin việc "ẩn đánh giá vi phạm", nhưng
  đường duy nhất để tới một đánh giá là mở đúng chi tiết món của nó. Với sàn
  vài trăm món thì đó không phải một việc làm được — luật có trên giấy mà không
  có lối đi. Mục này liệt kê đánh giá MỚI NHẤT TRƯỚC của toàn sàn, kèm bộ lọc
  sao thấp (chỗ lời lẽ nặng thường nằm).

  Ẩn/hiện KHÔNG hỏi lại: quản trị viên được quyền làm, thêm hộp xác nhận cho
  từng thẻ chỉ làm chậm việc soát hàng loạt (chủ dự án chốt 2026-09-07). Bù lại
  phải NÓI RÕ kết quả — bản trước ẩn xong im lặng, không biết đã ăn hay chưa.
*/

import { useState } from "react";
import type { Review } from "@/lib/market/types";
import { RatingStars } from "@/components/market/shared/rating-stars";
import {
  EmptyBox,
  ErrorBox,
  FilterChip,
  LoadingBox,
  NoticeBar,
  PageHint,
  marketAdminPatch,
  useAdminList,
} from "./market-admin-shared";

/** Lọc theo sao: mặc định mở ở "≤ 2 sao" — đó là việc admin thật sự tới đây làm. */
type SaoFilter = "2" | "3" | "all";
const SAO: [SaoFilter, string][] = [
  ["2", "1–2 sao"],
  ["3", "1–3 sao"],
  ["all", "Tất cả"],
];

export function MarketAdminReviews({ onChanged }: { onChanged: () => void }) {
  const [sao, setSao] = useState<SaoFilter>("2");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);

  const qs = sao === "all" ? "" : `?sao=${sao}`;
  const list = useAdminList<Review>(`/api/admin/cho/danh-gia${qs}`);

  async function toggle(r: Review) {
    setBusyId(r.id);
    setNotice(null);
    try {
      await marketAdminPatch(`/api/admin/cho/danh-gia/${encodeURIComponent(r.id)}`, { hidden: !r.hidden });
      setNotice({
        text: r.hidden
          ? "Đã hiện lại đánh giá — điểm sao của món và gian hàng tính lại ngay."
          : "Đã ẩn đánh giá — điểm sao của món và gian hàng tính lại ngay.",
        ok: true,
      });
      list.refresh();
      onChanged();
    } catch (e) {
      setNotice({ text: (e as Error).message, ok: false });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-3">
      <p className="surface px-4 py-3 text-[0.875rem] leading-snug text-foreground/70">
        Đánh giá của <b>cả sàn</b>, mới nhất trước. Ẩn một đánh giá là nó biến khỏi trang món và
        <b> không còn được tính điểm sao</b> cho món lẫn gian hàng; hiện lại thì tính lại. Người
        viết không được báo. Mọi lần ẩn/hiện đều vào nhật ký dưới tên bạn.
      </p>

      <div className="flex flex-wrap gap-1.5">
        {SAO.map(([id, label]) => (
          <FilterChip
            key={id}
            label={label}
            active={sao === id}
            onClick={() => {
              setSao(id);
              setNotice(null);
            }}
          />
        ))}
      </div>

      {notice && <NoticeBar text={notice.text} ok={notice.ok} onClose={() => setNotice(null)} />}
      {list.error && <ErrorBox text={list.error} onRetry={list.reload} />}
      {!list.rows && !list.error && <LoadingBox what="đánh giá" />}

      {list.rows && list.rows.length === 0 && (
        <EmptyBox
          text={
            sao === "all"
              ? "Chợ chưa có đánh giá nào."
              : `Không có đánh giá ${SAO.find(([id]) => id === sao)?.[1].toLowerCase()} nào — bộ lọc đang thu hẹp, chọn "Tất cả" để coi hết.`
          }
        />
      )}

      {list.rows && list.rows.length > 0 && (
        <>
          <PageHint
            shown={list.rows.length}
            total={list.total}
            what="đánh giá"
            note={
              sao === "all" ? undefined : <>Chỉ đếm đánh giá <b>{SAO.find(([id]) => id === sao)?.[1]}</b>.</>
            }
            onMore={list.loadMore}
            loadingMore={list.loadingMore}
          />
          <ul className="space-y-1.5">
            {list.rows.map((r) => (
              <li key={r.id} className="surface flex flex-wrap items-start gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <RatingStars value={r.rating} />
                    <span className="text-[0.875rem] text-foreground/70">{r.buyerPhoneMasked}</span>
                    {r.hidden && (
                      <span
                        className="rounded-full px-2 py-0.5 text-[0.8125rem] font-bold"
                        style={{ backgroundColor: "var(--danger-bg)", color: "var(--danger)" }}
                      >
                        Đang ẩn
                      </span>
                    )}
                  </div>
                  {r.comment ? (
                    <p className="mt-1 whitespace-pre-wrap text-[0.9375rem] leading-snug text-navy">{r.comment}</p>
                  ) : (
                    <p className="mt-1 text-[0.9375rem] text-foreground/55">(chỉ chấm sao, không viết gì)</p>
                  )}
                  {/*  Đường sang chính món bị đánh giá — soát xong thường phải coi
                       luôn món đó bán gì, và có khi phải gỡ cả món. */}
                  <p className="mt-1 text-[0.8125rem] text-foreground/55">
                    Món <code className="tabular-nums">{r.productId.slice(0, 8)}</code> · đơn{" "}
                    <code className="tabular-nums">{r.orderId.slice(0, 8)}</code>
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => void toggle(r)}
                  className={`min-h-[2.75rem] shrink-0 rounded-xl px-5 text-[0.9375rem] font-bold disabled:opacity-50 ${
                    r.hidden ? "bg-field text-navy" : "bg-danger-bg text-danger"
                  }`}
                >
                  {busyId === r.id ? "Đang lưu…" : r.hidden ? "Hiện lại" : "Ẩn"}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

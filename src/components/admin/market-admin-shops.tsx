"use client";

/*
  Mục "Gian hàng" của tab Chợ vật tư (11 §7, 12 §7.3 + §8.4).
  Việc chính của admin ở đây là DUYỆT — nên danh sách mở ra ở `cho_duyet`.
  Mọi hành động ghi đều qua hộp xác nhận; từ chối/khoá bắt buộc lý do (5–300),
  và mỗi lần ghi để lại một dòng nhật ký admin (market.shop-status / -owner).
*/

import { useEffect, useState } from "react";
import { formatVnDate } from "@/lib/format";
import { isValidVnPhone, sanitizePhoneInput } from "@/lib/phone";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { Shop, ShopStatus } from "@/lib/market/types";
import {
  EmptyBox,
  ErrorBox,
  FilterChip,
  LoadingBox,
  marketAdminPatch,
  NoticeBar,
  PageHint,
  ReasonDialog,
  SHOP_STATUS_LABEL,
  ShopStatusChip,
  useAdminList,
} from "./market-admin-shared";

export type ShopRow = Shop & { productCount: number };
type Filter = ShopStatus | "all";
type Pending = "duyet" | "mo-lai" | "tu-choi" | "tam-khoa" | null;

const FILTERS: [Filter, string][] = [
  ["cho_duyet", "Chờ duyệt"],
  ["hoat_dong", "Đang bán"],
  ["tam_khoa", "Tạm khoá"],
  ["tu_choi", "Bị từ chối"],
  ["all", "Tất cả"],
];

const dayOf = (iso: string) => formatVnDate(iso.slice(0, 10));

export function MarketAdminShops({
  onPickShopOrders,
  onChanged,
}: {
  onPickShopOrders: (shop: ShopRow) => void;
  onChanged: () => void;
}) {
  const [filter, setFilter] = useState<Filter>("cho_duyet");
  const [openId, setOpenId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  /*  Băng kết quả thao tác TẮT khi đổi bộ lọc (2026-09-07): câu "Đã duyệt gian
      hàng X" đứng nguyên trong lúc staff đã sang danh sách khác là nói về một
      thứ không còn trên màn. Lỗi tải thì khác — nó thuộc về lần tải, do ErrorBox
      lo. */
  useEffect(() => setNotice(null), [filter]);

  const { rows, total, error, loadingMore, reload, refresh, loadMore } = useAdminList<ShopRow>(
    `/api/admin/cho/shops?status=${filter}`,
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map(([id, label]) => (
          <FilterChip key={id} label={label} active={filter === id} onClick={() => setFilter(id)} />
        ))}
      </div>

      {notice && (
        <NoticeBar ok={notice.ok} text={notice.text} onClose={() => setNotice(null)} />
      )}

      {error && <ErrorBox text={error} onRetry={reload} />}
      {!rows && !error && <LoadingBox what="gian hàng" />}
      {rows && rows.length === 0 && (
        <EmptyBox
          text={
            filter === "all"
              ? "Chợ chưa có gian hàng nào."
              : filter === "cho_duyet"
                ? 'Không có gian hàng nào chờ duyệt — chọn "Tất cả" để xem mọi gian hàng.'
                : `Không có gian hàng ${SHOP_STATUS_LABEL[filter as ShopStatus]?.toLowerCase() ?? ""} — chọn "Tất cả" để xem mọi gian hàng.`
          }
        />
      )}

      {rows && rows.length > 0 && (
        <PageHint
          shown={rows.length}
          total={total}
          what="gian hàng"
          onMore={loadMore}
          loadingMore={loadingMore}
        />
      )}
      {rows && rows.length > 0 && (
        <ul className="space-y-3">
          {rows.map((shop) => (
            <ShopCard
              key={shop.id}
              shop={shop}
              open={openId === shop.id}
              onToggle={() => setOpenId(openId === shop.id ? null : shop.id)}
              onDone={(say) => {
                setNotice({ ok: true, text: say });
                refresh();
                onChanged();
              }}
              onError={(msg) => setNotice({ ok: false, text: msg })}
              onPickShopOrders={() => onPickShopOrders(shop)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ShopCard({
  shop,
  open,
  onToggle,
  onDone,
  onError,
  onPickShopOrders,
}: {
  shop: ShopRow;
  open: boolean;
  onToggle: () => void;
  onDone: (say: string) => void;
  onError: (msg: string) => void;
  onPickShopOrders: () => void;
}) {
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const [ownerDraft, setOwnerDraft] = useState("");
  const [askOwner, setAskOwner] = useState(false);

  const sentinelOwner = !isValidVnPhone(shop.ownerPhone);

  async function patch(body: Record<string, unknown>, say: string) {
    setBusy(true);
    try {
      await marketAdminPatch(`/api/admin/cho/shops/${encodeURIComponent(shop.id)}`, body);
      onDone(`${shop.name}: ${say}`);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const btn = "min-h-[2.5rem] shrink-0 rounded-lg px-3 text-[0.8125rem] font-bold disabled:opacity-50";

  return (
    <li className="surface overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-4 pt-3">
        <div className="min-w-0">
          <p className="text-[1rem] font-bold text-navy">{shop.name}</p>
          <p className="mt-0.5 text-[0.8125rem] tabular-nums text-foreground/70">
            {sentinelOwner ? "chưa gán chủ" : `chủ ${shop.ownerPhone}`}
            {shop.province ? ` · ${shop.province}` : ""} · {shop.productCount} món
          </p>
          <p className="text-[0.8125rem] text-foreground/55">
            đăng ký {dayOf(shop.createdAt)}
            {shop.paused ? " · đang tạm nghỉ bán" : ""}
          </p>
        </div>
        <ShopStatusChip status={shop.status} />
      </div>

      {shop.statusNote && (
        <p className="mt-2 border-t border-line px-4 py-2 text-[0.875rem] leading-snug text-foreground/80">
          <span className="font-semibold text-foreground/60">Ghi chú trạng thái: </span>
          {shop.statusNote}
        </p>
      )}

      <div className="flex flex-wrap gap-1.5 border-t border-line px-4 py-2.5">
        <button type="button" onClick={onToggle} className={`${btn} bg-field text-navy`}>
          {open ? "Thu gọn" : "Xem chi tiết"}
        </button>
        <button type="button" onClick={onPickShopOrders} className={`${btn} bg-field text-navy`}>
          Đơn của shop
        </button>
        {shop.status === "cho_duyet" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => setPending("duyet")}
            className={`${btn} bg-navy text-white`}
          >
            Duyệt
          </button>
        )}
        {shop.status === "cho_duyet" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => setPending("tu-choi")}
            className={`${btn} bg-danger-bg text-danger`}
          >
            Từ chối
          </button>
        )}
        {shop.status === "hoat_dong" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => setPending("tam-khoa")}
            className={`${btn} bg-danger-bg text-danger`}
          >
            Tạm khoá
          </button>
        )}
        {(shop.status === "tam_khoa" || shop.status === "tu_choi") && (
          <button
            type="button"
            disabled={busy}
            onClick={() => setPending("mo-lai")}
            className={`${btn} bg-navy text-white`}
          >
            Mở lại
          </button>
        )}
      </div>

      {open && (
        <div className="border-t border-line px-4 py-3 text-[0.875rem] leading-relaxed text-foreground/80">
          <p>
            <span className="font-semibold text-foreground/60">Slug: </span>
            {shop.slug}
          </p>
          {shop.description && <p className="mt-1">{shop.description}</p>}
          <p className="mt-1">
            <span className="font-semibold text-foreground/60">SĐT shop: </span>
            <span className="tabular-nums">{shop.phone || "—"}</span>
          </p>
          <p className="mt-1">
            <span className="font-semibold text-foreground/60">Địa chỉ: </span>
            {shop.address || "—"}
          </p>
          <p className="mt-1">
            <span className="font-semibold text-foreground/60">Tài khoản nhận tiền: </span>
            {shop.bankAccount
              ? `${shop.bankName ?? ""} · ${shop.bankAccount} · ${shop.bankHolder ?? ""}`
              : "chưa có (shop chỉ nhận tiền mặt)"}
          </p>
          <p className="mt-1">
            <span className="font-semibold text-foreground/60">Phí giao: </span>
            {shop.shippingFlatVnd.toLocaleString("vi-VN")} đ
            {shop.freeShipFromVnd
              ? ` · miễn phí từ ${shop.freeShipFromVnd.toLocaleString("vi-VN")} đ`
              : ""}
          </p>
          <p className="mt-1">
            <span className="font-semibold text-foreground/60">Điểm: </span>
            {shop.ratingCount > 0 ? `${shop.ratingAvg}/5 · ${shop.ratingCount} lượt` : "chưa có"}
          </p>

          {/* Gán chủ shop — cho gian hàng SDVICO seed chưa có chủ (LEAD §5 A2) */}
          <div className="mt-3 border-t border-line pt-3">
            <label className="block text-[0.875rem] font-semibold text-foreground/60" htmlFor={`owner-${shop.id}`}>
              Chủ gian hàng {sentinelOwner ? "(chưa gán)" : ""}
            </label>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <input
                id={`owner-${shop.id}`}
                inputMode="numeric"
                placeholder="Số điện thoại chủ shop"
                value={ownerDraft}
                onChange={(e) => setOwnerDraft(sanitizePhoneInput(e.target.value))}
                className="min-h-[2.75rem] w-[14rem] rounded-xl border-0 bg-field px-3 text-[1rem] tabular-nums focus:bg-card focus:outline-none focus:ring-2 focus:ring-sea"
              />
              <button
                type="button"
                disabled={busy || !isValidVnPhone(ownerDraft)}
                onClick={() => setAskOwner(true)}
                className={`${btn} bg-navy text-white`}
              >
                Gán chủ shop
              </button>
            </div>
            <p className="mt-1 text-[0.8125rem] text-foreground/55">
              Số này sẽ vào được Kênh người bán của gian hàng. Một số điện thoại chỉ làm chủ một
              gian hàng.
            </p>
          </div>
        </div>
      )}

      {pending === "duyet" && (
        <ConfirmDialog
          title={`Duyệt gian hàng ${shop.name}?`}
          message="Món đã soạn sẽ hiện lên chợ ngay và shop nhận được thông báo."
          confirmLabel="Duyệt"
          cancelLabel="Không"
          danger={false}
          onCancel={() => setPending(null)}
          onConfirm={() => {
            setPending(null);
            patch({ status: "hoat_dong" }, "Đã duyệt gian hàng.");
          }}
        />
      )}
      {pending === "mo-lai" && (
        <ConfirmDialog
          title={`Mở lại gian hàng ${shop.name}?`}
          message="Shop bán lại bình thường và nhận được thông báo."
          confirmLabel="Mở lại"
          cancelLabel="Không"
          danger={false}
          onCancel={() => setPending(null)}
          onConfirm={() => {
            setPending(null);
            patch({ status: "hoat_dong" }, "Đã mở lại gian hàng.");
          }}
        />
      )}
      {pending === "tu-choi" && (
        <ReasonDialog
          title={`Từ chối gian hàng ${shop.name}?`}
          message="Shop thấy lý do này và sửa lại rồi gửi lần nữa."
          confirmLabel="Từ chối"
          placeholder="Vì sao chưa duyệt? (5–300 chữ)"
          suggestions={["Thiếu giấy tờ kinh doanh", "Thông tin liên hệ chưa đúng", "Chưa có sản phẩm"]}
          onCancel={() => setPending(null)}
          onConfirm={(reason) => {
            setPending(null);
            patch({ status: "tu_choi", statusNote: reason }, "Đã từ chối gian hàng.");
          }}
        />
      )}
      {pending === "tam-khoa" && (
        <ReasonDialog
          title={`Tạm khoá gian hàng ${shop.name}?`}
          message="Món của shop biến khỏi chợ ngay. Đơn đang treo shop vẫn xử lý được."
          confirmLabel="Tạm khoá"
          placeholder="Vì sao khoá? (5–300 chữ)"
          suggestions={["Bán hàng không đúng mô tả", "Nhiều khiếu nại của bà con", "Nghi ngờ gian lận"]}
          onCancel={() => setPending(null)}
          onConfirm={(reason) => {
            setPending(null);
            patch({ status: "tam_khoa", statusNote: reason }, "Đã tạm khoá gian hàng.");
          }}
        />
      )}
      {askOwner && (
        <ConfirmDialog
          title={`Gán ${ownerDraft} làm chủ ${shop.name}?`}
          message="Số này sẽ quản lý sản phẩm và đơn của gian hàng."
          confirmLabel="Gán chủ shop"
          cancelLabel="Không"
          danger={false}
          onCancel={() => setAskOwner(false)}
          onConfirm={() => {
            setAskOwner(false);
            patch({ ownerPhone: ownerDraft }, "Đã gán chủ gian hàng.");
          }}
        />
      )}
    </li>
  );
}

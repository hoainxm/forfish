"use client";

/*
  Mục "Yêu cầu đặt" của tab Chợ vật tư (/quan-tri) — CHỦ SÀN xử lý món bà con cần mà chợ
  chưa bán (2026-10-18, chủ dự án: "cho phép chủ tàu đặt đơn bất kỳ cái gì, nó sẽ chuyển
  cho chủ sàn"). Mỗi yêu cầu: BÁO GIÁ (shop lo hàng · tiền hàng · phí giao · hẹn giao ·
  lời dặn) hoặc KHÔNG TÌM ĐƯỢC (lý do bắt buộc). Bà con đồng ý ⇒ thành đơn của shop đã
  chọn, đi tiếp ở mục Đơn hàng. Luật ở lib/market/request-state.ts; route chặn lại lần nữa.
*/

import { useState } from "react";
import { EtaSheet, type EtaPick } from "@/components/market/shared/eta";
import { MoneyField } from "@/components/ui/primitives";
import { clockVN } from "@/lib/day-labels";
import { formatVnd } from "@/lib/format";
import { etaLabel, vnToday } from "@/lib/market/eta";
import { PAYMENT_METHOD_LABEL } from "@/lib/market/order-state";
import { quoteTotal, REQUEST_STATUS_CHIP, REQUEST_STATUS_LABEL } from "@/lib/market/request-state";
import type { MarketRequest, RequestStatus } from "@/lib/market/types";
import {
  EmptyBox, ErrorBox, FilterChip, LoadingBox, NoticeBar, PageHint, ReasonDialog, marketAdminPatch, useAdminList,
} from "./market-admin-shared";

type ShopLite = { id: string; name: string; status?: string };
type Filter = RequestStatus | "all";

function Chip({ status }: { status: RequestStatus }) {
  const c = REQUEST_STATUS_CHIP[status];
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.8125rem] font-bold" style={{ backgroundColor: c.bg, color: c.fg }}>
      {REQUEST_STATUS_LABEL[status]}
    </span>
  );
}

export function MarketAdminRequests({ shops: allShops, onChanged }: { shops: ShopLite[]; onChanged: () => void }) {
  // chỉ shop ĐANG HOẠT ĐỘNG mới lo hàng được (route chặn lại lần nữa); SDVICO lên đầu — gian hàng của chủ sàn
  const shops = allShops.filter((s) => !s.status || s.status === "hoat_dong").sort((a, b) => (/sdvico/i.test(a.name) ? -1 : /sdvico/i.test(b.name) ? 1 : 0));
  const [filter, setFilter] = useState<Filter>("moi");
  const list = useAdminList<MarketRequest>(`/api/admin/cho/yeu-cau${filter === "all" ? "" : `?status=${filter}`}`);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {(["moi", "da_bao_gia", "da_dat", "all"] as Filter[]).map((f) => (
          <FilterChip key={f} label={f === "all" ? "Tất cả" : REQUEST_STATUS_LABEL[f]} active={filter === f} onClick={() => setFilter(f)} />
        ))}
      </div>
      {notice && <NoticeBar ok={notice.ok} text={notice.text} onClose={() => setNotice(null)} />}
      {list.error && <ErrorBox text={list.error} onRetry={list.reload} />}
      {!list.rows && !list.error && <LoadingBox what="yêu cầu đặt hàng" />}
      {list.rows && list.rows.length === 0 && (
        <EmptyBox text={filter === "moi" ? "Không có yêu cầu nào đang chờ báo giá." : "Không có yêu cầu nào khớp bộ lọc."} />
      )}
      {list.rows && list.rows.length > 0 && (
        <>
          <ul className="space-y-2">
            {list.rows.map((r) => (
              <RequestRow
                key={r.id}
                r={r}
                shops={shops}
                onDone={(ok, text) => {
                  setNotice({ ok, text });
                  if (ok) { list.refresh(); onChanged(); }
                }}
              />
            ))}
          </ul>
          <PageHint shown={list.rows.length} total={list.total} what="yêu cầu" onMore={list.loadMore} loadingMore={list.loadingMore} />
        </>
      )}
    </div>
  );
}

function RequestRow({ r, shops, onDone }: { r: MarketRequest; shops: ShopLite[]; onDone: (ok: boolean, text: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [shopId, setShopId] = useState(r.quoteShopId ?? shops[0]?.id ?? "");
  const [goods, setGoods] = useState(r.quote ? String(r.quote.goodsVnd) : "");
  const [ship, setShip] = useState(r.quote ? String(r.quote.shippingVnd) : "0");
  const [note, setNote] = useState(r.quote?.note ?? "");
  const [etaOpen, setEtaOpen] = useState(false);
  const canQuote = r.status === "moi" || r.status === "da_bao_gia";
  const today = vnToday();
  const btn = "min-h-[2.5rem] shrink-0 rounded-lg px-3 text-[0.8125rem] font-bold disabled:opacity-50";

  const send = async (body: Record<string, unknown>, ok: string) => {
    setBusy(true);
    try {
      await marketAdminPatch(`/api/admin/cho/yeu-cau/${r.id}`, body);
      onDone(true, ok);
    } catch (e) {
      onDone(false, (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const sendQuote = (eta: EtaPick) =>
    void send(
      { action: "bao_gia", shopId, goodsVnd: Number(goods || 0), shippingVnd: Number(ship || 0), ...eta, ...(note.trim() ? { note: note.trim() } : {}) },
      `Đã báo giá ${r.code} — bà con nhận tin ngay.`,
    );

  return (
    <li className="surface overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-4 pt-3">
        <div className="min-w-0">
          <p className="text-[1rem] font-bold text-navy">{r.title} <span className="font-normal text-foreground/70">· {r.qty} {r.unit}</span></p>
          <p className="mt-0.5 text-[0.8125rem] tabular-nums text-foreground/70">
            {r.code} · {r.address.name} · {r.address.phone} · {r.address.province}
          </p>
          <p className="text-[0.8125rem] text-foreground/55">
            Gửi {clockVN(Date.parse(r.createdAt))} · {PAYMENT_METHOD_LABEL[r.paymentMethod]}
            {r.needBy ? ` · cần trước ${etaLabel(r.needBy, r.needBy, today)}` : ""}
          </p>
          {r.description && <p className="mt-1 text-[0.875rem] text-foreground/85">{r.description}</p>}
          {r.quote && (
            <p className="mt-1 text-[0.875rem] text-navy">
              Đã báo <b>{formatVnd(quoteTotal(r.quote))}</b> · giao {etaLabel(r.quote.etaFrom, r.quote.etaTo, today)}
              {r.quoteShopName ? ` · ${r.quoteShopName}` : ""}
            </p>
          )}
          {r.rejectReason && <p className="mt-1 text-[0.875rem] text-danger">Không tìm được: {r.rejectReason}</p>}
        </div>
        <Chip status={r.status} />
      </div>

      <div className="flex flex-wrap gap-1.5 border-t border-line px-4 py-2.5 mt-2">
        {canQuote && (
          <button type="button" disabled={busy} onClick={() => setQuoteOpen((v) => !v)} className={`${btn} bg-navy text-white`}>
            {r.status === "da_bao_gia" ? "Sửa báo giá" : "Báo giá"}
          </button>
        )}
        {canQuote && (
          <button type="button" disabled={busy} onClick={() => setRejectOpen(true)} className={`${btn} bg-danger-bg text-danger`}>
            Không tìm được
          </button>
        )}
        {r.orderId && <span className="self-center text-[0.8125rem] text-foreground/70">Đã thành đơn — xem ở mục Đơn hàng.</span>}
      </div>

      {quoteOpen && canQuote && (
        <div className="space-y-2 border-t border-line px-4 py-3">
          <label className="block text-[0.875rem] font-bold text-navy">
            Shop lo hàng
            <select value={shopId} onChange={(e) => setShopId(e.target.value)} className="mt-1 block min-h-[2.75rem] w-full max-w-[22rem] rounded-xl bg-field px-3 text-[1rem]">
              {shops.length === 0 && <option value="">Chưa có gian hàng</option>}
              {shops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <div className="grid max-w-[30rem] grid-cols-2 gap-2">
            <MoneyField label="Tiền hàng (cả số lượng)" digits={goods} onDigits={setGoods} placeholder="0" />
            <MoneyField label="Phí giao" digits={ship} onDigits={setShip} placeholder="0" />
          </div>
          <label className="block text-[0.875rem] font-bold text-navy">
            Dặn bà con (không bắt buộc)
            <input value={note} onChange={(e) => setNote(e.target.value.slice(0, 300))} placeholder="Ví dụ: hàng Đài Loan, bảo hành 6 tháng"
              className="mt-1 block min-h-[2.75rem] w-full max-w-[30rem] rounded-xl bg-field px-3 text-[1rem]" />
          </label>
          <p className="text-[0.875rem] text-foreground/70">Tổng bà con trả: <b className="text-navy">{formatVnd(Number(goods || 0) + Number(ship || 0))}</b> · giá giữ 3 ngày</p>
          <button type="button" disabled={busy || !shopId || !Number(goods)} onClick={() => setEtaOpen(true)} className={`${btn} bg-navy text-white`}>
            Chọn ngày giao rồi gửi
          </button>
        </div>
      )}

      {etaOpen && (
        <EtaSheet
          title={`Báo giá ${r.code} — hẹn ngày giao`}
          sendLabel="Gửi báo giá"
          busy={busy}
          initial={r.quote ? { etaFrom: r.quote.etaFrom, etaTo: r.quote.etaTo } : undefined}
          onClose={() => setEtaOpen(false)}
          onSend={(eta) => { setEtaOpen(false); setQuoteOpen(false); sendQuote(eta); }}
        />
      )}
      {rejectOpen && (
        <ReasonDialog
          title={`Không tìm được "${r.title}"?`}
          message="Bà con nhận tin kèm lý do này."
          confirmLabel="Báo bà con"
          placeholder="Vì sao chưa tìm được hàng"
          minLen={3}
          suggestions={["Hết hàng cả khu vực", "Hãng ngừng sản xuất", "Cần thêm thông tin — gọi lại bà con"]}
          onCancel={() => setRejectOpen(false)}
          onConfirm={(reason) => { setRejectOpen(false); void send({ action: "khong_tim_duoc", reason }, `Đã báo bà con: chưa tìm được ${r.title}.`); }}
        />
      )}
    </li>
  );
}


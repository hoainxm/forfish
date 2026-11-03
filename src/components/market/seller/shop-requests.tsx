"use client";

// /ban-hang/yeu-cau — ĐẠI LÝ TỰ BÁO GIÁ món bà con cần mà chợ chưa bán (17 §12.5, anh Long duyệt
// 03/11). Hai mục: "Bà con đang cần" (yêu cầu còn mở, mới nhất trước) và "Shop đã báo giá".
// Bấm Báo giá ⇒ ngăn nhập tiền hàng · phí giao · lời dặn ⇒ Tiếp ⇒ ngăn hẹn ngày giao (EtaSheet dùng
// chung với xác nhận đơn) ⇒ Gửi. Báo giá hợp lệ ĐẦU TIÊN thắng: nơi khác báo trước thì máy chủ trả
// `da_co_bao_gia`, màn bỏ yêu cầu khỏi danh sách và nói rõ. Gửi hỏng (mất sóng, sai số) ⇒ quay lại
// ngăn nhập, GIỮ NGUYÊN số đã gõ (CLAUDE.md nguyên tắc 4 — không mất chữ của bà con).
// Màn chỉ thấy món + số lượng + tỉnh — không SĐT/địa chỉ bà con (route lọc sẵn, toSellerRequestView).
// Gian hàng chưa duyệt / tạm khoá / tạm nghỉ: băng giải thích, không nút Báo giá (sellerQuoteBlock).
// Kênh người bán không cache (11 §9): mất sóng thì nói thật, có sóng lại tự tải.
import { useState } from "react";
import Link from "next/link";
import { BoxIcon } from "@/components/icons";
import { EtaSheet, type EtaPick } from "@/components/market/shared/eta";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { EmptyState, Field, MoneyField, inputClass } from "@/components/ui/primitives";
import { StatusBanner } from "@/components/ui/status-banner";
import { KeoLamMoiChi, useKeoLamMoi } from "@/components/ui/use-keo-lam-moi";
import { formatVnd } from "@/lib/format";
import { NHAN } from "@/lib/labels";
import { marketPost } from "@/lib/market/client";
import { etaLabel, vnToday } from "@/lib/market/eta";
import { PAYMENT_METHOD_LABEL } from "@/lib/market/order-state";
import { quoteTotal, REQUEST_STATUS_CHIP, REQUEST_STATUS_LABEL } from "@/lib/market/request-state";
import { SELLER_QUOTE_BLOCK_TEXT, type SellerQuoteBlock, type SellerRequestView } from "@/lib/market/seller-requests";
import type { Shop } from "@/lib/market/types";
import { NOTE_MAX, validateQuote } from "@/lib/market/validate";
import { agoLabel, LoadView, marketErrorText, useInlineNote, useMarketList, useMyShop } from "./seller-net";
import { MoreButton, NoShop, SELLER_BTN } from "./ui";

type ListRes = { block: SellerQuoteBlock | null };
const blockOf = (s: { kind: string; data?: unknown }): SellerQuoteBlock | null =>
  s.kind === "ok" ? ((s.data as ListRes).block ?? null) : null;

export function SellerRequests() {
  const { state, reload } = useMyShop();
  return (
    <LoadView state={state} what="gian hàng" onRetry={reload}>
      {(d) => (d.shop ? <Inner shop={d.shop} /> : <NoShop />)}
    </LoadView>
  );
}

function Inner({ shop }: { shop: Shop }) {
  const open = useMarketList<SellerRequestView>((p) => `/api/ban-hang/yeu-cau?page=${p}`);
  const mine = useMarketList<SellerRequestView>((p) => `/api/ban-hang/yeu-cau?loai=da-bao&page=${p}`);
  const note = useInlineNote();
  const [quoting, setQuoting] = useState<SellerRequestView | null>(null);
  const lamMoi = useKeoLamMoi(() => Promise.all([open.reload(), mine.reload()]).then(() => undefined));
  const block = blockOf(open.state) ?? blockOf(mine.state);

  return (
    <div className="pb-10">
      <KeoLamMoiChi {...lamMoi.chi} />
      {block && (
        <div className="mb-3 overflow-hidden">
          <StatusBanner level={block === "tam_nghi" ? "warn" : "danger"}>{SELLER_QUOTE_BLOCK_TEXT[block]}</StatusBanner>
        </div>
      )}
      {note.node}

      <section aria-labelledby="yc-dang-can">
        <h2 id="yc-dang-can" className="mb-1 px-4 text-[1rem] font-semibold text-navy">Bà con đang cần</h2>
        <p className="mb-3 px-4 text-[0.875rem] text-muted">
          Món chợ chưa có. Báo giá trước thì được lo hàng — giá giữ 3 ngày, bà con đồng ý mới thành đơn.
        </p>
        <LoadView state={open.state} what="yêu cầu của bà con" onRetry={open.reload}>
          {() =>
            open.items.length === 0 ? (
              <div className="px-4">
                <EmptyState icon={<BoxIcon className="h-8 w-8" />}>
                  {shop.status === "hoat_dong"
                    ? "Chưa có yêu cầu nào đang chờ báo giá. Bà con gửi thêm sẽ hiện ở đây."
                    : "Shop được duyệt rồi mới thấy yêu cầu của bà con."}
                </EmptyState>
              </div>
            ) : (
              <>
                <ul className="space-y-1 px-4">
                  {open.items.map((r) => (
                    <RequestCard key={r.id} r={r}>
                      {!block && (
                        <div className="px-3 pb-3">
                          <button type="button" onClick={() => setQuoting(r)} className={`${SELLER_BTN} w-full bg-trim text-white`}>
                            {NHAN.baoGia}
                          </button>
                        </div>
                      )}
                    </RequestCard>
                  ))}
                </ul>
                <div className="px-4">
                  <MoreButton more={open.more} busy={open.loadingMore} onMore={open.loadMore} what="yêu cầu" />
                </div>
              </>
            )
          }
        </LoadView>
      </section>

      <section aria-labelledby="yc-da-bao" className="mt-6">
        <h2 id="yc-da-bao" className="mb-3 px-4 text-[1rem] font-semibold text-navy">Shop đã báo giá</h2>
        <LoadView state={mine.state} what="báo giá của shop" onRetry={mine.reload}>
          {() =>
            mine.items.length === 0 ? (
              <p className="px-4 text-[1rem] text-muted">Shop chưa báo giá yêu cầu nào.</p>
            ) : (
              <>
                <ul className="space-y-1 px-4">
                  {mine.items.map((r) => (
                    <RequestCard key={r.id} r={r}>
                      <MineFooter r={r} />
                    </RequestCard>
                  ))}
                </ul>
                <div className="px-4">
                  <MoreButton more={mine.more} busy={mine.loadingMore} onMore={mine.loadMore} what="báo giá" />
                </div>
              </>
            )
          }
        </LoadView>
      </section>

      {quoting && (
        <QuoteFlow
          r={quoting}
          shopId={shop.id}
          onClose={() => setQuoting(null)}
          onSent={(sent) => {
            setQuoting(null);
            open.setItems((cur) => cur.filter((x) => x.id !== sent.id));
            mine.setItems((cur) => [sent, ...cur.filter((x) => x.id !== sent.id)]);
            note.show(`Đã gửi báo giá ${sent.code} — bà con nhận tin ngay.`);
          }}
          onTaken={(id, msg) => {
            setQuoting(null);
            open.setItems((cur) => cur.filter((x) => x.id !== id));
            note.show(msg, "danger");
          }}
        />
      )}
    </div>
  );
}

function RequestCard({ r, children }: { r: SellerRequestView; children?: React.ReactNode }) {
  const today = vnToday();
  return (
    <li className="surface overflow-hidden">
      <div className="flex items-start gap-3 p-3">
        <span className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-field">
          {r.images[0] ? (
            // eslint-disable-next-line @next/next/no-img-element -- ảnh bà con gửi (bucket public / dev), không qua optimizer
            <img src={r.images[0]} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-foreground/40">
              <BoxIcon className="h-7 w-7" />
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 block text-[1rem] font-semibold leading-snug text-navy">{r.title}</span>
          <span className="mt-0.5 block text-[1rem] text-foreground/85">
            {r.qty} {r.unit}
            {r.province ? ` · ${r.province}` : ""}
          </span>
          <span className="mt-0.5 block text-[0.875rem] text-muted">
            {agoLabel(r.createdAt)} · {PAYMENT_METHOD_LABEL[r.paymentMethod]}
            {r.needBy ? ` · cần trước ${etaLabel(r.needBy, r.needBy, today)}` : ""}
          </span>
          {r.description && <span className="mt-1 line-clamp-3 block text-[0.875rem] text-foreground/80">{r.description}</span>}
        </span>
      </div>
      {children}
    </li>
  );
}

function MineFooter({ r }: { r: SellerRequestView }) {
  const chip = REQUEST_STATUS_CHIP[r.status];
  const today = vnToday();
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-line px-3 py-2.5">
      <span className="rounded-full px-2.5 py-0.5 text-[0.875rem] font-semibold" style={{ backgroundColor: chip.bg, color: chip.fg }}>
        {REQUEST_STATUS_LABEL[r.status]}
      </span>
      {r.quote && (
        <span className="text-[0.875rem] text-navy">
          <b>{formatVnd(quoteTotal(r.quote))}</b> · giao {etaLabel(r.quote.etaFrom, r.quote.etaTo, today)}
        </span>
      )}
      {r.orderId && (
        <Link href={`/ban-hang/don/${r.orderId}`} className={`${SELLER_BTN} ml-auto bg-field text-navy`}>
          {NHAN.xemDon}
        </Link>
      )}
    </div>
  );
}

/** Ngăn nhập giá ⇒ ngăn hẹn giao ⇒ gửi. Số đã gõ sống ở đây — gửi hỏng quay về ngăn nhập, không mất. */
function QuoteFlow({
  r, shopId, onClose, onSent, onTaken,
}: {
  r: SellerRequestView;
  shopId: string;
  onClose: () => void;
  onSent: (r: SellerRequestView) => void;
  onTaken: (id: string, msg: string) => void;
}) {
  const [step, setStep] = useState<"gia" | "ngay">("gia");
  const [goods, setGoods] = useState("");
  const [ship, setShip] = useState("0");
  const [loiDan, setLoiDan] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const today = vnToday();

  /** kiểm tiền trước khi sang ngăn ngày — cùng validateQuote của máy chủ (ngày giả = hôm nay, kiểm ở ngăn sau) */
  function next() {
    const bad = validateQuote(
      { shopId, goodsVnd: Number(goods || 0), shippingVnd: Number(ship || 0), etaFrom: today, etaTo: today, note: loiDan },
      today,
    );
    if (bad) return setErr(bad);
    setErr("");
    setStep("ngay");
  }

  async function send(eta: EtaPick) {
    if (busy) return;
    setBusy(true);
    const res = await marketPost<{ request: SellerRequestView }>(`/api/ban-hang/yeu-cau/${r.id}/bao-gia`, {
      goodsVnd: Number(goods || 0),
      shippingVnd: Number(ship || 0),
      ...eta,
      ...(loiDan.trim() ? { note: loiDan.trim() } : {}),
    });
    setBusy(false);
    if (res.ok) return onSent(res.data.request);
    if (res.code === "da_co_bao_gia" || res.code === "not_found") return onTaken(r.id, marketErrorText(res));
    setErr(marketErrorText(res));
    setStep("gia");
  }

  if (step === "ngay") {
    return (
      <EtaSheet
        title={`Báo giá ${r.code} — hẹn ngày giao`}
        sendLabel={NHAN.gui}
        busy={busy}
        onClose={() => !busy && setStep("gia")}
        onSend={(eta) => void send(eta)}
      />
    );
  }

  const total = Number(goods || 0) + Number(ship || 0);
  return (
    <BottomSheet
      kieu="form"
      title={`${NHAN.baoGia}: ${r.title}`}
      onClose={onClose}
      chan={{ luu: NHAN.tiep, onLuu: next, huy: NHAN.huy }}
    >
      <div className="space-y-3 pb-2">
        <p className="text-[1rem] text-foreground/80">
          {r.qty} {r.unit}
          {r.province ? ` · giao về ${r.province}` : ""}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <MoneyField label={`Tiền hàng (cả ${r.qty} ${r.unit})`} digits={goods} onDigits={setGoods} placeholder="0" />
          <MoneyField label="Phí giao" digits={ship} onDigits={setShip} placeholder="0" />
        </div>
        <Field label="Dặn bà con (không bắt buộc)">
          <input
            className={inputClass}
            value={loiDan}
            onChange={(e) => setLoiDan(e.target.value.slice(0, NOTE_MAX))}
            placeholder="Ví dụ: hàng Đài Loan, bảo hành 6 tháng"
          />
        </Field>
        <p className="text-[1rem] text-foreground/80">
          Bà con trả: <b className="text-navy">{formatVnd(total)}</b> · giá giữ 3 ngày
        </p>
        {err && (
          <p role="alert" className="text-[1rem] font-semibold" style={{ color: "var(--danger)" }}>
            {err}
          </p>
        )}
      </div>
    </BottomSheet>
  );
}

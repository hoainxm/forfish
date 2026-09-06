"use client";

// `/cho/thanh-toan` — ĐẶT HÀNG (11 §5.6). MỘT lần bấm → N đơn, mỗi shop một
// đơn, shop này hỏng không kéo shop kia. Nói thẳng "Sẽ tạo N đơn cho N shop"
// vì bà con quen một đơn.
//
// CHỈ MANG DÒNG ĐANG CHỌN ở giỏ (F-05): dòng bỏ chọn nằm yên trong giỏ.
//
// GHI CHÚ THEO TỪNG SHOP (2026-09-06): mỗi khối shop có ô "Ghi chú cho <shop>"
// riêng, gửi trong `shops[].buyerNote`; KHÔNG còn ô ghi chú chung.
//
// KHÔNG TRẢ TIỀN TRONG APP: COD hoặc chuyển khoản thẳng cho shop. Một cách trả
// tiền cho cả lần đặt (LEAD §4 #9); có shop không có STK ⇒ chip Chuyển khoản
// hiện MỜ + lý do ngay dưới (F-16 — ẩn hẳn làm người quen CK tưởng app không có).
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { CheckIcon, ChevronRightIcon } from "@/components/icons";
import { AddressForm } from "@/components/market/shared/address-form";
import { LineThumb } from "@/components/market/shared/line-thumb";
import { MoneyText } from "@/components/market/shared/price-text";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Field, PrimaryButton, inputClass } from "@/components/ui/primitives";
import { StatusBanner } from "@/components/ui/status-banner";
import { formatVnd } from "@/lib/format";
import {
  loadAddresses, saveAddresses, seedAddress, setDefaultAddress, upsertAddress, type SavedAddress,
} from "@/lib/market/addresses";
import { removeShopLines, setMarketLineQty, saveMarketQuote } from "@/lib/market/cart";
import { marketPost } from "@/lib/market/client";
import { marketOrderClientRef } from "@/lib/market/order-ref";
import { PAYMENT_METHOD_LABEL } from "@/lib/market/order-state";
import type { Address, CartQuote, PaymentMethod, PlaceOrderResult } from "@/lib/market/types";
import { NOTE_MAX, validateAddress } from "@/lib/market/validate";
import { useAuthUser } from "@/lib/use-auth";
import { loadHome } from "@/lib/region";
import { useMarketCart, useOnlineState } from "./hooks";

type QuoteRes = { quote: CartQuote; titles: Record<string, string> };
type OrderRes = { results: PlaceOrderResult[] };
/** Sheet địa chỉ tách hai bước (F-11): danh sách đã lưu → "Thêm địa chỉ mới" → form. */
type AddrSheet = "list" | "form" | null;

const newId = () => `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Câu cho từng lý do đặt hỏng — nói SHOP NÀO và làm gì tiếp (11 §5.6). */
function failLine(r: Extract<PlaceOrderResult, { ok: false }>, shopName: string): string {
  switch (r.code) {
    case "line_unavailable":
      return `Shop ${shopName} vừa hết hàng một món — giỏ đã hạ số lượng, xem lại rồi đặt tiếp.`;
    case "price_changed":
      return `Giá vừa đổi ở shop ${shopName} — tổng mới ${formatVnd(r.quote?.totalVnd ?? 0)}. Xem lại rồi bấm Đặt hàng lần nữa.`;
    case "shop_not_active":
      return `Shop ${shopName} vừa tạm đóng — thử lại sau.`;
    case "shop_paused":
      return `Shop ${shopName} vừa tạm nghỉ — thử lại sau.`;
    default:
      return `Chưa đặt được với shop ${shopName} — thử lại giúp.`;
  }
}

/** Chip cách trả tiền — 3.5rem; `disabled` hiện mờ chứ không biến mất. */
function PayChip({ on, disabled, onClick, children }: { on: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      className="min-h-[3.5rem] flex-1 rounded-full px-4 text-[1rem] font-bold disabled:opacity-40"
      style={{
        backgroundColor: on ? "var(--t3)" : "var(--field)",
        color: on ? "var(--card)" : "var(--navy)",
      }}
    >
      {children}
    </button>
  );
}

export function Checkout() {
  const online = useOnlineState();
  const cart = useMarketCart();
  const { phone, ready } = useAuthUser();

  const [quote, setQuote] = useState<CartQuote | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "error" | "offline">("loading");
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [draft, setDraft] = useState<Address | null>(null);
  const [addrSheet, setAddrSheet] = useState<AddrSheet>(null);
  const [addrError, setAddrError] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("cod");
  /*  GHI CHÚ THEO TỪNG SHOP (2026-09-06): một lần đặt sinh N đơn cho N shop, mà
      lời dặn mỗi shop một khác ("giao trước 6h" cho đại lý đá, "gọi trước khi
      tới" cho shop máy). Ô chung cũ gửi cùng một câu cho mọi shop. Khoá theo
      shopId. */
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<PlaceOrderResult[] | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const homeProvince = loadHome().province;

  // ── tra lại giỏ (giá server là chốt) — CHỈ dòng đang chọn ─────────────
  const items = cart.selectedItems;
  const reload = useCallback(async () => {
    setStatus("loading");
    if (items.length === 0) {
      setQuote(null);
      setStatus("ok");
      return;
    }
    const res = await marketPost<QuoteRes>("/api/cho/gio/tinh", { items });
    if (!res.ok) {
      setStatus(res.offline ? "offline" : "error");
      return;
    }
    setQuote(res.data.quote);
    saveMarketQuote(phone, res.data.quote);
    setStatus("ok");
  }, [items, phone]);

  /*  Giỏ đọc từ máy trong effect ⇒ lần vẽ đầu còn rỗng. Khoá theo vân tay nội
      dung giỏ, không theo lượt render (cùng bài học ở màn giỏ). */
  const sig = items.map((l) => `${l.productId}|${l.variantLabel ?? ""}|${l.qty}`).join(",");
  const quotedSig = useRef<string | null>(null);
  useEffect(() => {
    if (results || quotedSig.current === sig) return; // xong rồi thì đừng tra lại
    quotedSig.current = sig;
    void reload();
  }, [sig, results, reload]);

  // ── địa chỉ ────────────────────────────────────────────────────────────
  /*  ĐỢI `ready` (F-02, audit B-01): lần vẽ đầu `phone` còn null ⇒ đọc ngăn
      khách lạ = [] ⇒ bản cũ tự bật sheet đè màn dù bà con ĐÃ có địa chỉ. Chỉ
      mở sẵn form khi danh tính đã rõ mà vẫn chưa có địa chỉ nào; có rồi thì
      đóng lại (phòng ca phone tới muộn). */
  useEffect(() => {
    if (!ready) return;
    const list = loadAddresses(phone);
    setAddresses(list);
    if (list.length === 0) {
      setDraft(seedAddress({ phone: phone ?? "", province: homeProvince }));
      setAddrSheet("form");
    } else {
      setAddrSheet((cur) => (cur === "form" && list.length > 0 ? null : cur));
    }
  }, [phone, ready, homeProvince]);

  const chosen = addresses.find((a) => a.isDefault) ?? addresses[0] ?? null;

  const openNewAddress = () => {
    setDraft(seedAddress({ phone: phone ?? "", province: homeProvince }));
    setAddrError(null);
    setAddrSheet("form");
  };

  const saveDraft = () => {
    if (!draft) return;
    const bad = validateAddress(draft);
    if (bad) {
      setAddrError(bad);
      return;
    }
    const next = upsertAddress(addresses, { ...draft, id: newId(), isDefault: true });
    if (!saveAddresses(phone, next)) {
      setAddrError("Máy hết chỗ — chưa lưu được địa chỉ. Xoá bớt ảnh/ứng dụng rồi thử lại.");
      return;
    }
    setAddresses(next);
    setAddrError(null);
    setAddrSheet(null);
  };

  // ── đặt hàng ───────────────────────────────────────────────────────────
  const groups = quote?.groups ?? [];
  const forcingCod = groups.filter((g) => !g.shop.acceptsBankTransfer).map((g) => g.shop.name);
  const canBank = forcingCod.length === 0;
  useEffect(() => {
    if (!canBank && method === "chuyen_khoan") setMethod("cod");
  }, [canBank, method]);

  const submit = async () => {
    if (sending || !chosen || groups.length === 0) return;
    setSending(true);
    setSendError(null);
    const address: Address = {
      name: chosen.name, phone: chosen.phone, province: chosen.province, detail: chosen.detail, isPort: chosen.isPort,
    };
    const common = { address, paymentMethod: method };
    const shops = groups.map((g) => {
      const lines = g.lines.map((l) => ({
        productId: l.productId,
        qty: l.qty,
        ...(l.variantLabel ? { variantLabel: l.variantLabel } : {}),
      }));
      const shopNote = (notes[g.shop.id] ?? "").trim();
      return {
        shopId: g.shop.id,
        items: lines,
        /*  Vân tay tính KÈM ghi chú của CHÍNH shop này — sửa lời dặn một shop
            thì chỉ đơn shop đó là đơn mới, các shop kia vẫn chống trùng. */
        clientRef: marketOrderClientRef(
          { shopId: g.shop.id, items: lines },
          { ...common, ...(shopNote ? { buyerNote: shopNote } : {}) },
        ),
        expectedTotalVnd: g.totalVnd,
        ...(shopNote ? { buyerNote: shopNote } : {}),
      };
    });

    const res = await marketPost<OrderRes>("/api/cho/don", { ...common, shops });
    setSending(false);
    if (!res.ok) {
      setSendError(
        res.offline
          ? "Chưa rõ đã gửi được chưa — máy mất sóng giữa chừng. Có sóng lại bà con bấm Đặt hàng lần nữa: cùng nội dung thì máy chủ không tạo đơn đôi."
          : res.message || "Chưa đặt được — chợ đang trục trặc. Thử lại giúp.",
      );
      return;
    }
    setResults(res.data.results);

    // Xoá khỏi giỏ ĐÚNG dòng của shop đã đặt được (LEAD §4 #5) — dòng bỏ chọn giữ nguyên.
    const okIds = res.data.results
      .filter((r): r is Extract<PlaceOrderResult, { ok: true }> => r.ok)
      .flatMap((r) => r.order.items.map((l) => l.productId));
    let next = cart.items;
    if (okIds.length > 0) next = removeShopLines(next, okIds);
    // Hết hàng ⇒ hạ số lượng về đúng số còn lại để bà con đặt tiếp được ngay.
    for (const r of res.data.results) {
      if (r.ok || r.code !== "line_unavailable") continue;
      for (const [pid, avail] of Object.entries(r.available ?? {})) {
        const line = next.find((l) => l.productId === pid);
        if (line) next = setMarketLineQty(next, pid, line.variantLabel, avail);
      }
    }
    if (next !== cart.items) cart.commit(next);
  };

  const copy = async (text: string, tag: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(tag);
      setTimeout(() => setCopied(null), 3000);
    } catch {
      setCopied(null);
    }
  };

  // ── màn KẾT QUẢ ────────────────────────────────────────────────────────
  if (results) {
    const okOnes = results.filter((r): r is Extract<PlaceOrderResult, { ok: true }> => r.ok);
    const failOnes = results.filter((r): r is Extract<PlaceOrderResult, { ok: false }> => !r.ok);
    const nameOf = (shopId: string) => groups.find((g) => g.shop.id === shopId)?.shop.name ?? "này";
    return (
      <div className="px-4 py-4 pb-[7rem]">
        <h2 className="display text-[1.375rem] font-bold text-navy">
          {okOnes.length > 0 ? `Đã đặt ${okOnes.length} đơn` : "Chưa đặt được đơn nào"}
        </h2>
        <ul className="mt-3 flex flex-col gap-3">
          {okOnes.map((r) => (
            <li key={r.order.id} className="surface px-4 py-3">
              <p className="flex items-center gap-2 text-[1.125rem] font-bold text-navy">
                <CheckIcon className="h-5 w-5 text-ok" />
                {r.order.code}
              </p>
              <p className="mt-0.5 text-[1rem] text-foreground/70">
                {r.order.shopName ?? nameOf(r.order.shopId)} · {PAYMENT_METHOD_LABEL[r.order.paymentMethod]}
              </p>
              <p className="mt-0.5 text-[1.125rem] font-bold text-navy">{formatVnd(r.order.totalVnd)}</p>
              {r.order.bankSnapshot && (
                <div className="mt-2 rounded-2xl bg-field px-3.5 py-2.5">
                  <p className="text-[1rem] font-bold text-navy">Chuyển khoản cho shop</p>
                  <p className="text-[1rem]">{r.order.bankSnapshot.bankName}</p>
                  <p className="text-[1.125rem] font-bold text-navy">{r.order.bankSnapshot.bankAccount}</p>
                  <p className="text-[1rem]">{r.order.bankSnapshot.bankHolder}</p>
                  <p className="mt-1 text-[1rem]">
                    Nội dung chuyển: <span className="font-bold text-navy">{r.order.code}</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => void copy(r.order.bankSnapshot?.bankAccount ?? "", r.order.id)}
                    className="mt-2 min-h-[3.5rem] rounded-full bg-card px-4 text-[1rem] font-bold text-navy"
                  >
                    {copied === r.order.id ? "Đã chép số TK" : "Sao chép số TK"}
                  </button>
                </div>
              )}
              <Link
                href={`/cho/don/${r.order.id}`}
                className="mt-2 flex min-h-[3.5rem] items-center gap-1 text-[1rem] font-bold text-t3"
              >
                Xem đơn này <ChevronRightIcon className="h-4 w-4" />
              </Link>
            </li>
          ))}
          {failOnes.map((r) => (
            <li key={r.shopId} className="rounded-2xl bg-danger-bg px-4 py-3" role="alert">
              <p className="text-[1rem] font-bold leading-snug text-danger">{failLine(r, nameOf(r.shopId))}</p>
              <Link href="/cho/gio" className="mt-1 flex min-h-[3.5rem] items-center text-[1rem] font-bold text-danger underline">
                Về giỏ sửa lại
              </Link>
            </li>
          ))}
        </ul>
        <Link
          href="/cho/don"
          className="display mx-auto mt-5 flex min-h-[3.75rem] w-full items-center justify-center rounded-full bg-trim text-[1.125rem] font-bold text-white shadow-trim-cta"
        >
          Xem đơn hàng
        </Link>
        {/*  F-09: màn kết quả là màn cụt — thêm đường quay lại chợ. */}
        <Link
          href="/cho"
          className="display mx-auto mt-2 flex min-h-[3.5rem] w-full items-center justify-center rounded-full bg-field text-[1.125rem] font-bold text-navy"
        >
          Mua tiếp
        </Link>
      </div>
    );
  }

  // ── ma trận trước khi đặt ──────────────────────────────────────────────
  if (status === "loading") {
    return <p role="status" className="px-4 py-10 pb-[7rem] text-center text-[1.125rem] text-foreground/65">Đang tra lại giỏ…</p>;
  }
  if (status === "offline" || !online) {
    return (
      <div className="px-4 py-8 pb-[7rem] text-center">
        <p className="text-[1.125rem] font-bold text-navy">Đặt hàng cần có sóng. Giỏ vẫn giữ nguyên.</p>
        <button
          type="button"
          onClick={() => void reload()}
          className="display mx-auto mt-4 flex min-h-[3.5rem] w-full max-w-[15rem] items-center justify-center rounded-full bg-trim text-[1.125rem] font-bold text-white shadow-trim-cta"
        >
          Thử lại
        </button>
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="px-4 py-8 pb-[7rem] text-center" role="alert">
        <p className="text-[1.125rem] font-bold text-danger">Chợ đang trục trặc, chưa tra được giỏ. Thử lại giúp.</p>
        <button
          type="button"
          onClick={() => void reload()}
          className="display mx-auto mt-4 flex min-h-[3.5rem] w-full max-w-[15rem] items-center justify-center rounded-full bg-trim text-[1.125rem] font-bold text-white shadow-trim-cta"
        >
          Thử lại
        </button>
      </div>
    );
  }
  if (groups.length === 0) {
    return (
      <div className="px-4 py-8 pb-[7rem] text-center">
        <p className="text-[1.125rem] font-bold text-navy">
          {items.length === 0 && cart.items.length > 0 ? "Chưa chọn món nào để đặt." : "Không còn món nào mua được trong giỏ."}
        </p>
        <Link
          href="/cho/gio"
          className="display mx-auto mt-4 flex min-h-[3.5rem] w-full max-w-[15rem] items-center justify-center rounded-full bg-field text-[1.125rem] font-bold text-navy"
        >
          Về giỏ
        </Link>
      </div>
    );
  }

  const summary = quote?.summary ?? { subtotalVnd: 0, shippingVnd: 0, totalVnd: 0, shopCount: 0 };

  return (
    <div className="px-4 py-3 pb-[7rem]">
      {/* ── 1. Địa chỉ nhận ────────────────────────────────────────────── */}
      <section className="surface px-4 py-2">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1 py-1">
            <p className="text-[1rem] font-bold text-navy">Nhận hàng</p>
            {chosen ? (
              <p className="mt-0.5 text-[1.0625rem] leading-snug">
                {chosen.name} · {chosen.phone}
                <br />
                {chosen.detail}, {chosen.province}
              </p>
            ) : (
              <p className="mt-0.5 text-[1.0625rem] text-danger">Chưa có địa chỉ nhận — thêm giúp một địa chỉ.</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => (addresses.length > 0 ? setAddrSheet("list") : openNewAddress())}
            className="flex min-h-[3.5rem] shrink-0 items-center gap-0.5 rounded-full px-3 text-[1rem] font-bold text-t3"
          >
            {chosen ? "Đổi" : "Thêm"} <ChevronRightIcon className="h-5 w-5" />
          </button>
        </div>
      </section>

      {/* ── 2. Cách trả tiền ───────────────────────────────────────────── */}
      <section className="mt-3">
        <p className="mb-1.5 text-[1rem] font-bold text-navy">Cách trả tiền</p>
        <div className="flex gap-2">
          <PayChip on={method === "cod"} onClick={() => setMethod("cod")}>Trả khi nhận hàng</PayChip>
          <PayChip on={method === "chuyen_khoan"} disabled={!canBank} onClick={() => setMethod("chuyen_khoan")}>
            Chuyển khoản
          </PayChip>
        </div>
        {!canBank && (
          <p className="mt-1.5 text-[1rem] font-semibold text-foreground/70">
            Shop {forcingCod[0]} chỉ nhận tiền mặt — lần đặt này trả khi nhận hàng.
          </p>
        )}
      </section>

      {/* ── 3. Từng shop — ảnh · tên · × số lượng · tiền (F-03/F-06) ────── */}
      <section className="mt-3 flex flex-col gap-3">
        {groups.map((g) => (
          <div key={g.shop.id} className="surface px-4 py-3">
            <p className="text-[1.0625rem] font-bold text-navy">{g.shop.name}</p>
            <ul className="mt-1.5 flex flex-col gap-2">
              {g.lines.map((l) => (
                <li key={`${l.productId}|${l.variantLabel ?? ""}`} className="flex items-center gap-2.5 text-[1rem]">
                  <LineThumb image={l.image} size={3} />
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 leading-snug">{l.title}</span>
                    {l.variantLabel && <span className="block text-[0.9375rem] text-foreground/65">Loại: {l.variantLabel}</span>}
                  </span>
                  <span className="shrink-0 whitespace-nowrap font-bold text-navy">× {l.qty}</span>
                  <MoneyText vnd={l.lineTotalVnd} bold={false} className="shrink-0 whitespace-nowrap" />
                </li>
              ))}
            </ul>
            <div className="mt-2 flex flex-col gap-0.5 border-t pt-2 text-[1rem]" style={{ borderColor: "var(--line)" }}>
              <p className="flex justify-between">
                <span className="text-foreground/70">Tiền hàng</span>
                <MoneyText vnd={g.subtotalVnd} bold={false} />
              </p>
              <p className="flex justify-between">
                <span className="text-foreground/70">Giao</span>
                {g.shippingVnd > 0 ? <MoneyText vnd={g.shippingVnd} bold={false} /> : <span className="font-bold text-ok">Miễn phí giao</span>}
              </p>
              <p className="flex justify-between">
                <span className="font-bold text-navy">Thành tiền shop này</span>
                <MoneyText vnd={g.totalVnd} />
              </p>
            </div>

            {/* Ghi chú RIÊNG cho shop này — nằm trong khối shop để không nhầm shop */}
            <div className="mt-3">
              <Field label={`Ghi chú cho ${g.shop.name} (không bắt buộc)`}>
                <textarea
                  className={inputClass}
                  rows={2}
                  maxLength={NOTE_MAX}
                  value={notes[g.shop.id] ?? ""}
                  onChange={(e) => setNotes((v) => ({ ...v, [g.shop.id]: e.target.value }))}
                  placeholder="Ví dụ: Giao trước 6h sáng, gọi trước khi tới."
                />
              </Field>
            </div>
          </div>
        ))}
      </section>

      {/* ── 4. Dòng chốt + nút ─────────────────────────────────────────── */}
      <div className="mt-2 rounded-2xl bg-field px-4 py-3">
        <p className="text-[1.0625rem] font-bold text-navy">
          Sẽ tạo {groups.length} đơn cho {groups.length} shop
        </p>
        <p className="mt-0.5 flex justify-between text-[1.125rem]">
          <span className="font-bold text-navy">Tổng</span>
          <MoneyText vnd={summary.totalVnd} />
        </p>
      </div>

      {sendError && (
        <div className="mt-3 overflow-hidden rounded-2xl">
          <StatusBanner level="danger">{sendError}</StatusBanner>
        </div>
      )}

      <PrimaryButton
        className="mt-4"
        disabled={sending || !chosen}
        onClick={() => void submit()}
      >
        {sending ? "Đang gửi…" : "Đặt hàng"}
      </PrimaryButton>
      <p className="mt-2 text-center text-[1rem] text-foreground/65">
        Không trả tiền trong app. Trả khi nhận hoặc chuyển khoản thẳng cho shop.
      </p>

      {addrSheet === "list" && (
        <BottomSheet title="Địa chỉ nhận hàng" onClose={() => setAddrSheet(null)}>
          <ul className="mb-3 flex flex-col gap-2">
            {addresses.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => {
                    const next = setDefaultAddress(addresses, a.id);
                    saveAddresses(phone, next);
                    setAddresses(next);
                    setAddrSheet(null);
                  }}
                  aria-pressed={a.isDefault}
                  className="flex min-h-[3.5rem] w-full items-center gap-3 rounded-2xl px-4 py-3 text-left"
                  style={{ backgroundColor: a.isDefault ? "var(--t3-bg)" : "var(--field)" }}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[1rem] font-bold text-navy">{a.name} · {a.phone}</span>
                    <span className="block text-[1rem] text-foreground/70">{a.detail}, {a.province}</span>
                  </span>
                  {a.isDefault && <CheckIcon className="h-6 w-6 shrink-0 text-t3" />}
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={openNewAddress}
            className="mb-2 flex min-h-[3.5rem] w-full items-center justify-center rounded-full bg-field text-[1.0625rem] font-bold text-navy"
          >
            + Thêm địa chỉ mới
          </button>
        </BottomSheet>
      )}

      {addrSheet === "form" && draft && (
        <BottomSheet title="Thêm địa chỉ nhận" onClose={() => setAddrSheet(addresses.length > 0 ? "list" : null)}>
          <AddressForm value={draft} onChange={setDraft} error={addrError} homeProvince={homeProvince} />
          <PrimaryButton className="mb-3 mt-1" onClick={saveDraft}>
            Lưu địa chỉ này
          </PrimaryButton>
        </BottomSheet>
      )}
    </div>
  );
}

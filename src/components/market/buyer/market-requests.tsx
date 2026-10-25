"use client";

// YÊU CẦU ĐẶT HÀNG — phía CHỦ TÀU (2026-10-18, chủ dự án: "cho phép chủ tàu đặt đơn bất kỳ
// cái gì, nó sẽ chuyển cho chủ sàn"). Ba màn trong một file vì chung khung:
//  · MyRequests     /cho/yeu-cau       danh sách + nút "Đặt món không có trên chợ"
//  · RequestForm    /cho/yeu-cau/moi   ghi món cần (tên, số lượng, mô tả, cần trước ngày, địa chỉ)
//  · RequestDetail  /cho/yeu-cau/[id]  xem báo giá → ĐỒNG Ý ĐẶT (sinh đơn) / huỷ
// Mất sóng: hiện bản lưu (requests-cache) + tuổi bản lưu; nút gửi vô hiệu kèm lý do.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ChevronRightIcon, DocIcon } from "@/components/icons";
import { AddressForm } from "@/components/market/shared/address-form";
import { EmptyNet } from "@/components/market/shared/empty-net";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ChipRow, type ChipOption } from "@/components/ui/chip-row";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState, Field, PrimaryButton, inputClass } from "@/components/ui/primitives";
import { StatusBanner } from "@/components/ui/status-banner";
import { clockVN } from "@/lib/day-labels";
import { savedAgoLabel } from "@/lib/forecast-cache";
import { formatVnd } from "@/lib/format";
import { loadAddresses, saveAddresses, seedAddress, upsertAddress } from "@/lib/market/addresses";
import { marketGet, marketPost, marketSend } from "@/lib/market/client";
import { etaLabel, vnToday } from "@/lib/market/eta";
import { PAYMENT_METHOD_LABEL } from "@/lib/market/order-state";
import { loadCachedRequests, saveCachedRequests } from "@/lib/market/requests-cache";
import { quoteTotal, REQUEST_STATUS_CHIP, REQUEST_STATUS_LABEL } from "@/lib/market/request-state";
import type { Address, MarketRequest, Order, PaymentMethod, RequestStatus } from "@/lib/market/types";
import { useOnlineRefetch } from "@/lib/market/use-online";
import { validateAddress, validateRequestDraft } from "@/lib/market/validate";
import { loadHome } from "@/lib/region";
import { useAuthUser } from "@/lib/use-auth";
import { useOnlineState } from "./hooks";
import { ErrorBlock, SheetActions, primaryLinkClass, textareaClass } from "./ui";

export function RequestStatusChip({ status }: { status: RequestStatus }) {
  const c = REQUEST_STATUS_CHIP[status];
  return (
    <span className="inline-flex items-center rounded-full px-3 py-1 text-[0.875rem] font-semibold" style={{ backgroundColor: c.bg, color: c.fg }}>
      {REQUEST_STATUS_LABEL[status]}
    </span>
  );
}

const newId = () => `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// ── Danh sách ─────────────────────────────────────────────────────────────
export function MyRequests() {
  const online = useOnlineState();
  const { phone } = useAuthUser();
  const [items, setItems] = useState<MarketRequest[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error" | "offline">("loading");
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    const res = await marketGet<{ items: MarketRequest[] }>("/api/cho/yeu-cau");
    if (!res.ok) {
      const c = loadCachedRequests(phone);
      if (c) {
        setItems(c.items);
        setSavedAt(c.savedAt);
        setStatus("ok");
      } else setStatus(res.offline ? "offline" : "error");
      return;
    }
    setItems(res.data.items);
    setSavedAt(null);
    setStatus("ok");
    saveCachedRequests(phone, res.data.items);
  }, [phone]);
  useEffect(() => void load(), [load]);
  useOnlineRefetch(() => void load());

  return (
    <div className="px-4 pb-[7rem] pt-3">
      <Link href="/cho/yeu-cau/moi" className={primaryLinkClass}>
        + Đặt món không có trên chợ
      </Link>
      <p className="mt-2 text-[1rem] text-foreground/75">
        Ghi món cần — chủ sàn tìm hàng, báo giá và ngày giao. Bà con đồng ý thì mới thành đơn.
      </p>
      {savedAt != null && (
        <p className="mt-3 rounded-2xl bg-field px-3.5 py-2.5 text-[1rem] font-semibold text-navy" role="status">
          Đang xem bản lưu trong máy ({savedAgoLabel(savedAt)}) — có sóng sẽ tự tải mới.
        </p>
      )}
      <div className="mt-4">
        {status === "loading" && <div className="surface h-28 animate-pulse" role="status" aria-label="Đang tải" />}
        {status === "error" && <ErrorBlock what="yêu cầu đặt hàng" onRetry={() => void load()} />}
        {status === "offline" && <EmptyNet what="yêu cầu đặt hàng" onRetry={() => void load()} />}
        {status === "ok" && items.length === 0 && (
          <EmptyState icon={<DocIcon className="h-8 w-8" />}>Chưa có yêu cầu nào. Cần món gì chợ chưa bán thì bấm nút cam ở trên.</EmptyState>
        )}
        {status === "ok" && items.length > 0 && (
          <ul className="flex flex-col gap-3">
            {items.map((r) => (
              <li key={r.id}>
                <Link href={`/cho/yeu-cau/${r.id}`} className="surface flex min-h-(--row-h) items-start gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <b className="text-[1rem] text-navy">{r.title}</b>
                      <RequestStatusChip status={r.status} />
                    </span>
                    <span className="mt-0.5 block text-[1rem] text-foreground/75">{r.qty} {r.unit} · {r.code}</span>
                    {r.status === "da_bao_gia" && r.quote && (
                      <span className="mt-1 block text-[1rem] font-semibold text-navy">
                        {formatVnd(quoteTotal(r.quote))} · giao {etaLabel(r.quote.etaFrom, r.quote.etaTo, vnToday())}
                      </span>
                    )}
                  </span>
                  <ChevronRightIcon className="mt-1 h-6 w-6 shrink-0 text-navy" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      {!online && status !== "loading" && <p className="mt-3 text-[1rem] text-foreground/70">Gửi yêu cầu mới cần có sóng.</p>}
    </div>
  );
}

// ── Gửi yêu cầu mới ──────────────────────────────────────────────────────
const UNITS = ["cái", "bộ", "thùng", "cuộn", "kg", "lít", "tấm"];
/* nhãn ≤2 chữ (03 §Nhãn) — `PAYMENT_METHOD_LABEL` ("Trả tiền khi nhận hàng") dành cho câu đọc,
   không cho chip; chưa có trong labels.ts nên tạm đặt tại chỗ (ghi DONE.md cho khu cho-ca) */
const PAY_OPTIONS: readonly ChipOption<PaymentMethod>[] = [
  { id: "cod", label: "Tiền mặt" },
  { id: "chuyen_khoan", label: "Chuyển khoản" },
];

/** điền sẵn từ ?ten= &sl= &dv= (ô tìm không ra món · Sen Biển "nhờ chủ sàn tìm 2 cái …") */
export function RequestForm({ initialTitle = "", initialQty = 1, initialUnit = "cái" }: { initialTitle?: string; initialQty?: number; initialUnit?: string }) {
  const router = useRouter();
  const online = useOnlineState();
  const { phone, ready } = useAuthUser();
  const homeProvince = loadHome()?.province;
  const [title, setTitle] = useState(initialTitle);
  const [qty, setQty] = useState(String(initialQty));
  const [unit, setUnit] = useState(initialUnit);
  const [description, setDescription] = useState("");
  const [needBy, setNeedBy] = useState("");
  const [pay, setPay] = useState<PaymentMethod>("cod");
  const [addr, setAddr] = useState<Address | null>(null);
  const [addrSheet, setAddrSheet] = useState(false);
  /** lỗi tên món / số lượng — vẽ ở trang */
  const [err, setErr] = useState<string | null>(null);
  /** lỗi địa chỉ — vẽ TRONG ngăn, đúng dưới ô sai (VT-01: trước đây dùng chung `err` nên
      câu lỗi nằm sau lưng tấm che, bà con bấm không thấy gì đổi) */
  const [addrErr, setAddrErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ready) return;
    const list = loadAddresses(phone);
    const chosen = list.find((a) => a.isDefault) ?? list[0];
    // KHÔNG tự bật ngăn khi chưa có địa chỉ (VT-01): bà con gõ món trước, hàng "Giao tới ·
    // Chưa có địa chỉ · Thêm" chờ ở dưới như Shopee; thiếu thì lúc Gửi mới mở ngăn.
    setAddr(chosen ?? seedAddress({ phone: phone ?? "", province: homeProvince }));
  }, [ready, phone, homeProvince]);

  const submit = async () => {
    if (busy || !addr) return;
    const draft = { title: title.trim(), qty: Number(qty), unit: unit.trim(), description: description.trim() || undefined, needBy: needBy || undefined, address: addr, paymentMethod: pay };
    const bad = validateRequestDraft(draft, vnToday());
    if (bad) {
      // lỗi địa chỉ ⇒ mở ngăn và báo trong ngăn; lỗi khác ⇒ báo ở trang
      if (validateAddress(addr)) { setErr(null); setAddrErr(bad); setAddrSheet(true); return; }
      setErr(bad);
      return;
    }
    setErr(null);
    setBusy(true);
    const res = await marketPost<{ request: MarketRequest }>("/api/cho/yeu-cau", draft);
    setBusy(false);
    if (!res.ok) {
      setErr(res.offline ? "Chưa gửi được — cần có sóng. Nội dung vẫn còn đây." : res.message || "Chưa gửi được — thử lại giúp.");
      return;
    }
    saveCachedRequests(phone, [res.data.request]);
    router.replace(`/cho/yeu-cau/${res.data.request.id}?moi=1`);
  };

  return (
    <div className="px-4 pb-[7rem] pt-3">
      <Field label="Cần món gì?">
        <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Ví dụ: chân vịt inox 3 cánh 18 inch" />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Số lượng">
          <input className={inputClass} inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, "").slice(0, 4))} />
        </Field>
        <Field label="Đơn vị">
          <input className={inputClass} value={unit} onChange={(e) => setUnit(e.target.value)} maxLength={20} list="yc-units" />
          <datalist id="yc-units">{UNITS.map((u) => <option key={u} value={u} />)}</datalist>
        </Field>
      </div>
      <Field label="Mô tả thêm (hiệu, cỡ, đời máy…)">
        <textarea className={textareaClass} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} placeholder="Càng rõ chủ sàn càng tìm đúng hàng" />
      </Field>
      <Field label="Cần trước ngày (không bắt buộc)">
        <input type="date" className={inputClass} min={vnToday()} value={needBy} onChange={(e) => setNeedBy(e.target.value)} />
      </Field>

      <div className="surface mt-2 px-4 py-3">
        <p className="text-[1rem] font-semibold text-navy">Giao tới</p>
        {addr && !validateAddress(addr) ? (
          <p className="mt-1 text-[1rem] text-foreground/85">{addr.name} · {addr.phone}<br />{addr.isPort ? "Cảng/bến: " : ""}{addr.detail} · {addr.province}</p>
        ) : (
          <p className="mt-1 text-[1rem] text-foreground/70">Chưa có địa chỉ nhận.</p>
        )}
        <button type="button" onClick={() => { setAddrErr(null); setAddrSheet(true); }} className="sq-btn mt-2 bg-field text-navy">
          {addr && !validateAddress(addr) ? "Đổi" : "Thêm"}
        </button>
      </div>

      <p className="mb-2 mt-4 text-[1rem] font-semibold text-navy">Trả tiền</p>
      {/* chip chọn = navy như ChipRow (03 §0b), nhãn ≤2 chữ (VT-15) — trước là pill nâu t3 với
          "Trả tiền khi nhận hàng" gãy 2 dòng */}
      <div className="-mx-4">
        <ChipRow options={PAY_OPTIONS} value={pay} onChange={setPay} level={1} ariaLabel="Trả tiền" />
      </div>

      {err && <p className="mt-3 text-[1rem] font-semibold" style={{ color: "var(--danger)" }} role="alert">{err}</p>}
      <div className="mt-4">
        <PrimaryButton disabled={busy || !online} onClick={() => void submit()}>
          {busy ? "Đang gửi…" : "Gửi cho chủ sàn"}
        </PrimaryButton>
        {!online && <p className="mt-2 text-center text-[1rem] text-foreground/70">Cần có sóng để gửi — nội dung vẫn giữ.</p>}
      </div>

      {addrSheet && addr && (
        <BottomSheet kieu="form" title="Địa chỉ nhận hàng" onClose={() => setAddrSheet(false)}>
          {/* KHÔNG lề riêng: BottomSheet đã p-5 — px-4 thêm làm nhãn thụt 16px so với tiêu đề
              ngăn (rà bố cục 2026-10-22) */}
          <div className="pb-4">
            <AddressForm value={addr} onChange={setAddr} error={addrErr} homeProvince={homeProvince} />
            <SheetActions
              className="mt-1"
              okLabel="Lưu"
              onCancel={() => setAddrSheet(false)}
              onOk={() => {
                const bad = validateAddress(addr);
                if (bad) { setAddrErr(bad); return; }
                // lưu vào sổ địa chỉ chung của chợ (cùng sổ với Đặt hàng) — lỗi ghi không chặn gửi
                saveAddresses(phone, upsertAddress(loadAddresses(phone), { ...addr, id: newId(), isDefault: loadAddresses(phone).length === 0 }));
                setAddrErr(null);
                setAddrSheet(false);
              }}
            />
          </div>
        </BottomSheet>
      )}
    </div>
  );
}

// ── Chi tiết + đồng ý báo giá ─────────────────────────────────────────────
export function RequestDetail({ id }: { id: string }) {
  const router = useRouter();
  const online = useOnlineState();
  const { phone } = useAuthUser();
  const [r, setR] = useState<MarketRequest | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "error" | "offline" | "missing">("loading");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [ask, setAsk] = useState<"dong_y" | "huy" | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [fresh] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("moi") === "1");
  const [nowMs] = useState(() => Date.now());

  const load = useCallback(async () => {
    const res = await marketGet<{ request: MarketRequest; order: Order | null }>(`/api/cho/yeu-cau/${id}`);
    if (!res.ok) {
      if (res.status === 404) { setStatus("missing"); return; }
      const c = loadCachedRequests(phone)?.items.find((x) => x.id === id);
      if (c) { setR(c); setSavedAt(loadCachedRequests(phone)!.savedAt); setStatus("ok"); }
      else setStatus(res.offline ? "offline" : "error");
      return;
    }
    setR(res.data.request);
    setOrder(res.data.order);
    setSavedAt(null);
    setStatus("ok");
    saveCachedRequests(phone, [res.data.request]);
  }, [id, phone]);
  useEffect(() => void load(), [load]);
  useOnlineRefetch(() => void load());

  const act = async (action: "dong_y" | "huy") => {
    if (busy) return;
    setBusy(true);
    setNote(null);
    const res = await marketSend<{ request: MarketRequest; order?: Order }>("PATCH", `/api/cho/yeu-cau/${id}`, { action });
    setBusy(false);
    if (!res.ok) {
      setNote(res.offline ? "Chưa gửi được — cần có sóng." : res.message || "Chưa làm được — thử lại giúp.");
      if (res.code === "bad_transition") void load();
      return;
    }
    setR(res.data.request);
    saveCachedRequests(phone, [res.data.request]);
    if (action === "dong_y" && res.data.order) router.push(`/cho/don/${res.data.order.id}`);
    else setNote("Đã huỷ yêu cầu.");
  };

  if (status === "loading") return <div className="px-4 pt-3"><div className="surface h-40 animate-pulse" role="status" aria-label="Đang tải" /></div>;
  if (status === "missing") return <div className="px-4 pt-3"><EmptyState icon={<DocIcon className="h-8 w-8" />}>Không thấy yêu cầu này.</EmptyState></div>;
  if (status === "error") return <div className="px-4 pt-3"><ErrorBlock what="yêu cầu" onRetry={() => void load()} /></div>;
  if (status === "offline" || !r) return <div className="px-4 pt-3"><EmptyNet what="yêu cầu này" onRetry={() => void load()} /></div>;

  const today = vnToday();
  const q = r.quote;
  const expiresLeft = q ? Date.parse(q.expiresAt) - nowMs : 0;

  return (
    <div className="px-4 pb-[7rem] pt-3">
      {fresh && r.status === "moi" && (
        <div className="mb-3 overflow-hidden rounded-2xl">
          <StatusBanner level="ok">Đã gửi cho chủ sàn. Có giá sẽ báo vào hộp thư của bà con.</StatusBanner>
        </div>
      )}
      {savedAt != null && (
        <p className="mb-3 rounded-2xl bg-field px-3.5 py-2.5 text-[1rem] font-semibold text-navy" role="status">
          Đang xem bản lưu ({savedAgoLabel(savedAt)}) — có sóng sẽ tự tải mới.
        </p>
      )}
      {note && <p className="mb-3 rounded-2xl bg-field px-3.5 py-2.5 text-[1rem] font-semibold text-navy" role="status">{note}</p>}

      <section className="surface px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <b className="text-[1rem] text-navy">{r.title}</b>
          <RequestStatusChip status={r.status} />
        </div>
        <p className="mt-1 text-[1rem] text-foreground/80">{r.qty} {r.unit} · mã {r.code}</p>
        {r.description && <p className="mt-2 rounded-2xl bg-field px-3.5 py-2.5 text-[1rem] text-foreground/85">{r.description}</p>}
        {r.needBy && <p className="mt-1 text-[1rem] text-foreground/80">Cần trước {etaLabel(r.needBy, r.needBy, today)}</p>}
        <p className="mt-2 text-[1rem] text-foreground/80">Giao tới {r.address.name} · {r.address.detail}, {r.address.province}</p>
        <p className="text-[1rem] text-foreground/80">{PAYMENT_METHOD_LABEL[r.paymentMethod]}</p>
      </section>

      {r.status === "moi" && (
        <p className="mt-3 rounded-2xl bg-field px-4 py-3 text-[1rem] text-navy">Chủ sàn đang tìm hàng. Thường trả lời trong 1–2 ngày; quá 7 ngày yêu cầu tự hết hạn.</p>
      )}

      {q && (r.status === "da_bao_gia" || r.status === "da_dat" || r.status === "het_han") && (
        <section className="surface mt-3 px-4 py-3">
          <h3 className="text-[1rem] font-semibold text-navy">Báo giá của chủ sàn</h3>
          <p className="mt-1 flex justify-between text-[1rem] text-foreground/80"><span>Tiền hàng</span><span>{formatVnd(q.goodsVnd)}</span></p>
          <p className="flex justify-between text-[1rem] text-foreground/80"><span>Phí giao</span><span>{formatVnd(q.shippingVnd)}</span></p>
          <p className="mt-1 flex justify-between text-[1rem] font-semibold text-navy"><span>Tổng</span><span>{formatVnd(quoteTotal(q))}</span></p>
          <p className="mt-2 rounded-2xl bg-field px-3.5 py-2.5 text-[1rem] font-semibold text-navy">Hẹn giao {etaLabel(q.etaFrom, q.etaTo, today)}</p>
          {r.quoteShopName && <p className="mt-1 text-[1rem] text-foreground/80">Shop lo hàng: {r.quoteShopName}</p>}
          {q.note && <p className="mt-1 text-[1rem] text-foreground/85">Chủ sàn dặn: {q.note}</p>}
          {r.status === "da_bao_gia" && (
            <p className="mt-2 text-[0.875rem] text-foreground/70">
              Giá giữ tới {clockVN(Date.parse(q.expiresAt))}{expiresLeft < 24 * 3600 * 1000 ? " — sắp hết hạn" : ""}.
            </p>
          )}
        </section>
      )}

      {r.status === "khong_tim_duoc" && (
        <div className="mt-3 overflow-hidden rounded-2xl">
          <StatusBanner level="danger">Chủ sàn chưa tìm được: {r.rejectReason || "không ghi lý do"}.</StatusBanner>
        </div>
      )}
      {r.status === "het_han" && (
        <p className="mt-3 rounded-2xl bg-field px-4 py-3 text-[1rem] text-navy">
          {r.timeline.at(-1)?.note || "Yêu cầu đã hết hạn."}{" "}
          <Link href={`/cho/yeu-cau/moi?ten=${encodeURIComponent(r.title)}`} className="font-semibold text-sea underline">Gửi lại</Link>
        </p>
      )}
      {r.status === "da_dat" && (r.orderId || order) && (
        <Link href={`/cho/don/${r.orderId ?? order?.id}`} className={`${primaryLinkClass} mt-3`}>
          Xem đơn hàng {order?.code ?? ""}
        </Link>
      )}

      {r.status === "da_bao_gia" && (
        <div className="mt-4">
          <PrimaryButton disabled={busy || !online} onClick={() => setAsk("dong_y")}>
            {busy ? "Đang gửi…" : `Đồng ý đặt · ${q ? formatVnd(quoteTotal(q)) : ""}`}
          </PrimaryButton>
        </div>
      )}
      {(r.status === "moi" || r.status === "da_bao_gia") && (
        <div className="mt-3 flex justify-center">
          <button type="button" disabled={busy || !online} onClick={() => setAsk("huy")}
            className="min-h-(--row-h) rounded-full bg-field px-5 text-[1rem] font-semibold disabled:opacity-40" style={{ color: "var(--danger)" }}>
            Huỷ yêu cầu
          </button>
        </div>
      )}
      {!online && (r.status === "moi" || r.status === "da_bao_gia") && (
        <p className="mt-2 text-center text-[1rem] text-foreground/70">Đồng ý / huỷ cần có sóng.</p>
      )}

      {ask && (
        <ConfirmDialog
          title={ask === "dong_y" ? "Đặt hàng theo báo giá này?" : "Huỷ yêu cầu này?"}
          message={ask === "dong_y" && q ? `${formatVnd(quoteTotal(q))} · giao ${etaLabel(q.etaFrom, q.etaTo, today)}. Bấm xong là thành đơn, shop chuẩn bị hàng.` : "Chủ sàn sẽ thôi tìm hàng cho món này."}
          confirmLabel={ask === "dong_y" ? "Đặt hàng" : "Huỷ yêu cầu"}
          danger={ask === "huy"}
          onCancel={() => setAsk(null)}
          onConfirm={() => { const a = ask; setAsk(null); void act(a); }}
        />
      )}
    </div>
  );
}

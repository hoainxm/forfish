"use client";

// YÊU CẦU ĐẶT HÀNG — phía CHỦ TÀU (2026-10-18, chủ dự án: "cho phép chủ tàu đặt đơn bất kỳ
// cái gì, nó sẽ chuyển cho chủ sàn"). Ba màn trong một file vì chung khung:
//  · MyRequests     /cho/yeu-cau       danh sách + nút "Đặt món không có trên chợ"
//  · RequestForm    /cho/yeu-cau/moi   ghi món cần (tên, số lượng, mô tả, cần trước ngày, địa chỉ)
//  · RequestDetail  /cho/yeu-cau/[id]  xem báo giá → ĐỒNG Ý ĐẶT (sinh đơn) / huỷ
// Mất sóng: hiện bản lưu (requests-cache) + tuổi bản lưu; nút gửi vô hiệu kèm lý do.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronRightIcon, DocIcon } from "@/components/icons";
import { AddressForm } from "@/components/market/shared/address-form";
import { EmptyNet } from "@/components/market/shared/empty-net";
import { useLeaveGuard } from "@/components/market/shared/market-header";
import { NetChip } from "@/components/market/shared/net-chip";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ChipRow, type ChipOption } from "@/components/ui/chip-row";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { OfflineLine } from "@/components/ui/offline-line";
import { EmptyState, Field, PrimaryButton, inputClass, textareaClass } from "@/components/ui/primitives";
import { StatusBanner } from "@/components/ui/status-banner";
import { KeoLamMoiChi, useKeoLamMoi } from "@/components/ui/use-keo-lam-moi";
import { clockVN } from "@/lib/day-labels";
import { savedAgoLabel } from "@/lib/forecast-cache";
import { formatVnd } from "@/lib/format";
import { NHAN } from "@/lib/labels";
import { loadAddresses, saveAddresses, seedAddress, upsertAddress } from "@/lib/market/addresses";
import { marketGet, marketPost, marketSend } from "@/lib/market/client";
import { etaLabel, vnToday } from "@/lib/market/eta";
import { PAYMENT_METHOD_LABEL } from "@/lib/market/order-state";
import {
  coChuMoi, docNhapYeuCau, duDeGui, loiTungO, luuNhapYeuCau, oDauSai, xoaNhapYeuCau,
  type RequestFieldErrors, type RequestFieldKey, type RequestFormDraft,
} from "@/lib/market/request-form";
import { loadCachedRequests, saveCachedRequests } from "@/lib/market/requests-cache";
import { quoteTotal, REQUEST_STATUS_CHIP, REQUEST_STATUS_LABEL } from "@/lib/market/request-state";
import type { Address, MarketRequest, Order, PaymentMethod, RequestStatus } from "@/lib/market/types";
import { useOnlineRefetch } from "@/lib/market/use-online";
import { validateAddress, validateRequestDraft } from "@/lib/market/validate";
import { loadHome } from "@/lib/region";
import { useAuthUser } from "@/lib/use-auth";
import { useOnlineState } from "./hooks";
import { ErrorBlock, SheetActions, primaryLinkClass } from "./ui";

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

  /** chip báo khi KÉO LÀM MỚI mà mất sóng/lỗi — giữ danh sách đang xem (VT-18) */
  const [netNote, setNetNote] = useState<{ state: "offline" | "error"; text: string } | null>(null);

  /** `im` = làm mới lặng (kéo xuống): không skeleton lại cả màn, hỏng thì giữ danh sách + một chip */
  const load = useCallback(async (im = false) => {
    if (!im) setStatus("loading");
    const res = await marketGet<{ items: MarketRequest[] }>("/api/cho/yeu-cau");
    if (!res.ok) {
      if (im) {
        setNetNote({ state: res.offline ? "offline" : "error", text: res.offline ? "Không có sóng — đang xem bản đã tải" : "Chợ trục trặc — đang xem bản đã tải" });
        return;
      }
      const c = loadCachedRequests(phone);
      if (c) {
        setItems(c.items);
        setSavedAt(c.savedAt);
        setStatus("ok");
      } else setStatus(res.offline ? "offline" : "error");
      return;
    }
    setNetNote(null);
    setItems(res.data.items);
    setSavedAt(null);
    setStatus("ok");
    saveCachedRequests(phone, res.data.items);
  }, [phone]);
  useEffect(() => void load(), [load]);
  useOnlineRefetch(() => void load());
  const lamMoi = useKeoLamMoi(() => load(true), { disabled: status === "loading" });

  return (
    <div className="px-4 pb-[7rem] pt-3">
      {/*  VT-20: nút "+ Đặt món" đã lên header (`MarketHeader right`, app/cho/yeu-cau/page.tsx);
          bỏ nút cam 3.75rem + hai dòng hướng dẫn — ba lớp chữ nói cùng một điều. */}
      {netNote && <NetChip state={netNote.state} text={netNote.text} />}
      {savedAt != null && (online ? (
        <p className="mb-3 rounded-2xl bg-field px-3.5 py-2.5 text-[1rem] font-semibold text-navy" role="status">
          Đang xem bản lưu trong máy ({savedAgoLabel(savedAt)}) — có sóng sẽ tự tải mới.
        </p>
      ) : (
        <div className="mb-3 overflow-hidden rounded-2xl"><OfflineLine savedAt={savedAt} /></div>
      ))}
      <KeoLamMoiChi {...lamMoi.chi} />
      <div>
        {status === "loading" && <div className="surface h-28 animate-pulse" role="status" aria-label="Đang tải" />}
        {status === "error" && <ErrorBlock what="yêu cầu đặt hàng" onRetry={() => void load()} />}
        {status === "offline" && <EmptyNet what="yêu cầu đặt hàng" onRetry={() => void load()} />}
        {status === "ok" && items.length === 0 && (
          <EmptyState icon={<DocIcon className="h-8 w-8" />}>
            Chưa có yêu cầu nào.
            <span className="mt-3 block"><Link href="/cho/yeu-cau/moi" className="sq-btn bg-field text-navy">Đặt món</Link></span>
          </EmptyState>
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
      {!online && status !== "loading" && savedAt == null && (
        <div className="mt-3 overflow-hidden rounded-2xl"><OfflineLine extra=" · gửi yêu cầu mới cần có sóng" /></div>
      )}
    </div>
  );
}

// ── Gửi yêu cầu mới ──────────────────────────────────────────────────────
const UNITS = ["cái", "bộ", "thùng", "cuộn", "kg", "lít", "tấm"];
/* nhãn ≤2 chữ (03 §Nhãn) — `PAYMENT_METHOD_LABEL` ("Trả tiền khi nhận hàng") dành cho câu đọc, không cho chip */
const PAY_OPTIONS: readonly ChipOption<PaymentMethod>[] = [
  { id: "cod", label: NHAN.tienMat },
  { id: "chuyen_khoan", label: NHAN.chuyenKhoan },
];

/** Bản đầu của form — để biết bà con đã gõ gì chưa (hỏi "Bỏ phần đang ghi?") */
const banDau = (title: string, qty: number, unit: string): RequestFormDraft => ({
  title, qty: String(qty), unit, description: "", needBy: "", pay: "cod",
});

/** điền sẵn từ ?ten= &sl= &dv= (ô tìm không ra món · Sen Biển "nhờ chủ sàn tìm 2 cái …") */
export function RequestForm({ initialTitle = "", initialQty = 1, initialUnit = "cái" }: { initialTitle?: string; initialQty?: number; initialUnit?: string }) {
  const router = useRouter();
  const online = useOnlineState();
  const { phone, ready } = useAuthUser();
  const homeProvince = loadHome()?.province;
  /*  VT-11: một object cho cả form — nháp ghi/đọc một cục, lỗi theo ô dò theo khoá.
      Mở từ link có ?ten= là việc MỚI (Sen Biển / trang món "Nhờ báo giá") ⇒ dùng link, không
      nhả nháp cũ; mở trơn thì khôi phục nháp còn trong phiên (gõ dở rồi chạm ‹ / lỡ sang màn). */
  const goc = banDau(initialTitle, initialQty, initialUnit);
  const [d, setD] = useState<RequestFormDraft>(goc);
  const [daDocNhap, setDaDocNhap] = useState(false);
  const [addr, setAddr] = useState<Address | null>(null);
  const [addrSheet, setAddrSheet] = useState(false);
  /** lỗi THEO Ô — câu ngay dưới ô sai, viền đỏ (Field error), focus + cuộn tới ô đầu sai */
  const [loiO, setLoiO] = useState<RequestFieldErrors>({});
  /** lỗi gửi (mạng / máy chủ) — vẽ trên nút Gửi; lỗi ô không còn nằm đây */
  const [err, setErr] = useState<string | null>(null);
  /** lỗi địa chỉ — vẽ TRONG ngăn, đúng dưới ô sai (VT-01: trước đây dùng chung `err` nên
      câu lỗi nằm sau lưng tấm che, bà con bấm không thấy gì đổi) */
  const [addrErr, setAddrErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const oRef = useRef<Record<RequestFieldKey, HTMLInputElement | null>>({ title: null, qty: null, unit: null, needBy: null });

  useEffect(() => {
    if (!initialTitle) {
      const nhap = docNhapYeuCau();
      if (nhap) setD(nhap);
    }
    setDaDocNhap(true);
    // chỉ đọc một lần lúc mở màn
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // nháp theo từng phím (sessionStorage, nhỏ) — chỉ sau khi đã đọc nháp cũ, kẻo bản đầu đè mất nháp
  const daGo = coChuMoi(d, goc);
  useEffect(() => {
    if (!daDocNhap) return;
    if (daGo) luuNhapYeuCau(d);
    else xoaNhapYeuCau();
  }, [d, daGo, daDocNhap]);
  // chạm ‹ khi đã gõ ⇒ header hỏi "Bỏ phần đang ghi?" (nháp vẫn còn trong phiên — quay lại là có)
  useLeaveGuard(daGo && !busy);

  useEffect(() => {
    if (!ready) return;
    const list = loadAddresses(phone);
    const chosen = list.find((a) => a.isDefault) ?? list[0];
    // KHÔNG tự bật ngăn khi chưa có địa chỉ (VT-01): bà con gõ món trước, hàng "Giao tới ·
    // Chưa có địa chỉ · Thêm" chờ ở dưới như Shopee; thiếu thì lúc Gửi mới mở ngăn.
    setAddr(chosen ?? seedAddress({ phone: phone ?? "", province: homeProvince }));
  }, [ready, phone, homeProvince]);

  const set = <K extends keyof RequestFormDraft>(k: K, v: RequestFormDraft[K]) => {
    setD((cu) => ({ ...cu, [k]: v }));
    // sửa ô đang đỏ ⇒ tắt câu lỗi của ô đó ngay, không chờ bấm Gửi lại
    if (k in loiO) setLoiO((cu) => { const { [k as RequestFieldKey]: _bo, ...con } = cu; void _bo; return con; });
  };

  const submit = async () => {
    if (busy || !addr) return;
    const today = vnToday();
    const loi = loiTungO(d, today);
    const oDau = oDauSai(loi);
    if (oDau) {
      setLoiO(loi);
      setErr(null);
      const el = oRef.current[oDau];
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
      el?.focus({ preventScroll: true });
      return;
    }
    const draft = { title: d.title.trim(), qty: Number(d.qty), unit: d.unit.trim(), description: d.description.trim() || undefined, needBy: d.needBy || undefined, address: addr, paymentMethod: d.pay };
    // cổng cuối — cùng luật server; tới đây chỉ còn địa chỉ (hay cách trả tiền) có thể sai
    const bad = validateRequestDraft(draft, today);
    if (bad) {
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
    xoaNhapYeuCau();
    saveCachedRequests(phone, [res.data.request]);
    router.replace(`/cho/yeu-cau/${res.data.request.id}?moi=1`);
  };

  return (
    <div className="px-4 pb-[7rem] pt-3">
      <Field label="Cần món gì?" error={loiO.title}>
        <input ref={(el) => { oRef.current.title = el; }} className={inputClass} value={d.title} onChange={(e) => set("title", e.target.value)} maxLength={120} placeholder="Ví dụ: chân vịt inox 3 cánh 18 inch" />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Số lượng" error={loiO.qty}>
          <input ref={(el) => { oRef.current.qty = el; }} className={inputClass} inputMode="numeric" value={d.qty} onChange={(e) => set("qty", e.target.value.replace(/\D/g, "").slice(0, 4))} />
        </Field>
        <Field label="Đơn vị" error={loiO.unit}>
          <input ref={(el) => { oRef.current.unit = el; }} className={inputClass} value={d.unit} onChange={(e) => set("unit", e.target.value)} maxLength={20} list="yc-units" />
        </Field>
      </div>
      <datalist id="yc-units">{UNITS.map((u) => <option key={u} value={u} />)}</datalist>
      <Field label="Mô tả thêm (hiệu, cỡ, đời máy…)">
        <textarea className={textareaClass} rows={3} value={d.description} onChange={(e) => set("description", e.target.value)} maxLength={1000} placeholder="Càng rõ chủ sàn càng tìm đúng hàng" />
      </Field>
      <Field label="Cần trước ngày (không bắt buộc)" error={loiO.needBy}>
        <input ref={(el) => { oRef.current.needBy = el; }} type="date" className={inputClass} min={vnToday()} value={d.needBy} onChange={(e) => set("needBy", e.target.value)} />
      </Field>

      <div className="surface mt-2 px-4 py-3">
        <p className="text-[1rem] font-semibold text-navy">Giao tới</p>
        {addr && !validateAddress(addr) ? (
          <p className="mt-1 text-[1rem] text-foreground/85">{addr.name} · {addr.phone}<br />{addr.isPort ? "Cảng/bến: " : ""}{addr.detail} · {addr.province}</p>
        ) : (
          <p className="mt-1 text-[1rem] text-foreground/70">Chưa có địa chỉ nhận.</p>
        )}
        <button type="button" onClick={() => { setAddrErr(null); setAddrSheet(true); }} className="sq-btn mt-2 bg-field text-navy">
          {addr && !validateAddress(addr) ? NHAN.sua : NHAN.them}
        </button>
      </div>

      <p className="mb-2 mt-4 text-[1rem] font-semibold text-navy">Trả tiền</p>
      {/* chip chọn = navy như ChipRow (03 §0b), nhãn ≤2 chữ (VT-15) — trước là pill nâu t3 với
          "Trả tiền khi nhận hàng" gãy 2 dòng */}
      <div className="-mx-4">
        <ChipRow options={PAY_OPTIONS} value={d.pay} onChange={(v) => set("pay", v)} level={1} ariaLabel="Trả tiền" />
      </div>

      {err && <p className="mt-3 text-[1rem] font-semibold text-danger" role="alert">{err}</p>}
      <div className="mt-4">
        {/* mờ tới khi có tên món (VT-11) — các ô khác báo dưới ô lúc bấm, không mờ nút vì thiếu chúng */}
        <PrimaryButton disabled={busy || !online || !duDeGui(d.title)} onClick={() => void submit()}>
          {busy ? "Đang gửi…" : "Gửi cho chủ sàn"}
        </PrimaryButton>
        {!online && <div className="mt-2 overflow-hidden rounded-2xl"><OfflineLine extra=" · gửi cần có sóng, nội dung vẫn giữ" /></div>}
      </div>

      {addrSheet && addr && (
        <BottomSheet kieu="form" title="Địa chỉ nhận hàng" onClose={() => setAddrSheet(false)}>
          {/* KHÔNG lề riêng: BottomSheet đã p-5 — px-4 thêm làm nhãn thụt 16px so với tiêu đề
              ngăn (rà bố cục 2026-10-22) */}
          <div className="pb-4">
            <AddressForm value={addr} onChange={setAddr} error={addrErr} homeProvince={homeProvince} />
            <SheetActions
              className="mt-1"
              okLabel={NHAN.luu}
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
      {savedAt != null && (online ? (
        <p className="mb-3 rounded-2xl bg-field px-3.5 py-2.5 text-[1rem] font-semibold text-navy" role="status">
          Đang xem bản lưu ({savedAgoLabel(savedAt)}) — có sóng sẽ tự tải mới.
        </p>
      ) : (
        <div className="mb-3 overflow-hidden rounded-2xl"><OfflineLine savedAt={savedAt} /></div>
      ))}
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
      {!online && (r.status === "moi" || r.status === "da_bao_gia") && savedAt == null && (
        <div className="mt-2 overflow-hidden rounded-2xl"><OfflineLine extra=" · đồng ý / huỷ cần có sóng" /></div>
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

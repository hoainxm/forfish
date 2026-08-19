"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { StatusBanner } from "@/components/ui/status-banner";
import {
  EmptyState,
  Field,
  inputClass,
  PrimaryButton,
  RefNote,
} from "@/components/ui/primitives";
import {
  CartIcon,
  CheckIcon,
  MinusIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/icons";
import { useBoats } from "@/components/boat-switcher";
import { authedFetch } from "@/lib/device-token-store";
import { timeoutSignal } from "@/lib/abort";
import { formatVnd } from "@/lib/format";
import { isValidVnPhone, sanitizePhoneInput } from "@/lib/phone";
import { useOnline } from "@/lib/use-online";
import {
  cartTotalVnd,
  removeItem,
  setQty,
  type CartLine,
} from "@/lib/cart";
import { orderClientRef, type OrderDraft } from "@/lib/catalog-orders";
import { type ProductListing } from "@/lib/product-catalog";

/*
  GIỎ HÀNG + đặt đơn (2026-08-11) — bước cuối của chợ đặt hàng ở tab Sản phẩm.
  Online-only: POST /api/me/orders cần mạng, mất sóng thì BÁO THẬT, không treo
  (timeoutSignal 20s + catch). Server tra lại giá từ danh mục và tính lại tổng
  (không tin giá client). Đặt xong xoá giỏ + gợi ý xem ở "Đơn của tôi".
*/

/** Một món trong giỏ đã tra danh mục — kèm cờ còn bán được hay không. */
function useResolvedLines(items: CartLine[], catalog: ProductListing[]) {
  return useMemo(() => {
    const byId = new Map(catalog.map((p) => [p.id, p]));
    return items.map((it) => {
      const p = byId.get(it.listingId);
      const available = Boolean(
        p &&
          p.orderable &&
          p.visible &&
          p.priceVnd != null &&
          p.priceVnd > 0 &&
          p.unit,
      );
      return { line: it, product: p ?? null, available };
    });
  }, [items, catalog]);
}

export function CartSheet({
  phone,
  signedIn,
  items,
  catalog,
  saveFailed = false,
  onClose,
  onItemsChange,
  onOrdered,
}: {
  phone: string | null;
  signedIn: boolean;
  items: CartLine[];
  catalog: ProductListing[];
  /** máy không giữ được giỏ (cha biết qua `saveCart`) — băng đỏ trong sheet (G5) */
  saveFailed?: boolean;
  onClose: () => void;
  /** Cập nhật giỏ ở component cha (cha lo lưu localStorage). */
  onItemsChange: (next: CartLine[]) => void;
  /** Đặt xong — cha xoá giỏ. */
  onOrdered: () => void;
}) {
  const { boats, current } = useBoats();
  const router = useRouter();
  const online = useOnline();
  const resolved = useResolvedLines(items, catalog);
  const total = cartTotalVnd(items, catalog);
  const hasUnavailable = resolved.some((r) => !r.available);

  const [boatId, setBoatId] = useState<string>(current?.id ?? "");
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState(phone ?? "");
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">(
    "idle",
  );
  const [errMsg, setErrMsg] = useState("");
  /** đơn vừa đặt xong — mã + tổng + SĐT nhận để bà con đối chiếu (audit G4/G6) */
  const [placed, setPlaced] = useState<{
    id: string | null;
    totalVnd: number;
    contactPhone: string;
  } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (items.length === 0) return;
    /*  CHƯA ĐĂNG NHẬP → MỞ THẲNG /login, không đợi máy chủ trả `login_required`
        (audit 2026-08-18 G7: một nudge/màn — RefNote ở trên đã nói, bấm là đi
        luôn, đỡ một vòng lỗi). Giỏ giữ nguyên trong máy, quay lại đặt tiếp. */
    if (!signedIn) {
      if (!online) {
        setState("error");
        setErrMsg(
          "Đặt hàng cần đăng nhập, mà đăng nhập thì cần sóng — máy đang không có sóng. Giỏ vẫn giữ nguyên.",
        );
        return;
      }
      router.push("/login");
      return;
    }
    if (!isValidVnPhone(contactPhone)) {
      setState("error");
      setErrMsg("Nhập đúng số điện thoại nhận hàng rồi thử lại.");
      return;
    }
    const boat = boats.find((b) => b.id === boatId);
    const draft: OrderDraft = {
      items: items.map((l) => ({ listingId: l.listingId, qty: l.qty })),
      boatName: boat?.name || undefined,
      boatRef: boat?.maTau || undefined,
      deliveryLocation: deliveryLocation.trim() || undefined,
      contactName: contactName.trim() || undefined,
      contactPhone: contactPhone.trim(),
      note: note.trim() || undefined,
    };

    setState("sending");
    setErrMsg("");
    /*  MÃ CHỐNG TRÙNG ĐI KÈM (2026-08-16, siết lại 2026-08-18): cú POST có thể
        ghi được đơn rồi phản hồi mới rơi mất ở sóng cảng — bà con bấm lại là
        hai đơn thật, giao hai lần. Mã tính từ CHÍNH NỘI DUNG đơn đang gửi
        (`orderClientRef`), nên bấm lại y nguyên = cùng một lần đặt (máy chủ trả
        đơn cũ), còn sửa giỏ rồi bấm lại = đơn MỚI. Bản trước gắn mã với GIỎ nên
        sửa giỏ xong gửi lại bị nuốt thành "trùng" — mất luôn thay đổi. */
    const { res } = await authedFetch(
      "/api/me/orders",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, clientRef: orderClientRef(draft) }),
        signal: timeoutSignal(20000),
      },
      20000,
    );

    if (!res) {
      /*  Mất sóng / hết giờ chờ — đặt hàng là việc CẦN MẠNG, nói thật và KHÔNG
          hứa suông. Cố ý không viết "máy sẽ tự gửi lại": app không giữ hàng đợi
          gửi (ADR 0004), nên hứa thế là nói dối chuyện tiền hàng. Giỏ vẫn còn
          nguyên nên bấm lại là gửi đúng đơn đó, không đẻ đơn thứ hai. */
      setState("error");
      setErrMsg(
        "Chưa gửi được — đặt hàng cần có mạng. Giỏ vẫn còn nguyên; có sóng lại bà con bấm “Đặt hàng” lần nữa giúp.",
      );
      return;
    }
    const j = (await res.json().catch(() => null)) as
      | { ok?: boolean; code?: string; id?: string; totalVnd?: number }
      | null;
    if (res.ok && j?.ok) {
      setPlaced({
        id: typeof j.id === "string" ? j.id : null,
        totalVnd: typeof j.totalVnd === "number" ? j.totalVnd : total,
        contactPhone: draft.contactPhone,
      });
      onOrdered();
      setState("done");
      return;
    }
    setState("error");
    const code = j?.code;
    if (code === "items_unavailable") {
      setErrMsg("Có món vừa ngừng bán — xem lại giỏ rồi đặt lại.");
    } else if (code === "login_required") {
      setErrMsg("Cần đăng nhập bằng SĐT để đặt hàng.");
    } else if (code === "invalid_draft") {
      setErrMsg("Đơn còn thiếu thông tin — kiểm tra lại giỏ và SĐT nhận hàng.");
    } else if (code === "not_configured") {
      setErrMsg("Chỗ đặt hàng chưa mở. Bà con gọi hotline để đặt giúp.");
    } else {
      setErrMsg("Chưa đặt được đơn — thử lại khi có sóng.");
    }
  }

  // ── Đặt xong ──────────────────────────────────────────────────────────
  if (state === "done") {
    return (
      <BottomSheet title="Đã đặt đơn" onClose={onClose}>
        <div
          className="rounded-[1.25rem] px-4 py-8 text-center"
          style={{ backgroundColor: "var(--ok-bg)", color: "var(--ok)" }}
        >
          <CheckIcon className="mx-auto h-11 w-11" />
          <p className="mt-3 text-[1.1875rem] font-bold">Đã gửi đơn đặt hàng</p>
          {/* xác nhận CÓ SỐ: mã đơn (nếu máy chủ trả) + tổng + SĐT nhận —
              để bà con đối chiếu lúc nhà cung cấp gọi (audit G4/G6) */}
          {placed && (
            <p className="mt-2 text-[1.0625rem] font-bold tabular-nums text-navy">
              {placed.id ? `Mã đơn ${placed.id.slice(0, 8).toUpperCase()} · ` : ""}
              Tổng {formatVnd(placed.totalVnd)} · Gọi số{" "}
              {placed.contactPhone}
            </p>
          )}
          <p className="mt-1 text-[1rem] text-foreground/70">
            Nhà cung cấp sẽ nhận và liên hệ giao hàng. Xem tình trạng đơn ở mục
            “Đơn của tôi”.
          </p>
        </div>
        <div className="mt-4">
          <PrimaryButton onClick={onClose}>Xong</PrimaryButton>
        </div>
      </BottomSheet>
    );
  }

  // ── Giỏ rỗng ──────────────────────────────────────────────────────────
  if (items.length === 0) {
    return (
      <BottomSheet title="Giỏ hàng" onClose={onClose}>
        <EmptyState icon={<CartIcon className="h-10 w-10" />}>
          Giỏ đang trống. Chọn hàng ở cửa hàng rồi thêm vào giỏ.
        </EmptyState>
        <div className="mt-4">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[3.75rem] w-full rounded-full bg-field text-[1.125rem] font-bold text-foreground/70"
          >
            Đóng
          </button>
        </div>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet title="Giỏ hàng" onClose={onClose}>
      {/* ── Danh sách dòng hàng ─────────────────────────────────────── */}
      <ul className="space-y-2.5">
        {resolved.map(({ line, product, available }) => (
          <li
            key={line.listingId}
            className="rounded-2xl bg-field px-3.5 py-3"
          >
            {available && product ? (
              <>
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 text-[1.0625rem] font-bold leading-snug text-navy">
                    {product.title}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      onItemsChange(removeItem(items, line.listingId))
                    }
                    aria-label={`Bỏ ${product.title} khỏi giỏ`}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-danger active:bg-danger-bg"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                </div>
                <p className="mt-0.5 text-[0.9375rem] text-foreground/70">
                  {formatVnd(product.priceVnd ?? 0)} / {product.unit}
                </p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <QtyStepper
                    qty={line.qty}
                    onChange={(q) =>
                      onItemsChange(setQty(items, line.listingId, q))
                    }
                    label={product.title}
                  />
                  <p className="text-[1.0625rem] font-bold text-navy">
                    {formatVnd((product.priceVnd ?? 0) * line.qty)}
                  </p>
                </div>
              </>
            ) : (
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 text-[1rem] font-semibold leading-snug text-danger">
                  {product?.title ?? "Món này"} vừa ngừng bán — bỏ khỏi giỏ giúp
                  nhé.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    onItemsChange(removeItem(items, line.listingId))
                  }
                  aria-label="Bỏ món ngừng bán khỏi giỏ"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-danger active:bg-danger-bg"
                >
                  <TrashIcon className="h-5 w-5" />
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {hasUnavailable && (
        <div className="mt-3 overflow-hidden rounded-2xl">
          <StatusBanner level="warn">
            Có món vừa ngừng bán trong giỏ — bỏ đi trước khi đặt.
          </StatusBanner>
        </div>
      )}

      {/* MÁY KHÔNG GIỮ ĐƯỢC GIỎ (G5) — giỏ trong tay vẫn đặt được ngay */}
      {saveFailed && (
        <div className="mt-3 overflow-hidden rounded-2xl">
          <StatusBanner level="danger">
            Máy hết chỗ — CHƯA lưu được giỏ. Đóng app là mất; bà con đặt ngay
            hoặc xoá bớt ảnh/ứng dụng rồi chọn lại.
          </StatusBanner>
        </div>
      )}

      {/* ── Tổng tiền ───────────────────────────────────────────────── */}
      <div className="mt-3 flex items-center justify-between rounded-2xl bg-navy px-4 py-3 text-white">
        <span className="text-[1.0625rem] font-bold">Tổng cộng</span>
        <span className="display text-[1.25rem] font-bold">
          {formatVnd(total)}
        </span>
      </div>
      <p className="mt-1.5 px-1 text-[0.8125rem] text-foreground/65">
        Không thanh toán trong app — nhà cung cấp giao hàng và thu tiền trực
        tiếp.
      </p>

      {/* ── Form đặt hàng ───────────────────────────────────────────── */}
      <form onSubmit={submit} className="mt-4">
        {boats.length > 0 && (
          <Field label="Đặt cho tàu (tuỳ chọn)">
            <select
              value={boatId}
              onChange={(e) => setBoatId(e.target.value)}
              className={inputClass}
            >
              <option value="">— Không gắn tàu —</option>
              {boats.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                  {b.maTau ? ` (${b.maTau})` : ""}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field label="Điểm giao / cảng nhận">
          <input
            value={deliveryLocation}
            onChange={(e) => setDeliveryLocation(e.target.value)}
            className={inputClass}
            placeholder="VD: Cảng Hòn Rớ, Nha Trang"
          />
        </Field>

        <Field label="Tên người nhận">
          <input
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            className={inputClass}
            placeholder="VD: anh Ba"
          />
        </Field>

        <Field label="SĐT nhận hàng (bắt buộc)">
          <input
            value={contactPhone}
            onChange={(e) => setContactPhone(sanitizePhoneInput(e.target.value))}
            className={inputClass}
            inputMode="tel"
            placeholder="VD: 0901234567"
            required
          />
        </Field>

        <Field label="Ghi chú thêm (tuỳ chọn)">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className={inputClass}
            placeholder="VD: giao trước 6h sáng, gọi trước khi tới"
          />
        </Field>

        {/* MỘT lời mời đăng nhập/màn (G7); ẨN khi mất sóng — /login cần sóng
            (tầng 5, 2026-08-18). Bấm "Đặt hàng" lúc chưa đăng nhập = mở /login. */}
        {!signedIn && online && (
          <div className="mb-3">
            <RefNote>
              Cần đăng nhập bằng SĐT để đặt hàng và theo dõi đơn — bấm “Đặt
              hàng” là sang màn đăng nhập, giỏ vẫn giữ nguyên.
            </RefNote>
          </div>
        )}

        {state === "error" && (
          <p
            role="alert"
            className="mb-3 rounded-2xl px-3.5 py-3 text-[1rem] font-semibold"
            style={{
              color: "var(--danger)",
              backgroundColor: "var(--danger-bg)",
            }}
          >
            {errMsg}
          </p>
        )}

        <div className="mt-2 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[3.75rem] rounded-full bg-field text-[1.125rem] font-bold text-foreground/70"
          >
            Đóng
          </button>
          <PrimaryButton
            type="submit"
            disabled={state === "sending" || hasUnavailable}
          >
            {state === "sending" ? "Đang gửi…" : "Đặt hàng"}
          </PrimaryButton>
        </div>
      </form>
    </BottomSheet>
  );
}

/** Bộ đếm số lượng − / n / + — nút to ≥56px cho tay ướt. */
export function QtyStepper({
  qty,
  onChange,
  label,
}: {
  qty: number;
  onChange: (qty: number) => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => onChange(qty - 1)}
        aria-label={`Bớt ${label}`}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-card text-navy shadow-sm active:scale-[0.95]"
      >
        <MinusIcon className="h-6 w-6" />
      </button>
      <span
        aria-live="polite"
        className="min-w-[2.75rem] text-center text-[1.25rem] font-bold text-navy"
      >
        {qty}
      </span>
      <button
        type="button"
        onClick={() => onChange(qty + 1)}
        aria-label={`Thêm ${label}`}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-card text-navy shadow-sm active:scale-[0.95]"
      >
        <PlusIcon className="h-6 w-6" />
      </button>
    </div>
  );
}

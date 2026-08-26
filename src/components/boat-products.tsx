"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ClockIcon,
  DocIcon,
  EditIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/icons";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  EmptyState,
  Field,
  inputClass,
  PrimaryButton,
  RefNote,
} from "@/components/ui/primitives";
import { StatusBanner } from "@/components/ui/status-banner";
import { ChipRow } from "@/components/ui/chip-row";
import { useBoats } from "@/components/boat-switcher";
import { SdvicoCatalog } from "@/components/sdvico-catalog";
import { MyOrders } from "@/components/my-orders";
import { SdvicoRequestButton } from "@/components/sdvico-request";
import { formatVnDate } from "@/lib/format";
import { readUserList, type UserListRead } from "@/lib/user-list-store";
import { saveUserJson, storageFullCopy } from "@/lib/user-store";
import { markLocalWrite, USER_SYNC_EVENT } from "@/lib/user-sync";
import { useTodayVN } from "@/lib/use-today";
import {
  BoatProduct,
  byWarrantyUrgency,
  getWarrantyStatus,
} from "@/lib/products";
import { SdvicoAssignPrompt } from "@/components/sdvico-assign-prompt";
import { useSdvicoAssets } from "@/lib/use-sdvico-assets";

/*
  Tab SẢN PHẨM — tách ĐÔI bằng chip tầng 1 (user chốt 2026-06-11, hết cảnh
  kéo một cột dài):
  · ĐANG DÙNG — đồ đã mua (đồng bộ SDVICO, nhắc bảo hành) + đồ tự ghi
  · CỦA SDVICO — cửa hàng gọn focus giới thiệu + upsale (sdvico-catalog)
  Mỗi sản phẩm là MỘT thẻ với MỘT băng trạng thái bảo hành màu trên cùng;
  thêm/sửa trong bottom sheet; dữ liệu gắn theo tàu đang chọn (boatId).
*/

type Section = "dang-dung" | "sdvico" | "don-hang";

// "Khuyến nghị" mơ hồ — "Cửa hàng" nói thẳng đây là chỗ xem đồ SDVICO bán.
// "Đơn của tôi" = chỗ theo dõi đơn đặt hàng từ Cửa hàng.
const SECTIONS: { id: Section; label: string }[] = [
  { id: "dang-dung", label: "Đang dùng" },
  { id: "sdvico", label: "Cửa hàng" },
  { id: "don-hang", label: "Đơn của tôi" },
];

const STORAGE_KEY = "forfish.products.v1";

// ── storage ──────────────────────────────────────────────────

/* ĐỌC ĐƯỢC ≠ CHƯA CÓ GÌ (K4, 2026-08-02). Bản cũ `catch` rồi trả `null` y như
   khi máy trắng ⇒ JSON hỏng một ký tự là màn dựng SỔ MẪU, `ready` bật, rồi
   effect ghi đè hàng mẫu lên đúng chỗ đang giữ đồ thật của bà con (hạn bảo hành,
   ngày mua — gõ tay, không tải lại được). Nay: không đọc được thì KHÔNG mở cửa
   ghi và nói ra. Xem lib/user-list-store.ts. */
function loadProducts(): UserListRead<BoatProduct> {
  return readUserList<BoatProduct>(STORAGE_KEY);
}

/* Trả `false` khi máy KHÔNG giữ được (hết chỗ / trình duyệt chặn) — trước đây
   nuốt im trong `catch {}`. Ghi qua `saveUserJson` để dự báo tải sẵn nhường chỗ
   (lib/user-store.ts); nhường vẫn không đủ thì màn BÁO ĐỎ. */
function saveProducts(products: BoatProduct[]): boolean {
  const ok = saveUserJson(STORAGE_KEY, products);
  if (ok) markLocalWrite("materials"); // đồng bộ lên server (lib/user-sync)
  return ok;
}

// ── component ────────────────────────────────────────────────

export function BoatProducts() {
  const { today } = useTodayVN();
  const { current, boats } = useBoats();
  const [products, setProducts] = useState<BoatProduct[]>([]);
  const [ready, setReady] = useState(false);
  /** máy KHÔNG ĐỌC ĐƯỢC danh sách đã lưu → không mở cửa ghi, và nói ra */
  const [readFailed, setReadFailed] = useState(false);
  /** máy không giữ được thứ vừa nhập → phải nói ra, không nuốt im */
  const [saveFailed, setSaveFailed] = useState(false);
  const [editing, setEditing] = useState<BoatProduct | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<BoatProduct | null>(null);
  const [section, setSection] = useState<Section>("dang-dung");
  // đồ mua của SDVICO — hook dùng chung 4 nấc (loading/guest/error/ok),
  // KHÔNG còn nuốt lỗi mạng thành "chưa đăng nhập"
  const { status: syncStatus, assets, retry } = useSdvicoAssets();
  const synced = assets;

  // Hydrate from localStorage on mount (avoids SSR/CSR mismatch).
  // KHÔNG seed demo — chỉ đồ THẬT user thêm hoặc đồng bộ từ SDVICO.
  useEffect(() => {
    const stored = loadProducts();
    if (!stored.ok) {
      setReadFailed(true); // `ready` GIỮ NGUYÊN false ⇒ effect ghi không chạy
      return;
    }
    // sdvico: KHÔNG seed demo — đọc được nhưng trống thì để danh sách rỗng
    setProducts(stored.list ?? []);
    setReady(true);
    // đọc một lần lúc mở; dữ liệu đã lưu tự mang boatId của từng món.
  }, []);

  // Máy khác kéo về (lib/user-sync) → đọc lại danh sách vật tư từ localStorage.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onSync = (e: Event) => {
      if ((e as CustomEvent<{ kind?: string }>).detail?.kind !== "materials") return;
      const stored = loadProducts();
      if (stored.ok) setProducts(stored.list ?? []);
    };
    window.addEventListener(USER_SYNC_EVENT, onSync);
    return () => window.removeEventListener(USER_SYNC_EVENT, onSync);
  }, []);

  /*  GHI KHI BÀ CON THAO TÁC, KHÔNG GHI SAU HYDRATE (N5/N2, audit 2026-08-18):
      effect cũ `if (ready) save(products)` chạy ngay khi mở màn ⇒ máy đầy thì
      băng đỏ bật dù chưa nhập gì; và nhánh đọc-lại-khi-đổi-tàu set `readFailed`
      mà `ready` vẫn true ⇒ effect ghi có thể đè lên chuỗi đang không đọc được.
      Nay chỉ `commit()` từ thêm/sửa/xoá; đọc hỏng thì KHÔNG ghi. */
  function commit(next: BoatProduct[]) {
    setProducts(next);
    if (readFailed) return;
    setSaveFailed(!saveProducts(next));
  }

  // Xóa tàu → hàng gán tàu đó đã được nhả về "của chung" (ba-spec 08 R3);
  // đọc lại để boatId trong state khớp máy, không tự ghi đè bản cũ.
  useEffect(() => {
    if (!ready) return;
    const stored = loadProducts();
    if (!stored.ok) {
      // đọc lại không được → GIỮ NGUYÊN thứ đang hiện, đừng dựng sổ mẫu đè lên
      setReadFailed(true);
      return;
    }
    // sdvico: KHÔNG seed demo
    setProducts(stored.list ?? []);
    setReadFailed(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boats.length]);

  // Chỉ hiện sản phẩm của tàu đang chọn (item chưa gắn tàu cũng hiện).
  const forBoat = useMemo(
    () =>
      products.filter(
        (p) => p.boatId === current?.id || p.boatId == null,
      ),
    [products, current?.id],
  );

  const sorted = useMemo(
    () => [...forBoat].sort(byWarrantyUrgency(today)),
    [forBoat, today],
  );

  function upsert(product: BoatProduct) {
    const idx = products.findIndex((p) => p.id === product.id);
    const next = [...products];
    if (idx === -1) next.push(product);
    else next[idx] = product;
    commit(next);
    setShowForm(false);
    setEditing(null);
  }

  function remove(id: string) {
    const next = products.filter((p) => p.id !== id);
    commit(next);
    setConfirmDelete(null);
  }

  return (
    <div className="pt-1">
      <ChipRow
        options={SECTIONS}
        value={section}
        onChange={setSection}
        accent="t3"
        level={1}
        ariaLabel="Mục sản phẩm"
      />

      {/* Hỏi gán hàng SDVICO cho tàu khi có >1 tàu (ba-spec 08 AC-6) */}
      <SdvicoAssignPrompt assets={synced} />

      {/* MÁY KHÔNG ĐỌC / KHÔNG GIỮ ĐƯỢC đồ tự ghi — nói ngay, đừng nuốt im rồi
          để bà con phát hiện lúc hết bảo hành (K4) */}
      {readFailed && (
        <div className="mx-4 mt-3 overflow-hidden surface">
          <StatusBanner level="danger">
            Danh sách đồ trong máy đang ĐỌC KHÔNG ĐƯỢC — đồ cũ vẫn nằm trong máy
            nhưng app chưa mở ra được. Nút thêm đã tạm khoá để khỏi đè mất bản
            cũ; thử tắt hẳn app mở lại, hoặc phục hồi từ tệp sao lưu.
          </StatusBanner>
        </div>
      )}
      {saveFailed && (
        <div className="mx-4 mt-3 overflow-hidden surface">
          <StatusBanner level="danger">
            {storageFullCopy("sản phẩm vừa ghi")}
          </StatusBanner>
        </div>
      )}

      {/* ════ MỤC 2: CỦA SDVICO — cửa hàng gọn, giới thiệu + upsale ═══ */}
      {section === "sdvico" && (
        <div className="px-4">
          <SdvicoCatalog
            ownedProductNames={synced?.products.map((p) => p.name) ?? []}
          />
        </div>
      )}

      {/* ════ MỤC 3: ĐƠN CỦA TÔI — theo dõi + huỷ đơn đặt từ Cửa hàng ═══ */}
      {section === "don-hang" && <MyOrders />}

      {/* ════ MỤC 1: ĐANG DÙNG — đồ đã mua + đồ tự ghi ════════════════ */}
      {section === "dang-dung" && (
    <div className="px-4">
      <div className="mb-4">
        {synced ? (
          <RefNote tone="var(--ok)" bg="var(--ok-bg)">
            Đã nối với SDVICO
            {synced.customerName ? ` — khách: ${synced.customerName}` : ""}.
            Sản phẩm, dịch vụ, kỳ cước tự cập nhật ở đây.
          </RefNote>
        ) : syncStatus === "error" ? (
          // thất bại phải LÊN TIẾNG — không mời đăng nhập người đã đăng nhập
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-danger-bg px-3.5 py-2.5">
            <p className="min-w-0 text-[0.9375rem] font-semibold leading-snug text-danger">
              Chưa tải được đồ SDVICO — mạng có thể đang yếu.
            </p>
            <button
              type="button"
              onClick={retry}
              className="min-h-[3rem] shrink-0 rounded-full bg-danger px-4 text-[0.9375rem] font-bold text-white"
            >
              Thử lại
            </button>
          </div>
        ) : syncStatus === "unlinked" ? (
          <RefNote>
            Đã đăng nhập — chưa thấy đơn hàng SDVICO gắn với số này. Mua hàng
            là đồ tự hiện ở đây; có thắc mắc bấm nút gọi bên tab Dịch vụ.
          </RefNote>
        ) : syncStatus === "guest" ? (
          <>
            <RefNote>
              Sản phẩm mua của SDVICO — app nhắc trước khi hết bảo hành. Đăng
              nhập bằng SĐT lúc mua hàng là đồ đã mua tự hiện ở đây.
            </RefNote>
            <Link
              href="/login"
              className="mt-2.5 flex min-h-[3.5rem] w-full items-center justify-center rounded-full bg-field text-[1.0625rem] font-bold text-navy transition active:scale-[0.98]"
            >
              Đăng nhập để thấy đồ của mình
            </Link>
          </>
        ) : (
          <RefNote>Đang kiểm tra đồ SDVICO của bà con…</RefNote>
        )}
      </div>

      {/* ── ĐỒ MUA CỦA SDVICO — tự đồng bộ, chỉ xem ───────────────────── */}
      {synced && (
        <div className="mb-5 space-y-3">
          {/* sản phẩm đã mua — bảo hành tự theo dõi */}
          {synced.products.map((p) => {
            const status = getWarrantyStatus(p, today);
            const level =
              status.level === "expired"
                ? "danger"
                : status.level === "soon"
                  ? "warn"
                  : status.level === "ok"
                    ? "ok"
                    : "neutral";
            return (
              <div key={p.id} className="overflow-hidden surface">
                <StatusBanner
                  level={level}
                  icon={
                    level === "neutral" ? (
                      <ClockIcon className="h-5 w-5" />
                    ) : undefined
                  }
                >
                  {status.label}
                </StatusBanner>
                <div className="px-4 py-3">
                  <p className="text-[0.8125rem] font-bold uppercase tracking-wide text-foreground/65">
                    Mua của SDVICO{p.orderCode ? ` · đơn ${p.orderCode}` : ""}
                  </p>
                  <p className="display text-[1.1875rem] font-bold leading-snug text-navy">
                    {p.name}
                  </p>
                  {p.serial && (
                    <p className="text-[1rem] text-foreground/70">
                      Số serial: <strong>{p.serial}</strong>
                    </p>
                  )}
                  {p.purchasedOn && (
                    <p className="text-[1rem] text-foreground/70">
                      Mua: <strong>{formatVnDate(p.purchasedOn)}</strong>
                    </p>
                  )}
                  {p.warrantyUntil && (
                    <p className="text-[1rem] text-foreground/70">
                      Bảo hành tới:{" "}
                      <strong>{formatVnDate(p.warrantyUntil)}</strong>
                    </p>
                  )}
                  {/* chip gọi bảo hành chỉ khi SẮP HẾT / ĐÃ HẾT (T15) — món còn
                      dài hạn không cần nút thúc */}
                  {(status.level === "soon" || status.level === "expired") && (
                    <div className="mt-2 flex justify-end">
                      <SdvicoRequestButton
                        variant="chip"
                        topic="sua-chua"
                        productName={`${p.name}${p.serial ? ` (serial ${p.serial})` : ""}`}
                        label="Gọi bảo hành món này"
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ĐỌC KHÔNG ĐƯỢC ⇒ ẩn nút Thêm (T13) — banner đỏ ở trên đã nói vì sao */}
      {!readFailed && (
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="display mb-4 flex min-h-[3.75rem] w-full items-center justify-center gap-2.5 rounded-full bg-trim text-[1.1875rem] font-bold text-white shadow-trim-cta transition active:scale-[0.98]"
        >
          <PlusIcon className="h-6 w-6" />
          Thêm sản phẩm
        </button>
      )}

      {/* chỉ nói "chưa có gì" khi THẬT SỰ chưa có gì — kể cả đồ đồng bộ
          (roadmap hội đồng UX: empty state mâu thuẫn danh sách ngay trên);
          ca đọc-hỏng nói khác vì nút cam đã ẩn */}
      {(ready || readFailed) &&
        sorted.length === 0 &&
        !(synced && synced.products.length > 0) && (
          <EmptyState icon={<DocIcon className="h-10 w-10" />}>
            {readFailed ? (
              <>
                Chưa mở được danh sách đồ trong máy.
                <br />
                Đồ cũ chưa mất — xem dải đỏ ở trên.
              </>
            ) : (
              <>
                Chưa có sản phẩm SDVICO nào cho tàu này.
                <br />
                Bấm nút cam ở trên để thêm.
              </>
            )}
          </EmptyState>
        )}

      <ul className="space-y-3">
        {sorted.map((product) => {
          const status = getWarrantyStatus(product, today);
          const level =
            status.level === "expired"
              ? "danger"
              : status.level === "soon"
                ? "warn"
                : status.level === "ok"
                  ? "ok"
                  : "neutral";
          return (
            <li
              key={product.id}
              className="overflow-hidden surface"
            >
              {/* status banner — the first thing the eye lands on */}
              <StatusBanner
                level={level}
                icon={
                  level === "neutral" ? <ClockIcon className="h-5 w-5" /> : undefined
                }
              >
                {status.label}
              </StatusBanner>

              <div className="px-4 py-3">
                <p className="display text-[1.1875rem] font-bold leading-snug text-navy">
                  {product.name}
                </p>
                {product.serial && (
                  <p className="text-[1rem] text-foreground/70">
                    Số serial: <strong>{product.serial}</strong>
                  </p>
                )}
                {product.purchasedOn && (
                  <p className="text-[1rem] text-foreground/70">
                    Mua: <strong>{formatVnDate(product.purchasedOn)}</strong>
                  </p>
                )}
                {product.warrantyUntil && (
                  <p className="text-[1rem] text-foreground/70">
                    Bảo hành tới:{" "}
                    <strong>{formatVnDate(product.warrantyUntil)}</strong>
                  </p>
                )}
                {product.note && (
                  <p className="mt-1.5 rounded-xl bg-background px-3 py-1.5 text-[0.9375rem] text-foreground/70">
                    {product.note}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 border-t border-line">
                <button
                  onClick={() => {
                    setEditing(product);
                    setShowForm(true);
                  }}
                  className="flex min-h-[3.5rem] items-center justify-center gap-2 text-[1.125rem] font-bold text-sea active:bg-background"
                >
                  <EditIcon className="h-5 w-5" />
                  Sửa
                </button>
                <button
                  onClick={() => setConfirmDelete(product)}
                  className="flex min-h-[3.5rem] items-center justify-center gap-2 border-l border-line text-[1.125rem] font-bold text-danger active:bg-background"
                >
                  <TrashIcon className="h-5 w-5" />
                  Xóa
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="py-4 text-center text-[0.875rem] text-foreground/65">
        {synced
          ? "Đồ tự đồng bộ lấy từ SDVICO. Sản phẩm tự thêm lưu trên máy."
          : "Sản phẩm SDVICO lưu ngay trên máy của bà con."}
      </p>
    </div>
      )}

      {showForm && (
        <ProductForm
          initial={editing}
          boatId={current?.id}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSave={upsert}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          icon={<TrashIcon className="h-9 w-9 text-danger" />}
          title="Xóa sản phẩm này?"
          message={`“${confirmDelete.name}” sẽ bị xóa khỏi danh sách, không lấy lại được.`}
          cancelLabel="Không xóa"
          confirmLabel="Xóa luôn"
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => remove(confirmDelete.id)}
        />
      )}
    </div>
  );
}

// ── bottom-sheet form ────────────────────────────────────────

const PRODUCT_SUGGESTIONS = [
  "Máy giám sát hành trình (VMS)",
  "Bộ đàm ICOM",
  "Máy dò cá",
  "Định vị GPS",
  "Dầu nhờn động cơ",
];

const OTHER = "__khac__";

function ProductForm({
  initial,
  boatId,
  onCancel,
  onSave,
}: {
  initial: BoatProduct | null;
  boatId?: string;
  onCancel: () => void;
  onSave: (product: BoatProduct) => void;
}) {
  const initialIsSuggestion =
    initial !== null && PRODUCT_SUGGESTIONS.includes(initial.name);

  const [picked, setPicked] = useState<string>(
    initial === null
      ? PRODUCT_SUGGESTIONS[0]
      : initialIsSuggestion
        ? initial.name
        : OTHER,
  );
  const [customName, setCustomName] = useState(
    initial !== null && !initialIsSuggestion ? initial.name : "",
  );
  const [serial, setSerial] = useState(initial?.serial ?? "");
  const [purchasedOn, setPurchasedOn] = useState(initial?.purchasedOn ?? "");
  const [warrantyUntil, setWarrantyUntil] = useState(
    initial?.warrantyUntil ?? "",
  );
  const [note, setNote] = useState(initial?.note ?? "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const name =
      picked === OTHER ? customName.trim() || "Sản phẩm SDVICO" : picked;
    onSave({
      id: initial?.id ?? `sp-${Date.now()}`,
      boatId: initial?.boatId ?? boatId,
      name,
      serial: serial.trim() || undefined,
      purchasedOn: purchasedOn || undefined,
      warrantyUntil: warrantyUntil || undefined,
      note: note.trim() || undefined,
    });
  }

  return (
    <BottomSheet
      title={initial ? "Sửa sản phẩm" : "Thêm sản phẩm SDVICO"}
      onClose={onCancel}
    >
      <form onSubmit={submit}>
        <Field label="Tên sản phẩm">
          <select
            value={picked}
            onChange={(e) => setPicked(e.target.value)}
            className={inputClass}
          >
            {PRODUCT_SUGGESTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
            <option value={OTHER}>Sản phẩm khác</option>
          </select>
        </Field>

        {picked === OTHER && (
          <Field label="Ghi tên sản phẩm đó">
            <input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              className={inputClass}
              placeholder="VD: Máy tời thủy lực"
            />
          </Field>
        )}

        <Field label="Số serial (nếu có)">
          <input
            value={serial}
            onChange={(e) => setSerial(e.target.value)}
            className={inputClass}
            placeholder="VD: ICOM-M324-77310"
          />
        </Field>

        <Field label="Ngày mua">
          <input
            type="date"
            value={purchasedOn}
            onChange={(e) => setPurchasedOn(e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Hết hạn bảo hành">
          <input
            type="date"
            value={warrantyUntil}
            onChange={(e) => setWarrantyUntil(e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Ghi chú thêm">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className={inputClass}
            placeholder="VD: Mua tại đại lý SDVICO Vũng Tàu"
          />
        </Field>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[3.75rem] rounded-full bg-field text-[1.125rem] font-bold text-foreground/70"
          >
            Hủy
          </button>
          <PrimaryButton type="submit">Lưu lại</PrimaryButton>
        </div>
      </form>
    </BottomSheet>
  );
}

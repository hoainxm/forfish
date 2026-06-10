"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertIcon,
  CheckIcon,
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
import { useBoats } from "@/components/boat-switcher";
import { formatVnDate } from "@/lib/format";
import {
  BoatProduct,
  byWarrantyUrgency,
  demoProducts,
  getWarrantyStatus,
} from "@/lib/products";

/*
  Sản phẩm SDVICO của tôi — vật tư/thiết bị bà con đã MUA của SDVICO, kèm nhắc
  hạn bảo hành (cùng "ngôn ngữ thẻ" với màn nhắc bảo dưỡng để học một lần):
  · mỗi sản phẩm là MỘT thẻ với MỘT băng trạng thái bảo hành màu trên cùng
  · thêm/sửa trong bottom sheet, ô to + hai nút to
  · dữ liệu gắn theo tàu đang chọn (boatId); sau này SDWork tự đồng bộ về đây
*/

const STORAGE_KEY = "forfish.products.v1";

// ── storage ──────────────────────────────────────────────────

function loadProducts(): BoatProduct[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as BoatProduct[];
  } catch {
    // corrupt storage — caller falls back to demo seed
  }
  return null;
}

function saveProducts(products: BoatProduct[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
  } catch {
    // storage full / disabled — keep working in-memory
  }
}

// ── component ────────────────────────────────────────────────

export function BoatProducts() {
  const today = useMemo(() => new Date(), []);
  const { current } = useBoats();
  const [products, setProducts] = useState<BoatProduct[]>([]);
  const [ready, setReady] = useState(false);
  const [editing, setEditing] = useState<BoatProduct | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<BoatProduct | null>(null);

  // Hydrate from localStorage on mount (avoids SSR/CSR mismatch).
  useEffect(() => {
    const stored = loadProducts();
    setProducts(stored ?? demoProducts(today, current?.id));
    setReady(true);
    // current?.id intentionally read once on mount for the demo seed;
    // stored data already carries its own boatId per item.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today]);

  useEffect(() => {
    if (ready) saveProducts(products);
  }, [products, ready]);

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
    setProducts((prev) => {
      const idx = prev.findIndex((p) => p.id === product.id);
      if (idx === -1) return [...prev, product];
      const next = [...prev];
      next[idx] = product;
      return next;
    });
    setShowForm(false);
    setEditing(null);
  }

  function remove(id: string) {
    setProducts((prev) => prev.filter((p) => p.id !== id));
    setConfirmDelete(null);
  }

  return (
    <div className="px-4 pt-1">
      <div className="mb-4">
        <RefNote>
          Sản phẩm mua của SDVICO — app nhắc trước khi hết bảo hành. Khi đăng
          nhập tài khoản SDWork, sản phẩm sẽ tự hiện ở đây.
        </RefNote>
      </div>

      <button
        onClick={() => {
          setEditing(null);
          setShowForm(true);
        }}
        className="display mb-4 flex min-h-[60px] w-full items-center justify-center gap-2.5 rounded-xl bg-trim text-[19px] font-bold text-white shadow-sm transition active:scale-[0.98]"
      >
        <PlusIcon className="h-6 w-6" />
        Thêm sản phẩm
      </button>

      {ready && sorted.length === 0 && (
        <EmptyState icon={<DocIcon className="h-10 w-10" />}>
          Chưa có sản phẩm SDVICO nào cho tàu này.
          <br />
          Bấm nút cam ở trên để thêm.
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
          const Icon =
            status.level === "expired"
              ? AlertIcon
              : status.level === "soon"
                ? ClockIcon
                : status.level === "ok"
                  ? CheckIcon
                  : ClockIcon;
          return (
            <li
              key={product.id}
              className="overflow-hidden rounded-xl bg-card shadow-sm ring-1 ring-line"
            >
              {/* status banner — the first thing the eye lands on */}
              <StatusBanner
                level={level}
                icon={<Icon className="h-5 w-5" />}
              >
                {status.label}
              </StatusBanner>

              <div className="px-4 py-3">
                <p className="display text-[19px] font-bold leading-snug text-navy">
                  {product.name}
                </p>
                {product.serial && (
                  <p className="text-[16px] text-foreground/60">
                    Số serial: <strong>{product.serial}</strong>
                  </p>
                )}
                {product.purchasedOn && (
                  <p className="text-[16px] text-foreground/60">
                    Mua: <strong>{formatVnDate(product.purchasedOn)}</strong>
                  </p>
                )}
                {product.warrantyUntil && (
                  <p className="text-[16px] text-foreground/60">
                    Bảo hành tới:{" "}
                    <strong>{formatVnDate(product.warrantyUntil)}</strong>
                  </p>
                )}
                {product.note && (
                  <p className="mt-1.5 rounded-lg bg-background px-3 py-1.5 text-[15px] text-foreground/70">
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
                  className="flex min-h-[56px] items-center justify-center gap-2 text-[17px] font-bold text-sea active:bg-background"
                >
                  <EditIcon className="h-5 w-5" />
                  Sửa
                </button>
                <button
                  onClick={() => setConfirmDelete(product)}
                  className="flex min-h-[56px] items-center justify-center gap-2 border-l border-line text-[17px] font-bold text-danger active:bg-background"
                >
                  <TrashIcon className="h-5 w-5" />
                  Xóa
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="py-4 text-center text-[14px] text-foreground/40">
        Sản phẩm SDVICO lưu ngay trên máy của bà con.
      </p>

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
            className="min-h-[60px] rounded-lg border-2 border-line text-[18px] font-bold text-foreground/70"
          >
            Hủy
          </button>
          <PrimaryButton type="submit">Lưu lại</PrimaryButton>
        </div>
      </form>
    </BottomSheet>
  );
}

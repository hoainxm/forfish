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
import { SdvicoRequestButton } from "@/components/sdvico-request";
import { formatVnDate } from "@/lib/format";
import {
  BoatProduct,
  byWarrantyUrgency,
  demoProducts,
  getWarrantyStatus,
} from "@/lib/products";
import { useSdvicoAssets } from "@/lib/use-sdvico-assets";

/*
  Tab SẢN PHẨM — tách ĐÔI bằng chip tầng 1 (user chốt 2026-06-11, hết cảnh
  kéo một cột dài):
  · ĐANG DÙNG — đồ đã mua (đồng bộ SDVICO, nhắc bảo hành) + đồ tự ghi
  · CỦA SDVICO — cửa hàng gọn focus giới thiệu + upsale (sdvico-catalog)
  Mỗi sản phẩm là MỘT thẻ với MỘT băng trạng thái bảo hành màu trên cùng;
  thêm/sửa trong bottom sheet; dữ liệu gắn theo tàu đang chọn (boatId).
*/

type Section = "dang-dung" | "sdvico";

// "Khuyến nghị" mơ hồ — "Cửa hàng" nói thẳng đây là chỗ xem đồ SDVICO bán
const SECTIONS: { id: Section; label: string }[] = [
  { id: "dang-dung", label: "Đang dùng" },
  { id: "sdvico", label: "Cửa hàng" },
];

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
  const [section, setSection] = useState<Section>("dang-dung");
  // đồ mua của SDVICO — hook dùng chung 4 nấc (loading/guest/error/ok),
  // KHÔNG còn nuốt lỗi mạng thành "chưa đăng nhập"
  const { status: syncStatus, assets, retry } = useSdvicoAssets();
  const synced = assets;

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
  // Khi đã đồng bộ được đồ thật từ SDVICO thì ẩn hàng demo cho khỏi lẫn.
  const forBoat = useMemo(
    () =>
      products.filter(
        (p) =>
          (p.boatId === current?.id || p.boatId == null) &&
          !(synced && p.id.startsWith("demo-sp-")),
      ),
    [products, current?.id, synced],
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
    <div className="pt-1">
      <ChipRow
        options={SECTIONS}
        value={section}
        onChange={setSection}
        accent="t3"
        level={1}
        ariaLabel="Mục sản phẩm"
      />

      {/* ════ MỤC 2: CỦA SDVICO — cửa hàng gọn, giới thiệu + upsale ═══ */}
      {section === "sdvico" && (
        <div className="px-4">
          <SdvicoCatalog
            ownedProductNames={synced?.products.map((p) => p.name) ?? []}
          />
        </div>
      )}

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
                  <div className="mt-2 flex justify-end">
                    <SdvicoRequestButton
                      variant="chip"
                      topic="sua-chua"
                      productName={`${p.name}${p.serial ? ` (serial ${p.serial})` : ""}`}
                      label="Gọi bảo hành món này"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button
        onClick={() => {
          setEditing(null);
          setShowForm(true);
        }}
        className="display mb-4 flex min-h-[3.75rem] w-full items-center justify-center gap-2.5 rounded-full bg-trim text-[1.1875rem] font-bold text-white shadow-[0_10px_24px_-8px_rgba(228,87,46,0.55)] transition active:scale-[0.98]"
      >
        <PlusIcon className="h-6 w-6" />
        Thêm sản phẩm
      </button>

      {/* chỉ nói "chưa có gì" khi THẬT SỰ chưa có gì — kể cả đồ đồng bộ
          (roadmap hội đồng UX: empty state mâu thuẫn danh sách ngay trên) */}
      {ready &&
        sorted.length === 0 &&
        !(synced && synced.products.length > 0) && (
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

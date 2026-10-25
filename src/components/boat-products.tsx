"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronDownIcon,
  ClockIcon,
  DocIcon,
  EditIcon,
  LockIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/icons";
import { TAU_ACTION as SQ_BTN } from "@/components/tau-ui";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, inputClass, RefNote } from "@/components/ui/primitives";
import { StatusBanner } from "@/components/ui/status-banner";
import { useBoats } from "@/components/boat-switcher";
import { SdvicoRequestButton } from "@/components/sdvico-request";
import { formatVnDate } from "@/lib/format";
import { readUserList, type UserListRead } from "@/lib/user-list-store";
import { saveUserJson, storageFullCopy } from "@/lib/user-store";
import { markLocalWrite, USER_SYNC_EVENT } from "@/lib/user-sync";
import { showsUnderBoat } from "@/lib/boats";
import { useTodayVN } from "@/lib/use-today";
import {
  BoatProduct,
  byWarrantyUrgency,
  getWarrantyStatus,
} from "@/lib/products";
import { SdvicoAssignPrompt } from "@/components/sdvico-assign-prompt";
import { useSdvicoAssets } from "@/lib/use-sdvico-assets";
import { NHAN } from "@/lib/labels";
import { useXoaCho } from "@/lib/xoa-cho";

/*
  Tab SẢN PHẨM — ĐỒ TRÊN TÀU CỦA BÀ CON, một cột, không còn chip.

  MỘT CỬA HÀNG THÔI (chủ dự án 2026-09-07, ADR 0014). Trước đây tab này có ba
  chip: "Đang dùng" · "Cửa hàng" · "Đơn của tôi" — mà "Cửa hàng" là một cửa
  hàng THỨ HAI song song với Chợ vật tư `/cho`: hai giỏ, hai chỗ xem đơn, hàng
  SDVICO hiện ở hai nơi, bấm vào chia hai luồng. Nay chợ là cửa hàng duy nhất,
  SDVICO là một gian hàng trong đó; tab này chỉ còn việc của nó — đồ đã mua
  (đồng bộ SDVICO, nhắc bảo hành) + đồ tự ghi — và MỘT thẻ dẫn sang chợ đặt
  đúng chỗ hai chip cũ đứng, để tay quen của bà con vẫn chạm trúng.

  Đồ tự ghi: mỗi món MỘT HÀNG trong `ul.surface divide-y` cùng khuôn Tủ giấy tờ (TAU-05,
  2026-10-25) — tên + tình trạng bảo hành chữ màu, chạm bung chi tiết + Sửa · Xoá; thêm/sửa trong
  ngăn `kieu="form"` có chân Huỷ|Lưu; dữ liệu gắn theo tàu đang chọn (boatId).
*/

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
  const { current, boats, ready: boatReady } = useBoats();
  const [products, setProducts] = useState<BoatProduct[]>([]);
  const [ready, setReady] = useState(false);
  /** máy KHÔNG ĐỌC ĐƯỢC danh sách đã lưu → không mở cửa ghi, và nói ra */
  const [readFailed, setReadFailed] = useState(false);
  /** máy không giữ được thứ vừa nhập → phải nói ra, không nuốt im */
  const [saveFailed, setSaveFailed] = useState(false);
  const [editing, setEditing] = useState<BoatProduct | null>(null);
  const [showForm, setShowForm] = useState(false);
  /** món đang bung chi tiết — một hàng một lúc */
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<BoatProduct | null>(null);
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

  // Xoá chờ 5 s + Hoàn tác (TAU-12): hàng biến ngay, ghi máy sau — lib/xoa-cho
  const xoaCho = useXoaCho<BoatProduct>({
    list: products,
    hien: setProducts,
    ghi: commit,
    ten: (p) => p.name,
  });

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
  const forBoat = useMemo(() => {
    const known = boatReady ? new Set(boats.map((b) => b.id)) : null;
    return products.filter((p) => showsUnderBoat(p.boatId, current?.id, known));
  }, [products, current?.id, boats, boatReady]);

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

  return (
    <div className="pt-1">
      {/*  ĐÃ GỠ hai lối sang cửa hàng (2026-09-07): /tau nay có TAB "Cửa hàng"
          và TAB "Đơn" đứng ngay cạnh, nhúng thẳng nội dung. Để lại hai thẻ dẫn
          ở đây là hai lối vào cho cùng một chỗ, và là đúng cái "nhảy qua nhảy
          lại" mà chủ dự án chê. */}

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

      {/* ════ ĐỒ ĐANG DÙNG — đồ đã mua + đồ tự ghi ═══════════════════ */}
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
            <p className="min-w-0 text-[0.875rem] font-semibold leading-snug text-danger">
              Chưa tải được đồ SDVICO — mạng có thể đang yếu.
            </p>
            <button
              type="button"
              onClick={retry}
              className="min-h-[3rem] shrink-0 rounded-full bg-danger px-4 text-[0.875rem] font-semibold text-white"
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
            {/*  Nhãn gọi TÊN VIỆC, không hứa kết quả (luật A4): "Đăng nhập để
                thấy đồ của mình" (29 ký tự) → "Đăng nhập". Ô nút inline cuối
                hàng RefNote đang giải thích tình trạng, không ăn riêng hàng. */}
            <div className="mt-2.5 flex justify-end">
              <Link href="/login" className={`${SQ_BTN} bg-field text-navy`}>
                <LockIcon className="h-6 w-6" />
                Đăng nhập
              </Link>
            </div>
          </>
        ) : (
          <RefNote>Đang kiểm tra các sản phẩm SDVICO của bà con…</RefNote>
        )}
      </div>

      {/*  Hàng "N món chưa rõ của tàu nào · Chọn" khi có >1 tàu (ba-spec 08 AC-6) —
          KHÔNG còn modal tự bật (TAU-02, 2026-10-25), bà con bấm mới mở ngăn. */}
      <SdvicoAssignPrompt assets={synced} />

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
                  <p className="text-[0.8125rem] font-semibold text-foreground/65">
                    Mua của SDVICO{p.orderCode ? ` · đơn ${p.orderCode}` : ""}
                  </p>
                  <p className="display text-[1rem] font-semibold leading-snug text-navy">
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
                          topic="sua-chua"
                        productName={`${p.name}${p.serial ? ` (serial ${p.serial})` : ""}`}
                        label="Gọi bảo hành sản phẩm này"
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/*  HÀNG TIÊU ĐỀ của khối "đồ tự ghi" (2026-08-29, luật A2/A3/B1): trước
          là dải cam full-width đặt GIỮA hai danh sách, cắt đôi mạch đọc giữa đồ
          đồng bộ SDVICO và đồ bà con tự ghi. Nay nó vừa là tiêu đề khối vừa mang
          ô nút. ĐỌC KHÔNG ĐƯỢC ⇒ chừa ô trống (T13, luật 3b) — banner đỏ ở trên
          đã nói vì sao. */}
      <div className="tau-section-heading">
        <div className="flex min-w-0 flex-1 items-center rounded-2xl bg-background px-4 py-3">
          <p className="text-[1rem] font-semibold text-navy">
            Đồ tự ghi · {sorted.length} món
          </p>
        </div>
        {readFailed ? (
          <span className="w-16 shrink-0" aria-hidden />
        ) : (
          <button
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
            className={`${SQ_BTN} bg-field text-navy`}
          >
            <PlusIcon className="h-6 w-6" />
            Thêm
          </button>
        )}
      </div>

      {/* chỉ nói "chưa có gì" khi THẬT SỰ chưa có gì — kể cả đồ đồng bộ
          (roadmap hội đồng UX: empty state mâu thuẫn danh sách ngay trên);
          ca đọc-hỏng nói khác vì nút cam đã ẩn */}
      {(ready || readFailed) &&
        sorted.length === 0 &&
        !(synced && synced.products.length > 0) && (
          /*  Khối trống CÙNG MỘT KHUÔN với Tủ giấy tờ (viền đứt, không nền đặc — TAU-19,
              2026-10-25); trước dùng `EmptyState` có bg-card ⇒ ba kiểu khối trống một màn. */
          <div className="rounded-xl border border-dashed border-line px-4 py-6 text-center">
            <DocIcon className="mx-auto h-10 w-10 text-foreground/30" />
            <p className="mt-3 text-[1rem] text-foreground/70">
              {readFailed ? (
                <>
                  Chưa mở được danh sách đồ trong máy.
                  <br />
                  Đồ cũ chưa mất — xem dải đỏ ở trên.
                </>
              ) : (
                <>
                  Chưa ghi món đồ nào cho tàu này.
                  <br />
                  Bấm “Thêm” ở trên để thêm.
                </>
              )}
            </p>
          </div>
        )}

      {/*  MỖI MÓN MỘT HÀNG (TAU-05, 2026-10-25) — cùng khuôn Tủ giấy tờ; trước là thẻ băng màu
          đặc + hộp nền + Sửa/Xóa bày thường trực. Màu tình trạng luôn kèm chữ. */}
      {sorted.length > 0 && (
        <ul className="surface divide-y divide-line overflow-hidden">
          {sorted.map((product) => {
            const status = getWarrantyStatus(product, today);
            const tone =
              status.level === "expired"
                ? "text-danger"
                : status.level === "soon"
                  ? "text-warn"
                  : status.level === "ok"
                    ? "text-ok"
                    : "text-foreground/65";
            const open = openId === product.id;
            return (
              <li key={product.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : product.id)}
                  aria-expanded={open}
                  className="flex min-h-(--h-row) w-full items-center gap-3 px-4 py-2.5 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-[1rem] font-semibold leading-snug text-navy">
                      {product.name}
                    </span>
                    <span className={`mt-0.5 block text-[0.8125rem] leading-snug ${tone}`}>
                      {status.label}
                    </span>
                  </span>
                  <ChevronDownIcon
                    className={`h-4 w-4 shrink-0 text-foreground/40 transition ${open ? "rotate-180" : ""}`}
                  />
                </button>

                {open && (
                  <div className="space-y-1.5 bg-background/60 px-4 pb-3 pt-1">
                    {product.warrantyUntil && (
                      <p className="text-[0.875rem] text-foreground/75">
                        Bảo hành tới: <strong>{formatVnDate(product.warrantyUntil)}</strong>
                      </p>
                    )}
                    {(product.serial || product.purchasedOn) && (
                      <p className="text-[0.875rem] text-foreground/75">
                        {product.serial ? `Serial ${product.serial}` : ""}
                        {product.serial && product.purchasedOn ? " · " : ""}
                        {product.purchasedOn ? `mua ${formatVnDate(product.purchasedOn)}` : ""}
                      </p>
                    )}
                    {product.note && (
                      <p className="text-[0.875rem] text-foreground/75">{product.note}</p>
                    )}
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        onClick={() => {
                          setEditing(product);
                          setShowForm(true);
                        }}
                        className={`${SQ_BTN} bg-field text-navy`}
                      >
                        <EditIcon className="h-4 w-4" />
                        {NHAN.sua}
                      </button>
                      <button
                        onClick={() => setConfirmDelete(product)}
                        className={`${SQ_BTN} bg-field text-danger`}
                      >
                        <TrashIcon className="h-4 w-4" />
                        {NHAN.xoa}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/*  Bỏ dòng chân trang "lưu ngay trên máy" (D1) — chỉ giải thích app hoạt
          động thế nào, không cấp dữ liệu, không dặn dò an toàn. */}
    </div>

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
          title="Xoá sản phẩm này?"
          message={`“${confirmDelete.name}” sẽ bị xoá khỏi danh sách. Có 5 giây để hoàn tác.`}
          cancelLabel={NHAN.khongXoa}
          confirmLabel={NHAN.xoa}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => {
            xoaCho(confirmDelete.id);
            setConfirmDelete(null);
          }}
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
  /*  Nhóm tuỳ chọn THU LẠI mặc định (luật C1); mở sẵn khi SỬA món đã có dữ
      liệu trong nhóm — không giấu thứ bà con đã nhập. */
  const [showMore, setShowMore] = useState(
    Boolean(initial?.serial || initial?.purchasedOn || initial?.note),
  );

  /** Gọi từ Enter trong form (có event) lẫn nút Lưu ở chân ngăn (không event). */
  function submit(e?: React.FormEvent) {
    e?.preventDefault();
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
      kieu="form"
      title={initial ? "Sửa thông tin sản phẩm" : "Thêm sản phẩm SDVICO"}
      onClose={onCancel}
      /* chân Huỷ|Lưu do ngăn vẽ (TAU-07/TAU-10): Huỷ sau khi gõ hỏi "Bỏ phần đang ghi?" */
      chan={{ luu: NHAN.luu, onLuu: () => submit() }}
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
          <Field label="Nhập tên sản phẩm đó">
            <input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              className={inputClass}
              placeholder="VD: Máy tời thủy lực"
            />
          </Field>
        )}

        <Field label="Hết hạn bảo hành">
          <input
            type="date"
            value={warrantyUntil}
            onChange={(e) => setWarrantyUntil(e.target.value)}
            className={inputClass}
          />
        </Field>

        {/*  Cả màn này tồn tại để NHẮC BẢO HÀNH ⇒ KEY chỉ là tên + hết hạn bảo
            hành. Serial và ghi chú tự nhãn đã nhận là tuỳ chọn; ngày mua để
            trống không ảnh hưởng việc nhắc ⇒ thu sau một nút (luật C1). */}
        <div className="mb-3.5 flex items-stretch gap-2">
          <div className="o-chu flex min-w-0 flex-1 items-center rounded-2xl bg-background px-3 py-2">
            <p className="truncate text-[1rem] text-foreground/80">
              Serial:{" "}
              <span className="font-semibold text-navy">
                {serial.trim() || "chưa ghi"}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            className={`${SQ_BTN} bg-background text-sea`}
          >
            <PlusIcon className="h-6 w-6" />
            {showMore ? "Thu" : "Chi tiết"}
          </button>
        </div>

        {showMore && (
          <>
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

            <Field label="Ghi chú thêm">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className={inputClass}
                placeholder="VD: Mua tại đại lý SDVICO Vũng Tàu"
              />
            </Field>
          </>
        )}

        {/* câu nhắc đứng riêng, KHÔNG chen vào hàng nút (TAU-10) — Huỷ|Lưu là chân ngăn */}
        <p className="mt-3 text-[0.875rem] leading-snug text-foreground/70">
          {warrantyUntil
            ? "Thông tin đã đủ để app nhắc bảo hành."
            : "Chưa có ngày hết hạn — ứng dụng sẽ không thể nhắc bảo hành giúp bà con."}
        </p>
      </form>
    </BottomSheet>
  );
}

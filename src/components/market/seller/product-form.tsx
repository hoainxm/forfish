"use client";

// /ban-hang/san-pham/[id] — THÊM ("moi") / SỬA một món (11 §6.4).
// Luật C1 "chỉ bày cái key" (03 §6): bày ảnh · tên · nhóm · giá · tồn · đơn vị;
// giá gạch · loại/cỡ · mô tả · Ẩn-Hiện thu sau một nút. Tồn kho tính CHUNG cho
// mọi loại/cỡ (LEAD §5 #5) — nói thẳng một dòng, không để bà con đoán.
// Gửi hỏng (mất sóng / máy chủ) KHÔNG xoá nội dung đang gõ (AC-61).
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MinusIcon, PlusIcon, TrashIcon } from "@/components/icons";
import { ImagePicker } from "@/components/market/shared/image-picker";
import { ChipRow, type ChipOption } from "@/components/ui/chip-row";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, MoneyField, PrimaryButton, inputClass } from "@/components/ui/primitives";
import { StatusBanner } from "@/components/ui/status-banner";
import { marketPost, marketSend, marketUpload } from "@/lib/market/client";
import { CATEGORY_LABEL, PRODUCT_CATEGORIES } from "@/lib/market/categories";
import type { Product, ProductCategory, ProductDraftM, Shop } from "@/lib/market/types";
import { PRICE_MAX, PRICE_MIN, STOCK_MAX, validateMarketProductDraft, VARIANT_MAX } from "@/lib/market/validate";
import { useOnline } from "@/lib/use-online";
import { LoadView, marketErrorText, useMarketData, useMyShop } from "./seller-net";
import { focusField, invalidProps, SELLER_BTN } from "./ui";

const CATEGORY_OPTIONS: readonly ChipOption<ProductCategory>[] = PRODUCT_CATEGORIES.map((c) => ({
  id: c, label: CATEGORY_LABEL[c],
}));

interface VForm { label: string; priceDigits: string }
interface PForm {
  title: string;
  category: ProductCategory | "";
  /** Chưa niêm yết giá — bà con gọi hỏi giá (xem `Product.priceVnd`). */
  quoteOnly: boolean;
  priceDigits: string;
  compareDigits: string;
  unit: string;
  stock: string;
  description: string;
  images: string[];
  variantsOn: boolean;
  variants: VForm[];
  hidden: boolean;
}

const emptyForm = (): PForm => ({
  title: "", category: "", quoteOnly: false, priceDigits: "", compareDigits: "", unit: "", stock: "0",
  description: "", images: [], variantsOn: false, variants: [{ label: "", priceDigits: "" }, { label: "", priceDigits: "" }],
  hidden: false,
});

function formOf(p: Product): PForm {
  return {
    title: p.title,
    category: p.category,
    quoteOnly: p.priceVnd == null,
    priceDigits: p.priceVnd == null ? "" : String(p.priceVnd),
    compareDigits: p.compareAtVnd != null ? String(p.compareAtVnd) : "",
    unit: p.unit,
    stock: String(p.stock),
    description: p.description ?? "",
    images: [...p.images],
    variantsOn: p.variants.length > 0,
    variants: p.variants.length > 0
      ? p.variants.map((v) => ({ label: v.label, priceDigits: v.priceVnd != null ? String(v.priceVnd) : "" }))
      : [{ label: "", priceDigits: "" }, { label: "", priceDigits: "" }],
    hidden: p.status === "an",
  };
}

function draftOf(f: PForm): ProductDraftM {
  const compare = f.compareDigits ? Number(f.compareDigits) : undefined;
  /*  CHƯA NIÊM YẾT GIÁ: gửi lên priceVnd null, và bỏ luôn giá gạch · loại/cỡ ·
      tồn kho — ba thứ đó đều đo theo giá gốc, không có gốc thì không có nghĩa
      (validate cũng chặn, đây là để form không gửi rác lên). */
  if (f.quoteOnly) {
    return {
      title: f.title.trim(),
      description: f.description.trim(),
      category: f.category as ProductCategory,
      priceVnd: null,
      unit: f.unit.trim(),
      stock: 0,
      images: f.images,
      variants: [],
      status: f.hidden ? "an" : "dang_ban",
    };
  }
  return {
    title: f.title.trim(),
    description: f.description.trim(),
    category: f.category as ProductCategory,
    priceVnd: Number(f.priceDigits || 0),
    ...(compare != null ? { compareAtVnd: compare } : {}),
    unit: f.unit.trim(),
    stock: Number(f.stock || 0),
    images: f.images,
    variants: f.variantsOn
      ? f.variants.map((v) => ({
          label: v.label.trim(),
          ...(v.priceDigits ? { priceVnd: Number(v.priceDigits) } : {}),
        }))
      : [],
    status: f.hidden ? "an" : "dang_ban",
  };
}

/*  Ô NÀO ĐANG SAI (F-25) — câu lỗi vẫn lấy NGUYÊN của `validateMarketProductDraft`
    (một nguồn client + server), ở đây chỉ hỏi "câu này thuộc ô nào" để đặt nó
    ngay dưới ô + cuộn tới. Hàm validate trả lỗi ĐẦU TIÊN nên một ô là đủ. */
type PField = "images" | "title" | "category" | "price" | "compare" | "unit" | "stock" | "description" | "variants";

const pFieldDomId = (f: PField) => `sp-field-${f}`;

function productFieldOfError(msg: string, f: PForm): PField {
  if (/^Tên món/.test(msg)) return "title";
  if (/nhóm hàng/i.test(msg)) return "category";
  if (/^Giá gạch/.test(msg)) return "compare";
  if (/^Giá từ/.test(msg)) {
    // cùng một câu dùng cho giá món và giá của loại/cỡ — hỏi lại giá món để biết
    const v = Number(f.priceDigits || 0);
    return Number.isInteger(v) && v >= PRICE_MIN && v <= PRICE_MAX ? "variants" : "price";
  }
  if (/đơn vị tính/i.test(msg)) return "unit";
  if (/^Tồn kho/.test(msg)) return "stock";
  if (/^Mô tả/.test(msg)) return "description";
  if (/ảnh/i.test(msg)) return "images";
  if (/loại/i.test(msg)) return "variants";
  return "title";
}

function ErrLine({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p className="-mt-2.5 mb-3 text-[1rem] font-bold" style={{ color: "var(--danger)" }} role="alert">
      {msg}
    </p>
  );
}

export function SellerProductForm({ id }: { id: string }) {
  const isNew = id === "moi";
  const shopState = useMyShop();
  const productState = useMarketData<{ product: Product }>(isNew ? null : `/api/ban-hang/san-pham/${id}`);

  return (
    <LoadView state={shopState.state} what="gian hàng" onRetry={shopState.reload}>
      {(s) =>
        !s.shop ? (
          <p className="px-4 py-8 text-center text-[1.125rem] text-foreground/70">
            Chưa có gian hàng — đăng ký shop trước đã.
          </p>
        ) : isNew ? (
          <Inner shop={s.shop} product={null} />
        ) : (
          <LoadView state={productState.state} what="món hàng" onRetry={productState.reload}>
            {(d) => <Inner shop={s.shop as Shop} product={d.product} />}
          </LoadView>
        )
      }
    </LoadView>
  );
}

function Inner({ shop, product }: { shop: Shop; product: Product | null }) {
  const router = useRouter();
  const online = useOnline();
  const [form, setForm] = useState<PForm>(() => (product ? formOf(product) : emptyForm()));
  /*  `error` = lỗi của MỘT ô (validate) ⇒ hiện ngay dưới ô đó; `serverNote` =
      lời của máy chủ / mất sóng ⇒ hiện cạnh nút Lưu (F-25). */
  const [error, setError] = useState<string | null>(null);
  const [serverNote, setServerNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [more, setMore] = useState(false);
  const [askDelete, setAskDelete] = useState(false);
  const canEdit = shop.status === "cho_duyet" || shop.status === "hoat_dong";
  const set = (patch: Partial<PForm>) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => {
    if (product) setForm(formOf(product));
  }, [product]);

  async function upload(blob: Blob): Promise<string> {
    const res = await marketUpload("/api/ban-hang/upload", blob);
    if (res.ok) return res.data.url;
    throw new Error(marketErrorText(res));
  }

  async function save() {
    if (saving) return; // chống bấm đúp
    const draft = draftOf(form);
    const err = validateMarketProductDraft(draft);
    if (err) {
      setError(err);
      setServerNote(null);
      /*  Lỗi có thể nằm trong khối đang thu — mở ra, nếu không bà con thấy câu
          lỗi mà không thấy ô nào để sửa (án lệ D2 "thao tác câm"). */
      setMore(true);
      /*  Đợi khối vừa mở vẽ xong rồi mới cuộn — cuộn trước thì ô còn chưa có
          trong trang. */
      const target = pFieldDomId(productFieldOfError(err, form));
      requestAnimationFrame(() => focusField(target));
      return;
    }
    setError(null);
    setServerNote(null);
    setSaving(true);
    const res = product
      ? await marketSend<{ product: Product }>("PATCH", `/api/ban-hang/san-pham/${product.id}`, draft)
      : await marketPost<{ product: Product }>("/api/ban-hang/san-pham", draft);
    setSaving(false);
    if (res.ok) {
      router.push(`/ban-hang/san-pham?luu=${encodeURIComponent(draft.title)}`);
      return;
    }
    setServerNote(res.offline ? "Chưa lưu được — cần sóng. Nội dung vẫn ở trên màn." : marketErrorText(res));
  }

  async function remove() {
    if (!product || saving) return;
    setAskDelete(false);
    setSaving(true);
    const res = await marketSend<Record<string, never>>("DELETE", `/api/ban-hang/san-pham/${product.id}`);
    setSaving(false);
    if (res.ok) {
      router.push(`/ban-hang/san-pham?xoa=${encodeURIComponent(product.title)}`);
      return;
    }
    setServerNote(res.offline ? "Chưa xoá được — cần sóng." : marketErrorText(res));
  }

  const badField = error ? productFieldOfError(error, form) : null;
  const at = (f: PField) => (badField === f ? error ?? undefined : undefined);
  const stockNum = Number(form.stock || 0);
  const setStock = (n: number) => set({ stock: String(Math.min(STOCK_MAX, Math.max(0, n))) });

  return (
    <div className="pb-10">
      {!canEdit && (
        <div className="mb-3 overflow-hidden">
          <StatusBanner level="danger">
            {shop.status === "tam_khoa"
              ? "Shop đang bị tạm khoá — chưa sửa món được. Gọi SDVICO để mở lại."
              : "SDVICO chưa duyệt shop — sửa đăng ký rồi gửi lần nữa."}
          </StatusBanner>
        </div>
      )}
      {product?.adminHidden && (
        <div className="mb-3 overflow-hidden">
          <StatusBanner level="danger">
            SDVICO đã gỡ món này: {product.adminHiddenReason ?? "không ghi lý do"}. Shop không tự bật lại được.
          </StatusBanner>
        </div>
      )}

      <div className="px-4">
        <div id={pFieldDomId("images")}>
          <ImagePicker value={form.images} onChange={(images) => set({ images })} upload={upload} />
        </div>
        <ErrLine msg={at("images")} />

        <div id={pFieldDomId("title")}>
          <Field label="Tên món">
            <input
              className={inputClass}
              value={form.title}
              onChange={(e) => set({ title: e.target.value })}
              placeholder="Ví dụ: Dầu nhớt Castrol 20W-50 thùng 18L"
              maxLength={120}
              {...invalidProps(badField === "title")}
            />
          </Field>
        </div>
        <ErrLine msg={at("title")} />

        <p className="mb-1.5 text-[1rem] font-bold text-navy" id={pFieldDomId("category")}>Nhóm hàng</p>
      </div>
      <div className="mb-3.5">
        <ChipRow
          options={CATEGORY_OPTIONS}
          /* chưa chọn ⇒ không chip nào sáng; validate sẽ nhắc "Chọn nhóm hàng." */
          value={form.category as ProductCategory}
          onChange={(c) => set({ category: c })}
          accent="t3"
          level={1}
          ariaLabel="Nhóm hàng"
        />
      </div>

      <div className="px-4">
        <ErrLine msg={at("category")} />

        {/*  MÓN BÁO GIÁ THEO TÀU (2026-09-07, ADR 0014): máy tàu, thiết bị lớn
             thường báo giá từng chiếc. Không có bậc này thì shop buộc phải bịa
             một con số, hoặc không đăng được món lên cửa hàng. Bật lên thì giấu luôn
             giá · tồn kho · giá gạch · loại-cỡ cho khỏi rối. */}
        <label className="mb-3 flex min-h-(--row-h) items-center justify-between gap-3 rounded-2xl bg-field px-4">
          <span className="min-w-0">
            <span className="block text-[1rem] font-bold text-navy">Chưa để giá — bà con gọi hỏi</span>
            <span className="block text-[0.9375rem] leading-snug text-foreground/70">
              Món báo giá theo từng tàu. Chợ hiện &quot;Liên hệ báo giá&quot; và nút gọi shop.
            </span>
          </span>
          <input
            type="checkbox"
            className="h-7 w-7 shrink-0"
            checked={form.quoteOnly}
            onChange={(e) => set({ quoteOnly: e.target.checked })}
          />
        </label>

        {!form.quoteOnly && (
          <>
            <div id={pFieldDomId("price")}>
              <MoneyField label="Giá bán" digits={form.priceDigits} onDigits={(d) => set({ priceDigits: d })} placeholder="Ví dụ: 1.650.000" />
            </div>
            <ErrLine msg={at("price")} />
          </>
        )}

        {!form.quoteOnly && (
          <>
        <p className="mb-1.5 text-[1rem] font-bold text-navy">Tồn kho</p>
        <div className="mb-1 flex items-center gap-2" id={pFieldDomId("stock")}>
          <button type="button" onClick={() => setStock(stockNum - 1)} aria-label="Bớt tồn kho"
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-field text-navy active:scale-95">
            <MinusIcon className="h-6 w-6" />
          </button>
          <input
            className={`${inputClass} text-center`}
            inputMode="numeric"
            value={form.stock}
            onChange={(e) => set({ stock: e.target.value.replace(/\D/g, "").slice(0, 5) })}
            aria-label="Số lượng còn trong kho"
            {...invalidProps(badField === "stock")}
          />
          <button type="button" onClick={() => setStock(stockNum + 1)} aria-label="Thêm tồn kho"
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-field text-navy active:scale-95">
            <PlusIcon className="h-6 w-6" />
          </button>
        </div>
        <ErrLine msg={at("stock")} />
        <p className="mb-3.5 text-[0.9375rem] text-foreground/70">Tồn 0 là món tự chuyển sang &quot;Hết hàng&quot;.</p>
          </>
        )}

        <div id={pFieldDomId("unit")}>
          <Field label="Đơn vị tính">
            <input
              className={inputClass}
              value={form.unit}
              onChange={(e) => set({ unit: e.target.value })}
              placeholder="lít, cái, bao, thùng…"
              maxLength={20}
              {...invalidProps(badField === "unit")}
            />
          </Field>
        </div>
        <ErrLine msg={at("unit")} />

        {!more ? (
          <button
            type="button"
            onClick={() => setMore(true)}
            className="mb-4 flex min-h-(--row-h) w-full items-center gap-3 rounded-2xl bg-field px-4 text-left text-[1rem] font-bold text-navy"
          >
            <PlusIcon className="h-5 w-5 shrink-0" />
            {/* Món chưa để giá thì giá gạch và loại/cỡ không mở được — đừng mời. */}
            {form.quoteOnly ? "Thêm mô tả" : "Thêm giá gạch · loại/cỡ · mô tả"}
          </button>
        ) : (
          <>
            {!form.quoteOnly && (
              <>
            <div id={pFieldDomId("compare")}>
              <MoneyField
                label="Giá gạch (giá cũ, để trống nếu không có)"
                digits={form.compareDigits}
                onDigits={(d) => set({ compareDigits: d })}
                placeholder="Cao hơn giá bán"
              />
            </div>
            <ErrLine msg={at("compare")} />

            <label className="mb-2 flex min-h-(--row-h) items-center justify-between gap-3 rounded-2xl bg-field px-4">
              <span className="text-[1rem] font-bold text-navy">Món có nhiều loại/cỡ</span>
              <input
                type="checkbox"
                className="h-7 w-7"
                checked={form.variantsOn}
                onChange={(e) => set({ variantsOn: e.target.checked })}
              />
            </label>
            {form.variantsOn && (
              <div className="mb-3.5" id={pFieldDomId("variants")}>
                <p className="mb-2 text-[0.9375rem] leading-snug text-foreground/70">
                  Tồn kho tính chung cho mọi loại. Cần ít nhất 2 loại, nhiều nhất {VARIANT_MAX}.
                </p>
                {form.variants.map((v, i) => (
                  <div key={i} className="mb-2 flex items-end gap-2">
                    <span className="min-w-0 flex-1">
                      <input
                        className={inputClass}
                        value={v.label}
                        onChange={(e) => set({ variants: form.variants.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })}
                        placeholder={`Loại ${i + 1} (vd Ø12)`}
                        maxLength={40}
                        aria-label={`Tên loại ${i + 1}`}
                      />
                    </span>
                    <span className="w-28 shrink-0">
                      <input
                        className={inputClass}
                        inputMode="numeric"
                        value={v.priceDigits}
                        onChange={(e) => set({ variants: form.variants.map((x, j) => (j === i ? { ...x, priceDigits: e.target.value.replace(/\D/g, "") } : x)) })}
                        placeholder="Giá riêng"
                        aria-label={`Giá riêng loại ${i + 1}`}
                      />
                    </span>
                    <button
                      type="button"
                      onClick={() => set({ variants: form.variants.filter((_, j) => j !== i) })}
                      aria-label={`Bỏ loại ${i + 1}`}
                      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-field"
                      style={{ color: "var(--danger)" }}
                    >
                      <TrashIcon className="h-6 w-6" />
                    </button>
                  </div>
                ))}
                {form.variants.length < VARIANT_MAX && (
                  <button
                    type="button"
                    onClick={() => set({ variants: [...form.variants, { label: "", priceDigits: "" }] })}
                    className="flex min-h-(--row-h) w-full items-center gap-2 rounded-2xl bg-field px-4 text-[1rem] font-bold text-navy"
                  >
                    <PlusIcon className="h-5 w-5" /> Thêm loại
                  </button>
                )}
                <ErrLine msg={at("variants")} />
              </div>
            )}
              </>
            )}

            <div id={pFieldDomId("description")}>
              <Field label="Mô tả">
                <textarea
                  className={inputClass}
                  rows={4}
                  value={form.description}
                  onChange={(e) => set({ description: e.target.value })}
                  placeholder="Hàng chính hãng, bảo hành, giao tới cảng nào…"
                  maxLength={2000}
                  {...invalidProps(badField === "description")}
                />
              </Field>
            </div>
            <ErrLine msg={at("description")} />

            <label className="mb-4 flex min-h-(--row-h) items-center justify-between gap-3 rounded-2xl bg-field px-4">
              <span className="min-w-0">
                <span className="block text-[1rem] font-bold text-navy">Ẩn món khỏi chợ</span>
                <span className="block text-[0.9375rem] leading-snug text-foreground/70">Bà con không thấy món này nữa.</span>
              </span>
              <input
                type="checkbox"
                className="h-7 w-7"
                checked={form.hidden}
                disabled={!!product?.adminHidden}
                onChange={(e) => set({ hidden: e.target.checked })}
              />
            </label>
          </>
        )}

        {/*  Câu lỗi của TỪNG Ô đã nằm ngay dưới ô đó (F-25); chỗ này chỉ còn
            lời của máy chủ / mất sóng — thứ không thuộc ô nào. */}
        {serverNote && (
          <p className="mb-3 rounded-2xl px-3.5 py-2.5 text-[1rem] font-bold" role="alert"
            style={{ backgroundColor: "var(--danger-bg)", color: "var(--danger)" }}>
            {serverNote}
          </p>
        )}

        {/* Nút chính DUY NHẤT của màn ⇒ full-width (ngoại lệ 03 §Nút hành động mục 0). */}
        <PrimaryButton onClick={() => void save()} disabled={saving || !canEdit}>
          {saving ? "Đang lưu…" : product ? "Lưu thay đổi" : "Lưu món hàng"}
        </PrimaryButton>
        {!online && (
          <p className="mt-2 text-center text-[1rem] font-bold" style={{ color: "var(--danger)" }}>
            Lưu cần có sóng — nội dung vẫn ở trên màn.
          </p>
        )}

        {product && canEdit && (
          <div className="mt-4 flex justify-center">
            <button type="button" onClick={() => setAskDelete(true)} className={`${SELLER_BTN} bg-field`} style={{ color: "var(--danger)" }}>
              <TrashIcon className="h-6 w-6" />
              Xoá món
            </button>
          </div>
        )}
      </div>

      {askDelete && product && (
        <ConfirmDialog
          title={`Xoá ${product.title}?`}
          message="Đơn cũ vẫn giữ tên và giá lúc đặt."
          confirmLabel="Xoá luôn"
          onCancel={() => setAskDelete(false)}
          onConfirm={() => void remove()}
        />
      )}
    </div>
  );
}

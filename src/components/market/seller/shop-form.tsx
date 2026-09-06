"use client";

// FORM HỒ SƠ SHOP — dùng chung cho Đăng ký (6.1) và Cài đặt shop (6.6), vì hai
// màn đó là MỘT bộ ô (11 §6.6: "form = 6.1 điền sẵn"). Luật C1 "chỉ bày cái
// key" (03 §6): bày tên · SĐT liên hệ · tỉnh · địa chỉ · phí giao; giới thiệu +
// ngưỡng miễn phí giao + số tài khoản thu sau nút, mở khi cần.
//
// Câu lỗi lấy NGUYÊN của `validateShopDraft` (một nguồn client + server) rồi
// gắn xuống đúng ô — hàm đó trả lỗi ĐẦU TIÊN nên "cuộn tới ô lỗi đầu" là đủ.
import { useState } from "react";
import { Field, MoneyField, inputClass } from "@/components/ui/primitives";
import { PlusIcon, TrashIcon } from "@/components/icons";
import { parseDigits } from "@/lib/format";
import { sanitizePhoneInput } from "@/lib/phone";
import { COASTAL_PROVINCES } from "@/lib/region";
import type { Shop, ShopDraft } from "@/lib/market/types";
import { invalidProps, SELLER_BTN } from "./ui";

export interface ShopFormValue {
  name: string;
  phone: string;
  province: string;
  address: string;
  description: string;
  /** chuỗi số thô của MoneyField */
  shippingDigits: string;
  freeShipDigits: string;
  bankName: string;
  bankAccount: string;
  bankHolder: string;
  logoUrl: string;
}

export function emptyShopForm(phone: string | null): ShopFormValue {
  return {
    name: "", phone: phone ?? "", province: "", address: "", description: "",
    shippingDigits: "", freeShipDigits: "", bankName: "", bankAccount: "", bankHolder: "", logoUrl: "",
  };
}

export function shopFormFrom(shop: Shop): ShopFormValue {
  return {
    name: shop.name,
    phone: shop.phone ?? "",
    province: shop.province ?? "",
    address: shop.address ?? "",
    description: shop.description ?? "",
    shippingDigits: shop.shippingFlatVnd ? String(shop.shippingFlatVnd) : "",
    freeShipDigits: shop.freeShipFromVnd != null ? String(shop.freeShipFromVnd) : "",
    bankName: shop.bankName ?? "",
    bankAccount: shop.bankAccount ?? "",
    bankHolder: shop.bankHolder ?? "",
    logoUrl: shop.logoUrl ?? "",
  };
}

/** Bản nháp gửi lên máy chủ. Ô rỗng ⇒ "" — route hiểu là XOÁ trường đó. */
export function shopDraftOf(v: ShopFormValue): ShopDraft & { logoUrl: string } {
  return {
    name: v.name.trim(),
    description: v.description.trim(),
    logoUrl: v.logoUrl.trim(),
    phone: v.phone.trim(),
    province: v.province,
    address: v.address.trim(),
    bankName: v.bankName.trim(),
    bankAccount: v.bankAccount.trim(),
    bankHolder: v.bankHolder.trim(),
    shippingFlatVnd: Number(v.shippingDigits || 0),
    ...(v.freeShipDigits ? { freeShipFromVnd: Number(v.freeShipDigits) } : {}),
  };
}

export type ShopField = "name" | "phone" | "province" | "address" | "description" | "shipping" | "freeship" | "bank";

/** Câu lỗi của validateShopDraft thuộc về ô nào — để hiện ĐÚNG chỗ và cuộn tới. */
export function shopFieldOfError(msg: string): ShopField {
  if (/^Tên shop/.test(msg)) return "name";
  if (/điện thoại/i.test(msg)) return "phone";
  if (/tỉnh/i.test(msg)) return "province";
  if (/^Địa chỉ/.test(msg)) return "address";
  if (/^Giới thiệu/.test(msg)) return "description";
  if (/^Phí giao/.test(msg)) return "shipping";
  if (/miễn phí giao/i.test(msg)) return "freeship";
  return "bank";
}

export const shopFieldDomId = (f: ShopField) => `shop-field-${f}`;

function ErrLine({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p className="-mt-2.5 mb-3 text-[1rem] font-bold" style={{ color: "var(--danger)" }} role="alert">
      {msg}
    </p>
  );
}

export function ShopForm({
  value,
  onChange,
  error,
  logoSlot,
}: {
  value: ShopFormValue;
  onChange: (v: ShopFormValue) => void;
  /** câu lỗi từ validateShopDraft (hoặc từ máy chủ) — hiện dưới đúng ô */
  error?: string | null;
  /** chỗ cắm ImagePicker logo (chỉ màn Cài đặt — lúc đăng ký chưa có shop để tải ảnh) */
  logoSlot?: React.ReactNode;
}) {
  const [showBank, setShowBank] = useState(!!value.bankAccount);
  const [showMore, setShowMore] = useState(!!value.description || !!value.freeShipDigits);
  const set = (patch: Partial<ShopFormValue>) => onChange({ ...value, ...patch });
  const field = error ? shopFieldOfError(error) : null;
  const at = (f: ShopField) => (field === f ? error ?? undefined : undefined);

  return (
    <div className="px-4">
      {logoSlot}

      <div id={shopFieldDomId("name")}>
        <Field label="Tên gian hàng">
          <input
            className={inputClass}
            value={value.name}
            onChange={(e) => set({ name: e.target.value })}
            {...invalidProps(field === "name")}
            placeholder="Ví dụ: Đại lý Hải Đăng"
            maxLength={60}
          />
        </Field>
      </div>
      <ErrLine msg={at("name")} />

      <div id={shopFieldDomId("phone")}>
        <Field label="Số điện thoại bà con gọi shop">
          <input
            className={inputClass}
            inputMode="tel"
            value={value.phone}
            onChange={(e) => set({ phone: sanitizePhoneInput(e.target.value) })}
            {...invalidProps(field === "phone")}
            placeholder="09xxxxxxxx"
            autoComplete="tel"
          />
        </Field>
      </div>
      <ErrLine msg={at("phone")} />

      {/*  Ô CHỌN của máy thay 22 chip cuộn ngang (F-11): người Khánh Hoà phải
          kéo qua 13 chip mới thấy tỉnh mình; danh sách của hệ điều hành mở ra
          là chọn được ngay, chữ to sẵn theo cỡ chữ máy. */}
      <div id={shopFieldDomId("province")}>
        <Field label="Tỉnh của shop">
          <select
            className={inputClass}
            value={value.province}
            onChange={(e) => set({ province: e.target.value })}
            {...invalidProps(field === "province")}
          >
            <option value="">— Chọn tỉnh —</option>
            {COASTAL_PROVINCES.map((p) => (
              <option key={p.name} value={p.name}>{p.name}</option>
            ))}
          </select>
        </Field>
      </div>
      <ErrLine msg={at("province")} />

      <div id={shopFieldDomId("address")}>
        <Field label="Địa chỉ shop (để bà con tới lấy hàng)">
          <input
            className={inputClass}
            value={value.address}
            onChange={(e) => set({ address: e.target.value })}
            {...invalidProps(field === "address")}
            placeholder="Ví dụ: Cảng cá Quy Nhơn, lô 12"
            maxLength={200}
          />
        </Field>
      </div>
      <ErrLine msg={at("address")} />

      <div id={shopFieldDomId("shipping")}>
        <MoneyField
          label="Phí giao mỗi đơn"
          digits={value.shippingDigits}
          onDigits={(d) => set({ shippingDigits: d })}
          placeholder="0 = shop giao không lấy tiền"
        />
      </div>
      <ErrLine msg={at("shipping")} />

      {!showMore ? (
        <button
          type="button"
          onClick={() => setShowMore(true)}
          className="mb-4 flex min-h-[3.5rem] w-full items-center gap-3 rounded-2xl bg-field px-4 text-left text-[1rem] font-bold text-navy"
        >
          <PlusIcon className="h-5 w-5 shrink-0" />
          Thêm giới thiệu · miễn phí giao
        </button>
      ) : (
        <>
          <div id={shopFieldDomId("freeship")}>
            <MoneyField
              label="Miễn phí giao từ (để trống = luôn tính phí)"
              digits={value.freeShipDigits}
              onDigits={(d) => set({ freeShipDigits: d })}
              placeholder="Ví dụ: 2.000.000"
            />
          </div>
          <ErrLine msg={at("freeship")} />
          <div id={shopFieldDomId("description")}>
            <Field label="Giới thiệu ngắn về shop">
              <textarea
                className={inputClass}
                rows={3}
                value={value.description}
                onChange={(e) => set({ description: e.target.value })}
                placeholder="Bán gì, giao tới đâu, giờ mở cửa…"
                maxLength={1000}
              />
            </Field>
          </div>
          <ErrLine msg={at("description")} />
        </>
      )}

      {!showBank ? (
        <>
          <button
            type="button"
            onClick={() => setShowBank(true)}
            className="mb-1.5 flex min-h-[3.5rem] w-full items-center gap-3 rounded-2xl bg-field px-4 text-left text-[1rem] font-bold text-navy"
          >
            <PlusIcon className="h-5 w-5 shrink-0" />
            Thêm số tài khoản ngân hàng
          </button>
          <p className="mb-4 text-[0.9375rem] leading-snug text-foreground/70">
            Không có số tài khoản thì bà con chỉ trả được tiền mặt khi nhận hàng.
          </p>
        </>
      ) : (
        <div id={shopFieldDomId("bank")}>
          <Field label="Ngân hàng">
            <input
              className={inputClass}
              value={value.bankName}
              onChange={(e) => set({ bankName: e.target.value })}
              placeholder="Ví dụ: Vietcombank"
              maxLength={40}
            />
          </Field>
          <Field label="Số tài khoản">
            <input
              className={inputClass}
              inputMode="numeric"
              value={value.bankAccount}
              onChange={(e) => set({ bankAccount: parseDigits(e.target.value) })}
              placeholder="Chỉ số"
            />
          </Field>
          <Field label="Tên chủ tài khoản">
            <input
              className={inputClass}
              value={value.bankHolder}
              onChange={(e) => set({ bankHolder: e.target.value.toUpperCase() })}
              placeholder="NGUYEN VAN HAI"
              maxLength={60}
            />
          </Field>
          <ErrLine msg={at("bank")} />
          <button
            type="button"
            onClick={() => { setShowBank(false); set({ bankName: "", bankAccount: "", bankHolder: "" }); }}
            className={`${SELLER_BTN} mb-4 bg-field text-navy`}
          >
            <TrashIcon className="h-6 w-6" />
            Bỏ STK
          </button>
        </div>
      )}
    </div>
  );
}

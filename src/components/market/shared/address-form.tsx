"use client";

import { useEffect, useRef } from "react";
import { ChipRow, type ChipOption } from "@/components/ui/chip-row";
import { Field, inputClass } from "@/components/ui/primitives";
import type { Address } from "@/lib/market/types";
import { addressErrorField, type AddressField } from "@/lib/market/validate";
import { sanitizePhoneInput } from "@/lib/phone";
import { COASTAL_PROVINCES } from "@/lib/region";

const PORT_OPTIONS: readonly ChipOption<"cang" | "dia_chi">[] = [
  { id: "cang", label: "Giao ra cảng / bến" },
  { id: "dia_chi", label: "Địa chỉ nhà / kho" },
];

/** Câu lỗi ngay dưới ô (F-11) — một khuôn cho mọi ô. */
function FieldError({ text }: { text: string }) {
  return (
    <span className="mt-1 block text-[1rem] font-semibold" style={{ color: "var(--danger)" }} role="alert">
      {text}
    </span>
  );
}

/**
 * Form địa chỉ nhận (11 §3.4): tên · SĐT người nhận · tỉnh (`<select>` NỀN TẢNG
 * từ `COASTAL_PROVINCES`, tỉnh cảng nhà đứng đầu — F-11: 34 chip cuộn ngang bắt
 * người Khánh Hòa kéo ~20 chip) · công tắc "Giao ra cảng" đổi nhãn ô chi tiết.
 * `error` = câu từ `validateAddress`; form tự đặt câu ĐÚNG DƯỚI Ô sai
 * (`addressErrorField`) và focus ô đó — validate vẫn là việc của màn gọi.
 */
export function AddressForm({
  value,
  onChange,
  error,
  homeProvince,
}: {
  value: Address;
  onChange: (a: Address) => void;
  error?: string | null;
  /** tỉnh cảng nhà (`loadHome().province`) — đưa lên đầu danh sách */
  homeProvince?: string;
}) {
  const set = (patch: Partial<Address>) => onChange({ ...value, ...patch });
  const bad: AddressField | null = error ? (addressErrorField(value) ?? "detail") : null;
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const provinceRef = useRef<HTMLSelectElement>(null);
  const detailRef = useRef<HTMLInputElement>(null);
  // Lỗi vừa hiện ⇒ đưa bà con tới đúng ô (sheet dài, ô sai có thể ở trên xa)
  useEffect(() => {
    if (!error || !bad) return;
    const el =
      bad === "name" ? nameRef.current : bad === "phone" ? phoneRef.current : bad === "province" ? provinceRef.current : detailRef.current;
    el?.focus();
    el?.scrollIntoView({ block: "center" });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy khi câu lỗi đổi
  }, [error]);

  const provinces = [
    ...(homeProvince ? [homeProvince] : []),
    ...COASTAL_PROVINCES.map((p) => p.name).filter((n) => n !== homeProvince),
  ];
  // tỉnh đang chọn không nằm trong danh sách ven biển (dữ liệu cũ) ⇒ vẫn hiện để không "mất" lựa chọn
  if (value.province && !provinces.includes(value.province)) provinces.push(value.province);

  return (
    <div>
      <Field label="Tên người nhận">
        <input
          ref={nameRef}
          className={inputClass}
          value={value.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="Ví dụ: Nguyễn Văn Ba"
          autoComplete="name"
          aria-invalid={bad === "name" || undefined}
        />
        {bad === "name" && error && <FieldError text={error} />}
      </Field>
      <Field label="Số điện thoại nhận hàng">
        <input
          ref={phoneRef}
          className={inputClass}
          inputMode="tel"
          value={value.phone}
          onChange={(e) => set({ phone: sanitizePhoneInput(e.target.value) })}
          placeholder="09xxxxxxxx"
          autoComplete="tel"
          aria-invalid={bad === "phone" || undefined}
        />
        {bad === "phone" && error && <FieldError text={error} />}
      </Field>
      <Field label="Tỉnh">
        <select
          ref={provinceRef}
          className={`${inputClass} min-h-(--row-h)`}
          value={value.province}
          onChange={(e) => set({ province: e.target.value })}
          aria-invalid={bad === "province" || undefined}
        >
          <option value="">Chọn tỉnh…</option>
          {provinces.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        {bad === "province" && error && <FieldError text={error} />}
      </Field>
      <p className="mb-1.5 block text-[1rem] font-semibold text-navy">Nhận ở đâu</p>
      <div className="-mx-4">
        <ChipRow
          options={PORT_OPTIONS}
          value={value.isPort ? "cang" : "dia_chi"}
          onChange={(v) => set({ isPort: v === "cang" })}
          accent="t3"
          level={1}
          ariaLabel="Nhận ở đâu"
        />
      </div>
      <Field label={value.isPort ? "Tên cảng / bến (thêm tên tàu, cầu cảng nếu có)" : "Địa chỉ đủ để người giao tìm được"}>
        <input
          ref={detailRef}
          className={inputClass}
          value={value.detail}
          onChange={(e) => set({ detail: e.target.value })}
          placeholder={value.isPort ? "Ví dụ: Cảng Hòn Rớ, tàu KH-91234" : "Số nhà, đường, xã/phường"}
          maxLength={value.isPort ? 80 : 200}
          aria-invalid={bad === "detail" || undefined}
        />
        {bad === "detail" && error && <FieldError text={error} />}
      </Field>
    </div>
  );
}

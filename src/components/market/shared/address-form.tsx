"use client";

import { ChipRow, type ChipOption } from "@/components/ui/chip-row";
import { Field, inputClass } from "@/components/ui/primitives";
import type { Address } from "@/lib/market/types";
import { sanitizePhoneInput } from "@/lib/phone";
import { COASTAL_PROVINCES } from "@/lib/region";

const PROVINCE_OPTIONS: readonly ChipOption<string>[] = COASTAL_PROVINCES.map((p) => ({ id: p.name, label: p.name }));
const PORT_OPTIONS: readonly ChipOption<"cang" | "dia_chi">[] = [
  { id: "cang", label: "Giao ra cảng / bến" },
  { id: "dia_chi", label: "Địa chỉ nhà / kho" },
];

/**
 * Form địa chỉ nhận (11 §3.4): tên · SĐT người nhận · tỉnh (chip
 * `COASTAL_PROVINCES`) · công tắc "Giao ra cảng" đổi nhãn ô chi tiết. `error`
 * = câu từ `validateAddress` — hiện dưới form; validate là việc của màn gọi.
 */
export function AddressForm({
  value,
  onChange,
  error,
}: {
  value: Address;
  onChange: (a: Address) => void;
  error?: string | null;
}) {
  const set = (patch: Partial<Address>) => onChange({ ...value, ...patch });
  return (
    <div>
      <Field label="Tên người nhận">
        <input
          className={inputClass}
          value={value.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="Ví dụ: Nguyễn Văn Ba"
          autoComplete="name"
        />
      </Field>
      <Field label="Số điện thoại nhận hàng">
        <input
          className={inputClass}
          inputMode="tel"
          value={value.phone}
          onChange={(e) => set({ phone: sanitizePhoneInput(e.target.value) })}
          placeholder="09xxxxxxxx"
          autoComplete="tel"
        />
      </Field>
      <p className="mb-1.5 block text-[1rem] font-bold text-navy">Tỉnh</p>
      <div className="-mx-4">
        <ChipRow options={PROVINCE_OPTIONS} value={value.province} onChange={(p) => set({ province: p })} accent="t3" level={2} ariaLabel="Tỉnh" />
      </div>
      <p className="mb-1.5 block text-[1rem] font-bold text-navy">Nhận ở đâu</p>
      <div className="-mx-4">
        <ChipRow
          options={PORT_OPTIONS}
          value={value.isPort ? "cang" : "dia_chi"}
          onChange={(v) => set({ isPort: v === "cang" })}
          accent="t3"
          level={2}
          ariaLabel="Nhận ở đâu"
        />
      </div>
      <Field label={value.isPort ? "Tên cảng / bến (thêm tên tàu, cầu cảng nếu có)" : "Địa chỉ đủ để người giao tìm được"}>
        <input
          className={inputClass}
          value={value.detail}
          onChange={(e) => set({ detail: e.target.value })}
          placeholder={value.isPort ? "Ví dụ: Cảng Hòn Rớ, tàu KH-91234" : "Số nhà, đường, xã/phường"}
          maxLength={value.isPort ? 80 : 200}
        />
      </Field>
      {error && (
        <p className="rounded-2xl px-3.5 py-2.5 text-[1rem] font-bold" style={{ backgroundColor: "var(--danger-bg)", color: "var(--danger)" }} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

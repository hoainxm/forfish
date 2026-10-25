import {
  cloneElement,
  isValidElement,
  useId,
  type ReactElement,
  type ReactNode,
} from "react";
import { PhoneIcon } from "@/components/icons";
import { formatDigits, parseDigits, readbackVnd } from "@/lib/format";

/*
  Primitives dùng chung — chốt chuẩn các atom hay bị copy-paste lệch nhau
  (audit 02). Redesign "Mặt nước" 2026-06-10: thẻ không viền bóng mềm,
  input filled, nút pill — hiện đại nhưng vẫn cho tay ướt mắt kém.
*/

/** Thẻ hiện đại không viền — trắng nổi trên nền mist bằng bóng mềm, bo 20px. */
export function Card({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={`surface ${className}`}>{children}</div>;
}

/** Tiêu đề mục — một cỡ (20px) + padding ngang nhất quán. */
export function SectionHeader({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2
      /* KHÔNG lề ngang mặc định (sửa 2026-10-22, rà Taste "một mép trái"): `px-4` gốc +
         `className="px-0"` truyền vào thì Tailwind không bảo đảm lớp sau thắng — "Món mới về"
         thụt 16px lệch mép lưới. Mọi chỗ gọi đều cần sát mép khối cha. */
      className={`display pb-2 text-[1.125rem] font-semibold text-navy ${className}`}
    >
      {children}
    </h2>
  );
}

/** Nhãn + ô nhập trong form (chốt cỡ chữ nhãn 16px).
 *
 *  `error` (VO-APP-04, 2026-10-25): câu lỗi NGAY DƯỚI ô + viền đỏ ô + `aria-invalid`/
 *  `aria-describedby` — bà con thấy ngay ô nào phải sửa, không phải dò băng đỏ đầu thẻ.
 *  Viền đỏ đi qua `data-invalid` trên label (group) nên ô bọc trong span (PasswordField)
 *  vẫn đỏ; aria chỉ tự gắn được khi con là THẲNG một thẻ input/select/textarea —
 *  ô có bọc thì nơi gọi truyền `errorId` và tự gắn. */
export function Field({
  label,
  error,
  errorId,
  children,
}: {
  label: string;
  /** câu lỗi của riêng ô này; rỗng/undefined = ô bình thường */
  error?: string;
  /** id câu lỗi khi nơi gọi tự gắn aria-describedby (ô có bọc) */
  errorId?: string;
  children: ReactNode;
}) {
  const uid = useId();
  const idLoi = errorId ?? `${uid}-loi`;
  const con =
    error && isValidElement(children) && typeof children.type === "string"
      ? cloneElement(children as ReactElement<Record<string, unknown>>, {
          "aria-invalid": true,
          "aria-describedby": idLoi,
        })
      : children;
  return (
    <label className="group mb-3.5 block" data-invalid={error ? "" : undefined}>
      <span className="mb-1.5 block text-[0.875rem] font-semibold text-navy">
        {label}
      </span>
      {con}
      {error && (
        <span
          id={idLoi}
          role="alert"
          className="mt-1.5 block text-[0.875rem] leading-snug text-danger"
        >
          {error}
        </span>
      )}
    </label>
  );
}

/*  Phần chung của mọi control nhập — kiểu FILLED hiện đại. `group-data-invalid:`
    nhận viền đỏ từ `Field error` (label mang `data-invalid`). */
const ctlBase =
  "w-full rounded-xl border border-line bg-card px-3.5 text-[1rem] focus:outline-none focus:ring-2 focus:ring-sea group-data-invalid:border-danger";

/** Class chuẩn cho ô nhập 1 dòng / select. */
export const inputClass = `h-(--h-ctl) ${ctlBase}`;

/** Class chuẩn cho textarea (2026-10-25): KHÔNG ép `h-(--h-ctl)` (ô 1 dòng từng cắt chữ),
 *  thấp nhất ~2 dòng, tự cao theo chữ bằng `field-sizing: content`; máy chưa có
 *  field-sizing (Safari cũ) thì cao theo `rows` — nơi gọi đặt `rows={2}` làm sàn. */
export const textareaClass = `field-sizing-content min-h-[3.75rem] resize-none py-2.5 leading-snug ${ctlBase}`;

/** Nút chính (cam trim) — bậc nút chính 3.25rem, bo 0.75rem, không bóng (03 §0, 2026-10-19). */
export function PrimaryButton({
  type = "button",
  onClick,
  disabled,
  className = "",
  children,
}: {
  type?: "button" | "submit";
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`display flex h-(--h-cta) w-full items-center justify-center gap-2 rounded-xl bg-trim text-[1rem] font-semibold text-white transition active:scale-[0.98] disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}

/** Ô nhập TIỀN dùng chung (hội đồng UX 2026-06-11): chấm nghìn khi gõ,
 *  cap 12 số, và dòng đọc-lại "= 45 triệu đồng" khi ≥1 triệu — chống lỗi
 *  thừa/thiếu một số 0. State giữ CHUỖI SỐ THÔ qua digits/onDigits. */
export function MoneyField({
  label,
  digits,
  onDigits,
  placeholder,
}: {
  label: string;
  /** chuỗi số thô, vd "45000000" */
  digits: string;
  onDigits: (digits: string) => void;
  placeholder?: string;
}) {
  const value = Number(digits || 0);
  const readback = readbackVnd(value);
  return (
    <Field label={label}>
      <input
        inputMode="numeric"
        value={formatDigits(digits)}
        onChange={(e) => onDigits(parseDigits(e.target.value))}
        className={inputClass}
        placeholder={placeholder}
      />
      {readback && (
        <span className="mt-1 block text-[0.875rem] font-semibold text-navy">
          = {readback}
        </span>
      )}
    </Field>
  );
}

/** Nút GỌI chuẩn (roadmap hội đồng UX 2026-06-11) — một kiểu cho mọi chỗ:
 *  pill xanh biển, icon + chữ, tap ≥48px. Nhận chuỗi nhiều số ("09xx / 09yy")
 *  thì gọi số đầu. KHÔNG tự chế nút gọi chữ trần nữa. */
export function CallButton({
  phone,
  label = "Gọi",
  className = "",
}: {
  phone: string;
  label?: string;
  className?: string;
}) {
  const first = phone.split(/[/,;]| - | hoặc /i)[0] ?? phone;
  return (
    <a
      href={`tel:${first.replace(/[^\d+]/g, "")}`}
      /*  Chiều cao lên sàn 3.5rem (2026-08-29, luật A5): đo thật 80×48px trên
          /tien mục "Bán ở đâu" — dưới sàn. Gọi thương lái là việc chạm-nhiều
          trên bến, tay ướt. Bề ngang px-4 GIỮ NGUYÊN: nhãn "Gọi hỏi mua" /
          "Gọi chào bán" cần chỗ, bóp về w-16 sẽ cắt chữ. */
      className={`inline-flex h-(--h-ctl) min-w-[5.5rem] shrink-0 items-center justify-center gap-1.5 rounded-full bg-sea px-3 text-[0.875rem] font-semibold text-white transition active:scale-[0.97] ${className}`}
    >
      <PhoneIcon className="h-4 w-4" />
      {label}
    </a>
  );
}

/** Trạng thái rỗng — icon + lời nhắc thân thiện, viền đứt KHÔNG nền đặc (03 §0b, rà FB 2026-10-25 X8: 3 kiểu khối trống). */
export function EmptyState({
  icon,
  children,
}: {
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-line px-4 py-8 text-center">
      {icon && <div className="mx-auto mb-3 w-fit text-foreground/65">{icon}</div>}
      <p className="text-[1rem] text-foreground/65">{children}</p>
    </div>
  );
}

/** Dòng ghi chú nguồn / lưu ý "tham khảo" (token màu theo trục truyền vào). */
export function RefNote({
  tone = "var(--warn)",
  bg = "var(--warn-bg)",
  children,
}: {
  tone?: string;
  bg?: string;
  children: ReactNode;
}) {
  return (
    <p
      className="rounded-2xl px-3.5 py-2.5 text-[0.875rem] font-semibold leading-snug"
      style={{ color: tone, backgroundColor: bg }}
    >
      {children}
    </p>
  );
}

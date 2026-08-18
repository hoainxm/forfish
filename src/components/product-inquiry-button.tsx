"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Field, inputClass, PrimaryButton } from "@/components/ui/primitives";
import { apiUrl } from "@/lib/api-base";
import { CheckIcon, PhoneIcon } from "@/components/icons";
import { sanitizePhoneInput } from "@/components/auth-form";
import { timeoutSignal } from "@/lib/abort";
import {
  classifySendFailure,
  sendFailureText,
  type SendFailure,
} from "@/lib/send-error";
import { SDVICO_HOTLINE_DISPLAY } from "@/data/sdvico-showcase";

/*
  "Để lại yêu cầu" — hỏi mua/tư vấn cho sản phẩm của ĐƠN VỊ NGOÀI SDWork
  (2026-07-28, Phase 2). Sản phẩm SDVICO vẫn dùng SdvicoRequestButton → CRM
  (kênh bán hàng đang chạy thật, không đụng). Đây phục vụ cái GAP: sản phẩm
  ngoài trước đây chỉ hiện SĐT, giờ bà con để lại số + lời nhắn, admin xử
  lý ở /quan-tri tab "Yêu cầu" (bảng product_inquiries, KHÔNG qua CRM).
*/

export function ProductInquiryButton({
  listingId,
  listingTitle,
  vendorKind = "external",
  vendorName,
}: {
  listingId: string;
  listingTitle: string;
  vendorKind?: "sdvico" | "external";
  /** tên đơn vị ngoài — để câu lỗi/câu xong gọi ĐÚNG TÊN, không đổ hết cho SDVICO */
  vendorName?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-[3rem] shrink-0 items-center gap-1.5 rounded-full bg-navy px-4 text-[0.9375rem] font-bold text-white transition active:scale-[0.97]"
      >
        <PhoneIcon className="h-4 w-4" />
        Để lại yêu cầu
      </button>
      {open && (
        <InquiryForm
          listingId={listingId}
          listingTitle={listingTitle}
          vendorKind={vendorKind}
          vendorName={vendorName}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function InquiryForm({
  listingId,
  listingTitle,
  vendorKind,
  vendorName,
  onClose,
}: {
  listingId: string;
  listingTitle: string;
  vendorKind: "sdvico" | "external";
  vendorName?: string;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">(
    "idle",
  );
  /** vì sao chưa gửi được — TÁCH NHÁNH (audit 2026-08-18 G2), không đổ hết cho SĐT */
  const [failure, setFailure] = useState<SendFailure | null>(null);

  // Đơn vị nhận yêu cầu: SDVICO thì kèm hotline; đơn vị ngoài gọi đúng tên
  // (yêu cầu vào /quan-tri, admin chuyển tiếp — nhưng bà con cần biết ai bán).
  const unit =
    vendorKind === "external" && vendorName?.trim()
      ? vendorName.trim()
      : `SDVICO ${SDVICO_HOTLINE_DISPLAY}`;

  function fail(kind: SendFailure) {
    setFailure(kind);
    setState("error");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const sdt = classifySendFailure({
      phoneDigits: phone,
      threw: false,
      offline: false,
      ok: true,
    });
    if (sdt) return fail(sdt);
    setFailure(null);
    setState("sending");
    let threw = false;
    let ok = false;
    try {
      const r = await fetch(apiUrl("/api/product-inquiries"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId,
          listingTitle,
          vendorKind,
          phone: phone.trim(),
          name: name.trim(),
          message: message.trim(),
        }),
        signal: timeoutSignal(20000),
      });
      const j = await r.json().catch(() => null);
      ok = j?.ok === true;
    } catch {
      threw = true; // mất sóng / hết giờ chờ
    }
    const kind = classifySendFailure({
      phoneDigits: phone,
      threw,
      offline: typeof navigator !== "undefined" && navigator.onLine === false,
      ok,
    });
    if (kind) return fail(kind);
    setState("done");
  }

  if (state === "done") {
    return (
      <BottomSheet title="Đã gửi yêu cầu" onClose={onClose}>
        <div
          className="rounded-[1.25rem] px-4 py-8 text-center"
          style={{ backgroundColor: "var(--ok-bg)", color: "var(--ok)" }}
        >
          <CheckIcon className="mx-auto h-10 w-10" />
          <p className="mt-3 text-[1.125rem] font-bold">Đã ghi nhận yêu cầu</p>
          <p className="mt-1 text-[1rem] text-foreground/70">
            {vendorKind === "external" && vendorName?.trim()
              ? `Yêu cầu về hàng của ${vendorName.trim()} đã ghi nhận — sẽ có người gọi lại sớm nhất có thể.`
              : "SDVICO sẽ xem và liên hệ lại sớm nhất có thể."}
          </p>
        </div>
        <div className="mt-4">
          <PrimaryButton onClick={onClose}>Xong</PrimaryButton>
        </div>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet title="Để lại yêu cầu" onClose={onClose}>
      <form onSubmit={submit}>
        <p className="mb-3 rounded-2xl bg-field px-3.5 py-2.5 text-[1rem] font-semibold text-navy">
          Về: {listingTitle}
        </p>
        <Field label="Số điện thoại (bắt buộc — để gọi lại)">
          <input
            value={phone}
            onChange={(e) => setPhone(sanitizePhoneInput(e.target.value))}
            className={inputClass}
            inputMode="tel"
            placeholder="VD: 0901234567"
            required
          />
        </Field>
        <Field label="Tên bà con (tuỳ chọn)">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="VD: anh Hai"
          />
        </Field>
        <Field label="Cần hỏi gì (tuỳ chọn)">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
            className={inputClass}
            placeholder="VD: còn hàng không, giá bao nhiêu"
          />
        </Field>

        {state === "error" && failure && (
          <p
            role="alert"
            className="mb-3 rounded-2xl px-3.5 py-3 text-[1rem] font-semibold"
            style={{ color: "var(--danger)", backgroundColor: "var(--danger-bg)" }}
          >
            {sendFailureText(failure, unit)}
          </p>
        )}

        <div className="mt-2 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[3.75rem] rounded-full bg-field text-[1.125rem] font-bold text-foreground/70"
          >
            Hủy
          </button>
          <PrimaryButton type="submit" disabled={state === "sending"}>
            {state === "sending" ? "Đang gửi…" : "Gửi yêu cầu"}
          </PrimaryButton>
        </div>
      </form>
    </BottomSheet>
  );
}

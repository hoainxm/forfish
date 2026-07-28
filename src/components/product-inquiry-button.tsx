"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Field, inputClass, PrimaryButton } from "@/components/ui/primitives";
import { apiUrl } from "@/lib/api-base";
import { CheckIcon, PhoneIcon } from "@/components/icons";
import { sanitizePhoneInput } from "@/components/auth-form";

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
}: {
  listingId: string;
  listingTitle: string;
  vendorKind?: "sdvico" | "external";
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
  onClose,
}: {
  listingId: string;
  listingTitle: string;
  vendorKind: "sdvico" | "external";
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">(
    "idle",
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (phone.replace(/\D/g, "").length < 9) {
      setState("error");
      return;
    }
    setState("sending");
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
        signal: AbortSignal.timeout(20000),
      });
      const j = await r.json().catch(() => null);
      setState(j?.ok ? "done" : "error");
    } catch {
      setState("error");
    }
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
            SDVICO sẽ xem và liên hệ lại sớm nhất có thể.
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

        {state === "error" && (
          <p
            role="alert"
            className="mb-3 rounded-2xl px-3.5 py-3 text-[1rem] font-semibold"
            style={{ color: "var(--danger)", backgroundColor: "var(--danger-bg)" }}
          >
            Nhập đúng số điện thoại rồi thử lại.
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

"use client";

// /ban-hang/dang-ky — ĐĂNG KÝ GIAN HÀNG (11 §6.1).
// Ghi là online-only (11 §9): mất sóng ⇒ nút vô hiệu + nói thẳng, KHÔNG xoá
// nội dung đang gõ. Shop cũ bị từ chối ⇒ form điền sẵn + băng lý do, gửi lại là
// CÙNG shop (route POST tự lo, 11 §6.1) — không đẻ shop thứ hai cho một SĐT.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CallButton, PrimaryButton } from "@/components/ui/primitives";
import { StatusBanner } from "@/components/ui/status-banner";
import { SDVICO_HOTLINE } from "@/data/sdvico-showcase";
import { marketPost } from "@/lib/market/client";
import { saveShopFlag } from "@/lib/market/seller-flag";
import type { Shop } from "@/lib/market/types";
import { validateShopDraft } from "@/lib/market/validate";
import { useAuthUser } from "@/lib/use-auth";
import { useOnline } from "@/lib/use-online";
import { LoadView, marketErrorText, useMyShop } from "./seller-net";
import { focusField } from "./ui";
import {
  emptyShopForm, ShopForm, shopDraftOf, shopFieldDomId, shopFieldOfError, shopFormFrom,
  type ShopFormValue,
} from "./shop-form";

export function ShopRegister() {
  const { state, reload } = useMyShop();
  return (
    <LoadView state={state} what="đăng ký gian hàng" onRetry={reload}>
      {(d) => <RegisterInner shop={d.shop} />}
    </LoadView>
  );
}

function RegisterInner({ shop }: { shop: Shop | null }) {
  const router = useRouter();
  const online = useOnline();
  const { phone } = useAuthUser();
  const resend = shop?.status === "tu_choi" ? shop : null;
  const [form, setForm] = useState<ShopFormValue>(() =>
    resend ? shopFormFrom(resend) : emptyShopForm(phone),
  );
  const [error, setError] = useState<string | null>(null);
  const [serverNote, setServerNote] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  /*  Đã có shop (khác `tu_choi`) thì đây không phải màn của bà con — về Tổng
      quan, không bày form đăng ký lần hai (R1: 1 SĐT = 1 shop). */
  useEffect(() => {
    if (shop && shop.status !== "tu_choi") router.replace("/ban-hang");
  }, [shop, router]);

  /*  ĐIỀN SẴN SĐT liên hệ (11 §6.1). `useAuthUser().phone` đọc danh tính TRONG
      effect nên lần render đầu là null ⇒ `emptyShopForm(phone)` ở useState chỉ
      chạy một lần và không bao giờ thấy SĐT (bug QA 2026-09-06). Chép vào khi
      SĐT về và ô còn trống — không đè thứ bà con đã gõ. */
  useEffect(() => {
    if (!phone) return;
    setForm((f) => (f.phone.trim() ? f : { ...f, phone }));
  }, [phone]);

  function fail(msg: string) {
    setError(msg);
    focusField(shopFieldDomId(shopFieldOfError(msg)));
  }

  async function submit() {
    if (sending) return; // chống bấm đúp
    const draft = shopDraftOf(form);
    const err = validateShopDraft(draft);
    if (err) return fail(err);
    setError(null);
    setSending(true);
    const res = await marketPost<{ shop: Shop }>("/api/ban-hang/shop", draft);
    setSending(false);
    if (res.ok) {
      saveShopFlag(phone, { hasShop: true, status: res.data.shop.status, at: Date.now() });
      /*  BIÊN NHẬN: trước đây nhảy thẳng về Tổng quan, không một lời. Bà con
          vừa gõ 8 ô cho việc một-lần-trong-đời mà màn đổi trang câm là tưởng
          hỏng, gõ lại lần nữa. Băng "chờ duyệt" ở Tổng quan là MÔ TẢ TRẠNG
          THÁI, không thay được lời xác nhận "đã gửi". */
      router.replace("/ban-hang?dk=xong");
      return;
    }
    if (res.offline) {
      setError(null);
      return setServerNote("Chưa gửi được — máy đang không có sóng. Nội dung vẫn ở trên màn.");
    }
    // Đã có shop rồi (409 invalid) ⇒ đưa thẳng vào shop đang có, không bắt gõ lại.
    if (res.code === "invalid" && res.status === 409) {
      router.replace("/ban-hang");
      return;
    }
    if (res.code === "slug_taken") return fail("Tên shop này đã có người dùng — chọn tên khác.");
    if (res.code === "invalid" && res.message) return fail(res.message);
    setServerNote(marketErrorText(res));
  }

  return (
    <div className="pb-10">
      {resend && (
        <div className="mb-4 overflow-hidden">
          <StatusBanner level="danger">
            Lần trước SDVICO chưa duyệt: {resend.statusNote ?? "không ghi lý do"}. Sửa lại rồi gửi lần nữa.
          </StatusBanner>
        </div>
      )}

      <ShopForm value={form} onChange={setForm} error={error} />

      {serverNote && (
        <p className="mx-4 mb-3 rounded-2xl px-3.5 py-2.5 text-[1rem] font-semibold" role="alert"
          style={{ backgroundColor: "var(--danger-bg)", color: "var(--danger)" }}>
          {serverNote}
        </p>
      )}

      <div className="px-4">
        {/*  Nút chính DUY NHẤT của màn ⇒ được full-width (ngoại lệ đã chốt,
            03 §"Nút hành động" mục 0). */}
        <PrimaryButton onClick={() => void submit()} disabled={sending || !online}>
          {sending ? "Đang gửi…" : resend ? "Gửi lại đăng ký" : "Gửi đăng ký"}
        </PrimaryButton>
        {!online && (
          <p className="mt-2 text-center text-[1rem] font-semibold" style={{ color: "var(--danger)" }}>
            Đăng ký cần có sóng.
          </p>
        )}
        <p className="mt-3 text-[1rem] leading-snug text-foreground/70">
          SDVICO duyệt trong 1–2 ngày làm việc, có thể gọi xác minh. Logo shop thêm sau ở Cài đặt shop.
        </p>
        <div className="mt-3 flex justify-center">
          <CallButton phone={SDVICO_HOTLINE} label="Gọi SDVICO" />
        </div>
      </div>
    </div>
  );
}

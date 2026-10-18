"use client";

// /ban-hang/cai-dat — CÀI ĐẶT SHOP (11 §6.6). Cùng bộ ô với màn đăng ký, điền
// sẵn, thêm logo và công tắc "Tạm nghỉ bán" (`paused` — LEAD §4 #8: món vẫn
// hiện trên chợ, bà con KHÔNG đặt được). Không có nút xoá shop — gọi SDVICO.
import { useState } from "react";
import { ImagePicker } from "@/components/market/shared/image-picker";
import { CallButton, PrimaryButton } from "@/components/ui/primitives";
import { StatusBanner } from "@/components/ui/status-banner";
import { SDVICO_HOTLINE } from "@/data/sdvico-showcase";
import { marketSend, marketUpload } from "@/lib/market/client";
import type { Shop } from "@/lib/market/types";
import { validateShopDraft } from "@/lib/market/validate";
import { useOnline } from "@/lib/use-online";
import { LoadView, marketErrorText, useInlineNote, useMyShop } from "./seller-net";
import { focusField } from "./ui";
import {
  ShopForm, shopDraftOf, shopFieldDomId, shopFieldOfError, shopFormFrom, type ShopFormValue,
} from "./shop-form";

export function ShopSettings() {
  const { state, reload, set } = useMyShop();
  return (
    <LoadView state={state} what="cài đặt shop" onRetry={reload}>
      {(d) =>
        d.shop ? (
          <Inner shop={d.shop} onShop={set} />
        ) : (
          <p className="px-4 py-8 text-center text-[1.125rem] text-foreground/70">
            Chưa có gian hàng để cài đặt — đăng ký shop trước đã.
          </p>
        )
      }
    </LoadView>
  );
}

function Inner({ shop, onShop }: { shop: Shop; onShop: (s: Shop) => void }) {
  const online = useOnline();
  const [form, setForm] = useState<ShopFormValue>(() => shopFormFrom(shop));
  const [paused, setPaused] = useState(shop.paused);
  const [error, setError] = useState<string | null>(null);
  const note = useInlineNote();
  const [saving, setSaving] = useState(false);

  async function upload(blob: Blob): Promise<string> {
    const res = await marketUpload("/api/ban-hang/upload", blob);
    if (res.ok) return res.data.url;
    throw new Error(marketErrorText(res));
  }

  async function save() {
    if (saving) return; // chống bấm đúp
    const draft = shopDraftOf(form);
    const err = validateShopDraft(draft);
    if (err) {
      setError(err);
      focusField(shopFieldDomId(shopFieldOfError(err)));
      return;
    }
    setError(null);
    setSaving(true);
    const res = await marketSend<{ shop: Shop }>("PATCH", "/api/ban-hang/shop", { ...draft, paused });
    setSaving(false);
    if (res.ok) {
      onShop(res.data.shop);
      setForm(shopFormFrom(res.data.shop));
      setPaused(res.data.shop.paused);
      note.show("Đã lưu cài đặt shop.");
      return;
    }
    if (res.code === "slug_taken") {
      setError("Tên shop này đã có người dùng — chọn tên khác.");
      return;
    }
    note.show(res.offline ? "Chưa lưu được — cần sóng. Nội dung vẫn ở trên màn." : marketErrorText(res), "danger");
  }

  const hasBank = !!form.bankAccount.trim();

  return (
    <div className="pb-10">
      {shop.status === "tam_khoa" && (
        <div className="mb-3 overflow-hidden">
          <StatusBanner level="danger">
            Shop đang bị tạm khoá: {shop.statusNote ?? "không ghi lý do"}. Gọi SDVICO để mở lại.
          </StatusBanner>
        </div>
      )}
      {note.node}

      <div className="px-4">
        <label className="mb-4 flex min-h-[3.5rem] items-center justify-between gap-3 rounded-2xl px-4 py-2"
          style={paused ? { backgroundColor: "var(--warn-bg)" } : { backgroundColor: "var(--field)" }}>
          <span className="min-w-0">
            <span className="block text-[1.125rem] font-bold" style={{ color: paused ? "var(--warn)" : "var(--navy)" }}>
              Tạm nghỉ bán
            </span>
            <span className="block text-[0.9375rem] leading-snug text-foreground/70">
              Món vẫn hiện trên cửa hàng nhưng bà con không đặt được. Nhớ bấm Lưu.
            </span>
          </span>
          <input type="checkbox" className="h-7 w-7 shrink-0" checked={paused} onChange={(e) => setPaused(e.target.checked)} />
        </label>
      </div>

      <ShopForm
        value={form}
        onChange={setForm}
        error={error}
        logoSlot={
          <ImagePicker
            value={form.logoUrl ? [form.logoUrl] : []}
            onChange={(urls) => setForm({ ...form, logoUrl: urls[0] ?? "" })}
            max={1}
            upload={upload}
            label="Logo shop"
          />
        }
      />

      <div className="px-4">
        {!hasBank && (
          <p className="mb-3 rounded-2xl px-3.5 py-2.5 text-[1rem] font-semibold"
            style={{ backgroundColor: "var(--warn-bg)", color: "var(--warn)" }}>
            Shop chưa có số tài khoản — bà con chỉ trả được tiền mặt khi nhận hàng.
          </p>
        )}
        {/* Nút chính DUY NHẤT của màn ⇒ full-width (ngoại lệ 03 §Nút hành động mục 0). */}
        <PrimaryButton onClick={() => void save()} disabled={saving}>
          {saving ? "Đang lưu…" : "Lưu cài đặt"}
        </PrimaryButton>
        {!online && (
          <p className="mt-2 text-center text-[1rem] font-bold" style={{ color: "var(--danger)" }}>
            Lưu cần có sóng — nội dung vẫn ở trên màn.
          </p>
        )}
        <p className="mt-3 text-[1rem] leading-snug text-foreground/70">
          Muốn đóng hẳn gian hàng thì gọi SDVICO, app không tự xoá shop.
        </p>
        <div className="mt-3 flex justify-center">
          <CallButton phone={SDVICO_HOTLINE} label="Gọi SDVICO" />
        </div>
      </div>
    </div>
  );
}

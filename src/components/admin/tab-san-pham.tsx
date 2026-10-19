"use client";

/*  Tách nguyên văn khỏi src/app/quan-tri/page.tsx (2026-10-19, rà Codex đợt 3: trang quản trị 6.718 dòng
    — tách theo tab, KHÔNG đổi hành vi; trang chính nạp tab khi mở). */

import { AdminSkeleton } from "@/components/admin/admin-nav";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { apiUrl } from "@/lib/api-base";
import { CATALOG_GROUPS, GROUP_LABELS, groupLabel, type CatalogGroupId } from "@/lib/catalog-groups";
import { tokenHeader } from "@/lib/device-token-store";
import { formatVnd } from "@/lib/format";
import { buildDetail, specsToText, type ProductDetail } from "@/lib/product-catalog";
import { type TabPerms } from "@/lib/staff-permissions";
import { useCallback, useEffect, useState } from "react";

/* ── SẢN PHẨM (danh mục tab Sản phẩm /tau) ────────────────────────────────
   Admin ẩn/hiện/xóa/thêm sản phẩm — kể cả đơn vị NGOÀI SDWork (vendor_name +
   liên hệ riêng). Áp dụng NGAY cho app (client đọc thẳng bảng), không cần
   build lại app. */

export type VendorKind = "sdvico" | "external";

export type ProductRow = {
  id: string;
  vendorKind: VendorKind;
  vendorName: string | null;
  title: string;
  category: string | null;
  description: string | null;
  features: string[];
  detail?: ProductDetail | null;
  priceText: string | null;
  imageUrl: string | null;
  contactPhone: string | null;
  contactNote: string | null;
  line: string | null;
  group: string | null;
  priceVnd: number | null;
  unit: string | null;
  orderable: boolean;
  visible: boolean;
  sortOrder: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export function ProductsTab({ perms }: { perms: TabPerms }) {
  const [rows, setRows] = useState<ProductRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<ProductRow | "new" | null>(null);
  const [toDelete, setToDelete] = useState<ProductRow | null>(null);

  const load = useCallback(() => {
    setError(null);
    fetch(apiUrl("/api/admin/products"), { headers: tokenHeader() })
      .then(async (r) => {
        const j = (await r.json()) as {
          ok: boolean;
          code?: string;
          listings?: ProductRow[];
        };
        if (!j.ok) throw new Error(j.code ?? "load");
        setRows(j.listings ?? []);
      })
      .catch((e: Error) =>
        setError(
          e.message === "not_configured"
            ? "Chưa kết nối được cơ sở dữ liệu (Supabase). Tính năng này không chạy ở chế độ dùng thử."
            : "Chưa tải được danh mục. Vui lòng thử lại.",
        ),
      );
  }, []);
  useEffect(load, [load]);

  async function toggleVisible(row: ProductRow) {
    setBusyId(row.id);
    const r = await fetch(apiUrl("/api/admin/products"), {
      method: "PATCH",
      headers: { "content-type": "application/json", ...tokenHeader() },
      body: JSON.stringify({ id: row.id, visible: !row.visible }),
    }).catch(() => null);
    setBusyId(null);
    if (!r?.ok) {
      setError("Cập nhật trạng thái không thành công. Vui lòng thử lại.");
      return;
    }
    load();
  }

  async function remove(row: ProductRow) {
    setBusyId(row.id);
    const r = await fetch(
      apiUrl(`/api/admin/products?id=${encodeURIComponent(row.id)}`),
      { method: "DELETE", headers: tokenHeader() },
    ).catch(() => null);
    setBusyId(null);
    if (!r?.ok) {
      setError("Xóa không thành công. Vui lòng thử lại.");
      return;
    }
    load();
  }

  return (
    <div className="mt-4 space-y-4">
      {/*  ĐÃ NGHỈ (2026-09-07, ADR 0014) — nói TRƯỚC mọi thứ khác, bằng màu
           cảnh báo. Màn "Cửa hàng" cũ trong app ngư dân đã gộp vào Cửa hàng (chợ chung), app
           KHÔNG còn đọc bảng này nữa: sửa ở đây mà tưởng bà con thấy ngay là
           hiểu sai, và cái sai đó chỉ lộ ra khi khách gọi hỏi sao không thấy
           hàng. Màn giữ lại để tra hàng cũ, chưa gỡ vì còn chờ chốt phân quyền
           cho tài khoản quản lý (xem ADR 0014 mục "Việc còn mở"). */}
      <div className="surface border-l-4 px-4 py-3" style={{ borderColor: "var(--warn)" }}>
        <p className="text-[0.9375rem] font-bold text-navy">
          Danh mục này ĐÃ NGHỈ — app ngư dân không còn đọc.
        </p>
        <p className="mt-1 text-[0.875rem] leading-snug text-foreground/70">
          Từ 07/09/2026 màn &quot;Cửa hàng&quot; cũ trong app đã gộp vào <b>Cửa hàng</b> (chợ chung):
          hàng SDVICO nay nằm ở gian hàng SDVICO trên chợ. Thêm/sửa/ẩn ở màn này
          <b> KHÔNG hiện ra với bà con nữa</b> — muốn đổi hàng đang bán thì sang
          tab <b>Cửa hàng → Sản phẩm</b>. Màn này giữ lại chỉ để tra hàng cũ.
        </p>
      </div>

      {perms.create && (
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="min-h-[2.75rem] w-full rounded-xl bg-trim text-[0.9375rem] font-bold text-white sm:w-auto sm:px-6"
        >
          + Thêm sản phẩm
        </button>
      )}

      {error && (
        <div className="surface px-4 py-6 text-center">
          <p className="text-[1rem] text-danger">{error}</p>
          <button
            type="button"
            onClick={load}
            className="mt-3 min-h-[2.75rem] rounded-xl bg-navy px-6 text-[0.9375rem] font-bold text-white"
          >
            Thử lại
          </button>
        </div>
      )}
      {!rows && !error && (
        <AdminSkeleton label="Đang tải danh mục…" />
      )}
      {rows && rows.length === 0 && (
        <p className="surface px-4 py-8 text-center text-[1rem] text-foreground/65">
          Chưa có sản phẩm nào — bấm nút trên để thêm.
        </p>
      )}

      {rows && rows.length > 0 && (
        <ul className="surface overflow-hidden">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-line px-4 py-3 last:border-b-0"
            >
              <div className="min-w-0 flex-1 basis-[240px]">
                <p className="text-[1rem] font-bold text-navy">
                  {row.title}
                  {row.vendorKind === "external" && (
                    <span className="ml-2 rounded-full bg-t3/15 px-2 py-0.5 text-[0.75rem] font-bold text-t3">
                      {row.vendorName ?? "Đơn vị bên ngoài"}
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-[0.8125rem] text-foreground/60">
                  {row.category ?? "Chưa phân loại"} ·{" "}
                  {row.visible ? "đang hiển thị" : "ĐANG ẨN"}
                  {row.orderable &&
                    row.priceVnd != null &&
                    ` · cho đặt ${groupLabel(row.group)} · ${formatVnd(row.priceVnd)}${
                      row.unit ? `/${row.unit}` : ""
                    }`}
                  {row.createdBy && ` · cập nhật gần nhất bởi ${row.createdBy}`}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-3 py-1 text-[0.8125rem] font-bold ${
                  row.visible
                    ? "bg-ok-bg text-ok"
                    : "bg-field text-foreground/65"
                }`}
              >
                {row.visible ? "Hiển thị" : "Ẩn"}
              </span>
              <div className="flex shrink-0 gap-1.5">
                {perms.edit && (
                  <>
                    <button
                      type="button"
                      disabled={busyId === row.id}
                      onClick={() => toggleVisible(row)}
                      className="min-h-[2.5rem] rounded-lg bg-field px-3 text-[0.8125rem] font-bold text-navy disabled:opacity-50"
                    >
                      {row.visible ? "Chọn ẩn" : "Chọn hiển thị"}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === row.id}
                      onClick={() => setEditing(row)}
                      className="min-h-[2.5rem] rounded-lg bg-field px-3 text-[0.8125rem] font-bold text-navy disabled:opacity-50"
                    >
                      Sửa
                    </button>
                  </>
                )}
                {perms.delete && (
                  <button
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() => setToDelete(row)}
                    className="min-h-[2.5rem] rounded-lg bg-danger-bg px-3 text-[0.8125rem] font-bold text-danger disabled:opacity-50"
                  >
                    Xóa
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <ProductForm
          initial={editing === "new" ? null : editing}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}

      {toDelete && (
        <ConfirmDialog
          title={`Xác nhận xóa sản phẩm "${toDelete.title}" khỏi danh mục?`}
          message="Sản phẩm sẽ biến mất khỏi tab Sản phẩm của khách hàng ngay lập tức. Thao tác này không thể khôi phục."
          confirmLabel="Xác nhận xóa"
          cancelLabel="Hủy thao tác"
          danger
          onCancel={() => setToDelete(null)}
          onConfirm={() => {
            const row = toDelete;
            setToDelete(null);
            remove(row);
          }}
        />
      )}
    </div>
  );
}

export function ProductForm({
  initial,
  onCancel,
  onSaved,
}: {
  initial: ProductRow | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [vendorKind, setVendorKind] = useState<VendorKind>(
    initial?.vendorKind ?? "sdvico",
  );
  const [vendorName, setVendorName] = useState(initial?.vendorName ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [features, setFeatures] = useState(
    (initial?.features ?? []).join("\n"),
  );
  const [priceText, setPriceText] = useState(initial?.priceText ?? "");
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");
  const [contactPhone, setContactPhone] = useState(
    initial?.contactPhone ?? "",
  );
  const [contactNote, setContactNote] = useState(initial?.contactNote ?? "");
  // ── ĐẶT HÀNG (0032) — cho đặt / nhóm / giá số / đơn vị ─────────────────────
  const [orderable, setOrderable] = useState(initial?.orderable ?? false);
  const [group, setGroup] = useState<CatalogGroupId | "">(
    initial?.group && (CATALOG_GROUPS as readonly string[]).includes(initial.group)
      ? (initial.group as CatalogGroupId)
      : "",
  );
  const [priceVnd, setPriceVnd] = useState(
    initial?.priceVnd != null ? String(initial.priceVnd) : "",
  );
  const [unit, setUnit] = useState(initial?.unit ?? "");
  // ── CHI TIẾT sản phẩm (hiện trong sheet "Xem chi tiết") ────────────────────
  const initDetail = initial?.detail ?? undefined;
  const [showDetail, setShowDetail] = useState(false);
  const [dModels, setDModels] = useState(initDetail?.models ?? "");
  const [dMaker, setDMaker] = useState(initDetail?.maker ?? "");
  const [dForWho, setDForWho] = useState(initDetail?.forWho ?? "");
  const [dBenefits, setDBenefits] = useState(
    (initDetail?.benefits ?? []).join("\n"),
  );
  const [dSpecs, setDSpecs] = useState(specsToText(initDetail?.specs));
  const [dVariant, setDVariant] = useState(initDetail?.variant ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    // Kiểm nhẹ phía UI khi bật "Cho đặt hàng" (server còn chốt lại lần nữa).
    const priceNum = parseInt(priceVnd.replace(/\D/g, ""), 10) || 0;
    if (orderable) {
      if (priceNum <= 0) {
        setMsg("Để cho phép đặt hàng, giá tiền (VND) phải lớn hơn 0.");
        return;
      }
      if (!unit.trim()) {
        setMsg("Vui lòng nhập đơn vị tính (kg, lít, thùng, cái…).");
        return;
      }
      if (!group) {
        setMsg("Chọn nhóm phân loại (điện tử / cơ điện / nhu yếu phẩm).");
        return;
      }
    }
    setBusy(true);
    setMsg(null);
    const body = {
      id: initial?.id,
      vendorKind,
      vendorName: vendorName.trim() || undefined,
      title: title.trim(),
      category: category.trim() || undefined,
      description: description.trim() || undefined,
      features: features
        .split("\n")
        .map((f) => f.trim())
        .filter(Boolean),
      detail: buildDetail({
        models: dModels,
        maker: dMaker,
        forWho: dForWho,
        benefitsText: dBenefits,
        specsText: dSpecs,
        variant: dVariant,
      }),
      priceText: priceText.trim() || undefined,
      imageUrl: imageUrl.trim() || undefined,
      contactPhone: contactPhone.trim() || undefined,
      contactNote: contactNote.trim() || undefined,
      orderable,
      group: group || undefined,
      priceVnd: orderable ? priceNum : undefined,
      unit: orderable ? unit.trim() || undefined : undefined,
      visible: initial?.visible ?? true,
    };
    const r = await fetch(apiUrl("/api/admin/products"), {
      method: initial ? "PATCH" : "POST",
      headers: { "content-type": "application/json", ...tokenHeader() },
      body: JSON.stringify(body),
    }).catch(() => null);
    setBusy(false);
    const j = (await r?.json().catch(() => null)) as {
      ok?: boolean;
      code?: string;
    } | null;
    if (!r?.ok || !j?.ok) {
      setMsg(
        j?.code === "invalid_draft"
          ? "Vui lòng nhập Tên sản phẩm, hoặc Tên đơn vị/Liên hệ (đối với đối tác ngoài)."
          : "Lưu thông tin không thành công. Vui lòng thử lại.",
      );
      return;
    }
    onSaved();
  }

  const field =
    "min-h-[2.75rem] w-full rounded-xl border-0 bg-field px-3 text-[0.9375rem] font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-sea";

  return (
    <div className="surface px-4 py-3.5">
      <p className="mb-3 text-[1rem] font-bold text-navy">
        {initial ? `Chỉnh sửa "${initial.title}"` : "Thêm sản phẩm mới"}
      </p>
      <form onSubmit={submit} className="space-y-2.5">
        <div
          className="grid grid-cols-2 gap-1.5"
          role="group"
          aria-label="Nguồn cung cấp"
        >
          {(
            [
              ["sdvico", "SDVICO"],
              ["external", "Đơn vị đối tác ngoài"],
            ] as [VendorKind, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setVendorKind(id)}
              aria-pressed={vendorKind === id}
              className={`min-h-[2.75rem] rounded-xl px-3 text-[0.875rem] font-bold transition ${
                vendorKind === id
                  ? "bg-navy text-white shadow-sm"
                  : "bg-field text-foreground/70"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {vendorKind === "external" && (
          <input
            placeholder="Tên đơn vị cung cấp (bắt buộc — VD: Cơ sở lưới Vũng Tàu)"
            value={vendorName}
            onChange={(e) => setVendorName(e.target.value)}
            className={field}
          />
        )}

        <input
          required
          placeholder="Tên sản phẩm/dịch vụ"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={field}
        />
        <input
          placeholder="Phân loại (VD: Máy lọc nước biển)"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={field}
        />
        <textarea
          placeholder="Mô tả ngắn gọn"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="min-h-[3.5rem] w-full rounded-xl border-0 bg-field px-3 py-2 text-[0.875rem] focus:bg-card focus:outline-none focus:ring-2 focus:ring-sea"
        />
        <textarea
          placeholder={"Tính năng nổi bật — mỗi dòng một ý"}
          value={features}
          onChange={(e) => setFeatures(e.target.value)}
          rows={3}
          className="min-h-[3.5rem] w-full rounded-xl border-0 bg-field px-3 py-2 text-[0.875rem] focus:bg-card focus:outline-none focus:ring-2 focus:ring-sea"
        />
        <div className="grid gap-2.5 sm:grid-cols-2">
          <input
            placeholder="Giá tham khảo (tuỳ chọn)"
            value={priceText}
            onChange={(e) => setPriceText(e.target.value)}
            className={field}
          />
          <input
            placeholder="Đường dẫn ảnh minh họa (tuỳ chọn)"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            className={field}
          />
        </div>
        {vendorKind === "external" && (
          <div className="grid gap-2.5 sm:grid-cols-2">
            <input
              inputMode="tel"
              placeholder="Số điện thoại liên hệ"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              className={field}
            />
            <input
              placeholder="Ghi chú thêm về thông tin liên hệ (địa chỉ, khu vực…)"
              value={contactNote}
              onChange={(e) => setContactNote(e.target.value)}
              className={field}
            />
          </div>
        )}

        {/* ── CHO ĐẶT HÀNG (0032) ─────────────────────────────────────────── */}
        <div className="rounded-xl bg-field/60 px-3 py-3">
          <button
            type="button"
            role="switch"
            aria-checked={orderable}
            onClick={() => setOrderable((v) => !v)}
            className="flex w-full items-center justify-between gap-3 text-left"
          >
            <span className="min-w-0">
              <span className="block text-[0.9375rem] font-bold text-navy">
                Cho đặt hàng
              </span>
              <span className="block text-[0.8125rem] leading-snug text-foreground/60">
                Hiện nút &ldquo;Thêm vào giỏ&rdquo; cho bà con — cần nhóm, giá số và đơn vị.
              </span>
            </span>
            <span
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition ${
                orderable ? "bg-trim" : "bg-line"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                  orderable ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </span>
          </button>

          {orderable && (
            <div className="mt-3 space-y-2.5">
              <div
                className="grid grid-cols-3 gap-1.5"
                role="group"
                aria-label="Thuộc nhóm hàng"
              >
                {CATALOG_GROUPS.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGroup(g)}
                    aria-pressed={group === g}
                    className={`min-h-[2.75rem] rounded-xl px-2 text-[0.8125rem] font-bold transition ${
                      group === g
                        ? "bg-navy text-white shadow-sm"
                        : "bg-field text-foreground/70"
                    }`}
                  >
                    {GROUP_LABELS[g]}
                  </button>
                ))}
              </div>
              <div className="grid gap-2.5 sm:grid-cols-2">
                <input
                  inputMode="numeric"
                  placeholder="Mức giá (VND) — VD: 250000"
                  value={priceVnd}
                  onChange={(e) =>
                    setPriceVnd(e.target.value.replace(/\D/g, "").slice(0, 12))
                  }
                  className={field}
                />
                <input
                  placeholder="Đơn vị tính (kg, lít, thùng, cái…)"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className={field}
                />
              </div>
            </div>
          )}
        </div>

        {/* ── CHI TIẾT SẢN PHẨM (sheet "Xem chi tiết") ─────────────────────── */}
        <div className="rounded-xl bg-field/60 px-3 py-3">
          <button
            type="button"
            onClick={() => setShowDetail((v) => !v)}
            aria-expanded={showDetail}
            className="flex w-full items-center justify-between gap-3 text-left"
          >
            <span className="min-w-0">
              <span className="block text-[0.9375rem] font-bold text-navy">
                Chi tiết sản phẩm
              </span>
              <span className="block text-[0.8125rem] leading-snug text-foreground/60">
                Thông số, đối tượng, biến thể — hiện khi bà con bấm &ldquo;Xem chi tiết&rdquo;.
              </span>
            </span>
            <span className="shrink-0 text-[0.8125rem] font-bold text-sea">
              {showDetail ? "Thu gọn" : "Mở rộng"}
            </span>
          </button>

          {showDetail && (
            <div className="mt-3 space-y-2.5">
              <input
                placeholder="Mã sản phẩm / phiên bản (VD: SF50 bản cơ, SF300B bản điện)"
                value={dModels}
                onChange={(e) => setDModels(e.target.value)}
                className={field}
              />
              <input
                placeholder="Phân loại / hãng sản xuất (VD: Sản phẩm SDVICO)"
                value={dMaker}
                onChange={(e) => setDMaker(e.target.value)}
                className={field}
              />
              <textarea
                placeholder="Phù hợp đối tượng nào"
                value={dForWho}
                onChange={(e) => setDForWho(e.target.value)}
                rows={2}
                className="min-h-[3.5rem] w-full rounded-xl border-0 bg-field px-3 py-2 text-[0.875rem] focus:bg-card focus:outline-none focus:ring-2 focus:ring-sea"
              />
              <textarea
                placeholder={"Lợi ích mang lại — mỗi dòng một ý"}
                value={dBenefits}
                onChange={(e) => setDBenefits(e.target.value)}
                rows={3}
                className="min-h-[3.5rem] w-full rounded-xl border-0 bg-field px-3 py-2 text-[0.875rem] focus:bg-card focus:outline-none focus:ring-2 focus:ring-sea"
              />
              <div>
                <textarea
                  placeholder={"Thông số kỹ thuật — định dạng: Tên thông số | Giá trị\nVD: Độ lọc | 1–10 micron"}
                  value={dSpecs}
                  onChange={(e) => setDSpecs(e.target.value)}
                  rows={4}
                  className="min-h-[3.5rem] w-full rounded-xl border-0 bg-field px-3 py-2 text-[0.875rem] focus:bg-card focus:outline-none focus:ring-2 focus:ring-sea"
                />
                <p className="mt-1 text-[0.75rem] leading-snug text-foreground/55">
                  Mỗi dòng một thông số, ngăn nhãn và giá trị bằng dấu &ldquo;|&rdquo;.
                </p>
              </div>
              <textarea
                placeholder="Phiên bản khác nhau (VD: bản cơ và bản điện khác nhau ra sao) — tuỳ chọn"
                value={dVariant}
                onChange={(e) => setDVariant(e.target.value)}
                rows={2}
                className="min-h-[3.5rem] w-full rounded-xl border-0 bg-field px-3 py-2 text-[0.875rem] focus:bg-card focus:outline-none focus:ring-2 focus:ring-sea"
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[2.75rem] rounded-xl bg-field text-[0.9375rem] font-bold text-foreground/70"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={busy}
            className="min-h-[2.75rem] rounded-xl bg-trim text-[0.9375rem] font-bold text-white disabled:opacity-50"
          >
            {busy ? "Đang lưu trữ…" : "Lưu thông tin"}
          </button>
        </div>
        {msg && (
          <p className="text-[0.875rem] font-semibold text-foreground/75">
            {msg}
          </p>
        )}
      </form>
    </div>
  );
}

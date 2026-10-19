"use client";

/*  Tách nguyên văn khỏi src/app/quan-tri/page.tsx (2026-10-19, rà Codex đợt 3: trang quản trị 6.718 dòng
    — tách theo tab, KHÔNG đổi hành vi; trang chính nạp tab khi mở). */

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { apiUrl } from "@/lib/api-base";
import { tokenHeader } from "@/lib/device-token-store";
import { VMS_ZONE_STYLES, countPoints, parseUploadedGeoJSON, type VmsZoneStyle, validateZoneDraft } from "@/lib/vms-zones";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";

// ── Tab VÙNG BIỂN (VMS) — bản đồ + tải GeoJSON + ẩn/hiện + mặc định-app + xóa ──

export type AdminVmsZone = {
  id: string;
  name: string;
  color: string;
  style: string;
  defaultOn: boolean;
  isBorder: boolean;
  visible: boolean;
  geojson: GeoJSON.FeatureCollection;
  sortOrder: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

// Bản đồ lazy-load (MapLibre nặng + không SSR được).
export const VmsZonesMapDyn = dynamic(
  () => import("@/components/admin/vms-zones-map"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-field">
        <p className="text-[1rem] font-semibold text-t1">Đang tải bản đồ…</p>
      </div>
    ),
  },
);

export const STYLE_LABEL: Record<VmsZoneStyle, string> = {
  fill: "Vùng tô nền",
  line: "Đường viền liền",
  "line-dashed": "Đường viền nét đứt",
};

export function VmsZonesTab() {
  const [zones, setZones] = useState<AdminVmsZone[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<AdminVmsZone | null>(null);

  // form thêm vùng
  const [name, setName] = useState("");
  const [color, setColor] = useState("#0d9488");
  const [style, setStyle] = useState<VmsZoneStyle>("line");
  const [defaultOn, setDefaultOn] = useState(true);
  const [isBorder, setIsBorder] = useState(false);
  const [geojson, setGeojson] = useState<GeoJSON.FeatureCollection | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileErr, setFileErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formMsg, setFormMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setZones(null);
    fetch(apiUrl("/api/admin/vms-zones"), { headers: tokenHeader() })
      .then(async (r) => {
        const j = (await r.json()) as {
          ok: boolean;
          code?: string;
          zones?: AdminVmsZone[];
        };
        if (!j.ok) throw new Error(j.code ?? "load");
        setZones(j.zones ?? []);
      })
      .catch((e: Error) =>
        setError(
          e.message === "not_configured"
            ? "Chưa kết nối được cơ sở dữ liệu (Supabase). Tính năng này yêu cầu chạy migration 0013_vms_zones trước."
            : "Chưa tải được danh sách vùng biển. Vui lòng thử lại.",
        ),
      );
  }, []);
  useEffect(load, [load]);

  const patch = useCallback(
    async (id: string, body: Record<string, unknown>) => {
      setBusyId(id);
      try {
        const r = await fetch(apiUrl("/api/admin/vms-zones"), {
          method: "PATCH",
          headers: { "content-type": "application/json", ...tokenHeader() },
          body: JSON.stringify({ id, ...body }),
        });
        const j = (await r.json()) as { ok: boolean };
        if (!j.ok) throw new Error();
        load();
      } catch {
        setError("Không lưu được thay đổi. Vui lòng thử lại.");
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  const remove = useCallback(
    async (id: string) => {
      setBusyId(id);
      try {
        const r = await fetch(apiUrl(`/api/admin/vms-zones?id=${id}`), {
          method: "DELETE",
          headers: tokenHeader(),
        });
        const j = (await r.json()) as { ok: boolean };
        if (!j.ok) throw new Error();
        load();
      } catch {
        setError("Xóa không thành công. Vui lòng thử lại.");
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  async function onFile(file: File | null) {
    setFileErr(null);
    setGeojson(null);
    setFileName(null);
    if (!file) return;
    try {
      const text = await file.text();
      const fc = parseUploadedGeoJSON(text);
      setGeojson(fc);
      setFileName(`${file.name} · có ${countPoints(fc).toLocaleString("vi-VN")} điểm toạ độ`);
      if (!name.trim()) setName(file.name.replace(/\.(geo)?json$/i, ""));
    } catch (e) {
      setFileErr((e as Error).message);
    }
  }

  async function submit() {
    setFormMsg(null);
    if (!geojson) {
      setFileErr("Vui lòng chọn tệp định dạng GeoJSON trước.");
      return;
    }
    const draft = { name, color, style, defaultOn, visible: true, isBorder, geojson };
    const invalid = validateZoneDraft(draft);
    if (invalid) {
      setFormMsg(invalid);
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch(apiUrl("/api/admin/vms-zones"), {
        method: "POST",
        headers: { "content-type": "application/json", ...tokenHeader() },
        body: JSON.stringify({ ...draft, sortOrder: (zones?.length ?? 0) + 10 }),
      });
      const j = (await r.json()) as { ok: boolean; code?: string };
      if (!j.ok) throw new Error(j.code ?? "post");
      setName("");
      setGeojson(null);
      setFileName(null);
      setDefaultOn(true);
      load();
    } catch (e) {
      setFormMsg(
        (e as Error).message === "too_big"
          ? "Tệp dữ liệu quá lớn (>200.000 điểm toạ độ) — vui lòng giảm bớt chi tiết bản đồ trước khi tải lên."
          : "Thêm vùng không thành công. Vui lòng thử lại.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mt-5">
      <h2 className="display text-[1.375rem] font-bold text-navy">
        Vùng biển trên bản đồ Ra khơi
      </h2>
      <p className="mt-1 text-[0.9375rem] text-foreground/70">
        Thêm / ẩn / xóa vùng và chọn vùng có bật sẵn trên app ngư dân hay không.
        Áp dụng ngay, không cần build lại app.
      </p>

      {error && (
        <p className="mt-3 rounded-xl bg-danger-bg px-3 py-2 text-[0.9375rem] font-semibold text-danger">
          {error}
        </p>
      )}

      {/* Bản đồ xem tất cả vùng */}
      <div className="mt-4 h-[26rem] overflow-hidden rounded-2xl border border-line">
        {zones && (
          <VmsZonesMapDyn
            zones={zones.map((z) => ({
              id: z.id,
              color: z.color,
              style: z.style,
              isBorder: z.isBorder,
              visible: z.visible,
              geojson: z.geojson,
            }))}
            selectedId={selectedId}
          />
        )}
      </div>

      {/* Thêm vùng bằng GeoJSON */}
      <div className="mt-4 rounded-2xl border border-line bg-field/40 p-4">
        <p className="text-[1rem] font-bold text-navy">Thêm vùng mới (từ tệp GeoJSON)</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-[0.8125rem] font-semibold text-foreground/70">
              Tệp GeoJSON
            </span>
            <input
              type="file"
              accept=".json,.geojson,application/geo+json,application/json"
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
              className="mt-1 block w-full text-[0.875rem] file:mr-3 file:rounded-lg file:border-0 file:bg-navy file:px-3 file:py-2 file:font-semibold file:text-white"
            />
            {fileName && (
              <span className="mt-1 block text-[0.8125rem] text-ok">{fileName}</span>
            )}
            {fileErr && (
              <span className="mt-1 block text-[0.8125rem] font-semibold text-danger">
                {fileErr}
              </span>
            )}
          </label>
          <label className="block">
            <span className="text-[0.8125rem] font-semibold text-foreground/70">
              Tên vùng
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="vd: Vùng cấm đánh bắt mùa sinh sản"
              className="mt-1 block w-full rounded-lg border border-line bg-card px-3 py-2 text-[0.9375rem]"
            />
          </label>
          <label className="flex items-center gap-3">
            <span className="text-[0.8125rem] font-semibold text-foreground/70">
              Màu
            </span>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-10 w-16 rounded-lg border border-line"
            />
            <span className="text-[0.8125rem] tabular-nums text-foreground/60">
              {color}
            </span>
          </label>
          <div>
            <span className="text-[0.8125rem] font-semibold text-foreground/70">
              Kiểu vẽ
            </span>
            <div className="mt-1 flex gap-1.5">
              {VMS_ZONE_STYLES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStyle(s)}
                  className={`flex-1 rounded-lg px-2 py-2 text-[0.8125rem] font-semibold ${
                    style === s ? "bg-navy text-white" : "bg-field text-foreground/70"
                  }`}
                >
                  {STYLE_LABEL[s]}
                </button>
              ))}
            </div>
          </div>
        </div>
        <label className="mt-3 flex items-center gap-2 text-[0.9375rem]">
          <input
            type="checkbox"
            checked={defaultOn}
            onChange={(e) => setDefaultOn(e.target.checked)}
            className="h-5 w-5"
          />
          Bật sẵn trên app ngư dân (bà con vẫn tắt được)
        </label>
        {/*  RANH GIỚI DÙNG ĐỂ CẢNH BÁO — không phải toggle hiển thị. Bật cái này
             là đổi HÌNH mà app dùng để tính "cách ranh giới bao xa" và "đã ra
             ngoài chưa" cho toàn bộ bà con, nên có dòng dặn ngay dưới. */}
        <label className="mt-3 flex items-start gap-2 text-[0.9375rem]">
          <input
            type="checkbox"
            checked={isBorder}
            onChange={(e) => setIsBorder(e.target.checked)}
            className="mt-0.5 h-5 w-5"
          />
          <span>
            Vùng này là <b>đường ranh giới</b> dùng để cảnh báo
            <span className="mt-0.5 block text-[0.8125rem] leading-snug text-foreground/60">
              App sẽ đo &quot;cách ranh giới bao xa&quot; theo hình này. Nên nạp
              dạng <b>khu vực đóng</b> — chỉ là đường thì app đo được khoảng cách
              nhưng không biết trong hay ngoài, sẽ không báo &quot;đã ra
              ngoài&quot;. Không đánh dấu vùng nào thì app giữ ranh giới sẵn có.
            </span>
          </span>
        </label>
        {formMsg && (
          <p className="mt-2 text-[0.875rem] font-semibold text-danger">{formMsg}</p>
        )}
        <button
          type="button"
          disabled={submitting || !geojson}
          onClick={submit}
          className="mt-3 rounded-xl bg-sea px-5 py-2.5 text-[1rem] font-bold text-white disabled:opacity-50"
        >
          {submitting ? "Đang lưu trữ…" : "Thêm vùng"}
        </button>
      </div>

      {/* Danh sách vùng */}
      <div className="mt-4 space-y-2">
        {zones === null && !error && (
          <p className="text-[0.9375rem] text-foreground/60">Đang xử lý tải lên…</p>
        )}
        {zones?.length === 0 && (
          <p className="rounded-xl bg-field px-3 py-3 text-[0.9375rem] text-foreground/60">
            Chưa có vùng nào. Tải GeoJSON ở trên để thêm.
          </p>
        )}
        {zones?.map((z) => (
          <div
            key={z.id}
            onClick={() => setSelectedId(z.id === selectedId ? null : z.id)}
            className={`cursor-pointer rounded-xl border bg-card p-3 transition ${
              selectedId === z.id ? "border-navy ring-1 ring-navy" : "border-line"
            } ${z.visible ? "" : "opacity-60"}`}
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span
                className="h-4 w-4 shrink-0 rounded-full border border-line"
                style={{ backgroundColor: z.color }}
              />
              <span className="text-[1rem] font-bold text-navy">{z.name}</span>
              <span className="rounded-full bg-field px-2 py-0.5 text-[0.75rem] text-foreground/60">
                {STYLE_LABEL[z.style as VmsZoneStyle] ?? z.style}
              </span>
              <span className="text-[0.75rem] tabular-nums text-foreground/50">
                {countPoints(z.geojson).toLocaleString("vi-VN")} điểm
              </span>
            </div>
            <div
              className="mt-2.5 flex flex-wrap gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                disabled={busyId === z.id}
                onClick={() => patch(z.id, { defaultOn: !z.defaultOn })}
                className={`rounded-lg px-3 py-1.5 text-[0.8125rem] font-semibold ${
                  z.defaultOn ? "bg-ok-bg text-ok" : "bg-field text-foreground/60"
                }`}
              >
                {z.defaultOn ? "✓ Bật mặc định trên ứng dụng" : "Tắt mặc định trên ứng dụng"}
              </button>
              <button
                type="button"
                disabled={busyId === z.id}
                onClick={() => patch(z.id, { isBorder: !z.isBorder })}
                className={`rounded-lg px-3 py-1.5 text-[0.8125rem] font-semibold ${
                  z.isBorder ? "bg-danger-bg text-danger" : "bg-field text-foreground/60"
                }`}
              >
                {z.isBorder ? "✓ Đặt làm ranh giới cảnh báo" : "Không sử dụng làm ranh giới"}
              </button>
              <button
                type="button"
                disabled={busyId === z.id}
                onClick={() => patch(z.id, { visible: !z.visible })}
                className={`rounded-lg px-3 py-1.5 text-[0.8125rem] font-semibold ${
                  z.visible ? "bg-field text-foreground/70" : "bg-warn-bg text-warn"
                }`}
              >
                {z.visible ? "Đang hiển thị — chọn ẩn đi" : "Đang ẩn — chọn hiện lại"}
              </button>
              <button
                type="button"
                disabled={busyId === z.id}
                onClick={() => setToDelete(z)}
                className="rounded-lg bg-danger-bg px-3 py-1.5 text-[0.8125rem] font-semibold text-danger"
              >
                Xóa
              </button>
            </div>
          </div>
        ))}
      </div>

      {toDelete && (
        <ConfirmDialog
          title="Xác nhận xóa vùng biển này?"
          message={`Vùng "${toDelete.name}" sẽ bị xóa khỏi bản đồ ứng dụng của ngư dân.`}
          confirmLabel="Xác nhận xóa"
          onCancel={() => setToDelete(null)}
          onConfirm={() => {
            remove(toDelete.id);
            setToDelete(null);
          }}
        />
      )}
    </section>
  );
}

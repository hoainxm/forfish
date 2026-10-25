"use client";

/*
  /quan-tri › Kairos › TÀI TRỢ (14 §20). SDVICO tự soạn bài tài trợ (đại lý vật tư, link Shopee tiếp thị liên kết…)
  hiện trong dòng tin Kairos 1 thẻ / 20 bài, nhãn "Tài trợ · <nhà tài trợ>" không tắt được.
  Sửa tại chỗ rồi bấm "Lưu" ⇒ hộp xác nhận ⇒ PUT cả danh sách (máy chủ kiểm lại từng dòng; sai ⇒ không ghi gì, báo
  dòng nào sai). Xem: kairos:view · Sửa: kairos:create. Dòng tin nhận bản mới trong ≤ 1 phút (cache máy chủ 60 s).
*/

import { useCallback, useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ImagePicker } from "@/components/market/shared/image-picker";
import { inputClass } from "@/components/ui/primitives";
import { EmptyBox, ErrorBox, LoadingBox } from "@/components/admin/market-admin-shared";
import { timeoutSignal } from "@/lib/abort";
import { apiUrl } from "@/lib/api-base";
import { tokenHeader } from "@/lib/device-token-store";
import { kiemDanhSach, maMoi, QC_NUT_MAC_DINH, QC_TRAN, type QuangCao } from "@/lib/kairos/quang-cao";
import { kairosUpload } from "@/lib/kairos/write-client";
import { type TabPerms } from "@/lib/staff-permissions";

const btn = "h-11 rounded-xl px-4 text-[0.9375rem] font-semibold disabled:opacity-40";

async function goi(method: "GET" | "PUT", body?: unknown): Promise<QuangCao[]> {
  const r = await fetch(apiUrl("/api/admin/kairos/ads"), {
    method,
    cache: "no-store",
    headers: { ...tokenHeader(), ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: timeoutSignal(method === "GET" ? 12_000 : 20_000),
  }).catch(() => null);
  if (!r) throw new Error("Không có mạng hoặc máy chủ không trả lời — thử lại.");
  const j = (await r.json().catch(() => null)) as { ok?: boolean; items?: QuangCao[]; message?: string; code?: string } | null;
  if (!r.ok || !j?.ok) {
    throw new Error(
      j?.message ??
        (j?.code === "no_permission" ? "Bạn chưa được cấp quyền sửa bài tài trợ." : j?.code === "audit_failed" ? "Chưa ghi được nhật ký nên CHƯA lưu — thử lại." : "Chưa làm được — thử lại."),
    );
  }
  return j.items ?? [];
}

const ngay = (iso: string | null) => (iso ? iso.slice(0, 10) : "");
const tuNgay = (d: string, cuoiNgay: boolean) => (d ? new Date(`${d}T${cuoiNgay ? "23:59:59" : "00:00:00"}+07:00`).toISOString() : null);

function Dong({ q, sua, onDoi, onXoa }: { q: QuangCao; sua: boolean; onDoi: (q: QuangCao) => void; onXoa: () => void }) {
  const upload = async (blob: Blob) => {
    const r = await kairosUpload(blob);
    if (!r.ok) throw new Error(r.offline ? "Cần sóng để tải ảnh" : "Chưa tải được ảnh — thử lại.");
    return r.data.url;
  };
  const o = (label: string, el: React.ReactNode) => (
    <label className="block">
      <span className="mb-1 block text-[0.8125rem] font-semibold text-foreground/70">{label}</span>
      {el}
    </label>
  );
  return (
    <div className="surface space-y-3 px-4 py-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[0.8125rem] font-bold text-foreground/65">Tài trợ · {q.nhaTaiTro || "…"}</span>
        <label className="flex items-center gap-2 text-[0.875rem] font-semibold">
          <input type="checkbox" checked={q.bat} disabled={!sua} onChange={(e) => onDoi({ ...q, bat: e.target.checked })} />
          Đang chạy
        </label>
      </div>
      {o("Nhà tài trợ", <input className={inputClass} disabled={!sua} maxLength={QC_TRAN.nhaTaiTro} value={q.nhaTaiTro} onChange={(e) => onDoi({ ...q, nhaTaiTro: e.target.value })} placeholder="Đại lý ngư cụ Sa Huỳnh" />)}
      {o("Tiêu đề", <input className={inputClass} disabled={!sua} maxLength={QC_TRAN.tieuDe} value={q.tieuDe} onChange={(e) => onDoi({ ...q, tieuDe: e.target.value })} />)}
      {o("Nội dung (tuỳ chọn)", <textarea className={`${inputClass} min-h-[5rem]`} disabled={!sua} maxLength={QC_TRAN.noiDung} value={q.noiDung} onChange={(e) => onDoi({ ...q, noiDung: e.target.value })} />)}
      {o("Đường dẫn (https://…, có thể là link Shopee tiếp thị liên kết)", <input className={inputClass} disabled={!sua} inputMode="url" autoComplete="off" value={q.link} onChange={(e) => onDoi({ ...q, link: e.target.value })} />)}
      {o("Chữ nút (≤ 2 chữ)", <input className={inputClass} disabled={!sua} maxLength={20} value={q.nut} onChange={(e) => onDoi({ ...q, nut: e.target.value })} placeholder={QC_NUT_MAC_DINH} />)}
      <div className="grid grid-cols-2 gap-2">
        {o("Từ ngày", <input type="date" className={inputClass} disabled={!sua} value={ngay(q.tu)} onChange={(e) => onDoi({ ...q, tu: tuNgay(e.target.value, false) })} />)}
        {o("Đến hết ngày", <input type="date" className={inputClass} disabled={!sua} value={ngay(q.den)} onChange={(e) => onDoi({ ...q, den: tuNgay(e.target.value, true) })} />)}
      </div>
      {sua ? (
        <ImagePicker value={q.anh ? [q.anh] : []} onChange={(v) => onDoi({ ...q, anh: v[0] ?? null })} max={1} upload={upload} label="Ảnh (tuỳ chọn)" />
      ) : (
        q.anh && <p className="truncate text-[0.8125rem] text-foreground/60">Ảnh: {q.anh}</p>
      )}
      {sua && (
        <button type="button" className={`${btn} border border-line text-danger`} onClick={onXoa}>
          Xoá bài này
        </button>
      )}
    </div>
  );
}

export function TaiTroSection({ perms }: { perms: TabPerms }) {
  const sua = perms.create;
  const [list, setList] = useState<QuangCao[] | null>(null);
  const [goc, setGoc] = useState("");
  const [loi, setLoi] = useState<string | null>(null);
  const [hoi, setHoi] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const tai = useCallback(async () => {
    setLoi(null);
    setList(null);
    try {
      const items = await goi("GET");
      setList(items);
      setGoc(JSON.stringify(items));
    } catch (e) {
      setLoi((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void tai();
  }, [tai]);

  if (loi) return <ErrorBox text={loi} onRetry={() => void tai()} />;
  if (!list) return <LoadingBox what="bài tài trợ" />;

  const doi = (i: number, q: QuangCao) => {
    setMsg(null);
    setList(list.map((x, k) => (k === i ? q : x)));
  };
  const kiem = kiemDanhSach(list);
  const daDoi = JSON.stringify(list) !== goc;

  const luu = async () => {
    setHoi(false);
    setBusy(true);
    setMsg(null);
    try {
      const items = await goi("PUT", { items: list });
      setList(items);
      setGoc(JSON.stringify(items));
      setMsg({ ok: true, text: "Đã lưu. Dòng tin nhận bản mới trong khoảng 1 phút." });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-[0.875rem] leading-snug text-foreground/70">
        Bài tài trợ hiện trong dòng tin Kairos, <b>1 thẻ cho mỗi 20 bài</b>, luôn ghi nhãn <b>Tài trợ</b> kèm tên nhà tài trợ
        (Luật Quảng cáo). Không nhắm theo người đọc, không đếm lượt xem. Mất sóng không hiện.
      </p>
      {list.length === 0 && <EmptyBox text="Chưa có bài tài trợ nào." />}
      {list.map((q, i) => (
        <Dong key={q.id} q={q} sua={sua} onDoi={(n) => doi(i, n)} onXoa={() => setList(list.filter((_, k) => k !== i))} />
      ))}
      {sua && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`${btn} border border-line text-navy`}
            disabled={list.length >= QC_TRAN.soLuong}
            onClick={() =>
              setList([
                ...list,
                { id: maMoi(Date.now(), Math.random()), nhaTaiTro: "", tieuDe: "", noiDung: "", anh: null, link: "https://", nut: QC_NUT_MAC_DINH, bat: true, tu: null, den: null },
              ])
            }
          >
            Thêm bài
          </button>
          <button type="button" className={`${btn} bg-navy text-white`} disabled={busy || !daDoi || !kiem.ok} onClick={() => setHoi(true)}>
            {busy ? "Đang lưu" : "Lưu"}
          </button>
        </div>
      )}
      {sua && daDoi && !kiem.ok && <p className="text-[0.875rem] font-semibold text-danger">{kiem.loi}</p>}
      {msg && <p className={`text-[0.875rem] font-semibold ${msg.ok ? "text-ok" : "text-danger"}`}>{msg.text}</p>}
      {hoi && (
        <ConfirmDialog
          title="Lưu bài tài trợ?"
          message={`${list.filter((q) => q.bat).length} bài đang chạy sẽ hiện cho mọi người dùng Kairos trong khoảng 1 phút.`}
          confirmLabel="Lưu"
          onCancel={() => setHoi(false)}
          onConfirm={() => void luu()}
        />
      )}
    </div>
  );
}

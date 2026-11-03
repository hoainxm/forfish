"use client";

/*
  /viec/ho-so/[id] — CHI TIẾT HỒ SƠ TÌM TÀU cho CHỦ TÀU (spec 17 §12.3, §5). Gọi · Zalo chỉ khi vai chu-tau (route
  /lien-he trả 403 `vai` cho vai khác — AC5). Vai khác mở link ⇒ câu "Chỉ Chủ tàu xem được" (route 403), không lộ gì.
  Mất sóng ⇒ "cần sóng" + Thử lại (hồ sơ người khác không lưu trong máy). Số đã mở trong phiên vẫn gọi được.
*/

import { useCallback, useEffect, useState } from "react";
import { OfflineLine } from "@/components/ui/offline-line";
import { ToastHost } from "@/components/ui/toast";
import { ngheName } from "@/lib/kairos/ho-so";
import { cauLoi, type ViecHoSo } from "@/lib/viec";
import { goiViec } from "@/lib/viec-client";
import { BaoXauNut, GoiZalo, LoiThuLai, ViecSkeleton, giayChu, ngayNgan, tenCang, viTriChu } from "./viec-chung";

type Tai = { kind: "dang" } | { kind: "xong"; hoSo: ViecHoSo; cuaToi: boolean } | { kind: "loi"; cau: string; matSong?: boolean };

// số đã mở trong phiên (không ghi máy — SĐT bạn thuyền chỉ ở tay chủ tàu khi cần, §5)
const SO_PHIEN = new Map<string, string>();

export function HoSoChiTiet({ id }: { id: string }) {
  const [tai, setTai] = useState<Tai>({ kind: "dang" });

  const load = useCallback(async () => {
    setTai({ kind: "dang" });
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setTai({ kind: "loi", cau: "Mất sóng — có sóng sẽ tải hồ sơ.", matSong: true });
      return;
    }
    const r = await goiViec<{ hoSo: ViecHoSo; cuaToi: boolean }>(`/api/viec/ho-so/${id}`);
    if (r.ok) return setTai({ kind: "xong", hoSo: r.data.hoSo, cuaToi: r.data.cuaToi });
    setTai({ kind: "loi", cau: r.message ?? (r.status === 0 ? "Mạng yếu, chưa tải được hồ sơ." : cauLoi(r.code)), matSong: r.status === 0 });
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (tai.kind === "dang") return <div className="px-4"><ViecSkeleton count={1} /></div>;
  if (tai.kind === "loi")
    return (
      <div className="space-y-3 px-4">
        {tai.matSong && <OfflineLine />}
        <LoiThuLai cau={tai.cau} onThuLai={() => void load()} />
      </div>
    );

  const h = tai.hoSo;
  const hang = (nhan: string, giaTri: string | null | undefined) =>
    giaTri ? (
      <div className="flex gap-3 border-b border-line py-2.5 last:border-b-0">
        <dt className="w-[7.5rem] shrink-0 text-[0.875rem] text-muted">{nhan}</dt>
        <dd className="min-w-0 flex-1 whitespace-pre-line break-words text-[0.9375rem] text-foreground/90">{giaTri}</dd>
      </div>
    ) : null;

  return (
    <div className="px-4 pb-24">
      <article className="surface p-4">
        <h1 className="display text-[1.25rem] font-bold leading-snug text-navy">{h.ten}</h1>
        <dl className="mt-2">
          {hang("Muốn làm", viTriChu(h.viTri))}
          {hang("Nghề đã làm", h.nghe.map(ngheName).filter(Boolean).join(", "))}
          {hang("Đi biển", h.soNam != null ? `${h.soNam} năm` : null)}
          {hang("Cảng muốn đi", h.ports.map(tenCang).join(", "))}
          {hang("Giấy đang có", h.giay.length ? giayChu(h.giay) : null)}
          {hang("Sẵn sàng từ", h.sanSang ? ngayNgan(h.sanSang) : null)}
          {hang("Ghi chú", h.ghiChu)}
        </dl>
        {tai.cuaToi ? (
          <p className="mt-3 text-[0.875rem] text-muted">Hồ sơ của bà con — chủ tàu thấy như thế này.</p>
        ) : (
          <>
            <GoiZalo
              className="mt-4"
              laySo={async () => {
                const r = await goiViec<{ phone: string }>(`/api/viec/ho-so/${h.id}/lien-he`);
                return r.ok ? { ok: true, phone: r.data.phone } : r;
              }}
              soMay={() => SO_PHIEN.get(h.id) ?? null}
              nhoSo={(p) => SO_PHIEN.set(h.id, p)}
            />
            <div className="mt-2 flex justify-end">
              <BaoXauNut kind="seeker" id={h.id} />
            </div>
          </>
        )}
      </article>
      <ToastHost />
    </div>
  );
}

"use client";

/*
  /viec/tin/[id] — CHI TIẾT TIN TUYỂN (spec 17 §12.2). Gọi (tel:) · Zalo (https://zalo.me/<sđt>) · Lưu (máy) · Báo xấu.
  Khách xem được; Gọi mời đăng nhập. Mất sóng / mạng yếu ⇒ đọc bản lưu (danh sách đã tải hoặc tin đã lưu) + OfflineLine.
  Tin đóng / hết hạn ⇒ vẫn hiện nội dung kèm dòng "Tin đã đóng" (link đã lưu không thành trang trắng).
*/

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { OfflineLine } from "@/components/ui/offline-line";
import { SQ_BTN } from "@/components/ui/sq-btn";
import { StatusBanner } from "@/components/ui/status-banner";
import { ToastHost } from "@/components/ui/toast";
import { ngheName } from "@/lib/kairos/ho-so";
import { NHAN } from "@/lib/labels";
import { baoToast } from "@/lib/toast";
import { cauLoi, trangThaiTin, type ViecTin } from "@/lib/viec";
import { batTatLuu, docCache, docLuu, goiViec, VIEC_LUU_EVENT } from "@/lib/viec-client";
import { BaoXauNut, GoiZaloTin, LoiThuLai, ViecSkeleton, giayChu, ngayNgan, tenCang, tinhCang, viTriChu } from "./viec-chung";

type Tai = { kind: "dang" } | { kind: "xong"; tin: ViecTin; banLuu: number | null } | { kind: "loi"; cau: string; khongCo?: boolean };

function tuMay(id: string): { tin: ViecTin; luc: number } | null {
  const c = docCache();
  const a = c?.tin.find((t) => t.id === id);
  if (a && c) return { tin: a, luc: c.luc };
  const b = docLuu().find((t) => t.id === id);
  return b ? { tin: b, luc: 0 } : null;
}

export function ViecChiTiet({ id }: { id: string }) {
  const [tai, setTai] = useState<Tai>({ kind: "dang" });
  const [daLuu, setDaLuu] = useState(false);
  const [now] = useState(() => Date.now());

  const load = useCallback(async () => {
    setTai({ kind: "dang" });
    const may = tuMay(id);
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setTai(may ? { kind: "xong", tin: may.tin, banLuu: may.luc } : { kind: "loi", cau: "Mất sóng — có sóng sẽ tải tin này." });
      return;
    }
    const r = await goiViec<{ tin: ViecTin }>(`/api/viec/tin/${id}`);
    if (r.ok) return setTai({ kind: "xong", tin: r.data.tin, banLuu: null });
    if (r.status === 404) return setTai({ kind: "loi", cau: "Không tìm thấy tin này — có thể tin đã đóng.", khongCo: true });
    setTai(may ? { kind: "xong", tin: may.tin, banLuu: may.luc } : { kind: "loi", cau: r.status === 0 ? "Mạng yếu, chưa tải được tin." : cauLoi(r.code) });
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const doc = () => setDaLuu(docLuu().some((t) => t.id === id));
    doc();
    window.addEventListener(VIEC_LUU_EVENT, doc);
    return () => window.removeEventListener(VIEC_LUU_EVENT, doc);
  }, [id]);

  if (tai.kind === "dang") return <div className="px-4"><ViecSkeleton count={1} /></div>;
  if (tai.kind === "loi")
    return (
      <div className="px-4">
        {tai.khongCo ? (
          <div className="rounded-2xl border border-dashed border-line px-4 py-8 text-center">
            <p className="text-[1rem] text-muted">{tai.cau}</p>
            <Link href="/viec" className={`${SQ_BTN} mx-auto mt-3 bg-field text-sea`}>
              {NHAN.viecLam}
            </Link>
          </div>
        ) : (
          <LoiThuLai cau={tai.cau} onThuLai={() => void load()} />
        )}
      </div>
    );

  const t = tai.tin;
  const tt = trangThaiTin(t, now);
  const hang = (nhan: string, giaTri: string | null | undefined) =>
    giaTri ? (
      <div className="flex gap-3 border-b border-line py-2.5 last:border-b-0">
        <dt className="w-[7.5rem] shrink-0 text-[0.875rem] text-muted">{nhan}</dt>
        <dd className="min-w-0 flex-1 whitespace-pre-line break-words text-[0.9375rem] text-foreground/90">{giaTri}</dd>
      </div>
    ) : null;

  return (
    <div className="px-4 pb-24">
      {tai.banLuu !== null && (
        <div className="mb-3">
          <OfflineLine savedAt={tai.banLuu || null} />
        </div>
      )}
      {tt !== "mo" && (
        <div className="mb-3">
          <StatusBanner level="neutral">
            {tt === "du" ? "Tàu đã đủ người." : tt === "an" ? "Tin đang bị ẩn chờ người trực xem." : "Tin đã hết hạn."}
          </StatusBanner>
        </div>
      )}
      <article className="surface p-4">
        <h1 className="display text-[1.25rem] font-bold leading-snug text-navy">
          {ngheName(t.nghe) || "Tàu tuyển"} · cần {t.soNguoi} người
        </h1>
        <dl className="mt-2">
          {hang("Vị trí", viTriChu(t.viTri))}
          {hang("Cảng", [tenCang(t.portId), tinhCang(t.portId)].filter(Boolean).join(", "))}
          {hang("Ngày đi", t.ngayDi ? ngayNgan(t.ngayDi) : null)}
          {hang("Chuyến dài", t.soNgay ? `${t.soNgay} ngày` : null)}
          {hang("Công", t.cong)}
          {hang("Giấy cần có", t.giay.length ? giayChu(t.giay) : null)}
          {hang("Số hiệu tàu", t.boatReg)}
          {hang("Ghi chú", t.ghiChu)}
          {hang("Còn hạn tới", tt === "mo" ? ngayNgan(t.expiresAt.slice(0, 10)) : null)}
        </dl>
        <GoiZaloTin tin={t} className="mt-4" />
        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            type="button"
            aria-pressed={daLuu}
            onClick={() => {
              const next = batTatLuu(t);
              if (!next) return baoToast("Máy chưa lưu được — bộ nhớ đầy?", { loai: "xau" });
              baoToast(next.some((x) => x.id === t.id) ? "Đã lưu tin — xem lại ở mục Đã lưu." : "Đã bỏ lưu.", { loai: "tot" });
            }}
            className={`${SQ_BTN} ${daLuu ? "bg-navy text-white" : "bg-field text-sea"}`}
          >
            {daLuu ? NHAN.boLuu : NHAN.luu}
          </button>
          {!t.cuaToi && <BaoXauNut kind="post" id={t.id} />}
        </div>
      </article>
      <p className="mt-3 text-[0.8125rem] leading-snug text-muted">
        App không thu tiền và không tính công. Ai đòi đặt cọc hay phí giới thiệu thì đừng chuyển — bấm {NHAN.baoXau}.
      </p>
      <ToastHost />
    </div>
  );
}

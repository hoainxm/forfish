"use client";

/*
  /viec/cua-toi — TUYỂN NGƯỜI · TIN CỦA TÔI (spec 17 §12.3, AC7). Mọi tin của chủ tàu chia nhóm: Đang mở · Hết hạn ·
  Đủ người · Đang ẩn. Mỗi tin: Gia hạn (hết hạn / đủ người / đang mở) · Đủ người (đang mở) · Sửa. Tin đang ẩn (báo xấu)
  không thao tác được — chờ người trực.
  Trạng thái: đang tải (khung chờ) · trống (mời Đăng tin) · lỗi + Thử lại · mất sóng (OfflineLine, cần sóng để tải và
  thao tác) · trần 5 tin mở (409 `tran` — câu tiếng Việt).
*/

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PlusIcon } from "@/components/icons";
import { OfflineLine } from "@/components/ui/offline-line";
import { SQ_BTN } from "@/components/ui/sq-btn";
import { ToastHost } from "@/components/ui/toast";
import { ngheName } from "@/lib/kairos/ho-so";
import { NHAN } from "@/lib/labels";
import { baoToast } from "@/lib/toast";
import { useOnline } from "@/lib/use-online";
import { useVai } from "@/lib/use-vai";
import { TRAN_TIN_MO, cauLoi, trangThaiTin, type TrangThaiTin, type ViecTin } from "@/lib/viec";
import { goiViec, guiJson } from "@/lib/viec-client";
import { LoiThuLai, ViecSkeleton, ngayNgan, tenCang, viTriChu } from "./viec-chung";

type Tai = { kind: "dang" } | { kind: "xong"; items: ViecTin[] } | { kind: "loi"; cau: string; matSong?: boolean };

const NHOM: { id: TrangThaiTin; ten: string }[] = [
  { id: "mo", ten: "Đang mở" },
  { id: "het-han", ten: "Hết hạn" },
  { id: "du", ten: "Đủ người" },
  { id: "an", ten: "Đang ẩn" },
];

export function TinCuaToi() {
  const online = useOnline();
  const { vai } = useVai();
  const [tai, setTai] = useState<Tai>({ kind: "dang" });
  const [dang, setDang] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  const load = useCallback(async () => {
    setTai((t) => (t.kind === "xong" ? t : { kind: "dang" }));
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setTai({ kind: "loi", cau: "Mất sóng — có sóng sẽ tải tin của bà con.", matSong: true });
      return;
    }
    const r = await goiViec<{ items: ViecTin[] }>("/api/viec/cua-toi");
    if (r.ok) setTai({ kind: "xong", items: r.data.items });
    else setTai({ kind: "loi", cau: r.status === 0 ? "Mạng yếu, chưa tải được tin." : cauLoi(r.code), matSong: r.status === 0 });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const lam = async (tin: ViecTin, action: "gia-han" | "du-nguoi") => {
    if (!online) return baoToast(`${NHAN.canSong} để làm việc này`, { loai: "xau" });
    setDang(tin.id);
    const r = await goiViec<{ tin: ViecTin }>(`/api/viec/tin/${tin.id}`, guiJson("PATCH", { action }));
    setDang(null);
    if (!r.ok) return baoToast(r.message ?? cauLoi(r.code), { loai: "xau" });
    setTai((t) => (t.kind === "xong" ? { kind: "xong", items: t.items.map((x) => (x.id === tin.id ? r.data.tin : x)) } : t));
    baoToast(action === "gia-han" ? "Đã gia hạn thêm 14 ngày." : "Đã đóng tin — tàu đủ người.", { loai: "tot" });
  };

  const dauMan = (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      {vai === "chu-tau" ? (
        <Link href="/viec/dang" className={`${SQ_BTN} bg-trim text-white`}>
          <PlusIcon className="h-4 w-4" />
          {NHAN.dangTin}
        </Link>
      ) : (
        <p className="text-[0.875rem] text-muted">Đổi vai sang Chủ tàu (ở Tài khoản) để đăng tin tuyển mới.</p>
      )}
      <Link href="/viec?tab=nguoi" className={`${SQ_BTN} bg-field text-sea`}>
        {NHAN.timNguoi}
      </Link>
    </div>
  );

  if (tai.kind === "dang") return <div className="px-4">{dauMan}<ViecSkeleton /></div>;
  if (tai.kind === "loi")
    return (
      <div className="space-y-3 px-4">
        {dauMan}
        {tai.matSong && <OfflineLine />}
        <LoiThuLai cau={tai.cau} onThuLai={() => void load()} />
      </div>
    );

  const soMo = tai.items.filter((t) => trangThaiTin(t, now) === "mo").length;

  return (
    <div className="px-4 pb-24">
      {dauMan}
      {tai.items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-[1rem] text-muted">
          Bà con chưa đăng tin tuyển nào. Chạm {NHAN.dangTin} để tìm bạn thuyền.
        </p>
      ) : (
        <>
          <p className="mb-3 text-[0.875rem] text-muted">
            Đang mở {soMo}/{TRAN_TIN_MO} tin. Tin tự ẩn sau 14 ngày — {NHAN.giaHan} để mở tiếp.
          </p>
          {NHOM.map((n) => {
            const list = tai.items.filter((t) => trangThaiTin(t, now) === n.id);
            if (!list.length) return null;
            return (
              <section key={n.id} className="mb-4">
                <h2 className="display mb-2 text-[1rem] font-semibold text-navy">
                  {n.ten} <span className="text-muted">{list.length}</span>
                </h2>
                <div className="space-y-3">
                  {list.map((t) => (
                    <article key={t.id} className="surface p-4">
                      <Link href={`/viec/tin/${t.id}`} className="block">
                        <h3 className="text-[1rem] font-semibold text-navy">
                          {ngheName(t.nghe)} · cần {t.soNguoi} người
                        </h3>
                        <p className="mt-1 text-[0.875rem] text-muted">
                          {viTriChu(t.viTri)} · {tenCang(t.portId)}
                        </p>
                        <p className="mt-1 text-[0.8125rem] text-muted">
                          {n.id === "mo" ? `Còn hạn tới ${ngayNgan(t.expiresAt.slice(0, 10))}` : n.id === "an" ? "Có người báo xấu — chờ người trực xem." : `Đăng ${ngayNgan(t.createdAt.slice(0, 10))}`}
                        </p>
                      </Link>
                      {n.id !== "an" && (
                        <div className="mt-3 grid grid-cols-3 gap-2">
                          <button
                            type="button"
                            disabled={dang === t.id}
                            onClick={() => void lam(t, "gia-han")}
                            className={`${SQ_BTN} w-full min-w-0 bg-field text-sea disabled:opacity-50`}
                          >
                            {NHAN.giaHan}
                          </button>
                          <button
                            type="button"
                            disabled={dang === t.id || n.id !== "mo"}
                            onClick={() => void lam(t, "du-nguoi")}
                            className={`${SQ_BTN} w-full min-w-0 bg-field text-sea disabled:opacity-50`}
                          >
                            {NHAN.duNguoi}
                          </button>
                          <Link href={`/viec/dang?id=${t.id}`} className={`${SQ_BTN} w-full min-w-0 bg-field text-sea`}>
                            {NHAN.sua}
                          </Link>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </>
      )}
      <ToastHost />
    </div>
  );
}

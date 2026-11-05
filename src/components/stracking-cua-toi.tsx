"use client";

import { useEffect, useState } from "react";
import { NHAN } from "@/lib/labels";
import { apiUrl } from "@/lib/api-base";
import { timeoutSignal } from "@/lib/abort";
import { tokenHeader } from "@/lib/device-token-store";
import { TAU_ACTION as SQ_BTN } from "@/components/tau-ui";
import { PlusIcon } from "@/components/icons";
import { homNayVn, trangThaiHan } from "@/lib/stracking/dong-bo.mjs";
import type { Boat } from "@/lib/boats";

/*
  MÁY GIÁM SÁT HÀNH TRÌNH CỦA TÔI — hạn cước S-Tracking (Viettel) thật, theo SĐT đang đăng nhập (2026-11-05).
  Máy GPU đồng bộ 07:30·12:20·17:20·21:00 ⇒ /api/stracking/cua-toi. Đặt TRONG khối "Giám sát hành trình" (vms-renewal.tsx),
  nút "Gia hạn" mỗi máy mở đúng wizard gia hạn sẵn có, điền mã tàu lấy từ S-Tracking (không phải tàu tự khai).

  OFFLINE: hiện NGAY bản đã lưu (`forfish.stracking.v1`, gắn tài khoản — auth-scope xoá khi đổi/đăng xuất), rồi hỏi
  máy chủ có đồng hồ 12 s; mất sóng thì giữ bản lưu + giờ cập nhật, không treo, không xoá.
*/

export const STRACKING_CACHE_KEY = "forfish.stracking.v1";
const HET_GIO_MS = 12_000;
const CANH_BAO_MOI_TAU = 3;

interface TauST {
  serial: string;
  imei: string | null;
  tenTau: string | null;
  chuTau: string | null;
  vai: "chu-tau" | "thuyen-truong";
  hetHan: string | null;
  tamNgungTu: string | null;
  tamNgungDen: string | null;
  trongBo: boolean | null;
}
interface CanhBaoST {
  imei: string;
  muc: string | null;
  loai: string;
  luc: string;
}
interface BanST {
  v: 1;
  layLuc: string;
  capNhatLuc: string | null;
  tau: TauST[];
  canhBao: CanhBaoST[];
}

function docBan(): BanST | null {
  try {
    const raw = localStorage.getItem(STRACKING_CACHE_KEY);
    if (!raw) return null;
    const b = JSON.parse(raw) as BanST;
    return b?.v === 1 && Array.isArray(b.tau) && Array.isArray(b.canhBao) ? b : null;
  } catch {
    return null;
  }
}

function ngayVn(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function gioVn(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(t));
}

/** Dòng hạn + màu (token) theo trạng thái. */
function dongHan(t: TauST, homNay: string): { chu: string; mau: string } {
  const s = trangThaiHan(t.hetHan, homNay);
  if (s.loai === "het-han") return { chu: `Quá hạn ${-(s.soNgay ?? 0)} ngày · từ ${ngayVn(t.hetHan!)}`, mau: "text-danger" };
  if (s.loai === "sap-het")
    return { chu: s.soNgay === 0 ? "Hết hạn hôm nay" : `Còn ${s.soNgay} ngày · hết ${ngayVn(t.hetHan!)}`, mau: "text-warn" };
  if (s.loai === "con-han") return { chu: `Còn hạn tới ${ngayVn(t.hetHan!)}`, mau: "text-ok" };
  return { chu: "Chưa có ngày hết hạn", mau: "text-muted" };
}

function dangTamNgung(t: TauST, homNay: string): boolean {
  return !!t.tamNgungTu && t.tamNgungTu <= homNay && (!t.tamNgungDen || t.tamNgungDen >= homNay);
}

export function StrackingCuaToi({ onGiaHan }: { onGiaHan: (boat: Boat) => void }) {
  const [ban, setBan] = useState<BanST | null>(null);
  const [trangThai, setTrangThai] = useState<"dang-tai" | "xong" | "mat-song" | "chua-dang-nhap">("dang-tai");

  useEffect(() => {
    let song = true;
    setBan(docBan());
    fetch(apiUrl("/api/stracking/cua-toi"), { headers: { ...tokenHeader() }, signal: timeoutSignal(HET_GIO_MS) })
      .then(async (r) => {
        if (!song) return;
        if (r.status === 401) return setTrangThai("chua-dang-nhap");
        const j = (await r.json().catch(() => null)) as { ok?: boolean; capNhatLuc?: string | null; tau?: TauST[]; canhBao?: CanhBaoST[] } | null;
        if (!song) return;
        if (!r.ok || !j?.ok || !Array.isArray(j.tau) || !Array.isArray(j.canhBao)) return setTrangThai("mat-song");
        const moi: BanST = { v: 1, layLuc: new Date().toISOString(), capNhatLuc: j.capNhatLuc ?? null, tau: j.tau, canhBao: j.canhBao };
        setBan(moi);
        setTrangThai("xong");
        try {
          localStorage.setItem(STRACKING_CACHE_KEY, JSON.stringify(moi));
        } catch {
          /* kho đầy/riêng tư — lần này vẫn hiện, chỉ không giữ cho lúc mất sóng */
        }
      })
      .catch(() => {
        if (song) setTrangThai("mat-song");
      });
    return () => {
      song = false;
    };
  }, []);

  const homNay = homNayVn();

  if (!ban) {
    if (trangThai === "dang-tai") return <p className="mt-3 text-[0.875rem] text-muted">Đang xem hạn máy của bạn…</p>;
    if (trangThai === "mat-song")
      return <p className="mt-3 text-[0.875rem] text-muted">Cần có mạng để xem hạn máy lần đầu.</p>;
    return null;
  }

  // Ghi chú nguồn: giờ máy GPU đồng bộ S-Tracking + báo khi đang xem bản lưu.
  const ghiChu = [
    ban.capNhatLuc ? `S-Tracking cập nhật ${gioVn(ban.capNhatLuc)}` : null,
    trangThai === "mat-song" ? "đang xem bản đã lưu" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  if (!ban.tau.length) {
    return (
      <p className="mt-3 text-[0.875rem] text-muted">
        Chưa thấy máy giám sát hành trình nào đăng ký số điện thoại này. Máy đăng ký số khác thì gọi SDVICO để cập nhật.
      </p>
    );
  }

  return (
    <div className="mt-3">
      <ul className="space-y-2">
        {ban.tau.map((t) => {
          const han = dongHan(t, homNay);
          const cb = ban.canhBao.filter((c) => c.imei && c.imei === t.imei).slice(0, CANH_BAO_MOI_TAU);
          const ten = t.tenTau ?? t.serial;
          return (
            <li key={t.serial} className="rounded-2xl bg-field px-4 py-3">
              <div className="flex items-stretch gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[1rem] font-semibold text-navy">{ten}</p>
                  <p className={`text-[0.875rem] font-semibold ${han.mau}`}>{han.chu}</p>
                  {dangTamNgung(t, homNay) && (
                    <p className="text-[0.875rem] text-muted">
                      Đang tạm ngưng{t.tamNgungDen ? ` tới ${ngayVn(t.tamNgungDen)}` : ""}
                    </p>
                  )}
                  {t.vai === "thuyen-truong" && <p className="text-[0.875rem] text-muted">Bạn là thuyền trưởng</p>}
                </div>
                {/^[\p{L}]{1,4}-\d{3,6}-[\p{L}]{1,4}$/u.test(ten) && (
                  <button
                    type="button"
                    onClick={() => onGiaHan({ id: `st-${t.serial}`, name: ten, maTau: ten })}
                    className={`${SQ_BTN} bg-background text-navy`}
                  >
                    <PlusIcon className="h-6 w-6" />
                    {NHAN.giaHan}
                  </button>
                )}
              </div>
              {cb.length > 0 && (
                <ul className="mt-2 space-y-0.5 border-t border-foreground/10 pt-2">
                  {cb.map((c) => (
                    <li key={`${c.loai}|${c.luc}`} className={`text-[0.875rem] ${c.muc === "Báo động" ? "text-danger" : "text-muted"}`}>
                      {c.loai} · {gioVn(c.luc)}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
      {ghiChu && <p className="mt-1.5 text-[0.875rem] text-muted">{ghiChu}</p>}
    </div>
  );
}

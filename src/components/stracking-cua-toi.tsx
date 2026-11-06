"use client";

import { useEffect, useRef, useState } from "react";
import { NHAN } from "@/lib/labels";
import { apiUrl } from "@/lib/api-base";
import { timeoutSignal } from "@/lib/abort";
import { tokenHeader } from "@/lib/device-token-store";
import { TAU_ACTION as SQ_BTN } from "@/components/tau-ui";
import { PlusIcon, TrashIcon } from "@/components/icons";
import { Popover } from "@/components/ui/popover";
import { CallButton } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SDVICO_HOTLINE } from "@/data/sdvico-showcase";
import type { GiaHanTau } from "@/lib/renewal";
import { homNayVn, trangThaiHan } from "@/lib/stracking/dong-bo.mjs";
import type { Boat } from "@/lib/boats";

/*
  MÁY GIÁM SÁT HÀNH TRÌNH CỦA TÔI — hạn cước S-Tracking (Viettel) thật, theo SĐT đang đăng nhập (2026-11-05).
  Máy GPU đồng bộ 07:30·12:20·17:20·21:00 ⇒ /api/stracking/cua-toi. Đặt TRONG khối "Giám sát hành trình" (vms-renewal.tsx),
  nút "Gia hạn" mỗi máy mở đúng wizard gia hạn sẵn có, điền mã tàu lấy từ S-Tracking (không phải tàu tự khai).

  YÊU CẦU GIA HẠN đang chạy của từng tàu (máy chủ ghép từ DB chung, 2026-11-05): đã gửi chờ CK / đã nhận tiền ⇒ hiện
  dòng trạng thái + ẨN nút Gia hạn (máy chủ cũng chặn trùng 409). SDVICO báo "đã gia hạn" CHƯA là xong: chỉ xong khi hạn
  S-Tracking lùi tới mốc mới (lib/renewal xacNhanGiaHan) — tới lúc đó "chờ hệ thống cập nhật hạn", quá 48 giờ ⇒ "gọi SDVICO".
  Gia hạn trong app chưa bật (`giaHanMo:false`) ⇒ MỘT nút Gọi SDVICO cuối khối (không lặp mỗi tàu).

  OFFLINE: hiện NGAY bản đã lưu (`forfish.stracking.v1`, gắn tài khoản — auth-scope xoá khi đổi/đăng xuất), rồi hỏi
  máy chủ có đồng hồ 12 s; mất sóng thì giữ bản lưu + giờ cập nhật, không treo, không xoá.

  CẢNH BÁO KHÔNG HIỆN Ở ĐÂY (2026-11-06, anh Long: "sao ko đẩy ra cái thông báo ở trang chủ, nó tính chung cho các loại
  thông báo… làm app rời rạc phân mảnh"). Thẻ này CHỈ là TRẠNG THÁI máy (hạn cước, tín hiệu, gia hạn). Cảnh báo SOS/mất
  GPS/vượt biên, nhắc mất tín hiệu, nhắc cước… máy chủ đã lọc theo mức + chống lặp (lib/stracking/thong-bao, nhac-nho) rồi
  ghi vào HỘP THƯ CHUNG ⇒ mục Thông báo ở Trang chủ; Sen Biển đọc từ đó ("có tin mới không"). Trước đây thẻ tự vẽ danh
  sách cảnh báo THÔ (không qua mức "bỏ", không chống lặp) + nút Nghe riêng ⇒ hai chỗ nói hai kiểu.
*/

export const STRACKING_CACHE_KEY = "forfish.stracking.v1";
const HET_GIO_MS = 12_000;

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
  /** Migration 0081 (anh Long 05/11: "quan trọng") — bản lưu cũ thiếu các ô này vẫn hợp lệ. */
  dongBoTcts?: string | null;
  nhom?: string | null;
  taoLuc?: string | null;
  capNhatNguon?: string | null;
  /** Tín hiệu thật (06/11): đang mất từ / đợt gần nhất có lại / giờ kiểm. Bản lưu cũ vắng ⇒ không nói gì về tín hiệu. */
  matKetNoiTu?: string | null;
  coLaiLuc?: string | null;
  ketNoiKiemLuc?: string | null;
  /** Có từ 2026-11-05 — bản lưu cũ thiếu ô này vẫn hợp lệ. */
  giaHan?: GiaHanTau | null;
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
  /** false = gia hạn trong app chưa bật phía máy chủ. Vắng (bản lưu cũ) = coi như bật. */
  giaHanMo?: boolean;
  tau: TauST[];
  canhBao: CanhBaoST[];
  /** Máy bà con tự "xoá" (0085, hệ thống chỉ ẩn) — để có "Hiện lại". Vắng (bản lưu cũ) = []. */
  daXoa?: MayDaXoa[];
}
interface MayDaXoa {
  serial: string;
  tenTau: string | null;
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
/** "06:45 06/11" — giờ VN. Intl vi-VN in ngày-tháng bằng gạch ngang ("06-11"), lệch với "07/12/2026" ngay dòng trên ⇒ ghép tay. */
function gioVn(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", hourCycle: "h23", timeZone: "Asia/Ho_Chi_Minh",
    })
      .formatToParts(new Date(t))
      .map((x) => [x.type, x.value]),
  );
  return `${p.hour}:${p.minute} ${p.day}/${p.month}`;
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

/** Dòng 3 bước của yêu cầu gia hạn (null = không có). Bản lưu cũ có loai lạ ("cho-gia-han", "cho-xac-nhan",
    "da-gia-han") ⇒ hiện như bước 2 — an toàn: KHÔNG bao giờ nói đã gia hạn khi chưa chắc. */
function dongGiaHan(g: GiaHanTau | null | undefined): { chu: string; mau: string } | null {
  if (!g) return null;
  if (g.loai === "cho-ck") return { chu: `Bước 1/3 · Chờ chuyển khoản · mã ${g.requestCode}`, mau: "text-warn" };
  if (g.loai === "xong")
    return { chu: `Bước 3/3 · Đã đổi hạn trên hệ thống${g.hanMoi ? ` tới ${ngayVn(g.hanMoi)}` : ""}`, mau: "text-ok" };
  if (g.loai === "lech") return { chu: "Đã nhận tiền hơn 2 ngày mà hạn chưa đổi · gọi SDVICO", mau: "text-danger" };
  return { chu: "Bước 2/3 · Đã nhận tiền · đang gia hạn", mau: "text-warn" };
}

/** Mốc phạt mất tín hiệu: ngoài khơi 6 giờ, nằm bờ 1 ngày không báo vị trí (anh Long 05–06/11). Chưa rõ ⇒ như ngoài khơi. */
const MOC_PHAT_GIO = { khoi: 6, bo: 24 } as const;

/** Dòng tín hiệu: đang mất ⇒ "Mất tín hiệu từ 13:40 06/11 · cần có lại trước 19:40 06/11" (đỏ); có ⇒ "có tín hiệu (kiểm 14:05)".
 *  Bản lưu cũ chưa có ô ⇒ null (không đoán). */
function dongTinHieu(t: TauST, nowMs: number): { matTin: boolean; chu: string } | null {
  if (!t.ketNoiKiemLuc && !t.matKetNoiTu) return null; // chưa từng kiểm (bản lưu cũ / tính năng chưa chạy) ⇒ không đoán
  if (t.matKetNoiTu) {
    const tu = Date.parse(t.matKetNoiTu);
    if (Number.isFinite(tu)) {
      const han = tu + (t.trongBo === true ? MOC_PHAT_GIO.bo : MOC_PHAT_GIO.khoi) * 3600_000;
      const chot = han > nowMs ? ` · cần có lại trước ${gioVn(new Date(han).toISOString())}` : " · đã quá mốc, gọi SDVICO";
      return { matTin: true, chu: `Mất tín hiệu từ ${gioVn(t.matKetNoiTu)}${chot}` };
    }
  }
  return { matTin: false, chu: `có tín hiệu (kiểm ${gioVn(t.ketNoiKiemLuc!)})` };
}

function dangTamNgung(t: TauST, homNay: string): boolean {
  return !!t.tamNgungTu && t.tamNgungTu <= homNay && (!t.tamNgungDen || t.tamNgungDen >= homNay);
}

export function StrackingCuaToi({
  onGiaHan,
  onGiaHanMo,
}: {
  onGiaHan: (boat: Boat, serial: string) => void;
  /** Báo khối cha gia hạn trong app đã bật chưa (bản lưu hoặc máy chủ) — để ẩn hàng "Yêu cầu" khi chưa bật. */
  onGiaHanMo?: (mo: boolean) => void;
}) {
  const [ban, setBan] = useState<BanST | null>(null);
  const [trangThai, setTrangThai] = useState<"dang-tai" | "xong" | "mat-song" | "chua-dang-nhap">("dang-tai");
  /*  XOÁ MÁY (anh Long 06/11: "ko gọi là ẩn mà là xoá, mặc dù trong hệ thống là ẩn"; máy đã xoá không còn thông báo).
      Cần sóng: mất sóng ⇒ báo một dòng, không đổi gì. Xong ⇒ dời máy sang "Đã xoá" ngay + ghi bản lưu. */
  const [canXoa, setCanXoa] = useState<TauST | null>(null);
  /** Menu ⋯ của một thẻ máy (03 §6 mục 9) — Xoá nằm trong menu, không chiếm hàng riêng. */
  const [menu, setMenu] = useState<{ tau: TauST; el: HTMLButtonElement } | null>(null);
  const [loiXoa, setLoiXoa] = useState<string | null>(null);
  const [lanTai, setLanTai] = useState(0);
  const onGiaHanMoRef = useRef(onGiaHanMo);
  useEffect(() => {
    onGiaHanMoRef.current = onGiaHanMo;
  });
  useEffect(() => {
    if (ban) onGiaHanMoRef.current?.(ban.giaHanMo !== false);
  }, [ban]);

  useEffect(() => {
    let song = true;
    setBan(docBan());
    fetch(apiUrl("/api/stracking/cua-toi"), { headers: { ...tokenHeader() }, signal: timeoutSignal(HET_GIO_MS) })
      .then(async (r) => {
        if (!song) return;
        if (r.status === 401) return setTrangThai("chua-dang-nhap");
        const j = (await r.json().catch(() => null)) as {
          ok?: boolean;
          capNhatLuc?: string | null;
          giaHanMo?: boolean;
          tau?: TauST[];
          canhBao?: CanhBaoST[];
          daXoa?: MayDaXoa[];
        } | null;
        if (!song) return;
        if (!r.ok || !j?.ok || !Array.isArray(j.tau) || !Array.isArray(j.canhBao)) return setTrangThai("mat-song");
        const moi: BanST = {
          v: 1,
          layLuc: new Date().toISOString(),
          capNhatLuc: j.capNhatLuc ?? null,
          giaHanMo: j.giaHanMo !== false,
          tau: j.tau,
          canhBao: j.canhBao,
          daXoa: Array.isArray(j.daXoa) ? j.daXoa : [],
        };
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
  }, [lanTai]);

  function luuBan(b: BanST) {
    setBan(b);
    try {
      localStorage.setItem(STRACKING_CACHE_KEY, JSON.stringify(b));
    } catch {
      /* kho đầy/riêng tư — chỉ không giữ cho lúc mất sóng */
    }
  }

  async function goiXoa(serial: string, cach: "POST" | "DELETE"): Promise<boolean> {
    try {
      const r = await fetch(apiUrl("/api/stracking/an"), {
        method: cach,
        headers: { "content-type": "application/json", ...tokenHeader() },
        body: JSON.stringify({ serial }),
        signal: timeoutSignal(HET_GIO_MS),
      });
      const j = (await r.json().catch(() => null)) as { ok?: boolean } | null;
      return r.ok && !!j?.ok;
    } catch {
      return false;
    }
  }

  async function xoaMay(t: TauST) {
    setCanXoa(null);
    setLoiXoa(null);
    if (!(await goiXoa(t.serial, "POST"))) return setLoiXoa("Chưa xoá được — cần có sóng, bà con thử lại sau.");
    if (ban)
      luuBan({
        ...ban,
        tau: ban.tau.filter((x) => x.serial !== t.serial),
        daXoa: [...(ban.daXoa ?? []), { serial: t.serial, tenTau: t.tenTau }],
      });
  }

  async function hienLai(m: MayDaXoa) {
    setLoiXoa(null);
    if (!(await goiXoa(m.serial, "DELETE"))) return setLoiXoa("Chưa hiện lại được — cần có sóng, bà con thử lại sau.");
    setLanTai((n) => n + 1); // tải lại để máy về đủ hạn, cảnh báo, gia hạn
  }

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

  const daXoa = ban.daXoa ?? [];
  const phanDuoi = (
    <>
      {loiXoa && (
        <p role="alert" className="mt-2 text-[0.875rem] font-semibold text-danger">
          {loiXoa}
        </p>
      )}
      {daXoa.length > 0 && (
        <details className="mt-2">
          <summary className="min-h-[2.75rem] cursor-pointer py-2 text-[0.875rem] font-semibold text-muted">Đã xoá {daXoa.length} máy</summary>
          <ul className="space-y-1">
            {daXoa.map((m) => (
              <li key={m.serial} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[0.875rem] text-muted">{m.tenTau ?? m.serial}</span>
                <button
                  type="button"
                  onClick={() => hienLai(m)}
                  className="min-h-[2.75rem] rounded-full px-3 text-[0.875rem] font-semibold text-sea"
                >
                  {NHAN.hienLai}
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
      {canXoa && (
        <ConfirmDialog
          title={`Xoá tàu ${canXoa.tenTau ?? canXoa.serial} khỏi danh sách?`}
          message="Máy này không còn hiện ở đây và bà con không nhận thông báo của nó nữa. Lỡ xoá nhầm thì bấm Hiện lại."
          confirmLabel={NHAN.xoa}
          onCancel={() => setCanXoa(null)}
          onConfirm={() => xoaMay(canXoa)}
        />
      )}
    </>
  );

  if (!ban.tau.length) {
    return (
      // Gia hạn CHỈ cho máy có trên S-Tracking của SĐT này ⇒ không có máy thì lối duy nhất là gọi SDVICO.
      <div className="mt-3">
        <div className="flex items-stretch gap-2">
          <p className="flex min-w-0 flex-1 items-center text-[0.875rem] text-muted">
            {daXoa.length
              ? "Bà con đã xoá hết máy khỏi danh sách."
              : "Chưa thấy máy giám sát hành trình nào đăng ký số điện thoại này. Máy đăng ký số khác thì gọi SDVICO để cập nhật và gia hạn."}
          </p>
          <CallButton phone={SDVICO_HOTLINE} label={NHAN.goiSdvico} />
        </div>
        {phanDuoi}
      </div>
    );
  }

  return (
    <div className="mt-3">
      <ul className="space-y-2">
        {ban.tau.map((t) => {
          const han = dongHan(t, homNay);
          const ten = t.tenTau ?? t.serial;
          const gh = dongGiaHan(t.giaHan);
          // Yêu cầu CHƯA XONG (bước 1/2/lệch) ⇒ ẩn nút, không trả tiền hai lần. Bước 3 xong rồi thì nút hiện lại.
          const dangMo = !!t.giaHan && t.giaHan.loai !== "xong";
          return (
            <li key={t.serial} className="rounded-2xl bg-field px-4 py-3">
              {/* Bố cục 06/11 (anh Long: "tự dưng làm 1 hàng trống xoá, rồi để cái gia hạn?"): MỘT hàng đầu = tên · Gia hạn · ⋯
                  (Xoá trong menu ⋯); dưới đó chữ trạng thái chạy hết bề ngang, không bị nút ép gãy dòng; một dòng màu cho hạn. */}
              <div className="flex items-center gap-2">
                <p className="min-w-0 flex-1 text-[1rem] font-semibold text-navy">{ten}</p>
                {!dangMo && ban.giaHanMo !== false && (
                  <button
                    type="button"
                    onClick={() => onGiaHan({ id: `st-${t.serial}`, name: ten, maTau: t.tenTau ?? undefined }, t.serial)}
                    className={`${SQ_BTN} bg-background text-navy`}
                  >
                    <PlusIcon className="h-6 w-6" />
                    {NHAN.giaHan}
                  </button>
                )}
                <button
                  type="button"
                  aria-label={`Thêm việc với ${ten}`}
                  aria-haspopup="menu"
                  aria-expanded={menu?.tau.serial === t.serial}
                  onClick={(e) => {
                    const el = e.currentTarget;
                    setMenu((m) => (m?.tau.serial === t.serial ? null : { tau: t, el }));
                  }}
                  className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[1.25rem] font-bold text-muted transition active:scale-[0.95]"
                >
                  ⋯
                </button>
              </div>
              <p className={`text-[0.875rem] font-semibold ${han.mau}`}>{han.chu}</p>
              {dangTamNgung(t, homNay) && (
                <p className="text-[0.875rem] text-muted">
                  Đang tạm ngưng{t.tamNgungDen ? ` tới ${ngayVn(t.tamNgungDen)}` : ""}
                </p>
              )}
              {gh && <p className={`text-[0.875rem] font-semibold ${gh.mau}`}>{gh.chu}</p>}
              {/* Trạng thái máy trên S-Tracking (0081). Đồng bộ thất bại mới là chuyện cần thấy ⇒ dòng đỏ riêng;
                  đồng bộ được thì gộp vào dòng mờ "Đã đồng bộ · Trong bờ · cập nhật 06:45 06/11". */}
              {t.dongBoTcts && /thất bại/i.test(t.dongBoTcts) && (
                <p className="text-[0.875rem] font-semibold text-danger">Chưa đồng bộ Tổng cục Thủy sản</p>
              )}
              {/* TÍN HIỆU THẬT (06/11, vụ GL-99280): bỏ "cập nhật HH:MM" — đó là giờ sửa bản ghi S-Tracking, nhân viên đọc
                  thành "6 giờ không tín hiệu". Đang mất ⇒ dòng đỏ + giờ chót (ngoài khơi 6 giờ, nằm bờ 1 ngày). */}
              {(() => {
                const tinHieu = dongTinHieu(t, Date.now());
                return tinHieu?.matTin ? <p className="text-[0.875rem] font-semibold text-danger">{tinHieu.chu}</p> : null;
              })()}
              {(() => {
                const tinHieu = dongTinHieu(t, Date.now());
                const dong = [
                  t.dongBoTcts && !/thất bại/i.test(t.dongBoTcts) ? "Đã đồng bộ" : null,
                  t.trongBo == null ? null : t.trongBo ? "Trong bờ" : "Ngoài khơi",
                  tinHieu && !tinHieu.matTin ? tinHieu.chu : null,
                ].filter(Boolean);
                return dong.length ? <p className="text-[0.875rem] text-muted">{dong.join(" · ")}</p> : null;
              })()}
            </li>
          );
        })}
      </ul>
      {/* Máy đã huỷ / bán mà hệ thống chưa nhận ra ⇒ bà con tự xoá (anh Hoà đề xuất, anh Long duyệt 06/11) — qua menu ⋯. */}
      {menu && (
        <Popover anchor={menu.el} label={`Việc với ${menu.tau.tenTau ?? menu.tau.serial}`} role="menu" onClose={() => setMenu(null)} className="w-[11rem] py-1">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setCanXoa(menu.tau);
              setMenu(null);
            }}
            className="flex h-11 w-full items-center gap-2 px-4 text-left text-[0.9375rem] font-semibold text-danger"
          >
            <TrashIcon className="h-5 w-5" />
            {NHAN.xoa}
          </button>
        </Popover>
      )}
      {ghiChu && <p className="mt-1.5 text-[0.875rem] text-muted">{ghiChu}</p>}
      {/* Gia hạn trong app chưa bật ⇒ MỘT nút gọi cho cả khối (anh Long 05/11: "tới 3 nút gọi? bố cục kém"), không lặp mỗi tàu. */}
      {ban.giaHanMo === false && (
        <div className="mt-3 flex items-center gap-2">
          <p className="min-w-0 flex-1 text-[0.875rem] text-muted">Gia hạn máy nào thì gọi SDVICO.</p>
          <CallButton phone={SDVICO_HOTLINE} label={NHAN.goiSdvico} />
        </div>
      )}
      {phanDuoi}
    </div>
  );
}

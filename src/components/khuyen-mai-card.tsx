"use client";
/*
  THẺ ƯU ĐÃI SDVICO + NGĂN ĐĂNG KÝ MUA (2026-10-26) — anh Long chuyển tin Zalo của Quân ("Vss Quân Bình Định"):
  sứ định vị giá thị trường 500k, mua qua app 200k, cho mọi khách cũ và mới. Khách bấm Đăng ký ⇒ POST
  /api/sdvico/khuyen-mai ⇒ phiếu `sdvico_khach_hoi` ⇒ AI Assistant nhắn Zalo cho Quân xử lý (14 §3.14b).

  Chỗ đặt: Trang chủ (dưới việc cần làm, trên Thông báo) + đầu Vật tư. Một thẻ MỘT HÀNG kiểu `.surface` (03 §0):
  ảnh thật của Quân chụp · tên · giá gạch → giá app · một câu đời thường · nút "Đăng ký" (NHAN, ≤2 chữ).
  Không emoji, không băng màu, không đếm ngược (Quân chưa cho hạn).

  Trạng thái (đủ ma trận trong code, nguyên tắc 4):
   · chưa đăng ký ⇒ nút Đăng ký
   · đã đăng ký (kho `forfish.km.v1` theo máy, xoá khi đổi tài khoản) ⇒ thẻ đổi thành "Đã đăng ký · SDVICO sẽ gọi", không bấm lại
   · mất sóng ⇒ vẫn THẤY ưu đãi (dữ liệu trong bundle), nút Gửi tắt + dòng "Mất sóng — mở lại khi có sóng" (không xếp hàng
     gửi sau: phiếu đi muộn vài ngày Quân gọi khách không nhớ)
   · gửi lỗi ⇒ câu lỗi + giữ nguyên chữ đã gõ · máy chủ báo `trung` ⇒ coi như xong (bấm hai lần không thành hai đơn)
   · hết hạn (`hetHan`) ⇒ thẻ tự ẩn
  Nhập liệu: đã đăng nhập ⇒ không hỏi SĐT (tài khoản là SĐT); khách lạ gõ SĐT + tên. Số tàu + nơi nhận điền sẵn từ Tàu tôi
  (tàu đang chọn: mã tàu, cảng nhà) — chỉ sửa khi cần.
*/
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { QtyStepper } from "@/components/cart-sheet";
import { CheckIcon } from "@/components/icons";
import { sanitizePhoneInput } from "@/components/auth-form";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Field, inputClass, PrimaryButton, textareaClass } from "@/components/ui/primitives";
import { baoToast } from "@/components/ui/toast";
import { FISHING_PORTS } from "@/data/fishing-ports";
import { conHieuLuc, KHUYEN_MAI, tienVn, type KhuyenMai } from "@/data/khuyen-mai";
import { timeoutSignal } from "@/lib/abort";
import { apiUrl } from "@/lib/api-base";
import { loadBoats, loadCurrentBoatId } from "@/lib/boats";
import { tokenHeader } from "@/lib/device-token-store";
import { NHAN } from "@/lib/labels";
import { useAuthUser } from "@/lib/use-auth";
import { useOnline } from "@/lib/use-online";

/** Kho "đã đăng ký" trong máy — `{ [idKM]: { at, phieu } }`. Ghi hỏng thì thôi (chỉ là dấu, phiếu đã ở máy chủ). */
const KHO_KEY = "forfish.km.v1";
type DaDangKy = Record<string, { at: number; phieu: string | null }>;
function docDaDangKy(): DaDangKy {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(KHO_KEY) : null;
    const v = raw ? (JSON.parse(raw) as unknown) : null;
    return v && typeof v === "object" ? (v as DaDangKy) : {};
  } catch {
    return {};
  }
}
function ghiDaDangKy(id: string, phieu: string | null) {
  try {
    const d = docDaDangKy();
    d[id] = { at: Date.now(), phieu };
    window.localStorage.setItem(KHO_KEY, JSON.stringify(d));
  } catch {
    /* mất dấu thì bấm lại máy chủ cũng trả `trung` */
  }
}

function homNay(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });
}

/** Thẻ ưu đãi — tự ẩn khi không còn ưu đãi nào hiệu lực. `gon` = bản một dòng (đầu Vật tư). */
export function KhuyenMaiCard({ className = "" }: { className?: string }) {
  const [daDK, setDaDK] = useState<DaDangKy>({});
  const [mo, setMo] = useState<KhuyenMai | null>(null);
  useEffect(() => setDaDK(docDaDangKy()), []);
  const today = homNay();
  const ds = KHUYEN_MAI.filter((k) => conHieuLuc(k, today));
  if (!ds.length) return null;
  return (
    <section className={className} aria-label="Ưu đãi SDVICO">
      <ul className="surface divide-y divide-line">
        {ds.map((k) => {
          const xong = daDK[k.id];
          return (
            <li key={k.id} className="flex items-center gap-3 px-3.5 py-3">
              <Image
                src={k.image}
                alt={k.ten}
                width={k.imgW}
                height={k.imgH}
                sizes="4.5rem"
                className="h-[4.5rem] w-[4.5rem] shrink-0 rounded-xl object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="text-[0.75rem] font-semibold uppercase tracking-wide text-foreground/55">Ưu đãi SDVICO</p>
                <p className="display line-clamp-2 text-[1.125rem] font-semibold leading-snug text-navy">{k.ten}</p>
                <p className="mt-0.5 text-[1rem] leading-snug">
                  <span className="text-foreground/50 line-through">{tienVn(k.giaThiTruong)}</span>{" "}
                  <span className="font-semibold text-t3">{tienVn(k.giaApp)}</span>
                </p>
                <p className="mt-0.5 truncate text-[0.875rem] text-foreground/65">
                  {xong ? "Đã đăng ký · SDVICO sẽ gọi lại" : k.moTa}
                </p>
              </div>
              {xong ? (
                <span
                  className="flex h-(--h-ctl) shrink-0 items-center gap-1 rounded-full px-3 text-[1rem] font-semibold"
                  style={{ backgroundColor: "var(--ok-bg)", color: "var(--ok)" }}
                >
                  <CheckIcon className="h-4 w-4" />
                  {NHAN.xong}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setMo(k)}
                  className="flex h-(--h-ctl) shrink-0 items-center rounded-full bg-t3 px-4 text-[1rem] font-semibold text-white transition active:scale-[0.97]"
                >
                  {NHAN.dangKy}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {mo && (
        <DangKySheet
          km={mo}
          onClose={() => setMo(null)}
          onXong={(phieu) => {
            ghiDaDangKy(mo.id, phieu);
            setDaDK(docDaDangKy());
          }}
        />
      )}
    </section>
  );
}

type Trang = "idle" | "sending" | "done" | "error";

function DangKySheet({ km, onClose, onXong }: { km: KhuyenMai; onClose: () => void; onXong: (phieu: string | null) => void }) {
  const { phone: sdtTaiKhoan, ready } = useAuthUser();
  const online = useOnline();
  // Điền sẵn từ Tàu tôi (một lần lúc mở ngăn — bà con sửa được).
  const tau = useMemo(() => {
    const boats = loadBoats();
    const id = loadCurrentBoatId();
    const b = boats.find((x) => x.id === id) ?? boats[0];
    const cang = b?.homePortId ? FISHING_PORTS.find((p) => p.id === b.homePortId)?.name : undefined;
    return { maTau: b?.maTau ?? "", cang: cang ?? b?.regPort ?? "", ten: b?.ownerName ?? "" };
  }, []);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [soTau, setSoTau] = useState(tau.maTau);
  const [noiNhan, setNoiNhan] = useState(tau.cang);
  const [qty, setQty] = useState(1);
  const [ghiChu, setGhiChu] = useState("");
  const [trang, setTrang] = useState<Trang>("idle");
  const [loi, setLoi] = useState<string | null>(null);

  function kiem(): string | null {
    if (!sdtTaiKhoan && phone.replace(/\D/g, "").length < 10) return "Bà con nhập số điện thoại để SDVICO gọi lại nhé.";
    if (soTau.trim().length < 3) return "Ghi số tàu (vd BĐ-91234-TS) để bên giao biết tàu nào.";
    if (noiNhan.trim().length < 2) return "Ghi cảng hay nơi muốn nhận hàng.";
    return null;
  }

  async function gui() {
    const l = kiem();
    if (l) {
      setLoi(l);
      setTrang("error");
      return;
    }
    setLoi(null);
    setTrang("sending");
    try {
      const r = await fetch(apiUrl("/api/sdvico/khuyen-mai"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...tokenHeader() },
        body: JSON.stringify({
          id: km.id,
          name: name.trim() || tau.ten || undefined,
          phone: sdtTaiKhoan ? undefined : phone.trim(),
          soTau: soTau.trim(),
          noiNhan: noiNhan.trim(),
          qty,
          ghiChu: ghiChu.trim() || undefined,
        }),
        signal: timeoutSignal(20000),
      });
      const j = (await r.json().catch(() => null)) as { ok?: boolean; code?: string; id?: string; trung?: boolean } | null;
      if (j?.ok) {
        onXong(typeof j.id === "string" ? j.id : null);
        setTrang("done");
        baoToast(j.trung ? "Bà con đã đăng ký rồi, SDVICO sẽ gọi lại." : "Đã đăng ký. SDVICO sẽ gọi lại cho bà con.");
        return;
      }
      setLoi(
        j?.code === "qua_tran"
          ? "Số này đã đăng ký nhiều lần hôm nay. SDVICO sẽ gọi lại, bà con chờ nhé."
          : j?.code === "sai_sdt"
            ? "Số điện thoại chưa đúng, bà con xem lại giúp."
            : j?.code === "het_han"
              ? "Ưu đãi này đã hết. Bà con gọi SDVICO để hỏi đợt mới."
              : "Chưa gửi được. Bà con thử lại, hoặc gọi SDVICO.",
      );
      setTrang("error");
    } catch {
      setLoi(online ? "Chưa gửi được. Bà con thử lại, hoặc gọi SDVICO." : "Mất sóng — bà con mở lại khi có sóng nhé.");
      setTrang("error");
    }
  }

  if (trang === "done") {
    return (
      <BottomSheet kieu="form" title="Đã đăng ký" onClose={onClose}>
        <div className="rounded-[1.25rem] px-4 py-8 text-center" style={{ backgroundColor: "var(--ok-bg)", color: "var(--ok)" }}>
          <CheckIcon className="mx-auto h-10 w-10" />
          <p className="mt-3 text-[1.125rem] font-semibold">SDVICO đã nhận đăng ký {km.ten}</p>
          <p className="mt-1 text-[1rem] text-foreground/70">
            {qty} cái · {tienVn(km.giaApp * qty)} · nhận tại {noiNhan.trim()}. Nhân viên sẽ gọi lại hẹn giao.
          </p>
        </div>
        <div className="mt-4">
          <PrimaryButton onClick={onClose}>{NHAN.xong}</PrimaryButton>
        </div>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet
      kieu="form"
      title={`Đăng ký ${km.ten}`}
      onClose={onClose}
      chan={{
        luu: trang === "sending" ? NHAN.dangGui : NHAN.gui,
        onLuu: () => void gui(),
        dangLuu: trang === "sending" || !ready || !online,
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void gui();
        }}
      >
        <div className="mb-3 flex items-center gap-3 rounded-2xl bg-field px-3.5 py-2.5">
          <Image src={km.image} alt="" width={km.imgW} height={km.imgH} sizes="3.5rem" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
          <div className="min-w-0">
            <p className="text-[1rem] font-semibold text-navy">
              <span className="text-foreground/50 line-through">{tienVn(km.giaThiTruong)}</span> {tienVn(km.giaApp)}/cái
            </p>
            <ul className="mt-0.5 text-[0.875rem] leading-snug text-foreground/70">
              {km.diemHay.slice(1).map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </div>
        </div>

        <Field label="Số lượng">
          <div className="flex items-center justify-between">
            <QtyStepper qty={qty} onChange={(q) => setQty(Math.min(km.qtyMax, Math.max(1, q)))} label="số lượng" />
            <p className="text-[1rem] font-semibold text-navy">{tienVn(km.giaApp * qty)}</p>
          </div>
        </Field>

        {ready && !sdtTaiKhoan && (
          <>
            <Field label="Số điện thoại (để SDVICO gọi lại)">
              <input value={phone} onChange={(e) => setPhone(sanitizePhoneInput(e.target.value))} className={inputClass} inputMode="tel" placeholder="VD: 0901234567" required />
            </Field>
            <Field label="Tên của bà con">
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="VD: anh Hai" />
            </Field>
          </>
        )}

        <Field label="Số tàu">
          <input value={soTau} onChange={(e) => setSoTau(e.target.value)} className={inputClass} placeholder="VD: BĐ-91234-TS" />
        </Field>
        <Field label="Nhận hàng tại (cảng / địa chỉ)">
          <input value={noiNhan} onChange={(e) => setNoiNhan(e.target.value)} className={inputClass} placeholder="VD: cảng Quy Nhơn" />
        </Field>
        <Field label="Ghi chú (nếu có)">
          <textarea value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} className={textareaClass} placeholder="VD: máy định vị Haiyang, tàu về bến thứ 7" />
        </Field>

        {sdtTaiKhoan && (
          <p className="mb-3 text-[1rem] font-semibold text-foreground/70">
            SDVICO sẽ gọi lại số <strong>{sdtTaiKhoan}</strong> để hẹn giao.
          </p>
        )}
        {!online && (
          <p className="mb-3 text-[1rem] font-semibold text-foreground/70">Mất sóng — bà con mở lại khi có sóng nhé.</p>
        )}
        {trang === "error" && loi && (
          <p role="alert" className="mb-3 rounded-2xl px-3.5 py-3 text-[1rem] font-semibold" style={{ color: "var(--danger)", backgroundColor: "var(--danger-bg)" }}>
            {loi}
          </p>
        )}
      </form>
    </BottomSheet>
  );
}

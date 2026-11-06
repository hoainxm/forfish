"use client";

/*
  "SỐ KHÁC CỦA TÔI" phía bà con (0086, anh Long 06/11: "phải có phương án bind với sdt này hoặc cho khách bổ sung sdt mua
  hàng sdvico, chứ vô đây là đang vô app rồi còn đăng nhập gì nữa").

  Đã đăng nhập mà chưa thấy đồ SDVICO theo số này (status "unlinked") ⇒ một hàng "Mua hàng bằng số khác?" + nút Thêm số
  ⇒ ngăn gõ số ⇒ /api/me/sdt-khac ghi dòng CHỜ DUYỆT + báo nhân viên. App chưa có OTP nên số chờ KHÔNG mở thêm gì;
  nhân viên gọi xác nhận rồi duyệt ở /quan-tri ⇒ đồ mua (và máy giám sát đứng tên số đó) tự hiện.
  Số đang chờ ⇒ một dòng "Đang chờ SDVICO xác nhận số …" + Rút số (gõ nhầm thì rút, khỏi chiếm chỗ trong 3 số).

  OFFLINE: gửi/rút cần sóng — mất sóng ⇒ câu lỗi trong ngăn, số đã gõ giữ nguyên, không ghi gì.
*/

import { useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Field, inputClass } from "@/components/ui/primitives";
import { PlusIcon } from "@/components/icons";
import { TAU_ACTION as SQ_BTN } from "@/components/tau-ui";
import { NHAN } from "@/lib/labels";
import { isValidVnPhone, sanitizePhoneInput } from "@/lib/phone";
import { SDT_KHAC_TOI_DA } from "@/lib/sdt-khac";
import { guiSoKhac, type SdvicoStatus } from "@/lib/use-sdvico-assets";

const CAU_LOI: Record<string, string> = {
  bad_sdt: "Số chưa đúng — số di động 10 số, bắt đầu bằng 0.",
  trung_sdt_chinh: "Đây là số bà con đang đăng nhập rồi.",
  toi_da: `Đã gửi đủ ${SDT_KHAC_TOI_DA} số — gọi SDVICO để đổi số.`,
  mat_song: "Cần có sóng để gửi — bà con thử lại sau.",
};

/** "0903333333" ⇒ "0903 333 333" — đọc số cho dễ soát; khoảng trắng KHÔNG NGẮT để số không gãy giữa hai dòng. */
function docSo(s: string): string {
  return s.replace(/^(\d{4})(\d{3})(\d{3})$/, "$1 $2 $3");
}

export function SoKhacCuaToi({ status, choDuyet, phone }: { status: SdvicoStatus; choDuyet: string[]; phone: string | null }) {
  const [mo, setMo] = useState(false);
  const [go, setGo] = useState("");
  const [dangGui, setDangGui] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);
  const [dangRut, setDangRut] = useState<string | null>(null);

  const moiThem = status === "unlinked" && choDuyet.length < SDT_KHAC_TOI_DA;
  if (!moiThem && choDuyet.length === 0) return null;

  async function gui() {
    if (!isValidVnPhone(go)) return setLoi(CAU_LOI.bad_sdt);
    setDangGui(true);
    setLoi(null);
    const kq = await guiSoKhac(go);
    setDangGui(false);
    if (kq.ok) {
      setMo(false);
      setGo("");
    } else setLoi(CAU_LOI[kq.code] ?? "Chưa gửi được — bà con gọi SDVICO giúp.");
  }

  async function rut(sdt: string) {
    setDangRut(sdt);
    await guiSoKhac(sdt, true);
    setDangRut(null);
  }

  return (
    <div className="mt-2.5 space-y-2">
      {choDuyet.map((s) => (
        <div key={s} className="flex items-center gap-2">
          <p className="min-w-0 flex-1 text-[0.875rem] leading-snug text-foreground/70">
            Đang chờ SDVICO xác nhận số {docSo(s)}. Xác nhận xong là đồ mua theo số đó hiện ở đây.
          </p>
          <button
            type="button"
            onClick={() => void rut(s)}
            disabled={dangRut === s}
            className="-mr-2 min-h-[2.75rem] shrink-0 rounded-full px-3 text-[0.875rem] font-semibold text-muted disabled:opacity-50"
          >
            {NHAN.rutSo}
          </button>
        </div>
      ))}
      {moiThem && (
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 text-[0.875rem] leading-snug text-foreground/70">
            {choDuyet.length
              ? "Còn số khác thì thêm tiếp."
              : `Chưa thấy đồ mua ở SDVICO theo số ${phone ? docSo(phone) : "này"}. Lúc mua dùng số khác thì thêm số đó.`}
          </p>
          <button type="button" onClick={() => setMo(true)} className={`${SQ_BTN} bg-field text-navy`}>
            <PlusIcon className="h-6 w-6" />
            {NHAN.themSo}
          </button>
        </div>
      )}
      {mo && (
        <BottomSheet
          kieu="form"
          title="Thêm số mua hàng"
          onClose={() => {
            setMo(false);
            setLoi(null);
          }}
          chan={{ luu: dangGui ? NHAN.dangGui : NHAN.gui, onLuu: () => void gui(), dangLuu: dangGui }}
        >
          <Field label="Số điện thoại lúc mua hàng" error={loi ?? undefined}>
            <input
              inputMode="numeric"
              autoComplete="tel"
              value={go}
              onChange={(e) => setGo(sanitizePhoneInput(e.target.value))}
              placeholder="0912 345 678"
              className={inputClass}
            />
          </Field>
          <p className="mt-3 text-[0.875rem] leading-snug text-muted">
            SDVICO gọi lại xác nhận số này là của bà con. Xong thì đồ mua và máy giám sát hành trình đứng tên số đó tự hiện
            ở đây.
          </p>
        </BottomSheet>
      )}
    </div>
  );
}

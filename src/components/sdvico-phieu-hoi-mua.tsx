"use client";

/*
  PHIẾU "NHỜ SDVICO GỌI LẠI" (14 §3.14, 0072; anh Long 2026-10-25: "bot phải làm rõ được các thông số cơ bản như sđt, số
  tàu, lắp ở cảng nào"). Mở từ thẻ SDVICO trả lời dưới bình luận Kairos (?sp=&p=&bl=). Điền sẵn từ máy: SĐT tài khoản,
  tàu đang có (số đăng ký), cảng nhà; thiếu ô nào máy chủ báo đúng ô đó. SĐT chỉ đi vào phiếu riêng — không bao giờ
  hiện dưới bình luận công khai. Mất sóng ⇒ "Cần sóng để gửi", chữ đã điền vẫn giữ trên màn (không tự gửi khi có sóng).
*/

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Field, inputClass, PrimaryButton } from "@/components/ui/primitives";
import { FISHING_PORTS } from "@/data/fishing-ports";
import { SDVICO_HOTLINE, SDVICO_HOTLINE_DISPLAY, SDVICO_SHOWCASE } from "@/data/sdvico-showcase";
import { apiUrl } from "@/lib/api-base";
import { timeoutSignal } from "@/lib/abort";
import { loadBoats } from "@/lib/boats";
import { tokenHeader } from "@/lib/device-token-store";
import { loadHome } from "@/lib/region";
import { useAuthUser } from "@/lib/use-auth";
import { useOnline } from "@/lib/use-online";

const LOI: Record<string, string> = {
  thieu_ten: "Bà con cho xin tên để bên kinh doanh xưng hô.",
  sai_sdt: "Số điện thoại chưa đúng — 10 số, bắt đầu bằng 0.",
  thieu_so_tau: "Bà con ghi số tàu (vd BĐ-91234-TS).",
  thieu_cang: "Bà con ghi cảng muốn lắp.",
  qua_dai: "Lời nhắn dài quá, bớt chút nha.",
  rate_limited: "Số này đã gửi nhiều phiếu hôm nay — SDVICO sẽ gọi lại, hoặc bà con gọi tổng đài.",
};

export function PhieuHoiMua() {
  const q = useSearchParams();
  const { phone: sdtTk } = useAuthUser();
  const online = useOnline();
  const [sp, setSp] = useState(() => (SDVICO_SHOWCASE.some((p) => p.id === q.get("sp")) ? q.get("sp")! : ""));
  const [ten, setTen] = useState("");
  const [phone, setPhone] = useState("");
  const [soTau, setSoTau] = useState("");
  const [cang, setCang] = useState("");
  const [loiNhan, setLoiNhan] = useState("");
  const [trangThai, setTrangThai] = useState<"nhap" | "gui" | "xong">("nhap");
  const [loi, setLoi] = useState("");
  const tau = useMemo(() => {
    try {
      return loadBoats();
    } catch {
      return [];
    }
  }, []);
  const cangs = useMemo(() => FISHING_PORTS.filter((p) => p.active !== false), []);

  // điền sẵn từ máy (một lần): SĐT tài khoản, tàu đầu tiên, cảng nhà — bà con chỉ việc xem lại
  useEffect(() => {
    if (sdtTk) setPhone((v) => v || sdtTk);
  }, [sdtTk]);
  useEffect(() => {
    const t = tau[0];
    if (t) setSoTau((v) => v || t.maTau || t.name);
    try {
      const nha = loadHome().portId;
      const ten = nha ? FISHING_PORTS.find((p) => p.id === nha)?.name : null;
      if (ten) setCang((v) => v || ten);
    } catch {
      // kho trong máy hỏng ⇒ bà con tự ghi
    }
  }, [tau]);

  const gui = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!online) return setLoi("Cần sóng để gửi — thông tin đã ghi vẫn còn trên màn, có sóng bấm gửi lại.");
    setTrangThai("gui");
    setLoi("");
    try {
      const r = await fetch(apiUrl("/api/sdvico/khach-hoi"), {
        method: "POST",
        headers: { "content-type": "application/json", ...tokenHeader() },
        body: JSON.stringify({
          nguon: "kairos", sanPham: sp || null, ten, phone, soTau, cang, loiNhan: loiNhan || null,
          kairosPostId: q.get("p"), kairosCommentId: q.get("bl"),
        }),
        signal: timeoutSignal(20_000),
      });
      const j = (await r.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (j?.ok) return setTrangThai("xong");
      setLoi(LOI[j?.error ?? ""] ?? `Chưa gửi được — bà con thử lại, hoặc gọi ${SDVICO_HOTLINE_DISPLAY}.`);
    } catch {
      setLoi("Mất sóng giữa chừng — thông tin vẫn còn trên màn, có sóng bấm gửi lại.");
    }
    setTrangThai("nhap");
  };

  if (trangThai === "xong")
    return (
      <div className="space-y-3 px-4 py-6 text-center">
        <p className="text-[1.125rem] font-bold text-navy">SDVICO đã nhận</p>
        <p className="text-[1rem] text-foreground/80">Bên kinh doanh SDVICO sẽ gọi lại số {phone} sớm. Gấp thì gọi tổng đài.</p>
        <a href={`tel:${SDVICO_HOTLINE}`} className="mx-auto flex h-12 max-w-xs items-center justify-center rounded-xl border border-line font-semibold text-sea">
          Gọi {SDVICO_HOTLINE_DISPLAY}
        </a>
        <Link href="/kairos" className="block text-[0.9375rem] font-semibold text-foreground/65">
          Về Kairos
        </Link>
      </div>
    );

  return (
    <form onSubmit={gui} className="px-4 pb-8 pt-2">
      <h1 className="mb-1 text-[1.25rem] font-bold text-navy">Nhờ SDVICO gọi lại</h1>
      <p className="mb-4 text-[0.9375rem] text-foreground/70">Thông tin chỉ gửi riêng cho bên kinh doanh SDVICO, không hiện công khai.</p>
      <Field label="Sản phẩm quan tâm">
        <select value={sp} onChange={(e) => setSp(e.target.value)} className={inputClass}>
          <option value="">Chưa chọn — để SDVICO tư vấn</option>
          {SDVICO_SHOWCASE.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Tên bà con">
        <input value={ten} onChange={(e) => setTen(e.target.value)} autoComplete="name" maxLength={80} className={inputClass} />
      </Field>
      <Field label="Số điện thoại">
        <input value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d+]/g, ""))} inputMode="tel" autoComplete="tel" maxLength={12} className={inputClass} />
      </Field>
      <Field label="Số tàu">
        <input value={soTau} onChange={(e) => setSoTau(e.target.value)} list="hoi-mua-tau" placeholder="vd BĐ-91234-TS" maxLength={30} className={inputClass} />
        <datalist id="hoi-mua-tau">
          {tau.map((t) => (
            <option key={t.id} value={t.maTau || t.name} />
          ))}
        </datalist>
      </Field>
      <Field label="Cảng muốn lắp">
        <input value={cang} onChange={(e) => setCang(e.target.value)} list="hoi-mua-cang" placeholder="vd Sa Huỳnh" maxLength={80} className={inputClass} />
        <datalist id="hoi-mua-cang">
          {cangs.map((c) => (
            <option key={c.id} value={c.name} />
          ))}
        </datalist>
      </Field>
      <Field label="Lời nhắn (nếu có)">
        <textarea value={loiNhan} onChange={(e) => setLoiNhan(e.target.value)} rows={3} maxLength={500} className={`${inputClass} h-auto py-2.5`} />
      </Field>
      {loi && (
        <p role="alert" className="mb-3 text-[0.9375rem] font-semibold text-danger">
          {loi}
        </p>
      )}
      <PrimaryButton type="submit" disabled={trangThai === "gui"} className="w-full">
        {trangThai === "gui" ? "Đang gửi…" : "Gửi cho SDVICO"}
      </PrimaryButton>
    </form>
  );
}

"use client";

/*
  VIỆC LÀM — MẢNH DÙNG CHUNG (spec 17 §6.3). Thẻ tin, cặp Gọi · Zalo, khung chờ, hộp mời đăng nhập, Báo xấu, ô chọn
  nhiều. Màn: viec-screen (danh sách) · viec-chi-tiet · ho-so-form · ho-so-chi-tiet · tin-cua-toi · dang-tin.

  GỌI · ZALO (§5, §6.4): danh sách KHÔNG có SĐT. Chạm Gọi ⇒ chưa đăng nhập: mời đăng nhập · có sóng: hỏi /lien-he rồi
  gọi (số chỉ nhớ trong bộ nhớ của màn đang mở) · mất sóng: báo "Cần sóng để lấy số". Máy KHÔNG cất số của người khác
  (anh Long 03/11: Việc làm là việc trên bờ, có sóng — chỉ chủ tàu mới cần offline). Zalo cần sóng.
*/

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AlertIcon, CommentIcon, PhoneIcon } from "@/components/icons";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { SQ_BTN } from "@/components/ui/sq-btn";
import { textareaClass } from "@/components/ui/primitives";
import { FISHING_PORTS } from "@/data/fishing-ports";
import { withNext } from "@/lib/auth-next";
import { telHref, zaloHref } from "@/lib/cho-ca";
import { ngheName } from "@/lib/kairos/ho-so";
import { NHAN } from "@/lib/labels";
import { baoToast } from "@/lib/toast";
import { useAuthUser } from "@/lib/use-auth";
import { useOnline } from "@/lib/use-online";
import { cauLoi, tenGiay, tenViTri, trangThaiTin, type ViecTin } from "@/lib/viec";
import { goiViec, guiJson } from "@/lib/viec-client";

const PORT = new Map(FISHING_PORTS.map((p) => [p.id, p]));
/** Tập id cảng hợp lệ — cho validateTin / validateHoSo chạy ở máy (cùng danh mục route dùng). */
export const PORT_IDS_CLIENT: ReadonlySet<string> = new Set(FISHING_PORTS.map((p) => p.id));
export const tenCang = (id: string): string => PORT.get(id)?.name ?? id;
export const tinhCang = (id: string): string => PORT.get(id)?.province ?? "";

/** "2026-11-20" ⇒ "20/11". Hỏng ⇒ chuỗi gốc. */
export function ngayNgan(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}` : iso;
}

export const viTriChu = (ids: readonly string[]) => ids.map(tenViTri).filter(Boolean).join(", ");
export const giayChu = (ids: readonly string[]) => ids.map(tenGiay).filter(Boolean).join(", ");

/* ── Khung chờ 3 thẻ (§6.4 Đang tải) ─────────────────────────────────────── */

export function ViecSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div aria-busy="true" aria-label="Đang tải" className="space-y-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="surface animate-pulse p-4">
          <div className="mb-2 h-4 w-1/2 rounded bg-field" />
          <div className="mb-2 h-3.5 w-5/6 rounded bg-field" />
          <div className="mb-4 h-3.5 w-2/3 rounded bg-field" />
          <div className="grid grid-cols-2 gap-2">
            <span className="h-(--h-ctl) rounded-xl bg-field" />
            <span className="h-(--h-ctl) rounded-xl bg-field" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Lỗi + Thử lại ───────────────────────────────────────────────────────── */

export function LoiThuLai({ cau, onThuLai }: { cau: string; onThuLai: () => void }) {
  return (
    <div className="surface px-4 py-6 text-center">
      <p className="text-[1rem] text-foreground/80">{cau}</p>
      <button type="button" onClick={onThuLai} className={`${SQ_BTN} mx-auto mt-3 bg-field text-sea`}>
        {NHAN.thuLai}
      </button>
    </div>
  );
}

/* ── Hộp mời đăng nhập ───────────────────────────────────────────────────── */

export function MoiDangNhap({ viec, onClose }: { viec: string; onClose: () => void }) {
  const pathname = usePathname() ?? "/viec";
  return (
    <BottomSheet title={`Cần tài khoản để ${viec}`} onClose={onClose}>
      <p className="text-[1rem] leading-snug text-foreground/80">Tạo nhanh bằng số điện thoại, hoặc đăng nhập nếu đã có.</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link href={withNext("/dang-ky", pathname)} className={`${SQ_BTN} w-full bg-trim text-white`}>
          {NHAN.dangKy}
        </Link>
        <Link href={withNext("/login", pathname)} className={`${SQ_BTN} w-full bg-field text-sea`}>
          {NHAN.dangNhap}
        </Link>
      </div>
    </BottomSheet>
  );
}

/* ── Gọi · Zalo ──────────────────────────────────────────────────────────── */

/**
 * Cặp Gọi · Zalo. `laySo` hỏi máy chủ SĐT (đã gác quyền ở route); `soMay` = số đã mở trong phiên này (bộ nhớ, không
 * kho máy); `nhoSo` = nhớ số vừa mở cho phiên. Dùng cho tin tuyển (mọi vai đăng nhập) và hồ sơ (chỉ chủ tàu — route trả 403 `vai`).
 */
export function GoiZalo({
  laySo,
  soMay,
  nhoSo,
  className = "",
}: {
  laySo: () => Promise<{ ok: true; phone: string } | { ok: false; status: number; code: string | null; message: string | null }>;
  soMay?: () => string | null;
  nhoSo?: (phone: string) => void;
  className?: string;
}) {
  const { signedIn } = useAuthUser();
  const online = useOnline();
  const [moiDN, setMoiDN] = useState(false);
  const [dang, setDang] = useState(false);
  const [so, setSo] = useState<string | null>(null);

  const lay = async (): Promise<string | null> => {
    const coSan = so ?? soMay?.() ?? null;
    if (coSan) return coSan;
    if (!online) {
      baoToast(`${NHAN.canSong} để lấy số`, { loai: "xau", ms: 3000 });
      return null;
    }
    setDang(true);
    const r = await laySo();
    setDang(false);
    if (!r.ok) {
      if (r.status === 401) setMoiDN(true);
      else baoToast(r.message ?? (r.status === 0 ? `${NHAN.canSong} để lấy số` : cauLoi(r.code)), { loai: "xau" });
      return null;
    }
    setSo(r.phone);
    nhoSo?.(r.phone);
    return r.phone;
  };

  const goi = async () => {
    if (!signedIn) return setMoiDN(true);
    const p = await lay();
    if (p) window.location.href = telHref(p);
  };
  const zalo = async () => {
    if (!signedIn) return setMoiDN(true);
    if (!online) return baoToast(`${NHAN.canSong} để mở Zalo`, { loai: "xau", ms: 3000 });
    const p = await lay();
    const url = p ? zaloHref(p) : null;
    if (p && !url) return baoToast("Số này không có Zalo — bà con gọi nhé.", { loai: "xau" });
    if (url && !window.open(url, "_blank", "noopener")) window.location.assign(url);
  };

  return (
    <>
      <div className={`grid grid-cols-2 gap-2 ${className}`}>
        <button type="button" onClick={goi} disabled={dang} className={`${SQ_BTN} w-full min-w-0 bg-sea text-white disabled:opacity-60`}>
          <PhoneIcon className="h-4 w-4" />
          {NHAN.goi}
        </button>
        <button
          type="button"
          onClick={zalo}
          disabled={dang}
          aria-disabled={!online || undefined}
          className={`${SQ_BTN} w-full min-w-0 bg-field text-sea disabled:opacity-60 ${online ? "" : "opacity-50"}`}
        >
          <CommentIcon className="h-4 w-4" />
          {NHAN.zalo}
        </button>
      </div>
      {moiDN && <MoiDangNhap viec="xem số liên hệ" onClose={() => setMoiDN(false)} />}
    </>
  );
}

/** Gọi · Zalo của một tin tuyển (đăng nhập mọi vai). */
export function GoiZaloTin({ tin, className }: { tin: ViecTin; className?: string }) {
  if (tin.cuaToi) return <p className={`text-[0.875rem] text-muted ${className ?? ""}`}>Tin của bà con.</p>;
  return (
    <GoiZalo
      className={className}
      laySo={async () => {
        const r = await goiViec<{ phone: string }>(`/api/viec/tin/${tin.id}/lien-he`);
        return r.ok ? { ok: true, phone: r.data.phone } : r;
      }}
    />
  );
}

/* ── Thẻ tin tuyển ───────────────────────────────────────────────────────── */

export function TinCard({ tin }: { tin: ViecTin }) {
  const [now] = useState(() => Date.now()); // mốc lúc vẽ thẻ — đủ cho nhãn Hết hạn
  const tt = trangThaiTin(tin, now);
  return (
    <article className="surface p-4">
      <Link href={`/viec/tin/${tin.id}`} className="block">
        <div className="flex items-start justify-between gap-2">
          <h3 className="display min-w-0 text-[1.0625rem] font-semibold leading-snug text-navy">
            {ngheName(tin.nghe) || "Tàu tuyển"} · cần {tin.soNguoi} người
          </h3>
          {tt !== "mo" && (
            <span className="shrink-0 rounded-full bg-field px-2.5 py-1 text-[0.75rem] font-semibold text-muted">
              {tt === "du" ? "Đủ người" : tt === "an" ? "Đang ẩn" : "Hết hạn"}
            </span>
          )}
        </div>
        <p className="mt-1 text-[0.9375rem] leading-snug text-foreground/85">{viTriChu(tin.viTri)}</p>
        <p className="mt-1 text-[0.875rem] text-muted">
          {tenCang(tin.portId)}
          {tin.ngayDi ? ` · đi ${ngayNgan(tin.ngayDi)}` : ""}
          {tin.soNgay ? ` · ${tin.soNgay} ngày` : ""}
        </p>
        {tin.cong && <p className="mt-1 line-clamp-1 text-[0.875rem] font-semibold text-foreground/80">Công: {tin.cong}</p>}
      </Link>
      <GoiZaloTin tin={tin} className="mt-3" />
    </article>
  );
}

/* ── Báo xấu ─────────────────────────────────────────────────────────────── */

export function BaoXauNut({ kind, id }: { kind: "post" | "seeker"; id: string }) {
  const { signedIn } = useAuthUser();
  const online = useOnline();
  const [mo, setMo] = useState(false);
  const [lyDo, setLyDo] = useState("");
  const [dang, setDang] = useState(false);
  const gui = async () => {
    if (!online) return baoToast(`${NHAN.canSong} để gửi báo xấu`, { loai: "xau" });
    setDang(true);
    const r = await goiViec(`/api/viec/bao-xau`, guiJson("POST", { kind, id, reason: lyDo.trim() || null }));
    setDang(false);
    if (!r.ok) return baoToast(r.message ?? cauLoi(r.code), { loai: "xau" });
    setMo(false);
    setLyDo("");
    baoToast("Đã gửi — người trực sẽ xem.", { loai: "tot" });
  };
  return (
    <>
      <button
        type="button"
        onClick={() => setMo(true)}
        className="inline-flex min-h-(--h-ctl) items-center gap-1.5 px-1 text-[0.875rem] font-semibold text-muted"
      >
        <AlertIcon className="h-4 w-4" />
        {NHAN.baoXau}
      </button>
      {mo && !signedIn && <MoiDangNhap viec="báo xấu" onClose={() => setMo(false)} />}
      {mo && signedIn && (
        <BottomSheet
          title={NHAN.baoXau}
          kieu="form"
          onClose={() => setMo(false)}
          chan={{ luu: NHAN.gui, onLuu: gui, dangLuu: dang }}
        >
          <label className="block">
            <span className="mb-1.5 block text-[0.875rem] font-semibold text-navy">Có gì không đúng? (không bắt buộc)</span>
            <textarea
              rows={3}
              maxLength={300}
              value={lyDo}
              onChange={(e) => setLyDo(e.target.value)}
              placeholder="Ví dụ: đòi tiền đặt cọc, số gọi không được…"
              className={textareaClass}
            />
          </label>
        </BottomSheet>
      )}
    </>
  );
}

/* ── Ô chọn nhiều (checkbox) ─────────────────────────────────────────────── */

export function ChonNhieu({
  ten,
  options,
  value,
  onChange,
  max,
  loi,
}: {
  ten: string;
  options: readonly { id: string; name: string }[];
  value: readonly string[];
  onChange: (v: string[]) => void;
  max?: number;
  loi?: string;
}) {
  return (
    <fieldset className="mb-3.5">
      <legend className="mb-1.5 block text-[0.875rem] font-semibold text-navy">{ten}</legend>
      <div className="grid grid-cols-2 gap-2">
        {options.map((o) => {
          const on = value.includes(o.id);
          const het = !on && max != null && value.length >= max;
          return (
            <label
              key={o.id}
              className={`flex min-h-(--h-ctl) items-center gap-2 rounded-xl border px-3 text-[0.9375rem] ${
                on ? "border-navy bg-field font-semibold text-navy" : "border-line bg-card text-foreground/85"
              } ${het ? "opacity-50" : ""}`}
            >
              <input
                type="checkbox"
                checked={on}
                disabled={het}
                onChange={() => onChange(on ? value.filter((x) => x !== o.id) : [...value, o.id])}
                className="h-4 w-4 shrink-0 accent-navy"
              />
              <span className="min-w-0">{o.name}</span>
            </label>
          );
        })}
      </div>
      {loi && (
        <p role="alert" className="mt-1.5 text-[0.875rem] text-danger">
          {loi}
        </p>
      )}
    </fieldset>
  );
}

/** Cảng đang hoạt động, gom theo tỉnh — cho ô <select>. */
export function CangOptions() {
  const byTinh = new Map<string, { id: string; name: string }[]>();
  for (const p of FISHING_PORTS) {
    if (!p.active) continue;
    const t = p.province ?? "Khác";
    byTinh.set(t, [...(byTinh.get(t) ?? []), { id: p.id, name: p.name }]);
  }
  return (
    <>
      {[...byTinh.entries()]
        .sort((a, b) => a[0].localeCompare(b[0], "vi"))
        .map(([t, ps]) => (
          <optgroup key={t} label={t}>
            {ps
              .sort((a, b) => a.name.localeCompare(b.name, "vi"))
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </optgroup>
        ))}
    </>
  );
}

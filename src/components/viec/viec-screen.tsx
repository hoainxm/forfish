"use client";

/*
  /viec — VIỆC LÀM (spec 17 §6.3, §6.4, §12.2–12.3). Hai tab: Tìm tàu (tin tuyển — mọi người, kể cả khách) ·
  Tìm người (hồ sơ tìm tàu — CHỈ vai chu-tau; vai khác không thấy tab). Đầu màn: Đăng tin + Tuyển người (chủ tàu) ·
  Hồ sơ (mọi vai).

  LỌC: tỉnh nhà theo khuôn HomeBar "Gần <Tỉnh> | Cả nước | Đổi" (cùng chỗ đọc tỉnh với Chợ cá) + Nghề + Vị trí;
  Tìm tàu thêm "Đã lưu" (tin lưu trong máy, `forfish.viec.luu.v1`).

  MA TRẬN TRẠNG THÁI (§6.4): đang tải = 3 thẻ giữ chỗ · trống = "Chưa có tàu tuyển ở <tỉnh>." + nút Cả nước ·
  lỗi = câu + Thử lại · mất sóng / mạng yếu = OfflineLine + bản lưu `forfish.viec.v1` (Gọi vẫn bấm được với số đã
  mở) · cực đoan: tối đa 100 tin/lượt, chữ dài cắt dòng trong thẻ.
*/

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BriefcaseIcon, PlusIcon, UsersIcon } from "@/components/icons";
import { ManHeader } from "@/components/man-header";
import { OfflineLine } from "@/components/ui/offline-line";
import { inputClass } from "@/components/ui/primitives";
import { HomeBar, useHome } from "@/components/ui/region-filter";
import { SQ_BTN } from "@/components/ui/sq-btn";
import { Tabs } from "@/components/ui/tabs";
import { ToastHost } from "@/components/ui/toast";
import { FISHING_PORTS } from "@/data/fishing-ports";
import { NGHE, ngheName } from "@/lib/kairos/ho-so";
import { NHAN } from "@/lib/labels";
import { useOnline } from "@/lib/use-online";
import { useVai } from "@/lib/use-vai";
import { cangCuaTinh, cauLoi, trangThaiTin, VI_TRI, type ViecHoSo, type ViecTin } from "@/lib/viec";
import { docCache, docLuu, ghiCache, goiViec, VIEC_LUU_EVENT } from "@/lib/viec-client";
import { LoiThuLai, TinCard, ViecSkeleton, giayChu, tenCang, viTriChu } from "./viec-chung";

type Tai<T> =
  | { kind: "dang" }
  | { kind: "xong"; items: T[]; luc: number; banLuu: boolean }
  | { kind: "loi"; cau: string };

type Loc = { tinh: string | null; nghe: string; viTri: string };

function query(loc: Loc): string {
  const sp = new URLSearchParams();
  if (loc.tinh) sp.set("tinh", loc.tinh);
  if (loc.nghe) sp.set("nghe", loc.nghe);
  if (loc.viTri) sp.set("viTri", loc.viTri);
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/** Lọc bản lưu trong máy theo cùng luật route (mất sóng). */
function locTrongMay(items: ViecTin[], loc: Loc, now: number): ViecTin[] {
  const ports = loc.tinh ? new Set(cangCuaTinh(loc.tinh, FISHING_PORTS)) : null;
  return items.filter(
    (t) =>
      trangThaiTin(t, now) === "mo" &&
      (!ports || ports.has(t.portId)) &&
      (!loc.nghe || t.nghe === loc.nghe) &&
      (!loc.viTri || t.viTri.includes(loc.viTri)),
  );
}

export function ViecScreen() {
  const { vai, phone } = useVai();
  const chuTau = vai === "chu-tau";
  const { home } = useHome();
  const [gan, setGan] = useState(true);
  const [nghe, setNghe] = useState("");
  const [viTri, setViTri] = useState("");
  const [tab, setTab] = useState("tau");
  const loc: Loc = { tinh: gan && home.province ? home.province : null, nghe, viTri };

  return (
    <div className="pb-24">
      <ManHeader title={NHAN.viecLam} sub="Tìm tàu đi biển, tìm bạn thuyền — gọi thẳng, không qua môi giới." />
      <div className="px-4">
        <div className="mb-3 flex flex-wrap gap-2">
          {chuTau && (
            <>
              <Link href="/viec/dang" className={`${SQ_BTN} bg-trim text-white`}>
                <PlusIcon className="h-4 w-4" />
                {NHAN.dangTin}
              </Link>
              <Link href="/viec/cua-toi" className={`${SQ_BTN} bg-field text-sea`}>
                <BriefcaseIcon className="h-4 w-4" />
                {NHAN.tuyenNguoi}
              </Link>
            </>
          )}
          <Link href="/viec/ho-so" className={`${SQ_BTN} bg-field text-sea`}>
            <UsersIcon className="h-4 w-4" />
            {NHAN.hoSo}
          </Link>
        </div>

        <HomeBar home={home} near={gan} setNear={setGan} />
        <div className="mb-3 grid grid-cols-2 gap-2">
          <label className="block">
            <span className="sr-only">Nghề</span>
            <select value={nghe} onChange={(e) => setNghe(e.target.value)} className={inputClass}>
              <option value="">Mọi nghề</option>
              {NGHE.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="sr-only">{NHAN.viTri}</span>
            <select value={viTri} onChange={(e) => setViTri(e.target.value)} className={inputClass}>
              <option value="">Mọi vị trí</option>
              {VI_TRI.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {chuTau ? (
        <Tabs
          ariaLabel={NHAN.viecLam}
          paramKey="tab"
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "tau", label: NHAN.timTau, content: <TimTau loc={loc} phone={phone} onCaNuoc={() => setGan(false)} /> },
            { id: "nguoi", label: NHAN.timNguoi, content: <TimNguoi loc={loc} onCaNuoc={() => setGan(false)} /> },
          ]}
        />
      ) : (
        <TimTau loc={loc} phone={phone} onCaNuoc={() => setGan(false)} />
      )}
      <ToastHost />
    </div>
  );
}

/* ── Tab Tìm tàu ─────────────────────────────────────────────────────────── */

function TimTau({ loc, phone, onCaNuoc }: { loc: Loc; phone: string | null; onCaNuoc: () => void }) {
  const online = useOnline();
  const [tai, setTai] = useState<Tai<ViecTin>>({ kind: "dang" });
  const [chiLuu, setChiLuu] = useState(false);
  const [luu, setLuu] = useState<ViecTin[]>([]);
  const q = query(loc);
  const run = useRef(0);

  const load = useCallback(async () => {
    const my = ++run.current;
    setTai((t) => (t.kind === "xong" ? t : { kind: "dang" }));
    const banLuu = () => {
      const c = docCache();
      return c ? ({ kind: "xong", items: locTrongMay(c.tin, loc, Date.now()), luc: c.luc, banLuu: true } as const) : null;
    };
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      const b = banLuu();
      setTai(b ?? { kind: "loi", cau: "Mất sóng — có sóng sẽ tải tin tuyển." });
      return;
    }
    const r = await goiViec<{ items: ViecTin[]; luc: number }>(`/api/viec${q}`);
    if (my !== run.current) return;
    if (r.ok) {
      ghiCache(r.data.items, r.data.luc);
      setTai({ kind: "xong", items: r.data.items, luc: r.data.luc, banLuu: false });
      return;
    }
    const b = banLuu();
    setTai(b ?? { kind: "loi", cau: r.status === 0 ? "Mạng yếu, chưa tải được tin tuyển." : cauLoi(r.code) });
    // q gói đủ loc; phone đổi (đăng nhập) ⇒ tải lại để có dấu "Tin của bà con"
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, phone]);

  useEffect(() => {
    void load();
  }, [load]);
  // có sóng lại ⇒ tải bản mới
  useEffect(() => {
    if (online && tai.kind === "xong" && tai.banLuu) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  useEffect(() => {
    const doc = () => setLuu(docLuu());
    doc();
    window.addEventListener(VIEC_LUU_EVENT, doc);
    window.addEventListener("storage", doc);
    return () => {
      window.removeEventListener(VIEC_LUU_EVENT, doc);
      window.removeEventListener("storage", doc);
    };
  }, []);

  const items = useMemo(() => (chiLuu ? luu : tai.kind === "xong" ? tai.items : []), [chiLuu, luu, tai]);

  return (
    <section className="px-4" aria-label={NHAN.timTau}>
      <div className="mb-3 flex gap-2">
        <button
          type="button"
          aria-pressed={!chiLuu}
          onClick={() => setChiLuu(false)}
          className={`h-(--h-chip) min-w-[5.5rem] rounded-full px-3 text-[0.875rem] font-semibold ${!chiLuu ? "bg-navy text-white" : "bg-field text-foreground/70"}`}
        >
          {NHAN.tatCa}
        </button>
        <button
          type="button"
          aria-pressed={chiLuu}
          onClick={() => setChiLuu(true)}
          className={`h-(--h-chip) min-w-[5.5rem] rounded-full px-3 text-[0.875rem] font-semibold ${chiLuu ? "bg-navy text-white" : "bg-field text-foreground/70"}`}
        >
          {NHAN.daLuu}
          {luu.length > 0 && <span className="ml-1 opacity-75">{luu.length}</span>}
        </button>
      </div>

      {!chiLuu && tai.kind === "xong" && tai.banLuu && (
        <div className="mb-3">
          <OfflineLine savedAt={tai.luc} />
        </div>
      )}

      {chiLuu ? (
        items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-[1rem] text-muted">
            Chưa lưu tin nào. Mở một tin rồi chạm {NHAN.luu} để gọi sau.
          </p>
        ) : (
          <div className="space-y-3">
            {items.map((t) => (
              <TinCard key={t.id} tin={t} />
            ))}
          </div>
        )
      ) : tai.kind === "dang" ? (
        <ViecSkeleton />
      ) : tai.kind === "loi" ? (
        <LoiThuLai cau={tai.cau} onThuLai={() => void load()} />
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line px-4 py-8 text-center">
          <p className="text-[1rem] text-muted">Chưa có tàu tuyển ở {loc.tinh ?? "cả nước"}.</p>
          {loc.tinh && (
            <button type="button" onClick={onCaNuoc} className={`${SQ_BTN} mx-auto mt-3 bg-field text-sea`}>
              {NHAN.caNuoc}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((t) => (
            <TinCard key={t.id} tin={t} />
          ))}
        </div>
      )}
    </section>
  );
}

/* ── Tab Tìm người (chỉ chủ tàu) ─────────────────────────────────────────── */

function TimNguoi({ loc, onCaNuoc }: { loc: Loc; onCaNuoc: () => void }) {
  const [tai, setTai] = useState<Tai<ViecHoSo>>({ kind: "dang" });
  const q = query(loc);
  const run = useRef(0);

  const load = useCallback(async () => {
    const my = ++run.current;
    setTai({ kind: "dang" });
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setTai({ kind: "loi", cau: "Mất sóng — có sóng sẽ tải danh sách người tìm tàu." });
      return;
    }
    const r = await goiViec<{ items: ViecHoSo[]; luc: number }>(`/api/viec/nguoi${q}`);
    if (my !== run.current) return;
    if (r.ok) setTai({ kind: "xong", items: r.data.items, luc: r.data.luc, banLuu: false });
    else setTai({ kind: "loi", cau: r.message ?? (r.status === 0 ? "Mạng yếu, chưa tải được danh sách." : cauLoi(r.code)) });
  }, [q]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="px-4" aria-label={NHAN.timNguoi}>
      {tai.kind === "dang" ? (
        <ViecSkeleton />
      ) : tai.kind === "loi" ? (
        <LoiThuLai cau={tai.cau} onThuLai={() => void load()} />
      ) : tai.items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line px-4 py-8 text-center">
          <p className="text-[1rem] text-muted">Chưa có ai tìm tàu ở {loc.tinh ?? "cả nước"}.</p>
          {loc.tinh && (
            <button type="button" onClick={onCaNuoc} className={`${SQ_BTN} mx-auto mt-3 bg-field text-sea`}>
              {NHAN.caNuoc}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {tai.items.map((h) => (
            <Link key={h.id} href={`/viec/ho-so/${h.id}`} className="surface block p-4">
              <h3 className="display text-[1.0625rem] font-semibold text-navy">{h.ten}</h3>
              <p className="mt-1 text-[0.9375rem] text-foreground/85">{viTriChu(h.viTri)}</p>
              <p className="mt-1 text-[0.875rem] text-muted">
                {h.nghe.map(ngheName).filter(Boolean).join(", ")}
                {h.soNam != null ? ` · ${h.soNam} năm đi biển` : ""}
              </p>
              <p className="mt-1 text-[0.875rem] text-muted">Muốn đi: {h.ports.map(tenCang).join(", ")}</p>
              {h.giay.length > 0 && <p className="mt-1 text-[0.875rem] text-muted">Có: {giayChu(h.giay)}</p>}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

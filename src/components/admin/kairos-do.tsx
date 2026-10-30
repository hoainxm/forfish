"use client";

/*
  /quan-tri › Kairos › ĐO (14 §22) — CDP nội bộ SDVICO: khách đọc tin thế nào, thẻ Tài trợ được xem/bấm bao nhiêu,
  đọc tin có ra đơn không, và NHÓM KHÁCH để người bán gọi đúng người. Chỉ khách thật (không agent/test/nhân viên).
  Số liệu: một lần gọi /api/admin/kairos/do (hàm DB kairos_do, 0077); chia nhóm + tỷ lệ ở lib/kairos/do-khach.ts.
  SĐT + tên: chỉ quản trị viên (máy chủ che cho quản lý). Mất sóng / 0077 chưa áp ⇒ hộp lỗi nói rõ, không giả số 0.
*/

import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyBox, ErrorBox, FilterChip, LoadingBox } from "@/components/admin/market-admin-shared";
import { fmtDT } from "@/components/admin/quan-tri-chung";
import { FISHING_PORTS } from "@/data/fishing-ports";
import { timeoutSignal } from "@/lib/abort";
import { apiUrl } from "@/lib/api-base";
import { tokenHeader } from "@/lib/device-token-store";
import {
  chuDeChinh, DO_KHOANG, khachTrongNhom, NHOM, phanTram, tongHop, type DoKhoang, type DoTho, type NhomId,
} from "@/lib/kairos/do-khach";
import { NHAN_CHIP_KAIROS } from "@/lib/labels";

type Resp = DoTho & { days: DoKhoang; xemSdt: boolean; tenTaiTro: Record<string, string> };

const LOI: Record<string, string> = {
  not_migrated: "Chưa có số liệu Đo — cần áp migration 0077 lên Supabase.",
  no_permission: "Bạn chưa được cấp quyền xem tab Kairos.",
  login_required: "Phiên đăng nhập đã hết — đăng nhập lại.",
};

async function tai(days: DoKhoang): Promise<Resp> {
  const r = await fetch(apiUrl(`/api/admin/kairos/do?days=${days}`), {
    cache: "no-store", headers: tokenHeader(), signal: timeoutSignal(20_000),
  }).catch(() => null);
  if (!r) throw new Error("Không có mạng hoặc máy chủ không trả lời — thử lại.");
  const j = (await r.json().catch(() => null)) as (Resp & { ok?: boolean; code?: string }) | null;
  if (!r.ok || !j?.ok) throw new Error((j?.code && LOI[j.code]) || "Chưa tải được số liệu — thử lại.");
  return j;
}

const tenChuDe = (t: string | null) => (t ? (NHAN_CHIP_KAIROS as Record<string, string>)[t] ?? t : "—");
const tenCang = (id: string | null) => (id ? FISHING_PORTS.find((p) => p.id === id)?.name ?? id : null);
const so = (n: number) => n.toLocaleString("vi-VN");

function O({ nhan, giaTri, phu }: { nhan: string; giaTri: string; phu?: string }) {
  return (
    <div className="surface px-4 py-3">
      <p className="text-[0.8125rem] text-muted">{nhan}</p>
      <p className="text-[1.375rem] font-bold leading-tight text-navy tabular-nums">{giaTri}</p>
      {phu && <p className="text-[0.8125rem] leading-snug text-muted">{phu}</p>}
    </div>
  );
}

/** CSV cho người bán (Excel đọc được tiếng Việt nhờ BOM). */
function taiCsv(rows: Resp["khach"], ten: string) {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const dau = ["SĐT", "Tên", "Hạng", "Cảng nhà", "Chủ đề hay đọc", "Bài lướt", "Bài mở", "Giây đọc", "Xem tài trợ", "Bấm tài trợ", "Đơn/hỏi mua", "Lần mở app"];
  const dong = rows.map((k) => [k.phone, k.name, k.tier, tenCang(k.cang), tenChuDe(chuDeChinh(k.chuDe)), k.baiXem, k.baiMo, k.giayDoc, k.ttXem, k.ttBam, k.don, k.lanMo].map(esc).join(","));
  const blob = new Blob([`﻿${dau.map(esc).join(",")}\n${dong.join("\n")}`], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `kairos-${ten}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function DoSection() {
  const [days, setDays] = useState<DoKhoang>(30);
  const [d, setD] = useState<Resp | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [nhom, setNhom] = useState<NhomId>("bam-chua-mua");

  const load = useCallback(() => {
    setErr(null);
    setD(null);
    tai(days).then(setD).catch((e: Error) => setErr(e.message));
  }, [days]);
  useEffect(load, [load]);

  const th = useMemo(() => (d ? tongHop(d) : null), [d]);
  const ds = useMemo(() => (d ? khachTrongNhom(d, nhom) : []), [d, nhom]);
  const nhomInfo = NHOM.find((n) => n.id === nhom)!;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {DO_KHOANG.map((n) => (
          <FilterChip key={n} label={`${n} ngày`} active={days === n} onClick={() => setDays(n)} />
        ))}
      </div>
      {err ? (
        <ErrorBox text={err} onRetry={load} />
      ) : !d || !th ? (
        <LoadingBox what="số liệu Kairos" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            <O nhan="Khách hoạt động" giaTri={so(th.hoatDong)} phu={`trên ${so(th.tongKhach)} khách`} />
            <O nhan="Có đọc Kairos" giaTri={phanTram(th.tyLeDoc)} phu={`${so(th.nguoiDoc)} người`} />
            <O nhan="Mở bài" giaTri={phanTram(th.tyLeMo)} phu={`${so(th.baiMo)} / ${so(th.baiXem)} bài lướt qua`} />
            <O nhan="Đọc mỗi bài mở" giaTri={th.giayMoiBai == null ? "—" : `${so(th.giayMoiBai)} giây`} />
            <O nhan="Bấm tài trợ" giaTri={phanTram(th.ctr)} phu={`${so(th.ttBam)} bấm / ${so(th.ttXem)} lượt xem`} />
            <O nhan="Có đơn / hỏi mua" giaTri={phanTram(th.muaCoDoc)} phu={`người đọc · không đọc: ${phanTram(th.muaKhongDoc)}`} />
          </div>

          <section className="surface overflow-x-auto px-4 py-3">
            <h3 className="pb-2 text-[1rem] font-bold text-navy">Theo chủ đề</h3>
            {d.chuDe.length === 0 ? (
              <p className="text-[0.875rem] text-muted">Chưa có ai đọc trong {days} ngày.</p>
            ) : (
              <table className="w-full text-left text-[0.875rem] tabular-nums whitespace-nowrap [&_td]:pr-3 [&_th]:pr-3">
                <thead className="text-muted">
                  <tr><th className="py-1 font-semibold">Chủ đề</th><th>Người</th><th>Bài lướt</th><th>Mở</th><th>Tỷ lệ mở</th><th>Giây / bài mở</th></tr>
                </thead>
                <tbody>
                  {d.chuDe.map((c) => (
                    <tr key={c.topic} className="border-t border-line">
                      <td className="py-1.5 font-semibold">{tenChuDe(c.topic)}</td>
                      <td>{so(c.nguoi)}</td><td>{so(c.baiXem)}</td><td>{so(c.baiMo)}</td>
                      <td>{phanTram(c.baiXem ? c.baiMo / c.baiXem : null)}</td>
                      <td>{c.baiMo ? so(Math.round(c.giayDoc / c.baiMo)) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="surface overflow-x-auto px-4 py-3">
            <h3 className="pb-2 text-[1rem] font-bold text-navy">Bài tài trợ</h3>
            {d.taiTro.length === 0 ? (
              <p className="text-[0.875rem] text-muted">Chưa có lượt xem thẻ tài trợ nào trong {days} ngày.</p>
            ) : (
              <table className="w-full text-left text-[0.875rem] tabular-nums whitespace-nowrap [&_td]:pr-3 [&_th]:pr-3">
                <thead className="text-muted">
                  <tr><th className="py-1 font-semibold">Bài</th><th>Người xem</th><th>Lượt xem</th><th>Người bấm</th><th>Lượt bấm</th><th>Tỷ lệ bấm</th></tr>
                </thead>
                <tbody>
                  {d.taiTro.map((t) => (
                    <tr key={t.id} className="border-t border-line">
                      <td className="max-w-[16rem] truncate py-1.5 font-semibold" title={d.tenTaiTro[t.id]}>{d.tenTaiTro[t.id] ?? `${t.id} (đã xoá)`}</td>
                      <td>{so(t.nguoiXem)}</td><td>{so(t.luotXem)}</td><td>{so(t.nguoiBam)}</td><td>{so(t.luotBam)}</td>
                      <td>{phanTram(t.luotXem ? t.luotBam / t.luotXem : null)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="text-[1rem] font-bold text-navy">Nhóm khách</h3>
            <div className="flex flex-wrap gap-1.5">
              {NHOM.map((n) => (
                <FilterChip key={n.id} label={`${n.ten} · ${so(th.nhom[n.id])}`} active={nhom === n.id} onClick={() => setNhom(n.id)} />
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[0.875rem] leading-snug text-foreground/70">{nhomInfo.viec}</p>
              {d.xemSdt && ds.length > 0 && (
                <button type="button" className="h-11 rounded-xl border border-line px-4 text-[0.9375rem] font-semibold" onClick={() => taiCsv(ds, `${nhom}-${days}ngay`)}>
                  Tải CSV
                </button>
              )}
            </div>
            {ds.length === 0 ? (
              <EmptyBox text="Chưa có khách nào trong nhóm này." />
            ) : (
              <div className="surface overflow-x-auto px-4 py-2">
                <table className="w-full text-left text-[0.875rem] tabular-nums whitespace-nowrap [&_td]:pr-3 [&_th]:pr-3">
                  <thead className="text-muted">
                    <tr><th className="py-1 font-semibold">Khách</th><th>Hay đọc</th><th>Lướt / mở</th><th>Tài trợ</th><th>Đơn</th><th>Lần mở app</th></tr>
                  </thead>
                  <tbody>
                    {ds.slice(0, 200).map((k, i) => (
                      <tr key={`${k.phone}-${i}`} className="border-t border-line">
                        <td className="py-1.5">
                          {d.xemSdt ? <a href={`tel:${k.phone}`} className="font-semibold text-sea">{k.phone}</a> : <span className="font-semibold">{k.phone}</span>}
                          <span className="block text-[0.8125rem] text-muted">
                            {[k.name, k.tier === "premium" ? "Premium" : null, tenCang(k.cang)].filter(Boolean).join(" · ") || "—"}
                          </span>
                        </td>
                        <td>{tenChuDe(chuDeChinh(k.chuDe))}</td>
                        <td>{so(k.baiXem)} / {so(k.baiMo)}</td>
                        <td>{k.ttBam ? `${so(k.ttBam)} bấm` : k.ttXem ? `${so(k.ttXem)} xem` : "—"}</td>
                        <td>{so(k.don)}</td>
                        <td className="whitespace-nowrap">{fmtDT(k.lanMo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {ds.length > 200 && <p className="py-2 text-[0.8125rem] text-muted">Hiện 200 / {so(ds.length)} — tải CSV để xem hết.</p>}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

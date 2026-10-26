"use client";

/*
  HẠN GIẤY CỦA BÀ CON DƯỚI BÀI LUẬT SEN BIỂN (14 §21f — anh Long 2026-10-26: "cái gia hạn thì theo luồng thông tin bà
  con có sẵn, rồi yêu cầu bà con nhập thông tin để sen biển hỗ trợ theo dõi và nhắc bà con khi gần tới hạn để tránh bị
  phạt").

  Chỉ dưới bài Sen Biển tuyên truyền luật mà mục luật nói về một giấy có hạn (han-giay.GIAY_CUA_MUC). Đọc tủ giấy tờ
  (`forfish.documents.v1`, tàu đang chọn) + sổ thuyền viên (`forfish.crew.v1`) TRONG MÁY — không request, mất sóng vẫn
  đúng. Mỗi giấy một hàng: tên giấy · hạn (đỏ đã hết / cam sắp hết / xám còn hạn) · nút:
   · Nhập — chưa lưu giấy, hoặc lưu mà chưa có ngày hết hạn ⇒ /tau?tab=giay-to&giay=<loại> mở form đúng loại
   · Sửa  — đã hết / sắp hết (vừa gia hạn thì sửa ngày mới)
   · Mở   — còn hạn, hoặc giấy không thời hạn ⇒ tủ giấy tờ
  Dòng dưới: có giấy chưa có ngày ⇒ mời nhập để Sen Biển nhắc. Chưa đăng nhập ⇒ thay bằng "Đăng nhập để lưu giấy và
  được Sen Biển nhắc hạn" (màn Tàu tôi khoá cả màn với khách, nhắc hạn cũng chỉ chạy khi có tài khoản; đăng nhập xong
  app về Trang chủ, không quay lại link giấy — nói thẳng thay vì hứa). Đọc tủ hỏng ⇒ một câu + Mở, không đoán.
*/

import Link from "next/link";
import { useEffect, useState } from "react";
import { DocIcon } from "@/components/icons";
import { loadBoats, loadCurrentBoatId } from "@/lib/boats";
import { SOON_DAYS_DOCS } from "@/lib/days";
import { readToken } from "@/lib/device-token-store";
import type { BoatDocument } from "@/lib/documents";
import { formatVnDate } from "@/lib/format";
import { cauThuyenVien, giayCuaBai, hanGiay, linkGiay, tomTatThuyenVien, type HanGiay, type MucHan } from "@/lib/kairos/han-giay";
import type { KairosPost } from "@/lib/kairos/types";
import { NHAN } from "@/lib/labels";
import { useTodayVN } from "@/lib/use-today";
import { readUserList } from "@/lib/user-list-store";
import { USER_SYNC_EVENT } from "@/lib/user-sync";

// Khoá kho viết thẳng như lib/doc-reminder-local (KHÔNG import từ component tủ giấy tờ / sổ thuyền viên — kéo cả hai màn
// đó vào gói Kairos). Nguồn đúng: document-vault.DOCS_STORAGE_KEY, crew-list.CREW_STORAGE_KEY, ops/state-registry.
const KHO_GIAY = "forfish.documents.v1";
const KHO_THUYEN_VIEN = "forfish.crew.v1";

type Kho = {
  hong: boolean;
  docs: (BoatDocument & { boatId?: string })[];
  crew: unknown[];
  currentId: string | null;
  knownIds: ReadonlySet<string> | null;
  tenTau: string | null;
  dangNhap: boolean;
};

function docKho(): Kho {
  const d = readUserList<BoatDocument & { boatId?: string }>(KHO_GIAY);
  const c = readUserList<unknown>(KHO_THUYEN_VIEN);
  const boats = loadBoats();
  const cur = loadCurrentBoatId();
  const current = boats.find((b) => b.id === cur) ?? boats[0] ?? null;
  return {
    hong: !d.ok,
    docs: d.ok && Array.isArray(d.list) ? d.list : [],
    crew: c.ok && Array.isArray(c.list) ? c.list : [],
    currentId: current?.id ?? null,
    knownIds: new Set(boats.map((b) => b.id)),
    tenTau: boats.length > 1 ? (current?.name ?? null) : null,
    dangNhap: readToken() != null,
  };
}

const MAU: Record<MucHan, string> = {
  het: "text-danger",
  sap: "text-warn",
  con: "text-foreground/65",
  "khong-han": "text-foreground/65",
  "chua-han": "text-foreground/65",
  "chua-co": "text-foreground/65",
};

function cauGiay(h: HanGiay): string {
  const ngay = h.expiresOn ? ` · hết ${formatVnDate(h.expiresOn)}` : "";
  switch (h.muc) {
    case "het":
      return `${h.days === 0 ? "Hết hạn hôm nay" : `Đã quá hạn ${Math.abs(h.days ?? 0)} ngày`}${ngay}`;
    case "sap":
    case "con":
      return `Còn ${h.days} ngày${ngay}`;
    case "khong-han":
      return "Đã lưu · không thời hạn";
    case "chua-han":
      return "Đã lưu, chưa có ngày hết hạn";
    case "chua-co":
      return "Chưa lưu trong tủ giấy tờ";
  }
}

const nutGiay = (m: MucHan): string => (m === "chua-co" || m === "chua-han" ? NHAN.nhap : m === "het" || m === "sap" ? NHAN.sua : NHAN.mo);

function Hang({ ten, cau, mau, nut, href }: { ten: string; cau: string; mau: string; nut: string; href: string }) {
  return (
    <li className="flex items-center gap-3 rounded-xl bg-field px-3 py-2">
      <DocIcon className="h-5 w-5 shrink-0 text-navy" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[0.9375rem] font-semibold leading-snug text-navy">{ten}</p>
        <p className={`text-[0.875rem] leading-snug ${mau}`}>{cau}</p>
      </div>
      <Link
        href={href}
        className="flex h-(--h-chip) shrink-0 items-center rounded-xl bg-navy px-4 text-[0.9375rem] font-semibold text-white transition active:scale-[0.98]"
      >
        {nut}
      </Link>
    </li>
  );
}

export function HanGiayLuat({ post }: { post: KairosPost }) {
  const theoDoi = giayCuaBai(post);
  const { today } = useTodayVN();
  const [kho, setKho] = useState<Kho | null>(null);

  useEffect(() => {
    if (!theoDoi.length) return;
    const doc = () => setKho(docKho());
    doc();
    // bà con nhập giấy xong quay lại dòng tin, hoặc máy khác đồng bộ về ⇒ đọc lại
    const onSync = () => doc();
    const onVis = () => document.visibilityState === "visible" && doc();
    window.addEventListener(USER_SYNC_EVENT, onSync);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener(USER_SYNC_EVENT, onSync);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [theoDoi.length]);

  if (!theoDoi.length || !kho) return null;

  if (kho.hong) {
    return (
      <div className="px-4 pb-3">
        <ul>
          <Hang ten="Tủ giấy tờ" cau="Chưa đọc được tủ giấy tờ trong máy" mau="text-danger" nut={NHAN.mo} href="/tau?tab=giay-to" />
        </ul>
      </div>
    );
  }

  const hang = theoDoi.map((g) => {
    if (g.loai === "giay") {
      const h = hanGiay(g.kind, kho.docs, { currentId: kho.currentId, knownIds: kho.knownIds, today });
      const href = h.muc === "con" || h.muc === "khong-han" ? "/tau?tab=giay-to" : linkGiay(g.kind);
      return { key: g.kind, canNhap: h.muc === "chua-co" || h.muc === "chua-han", ten: h.ten, cau: cauGiay(h), mau: MAU[h.muc], nut: nutGiay(h.muc), href };
    }
    const t = tomTatThuyenVien(g.muc, kho.crew, today, SOON_DAYS_DOCS);
    const { cau, muc } = cauThuyenVien(t);
    const ten = g.muc === "bao-hiem" ? "Bảo hiểm thuyền viên" : "Chứng chỉ thuyền viên";
    const nut = muc === "het" || muc === "sap" ? NHAN.sua : muc === "con" ? NHAN.mo : NHAN.nhap;
    return { key: g.muc, canNhap: t.tong === 0 || t.chuaNgay > 0 || t.coGiay === 0, ten, cau, mau: MAU[muc], nut, href: "/nguoi" };
  });
  const canNhap = hang.some((h) => h.canNhap);

  return (
    <section className="px-4 pb-3" aria-label="Giấy tờ của bà con">
      <p className="mb-1.5 text-[0.875rem] font-semibold text-navy">{kho.tenTau ? `Giấy tờ tàu ${kho.tenTau}` : "Giấy tờ của bà con"}</p>
      <ul className="space-y-1.5">
        {hang.map((h) => (
          <Hang key={h.key} ten={h.ten} cau={h.cau} mau={h.mau} nut={h.nut} href={h.href} />
        ))}
      </ul>
      {canNhap && kho.dangNhap && (
        <p className="mt-1.5 text-[0.875rem] leading-snug text-foreground/70">Bà con nhập ngày hết hạn, Sen Biển nhắc trước 30 ngày để kịp gia hạn.</p>
      )}
      {!kho.dangNhap && (
        <p className="mt-1 text-[0.875rem] leading-snug text-foreground/70">
          Đăng nhập để lưu giấy và được Sen Biển nhắc hạn.{" "}
          <Link href="/login" className="font-semibold text-sea underline-offset-2 hover:underline">
            {NHAN.dangNhap}
          </Link>
        </p>
      )}
    </section>
  );
}

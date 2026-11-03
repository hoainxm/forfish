"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { ChevronRightIcon } from "@/components/icons";
import { InboxSection } from "@/components/inbox-section";
import { ChuongCuoiTrang, UrgentWithInstall } from "@/components/install-prompt";
import { TideHomeCard } from "@/components/tide-home-card";
import { HomeDauTrang } from "@/components/home-giu-cho";
import { DocRemindOnOpen } from "@/components/doc-remind-on-open";
import { KhuyenMaiCard } from "@/components/khuyen-mai-card";
import { UrgentStrip } from "@/components/urgent-strip";
import { OfflineLine } from "@/components/ui/offline-line";
import { SectionHeader } from "@/components/ui/primitives";
import { cangTheoId, docCangNha } from "@/lib/cang-nha";
import { ngheName } from "@/lib/kairos/ho-so";
import { tenViTri, type ViecTin } from "@/lib/viec";
import { docCache, ghiCache, goiViec } from "@/lib/viec-client";
import { caDangBan } from "@/lib/home-vai";
import { NHAN } from "@/lib/labels";
import { loadShopFlag, type ShopFlag } from "@/lib/market/seller-flag";
import { fetchListings } from "@/lib/market-listings";
import type { MarketListing } from "@/lib/market-listings-core";
import { useVai } from "@/lib/use-vai";

/*
  TRANG CHỦ THEO VAI (spec 17 §4.2, 2026-11-03). Tin bão + thẻ "đang dùng ở máy khác" đứng trên cùng ở MỌI vai (page.tsx);
  phần dưới đổi theo vai:
    · Chủ tàu / chưa chọn vai : y như trước (Biển hôm nay · Việc cần làm · Ưu đãi · Thông báo · Con nước);
                                 chưa chọn vai ⇒ thêm một hàng mời "Bà con làm nghề gì?".
    · Đi bạn                  : Biển hôm nay · Việc làm · Hồ sơ tìm tàu · Giấy tờ · Giá cá · Thông báo · Con nước
    · Thu mua                 : Cá đang bán gần cảng · Giá tham khảo · Tin mua của tôi · Thông báo
    · Đại lý                  : Đơn chờ · Khách cần món chưa có · Gian hàng (nếu chưa hoạt động) · Hàng sắp hết · Thông báo
  Thu mua + đại lý ở trên bờ ⇒ bỏ Biển hôm nay + Con nước. OFFLINE CHỈ BẮT BUỘC VỚI CHỦ TÀU (anh Long 03/11: *"vai chủ
  tàu mới cần offline, các vai khác thì đều đang online"*): khối chủ tàu đọc kho máy như cũ; khối của 3 vai kia tải khi
  mở trang (có trần thời gian), lỗi ⇒ câu + Thử lại, không giữ bản lưu riêng.
*/
export function HomeTheoVai({ dau }: { dau: ReactNode }) {
  const { vai, biet, phone } = useVai();
  if (vai === "ngu-dan") return <HomeDiBan dau={dau} />;
  if (vai === "thu-mua") return <HomeThuMua dau={dau} />;
  if (vai === "dai-ly") return <HomeDaiLy dau={dau} phone={phone} />;
  return <HomeChuTau dau={dau} moiChonVai={!!phone && biet && vai === null} />;
}

/** Một hàng chạm sang màn khác — khuôn hàng sheet Tài khoản (surface, chữ đậm + dòng phụ + ›). */
function Hang({ href, ten, phu, so }: { href: string; ten: string; phu?: string; so?: number }) {
  return (
    <Link href={href} className="flex min-h-[3.5rem] w-full items-center gap-3 px-4 py-2 text-left surface">
      <span className="min-w-0 flex-1">
        <span className="block text-[1rem] font-semibold text-navy">{ten}</span>
        {phu && <span className="block text-[0.8125rem] leading-snug text-foreground/70">{phu}</span>}
      </span>
      {!!so && so > 0 && (
        <span className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-danger px-1.5 text-[0.8125rem] font-bold text-white">
          {so > 99 ? "99+" : so}
        </span>
      )}
      <ChevronRightIcon className="h-5 w-5 shrink-0 text-foreground/40" />
    </Link>
  );
}

function HomeChuTau({ dau, moiChonVai }: { dau: ReactNode; moiChonVai: boolean }) {
  return (
    <>
      <div className="space-y-3">
        {dau}
        {moiChonVai && <Hang href="/chon-vai" ten="Bà con làm nghề gì?" phu="Chọn để app xếp màn hình theo việc của mình" />}
        {/* Biển hôm nay + việc cần làm/tầng 5 dùng chung MỘT ô giữ chỗ (khung chờ 1 hàng, lỗi ⇒ câu + Thử lại) */}
        <HomeDauTrang>
          <UrgentWithInstall>
            <UrgentStrip />
          </UrgentWithInstall>
        </HomeDauTrang>
      </div>
      {/* Nhắc hạn giấy tờ KHI MỞ APP — sheet theo lịch mốc, đọc kho máy; nhường tin bão (07 §12). */}
      <DocRemindOnOpen />
      <TinTuyenCuaToi />
      {/* Ưu đãi SDVICO: một thẻ, dưới việc cần làm, trên Thông báo. */}
      <KhuyenMaiCard lon />
      <InboxSection />
      <TideHomeCard />
      {/* Hàng "Bật chuông" ở CUỐI — biết muộn, ở cuối thì không đẩy gì (CLS). */}
      <ChuongCuoiTrang />
    </>
  );
}

/*
  HÀNG "TIN TUYỂN" của chủ tàu (17 §4.2): chỉ khi bản lưu `forfish.viec.v1` có tin CỦA MÌNH đang mở — KHÔNG gọi mạng
  ở đây (đa số người mở app là chủ tàu; thêm request lúc mở app cho một hàng phụ là không đáng). Bản lưu được làm mới
  mỗi lần mở /viec hoặc trang chủ Đi bạn.
*/
function TinTuyenCuaToi() {
  const [hang, setHang] = useState<{ n: number; conNgay: number } | null>(null);
  useEffect(() => {
    const now = Date.now();
    const mo = (docCache()?.tin ?? []).filter((t) => t.cuaToi && t.status === "mo" && Date.parse(t.expiresAt) > now);
    if (mo.length === 0) return;
    const gan = Math.min(...mo.map((t) => Date.parse(t.expiresAt)));
    setHang({ n: mo.length, conNgay: Math.max(0, Math.ceil((gan - now) / 86_400_000)) });
  }, []);
  if (!hang) return null;
  return (
    <Hang
      href="/viec/cua-toi"
      ten={hang.n > 1 ? `${hang.n} tin tuyển đang mở` : "Tin tuyển đang mở"}
      phu={`Tin gần hết hạn nhất còn ${hang.conNgay} ngày`}
    />
  );
}

function HomeDiBan({ dau }: { dau: ReactNode }) {
  return (
    <>
      <div className="space-y-3">
        {dau}
        <HomeDauTrang>
          <UrgentWithInstall>
            <UrgentStrip />
          </UrgentWithInstall>
        </HomeDauTrang>
      </div>
      <DocRemindOnOpen />
      <section className="space-y-2" aria-label={NHAN.viecLam}>
        <SectionHeader>{NHAN.viecLam}</SectionHeader>
        <ViecHopVoiBaCon />
        <Hang href="/viec/ho-so" ten="Hồ sơ tìm tàu của tôi" phu="Chủ tàu thấy hồ sơ và gọi cho bà con" />
        <Hang href="/viec/giay" ten="Giấy tờ của tôi" phu="Chứng chỉ, sổ thuyền viên, căn cước — nhắc trước hạn" />
      </section>
      <Hang href="/tien" ten="Giá cá hôm nay" phu="Giá tham khảo các cảng" />
      <InboxSection />
      <TideHomeCard />
      <ChuongCuoiTrang />
    </>
  );
}

/** Số tin tuyển mới nhất hiện ở trang chủ Đi bạn (17 §4.2 "≤3 tin mới nhất"). */
const VIEC_TRANG_CHU = 3;

/*
  "VIỆC HỢP VỚI BÀ CON" (17 §4.2): ≤3 tin tuyển mới nhất ở tỉnh cảng nhà (chưa khai cảng ⇒ cả nước). Bản lưu
  `forfish.viec.v1` (chung với màn /viec) vẽ trước ⇒ mất sóng vẫn có; có sóng thì tải lại một lượt (goiViec có trần).
*/
function ViecHopVoiBaCon() {
  const [tin, setTin] = useState<ViecTin[] | null>(null);
  const [luuLuc, setLuuLuc] = useState<number | null>(null);
  const [loi, setLoi] = useState(false);
  useEffect(() => {
    let huy = false;
    const cu = docCache();
    if (cu) {
      setTin(cu.tin);
      setLuuLuc(cu.luc);
    }
    const tinh = docCangNha()?.province;
    void goiViec<{ items: ViecTin[]; luc: number }>(`/api/viec${tinh ? `?tinh=${encodeURIComponent(tinh)}` : ""}`).then((r) => {
      if (huy) return;
      if (!r.ok) {
        setLoi(true);
        if (!cu) setTin([]);
        return;
      }
      setTin(r.data.items);
      setLuuLuc(null);
      ghiCache(r.data.items, r.data.luc);
    });
    return () => {
      huy = true;
    };
  }, []);

  const ds = (tin ?? []).filter((t) => t.status === "mo" && !t.cuaToi).slice(0, VIEC_TRANG_CHU);
  return (
    <>
      {loi && luuLuc != null && <OfflineLine savedAt={luuLuc} />}
      {tin === null ? (
        <div className="h-(--h-row) animate-pulse rounded-2xl bg-field" aria-label="Đang tải" />
      ) : ds.length > 0 ? (
        <ul className="divide-y divide-line overflow-hidden surface">
          {ds.map((t) => (
            <li key={t.id}>
              <Link href={`/viec/tin/${t.id}`} className="flex min-h-[3.5rem] items-center gap-3 px-4 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[1rem] font-semibold text-navy">
                    {[ngheName(t.nghe), t.viTri.map(tenViTri).filter(Boolean).join(", ")].filter(Boolean).join(" · ")}
                  </span>
                  <span className="block truncate text-[0.8125rem] text-foreground/70">
                    {[`${t.soNguoi} người`, cangTheoId(t.portId)?.name, t.ngayDi ? `đi ${t.ngayDi.slice(8, 10)}/${t.ngayDi.slice(5, 7)}` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <ChevronRightIcon className="h-5 w-5 shrink-0 text-foreground/40" />
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      <Hang
        href="/viec"
        ten={ds.length > 0 ? "Xem hết tin tuyển" : loi && !luuLuc ? "Chưa tải được tin tuyển" : "Chưa có tàu tuyển gần cảng nhà"}
        phu="Lọc theo cảng, nghề, vị trí"
      />
    </>
  );
}

/* ── THU MUA ─────────────────────────────────────────────────────────────── */

function HomeThuMua({ dau }: { dau: ReactNode }) {
  // vai Thu mua ở trên bờ, có sóng (anh Long 03/11) ⇒ không bản lưu; tải mỗi lần mở, lỗi ⇒ câu + Thử lại
  const [ds, setDs] = useState<MarketListing[] | null>(null);
  const [loi, setLoi] = useState(false);
  const [lan, setLan] = useState(0);

  useEffect(() => {
    let huy = false;
    setLoi(false);
    setDs(null);
    void fetchListings().then((r) => {
      if (huy) return;
      if (!r.ok) {
        setLoi(true);
        setDs([]);
        return;
      }
      setDs(caDangBan(r.listings, docCangNha()?.province));
    });
    return () => {
      huy = true;
    };
  }, [lan]);

  return (
    <>
      <div className="space-y-3">{dau}</div>
      <section className="space-y-2" aria-label="Cá đang bán gần cảng">
        <SectionHeader>Cá đang bán gần cảng</SectionHeader>
        {ds === null ? (
          <div className="h-(--h-row) animate-pulse rounded-2xl bg-field" aria-label="Đang tải" />
        ) : ds.length === 0 ? (
          loi ? (
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-field px-4 py-3">
              <p className="text-[0.9375rem] text-foreground/75">Chưa tải được tin bán.</p>
              <button type="button" onClick={() => setLan((n) => n + 1)} className="shrink-0 text-[0.9375rem] font-semibold text-sea">
                {NHAN.thuLai}
              </button>
            </div>
          ) : (
            <p className="rounded-2xl bg-field px-4 py-3 text-[0.9375rem] text-foreground/75">Chưa có tin bán cá mới.</p>
          )
        ) : (
          <ul className="divide-y divide-line overflow-hidden surface">
            {ds.map((l) => (
              <li key={l.id}>
                <Link href="/tien?muc=tin" className="flex min-h-[3.5rem] items-center gap-3 px-4 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[1rem] font-semibold text-navy">
                      {l.species}
                      {l.quantity ? ` · ${l.quantity}` : ""}
                    </span>
                    <span className="block truncate text-[0.8125rem] text-foreground/70">
                      {[l.posterName, l.province, l.priceText].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <ChevronRightIcon className="h-5 w-5 shrink-0 text-foreground/40" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <Hang href="/tien" ten="Giá tham khảo" phu="Giá cá các cảng hôm nay" />
      <Hang href="/tien?muc=tin" ten="Tin mua của tôi" phu="Đăng giá thu mua, đóng tin khi đủ hàng" />
      <InboxSection />
      <ChuongCuoiTrang />
    </>
  );
}

/* ── ĐẠI LÝ ──────────────────────────────────────────────────────────────── */

const CAU_GIAN_HANG: Record<string, string> = {
  cho_duyet: "Gian hàng đang chờ SDVICO duyệt",
  tu_choi: "Gian hàng chưa được duyệt — xem lý do",
  tam_khoa: "Gian hàng đang tạm khoá — xem lý do",
};

function HomeDaiLy({ dau, phone }: { dau: ReactNode; phone: string | null }) {
  // cờ gian hàng ở máy (khu bán hàng ghi) — không request
  const [co, setCo] = useState<ShopFlag | null>(null);
  useEffect(() => {
    setCo(loadShopFlag(phone));
  }, [phone]);
  const cau = co?.status ? CAU_GIAN_HANG[co.status] : undefined;
  return (
    <>
      <div className="space-y-3">{dau}</div>
      {co && !co.hasShop ? (
        <Hang href="/ban-hang/dang-ky" ten="Mở gian hàng" phu="Đăng thiết bị, vật tư cho bà con đặt" />
      ) : (
        <>
          {cau && <Hang href="/ban-hang" ten={cau} />}
          <Hang href="/ban-hang/don" ten="Đơn chờ xác nhận" phu="Xác nhận và hẹn ngày giao" so={co?.pending ?? 0} />
          <Hang href="/ban-hang/yeu-cau" ten="Khách cần món chợ chưa có" phu="Báo giá cho khách" />
          <Hang href="/ban-hang/san-pham?loc=sap-het" ten="Hàng sắp hết" phu="Món còn 3 trở xuống" />
        </>
      )}
      <InboxSection />
      <ChuongCuoiTrang />
    </>
  );
}

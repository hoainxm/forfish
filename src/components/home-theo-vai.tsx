"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { ChevronRightIcon, TrendDownIcon, TrendUpIcon } from "@/components/icons";
import { InboxSection } from "@/components/inbox-section";
import { ChuongCuoiTrang, UrgentWithInstall } from "@/components/install-prompt";
import { TideHomeCard } from "@/components/tide-home-card";
import { HomeDauTrang } from "@/components/home-giu-cho";
import { DocRemindOnOpen } from "@/components/doc-remind-on-open";
import { KhuyenMaiCard } from "@/components/khuyen-mai-card";
import { UrgentStrip } from "@/components/urgent-strip";
import { SectionHeader } from "@/components/ui/primitives";
import { cangTheoId, docCangNha } from "@/lib/cang-nha";
import { ngheName } from "@/lib/kairos/ho-so";
import { tenViTri, type ViecHoSo, type ViecTin } from "@/lib/viec";
import { docCache, goiViec } from "@/lib/viec-client";
import { caDangBan, giaQuanTam, viecDaiLy, viecHop, type ViecDaiLy } from "@/lib/home-vai";
import { authedFetch } from "@/lib/device-token-store";
import { fetchLivePrices, type LivePortPrice } from "@/lib/port-price-source";
import { fetchMyVua } from "@/lib/vua-store";
import type { ShopStats } from "@/lib/market/types";
import { NHAN } from "@/lib/labels";
import { loadShopFlag, type ShopFlag } from "@/lib/market/seller-flag";
import { fetchListings } from "@/lib/market-listings";
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

/* ═══ BA VAI TRÊN BỜ — trang chủ trả lời ĐÚNG câu họ mở app để hỏi (anh Long 03/11: "chủ tàu như cũ, các loại user
   khác làm thông minh hơn, dựa trên cái họ mong muốn và expect"). Có sóng là chuẩn (17 §2): mỗi khối tải khi mở trang
   (có trần thời gian), lỗi ⇒ câu + Thử lại, không bản lưu riêng. ═══ */

/** Khung chờ một hàng / câu + Thử lại / câu trống — dùng chung ba vai. */
function KhungCho() {
  return <div className="h-(--h-row) animate-pulse rounded-2xl bg-field" aria-label="Đang tải" />;
}
function LoiThuLai({ cau, onThu }: { cau: string; onThu: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-field px-4 py-3">
      <p className="text-[0.9375rem] text-foreground/75">{cau}</p>
      <button type="button" onClick={onThu} className="shrink-0 text-[0.9375rem] font-semibold text-sea">
        {NHAN.thuLai}
      </button>
    </div>
  );
}
function CauTrong({ cau }: { cau: string }) {
  return <p className="rounded-2xl bg-field px-4 py-3 text-[0.9375rem] text-foreground/75">{cau}</p>;
}
/** Nhãn nhỏ trên dòng (khuôn nhãn trạng thái 03 — "Hợp nghề", "Đúng loài"). */
function NhanNho({ children }: { children: ReactNode }) {
  return (
    <span className="ml-1.5 inline-block rounded-full bg-sea/12 px-1.5 align-middle text-[0.6875rem] font-bold leading-4 text-sea">
      {children}
    </span>
  );
}

/* ── ĐI BẠN: "Hôm nay có tàu nào cần người như mình không?" ───────────────── */

type HoSoTrangChu = { hoSo: ViecHoSo | null; dangHien: boolean };

function HomeDiBan({ dau }: { dau: ReactNode }) {
  const [hs, setHs] = useState<HoSoTrangChu | null>(null);
  // đã xếp hạng theo hồ sơ (tính trong effect — Date.now() không được gọi lúc render)
  const [ds, setDs] = useState<ReturnType<typeof viecHop> | null>(null);
  const [loi, setLoi] = useState(false);
  const [lan, setLan] = useState(0);

  useEffect(() => {
    let huy = false;
    setLoi(false);
    setDs(null);
    void (async () => {
      // hồ sơ trước: cảng muốn đi của hồ sơ là chỗ tìm tàu đúng nhất; chưa có thì cảng nhà
      const h = await goiViec<{ hoSo: ViecHoSo | null; dangHien: boolean }>("/api/viec/ho-so");
      if (huy) return;
      const hoSo = h.ok ? h.data.hoSo : null;
      setHs({ hoSo, dangHien: h.ok ? h.data.dangHien : false });
      const tinh = (hoSo?.ports[0] ? cangTheoId(hoSo.ports[0])?.province : undefined) ?? docCangNha()?.province;
      const r = await goiViec<{ items: ViecTin[] }>(`/api/viec${tinh ? `?tinh=${encodeURIComponent(tinh)}` : ""}`);
      if (huy) return;
      if (!r.ok) {
        setLoi(true);
        setDs([]);
        return;
      }
      setDs(viecHop(r.data.items, hoSo, Date.now()));
    })();
    return () => {
      huy = true;
    };
  }, [lan]);

  return (
    <>
      <div className="space-y-3">
        {dau}
        {/* Biển hôm nay + giấy tờ của tôi sắp hết hạn (dải việc cần làm) — đi bạn vẫn ra khơi */}
        <HomeDauTrang>
          <UrgentWithInstall>
            <UrgentStrip />
          </UrgentWithInstall>
        </HomeDauTrang>
      </div>
      <DocRemindOnOpen />
      <section className="space-y-2" aria-label="Tàu cần người">
        <SectionHeader>{hs?.hoSo ? "Tàu cần người hợp với bà con" : "Tàu đang tuyển người"}</SectionHeader>
        {/* chưa có hồ sơ / hồ sơ đang tắt ⇒ MỘT dòng nhắc — chủ tàu chỉ tìm thấy người có hồ sơ đang hiện */}
        {hs && !hs.hoSo && <Hang href="/viec/ho-so" ten="Lập hồ sơ tìm tàu" phu="Chủ tàu tìm thấy và gọi cho bà con" />}
        {hs?.hoSo && !hs.dangHien && <Hang href="/viec/ho-so" ten="Hồ sơ tìm tàu đang tắt" phu="Mở lại để chủ tàu thấy bà con" />}
        {ds === null ? (
          <KhungCho />
        ) : loi ? (
          <LoiThuLai cau="Chưa tải được tin tuyển." onThu={() => setLan((n) => n + 1)} />
        ) : ds.length === 0 ? (
          <CauTrong cau="Chưa có tàu tuyển quanh đây." />
        ) : (
          <ul className="divide-y divide-line overflow-hidden surface">
            {ds.map((t) => (
              <li key={t.id}>
                <Link href={`/viec/tin/${t.id}`} className="flex min-h-[3.5rem] items-center gap-3 px-4 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[1rem] font-semibold text-navy">
                      {[ngheName(t.nghe), t.viTri.map(tenViTri).filter(Boolean).join(", ")].filter(Boolean).join(" · ")}
                      {t.hopNghe && <NhanNho>Hợp nghề</NhanNho>}
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
        )}
        {ds && !loi && <Hang href="/viec" ten="Xem hết tin tuyển" />}
      </section>
      <InboxSection />
      <TideHomeCard />
      <ChuongCuoiTrang />
    </>
  );
}

/* ── THU MUA: "Hôm nay ai bán đúng loài mình mua, ở đâu, giá ra sao?" ─────── */

const CAU_HO_SO_VUA: Record<string, { ten: string; phu: string }> = {
  cho_duyet: { ten: "Hồ sơ vựa đang chờ duyệt", phu: "Duyệt xong bà con mới thấy vựa ở Đầu mối" },
  tu_choi: { ten: "Hồ sơ vựa chưa được duyệt", phu: "Xem lý do và gửi lại" },
  tam_khoa: { ten: "Hồ sơ vựa đang tạm khoá", phu: "Xem lý do" },
};

function HomeThuMua({ dau }: { dau: ReactNode }) {
  // hồ sơ vựa: loài đang mua (để xếp tin + giá) và trạng thái duyệt
  const [vua, setVua] = useState<{ loai: string[]; status: string | null; coHoSo: boolean } | null>(null);
  const [ds, setDs] = useState<ReturnType<typeof caDangBan> | null>(null);
  const [gia, setGia] = useState<{ rows: LivePortPrice[]; tuan?: string } | null>(null);
  const [loi, setLoi] = useState(false);
  const [lan, setLan] = useState(0);

  useEffect(() => {
    let huy = false;
    setLoi(false);
    setDs(null);
    setGia(null);
    void (async () => {
      const v = await fetchMyVua();
      if (huy) return;
      const loai = v.ok ? (v.profile?.species ?? []) : [];
      setVua({ loai, status: v.ok ? (v.profile?.status ?? null) : null, coHoSo: v.ok && !!v.profile });
      const [r, g] = await Promise.all([fetchListings(), fetchLivePrices().catch(() => null)]);
      if (huy) return;
      if (!r.ok) {
        setLoi(true);
        setDs([]);
      } else setDs(caDangBan(r.listings, docCangNha()?.province, undefined, loai));
      setGia(g ? { rows: giaQuanTam(g.prices, loai), tuan: g.week } : { rows: [] });
    })();
    return () => {
      huy = true;
    };
  }, [lan]);

  const trangThai = vua?.status ? CAU_HO_SO_VUA[vua.status] : undefined;
  return (
    <>
      <div className="space-y-3">{dau}</div>
      {vua && !vua.coHoSo && <Hang href="/tien/vua" ten="Lập hồ sơ vựa" phu="Ghi loài bà con mua — app đưa đúng tin bán lên trước" />}
      {trangThai && <Hang href="/tien/vua" ten={trangThai.ten} phu={trangThai.phu} />}
      <section className="space-y-2" aria-label="Cá đang bán">
        <SectionHeader>{vua?.loai.length ? "Đang bán đúng loài bà con mua" : "Cá đang bán gần cảng"}</SectionHeader>
        {ds === null ? (
          <KhungCho />
        ) : loi ? (
          <LoiThuLai cau="Chưa tải được tin bán." onThu={() => setLan((n) => n + 1)} />
        ) : ds.length === 0 ? (
          <CauTrong cau="Chưa có tin bán cá mới." />
        ) : (
          <ul className="divide-y divide-line overflow-hidden surface">
            {ds.map((l) => (
              <li key={l.id}>
                <Link href="/tien?muc=tin" className="flex min-h-[3.5rem] items-center gap-3 px-4 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[1rem] font-semibold text-navy">
                      {l.species}
                      {l.quantity ? ` · ${l.quantity}` : ""}
                      {l.dungLoai && <NhanNho>Đúng loài</NhanNho>}
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
      {/* GIÁ TUẦN của loài mình mua (VASEP) — để mặc cả có số; không khai loài ⇒ vài loài đầu bảng */}
      <section className="space-y-2" aria-label="Giá tuần này">
        <SectionHeader>Giá tuần này{gia?.tuan ? ` · ${gia.tuan}` : ""}</SectionHeader>
        {gia === null ? (
          <KhungCho />
        ) : gia.rows.length === 0 ? (
          <Hang href="/tien" ten="Xem bảng giá" />
        ) : (
          <ul className="divide-y divide-line overflow-hidden surface">
            {gia.rows.map((g) => (
              <li key={g.id}>
                <Link href="/tien" className="flex min-h-(--h-row) items-center gap-3 px-4 py-2">
                  <span className="min-w-0 flex-1 truncate text-[1rem] font-semibold text-navy">{g.species}</span>
                  <span className="shrink-0 text-[0.9375rem] tabular-nums text-foreground/80">
                    {formatVndRange(g.minVnd, g.maxVnd)}
                  </span>
                  {g.trend === "up" ? (
                    <TrendUpIcon className="h-4 w-4 shrink-0 text-ok" />
                  ) : g.trend === "down" ? (
                    <TrendDownIcon className="h-4 w-4 shrink-0 text-danger" />
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <Hang href="/tien?muc=tin" ten="Tin mua của tôi" phu="Đăng giá thu mua, đóng tin khi đủ hàng" />
      <InboxSection />
      <ChuongCuoiTrang />
    </>
  );
}

/** "45–52 nghìn/kg" — số gọn cho hàng giá. */
function formatVndRange(min: number, max: number): string {
  const k = (v: number) => Math.round(v / 1000).toLocaleString("vi-VN");
  return min === max ? `${k(min)} nghìn/kg` : `${k(min)}–${k(max)} nghìn/kg`;
}

/* ── ĐẠI LÝ: "Có việc gì phải xử lý ngay?" ─────────────────────────────────── */

const CAU_GIAN_HANG: Record<string, string> = {
  cho_duyet: "Gian hàng đang chờ SDVICO duyệt",
  tu_choi: "Gian hàng chưa được duyệt — xem lý do",
  tam_khoa: "Gian hàng đang tạm khoá — xem lý do",
};

type SoDaiLy = { viec: ViecDaiLy[]; tuan: { don: number; doanhThu: number } };

function HomeDaiLy({ dau, phone }: { dau: ReactNode; phone: string | null }) {
  // cờ gian hàng ở máy (khu bán hàng ghi) — biết ngay có shop chưa, trạng thái gì
  const [co, setCo] = useState<ShopFlag | null>(null);
  const [so, setSo] = useState<SoDaiLy | null>(null);
  const [loi, setLoi] = useState(false);
  const [lan, setLan] = useState(0);
  useEffect(() => {
    setCo(loadShopFlag(phone));
  }, [phone]);
  const hoatDong = co?.hasShop && co.status === "hoat_dong";

  useEffect(() => {
    if (!hoatDong) return;
    let huy = false;
    setLoi(false);
    setSo(null);
    void (async () => {
      // hai câu hỏi một lượt: số liệu gian hàng (đơn chờ, báo chuyển khoản, sắp hết, tuần này) + yêu cầu báo giá mới
      const [tk, yc] = await Promise.all([
        authedFetch("/api/ban-hang/thong-ke?range=7d", {}, 12000),
        authedFetch("/api/ban-hang/yeu-cau", {}, 12000),
      ]);
      if (huy) return;
      const s = tk.res?.ok ? ((await tk.res.json().catch(() => null)) as { stats?: ShopStats } | null)?.stats : null;
      if (!s) {
        setLoi(true);
        return;
      }
      const y = yc.res?.ok ? ((await yc.res.json().catch(() => null)) as { total?: number; block?: unknown } | null) : null;
      setSo({
        viec: viecDaiLy({
          donCho: s.pendingOrders,
          baoChuyen: s.awaitingPaymentConfirm,
          yeuCauMoi: y && !y.block ? (y.total ?? 0) : 0,
          sapHet: s.lowStock.length,
        }),
        tuan: { don: s.orders, doanhThu: s.revenueVnd },
      });
    })();
    return () => {
      huy = true;
    };
  }, [hoatDong, lan]);

  const cau = co?.status ? CAU_GIAN_HANG[co.status] : undefined;
  return (
    <>
      <div className="space-y-3">{dau}</div>
      {co && !co.hasShop ? (
        <Hang href="/ban-hang/dang-ky" ten="Mở gian hàng" phu="Đăng thiết bị, vật tư cho bà con đặt" />
      ) : cau ? (
        <Hang href="/ban-hang" ten={cau} />
      ) : hoatDong ? (
        <section className="space-y-2" aria-label="Việc cần làm">
          <SectionHeader>Việc cần làm</SectionHeader>
          {so === null && !loi ? (
            <KhungCho />
          ) : loi || !so ? (
            <LoiThuLai cau="Chưa tải được số liệu gian hàng." onThu={() => setLan((n) => n + 1)} />
          ) : so.viec.length === 0 ? (
            <CauTrong cau="Không có việc cần làm." />
          ) : (
            so.viec.map((v) => <Hang key={v.key} href={v.href} ten={v.ten} so={v.so} />)
          )}
          {so && (
            <Hang
              href="/ban-hang"
              ten="7 ngày qua"
              phu={`${so.tuan.don} đơn · ${so.tuan.doanhThu.toLocaleString("vi-VN")}đ đã giao xong`}
            />
          )}
        </section>
      ) : null}
      <InboxSection />
      <ChuongCuoiTrang />
    </>
  );
}

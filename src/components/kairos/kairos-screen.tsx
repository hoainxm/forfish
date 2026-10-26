"use client";

/*
  MÀN KAIROS ĐẦY ĐỦ (dòng tin chung + Bến) = KairosFeed + hành vi thẻ (usePostActions) + khung
  soạn. Bến truyền `port` ⇒ dòng tin lọc theo cảng, ô mời đăng THẲNG vào Bến (AC14).
  Góc phải: chuông "Thông báo" (chỉ tin bình luận/trả lời mình, chấm đếm chưa đọc — 14 §16, dòng tin chung) + nút bánh răng "Tuỳ chọn dòng tin" (CHỈ dòng tin chung, không ở Bến — 14 §13) + "Trang tôi" = ẢNH ĐẠI DIỆN TRÒN
  của mình như FB (K3-09: `KairosAvatar nav`, aria-label "Trang tôi"; tên đọc từ bản lưu dòng tin `authorToi`, KHÔNG gọi /me
  lúc mở màn; chưa có bài nào ⇒ chữ "T" của "Tôi") ⇒ /kairos/u/toi (đổi tên gọi, ảnh, số hiệu tàu — AC12).
  Bến (có `port`) là màn PHỤ ⇒ MarketHeader "‹ Bến X" (không trang trước ⇒ về /kairos), "Trang tôi" ở ô phải;
  tab Kairos gốc giữ tiêu đề lớn ManHeader.
  HAI TAB (14 §21, anh Long 2026-10-26 "tổ chức thêm 1 tab tin chính sách"): `Tabs` dùng chung (segmented, dính dưới
  header) "Dòng tin" · "Chính sách" — CHỈ ở màn Kairos gốc (Bến không có). Tab Chính sách = cùng KairosFeed với
  chip "chinh-sach": thông báo nhà nước từ tên miền .gov.vn, có file đính kèm; không ô mời đăng, không Tài trợ.
  Deep-link `/kairos?tab=chinh-sach` (Sen Biển / thông báo). Chuyển tab không remount feed (Tabs chỉ làm thanh, nội dung
  render một lần bên dưới) ⇒ giữ ảnh chụp từng tab.
*/

import Link from "next/link";
import { useEffect, useState } from "react";
import { SettingsIcon } from "@/components/icons";
import { ManHeader } from "@/components/man-header";
import { MarketHeader } from "@/components/market/shared/market-header";
import { useHome } from "@/components/ui/region-filter";
import { Tabs } from "@/components/ui/tabs";
import { provinceIdOf } from "@/lib/kairos/khu-vuc.mjs";
import { loadFeedCache, loadTuyChon, portLabel } from "@/lib/kairos/feed-client";
import { hienCauPhu } from "@/lib/kairos/dau-man";
import { authorToi } from "@/lib/kairos/ho-so";
import { useAuthUser } from "@/lib/use-auth";
import type { TuyChon } from "@/lib/kairos/tuy-chon";
import type { ChipId } from "@/lib/kairos/thoi-quen";
import { NHAN } from "@/lib/labels";
import { ChuongKairos } from "./chuong-kairos";
import { KairosAvatar } from "./kairos-avatar";
import { KairosFeed } from "./kairos-feed";
import { KairosFishIcon } from "./kairos-fish-icon";
import { LocTinhChinhSach } from "./loc-tinh-chinh-sach";
import { TuyChonSheet } from "./tuy-chon-sheet";
import { usePostActions } from "./use-post-actions";

export function KairosScreen({ port, title = "Kairos", sub }: { port?: string; title?: string; sub?: string }) {
  const a = usePostActions();
  /** tuỳ chọn đã áp cho dòng tin (null = dòng tin tự đọc trong máy lúc mở màn) */
  const [tuyChon, setTuyChon] = useState<TuyChon | null>(null);
  /** ngăn đang mở: bản tuỳ chọn lúc mở (đọc lại từ máy để khớp cái dòng tin đang dùng) */
  const [mo, setMo] = useState<TuyChon | null>(null);
  const { phone, ready: authReady, signedIn } = useAuthUser();
  /** dòng tin trống? (KairosFeed báo; null = chưa đọc máy) — câu phụ chỉ hiện khi trống hoặc khách (E K3-03) */
  const [trong, setTrong] = useState<boolean | null>(null);
  /** mình trong bản lưu dòng tin (chỉ localStorage, không mạng) — null ⇒ chữ cái "T" */
  const [toi, setToi] = useState<{ profileId: string; handle: string } | null>(null);
  useEffect(() => {
    setToi(authorToi(loadFeedCache(phone)?.posts ?? []));
  }, [phone]);
  /** tab đang xem: dòng tin chung hay Chính sách (14 §21) — chỉ màn gốc */
  const [tab, setTab] = useState<"dong-tin" | "chinh-sach">("dong-tin");
  const chip: ChipId = !port && tab === "chinh-sach" ? "chinh-sach" : "moi";
  /*  TỈNH NÀO XEM TỈNH ĐÓ (14 §21c, anh Long 2026-10-26: "tổ chức phân phối tin chính sách thì chuẩn vào, tỉnh nào view
      tỉnh đó, dựa vào vị trí… tránh rối"): MỘT nút nhỏ "📍 <Tỉnh> ▾" (loc-tinh-chinh-sach.tsx — thay HomeBar ba nút, anh Long: "quá thô"), hộp chọn tỉnh dùng chung với Chợ cá. Tỉnh = cảng nhà
      của tàu đang chọn, không có thì tỉnh chọn tạm trong phiên (useHome) — KHÔNG lấy GPS (không xin quyền vị trí chỉ để
      lọc tin). Gần ⇒ thông báo gắn tỉnh đó + thông báo không gắn tỉnh nào (bộ/cục, cả nước). Chưa có tỉnh ⇒ nút ghi "Cả nước". */
  const { home, chonTinh } = useHome();
  const [gan, setGan] = useState(true);
  const tinh = chip === "chinh-sach" && gan ? provinceIdOf(home.province ?? null) : null;
  const trangToi = (
    <Link href="/kairos/u/toi" aria-label={NHAN.trangToi} title={NHAN.trangToi} className="flex shrink-0 rounded-full transition active:scale-[0.95]">
      <KairosAvatar id={toi?.profileId ?? phone ?? "toi"} name={toi?.handle ?? "Tôi"} url={null} nav />
    </Link>
  );
  return (
    <div>
      {port ? (
        // Bến = màn PHỤ (vào từ nhãn cảng trên bài / trang cá nhân) ⇒ thanh ‹ Quay lại như mọi màn phụ
        <MarketHeader title={`Bến ${portLabel(port) ?? ""}`.trim()} fallback="/kairos" right={trangToi} />
      ) : (
        <ManHeader
          // Icon cá lướt vào cạnh tiêu đề (Codex 2026-10-25) — chữ "Kairos" vẫn là tiêu đề, ảnh trang trí
          title={
            <span className="flex items-center gap-1.5">
              {/* cao 1.5rem (≈ chữ tiêu đề) — 2rem ở máy 375px đẩy chữ "Kairos" chạm nút chuông */}
              <KairosFishIcon anim="vao" className="h-6 w-auto shrink-0" />
              {title}
            </span>
          }
          // câu phụ chỉ khi chưa có gì để đọc hoặc khách chưa đăng nhập — có bài thì header 68px như màn khác
          sub={hienCauPhu({ authReady, signedIn, trong }) ? sub : undefined}
          right={
            <div className="flex items-center gap-2">
              <ChuongKairos />
              <button
                type="button"
                aria-label={NHAN.tuyChon}
                title={NHAN.tuyChon}
                onClick={() => setMo(tuyChon ?? loadTuyChon())}
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-line text-sea transition active:scale-[0.97]"
              >
                <SettingsIcon className="h-5 w-5" />
              </button>
              {trangToi}
            </div>
          }
        />
      )}
      {!port && (
        <Tabs
          ariaLabel="Kairos"
          paramKey="tab"
          value={tab}
          onChange={(id) => setTab(id === "chinh-sach" ? "chinh-sach" : "dong-tin")}
          // nội dung render MỘT lần bên dưới (không remount feed khi đổi tab) — content để trống
          tabs={[
            { id: "dong-tin", label: NHAN.dongTin, content: null },
            { id: "chinh-sach", label: NHAN.chinhSach, content: null },
          ]}
        />
      )}
      {chip === "chinh-sach" && <LocTinhChinhSach home={home} gan={gan} setGan={setGan} chonTinh={chonTinh} />}
      <KairosFeed
        port={port}
        chip={chip}
        tinh={tinh}
        tuyChon={port ? undefined : (tuyChon ?? undefined)}
        actions={a.actions}
        view={a.view}
        added={a.added}
        onCompose={() => a.compose({ kind: "new", port })}
        onTrong={port ? undefined : setTrong}
      />
      {mo && (
        <TuyChonSheet
          value={mo}
          onClose={(t) => {
            setMo(null);
            setTuyChon(t);
          }}
        />
      )}
      {a.ui}
    </div>
  );
}

"use client";
/*
  THẺ ƯU ĐÃI SDVICO + NGĂN ĐĂNG KÝ MUA (2026-10-26) — anh Long chuyển tin Zalo của Quân ("Vss Quân Bình Định"):
  sứ định vị giá thị trường 500k, mua qua app giảm 200k còn 300k (sửa 2026-10-27), cho mọi khách cũ và mới. Khách bấm Đăng ký ⇒ POST
  /api/sdvico/khuyen-mai ⇒ phiếu `sdvico_khach_hoi` ⇒ AI Assistant nhắn Zalo cho Quân xử lý (14 §3.14b).

  Chỗ đặt: Trang chủ (dưới việc cần làm, trên Thông báo) + đầu Vật tư. Một thẻ MỘT HÀNG kiểu `.surface` (03 §0):
  ảnh thật của Quân chụp · tên · giá gạch → giá app · một câu đời thường · nút "Đăng ký" (NHAN, ≤2 chữ).
  Không emoji, không băng màu, không đếm ngược (Quân chưa cho hạn). 2026-10-31 thêm máy lọc dầu SF300B 9,9 triệu ngay dưới
  sứ (cùng danh sách) — giá thường, KHÔNG gạch giá (`giaThiTruong` null).

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
import { useEffect, useMemo, useRef, useState } from "react";
import { QtyStepper } from "@/components/cart-sheet";
import { CheckIcon, ChevronRightIcon, PhoneIcon, PlayIcon } from "@/components/icons";
import { sanitizePhoneInput } from "@/components/auth-form";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Field, inputClass, PrimaryButton, textareaClass } from "@/components/ui/primitives";
import { baoToast } from "@/components/ui/toast";
import { FISHING_PORTS } from "@/data/fishing-ports";
import { SDVICO_HOTLINE, SDVICO_HOTLINE_DISPLAY } from "@/data/sdvico-showcase";
import { chonMotKhuyenMai, conHieuLuc, doDaiClip, KHUYEN_MAI, nenChayClipNgan, tienVn, timKhuyenMai, xepLuot, type KhuyenMai } from "@/data/khuyen-mai";
import { timeoutSignal } from "@/lib/abort";
import { songTot, type NavMang } from "@/lib/kairos/tai-mang-di";
import { savedStormActive } from "@/lib/storms";
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

/*  XOAY QUẢNG CÁO (anh Long 31/10: "tổ chức cái quảng cáo random chứ đừng hiện cả, 1 lúc xem 1 cái thôi, cho random ở cả
    màn chủ và kairos, lâu lâu đẩy ở màn bản đồ kiểu notify"). Kho `forfish.km.xoay.v1` = { truoc: id món vừa hiện, banDo: mốc
    lần cuối bật thẻ nổi ở Bản đồ } — của MÁY NÀY, mất thì chỉ có thể lặp lại món cũ một lần. */
const XOAY_KEY = "forfish.km.xoay.v1";
type Xoay = { truoc?: string; banDo?: number };
export function docXoay(): Xoay {
  try {
    const v = JSON.parse(window.localStorage.getItem(XOAY_KEY) ?? "null") as unknown;
    return v && typeof v === "object" ? (v as Xoay) : {};
  } catch {
    return {};
  }
}
export function ghiXoay(x: Xoay) {
  try {
    window.localStorage.setItem(XOAY_KEY, JSON.stringify({ ...docXoay(), ...x }));
  } catch {
    /* chế độ riêng tư chặn ghi ⇒ lần sau có thể lặp món */
  }
}

/** Chọn một món còn hiệu lực để quảng bá (bỏ món vừa hiện, ưu tiên món chưa đăng ký) và ghi lại là đã hiện. */
export function chonQuangCao(): KhuyenMai | null {
  const ds = KHUYEN_MAI.filter((k) => conHieuLuc(k, homNay()));
  const k = chonMotKhuyenMai(ds, docXoay().truoc ?? null, new Set(Object.keys(docDaDangKy())), Math.random());
  if (k) ghiXoay({ truoc: k.id });
  return k;
}

/** Thẻ hàng SDVICO — MỘT món ngẫu nhiên mỗi lần mở màn (Trang chủ, đầu Vật tư, giữa dòng Kairos). Chọn sau khi gắn vào
 *  trang (Math.random + kho máy ⇒ không chọn lúc dựng trên máy chủ, tránh lệch hydrate). `?km=<id>` (Sen Biển / thẻ nổi Bản
 *  đồ) ⇒ mở thẳng món đó: có clip ⇒ ngăn video, không ⇒ ngăn Đăng ký. */
export function KhuyenMaiCard({ className = "", lon = false }: { className?: string; lon?: boolean }) {
  const [daDK, setDaDK] = useState<DaDangKy>({});
  const [mo, setMo] = useState<KhuyenMai | null>(null);
  const [xem, setXem] = useState<KhuyenMai | null>(null);
  const [mon, setMon] = useState<KhuyenMai | null>(null);
  const [nhan, setNhan] = useState<string | null>(null);
  useEffect(() => {
    setDaDK(docDaDangKy());
    let k: KhuyenMai | null = null;
    try {
      const u = new URL(window.location.href);
      k = timKhuyenMai(u.searchParams.get("km") ?? "");
      if (k) {
        if (k.video) setXem(k);
        else if (!docDaDangKy()[k.id]) setMo(k);
        u.searchParams.delete("km");
        window.history.replaceState(window.history.state, "", u.pathname + u.search + u.hash);
      }
    } catch {
      /* URL lạ — bỏ qua */
    }
    const m = k ?? chonQuangCao();
    setMon(m);
    if (m?.nhan?.length) setNhan(m.nhan[Math.floor(Math.random() * m.nhan.length)]);
  }, []);
  const ds = mon ? [mon] : [];
  if (!ds.length) return null;
  return (
    <section className={className} aria-label="Ưu đãi SDVICO">
      <ul className={lon ? "" : "surface divide-y divide-line"}>
        {ds.map((k) => {
          const xong = daDK[k.id];
          if (lon) {
            return (
              <li key={k.id}>
                <LuotHomNay dau={k} nhan={nhan} daDK={daDK} onBam={(m) => (m.video ? setXem(m) : !daDK[m.id] && setMo(m))} />
              </li>
            );
          }
          return (
            <li key={k.id}>
              {/*  CẢ DÒNG LÀ MỘT CHỖ BẤM (anh Long 31/10: "đừng làm nút đăng ký kiểu này, click vào có video thì show video,
                   còn ko là nhảy ra đk luôn"): có clip ⇒ mở ngăn video (Đăng ký nằm dưới clip); không clip ⇒ mở thẳng ngăn
                   Đăng ký; đã đăng ký mà không clip ⇒ không mở gì, dòng phụ nói đã đăng ký. */}
              <button
                type="button"
                onClick={() => (k.video ? setXem(k) : !xong && setMo(k))}
                aria-label={k.video ? `Xem video ${k.ten}` : xong ? `${k.ten} — đã đăng ký` : `Đăng ký ${k.ten}`}
                className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition active:bg-field"
              >
                <span className="relative h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-xl">
                  <Image src={k.image} alt="" width={k.imgW} height={k.imgH} sizes="4.5rem" className="h-full w-full object-cover" />
                  {k.video && (
                    <span className="absolute inset-0 flex items-center justify-center bg-navy/35">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-t3">
                        <PlayIcon className="ml-0.5 h-5 w-5" />
                      </span>
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  {/* nhãn hút mắt, đổi ngẫu nhiên theo món (anh Long 31/10: "đừng để Hàng SDVICO… cái nhãn cũng cho linh hoạt") */}
                  <span
                    className="inline-block rounded-full px-2 py-0.5 text-[0.75rem] font-semibold"
                    style={{ backgroundColor: "var(--warn-bg)", color: "var(--warn)" }}
                  >
                    {nhan ?? (k.giaThiTruong != null ? "Ưu đãi SDVICO" : "SDVICO")}
                  </span>
                  <span className="display line-clamp-2 text-[1.125rem] font-semibold leading-snug text-navy">{k.ten}</span>
                  <span className="mt-0.5 block text-[1rem] leading-snug">
                    {k.giaThiTruong != null && (
                      <>
                        <span className="text-muted line-through">{tienVn(k.giaThiTruong)}</span>{" "}
                      </>
                    )}
                    <span className="font-semibold text-t3">
                      {k.giaTu ? "Từ " : ""}
                      {tienVn(k.giaApp)}
                    </span>
                  </span>
                  <span className={`mt-0.5 flex items-center gap-1 truncate text-[0.875rem] ${xong ? "font-semibold" : "text-muted"}`} style={xong ? { color: "var(--ok)" } : undefined}>
                    {xong && <CheckIcon className="h-4 w-4 shrink-0" />}
                    <span className="truncate">{xong ? "Đã đăng ký · SDVICO sẽ gọi lại" : k.moTa}</span>
                  </span>
                </span>
                {!xong && <ChevronRightIcon className="h-5 w-5 shrink-0 text-muted" />}
              </button>
            </li>
          );
        })}
      </ul>
      {xem?.video && (
        <VideoSheet
          km={xem}
          onClose={() => setXem(null)}
          onDangKy={() => {
            const k = xem;
            setXem(null);
            if (!daDK[k.id]) setMo(k);
          }}
          daDangKy={!!daDK[xem.id]}
        />
      )}
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

/*  THẺ HÔM NAY — Trang chủ (2026-10-31, anh Long "Làm thẻ Hôm nay"; mẫu: tab Today của App Store). Cùng MỘT món xoay như
    thẻ thường, cùng chỗ (dưới tin bão + việc cần làm). Bản 2 cùng ngày (anh Long: "nhiều chữ quá… khung video bé, không
    full cái card"): video/ảnh PHỦ KÍN thẻ 4:5, chữ chỉ còn nhãn nhỏ góc trên + tên + giá + nút ▶ trên nền tối dưới đáy
    (che luôn phụ đề có sẵn trong clip; khung lệch lên `center_35%` để giữ câu mồi ở trên). Cả thẻ là một chỗ bấm (có clip
    ⇒ ngăn video đầy đủ có tiếng; không ⇒ ngăn Đăng ký) — y như thẻ thường.
    · Món có `video.ngan` (6 s câu mồi, ≤400 KB) ⇒ TỰ CHẠY không tiếng, tối đa CLIP_NGAN_LAN vòng rồi đứng ở ảnh (đỡ pin).
    · Chỉ tải khi: máy báo có sóng, `nenChayClipNgan` (sóng tốt, không giảm chuyển động, không tin bão mới), và chờ
      CLIP_NGAN_CHO_MS sau khi mở màn — nhường mạng cho tin bão / thời tiết tải trước.
    · Tải NGUYÊN file thành blob (cùng lý do ngăn video: SW trả 200 cho yêu cầu Range ⇒ iOS không phát). Đồng hồ 15 s;
      hỏng / mất sóng giữa chừng ⇒ im lặng đứng ở ảnh (đây là quảng cáo, không đáng một câu lỗi).
    · Mất sóng ⇒ chỉ ảnh, không request nào. Không ghi khoá `forfish.*` nào mới. */
export const CLIP_NGAN_LAN = 3;
export const CLIP_NGAN_CHO_MS = 2_000;

/*  VUỐT TRÁI PHẢI (anh Long 31/10, mẫu băng quảng cáo Shopee: "cái video thì view video còn cái ảnh thì view ảnh, vuốt
    qua trái phải"). Mọi món còn hiệu lực xếp thành một hàng cuộn ngang `snap` (khuôn ảnh sản phẩm Chợ, `cuon-an`), món
    xoay ngẫu nhiên (`dau`) đứng đầu. Chấm tròn dưới thẻ. CHỈ món đang nhìn tải + chạy clip ngắn; vuốt đi ⇒ dừng, vuốt
    lại ⇒ chạy lại từ đầu. KHÔNG tự chuyển món — bà con tự vuốt (đỡ rối mắt, đỡ tải). */
function LuotHomNay({ dau, nhan, daDK, onBam }: { dau: KhuyenMai; nhan: string | null; daDK: DaDangKy; onBam: (k: KhuyenMai) => void }) {
  const ds = useMemo(() => xepLuot(dau, KHUYEN_MAI.filter((k) => conHieuLuc(k, homNay()))), [dau]);
  const [i, setI] = useState(0);
  return (
    <div>
      <ul
        className="flex snap-x snap-mandatory overflow-x-auto rounded-[1.25rem] cuon-an"
        aria-roledescription="băng quảng cáo"
        onScroll={(e) => {
          const el = e.currentTarget;
          if (el.clientWidth > 0) setI(Math.round(el.scrollLeft / el.clientWidth));
        }}
      >
        {ds.map((k, j) => (
          <li key={k.id} className="w-full shrink-0 snap-center" aria-label={`${j + 1} / ${ds.length}`}>
            <TheHomNay k={k} active={j === i} xong={!!daDK[k.id]} nhan={j === 0 ? nhan : (k.nhan?.[0] ?? null)} onBam={() => onBam(k)} />
          </li>
        ))}
      </ul>
      {ds.length > 1 && (
        <div className="mt-2 flex justify-center gap-1.5" aria-hidden>
          {ds.map((k, j) => (
            <span key={k.id} className={`h-2 rounded-full ${j === i ? "w-5 bg-navy" : "w-2 bg-navy/25"}`} />
          ))}
        </div>
      )}
    </div>
  );
}

function TheHomNay({ k, active, xong, nhan, onBam }: { k: KhuyenMai; active: boolean; xong: boolean; nhan: string | null; onBam: () => void }) {
  const online = useOnline();
  const ngan = k.video?.ngan;
  const [url, setUrl] = useState<string | null>(null);
  const [het, setHet] = useState(false);
  const lan = useRef(0);
  const ref = useRef<HTMLVideoElement>(null);
  const obj = useRef<string | null>(null);

  useEffect(() => () => {
    if (obj.current) URL.revokeObjectURL(obj.current);
  }, []);

  // Tải MỘT lần, lúc thẻ này lần đầu được nhìn tới (món chưa vuốt tới thì không tốn byte nào).
  useEffect(() => {
    if (!ngan || !online || !active || obj.current) return;
    let huy = false;
    const t = window.setTimeout(() => {
      const giam = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
      savedStormActive(Date.now())
        .catch(() => false)
        .then((coBao) => {
          if (huy || !nenChayClipNgan({ songTot: songTot(navigator as NavMang), giamChuyenDong: giam, coBao })) return;
          return fetch(ngan, { signal: timeoutSignal(15_000) })
            .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
            .then((b) => {
              if (huy || obj.current) return;
              obj.current = URL.createObjectURL(b);
              setUrl(obj.current);
            });
        })
        .catch(() => {
          /* quảng cáo: hỏng thì đứng ở ảnh */
        });
    }, CLIP_NGAN_CHO_MS);
    return () => {
      huy = true;
      window.clearTimeout(t);
    };
  }, [ngan, online, active]);

  // Vuốt quay lại món này ⇒ chạy lại đủ vòng.
  useEffect(() => {
    if (!active) return;
    lan.current = 0;
    setHet(false);
  }, [active]);

  const chay = !!url && online && active && !het;
  // React không đặt thuộc tính `muted` lên thẻ ⇒ iOS chặn tự phát; đặt tay rồi mới play.
  useEffect(() => {
    const v = ref.current;
    if (!chay || !v) return;
    v.muted = true;
    v.play().catch(() => setHet(true));
  }, [chay]);

  return (
    <button
      type="button"
      onClick={onBam}
      aria-label={k.video ? `Xem video ${k.ten}` : xong ? `${k.ten} — đã đăng ký` : `Đăng ký ${k.ten}`}
      className="relative block aspect-[4/5] max-h-[28rem] w-full overflow-hidden rounded-[1.25rem] bg-navy text-left transition active:opacity-90"
    >
      {chay ? (
        <video
          ref={ref}
          src={url!}
          poster={k.video?.poster}
          muted
          playsInline
          preload="auto"
          aria-hidden
          onEnded={() => {
            lan.current += 1;
            if (lan.current < CLIP_NGAN_LAN) ref.current?.play().catch(() => setHet(true));
            else setHet(true);
          }}
          className="absolute inset-0 h-full w-full object-cover object-[center_35%]"
        />
      ) : k.video ? (
        // eslint-disable-next-line @next/next/no-img-element -- poster tĩnh nhỏ, không cần tối ưu ảnh
        <img src={k.video.poster} alt="" className="absolute inset-0 h-full w-full object-cover object-[center_35%]" />
      ) : (
        // Không clip ⇒ ẢNH phủ kín thẻ (anh Long 31/10). <img> thường như poster: next/image lười (lazy) trong khung tuyệt
        // đối không chịu tải ⇒ thẻ trơ nền tối (đã dính khi kiểm). Ảnh SDVICO nhỏ sẵn (~90 KB), không cần tối ưu.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={k.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
      )}
      <span className="absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-navy/70 to-transparent" />
      {/* công khai là quảng cáo — một chữ nhỏ góc trên, không băng màu */}
      <span className="absolute left-3 top-3 rounded-full bg-navy/60 px-2 py-0.5 text-[0.75rem] font-semibold text-white">
        {nhan ?? NHAN.sdvico}
      </span>
      <span className="absolute inset-x-0 bottom-0 flex items-end gap-3 bg-gradient-to-t from-navy via-navy/85 to-transparent px-4 pb-4 pt-20">
        <span className="min-w-0 flex-1 text-white">
          <span className="display line-clamp-2 text-[1.25rem] font-semibold leading-snug">{k.ten}</span>
          <span className="block text-[1rem] font-semibold">
            {xong && !k.video ? (
              <span className="flex items-center gap-1">
                <CheckIcon className="h-4 w-4 shrink-0" />
                Đã đăng ký
              </span>
            ) : (
              <>
                {k.giaThiTruong != null && <span className="font-normal line-through opacity-70">{tienVn(k.giaThiTruong)} </span>}
                {k.giaTu ? "Từ " : ""}
                {tienVn(k.giaApp)}
              </>
            )}
          </span>
        </span>
        {k.video ? (
          <span className="flex shrink-0 flex-col items-center gap-1">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-t3">
              <PlayIcon className="ml-0.5 h-6 w-6" />
            </span>
            <span className="text-[0.75rem] font-semibold text-white">{doDaiClip(k.video.giay)}</span>
          </span>
        ) : (
          !xong && (
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-t3">
              <ChevronRightIcon className="h-6 w-6" />
            </span>
          )
        )}
      </span>
    </button>
  );
}

/*  XEM VIDEO (2026-10-31, clip lọc dầu 65 s ~7,2 MB). Tải NGUYÊN file thành blob rồi mới phát — không gắn thẳng `src`:
    trình phát video xin từng lát `Range`, mà nhánh asset tĩnh của service worker trả nguyên bản 200 từ kho (Cache API bỏ qua
    Range) ⇒ iOS không phát. Tải trọn một lần thì SW cất bản đủ ⇒ lần sau MẤT SÓNG vẫn xem lại được. Trạng thái: đang tải
    (poster + chữ) · lỗi/mất sóng (poster + câu, nút Thử lại) · phát (controls, thử tự phát có tiếng; trình duyệt chặn thì bà
    con bấm ▶). Đóng ngăn ⇒ thu hồi blob. */
type TrangVideo = "tai" | "loi" | "xem";

function VideoSheet({ km, onClose, onDangKy, daDangKy }: { km: KhuyenMai; onClose: () => void; onDangKy: () => void; daDangKy: boolean }) {
  const v = km.video!;
  const online = useOnline();
  const [url, setUrl] = useState<string | null>(null);
  const [trang, setTrang] = useState<TrangVideo>("tai");
  const [lan, setLan] = useState(0);
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let huy = false;
    let obj: string | null = null;
    setTrang("tai");
    fetch(v.src, { signal: timeoutSignal(90000) })
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
      .then((b) => {
        if (huy) return;
        obj = URL.createObjectURL(b);
        setUrl(obj);
        setTrang("xem");
      })
      .catch(() => {
        if (!huy) setTrang("loi");
      });
    return () => {
      huy = true;
      if (obj) URL.revokeObjectURL(obj);
    };
  }, [v.src, lan]);

  useEffect(() => {
    if (trang === "xem") ref.current?.play().catch(() => {});
  }, [trang]);

  return (
    <BottomSheet title={km.ten} onClose={onClose}>
      <div className="relative mx-auto aspect-[9/16] max-h-[65vh] overflow-hidden rounded-2xl bg-navy">
        {trang === "xem" && url ? (
          <video ref={ref} src={url} poster={v.poster} controls playsInline className="h-full w-full object-contain" />
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- poster tĩnh nhỏ, không cần tối ưu ảnh */}
            <img src={v.poster} alt="" className="h-full w-full object-cover opacity-70" />
            <div className="absolute inset-x-3 bottom-3 rounded-2xl bg-navy/80 px-3.5 py-3 text-center text-[1rem] font-semibold text-white">
              {trang === "tai" ? (
                "Đang tải video…"
              ) : (
                <>
                  <p>{online ? "Chưa tải được video." : "Mất sóng — có sóng mới xem được video."}</p>
                  <button type="button" onClick={() => setLan((n) => n + 1)} className="mt-2 rounded-full bg-white px-4 py-1.5 text-navy">
                    {NHAN.thuLai}
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
      <div className="mt-4">
        {daDangKy ? (
          <p className="text-center text-[1rem] font-semibold text-foreground/70">Bà con đã đăng ký · SDVICO sẽ gọi lại</p>
        ) : (
          <PrimaryButton onClick={onDangKy}>{NHAN.dangKy}</PrimaryButton>
        )}
      </div>
      {/* bà con hỏi TRƯỚC khi đăng ký (anh Long 31/10) — hỏi–đáp trong bundle, mất sóng vẫn đọc; muốn hỏi người thật ⇒ gọi */}
      {km.hoiDap?.length ? (
        <section className="mt-5" aria-label="Bà con hay hỏi">
          <p className="mb-2 text-[1rem] font-semibold text-navy">Bà con hay hỏi</p>
          <ul className="surface divide-y divide-line">
            {km.hoiDap.map((q) => (
              <li key={q.hoi}>
                <details className="group px-3.5 py-3">
                  <summary className="cursor-pointer list-none text-[1rem] font-semibold text-navy marker:hidden">{q.hoi}</summary>
                  <p className="mt-1.5 text-[1rem] leading-relaxed text-foreground/80">{q.dap}</p>
                </details>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <a
        href={`tel:${SDVICO_HOTLINE}`}
        className="mt-3 flex min-h-[3.25rem] items-center justify-center gap-2 rounded-full text-[1.125rem] font-semibold text-sea"
      >
        <PhoneIcon className="h-5 w-5" />
        {NHAN.goi} SDVICO {SDVICO_HOTLINE_DISPLAY}
      </a>
    </BottomSheet>
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
  // Ưu đãi nhiều bản (lọc dầu cơ/điện) ⇒ chọn sẵn bản đầu; giá theo bản đang chọn.
  const [banId, setBanId] = useState(km.bienThe?.[0]?.id ?? null);
  const ban = km.bienThe?.find((b) => b.id === banId) ?? null;
  const gia = ban?.gia ?? km.giaApp;
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
          bienThe: ban?.id,
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
            : j?.code === "sai_ban"
              ? "Bà con chọn bản máy (cơ hay điện) rồi gửi lại nhé."
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
             {qty} {km.donVi}{ban ? ` ${ban.ten}` : ""} · {tienVn(gia * qty)} · nhận tại {noiNhan.trim()}. Nhân viên sẽ gọi lại hẹn giao.
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
              {km.giaThiTruong != null && <span className="text-muted line-through">{tienVn(km.giaThiTruong)}</span>} {tienVn(gia)}/{km.donVi}
            </p>
            <ul className="mt-0.5 text-[0.875rem] leading-snug text-foreground/70">
              {km.diemHay.slice(1).map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </div>
        </div>

        {km.bienThe?.length ? (
          <Field label="Chọn bản">
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Chọn bản">
              {km.bienThe.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  role="radio"
                  aria-checked={b.id === banId}
                  onClick={() => setBanId(b.id)}
                  className={`flex h-(--h-ctl) min-w-[6.5rem] flex-1 flex-col items-center justify-center rounded-2xl border px-3 text-[1rem] font-semibold transition ${
                    b.id === banId ? "border-t3 bg-t3 text-white" : "border-line bg-field text-navy"
                  }`}
                >
                  {b.nhan}
                </button>
              ))}
            </div>
            {/* hai bản khác nhau chỗ nào — một câu theo bản đang chọn (anh Long 31/10) */}
            {ban?.khac && <p className="mt-2 text-[1rem] leading-snug text-foreground/75">{ban.khac}</p>}
          </Field>
        ) : null}

        <Field label="Số lượng">
          <div className="flex items-center justify-between">
            <QtyStepper qty={qty} onChange={(q) => setQty(Math.min(km.qtyMax, Math.max(1, q)))} label="số lượng" />
            <p className="text-[1rem] font-semibold text-navy">{tienVn(gia * qty)}</p>
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

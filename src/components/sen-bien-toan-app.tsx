"use client";

/*
  SEN BIỂN Ở MỌI MÀN (2026-10-18, chủ dự án: "mở rộng làm trợ lý cho toàn app, giao
  tiếp bằng giọng nói"). Cùng icon, cùng thẻ GỌI/CHAT, cùng tai + bộ hiểu ý với màn
  bản đồ (SenBienSheet, senBienReply); khác ở chỗ trả lời:
    · việc BẢN ĐỒ (dẫn đường, hỏi bản đồ, mở lớp…) ⇒ chuyển sang /ngu-truong?sen=…,
      màn bản đồ nghe lại đúng câu đó và làm tiếp (fishing-map-view)
    · việc trong app ⇒ trả lời từ dữ liệu trong máy (lib/sen-bien/tra-loi-app.ts) và
      làm hành động vô hại ngay: mở màn, đổi tàu, đặt cảng nhà (có đường lùi: nói lại).
  Không gọi mạng (luật chủ dự án 17/10: Sen Biển chỉ chạy trong máy). Gọi điện thì CHỈ
  đọc số — bấm gọi là việc của bà con (xác nhận luôn là một chạm, 13 §4.3).
  Màn bản đồ có Sen Biển riêng (đủ lớp, vị trí, dẫn đường) ⇒ ở đó không vẽ cái này.
*/

import { Capacitor } from "@capacitor/core";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { SenBienNoi, SenBienSheet, boKhoSan, loadBoKho, loadSenBienModel, type SenHeard } from "@/components/sen-bien-sheet";
import { gomSnapshot } from "@/lib/assistant/device-snapshot";
import type { AssistantAction } from "@/lib/assistant/types";
import { LOCAL_BUILD_ID } from "@/lib/app-version";
import { loadBoats, saveCurrentBoatId } from "@/lib/boats";
import { SPECIES_META } from "@/lib/fish-predict";
import { loadPlaces } from "@/lib/places";
import { loadHome, saveHome } from "@/lib/region";
import { readToken } from "@/lib/device-token-store";
import { doanMayNha, hoiMayChu } from "@/lib/sen-bien/hoi-may-chu";
import { henCauGio } from "@/lib/sen-bien/cau-vui";
import { cauTruot, chonBuoc, DAP_CAM_ON, laCauDem, luotMoi } from "@/lib/sen-bien/luong-tra-loi";
import { chonKho } from "@/lib/sen-bien/gemma";
import { senBienReply, senNgramCtx } from "@/lib/sen-bien/hieu-y";
import { goLenhNgan, hoiKho } from "@/lib/sen-bien/hoi-kho";
import { lamLenhCho, type ChoKetQua } from "@/lib/sen-bien/lam-cho";
import { hieuLenhCho, hoiLaiCho } from "@/lib/sen-bien/lenh-cho";
import { ghiMauSen, guiMauSen, phienMoi } from "@/lib/sen-bien/mau-hoc";
import { doTin, guessIntent } from "@/lib/sen-bien/ngram";
import { useAuthUser } from "@/lib/use-auth";
import { traLoiApp, veBanDo } from "@/lib/sen-bien/tra-loi-app";
import { ttsCancel, ttsSpeak, ttsSpeakMp3, ttsUnlock, warmVoiceClips } from "@/lib/voice/tts";
import { anKhiCuon } from "@/lib/sen-bien/an-khi-cuon";
import { KAIROS_CACHE_KEY, parseCache } from "@/lib/kairos/cache";
import { hieuTimTinKairos, traLoiTinKairos } from "@/lib/kairos/tim-tin";

const LOAI_CA = Object.keys(SPECIES_META);
const CHAO = "Sen Biển giúp gì được cho bạn?";
const NGHE_LAI = "Sen Biển chưa nghe rõ. Bà con nói lại nhé.";
/** chờ app mở xong mới tải sẵn giọng — như màn bản đồ (fishing-map-view), khỏi chen với lúc dựng trang */
const TAI_SAN_MS = 8_000;
/** màn KHÔNG vẽ Sen Biển toàn app: bản đồ có bản riêng; đăng nhập/đăng ký/pháp lý không cần */
const KHONG_VE = /^\/(ngu-truong|login|dang-ky|quen-mat-khau|doi-mat-khau|quyen-rieng-tu)(\/|$)/;

export function SenBienToanApp() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const { phone } = useAuthUser();
  /** một lần mở Sen Biển — mẫu học (mau-hoc.ts) ghép cặp câu nói lại theo mã này */
  const phienRef = useRef("");
  /** mẫu học (doc 15 §23, chủ dự án 2026-10-18 "ghi nhận lịch sử từ user để train tiếp"): chữ nghe ra + máy làm gì */
  const ghiMau = useCallback((cau: string, r: Parameters<typeof ghiMauSen>[0]["r"]) => {
    ghiMauSen({
      phien: phienRef.current || (phienRef.current = phienMoi()),
      cau,
      r,
      xn: false,
      chay: false,
      nen: Capacitor.getPlatform(),
      ban: LOCAL_BUILD_ID,
    });
    void guiMauSen();
  }, []);
  /** câu chuyển từ màn bản đồ (?sen=, việc sàn nói ở bản đồ) — mở thẻ là làm luôn */
  const [hoiNgay, setHoiNgay] = useState<string | undefined>(undefined);
  /*  Đang gõ chữ (ô tìm, form) ⇒ cất icon: nó không được che ô nhập và bàn phím
      (rà Codex 2026-10-19). Thẻ đang mở thì giữ — ô chat là của chính nó. */
  const [dangGo, setDangGo] = useState(false);
  useEffect(() => {
    const laO = (t: EventTarget | null) =>
      t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    const vao = (e: FocusEvent) => setDangGo(laO(e.target));
    const ra = () => setDangGo(laO(document.activeElement));
    document.addEventListener("focusin", vao);
    document.addEventListener("focusout", ra);
    return () => {
      document.removeEventListener("focusin", vao);
      document.removeEventListener("focusout", ra);
    };
  }, []);
  /*  CUỘN XUỐNG ⇒ icon lùi (mờ, không nhận chạm); cuộn lên / về đầu trang ⇒ quay lại
      (lib/sen-bien/an-khi-cuon.ts — kiểu Gmail/Facebook, rà bố cục 2026-10-22). Đổi trang
      thì hiện lại. Không ẩn khi thẻ đang mở. */
  const [anCuon, setAnCuon] = useState(false);
  useEffect(() => {
    setAnCuon(false);
    let yCu = window.scrollY;
    let khung = 0;
    const onScroll = () => {
      if (khung) return;
      khung = requestAnimationFrame(() => {
        khung = 0;
        const y = window.scrollY;
        setAnCuon((an) => anKhiCuon(yCu, y, an));
        yCu = y;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (khung) cancelAnimationFrame(khung);
    };
  }, [pathname]);
  useEffect(() => {
    try {
      const u = new URL(window.location.href);
      const t = u.searchParams.get("sen");
      if (!t || KHONG_VE.test(u.pathname)) return;
      u.searchParams.delete("sen");
      window.history.replaceState(window.history.state, "", u.pathname + (u.search || "") + u.hash);
      setHoiNgay(t.slice(0, 300));
      setOpen(true);
    } catch {
      // URL lạ — bỏ qua, bà con chạm icon nói lại
    }
  }, [pathname]);
  // thẻ đóng (mọi đường) ⇒ bỏ câu chuyển, lần mở sau là chào bình thường.
  // KHÔNG làm bằng effect theo `open`: effect đó chạy cùng lượt với effect đọc ?sen= (lúc open còn false) và xoá mất câu
  const dong = useCallback(() => {
    setOpen(false);
    setHoiNgay(undefined);
    phienRef.current = "";
  }, []);

  /*  NÓI QUA NÓI LẠI (chủ dự án 2026-10-18: "đảm bảo giao tiếp 2 chiều giọng Mỹ Duyên"). Như màn bản đồ: đọc
      XONG thật (onEnd completed) mới bật micro một lượt (`autoListen` của SenBienSheet — luật autoListenOk: không
      khi đang gõ chat, chưa cấp mic, ẩn app, mất sóng mà chưa có bộ nghe trong máy); đang đọc thì báo
      `speakerBusy` để micro không thu tiếng loa và thẻ không tự thu giữa câu. Im 5 s ⇒ chỉ tắt mic.
      KHÔNG tự nghe sau câu có nút xác nhận (việc sàn có hậu quả: một chạm, 13 §4.3) và câu chuyển sang bản đồ. */
  const [dangDoc, setDangDoc] = useState(false);
  const [tuNghe, setTuNghe] = useState(0);
  /** số lần liền "có tiếng mà không ra chữ" — hỏi lại MỘT lần, lần sau thôi (khỏi vòng hỏi–ồn–hỏi) */
  const truot = useRef(0);
  /** lượt đọc hiện tại — câu mới cắt câu cũ (ttsSpeak) thì onEnd của câu cũ đến SAU, không được tắt cờ của câu mới */
  const luotDoc = useRef(0);
  /** câu vừa đọc — "nhắc lại" đọc lại đúng câu này */
  const cauCuoi = useRef("");
  /** `daXong` — gọi khi câu này đọc hết / bị cắt (câu giờ báo để câu trả lời nói SAU nó, không đè) */
  const noi = useCallback((t: string, ngheTiep = true, daXong?: () => void) => {
    if (!t) return daXong?.();
    cauCuoi.current = t;
    const luot = ++luotDoc.current;
    setDangDoc(true);
    ttsSpeak(t, {
      onEnd: (xong) => {
        daXong?.();
        if (luot !== luotDoc.current) return;
        setDangDoc(false);
        if (xong && ngheTiep) setTuNghe((n) => n + 1);
      },
    });
  }, []);
  const ngheTruot = useCallback(() => {
    const lan = truot.current++;
    noi(lan < 1 ? NGHE_LAI : "Sen Biển chưa nghe rõ.", lan < 1);
  }, [noi]);

  // tải sẵn giọng Mỹ Duyên (mp3 câu + mảnh ghép, vào kho SW) + bộ hiểu ý khi còn sóng — trước đây chỉ màn bản đồ
  // làm, bà con chưa mở bản đồ mà ra khơi thì Sen Biển ở màn khác đọc giọng máy (hoặc im). Một lượt/phiên
  // (warmVoiceClips tự chặn), mất sóng / tiết kiệm dữ liệu ⇒ bỏ, không ném.
  useEffect(() => {
    const t = setTimeout(() => {
      if ((navigator as unknown as { connection?: { saveData?: boolean } }).connection?.saveData) return;
      // kho hỏi–đáp + bộ lọc cũng nạp sẵn (rà "chậm" 2026-10-24: câu hỏi kiến thức đầu tiên từng chờ tải 5 MB, tới 20 s)
      void loadSenBienModel()
        .then(() => {
          boKhoSan();
          return warmVoiceClips();
        })
        .catch(() => undefined);
    }, TAI_SAN_MS);
    return () => clearTimeout(t);
  }, []);

  const lam = useCallback(
    (a: AssistantAction | undefined): string => {
      if (!a) return "";
      try {
        switch (a.type) {
          case "navigate":
            router.push(a.href);
            return "";
          case "setBoat":
            saveCurrentBoatId(a.boatId);
            return "";
          case "setHomePort":
            saveHome({ portId: a.portId, ...(a.province ? { province: a.province } : {}) });
            return "";
          case "call":
            return ` Số ${a.label}: ${a.tel}.`;
          case "search":
            router.push(`/cho/tim?q=${encodeURIComponent(a.q)}`);
            return "";
          default:
            return "";
        }
      } catch {
        return " Máy chưa lưu được — bà con thử lại.";
      }
    },
    [router],
  );

  /** CHỢ VẬT TƯ (2026-10-18, "toàn bộ thao tác sàn phải đảm bảo sen biển thực hiện"): nói → mở màn → nút xác nhận */
  const choRaThe = useCallback(
    (k0: ChoKetQua): SenHeard => {
      const doi = (k: ChoKetQua): SenHeard => {
        noi(k.noi, !k.xacNhan);
        if (k.den && k.den !== pathname) router.push(k.den);
        return {
          show: k.noi,
          ...(k.xacNhan ? { xacNhan: { nhan: k.xacNhan.nhan, lam: async () => doi(await k.xacNhan!.lam()) } } : {}),
        };
      };
      return doi(k0);
    },
    [noi, pathname, router],
  );

  /** số lượt nghe — câu máy nhà về muộn của lượt cũ không được đọc chèn câu mới (luong-tra-loi.luotMoi) */
  const luotNghe = useRef(0);
  /** lượt đang chờ máy nhà — lượt mới / bà con đóng thẻ thì ngắt */
  const huyRef = useRef<AbortController | null>(null);
  /*  BÀ CON ĐÓNG THẺ (×, vuốt, Esc): thôi hết — bỏ lượt đang nghĩ (câu về muộn không đọc), ngắt câu hỏi máy nhà, im loa.
      Trước đây đóng thẻ mà câu trả lời vẫn đọc tiếp sau đó, chen cả câu chào lần mở sau (rà "chồng chéo" 2026-10-24). */
  const dongTay = useCallback(() => {
    luotNghe.current++;
    huyRef.current?.abort();
    huyRef.current = null;
    luotDoc.current++;
    setDangDoc(false);
    ttsCancel();
    dong();
  }, [dong]);
  const onHeard = useCallback(
    async (text: string, o?: { tu: boolean }): Promise<SenHeard> => {
      const conLuot = luotMoi(luotNghe);
      huyRef.current?.abort();
      const huy = typeof AbortController === "undefined" ? null : new AbortController();
      huyRef.current = huy;
      truot.current = 0;
      // micro tự mở sau câu trả lời thu "ừm"/"ờ"/"cảm ơn" ⇒ không phải câu hỏi mới: khép cuộc nói, không trả lời
      const dem = o?.tu ? laCauDem(text) : null;
      if (dem) {
        if (dem === "cam_on") noi(DAP_CAM_ON, false);
        dong();
        return null;
      }
      /*  TÌM TIN KAIROS (14 §15): "bài về câu mực", "tin Kairos về Lý Sơn", "đọc báo" ⇒ lọc BẢN LƯU dòng tin
          (forfish.kairos.v1) — không mạng, mất sóng vẫn chạy — đọc 2–3 bài rồi mở bài đầu. Luật từ khoá đòi dấu hiệu
          Kairos rõ; "có tin bão gì không" trần KHÔNG vào đây (tin bão chính thức trả lời, lib/kairos/tim-tin.ts). */
      const tk = hieuTimTinKairos(text);
      if (tk) {
        let cache: ReturnType<typeof parseCache> = null;
        try {
          // đọc thẳng qua cache.ts (không qua feed-client — khỏi kéo danh mục cảng vào gói chung mọi màn)
          cache = parseCache(window.localStorage.getItem(KAIROS_CACHE_KEY), phone);
        } catch {
          // chế độ riêng tư chặn đọc ⇒ coi như chưa có bản lưu
        }
        const kq = traLoiTinKairos(tk, cache, Date.now());
        ghiMau(text, { tra: "kairos", ct: tk.chuDe ?? undefined });
        noi(kq.noi);
        if (kq.den !== pathname) router.push(kq.den);
        return { show: kq.noi };
      }
      const cho = hieuLenhCho(text);
      if (cho) {
        ghiMau(text, { tra: "cho", ct: cho.k });
        const kqCho = await lamLenhCho(cho, phone);
        if (!conLuot()) return null;
        return choRaThe(kqCho);
      }
      const model = await loadSenBienModel();
      if (!conLuot()) return null;
      // cổng phụ (n-gram): luật hụt câu mà mô hình CHẮC (không phân vân — doTin) là việc sàn ⇒ hỏi lại kèm câu mẫu
      const g = model ? guessIntent(model, text) : null;
      const hoiLai = g ? hoiLaiCho(g.y, doTin(g)) : null;
      if (hoiLai) {
        ghiMau(text, { tra: "say", ct: g!.y });
        noi(hoiLai);
        return { show: hoiLai };
      }
      // luật "nhắc lại"/"còn bao xa" bắt nhầm đuôi câu hỏi ⇒ bộ lọc (trong kho đã sẵn, không chờ) gỡ (hoi-kho.goLenhNgan)
      const r = goLenhNgan(text, senBienReply(text, model, [], null, { awaitingGo: false, running: false, loaiCa: LOAI_CA }), boKhoSan()?.loc ?? null, senNgramCtx([]));
      // câu việc bản đồ: màn bản đồ ghi lại khi chạy ?sen= ⇒ ở đây không ghi, khỏi đếm hai lần
      if (!veBanDo(r)) ghiMau(text, r);
      /*  LỆNH NGẮN ở màn toàn app (rà "trả lời sai" 2026-10-24: trước đây ra câu rỗng ⇒ Sen Biển im): nhắc lại = đọc lại
          câu vừa nói · im = thôi nói, khép thẻ · bật tiếng = đáp một câu. */
      if (r.kind === "repeat") {
        const t = cauCuoi.current || "Sen Biển chưa nói gì.";
        noi(t);
        return { show: t };
      }
      if (r.kind === "mute") {
        ttsCancel();
        dong();
        return null;
      }
      if (r.kind === "unmute") {
        noi(r.say);
        return { show: r.say };
      }
      if (veBanDo(r)) {
        noi("Mở bản đồ.", false);
        dong();
        router.push(`/ngu-truong?sen=${encodeURIComponent(text)}`);
        return { show: "Mở bản đồ…" };
      }
      /*  KHO HỎI–ĐÁP TRONG MÁY (lib/sen-bien/hoi-kho.ts, 2026-10-19 — ⚠ kho chưa duyệt, bản test): câu hỏi kiến thức ⇒
          v5b đưa 9 câu, Gemma (Android) chọn / ngưỡng n-gram ⇒ đọc câu có sẵn, chạy cả khi mất sóng. Kho chỉ tải khi
          câu v4 nói hoi_mo/khong_hieu thì CHỜ kho (lần đầu); ý khác chỉ dùng kho đã sẵn (bộ lọc nằm trong kho) — lệnh
          trong app không phải chờ tải 5 MB. */
      const ctxN = senNgramCtx([]);
      const bo = r.kind !== "say" || r.daTraLoi ? null : r.y === "hoi_mo" || r.y === "khong_hieu" ? await loadBoKho() : boKhoSan();
      const online = typeof navigator === "undefined" || navigator.onLine !== false;
      const kq = await hoiKho(text, r, bo, ctxN, chonKho, online && !!readToken());
      if (!conLuot()) return null;
      if (kq.vao && kq.dap) {
        noi(kq.dap.say);
        return { show: kq.dap.say };
      }
      let boats: string[] = [];
      let places: string[] = [];
      try {
        boats = loadBoats().map((b) => b.name);
        places = loadPlaces().map((p) => p.name);
      } catch {
        // kho hỏng / bị chặn — trả lời không có tên riêng
      }
      /*  LUỒNG MỘT CỬA (lib/sen-bien/luong-tra-loi.ts, doc 15 §luồng, anh Long 2026-10-22: "chưa tra xong m đã đẩy
          ngram vô rồi") — cùng bảng với màn Bản đồ: việc trong app chỉ làm khi n-gram CHẮC; còn lại có sóng + đăng nhập
          ⇒ máy nhà (chỉ báo "đang hỏi", không đọc câu đoán trước); mất sóng / chưa đăng nhập / máy nhà trượt ⇒ nói
          đúng lý do. Câu về muộn của lượt cũ bị bỏ (conLuot). */
      const a = traLoiApp(text, r, gomSnapshot(pathname), { awaitingConfirm: false, boatNames: boats, portNames: [], placeNames: places, route: pathname }, Date.now());
      const buoc = chonBuoc({
        r,
        conf: g ? doTin(g) : null,
        coApp: a != null,
        online,
        coChuoi: !!readToken(),
        text,
      });
      if (buoc.buoc === "app" && a) {
        const them = lam(a.action);
        noi(`${a.speak}${them}`);
        return { show: `${a.text}${them}` };
      }
      if (buoc.buoc === "may-nha") {
        // câu giờ CHỈ khi máy nhà chậm > 1,2 s (cau-vui.MOC_GIO_MS); có kết quả thì đợi câu giờ đang đọc nói XONG rồi
        // mới đọc câu trả lời — không cắt giữa chữ (anh Long 2026-10-23: "chồng lấn giữa 2 câu")
        let dangCho = true;
        const xongGio = henCauGio((c, xong) => noi(c, false, xong), () => dangCho && conLuot());
        const kqN = await hoiMayChu(text, pathname, loadHome().province ?? null, huy?.signal);
        dangCho = false;
        await xongGio();
        if (!conLuot()) return null;
        if (!("text" in kqN)) {
          const say = cauTruot(kqN.loi);
          noi(say);
          return { show: say };
        }
        // câu đã vào mẫu học ở trên (ghiMau); câu trả lời máy nhà được AI Assistant ghi nhật ký train `forfish_tb`.
        // Đọc GIỌNG MỸ DUYÊN (mp3 máy nhà đọc sẵn từng câu); câu nào không có mp3 thì giọng máy — như noi()
        const luot = ++luotDoc.current;
        setDangDoc(true);
        ttsSpeakMp3(doanMayNha(kqN), {
          onEnd: (xong) => {
            if (luot !== luotDoc.current) return;
            setDangDoc(false);
            if (xong) setTuNghe((n) => n + 1);
          },
        });
        return { show: kqN.text };
      }
      const say = buoc.buoc === "noi" ? buoc.say : "say" in r ? r.say : "";
      noi(say);
      return { show: say };
    },
    [pathname, router, noi, lam, choRaThe, phone, dong, ghiMau],
  );

  if (KHONG_VE.test(pathname) || pathname.startsWith("/quan-tri")) return null;
  return (
    // khung cố định cùng bề ngang app (≤480 px), chừa dock — icon + thẻ đặt tuyệt đối bên trong như ở màn bản đồ
    // đáy chừa đúng --dock-total (globals.css), không số rời 5.5rem.
    // z-[25]: trên dock + thanh mua hàng (z-20), DƯỚI BottomSheet (z-30) và hộp xác nhận
    // (z-40) — z-40 cũ làm icon đè lên sheet Tài khoản (thấy 2026-10-19).
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[25] mx-auto max-w-(--w-app) [&>*]:pointer-events-auto"
      style={{ bottom: "var(--dock-total)" }}
    >
      {!open && !dangGo && (
        /* bọc chỉ để làm mờ khi cuộn xuống — KHÔNG translate/transform ở lớp bọc (sẽ thành
           khung chứa của icon absolute, icon nhảy về góc trên-trái) */
        <div
          inert={anCuon}
          className={`transition-opacity duration-200 ${anCuon ? "opacity-0" : "opacity-100"}`}
        >
          <SenBienNoi
            gocApp
            onOpen={() => {
              ttsUnlock();
              setTitle("");
              setOpen(true);
            }}
          />
        </div>
      )}
      {open && (
        <SenBienSheet
          gocApp
          awaitingGo={false}
          title={title}
          chao={CHAO}
          hoiNgay={hoiNgay}
          listenOnOpen
          autoListen={tuNghe}
          speakerBusy={dangDoc}
          onMissed={ngheTruot}
          onHeard={onHeard}
          onPick={dong}
          onStart={dong}
          onCancel={dong}
          onClose={dongTay}
        />
      )}
    </div>
  );
}

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

import { SenBienNoi, SenBienSheet, khoRaThe, loadSenBienHoiDap, loadSenBienModel, type SenHeard } from "@/components/sen-bien-sheet";
import { gomSnapshot } from "@/lib/assistant/device-snapshot";
import type { AssistantAction } from "@/lib/assistant/types";
import { LOCAL_BUILD_ID } from "@/lib/app-version";
import { loadBoats, saveCurrentBoatId } from "@/lib/boats";
import { SPECIES_META } from "@/lib/fish-predict";
import { loadPlaces } from "@/lib/places";
import { saveHome } from "@/lib/region";
import { senBienReply } from "@/lib/sen-bien/hieu-y";
import { lamLenhCho, type ChoKetQua } from "@/lib/sen-bien/lam-cho";
import { traLoiKho } from "@/lib/sen-bien/hoi-dap";
import { hieuLenhCho, hoiLaiCho } from "@/lib/sen-bien/lenh-cho";
import { ghiMauSen, guiMauSen, phienMoi } from "@/lib/sen-bien/mau-hoc";
import { guessIntent } from "@/lib/sen-bien/ngram";
import { useAuthUser } from "@/lib/use-auth";
import { traLoiApp, veBanDo } from "@/lib/sen-bien/tra-loi-app";
import { ttsSpeak, ttsUnlock, warmVoiceClips } from "@/lib/voice/tts";

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
  const noi = useCallback((t: string, ngheTiep = true) => {
    if (!t) return;
    const luot = ++luotDoc.current;
    setDangDoc(true);
    ttsSpeak(t, {
      onEnd: (xong) => {
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
      void loadSenBienModel()
        .then(() => warmVoiceClips())
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

  const onHeard = useCallback(
    async (text: string): Promise<SenHeard> => {
      truot.current = 0;
      const cho = hieuLenhCho(text);
      if (cho) {
        ghiMau(text, { tra: "cho", ct: cho.k });
        return choRaThe(await lamLenhCho(cho, phone));
      }
      const model = await loadSenBienModel();
      // cổng phụ (n-gram v4): luật hụt câu mà mô hình chắc là việc sàn ⇒ hỏi lại kèm câu mẫu, không đoán làm hộ
      const g = model ? guessIntent(model, text) : null;
      const hoiLai = g ? hoiLaiCho(g.y, g.conf) : null;
      if (hoiLai) {
        ghiMau(text, { tra: "say", ct: g!.y });
        noi(hoiLai);
        return { show: hoiLai };
      }
      // KHO HỎI–ĐÁP (v5, 19/10): câu hỏi kiến thức mà n-gram không giành làm lệnh ⇒ đọc câu đã duyệt / gợi ý câu gần
      const kho = traLoiKho(await loadSenBienHoiDap(), text, g);
      if (kho) {
        ghiMau(text, { tra: "hd", ct: kho.loai === "dap" ? kho.id : `goi_y:${kho.cac.length}` });
        return khoRaThe(kho, (c) => noi(c));
      }
      const r = senBienReply(text, model, [], null, { awaitingGo: false, running: false, loaiCa: LOAI_CA });
      // câu việc bản đồ: màn bản đồ ghi lại khi chạy ?sen= ⇒ ở đây không ghi, khỏi đếm hai lần
      if (!veBanDo(r)) ghiMau(text, r);
      if (veBanDo(r)) {
        noi("Mở bản đồ.", false);
        dong();
        router.push(`/ngu-truong?sen=${encodeURIComponent(text)}`);
        return { show: "Mở bản đồ…" };
      }
      let boats: string[] = [];
      let places: string[] = [];
      try {
        boats = loadBoats().map((b) => b.name);
        places = loadPlaces().map((p) => p.name);
      } catch {
        // kho hỏng / bị chặn — trả lời không có tên riêng
      }
      const a = traLoiApp(text, r, gomSnapshot(pathname), { awaitingConfirm: false, boatNames: boats, portNames: [], placeNames: places, route: pathname }, Date.now());
      if (a) {
        const them = lam(a.action);
        noi(`${a.speak}${them}`);
        return { show: `${a.text}${them}` };
      }
      const say = "say" in r ? r.say : "";
      noi(say);
      return { show: say };
    },
    [pathname, router, noi, lam, choRaThe, phone, dong, ghiMau],
  );

  if (KHONG_VE.test(pathname) || pathname.startsWith("/quan-tri")) return null;
  return (
    // khung cố định cùng bề ngang app (≤480 px), chừa dock — icon + thẻ đặt tuyệt đối bên trong như ở màn bản đồ
    <div className="pointer-events-none fixed inset-x-0 bottom-[5.5rem] top-0 z-40 mx-auto max-w-[480px] [&>*]:pointer-events-auto">
      {!open && (
        <SenBienNoi
          onOpen={() => {
            ttsUnlock();
            setTitle("");
            setOpen(true);
          }}
        />
      )}
      {open && (
        <SenBienSheet
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
          onClose={dong}
        />
      )}
    </div>
  );
}

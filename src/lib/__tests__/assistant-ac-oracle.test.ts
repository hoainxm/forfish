// CỔNG TRUY VẾT AC ↔ TEST cho Trợ lý "Sen Biển". Spec 13 §9 là ORACLE.
//
// Vì sao có (rà soát 2026-09-07): 13 §9 khai **56 AC**, bộ test có 110 ca unit +
// 48 ca e2e + 125 kịch bản đo tay (`docs/test-cases/tro-ly-2026-09-06.md`) — mà
// KHÔNG có gì buộc ba bên gặp nhau. Rà tay bằng `grep` hôm nay báo 8 AC thiếu;
// cổng này chạy lần đầu báo **9**, vì grep đếm cả mã nằm trong ca ĐANG BỊ HOÃN
// (`test.fixme`). Năm AC (T30/T32/T35/T38/T43) trông như đã có test nhưng thật ra
// không ca nào chạy — đó là **giả xanh**, thứ nguy hiểm hơn không có test.
//
// Ba tầng phủ, theo đúng nghiệp vụ test:
//   AUTO — có ca kiểm ĐANG CHẠY dẫn chiếu mã (unit hoặc e2e). Mạnh nhất.
//   TAY  — cố ý không tự động hoá được (mic thật, giọng vi-VN thật, quota thật):
//          phải khai trong bảng CHUYEN_TAY với LÝ DO, MÃ KỊCH BẢN đo tay, và
//          ĐIỀU KIỆN NÂNG CẤP (CLAUDE.md nguyên tắc 7 — cắt góc phải có trần).
//   TREO — không ai nhận. Cổng ĐỎ.
//
// Cổng KHÔNG chấm nội dung ca kiểm; việc đó là của chính các test kia. Nó trả lời
// đúng một câu: "điều khoản nào trong hợp đồng nghiệm thu chưa có ai nhận?"

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const SPEC = join(ROOT, "docs", "app-map", "13-ba-spec-tro-ly-giong-noi.md");
const TAY_DOC = join(ROOT, "docs", "test-cases", "tro-ly-2026-09-06.md");
const UNIT_DIR = join(ROOT, "src", "lib", "__tests__");
const E2E_DIR = join(ROOT, "tests", "e2e", "troly");
const SELF = "assistant-ac-oracle.test.ts";

const codesIn = (s: string): string[] => s.match(/AC-T\d{2}/g) ?? [];

/*  BẢNG CHUYỂN ĐO TAY — mã ở đây được miễn khỏi bộ tự động, nhưng phải khai đủ
    bốn thứ. Thêm một dòng vào đây là một QUYẾT ĐỊNH có người chịu trách nhiệm,
    không phải chỗ để làm cho cổng xanh. Tự động hoá được rồi thì XOÁ dòng — ca 4
    bắt nếu quên xoá. Lý do dưới đây lấy nguyên từ ghi chú trong chính ca hoãn ở
    `tests/e2e/troly/ui.tro-ly.spec.ts`, không phải tôi nghĩ ra. */
const CHUYEN_TAY: { ac: string; vi_sao: string; tc: string[]; khi_nao_tra: string }[] = [
  {
    ac: "AC-T08",
    vi_sao: "spec 13 §9 GHI RÕ 'bỏ (F-27)' — chip thêm giỏ ở /cho/sp/[id] không còn vì trang đã có nút Thêm vào giỏ; giữ số để không đánh lại mã",
    tc: ["TC-T08"],
    khi_nao_tra: "không bao giờ — AC đã rút khỏi hợp đồng, dòng này chỉ để cổng không báo treo",
  },
  {
    ac: "AC-T30",
    vi_sao: "Trục 1 chưa export trạng thái SnapSheet/HUD dẫn đường live nên e2e không biết sheet đang ở nấc nào (nợ ghi trong assistant-fab.tsx)",
    tc: ["TC-T30"],
    khi_nao_tra: "khi SnapSheet export data-size và nav-mode export trạng thái HUD — lúc đó mở lại test.fixme AC-T30",
  },
  {
    ac: "AC-T32",
    vi_sao: "mic im 8 giây: chromium Playwright có webkitSpeechRecognition nhưng nó gọi dịch vụ Google, trong sandbox trả network hay not-allowed tuỳ máy tuỳ mạng, không tất định",
    tc: ["TC-T32", "TC-TD01"],
    khi_nao_tra: "khi speech.ts nhận bộ nhận dạng tiêm từ ngoài (đối số, không phải global giả) — lúc đó mã lỗi do test quyết",
  },
  {
    ac: "AC-T33",
    vi_sao: "từ chối quyền mic: cùng lý do AC-T32 — nhét SpeechRecognition giả thì chỉ kiểm code giả của chính mình, không kiểm đường bà con đi",
    tc: ["TC-T33", "TC-TD05"],
    khi_nao_tra: "cùng điều kiện AC-T32",
  },
  {
    ac: "AC-T35",
    vi_sao: "speechSynthesis.getVoices() trong chromium headless trả mảng rỗng nên ca 'không đọc bằng giọng khác' xanh một cách vô nghĩa — không có giọng nào để đọc sai",
    tc: ["TC-T35", "TC-TD02"],
    khi_nao_tra: "khi TTS đi qua lớp bọc tiêm được, hoặc CI cài gói giọng vi-VN thật",
  },
  {
    ac: "AC-T36",
    vi_sao: "tắt/bật tiếng cần giọng vi-VN thật để phân biệt 'đã tắt' với 'máy vốn không đọc được'; headless không có giọng nào",
    tc: ["TC-T36", "TC-TD06"],
    khi_nao_tra: "cùng điều kiện AC-T35",
  },
  {
    ac: "AC-T38",
    vi_sao: "cần nguồn dự báo THẬT trả bản mới hơn bản đã lưu; bộ e2e chạy kho file, không gọi Open-Meteo",
    tc: ["TC-T38"],
    khi_nao_tra: "khi bộ e2e có nguồn dự báo giả điều khiển được mốc thời gian",
  },
  {
    ac: "AC-T40",
    vi_sao: "dẫn đường tới điểm đã lưu cần seed forfish.places.v1 rồi mở /ngu-truong (bản đồ nặng, chờ tile) — chưa có bước seed dùng chung trong helpers",
    tc: ["TC-T40"],
    khi_nao_tra: "khi helpers e2e có bước seed điểm đã lưu, gộp cùng ca AC-T44 để trả một lượt",
  },
  {
    ac: "AC-T43",
    vi_sao: "cần ép localStorage.setItem ném QuotaExceededError ĐÚNG một lần ở bước ghi giỏ; đè Storage.prototype.setItem từ initScript làm hỏng cả lượt đăng nhập và bản lưu dự báo",
    tc: ["TC-T43"],
    khi_nao_tra: "khi lib/market/cart.ts ghi qua một cổng lưu trữ tiêm được, thay vì gọi thẳng localStorage",
  },
  {
    ac: "AC-T55",
    vi_sao: "Anthropic treo >20 s: phải chặn mạng ở tầng route rồi đợi 21 giây thật, và đường ASSISTANT_MOCK=1 của bộ e2e không đi qua nhánh có đồng hồ",
    tc: ["TC-T55"],
    khi_nao_tra: "khi claude.ts nhận fetch qua đối số để test tiêm đồng hồ giả (vi.useFakeTimers), không cần đợi thật",
  },
];

function docFiles(): [string, string][] {
  const out: [string, string][] = [];
  for (const [dir, pat] of [
    [UNIT_DIR, /\.test\.ts$/],
    [E2E_DIR, /\.ts$/],
  ] as const) {
    for (const f of readdirSync(dir)) {
      if (!pat.test(f) || f === SELF) continue;
      // đọc utf8: assistant-parse.test.ts có ký tự điều khiển THẬT trong một chuỗi
      // thử đầu vào lạ, nên `file` gọi nó là nhị phân — vẫn đọc được như văn bản
      out.push([f, readFileSync(join(dir, f), "utf8")]);
    }
  }
  return out;
}

/** Mã AC nằm trong nhãn của ca ĐANG BỊ HOÃN (`test.fixme` / `.skip`). */
function maHoan(src: string): string[] {
  const out: string[] = [];
  const re = /\b(?:test|it|describe)\.(?:fixme|skip)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) out.push(...codesIn(src.slice(m.index, m.index + 300)));
  return out;
}

describe("AC oracle — mọi điều khoản nghiệm thu của Trợ lý phải có người nhận", () => {
  const spec = readFileSync(SPEC, "utf8");
  const acBlock = spec.slice(spec.indexOf("## 9. Acceptance Criteria"), spec.indexOf("## 10."));
  const specCodes = [...new Set(acBlock.match(/^- (AC-T\d{2})/gm)?.map((l) => l.slice(2)) ?? [])];

  const files = docFiles();
  const hoan = new Set(files.flatMap(([, src]) => maHoan(src)));
  const auto = new Set(files.flatMap(([, src]) => codesIn(src)).filter((c) => !hoan.has(c)));
  const tay = new Map(CHUYEN_TAY.map((n) => [n.ac, n]));
  const tayDoc = readFileSync(TAY_DOC, "utf8");

  it("1. đọc được spec 13 §9 và nó khai đủ bộ mã liên tục AC-T01..AC-T56", () => {
    expect(specCodes.length, "số AC đọc được từ spec").toBe(56);
    for (let i = 1; i <= 56; i++) {
      const ma = `AC-T${String(i).padStart(2, "0")}`;
      expect(specCodes, `spec thiếu mã ${ma}`).toContain(ma);
    }
  });

  it("2. KHÔNG AC nào treo: hoặc có ca tự động đang chạy, hoặc đã khai chuyển đo tay", () => {
    const treo = specCodes.filter((c) => !auto.has(c) && !tay.has(c));
    expect(
      treo,
      `AC KHÔNG AI NHẬN: ${treo.join(", ")}\n` +
        "→ viết ca kiểm ghi mã đó trong nhãn, hoặc khai vào bảng CHUYEN_TAY ở đầu tệp này (lý do + mã kịch bản đo tay + điều kiện trả nợ).",
    ).toEqual([]);
  });

  it("3. chống GIẢ XANH: mã chỉ nằm trong ca bị hoãn không được tính là đã phủ", () => {
    const giaXanh = [...hoan].filter((c) => !auto.has(c) && !tay.has(c));
    expect(
      giaXanh,
      `mã chỉ xuất hiện trong test.fixme/skip mà không khai chuyển tay: ${giaXanh.join(", ")}`,
    ).toEqual([]);
  });

  it("4. bảng CHUYEN_TAY sạch: không giữ mã đã tự động hoá, không khai mã lạ", () => {
    const traRoi = CHUYEN_TAY.filter((n) => auto.has(n.ac)).map((n) => n.ac);
    expect(traRoi, `đã có ca tự động rồi mà còn nằm trong CHUYEN_TAY: ${traRoi.join(", ")}`).toEqual([]);

    const maLa = CHUYEN_TAY.filter((n) => !specCodes.includes(n.ac)).map((n) => n.ac);
    expect(maLa, `CHUYEN_TAY khai mã không có trong spec: ${maLa.join(", ")}`).toEqual([]);
  });

  it("5. mỗi dòng CHUYEN_TAY khai đủ lý do, điều kiện trả nợ, và mã kịch bản CÓ THẬT", () => {
    for (const n of CHUYEN_TAY) {
      expect(n.vi_sao.length, `${n.ac}: lý do quá ngắn, không kiểm chứng được`).toBeGreaterThan(40);
      expect(n.khi_nao_tra.length, `${n.ac}: thiếu điều kiện nâng cấp (NT15 §7)`).toBeGreaterThan(20);
      expect(n.tc.length, `${n.ac}: chưa trỏ kịch bản đo tay nào`).toBeGreaterThan(0);
      for (const tc of n.tc) {
        expect(
          tayDoc.includes(tc),
          `${n.ac} trỏ ${tc} nhưng docs/test-cases/tro-ly-2026-09-06.md không có mã đó — khai khống`,
        ).toBe(true);
      }
    }
  });

  it("6. tài liệu đo tay phủ ngược đủ 56 AC (tầng cuối khi tự động bó tay)", () => {
    const thieu = specCodes.filter((c) => !tayDoc.includes(c));
    expect(thieu, `kịch bản đo tay không nhắc tới: ${thieu.join(", ")}`).toEqual([]);
  });

  it("7. bảng phủ (báo cáo, không phải phép so)", () => {
    const dong = specCodes.map((c) => (auto.has(c) ? `${c}·auto` : tay.has(c) ? `${c}·tay` : `${c}·TREO`));
    console.log(
      `[AC oracle] tự động ${auto.size}/${specCodes.length} · chuyển tay ${CHUYEN_TAY.length} · treo ${
        specCodes.length - auto.size - CHUYEN_TAY.length
      }\n  ` + dong.join("  "),
    );
    expect(auto.size + CHUYEN_TAY.length).toBe(specCodes.length);
  });
});

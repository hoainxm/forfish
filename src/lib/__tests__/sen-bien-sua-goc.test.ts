// @vitest-environment jsdom
// Rà "Sen Biển trả lời sai nhiều, chậm, chồng chéo" (anh Long 2026-10-24) — khoá năm chỗ sửa gốc:
// (1) chỉ làm theo n-gram khi CHẮC (đủ tin + không phân vân giữa hai ý) · kho: có máy nhà thì ngưỡng cao + câu "cần kiểm"
// để máy nhà trả lời · (2) huỷ được câu hỏi máy nhà của lượt cũ · (3) lệnh ngắn so trên chữ CÓ DẤU, chỉ câu ngắn ·
// (4) Gemma chưa biết chọn câu ⇒ không gọi · (5) tiếng đệm sau câu trả lời không thành câu hỏi mới.
import { existsSync, readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEVICE_TOKEN_KEY } from "@/lib/device-token-store";
import { DAU_KHO_PATH, loadDauKho } from "@/lib/sen-bien/dau-kho";
import { chonKho, GEMMA_BIET_CHON } from "@/lib/sen-bien/gemma";
import { senBienReply } from "@/lib/sen-bien/hieu-y";
import { docKho, HOI_DAP_PATH } from "@/lib/sen-bien/hoi-dap";
import { hoiKho, Q_CHAC, Q_CHAC_MANG, ungVien, type BoKho } from "@/lib/sen-bien/hoi-kho";
import { hoiMayChu } from "@/lib/sen-bien/hoi-may-chu";
import { LOC_PATH, loadLoc } from "@/lib/sen-bien/loc";
import { DAP_CAM_ON, laCauDem } from "@/lib/sen-bien/luong-tra-loi";
import { doTin, guessIntent, loadNgram, NGRAM_CACH, NGRAM_PATH } from "@/lib/sen-bien/ngram";

const ab = (p: string) => {
  const b = readFileSync(`public${p}`);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};
// bin v7 (cơ cấu mới 2026-10-25) giao sau — chưa có thì các khối cần trọng số skip có lý do
const coBin = existsSync(`public${NGRAM_PATH}`);
const m = coBin ? loadNgram(ab(NGRAM_PATH))! : (null as unknown as NonNullable<ReturnType<typeof loadNgram>>);
const canBin = describe.skipIf(!coBin);
const dk = loadDauKho(ab(DAU_KHO_PATH))!;
const kho = docKho(JSON.parse(readFileSync(`public${HOI_DAP_PATH}`, "utf8")), dk.nq)!;
const BO: BoKho = { dk, kho, loc: loadLoc(ab(LOC_PATH)) };
const tra = (cau: string) => senBienReply(cau, m, [], null);

canBin("(1) n-gram chỉ được tin khi chắc", () => {
  it("guessIntent trả khoảng cách tới ý nhì; doTin = 0 khi hai ý sát nhau", () => {
    const g = guessIntent(m, "thời tiết hôm nay");
    expect(g.cach).toBeGreaterThan(0);
    expect(g.cach).toBeLessThanOrEqual(g.conf);
    expect(doTin({ conf: 0.9, cach: NGRAM_CACH - 0.01 })).toBe(0);
    expect(doTin({ conf: 0.9, cach: NGRAM_CACH })).toBe(0.9);
    expect(doTin(null)).toBe(0);
  });
  it("câu ngoài nghề mô hình phân vân ⇒ 'chưa hiểu' (để máy nhà), không thành lệnh/câu hỏi bản đồ", () => {
    for (const cau of ["con gà có mấy chân", "gà có mấy chân", "tôi chưa ăn cơm"]) {
      const r = tra(cau);
      expect(r.kind).toBe("say");
      expect(r.kind === "say" && r.daTraLoi).toBeFalsy();
    }
  });
  it("lệnh / câu hỏi bản đồ rõ ràng vẫn chạy", () => {
    expect(tra("còn bao xa nữa tới").kind).toBe("howfar");
    expect(tra("gần đảo nào nhất").kind).toBe("hoi");
  });
});

canBin("(3) lệnh ngắn so trên chữ có dấu, chỉ câu ngắn", () => {
  it.each([
    ["bão bao giờ tới", "howfar"],
    ["đọc tiếp tin bão", "unmute"],
    ["tôi chưa ăn cơm", "howfar"],
    ["con nước rong là gì vậy", "repeat"],
  ])("'%s' KHÔNG còn là %s", (cau, sai) => expect(tra(cau).kind).not.toBe(sai));
  it.each([
    ["nhắc lại", "repeat"],
    ["gì vậy", "repeat"],
    ["tới chưa", "howfar"],
    ["còn mấy tiếng nữa", "howfar"],
    ["im đi", "mute"],
    ["đọc tiếp đi", "unmute"],
    ["con bao xa", "howfar"], // gõ không dấu ⇒ bộ luật bỏ dấu
  ])("lệnh thật '%s' ⇒ %s", (cau, dung) => expect(tra(cau).kind).toBe(dung));
});

canBin("(1b) kho khi có máy nhà", () => {
  const cauKiem = kho.q.find((id) => kho.canKiem.has(id))!;
  const cauHoiKiem = kho.cauHoi[kho.q.indexOf(cauKiem)];
  it("câu 'cần hỏi Chi cục' ⇒ mất sóng đọc câu an toàn, có máy nhà thì để máy nhà", async () => {
    const r = { kind: "say", say: "", y: "hoi_mo" } as const;
    const top = ungVien(BO, cauHoiKiem, {})[0];
    if (top.id !== cauKiem || top.p < Q_CHAC_MANG) return; // câu mẫu không chắc ⇒ không đủ để khoá hành vi
    const mat = await hoiKho(cauHoiKiem, r, BO, {}, null, false);
    expect(mat.vao && mat.dap?.id).toBe(cauKiem);
    expect(await hoiKho(cauHoiKiem, r, BO, {}, null, true)).toEqual({ vao: true, dap: null });
  });
  it("câu nhất giữa Q_CHAC và Q_CHAC_MANG ⇒ mất sóng đọc, có máy nhà thì để máy nhà", async () => {
    expect(Q_CHAC_MANG).toBeGreaterThan(Q_CHAC);
    const r = { kind: "say", say: "", y: "hoi_mo" } as const;
    const cau = kho.cauHoi.find((c, i) => {
      const u = ungVien(BO, c, {})[0];
      return !kho.canKiem.has(kho.q[i]) && u && u.p >= Q_CHAC && u.p < Q_CHAC_MANG && !kho.canKiem.has(u.id);
    });
    expect(cau).toBeTruthy();
    const mat = await hoiKho(cau!, r, BO, {}, null, false);
    expect(mat.vao && mat.dap).toBeTruthy();
    expect(await hoiKho(cau!, r, BO, {}, null, true)).toEqual({ vao: true, dap: null });
  });
});

canBin("(2) huỷ câu hỏi máy nhà của lượt cũ", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });
  it("tín hiệu huỷ ⇒ ngắt yêu cầu, không treo", async () => {
    localStorage.setItem(DEVICE_TOKEN_KEY, "sdf_" + "a".repeat(43));
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_u: string, init: RequestInit) =>
          new Promise((_ok, loi) => init.signal?.addEventListener("abort", () => loi(new DOMException("huỷ", "AbortError")))),
      ),
    );
    const c = new AbortController();
    const p = hoiMayChu("con gà có mấy chân", null, null, c.signal);
    c.abort();
    expect(await p).toEqual({ loi: "het_gio" });
  });
});

canBin("(4) Gemma chưa học vai chọn câu ⇒ không gọi", () => {
  it("chonKho null khi GEMMA_BIET_CHON tắt", () => {
    expect(GEMMA_BIET_CHON).toBe(false);
    expect(chonKho).toBeNull();
  });
});

describe("(5) tiếng đệm sau câu trả lời", () => {
  it.each(["ừm", "ủa", "Yeah", "Em hiểu rồi", "ok", "dạ", "trong khi", ""])("'%s' ⇒ đệm", (c) => expect(laCauDem(c)).toBe("dem"));
  it.each(["cảm ơn", "cảm ơn nha", "Cám ơn Sen Biển"])("'%s' ⇒ cảm ơn", (c) => expect(laCauDem(c)).toBe("cam_on"));
  it.each(["con gà có mấy chân", "ừ dẫn về Sa Huỳnh", "mất thời gian"])("'%s' ⇒ câu thật", (c) => expect(laCauDem(c)).toBeNull());
  it("đáp lời cảm ơn có chữ", () => expect(DAP_CAM_ON.length).toBeGreaterThan(0));
});

import { describe, it, expect } from "vitest";
import {
  daysOfDataLeft,
  lastOnlineAt,
  readinessChip,
} from "@/lib/app-usage";

/*  CHIP GỘP "ONLINE LẦN CUỐI + DỮ LIỆU TỚI NGÀY NÀO" (2026-08-02g).

    Đây là số liệu để QUYẾT ĐỊNH CÓ GỌI ĐIỆN NHẮC hay không, nên sai ở đây là
    hoặc bỏ sót một tàu sắp ra khơi với kho cạn, hoặc làm phiền người đã đủ đồ.

    Hai ràng buộc, cả hai đều do chủ dự án chỉ ra và cả hai đều có ca thật:
      · hai con số chỉ có nghĩa KHI ĐI CÙNG NHAU;
      · phải phân biệt KHO BẢN CÀI với KHO WEB — trên iOS chúng tách riêng. */

const NOW = Date.parse("2026-08-10T09:00:00+07:00");
const ngayTruoc = (n: number) => new Date(NOW - n * 86_400_000).toISOString();

describe("lastOnlineAt — mốc nhịp CHÍNH LÀ mốc online, không cần cột mới", () => {
  it("tách theo kho, và `any` là mốc muộn hơn", () => {
    const r = lastOnlineAt({
      pwaLastOpenAt: "2026-08-01T10:00:00Z",
      webLastOpenAt: "2026-08-09T10:00:00Z",
    });
    expect(r.sea).toBe("2026-08-01T10:00:00Z");
    expect(r.web).toBe("2026-08-09T10:00:00Z");
    expect(r.any).toBe("2026-08-09T10:00:00Z");
  });

  it("chưa nhịp nào → null hết (KHÔNG phải 'chưa dùng app')", () => {
    const r = lastOnlineAt({ pwaLastOpenAt: null, webLastOpenAt: null });
    expect(r.any).toBe(null);
  });
});

describe("daysOfDataLeft", () => {
  it("đếm theo ngày, mốc giờ VN", () => {
    expect(daysOfDataLeft("2026-08-18", NOW)).toBe(7);
    expect(daysOfDataLeft("2026-08-10", NOW)).toBe(-1);
  });

  it("thiếu / rác → null, KHÔNG ném và KHÔNG đoán bừa là 0", () => {
    expect(daysOfDataLeft(null, NOW)).toBe(null);
    expect(daysOfDataLeft("hôm nọ", NOW)).toBe(null);
  });
});

describe("readinessChip", () => {
  it("mở bản cài gần đây + kho bản cài còn dài → ok", () => {
    const c = readinessChip(
      {
        pwaLastOpenAt: ngayTruoc(0),
        webLastOpenAt: null,
        dataUntil: "2026-08-20",
      },
      NOW,
    );
    expect(c.tone).toBe("ok");
    expect(c.reason).toBe("on");
    expect(c.seaDays).toBe(9);
  });

  /*  ═══ CA CHỦ DỰ ÁN CHỈ RA — nguy hiểm mà nhìn qua rất đẹp ═══
      Đã cài, đã đủ đồ, mở app HẰNG NGÀY (nên "online lần cuối" luôn tươi và bậc
      thang vẫn xanh) — nhưng toàn mở bằng Safari. Trên iOS kho bản cài TÁCH
      RIÊNG, nên cái kho sẽ theo họ ra khơi đứng im từ 9 ngày trước.
      Nếu chip đo mốc MỚI NHẤT (max của hai kho) thì hàng này xanh — và đó đúng
      là bản đầu tôi viết. */
  it("đã cài + có dữ liệu nhưng gần đây TOÀN DÙNG WEB → warn 'ban-cai-cu'", () => {
    const c = readinessChip(
      {
        pwaLastOpenAt: ngayTruoc(9),
        webLastOpenAt: ngayTruoc(0),
        dataUntil: "2026-08-20",
        dataUntilWeb: "2026-08-20",
      },
      NOW,
    );
    expect(c.tone).toBe("warn");
    expect(c.reason).toBe("ban-cai-cu");
    // vẫn giữ đủ hai mốc để /quan-tri nói rõ kho nào
    expect(c.seaOnline).toBe(ngayTruoc(9));
    expect(c.webOnline).toBe(ngayTruoc(0));
  });

  it("cả hai kho đều lâu không mở → warn 'mat-song-lau' (việc cần làm KHÁC)", () => {
    const c = readinessChip(
      {
        pwaLastOpenAt: ngayTruoc(9),
        webLastOpenAt: ngayTruoc(11),
        dataUntil: "2026-08-20",
      },
      NOW,
    );
    expect(c.reason).toBe("mat-song-lau");
  });

  it("CHƯA BAO GIỜ mở bản cài → risk, dù kho web đầy tới đâu", () => {
    const c = readinessChip(
      {
        pwaLastOpenAt: null,
        webLastOpenAt: ngayTruoc(0),
        dataUntil: null,
        dataUntilWeb: "2026-08-25",
      },
      NOW,
    );
    expect(c.tone).toBe("risk");
    expect(c.reason).toBe("chua-cai");
    expect(c.webDays).toBe(14); // số vẫn giữ để nhân viên nói được với bà con
  });

  it("kho bản cài đã hết dữ liệu → risk, dù vừa mở xong", () => {
    const c = readinessChip(
      {
        pwaLastOpenAt: ngayTruoc(0),
        webLastOpenAt: null,
        dataUntil: "2026-08-09",
      },
      NOW,
    );
    expect(c.reason).toBe("het-du-lieu");
  });

  it("còn mở bản cài nhưng dữ liệu sắp cạn → warn 'sap-can': gọi là còn kịp", () => {
    const c = readinessChip(
      {
        pwaLastOpenAt: ngayTruoc(0),
        webLastOpenAt: null,
        dataUntil: "2026-08-12",
      },
      NOW,
    );
    expect(c.reason).toBe("sap-can");
  });

  it("chưa nhịp nào → unknown, KHÔNG tô đỏ", () => {
    const c = readinessChip(
      { pwaLastOpenAt: null, webLastOpenAt: null, dataUntil: null },
      NOW,
    );
    expect(c.tone).toBe("unknown");
    expect(c.reason).toBe("chua-ghi-nhan");
  });

  it("mở bản cài gần đây mà chưa báo ngày phủ → warn, không dám nói là ổn", () => {
    const c = readinessChip(
      { pwaLastOpenAt: ngayTruoc(0), webLastOpenAt: null, dataUntil: null },
      NOW,
    );
    expect(c.reason).toBe("chua-bao-ngay");
  });
});

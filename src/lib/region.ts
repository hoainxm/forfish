// Vùng & độ liên quan — để app chỉ hiện thông tin GẦN tàu của bà con
// (tàu HCM thì khỏi lôi vựa tận Bắc ra). Chuẩn hóa tên tỉnh (sau sáp nhập
// 2025, dữ liệu ghi không nhất quán: "TP.HCM" vs "Thành phố Hồ Chí Minh"…)
// về một khóa, rồi gom Bắc/Trung/Nam.

export type Region = "bac" | "trung" | "nam";

export const REGION_LABEL: Record<Region, string> = {
  bac: "Miền Bắc",
  trung: "Miền Trung",
  nam: "Miền Nam",
};

/** Tỉnh ven biển (tên hiển thị sau sáp nhập 2025) + vùng. Bắc→Nam. */
export const COASTAL_PROVINCES: { name: string; region: Region }[] = [
  { name: "Quảng Ninh", region: "bac" },
  { name: "Hải Phòng", region: "bac" },
  { name: "Hưng Yên", region: "bac" },
  { name: "Ninh Bình", region: "bac" },
  { name: "Thanh Hóa", region: "bac" },
  { name: "Nghệ An", region: "bac" },
  { name: "Hà Tĩnh", region: "bac" },
  { name: "Quảng Trị", region: "trung" },
  { name: "Thừa Thiên Huế", region: "trung" },
  { name: "Đà Nẵng", region: "trung" },
  { name: "Quảng Ngãi", region: "trung" },
  { name: "Gia Lai", region: "trung" },
  { name: "Đắk Lắk", region: "trung" },
  { name: "Khánh Hòa", region: "trung" },
  { name: "Lâm Đồng", region: "trung" },
  { name: "Thành phố Hồ Chí Minh", region: "nam" },
  { name: "Đồng Nai", region: "nam" },
  { name: "Đồng Tháp", region: "nam" },
  { name: "Vĩnh Long", region: "nam" },
  { name: "An Giang", region: "nam" },
  { name: "Cần Thơ", region: "nam" },
  { name: "Cà Mau", region: "nam" },
];

/** Chuẩn hóa tên tỉnh về khóa không dấu, bỏ "thành phố/tỉnh", gộp alias. */
export function provinceKey(s?: string): string {
  let k = (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/\b(thanh pho|tinh|tp\.?)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
  // alias hay gặp
  if (/hochiminh|hcm|saigon|sg/.test(k)) k = "hochiminh";
  if (/thuathienhue|^hue$/.test(k)) k = "thuathienhue";
  return k;
}

const KEY_TO_REGION: Record<string, Region> = Object.fromEntries(
  COASTAL_PROVINCES.map((p) => [provinceKey(p.name), p.region]),
);

export function regionOf(province?: string): Region | null {
  return KEY_TO_REGION[provinceKey(province)] ?? null;
}

/** 0 = đúng tỉnh nhà · 1 = cùng miền · 2 = miền khác/không rõ. */
export function relevanceRank(
  itemProvince: string | undefined,
  homeProvince: string | undefined,
): 0 | 1 | 2 {
  if (!homeProvince) return 2;
  const ik = provinceKey(itemProvince);
  const hk = provinceKey(homeProvince);
  if (ik && ik === hk) return 0;
  const ir = regionOf(itemProvince);
  const hr = regionOf(homeProvince);
  if (ir && hr && ir === hr) return 1;
  return 2;
}

export interface HomePref {
  province?: string; // tên hiển thị
  portId?: string; // cảng hay cập (id trong fishing-ports), tùy chọn
}

const HOME_KEY = "forfish.home.v1";

export function loadHome(): HomePref {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(HOME_KEY);
    if (raw) return JSON.parse(raw) as HomePref;
  } catch {
    /* ignore */
  }
  return {};
}

export function saveHome(h: HomePref) {
  try {
    window.localStorage.setItem(HOME_KEY, JSON.stringify(h));
  } catch {
    /* ignore */
  }
}

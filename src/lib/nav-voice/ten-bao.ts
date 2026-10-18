// TÊN BÃO ĐỂ NÓI — phiên âm tiếng Việt 140 tên bão Tây Bắc Thái Bình Dương
// (danh sách Uỷ ban Bão ESCAP/WMO, bản JMA RSMC Tokyo đối chiếu 2026-10-17)
// + 10 tên vừa rút khỏi danh sách (tin cũ trong máy còn có thể mang tên này).
//
// Vì sao: nguồn tin bão (GDACS, NCHMF) ghi tên quốc tế viết hoa ("WUTIP",
// "YAGI"); giọng máy đọc kiểu tiếng Anh, bà con nghe không ra con bão đài
// đang nói. Câu đọc dùng bản phiên âm này, ghép bằng mảnh giọng Mỹ Duyên
// (doc 15 §21j). Chữ trên màn hình vẫn in tên quốc tế như bản tin nhà nước.
//
// Luật phiên âm (doc 15 §21j, Assumptions):
//  · Tên Việt Nam góp: viết đúng chữ Việt ("Sơn Tinh", "Hạ Long").
//  · Tên Trung Quốc đại lục góp + vài tên Hồng Kông có chữ Hán rõ nghĩa:
//    đọc Hán Việt như báo đài vẫn đọc ("Ngộ Không", "Phượng Hoàng").
//  · Còn lại: âm tiết tiếng Việt gần nhất với cách đọc gốc, theo giọng Nam
//    của Mỹ Duyên (d/gi = "y"): "Da ghi" = Yagi.
//  · Không có trong bảng ⇒ trả nguyên tên (giọng máy đọc), không bịa.
//
// Thêm/sửa tên: sửa bảng → `node scripts/sen-bien-giong/lap_manh.mjs` (nhóm
// `bao`) → sinh mp3 trên gpu-desktop (doc 15 §21e).

/** Khoá tra: chữ hoa, bỏ gạch nối/khoảng trắng ("Co-may" = "CO MAY" = "COMAY"). */
export const khoaTenBao = (name: string): string => name.toUpperCase().replace(/[^A-Z]/g, "");

const BANG: Record<string, string> = {
  // ── cột I
  Damrey: "Đam rây", Tianma: "Thiên Mã", Kirogi: "Ki rô ghi", "Yun-yeung": "Uyên Ương",
  Koinu: "Côi nu", Bolaven: "Bô la ven", Sanba: "San ba", Jelawat: "Giê la oát",
  Tirou: "Ti râu", Maliksi: "Ma lích xi", Gaemi: "Ghe mi", Prapiroon: "Pa ra pi run",
  Maria: "Ma ri a", "Son-Tinh": "Sơn Tinh", Ampil: "Am pin", Wukong: "Ngộ Không",
  Jongdari: "Chong đa ri", Shanshan: "San San", Tomo: "Tô mô", Leepi: "Li pi",
  Bebinca: "Bê bin ca", Pulasan: "Pu la xan", Soulik: "Xu lích", Cimaron: "Xi ma rôn",
  Narae: "Na re", Burapha: "Bu ra pha", Barijat: "Ba ri chát", Hoaban: "Hoa Ban",
  // ── cột II
  Koki: "Cô ki", Yinxing: "Ngân Hạnh", Gaeguri: "Ghe gu ri", "Dim-sum": "Điểm Tâm",
  Hebi: "Hê bi", Pabuk: "Pa búc", Wutip: "Vu típ", Sepat: "Xê pát",
  Mun: "Mun", Danas: "Đa nát", Nari: "Na ri", Wipha: "Vi pha",
  Francisco: "Phơ ran xít cô", "Co-May": "Cỏ May", Krosa: "Cơ rô xa", Bailu: "Bạch Lộc",
  Podul: "Pô đun", Lingling: "Linh linh", Kajiki: "Ca gi ki", Nongfa: "Nông pha",
  Peipah: "Pây pa", Tapah: "Ta pa", Mitag: "Mi tác", Ragasa: "Ra ga xa",
  Neoguri: "Nê ô gu ri", Bualoi: "Bua lôi", Matmo: "Mát mô", Halong: "Hạ Long",
  // ── cột III
  Nakri: "Nác ri", Fengshen: "Phong Thần", Kalmaegi: "Can me ghi", "Fung-wong": "Phượng Hoàng",
  Koto: "Cô tô", Nokaen: "Nô ken", Penha: "Pen ha", Nuri: "Nu ri",
  Sinlaku: "Xin la cu", Hagupit: "Ha gu pít", Jangmi: "Chang mi", Mekkhala: "Mếch kha la",
  Higos: "Hi gốt", Bavi: "Ba Vì", Maysak: "Mây xắc", Haishen: "Hải Thần",
  Noul: "Nô un", Dolphin: "Đôn phin", Kujira: "Cu gi ra", "Chan-hom": "Chan hôm",
  Peilou: "Pây lâu", Nangka: "Nang ca", Saudel: "Xau đen", Narra: "Na ra",
  Gaenari: "Ghe na ri", Atsani: "Át xa ni", Etau: "Ê tau", "Bang-Lang": "Bằng Lăng",
  // ── cột IV
  Krovanh: "Cơ rô vanh", Dujuan: "Đỗ Quyên", Surigae: "Xu ri ghe", "Choi-wan": "Thái Vân",
  Koguma: "Cô gu ma", Champi: "Chăm pi", "In-fa": "In pha", Cempaka: "Chem pa ca",
  Nepartak: "Nê pa tác", Lupit: "Lu pít", Mirinae: "Mi ri ne", Nida: "Ni đa",
  Omais: "Ô mai", "Luc-Binh": "Lục Bình", Chanthu: "Chan thu", Dianmu: "Điện Mẫu",
  Mindulle: "Min đu le", Lionrock: "Lai ơn rốc", Tokei: "Tô kê", Namtheun: "Nam thơn",
  Malou: "Ma lâu", Nyatoh: "Nha tô", Sarbul: "Xa bun", Amuyao: "A mu dao",
  Gosari: "Gô xa ri", Chaba: "Cha ba", Aere: "Ê rê", Songda: "Sông Đà",
  // ── cột V
  Trases: "Tra xét", Mulan: "Mộc Lan", Meari: "Mê a ri", "Tsing-ma": "Thanh Mã",
  Tokage: "Tô ca ghê", "Ong-mang": "Ông mang", Muifa: "Mui pha", Merbok: "Mơ búc",
  Nanmadol: "Nan ma đôn", Talas: "Ta lát", Hodu: "Hô đu", Kulap: "Cu láp",
  Roke: "Rô kê", Sonca: "Sơn Ca", Nesat: "Nê xát", Haitang: "Hải Đường",
  Jamjari: "Cham cha ri", Banyan: "Ban dan", Yamaneko: "Da ma nê cô", Pakhar: "Pa kha",
  Sanvu: "San vu", Mawar: "Ma oa", Guchol: "Gu chôn", Talim: "Ta lim",
  Bori: "Bô ri", Khanun: "Kha nun", Lan: "Lan", Saobien: "Sao Biển",
  // ── vừa rút khỏi danh sách (thay bằng Tianma, Tirou, Tomo, Narae, Burapha,
  //    Hoaban, Koki, Gaeguri, Dim-sum, Hebi)
  Haikui: "Hải Quỳ", Ewiniar: "Ê vi nia", Yagi: "Da ghi", Jebi: "Chê bi",
  Krathon: "Cơ ra thon", Trami: "Trà Mi", "Kong-rey": "Công rây", Toraji: "Tô ra gi",
  "Man-yi": "Man di", Usagi: "U xa ghi",
};

/** Khoá đã chuẩn hoá → bản đọc. */
export const TEN_BAO_NOI: ReadonlyMap<string, string> = new Map(
  Object.entries(BANG).map(([k, v]) => [khoaTenBao(k), v]),
);

/** Số tên đang dùng (cột I–V) — test giữ đúng 140. */
export const SO_TEN_HIEN_HANH = 140;

/** "WUTIP" → "Vu típ". Không có trong bảng ⇒ trả nguyên tên. */
export function tenBaoNoi(name: string): string {
  return TEN_BAO_NOI.get(khoaTenBao(name)) ?? name;
}

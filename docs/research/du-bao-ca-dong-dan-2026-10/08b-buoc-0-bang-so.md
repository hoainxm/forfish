# 08b — Bước 0: bảng số gốc (sinh bởi buoc0-chuyen.mjs trên PC GPU, 2026-10-22)

> Bản thô, không sửa tay. Đọc kết luận ở `08-buoc-0-ket-qua.md`. Script: `~/.local/forlife/train/buoc0-chuyen/buoc0-chuyen.mjs` trên gpu-desktop (chỉ đọc `dl-all` + `fc-full/features`, ngoài git). Không có mã tàu hay PII trong bảng.


Sinh 2026-10-22T08:05:35.330Z. Chuyến dùng: 102100. Độ phủ: {"logbooks":364788,"noTrip":0,"noTime":41452,"noVms":162724,"fewPts":2419,"carrier":9928,"noFishing":4452,"noKg":41713,"noFeat":820,"used":102100}

Hình dạng chuyến: {"daysMedian":11,"fishingHMedian":81.2,"featShareMean":0.971,"compact":{"trips":28327,"tripShare":0.277,"kgShare":0.305},"byGroup":{"vay":19698,"cau":26295,"re":25080,"keo":14452,"chup":11471,"khac":5104},"byMonth":{"1":9288,"2":5765,"3":10421,"4":12265,"5":14966,"6":12196,"7":13691,"8":10933,"9":10611,"10":139,"11":0,"12":1825},"byLen":{"<12":0,"12-15":25,"15-24":93414,">=24":8661,"?":0}}

Loài top: CTA Cá Tạp 125210574 kg/27197 chuyến · CXO Cá Xô 40780881 kg/12593 chuyến · MSD Cá Nục thuôn 23425922 kg/5664 chuyến · SKJ Cá ngừ vằn 23022995 kg/6333 chuyến · OMZ Mực xà 18809127 kg/16010 chuyến · YFT Cá ngừ vây vàng 14413356 kg/11974 chuyến · END Cá cơm con 13285315 kg/3374 chuyến · SZX Cá mối 12779927 kg/7120 chuyến · SQZ Mực giã 10228824 kg/15839 chuyến · ECP Cá chuồn vây vàng 9744700 kg/1117 chuyến · DCC Cá Nục thuôn 9276801 kg/2373 chuyến · BLT Cá ngừ ồ 9236037 kg/4322 chuyến · OCZ Bạch tuộc 9160588 kg/4420 chuyến · THB Cá lượng xô 8635352 kg/4996 chuyến · LHT Cá hố 7826960 kg/11183 chuyến · ESR Cá cơm thường 7745303 kg/834 chuyến · SLF Cá chọn 7058736 kg/1947 chuyến · RUS Cá nục 6888670 kg/3413 chuyến · TRY Cá chỉ vàng 6675743 kg/1310 chuyến · RKB Cá bò gai 6410792 kg/765 chuyến · IAX Mực nang lớn 6265693 kg/5070 chuyến · THG Cá đổng cờ 4595399 kg/4785 chuyến · LOT Cá ngừ bò 4205743 kg/2506 chuyến · APO Cá sơn 4091508 kg/351 chuyến · FRI Cá ngừ chù 3766610 kg/4250 chuyến

## tổng kg, log kg (cả năm)

n=99169 (bỏ 2931 ở tầng <5 chuyến) · tầng: {"gearLen":17,"monthRegion":2085,"vessels":14493} · y: {"sd":1.643,"residSdA":1.097,"residSdB":0.622,"r2A":0.554,"r2B":0.857} · β_A: {"logH":-0.013,"logTripH":0.048,"moonCos":-0.001,"moonSin":-0.045}

ICC tàu (trên ε_A): **0.511** (k=14493, n0=6.84) · n hiệu dụng: {"trips":99169,"vessels":14493,"clustersWeekRegion":7444,"kishClusters":2161,"kishVessels":7298} · ρ_min (α 0,05, power 0,8): {"trips":0.0089,"vessels":0.0233,"clustersWeekRegion":0.0325,"kishClusters":0.0602,"kishVessels":0.0328}

| đặc trưng | n | sd | còn lại sau nghề×lớp+tháng×vùng | còn lại sau +tàu | ρ trong tàu (thăm dò) | CI 90 % cụm |
|---|---|---|---|---|---|---|
| t | 98476 | 2.3219 | 4.6 % | 4.0 % | -0.0304 | [-0.039, -0.0222] |
| c | 97983 | 1.0748 | 32.9 % | 23.9 % | -0.0243 | [-0.0306, -0.0172] |
| fThermFront | 98476 | 0.2053 | 30.8 % | 25.8 % | -0.0088 | [-0.0169, -0.0008] |
| fChlFront | 98476 | 0.2681 | 22.5 % | 18.2 % | -0.0411 | [-0.0489, -0.032] |
| fEddy | 98476 | 0.2353 | 39.3 % | 32.5 % | 0.0099 | [-0.0002, 0.0181] |
| coldStr | 98476 | 0.2662 | 30.5 % | 26.3 % | -0.0095 | [-0.0179, -0.0008] |
| warmStr | 98476 | 0.239 | 36.0 % | 30.5 % | -0.0059 | [-0.0148, 0.0035] |
| upwTerm | 98476 | 0.2668 | 38.1 % | 32.6 % | -0.0001 | [-0.0089, 0.0087] |
| convTerm | 0 | — | — | — | — | — |
| thermoAnomM | 0 | — | — | — | — | — |

## tổng kg, log(kg/giờ đánh) (cả năm)

n=99169 (bỏ 2931 ở tầng <5 chuyến) · tầng: {"gearLen":17,"monthRegion":2085,"vessels":14493} · y: {"sd":2.167,"residSdA":1.097,"residSdB":0.622,"r2A":0.744,"r2B":0.918} · β_A: {"logH":-1.013,"logTripH":0.048,"moonCos":-0.001,"moonSin":-0.045}

ICC tàu (trên ε_A): **0.511** (k=14493, n0=6.84) · n hiệu dụng: {"trips":99169,"vessels":14493,"clustersWeekRegion":7444,"kishClusters":2161,"kishVessels":7298} · ρ_min (α 0,05, power 0,8): {"trips":0.0089,"vessels":0.0233,"clustersWeekRegion":0.0325,"kishClusters":0.0602,"kishVessels":0.0328}

| đặc trưng | n | sd | còn lại sau nghề×lớp+tháng×vùng | còn lại sau +tàu | ρ trong tàu (thăm dò) | CI 90 % cụm |
|---|---|---|---|---|---|---|
| t | 98476 | 2.3219 | 4.6 % | 4.0 % | -0.0304 | [-0.039, -0.0222] |
| c | 97983 | 1.0748 | 32.9 % | 23.9 % | -0.0243 | [-0.0306, -0.0172] |
| fThermFront | 98476 | 0.2053 | 30.8 % | 25.8 % | -0.0088 | [-0.0169, -0.0008] |
| fChlFront | 98476 | 0.2681 | 22.5 % | 18.2 % | -0.0411 | [-0.0489, -0.032] |
| fEddy | 98476 | 0.2353 | 39.3 % | 32.5 % | 0.0099 | [-0.0002, 0.0181] |
| coldStr | 98476 | 0.2662 | 30.5 % | 26.3 % | -0.0095 | [-0.0179, -0.0008] |
| warmStr | 98476 | 0.239 | 36.0 % | 30.5 % | -0.0059 | [-0.0148, 0.0035] |
| upwTerm | 98476 | 0.2668 | 38.1 % | 32.6 % | -0.0001 | [-0.0089, 0.0087] |
| convTerm | 0 | — | — | — | — | — |
| thermoAnomM | 0 | — | — | — | — | — |

## log kg, nửa đầu (T1–5)

n=51137 (bỏ 1568 ở tầng <5 chuyến) · tầng: {"gearLen":17,"monthRegion":1170,"vessels":12375} · y: {"sd":1.62,"residSdA":1.082,"residSdB":0.553,"r2A":0.554,"r2B":0.883} · β_A: {"logH":-0.088,"logTripH":0.047,"moonCos":0.02,"moonSin":-0.048}

ICC tàu (trên ε_A): **0.524** (k=12375, n0=4.13) · n hiệu dụng: {"trips":51137,"vessels":12375,"clustersWeekRegion":4178,"kishClusters":1174,"kishVessels":7109} · ρ_min (α 0,05, power 0,8): {"trips":0.0124,"vessels":0.0252,"clustersWeekRegion":0.0433,"kishClusters":0.0817,"kishVessels":0.0332}

| đặc trưng | n | sd | còn lại sau nghề×lớp+tháng×vùng | còn lại sau +tàu | ρ trong tàu (thăm dò) | CI 90 % cụm |
|---|---|---|---|---|---|---|
| t | 51015 | 2.5688 | 5.4 % | 4.1 % | -0.0204 | [-0.0329, -0.0072] |
| c | 50842 | 0.726 | 34.4 % | 22.0 % | -0.0246 | [-0.0378, -0.012] |
| fThermFront | 51015 | 0.2031 | 27.4 % | 21.1 % | -0.0132 | [-0.0248, -0.0026] |
| fChlFront | 51015 | 0.2624 | 19.9 % | 14.0 % | -0.0638 | [-0.0751, -0.0529] |
| fEddy | 51015 | 0.2152 | 43.4 % | 33.5 % | -0.005 | [-0.0157, 0.0066] |
| coldStr | 51015 | 0.2069 | 45.3 % | 35.7 % | -0.0359 | [-0.0496, -0.0228] |
| warmStr | 51015 | 0.2418 | 38.7 % | 30.8 % | 0.0107 | [-0.0001, 0.0219] |
| upwTerm | 51015 | 0.2249 | 49.2 % | 38.5 % | -0.0029 | [-0.0172, 0.011] |
| convTerm | 0 | — | — | — | — | — |
| thermoAnomM | 0 | — | — | — | — | — |

## log kg, nửa sau (T6–10)

n=48032 (bỏ 1363 ở tầng <5 chuyến) · tầng: {"gearLen":15,"monthRegion":915,"vessels":11414} · y: {"sd":1.661,"residSdA":1.103,"residSdB":0.542,"r2A":0.559,"r2B":0.894} · β_A: {"logH":0.053,"logTripH":0.048,"moonCos":-0.021,"moonSin":-0.04}

ICC tàu (trên ε_A): **0.586** (k=11414, n0=4.21) · n hiệu dụng: {"trips":48032,"vessels":11414,"clustersWeekRegion":3379,"kishClusters":1013,"kishVessels":5709} · ρ_min (α 0,05, power 0,8): {"trips":0.0128,"vessels":0.0262,"clustersWeekRegion":0.0482,"kishClusters":0.0879,"kishVessels":0.0371}

| đặc trưng | n | sd | còn lại sau nghề×lớp+tháng×vùng | còn lại sau +tàu | ρ trong tàu (thăm dò) | CI 90 % cụm |
|---|---|---|---|---|---|---|
| t | 47461 | 1.1439 | 9.8 % | 7.6 % | -0.0281 | [-0.0413, -0.0133] |
| c | 47141 | 1.3337 | 33.3 % | 21.9 % | -0.0119 | [-0.0209, -0.0027] |
| fThermFront | 47461 | 0.2075 | 34.4 % | 25.3 % | 0.0026 | [-0.0106, 0.0153] |
| fChlFront | 47461 | 0.2636 | 27.1 % | 19.9 % | -0.0307 | [-0.0437, -0.0183] |
| fEddy | 47461 | 0.2517 | 37.2 % | 26.9 % | 0.0227 | [0.0111, 0.033] |
| coldStr | 47461 | 0.3051 | 25.6 % | 19.9 % | 0.0127 | [0.0011, 0.0241] |
| warmStr | 47461 | 0.234 | 33.4 % | 24.1 % | -0.0288 | [-0.0417, -0.015] |
| upwTerm | 47461 | 0.3014 | 32.4 % | 24.6 % | 0.0052 | [-0.0061, 0.017] |
| convTerm | 0 | — | — | — | — | — |
| thermoAnomM | 0 | — | — | — | — | — |

## mực xà: log kg loài (chuyến có loài)

n=15037 (bỏ 1486 ở tầng <5 chuyến) · tầng: {"gearLen":10,"monthRegion":560,"vessels":3933} · y: {"sd":1.713,"residSdA":1.106,"residSdB":0.42,"r2A":0.583,"r2B":0.94} · β_A: {"logH":0.245,"logTripH":-0.296,"moonCos":-0.047,"moonSin":-0.259}

ICC tàu (trên ε_A): **0.555** (k=3933, n0=3.82) · n hiệu dụng: {"trips":15037,"vessels":3933,"clustersWeekRegion":1499,"kishClusters":487,"kishVessels":3142} · ρ_min (α 0,05, power 0,8): {"trips":0.0228,"vessels":0.0447,"clustersWeekRegion":0.0723,"kishClusters":0.1267,"kishVessels":0.05}

| đặc trưng | n | sd | còn lại sau nghề×lớp+tháng×vùng | còn lại sau +tàu | ρ trong tàu (thăm dò) | CI 90 % cụm |
|---|---|---|---|---|---|---|
| t | 15026 | 1.4897 | 4.1 % | 2.9 % | -0.0326 | [-0.0496, -0.0171] |
| c | 15026 | 0.151 | 62.7 % | 46.3 % | 0.0294 | [0.0092, 0.0439] |
| fThermFront | 15026 | 0.1318 | 30.6 % | 21.5 % | 0.0172 | [-0.0015, 0.0353] |
| fChlFront | 15026 | 0.1115 | 34.6 % | 22.6 % | -0.0431 | [-0.0617, -0.023] |
| fEddy | 15026 | 0.1918 | 30.3 % | 21.6 % | 0.0074 | [-0.0074, 0.0236] |
| coldStr | 15026 | 0.2326 | 23.5 % | 16.2 % | 0.0187 | [-0.0046, 0.039] |
| warmStr | 15026 | 0.2355 | 25.2 % | 17.5 % | -0.0059 | [-0.0252, 0.0113] |
| upwTerm | 15026 | 0.2317 | 35.2 % | 25.0 % | 0.0355 | [0.0167, 0.0524] |
| convTerm | 0 | — | — | — | — | — |
| thermoAnomM | 0 | — | — | — | — | — |

## cá nục: log kg loài (chuyến có loài)

n=22786 (bỏ 2586 ở tầng <5 chuyến) · tầng: {"gearLen":13,"monthRegion":1033,"vessels":5661} · y: {"sd":1.97,"residSdA":1.076,"residSdB":0.643,"r2A":0.702,"r2B":0.893} · β_A: {"logH":-0.166,"logTripH":-0.117,"moonCos":0.044,"moonSin":-0.077}

ICC tàu (trên ε_A): **0.383** (k=5661, n0=4.02) · n hiệu dụng: {"trips":22786,"vessels":5661,"clustersWeekRegion":3422,"kishClusters":1155,"kishVessels":2684} · ρ_min (α 0,05, power 0,8): {"trips":0.0186,"vessels":0.0372,"clustersWeekRegion":0.0479,"kishClusters":0.0824,"kishVessels":0.0541}

| đặc trưng | n | sd | còn lại sau nghề×lớp+tháng×vùng | còn lại sau +tàu | ρ trong tàu (thăm dò) | CI 90 % cụm |
|---|---|---|---|---|---|---|
| t | 22767 | 1.7948 | 4.6 % | 3.5 % | 0.0036 | [-0.0097, 0.0164] |
| c | 22751 | 0.3881 | 29.2 % | 16.6 % | -0.032 | [-0.0451, -0.0166] |
| fThermFront | 22767 | 0.1841 | 27.4 % | 19.9 % | -0.0165 | [-0.0301, -0.0024] |
| fChlFront | 22767 | 0.2376 | 21.8 % | 15.7 % | -0.0177 | [-0.0292, -0.005] |
| fEddy | 22767 | 0.2178 | 40.7 % | 30.3 % | 0.0079 | [-0.0061, 0.0221] |
| coldStr | 22767 | 0.2645 | 25.2 % | 19.6 % | -0.0127 | [-0.028, 0.0024] |
| warmStr | 22767 | 0.2228 | 28.7 % | 20.4 % | -0.0119 | [-0.0254, 0.0004] |
| upwTerm | 22767 | 0.2503 | 35.4 % | 26.9 % | -0.0174 | [-0.0328, -0.0029] |
| convTerm | 0 | — | — | — | — | — |
| thermoAnomM | 0 | — | — | — | — | — |

## cá cơm: log kg loài (chuyến có loài)

n=4191 (bỏ 644 ở tầng <5 chuyến) · tầng: {"gearLen":13,"monthRegion":189,"vessels":818} · y: {"sd":1.136,"residSdA":0.899,"residSdB":0.67,"r2A":0.375,"r2B":0.652} · β_A: {"logH":0.072,"logTripH":-0.093,"moonCos":-0.068,"moonSin":-0.09}

ICC tàu (trên ε_A): **0.236** (k=818, n0=5.11) · n hiệu dụng: {"trips":4191,"vessels":818,"clustersWeekRegion":591,"kishClusters":136,"kishVessels":318} · ρ_min (α 0,05, power 0,8): {"trips":0.0433,"vessels":0.0978,"clustersWeekRegion":0.115,"kishClusters":0.2383,"kishVessels":0.1566}

| đặc trưng | n | sd | còn lại sau nghề×lớp+tháng×vùng | còn lại sau +tàu | ρ trong tàu (thăm dò) | CI 90 % cụm |
|---|---|---|---|---|---|---|
| t | 4067 | 2.7318 | 3.4 % | 2.7 % | -0.1295 | [-0.1633, -0.0925] |
| c | 3877 | 0.7675 | 34.4 % | 23.0 % | -0.0164 | [-0.0432, 0.0142] |
| fThermFront | 4067 | 0.2601 | 34.6 % | 29.9 % | 0.0078 | [-0.0211, 0.0365] |
| fChlFront | 4067 | 0.2327 | 39.7 % | 32.8 % | -0.0275 | [-0.0562, 0.0046] |
| fEddy | 4067 | 0.2405 | 39.9 % | 31.9 % | 0.0119 | [-0.027, 0.0463] |
| coldStr | 4067 | 0.3636 | 25.1 % | 20.1 % | -0.0537 | [-0.1027, -0.0017] |
| warmStr | 4067 | 0.2538 | 32.9 % | 25.4 % | 0.0485 | [0.0161, 0.0824] |
| upwTerm | 4067 | 0.363 | 23.2 % | 18.5 % | 0.0463 | [0.0114, 0.0766] |
| convTerm | 0 | — | — | — | — | — |
| thermoAnomM | 0 | — | — | — | — | — |

## cá ngừ vằn: log kg loài (chuyến có loài)

n=4203 (bỏ 2130 ở tầng <5 chuyến) · tầng: {"gearLen":10,"monthRegion":375,"vessels":971} · y: {"sd":1.358,"residSdA":0.889,"residSdB":0.528,"r2A":0.571,"r2B":0.849} · β_A: {"logH":0.36,"logTripH":-0.233,"moonCos":0.132,"moonSin":-0.072}

ICC tàu (trên ε_A): **0.354** (k=971, n0=4.32) · n hiệu dụng: {"trips":4203,"vessels":971,"clustersWeekRegion":1222,"kishClusters":695,"kishVessels":497} · ρ_min (α 0,05, power 0,8): {"trips":0.0432,"vessels":0.0898,"clustersWeekRegion":0.0801,"kishClusters":0.1061,"kishVessels":0.1254}

| đặc trưng | n | sd | còn lại sau nghề×lớp+tháng×vùng | còn lại sau +tàu | ρ trong tàu (thăm dò) | CI 90 % cụm |
|---|---|---|---|---|---|---|
| t | 4200 | 2.0774 | 3.1 % | 2.5 % | 0.0108 | [-0.0176, 0.0436] |
| c | 4200 | 0.2425 | 63.3 % | 34.3 % | -0.0526 | [-0.0798, -0.0252] |
| fThermFront | 4200 | 0.173 | 24.2 % | 18.5 % | 0.0013 | [-0.027, 0.0322] |
| fChlFront | 4200 | 0.1835 | 27.7 % | 20.2 % | -0.0832 | [-0.1157, -0.0467] |
| fEddy | 4200 | 0.2166 | 37.4 % | 29.0 % | 0.0724 | [0.0431, 0.1027] |
| coldStr | 4200 | 0.295 | 16.3 % | 12.2 % | 0.0167 | [-0.0127, 0.0468] |
| warmStr | 4200 | 0.2521 | 30.3 % | 22.2 % | 0.0253 | [-0.0026, 0.0541] |
| upwTerm | 4200 | 0.2649 | 34.9 % | 26.6 % | 0.0201 | [-0.0079, 0.0489] |
| convTerm | 0 | — | — | — | — | — |
| thermoAnomM | 0 | — | — | — | — | — |

## cá ngừ (mọi loại): log kg loài (chuyến có loài)

n=24120 (bỏ 2740 ở tầng <5 chuyến) · tầng: {"gearLen":13,"monthRegion":1171,"vessels":5211} · y: {"sd":1.27,"residSdA":0.991,"residSdB":0.641,"r2A":0.392,"r2B":0.745} · β_A: {"logH":0.118,"logTripH":-0.047,"moonCos":0.18,"moonSin":-0.04}

ICC tàu (trên ε_A): **0.34** (k=5211, n0=4.63) · n hiệu dụng: {"trips":24120,"vessels":5211,"clustersWeekRegion":3682,"kishClusters":1169,"kishVessels":3294} · ρ_min (α 0,05, power 0,8): {"trips":0.018,"vessels":0.0388,"clustersWeekRegion":0.0462,"kishClusters":0.0819,"kishVessels":0.0488}

| đặc trưng | n | sd | còn lại sau nghề×lớp+tháng×vùng | còn lại sau +tàu | ρ trong tàu (thăm dò) | CI 90 % cụm |
|---|---|---|---|---|---|---|
| t | 24069 | 1.8825 | 3.1 % | 2.4 % | 0.0194 | [0.0074, 0.0311] |
| c | 24056 | 0.3069 | 33.3 % | 21.3 % | -0.0325 | [-0.0438, -0.0194] |
| fThermFront | 24069 | 0.1607 | 28.7 % | 21.2 % | -0.0067 | [-0.0221, 0.0077] |
| fChlFront | 24069 | 0.206 | 22.3 % | 16.3 % | -0.0552 | [-0.0689, -0.04] |
| fEddy | 24069 | 0.1992 | 36.8 % | 28.4 % | 0.0255 | [0.0116, 0.0387] |
| coldStr | 24069 | 0.2475 | 25.0 % | 19.2 % | 0.0102 | [-0.0043, 0.0227] |
| warmStr | 24069 | 0.2426 | 26.2 % | 19.9 % | 0.0018 | [-0.013, 0.0152] |
| upwTerm | 24069 | 0.2198 | 37.7 % | 28.9 % | -0.0235 | [-0.0393, -0.0077] |
| convTerm | 0 | — | — | — | — | — |
| thermoAnomM | 0 | — | — | — | — | — |

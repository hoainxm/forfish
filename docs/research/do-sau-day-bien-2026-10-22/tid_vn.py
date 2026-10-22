import rasterio, numpy as np, sys
from rasterio.windows import from_bounds
base="https://data.source.coop/giswqs/gebco-bathymetry/"
W,S,E,N=102,5,118,23
with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR', CPL_VSIL_CURL_ALLOWED_EXTENSIONS='.tif'):
  with rasterio.open(base+"gebco_2026_tid/gebco_2026_tid_n90.0_s0.0_w90.0_e180.0.tif") as t, rasterio.open(base+"gebco_2026/gebco_2026_n90.0_s0.0_w90.0_e180.0.tif") as g:
    wt=from_bounds(W,S,E,N,t.transform); tid=t.read(1,window=wt)
    wg=from_bounds(W,S,E,N,g.transform); z=g.read(1,window=wg)
    print("shape",tid.shape,z.shape, "nodata", t.nodata, g.nodata)
sea=z<0
def report(mask,label):
    n=mask.sum(); print(f"\n== {label}: {n} cells (~{n*0.2:.0f} km2 at 15\")")
    vals,cnt=np.unique(tid[mask],return_counts=True)
    direct=0
    for v,c in sorted(zip(vals,cnt),key=lambda x:-x[1]):
        pct=100*c/n; print(f"  TID {v:3d}: {pct:6.2f}%  ({c})")
        if 10<=v<=39: direct+=c
    print(f"  -> direct-measured total: {100*direct/n:.2f}%")
report(sea,"All sea cells in bbox 102-118E 5-23N")
report(sea&(z>=-50),"Sea cells 0 to -50 m (shelf ven bờ)")
report(sea&(z>=-200)&(z<-50),"Sea cells -50 to -200 m")
# sub-boxes
boxes={"Vịnh Bắc Bộ (105.5-109E,17-21.5N)":(105.5,17,109,21.5),"Nam Trung Bộ ven bờ (108-110.5E,10-16N)":(108,10,110.5,16),"Thềm Mekong/Tây Nam (103-108E,7-10.5N)":(103,7,108,10.5),"Trường Sa (111-117E,6-12N)":(111,6,117,12),"Hoàng Sa (111-113E,15.5-17.5N)":(111,15.5,113,17.5)}
import math
res=15/3600
for name,(w,s,e,n) in boxes.items():
    c0=int((w-W)/res); c1=int((e-W)/res); r0=int((N-n)/res); r1=int((N-s)/res)
    m=np.zeros_like(sea); m[r0:r1,c0:c1]=True
    report(sea&m&(z>=-50), name+" 0..-50 m")

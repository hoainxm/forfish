def moi2(t, pk, dth, Rp=3, S=1, Hmin=3, Rmin=3, VKM=20, Rs=0, kn=None, Vs=0.5):
    """ở cảng = trong Rp km, HOẶC đứng yên (< Vs kn) trong Rs km quanh cảng (bến thường lệch tâm cảng 3–8 km);
    chuỗi ở cảng ≥ S giờ (hoặc dính mất tín hiệu) mới ngắt chuyến; mất tín hiệu ngoài biển chỉ ngắt khi đủ giờ vào bờ–ra lại.
    Chuyến hợp lệ: ≥ Hmin giờ ngoài vùng cảng, ra xa ≥ Rmin km."""
    n = len(t); inp = pk <= Rp
    if Rs and kn is not None: inp = inp | ((pk <= Rs) & (np.nan_to_num(kn, nan=0.0) < Vs))
    pk1 = np.r_[pk[1:], pk[-1]]
    B = (dth > 4) & (dth * VKM >= pk + pk1 + VKM * S)
    s_, e_ = runs(inp)
    for a, b in zip(s_, e_):
        dur = (t[min(b + 1, n - 1)] - t[a]) / 3600
        if dur >= S or a == 0 or b == n - 1 or (dth[a:b + 1] > 4).any(): B[a:b + 1] = True
    out = []; dd = np.where(dth > 4, 0, dth)
    s_, e_ = runs(~B)
    for a, b in zip(s_, e_):
        while a <= b and inp[a]: a += 1
        while b >= a and inp[b]: b -= 1
        if a > b: continue
        if dd[a:b + 1][~inp[a:b + 1]].sum() >= Hmin and pk[a:b + 1].max() >= Rmin: out.append((t[a], t[b] + dth[b] * 3600))
    return out

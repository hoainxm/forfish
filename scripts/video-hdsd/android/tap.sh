# tap.sh "<chữ hoặc mô tả>" — tìm nút theo text/desc trong uiautomator rồi chạm giữa
S=${HDSD_AND:-$HOME/hdsd-video/android}
b=$(bash $S/a.sh ui cur | grep -F -- "$1" | head -1 | cut -d" " -f1)
[ -z "$b" ] && { echo "KHÔNG THẤY: $1"; exit 1; }
read x1 y1 x2 y2 <<< $(echo $b | tr '[],' '   ')
bash $S/a.sh input tap $(( (x1+x2)/2 )) $(( (y1+y2)/2 )); echo "chạm $1 @ $(( (x1+x2)/2 )),$(( (y1+y2)/2 ))"

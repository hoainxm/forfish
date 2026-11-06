# a.sh <lệnh adb shell...>  |  a.sh shot <tên>  |  a.sh ui <tên>
export PATH=~/android-tools/sdk/platform-tools:$PATH
D=${HDSD_AND:-$HOME/hdsd-video/android}
A="adb -s emulator-5554"
case "$1" in
  shot) $A exec-out screencap -p > $D/$2.png ;;
  ui) $A shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1; $A exec-out cat /sdcard/ui.xml > $D/$2.xml; python3 -c "
import re,sys
x=open('$D/$2.xml',encoding='utf-8').read()
for m in re.finditer(r'<node [^>]*>',x):
  n=m.group(0); t=re.search(r' text=\"([^\"]*)\"',n).group(1); d=re.search(r'content-desc=\"([^\"]*)\"',n).group(1); b=re.search(r'bounds=\"([^\"]*)\"',n).group(1); r=re.search(r'resource-id=\"([^\"]*)\"',n).group(1)
  if t or d: print(b, '|', t, '|', d, '|', r.split('/')[-1])
" ;;
  *) $A shell "$@" ;;
esac

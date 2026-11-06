# Quay cài SDFish trên Chrome thật (giả lập Android 15 ở máy GPU). Ghi mốc từng bước vào moc.txt.
S=${HDSD_AND:-$HOME/hdsd-video/android}
A="bash $S/a.sh"; T="bash $S/tap.sh"
export PATH=~/android-tools/sdk/platform-tools:$PATH
DV="adb -s emulator-5554"
$A input keyevent KEYCODE_BACK; $A am force-stop com.android.chrome
$A settings put system show_touches 1
$A input keyevent KEYCODE_HOME; sleep 2
: > $S/moc.txt
$DV shell rm -f /sdcard/cai-android.mp4
$DV shell screenrecord --bit-rate 8000000 --time-limit 170 /sdcard/cai-android.mp4 &
T0=$(date +%s.%N); sleep 1.5
moc() { echo "$1 $(echo "$(date +%s.%N) - $T0" | bc)" >> $S/moc.txt; }
moc a; sleep 2.5
$A input tap 663 1970; sleep 3.5          # icon Chrome ở dock màn hình chính
$T "url_bar" || $A input tap 420 205; sleep 1.2
$A input text "sdfish.sdvico.vn"; sleep 1.5; $A input keyevent KEYCODE_ENTER
moc b; sleep 6
moc c; $A input tap 1010 205; sleep 2.5
moc d; $T "Install and create shortcut"; sleep 2.5
moc e; $T "| Install |"; sleep 3
$T "| Install |"; sleep 5
moc f; $T "Add to home screen"; sleep 3
moc g; $A input keyevent KEYCODE_HOME; sleep 3
$A ui home | cut -d"|" -f1-3 | grep -i sdfish
$T "| SDFish |"; sleep 8
moc h; sleep 1
$DV shell pkill -INT screenrecord; sleep 4
$DV pull /sdcard/cai-android.mp4 $S/cai-android.mp4 >/dev/null
$A settings put system show_touches 0
cat $S/moc.txt

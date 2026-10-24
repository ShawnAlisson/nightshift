#!/bin/bash
# Starts the desktop inside the sandbox: X server with VNC, Openbox, a bottom
# panel, the noVNC web client (port 6080) and Chrome.
# Needs VNC_PASSWORD; RESOLUTION is optional (default 1280x800).
set -u

export DISPLAY=:99
RESOLUTION="${RESOLUTION:-1280x800}"
: "${VNC_PASSWORD:?VNC_PASSWORD is required}"
SHARE=/usr/local/share/lumo-desktop

# First start only: copy theme and app settings into the home directory. Never
# overwrites, so changes made later (and the saved browser profile) survive.
[ -d "$SHARE/skel" ] && cp -rn "$SHARE/skel/." "$HOME/"

mkdir -p "$HOME/.vnc"
printf '%s' "$VNC_PASSWORD" | vncpasswd -f > "$HOME/.vnc/passwd"
chmod 600 "$HOME/.vnc/passwd"

XVNC="$(command -v Xtigervnc || command -v Xvnc)"
"$XVNC" "$DISPLAY" -geometry "$RESOLUTION" -depth 24 -rfbport 5900 \
  -rfbauth "$HOME/.vnc/passwd" -SecurityTypes VncAuth -AlwaysShared \
  >/tmp/xvnc.log 2>&1 &

# Wait for the X server to accept connections.
for _ in $(seq 1 30); do
  xdotool getmouselocation >/dev/null 2>&1 && break
  sleep 0.5
done

# A session bus keeps GTK apps quiet and lets them talk to each other.
if command -v dbus-launch >/dev/null 2>&1; then
  eval "$(dbus-launch --sh-syntax)"
fi

xsetroot -cursor_name left_ptr -solid '#14121c' 2>/dev/null
[ -f "$SHARE/wallpaper.png" ] && feh --no-fehbg --bg-fill "$SHARE/wallpaper.png" 2>/dev/null

# Chrome refuses to start if the profile says another computer is using it, which is what a
# restored sandbox looks like. Nothing is running yet, so the old locks are stale.
rm -f "$HOME/chrome-profile/SingletonLock" "$HOME/chrome-profile/SingletonSocket" "$HOME/chrome-profile/SingletonCookie"

openbox >/tmp/openbox.log 2>&1 &
sleep 1
tint2 >/tmp/tint2.log 2>&1 &
websockify --web /usr/share/novnc 6080 localhost:5900 >/tmp/websockify.log 2>&1 &
lumo-chrome about:blank >/tmp/chrome.log 2>&1 &

wait

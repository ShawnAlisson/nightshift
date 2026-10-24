#!/bin/bash
# Runs once, as root, while the snapshot is built. Installs the desktop files
# uploaded to /tmp/desktop and generates the pieces that depend on the system.
set -euo pipefail

SRC=/tmp/desktop
SHARE=/usr/local/share/lumo-desktop
RC=/etc/xdg/openbox/rc.xml

install -d "$SHARE"
cp -r "$SRC/skel" "$SHARE/"
install -m 755 "$SRC/start-desktop.sh" /usr/local/bin/start-desktop.sh
install -m 755 "$SRC/lumo-chrome" /usr/local/bin/lumo-chrome
install -m 644 "$SRC/lumo-chrome.desktop" /usr/share/applications/lumo-chrome.desktop

python3 "$SRC/make-wallpaper.py" "$SHARE/wallpaper.png" 1280 800

# Openbox config: start from the system default, then switch the theme, use a
# readable font and add a few shortcuts. Fails loudly if the default changes shape.
OB="$SHARE/skel/.config/openbox"
install -d "$OB"
cp "$RC" "$OB/rc.xml"
perl -0pi -e 's|(<theme>\s*<name>)[^<]*(</name>)|${1}Lumo${2}|' "$OB/rc.xml"
perl -0pi -e 's{(<font place="(?:Active|Inactive)Window">\s*<name>)[^<]*(</name>\s*<size>)[^<]*(</size>)}{${1}Inter${2}10${3}}g' "$OB/rc.xml"
perl -0pi -e 's|</keyboard>|  <keybind key="W-t"><action name="Execute"><command>lxterminal</command></action></keybind>\n  <keybind key="W-e"><action name="Execute"><command>pcmanfm</command></action></keybind>\n  <keybind key="W-b"><action name="Execute"><command>lumo-chrome</command></action></keybind>\n</keyboard>|' "$OB/rc.xml"
grep -q '<name>Lumo</name>' "$OB/rc.xml" || { echo "Could not set the Openbox theme" >&2; exit 1; }
grep -q 'W-t' "$OB/rc.xml" || { echo "Could not add the Openbox shortcuts" >&2; exit 1; }
xmllint --noout "$OB/rc.xml" 2>/dev/null || true

# Make the new fonts, icons and desktop entries visible to apps.
fc-cache -f >/dev/null 2>&1 || true
update-desktop-database /usr/share/applications >/dev/null 2>&1 || true
gtk-update-icon-cache -f /usr/share/icons/Papirus-Dark >/dev/null 2>&1 || true
echo "desktop installed"

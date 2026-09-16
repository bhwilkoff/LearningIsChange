#!/usr/bin/env python3
"""Regenerate the static QR codes and vCard for /meet/.

Usage:  pip install segno   (once)
        python3 scripts/make-meet-qr.py

Edit CONTACT below when details change (e.g. adding a phone number),
then re-run. Outputs:
  meet/ben-wilkoff.vcf   full vCard 3.0 (linked from the page); embeds
                         meet/ben-vcard.jpg as PHOTO when that file exists
  meet/qr-page.svg       QR -> https://learningischange.com/meet/
  meet/qr-vcard.svg      QR carrying a minimal vCard (scan = save contact)

The QR vCard is kept deliberately short (fewer fields = sparser code =
scans reliably from a phone screen at arm's length). The .vcf file is
the richer one.
"""
import base64
import sys
from pathlib import Path

try:
    import segno
except ImportError:
    sys.exit("segno is not installed: pip install segno")

ROOT = Path(__file__).resolve().parent.parent / "meet"
PAGE_URL = "https://learningischange.com/meet/"

CONTACT = {
    "first": "Ben",
    "last": "Wilkoff",
    "title": "Educator, Builder, Writer",
    "org": "Learning is Change",
    "email": "ben@learningischange.com",
    "phone": "+1 303 478 9812",   # leave empty to omit
    "url": PAGE_URL,
    "linkedin": "https://www.linkedin.com/in/bhwilkoff/",
    "github": "https://github.com/bhwilkoff",
    "bluesky": "https://bsky.app/profile/laserdiscleftist.bsky.social",
    "note": ("Apps: Archive Watch, Tidbits Trivia, Bsky Dreams, Boba Playbook "
             "- learningischange.com/portfolio/apps/ | "
             "Universal App Template - github.com/bhwilkoff/UniversalAppTemplate"),
}


def vcard(c, minimal=False):
    lines = [
        "BEGIN:VCARD",
        "VERSION:3.0",
        f"N:{c['last']};{c['first']};;;",
        f"FN:{c['first']} {c['last']}",
        f"TITLE:{c['title']}",
        f"EMAIL;TYPE=INTERNET,PREF:{c['email']}",
    ]
    if c["phone"]:
        lines.append(f"TEL;TYPE=CELL,VOICE:{c['phone']}")
    lines.append(f"URL:{c['url']}")
    if not minimal:
        lines += [
            f"ORG:{c['org']}",
            f"X-SOCIALPROFILE;TYPE=linkedin:{c['linkedin']}",
            f"X-SOCIALPROFILE;TYPE=github:{c['github']}",
            f"X-SOCIALPROFILE;TYPE=bluesky:{c['bluesky']}",
            f"URL;TYPE=LinkedIn:{c['linkedin']}",
            f"NOTE:{c['note']}",
        ]
        photo = ROOT / "ben-vcard.jpg"
        if photo.exists():
            b64 = base64.b64encode(photo.read_bytes()).decode("ascii")
            # RFC 2426 folding: continuation lines start with a single space.
            first, rest = "PHOTO;ENCODING=b;TYPE=JPEG:" + b64[:48], b64[48:]
            lines.append(first)
            lines += [" " + rest[i:i + 74] for i in range(0, len(rest), 74)]
    lines.append("END:VCARD")
    return "\r\n".join(lines) + "\r\n"


def save_svg(qr, path):
    qr.save(str(path), kind="svg", scale=8, border=2,
            dark="#1a1a2e", light=None, svgclass=None, lineclass=None,
            xmldecl=False, omitsize=True)


full = vcard(CONTACT)
(ROOT / "ben-wilkoff.vcf").write_text(full, encoding="utf-8", newline="")

save_svg(segno.make(PAGE_URL, error="m"), ROOT / "qr-page.svg")
mini = vcard(CONTACT, minimal=True)
save_svg(segno.make(mini, error="l"), ROOT / "qr-vcard.svg")

print(f"wrote {ROOT/'ben-wilkoff.vcf'} ({len(full)} bytes)")
print(f"wrote qr-page.svg  (version {segno.make(PAGE_URL, error='m').version})")
print(f"wrote qr-vcard.svg (version {segno.make(mini, error='l').version}, payload {len(mini)} chars)")

#!/usr/bin/env python3
"""Generate animated demo clips for the CreateIt seed data."""
import subprocess, math, os
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()
FONT_B = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_R = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
OUT = "/home/user/uploads"
os.makedirs(OUT, exist_ok=True)

W, H, FPS, DUR = 540, 960, 24, 4

def palette(colors):
    """Return function t(0..1)->rgb array interpolating through colors."""
    cols = np.array(colors, dtype=np.float32)
    n = len(cols) - 1
    def f(t):
        t = np.clip(t, 0, 1)
        idx = np.clip((t * n).astype(int), 0, n - 1)
        frac = (t * n - idx)[..., None]
        return cols[idx] * (1 - frac) + cols[idx + 1] * frac
    return f

def render(name, colors, title, subtitle, badge, style="radial", spin=1.0):
    pal = palette(colors)
    ys, xs = np.mgrid[0:H, 0:W].astype(np.float32)
    xn = (xs / W - 0.5) * (W / H)
    yn = ys / H - 0.5
    font_title = ImageFont.truetype(FONT_B, 58)
    font_sub = ImageFont.truetype(FONT_B, 26)
    font_badge = ImageFont.truetype(FONT_B, 30)

    cmd = [FF, "-hide_banner", "-loglevel", "error", "-y",
           "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
           "-c:v", "libx264", "-preset", "veryfast", "-crf", "28",
           "-pix_fmt", "yuv420p", "-movflags", "+faststart", os.path.join(OUT, name)]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)

    frames = FPS * DUR
    for i in range(frames):
        ph = i / frames * 2 * math.pi * spin
        if style == "radial":
            cx, cy = 0.18 * math.cos(ph), 0.18 * math.sin(ph * 1.3)
            d = np.sqrt((xn - cx) ** 2 + (yn - cy) ** 2)
            t = d * 1.35 + 0.10 * math.sin(ph * 2)
        elif style == "spiral":
            ang = np.arctan2(yn, xn)
            d = np.sqrt(xn ** 2 + yn ** 2)
            t = (ang / (2 * math.pi) + d * 0.9 + i / frames * spin) % 1.0
        elif style == "wave":
            t = (yn + 0.5) * 0.8 + 0.16 * np.sin(xn * 6 + ph * 2) + 0.08 * math.sin(ph)
        else:  # diagonal
            t = (xn * math.cos(ph * 0.5) + yn * math.sin(ph * 0.5)) * 0.7 + 0.5
        t = t - np.floor(t) if style == "spiral" else np.clip(t, 0, 1)
        img = pal(t).astype(np.uint8)

        frame = Image.fromarray(img)
        dr = ImageDraw.Draw(frame, "RGBA")

        # floating orbs for life
        for k, (sp, r, alpha) in enumerate([(1.0, 90, 46), (1.6, 46, 60), (-1.2, 28, 70)]):
            ox = W * (0.5 + 0.36 * math.cos(ph * sp + k * 2.1))
            oy = H * (0.5 + 0.34 * math.sin(ph * sp * 0.8 + k))
            dr.ellipse([ox - r, oy - r, ox + r, oy + r], fill=(255, 255, 255, alpha))

        # vignette
        for band, a in [(0, 120), (1, 90), (2, 60), (3, 34)]:
            dr.rectangle([0, band * 26, W, band * 26 + 26], fill=(5, 8, 14, a))
            dr.rectangle([0, H - (band + 1) * 26, W, H - band * 26], fill=(5, 8, 14, a))

        # badge pill top-center
        if badge:
            bw = dr.textlength(badge, font=font_badge)
            x0, y0 = (W - bw) / 2 - 26, 96
            dr.rounded_rectangle([x0, y0, x0 + bw + 52, y0 + 56], radius=28, fill=(8, 10, 16, 190), outline=(255, 255, 255, 120), width=2)
            dr.text(((W - bw) / 2, y0 + 11), badge, font=font_badge, fill=(255, 196, 60, 255))

        # title lines (with shadow)
        lines = title.split("\n")
        ly = H * 0.40
        for ln in lines:
            tw = dr.textlength(ln, font=font_title)
            dr.text(((W - tw) / 2 + 3, ly + 3), ln, font=font_title, fill=(0, 0, 0, 160))
            dr.text(((W - tw) / 2, ly), ln, font=font_title, fill=(255, 255, 255, 255))
            ly += 68

        # subtitle bottom
        sw = dr.textlength(subtitle, font=font_sub)
        dr.text(((W - sw) / 2 + 2, H - 92 + 2), subtitle, font=font_sub, fill=(0, 0, 0, 170))
        dr.text(((W - sw) / 2, H - 92), subtitle, font=font_sub, fill=(235, 240, 250, 235))

        proc.stdin.write(np.array(frame.convert("RGB")).tobytes())
    proc.stdin.close()
    proc.wait()
    size = os.path.getsize(os.path.join(OUT, name))
    print(f"{name}: {size//1024} KB")

# ---------- Challenge #001 THE IMPOSSIBLE TRICK (@alex) — CHAMPION ----------
render("c1_original.mp4", [(255, 61, 44), (255, 140, 26), (20, 12, 40)],
       "THE IMPOSSIBLE\nTRICK", "@ALEX  ·  THE ORIGINAL BENCHMARK", "CREATE IT", "radial", 1.2)
for no, sc in [(1, 41), (5, 53), (10, 67), (20, 78), (35, 91), (49, 98), (53, 100)]:
    render(f"c1_sarah_{no}.mp4", [(34, 46, 120), (96, 60, 220), (10, 14, 34)],
           f"ATTEMPT #{no}", f"SARAH  ·  SCORE {sc}%", "RECREATE IT", "spiral", 0.9 + sc / 90)
render("c1_beat_sarah.mp4", [(255, 184, 0), (255, 77, 46), (60, 10, 60)],
       "BEAT IT", "SARAH  ·  FINAL SCORE 104%", "CHAMPION", "radial", 1.6)
render("c1_beat_david.mp4", [(255, 120, 40), (180, 30, 90), (20, 10, 40)],
       "BEAT IT", "DAVID  ·  FINAL SCORE 101%", "BEAT IT", "radial", 1.4)

# ---------- Challenge #002 MOONWALK LADDER (@zoe) — RECREATE IT, FEATURED ----------
render("c2_original.mp4", [(0, 200, 160), (30, 90, 255), (8, 12, 30)],
       "MOONWALK\nLADDER", "@ZOE  ·  THE ORIGINAL BENCHMARK", "CREATE IT", "wave", 1.3)
render("c2_david.mp4", [(16, 130, 150), (60, 220, 190), (8, 20, 40)],
       "SCORE 100%", "DAVID  ·  ATTEMPT #9", "RECREATE IT", "wave", 1.2)
render("c2_mike.mp4", [(20, 90, 160), (90, 200, 255), (6, 12, 30)],
       "SCORE 98%", "MIKE  ·  ATTEMPT #14", "RECREATE IT", "wave", 1.1)
render("c2_john.mp4", [(40, 70, 170), (150, 120, 255), (10, 10, 28)],
       "SCORE 96%", "JOHN  ·  ATTEMPT #6", "RECREATE IT", "wave", 1.0)
render("c2_zoe2.mp4", [(0, 170, 140), (0, 80, 200), (10, 16, 34)],
       "SCORE 100%", "ZOE  ·  ATTEMPT #3", "RECREATE IT", "wave", 1.25)

# ---------- Challenge #003 BLINDFOLDED RUBIK 60s (@efe) — BEAT IT ----------
render("c3_original.mp4", [(124, 92, 255), (255, 60, 120), (16, 8, 36)],
       "BLINDFOLDED\nRUBIK · 60s", "@EFE  ·  THE ORIGINAL BENCHMARK", "CREATE IT", "diagonal", 1.1)
render("c3_beat_david.mp4", [(255, 90, 60), (255, 170, 0), (40, 8, 40)],
       "BEAT IT", "DAVID  ·  FINAL SCORE 102%", "BEAT IT", "diagonal", 1.5)
render("c3_beat_nina.mp4", [(200, 60, 200), (255, 120, 60), (30, 6, 30)],
       "BEAT IT", "NINA  ·  FINAL SCORE 99%", "BEAT IT", "diagonal", 1.3)

# ---------- Pending submissions + Discover ----------
render("pend_nina.mp4", [(255, 120, 30), (220, 40, 40), (30, 8, 8)],
       "FIRE JOLLOF\nIN 30 SECONDS", "NINA  ·  SELF-NOMINATED", "SUBMIT FOR CREATE IT", "radial", 1.0)
render("pend_tobi.mp4", [(60, 200, 90), (0, 120, 130), (8, 20, 16)],
       "BOTTLE FLIP\nLADDER EDITION", "TOBI  ·  SUBMISSION", "SUBMIT FOR CREATE IT", "spiral", 0.8)
render("disc_kofi.mp4", [(250, 200, 60), (230, 90, 30), (30, 14, 6)],
       "DRUMSTICK\nISOLATION", "KOFI  ·  DISCOVERED", "FUTURE CHALLENGE?", "diagonal", 0.9)

print("done")

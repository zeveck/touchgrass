"""Composite two gameplay mock frames for Touch Grass from the real generated assets."""
import math
import random
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageChops

ROOT = "/workspaces/touchgrass"
A = ROOT + "/game/assets"
OUT = ROOT + "/design/mockups"
FONTS = "/tmp/claude-1000/-workspaces-touchgrass/fc5377c9-8628-4db9-ac80-87241e9352e7/scratchpad/fonts"

SS = 2  # supersample
W, H = 1280, 800

PAL = dict(
    meadow=(0x5F, 0x9E, 0x45), deep=(0x2F, 0x6B, 0x34), gold=(0xE7, 0xB8, 0x4A),
    butter=(0xF4, 0xD3, 0x5E), soil=(0x7A, 0x5A, 0x3A), cream=(0xFB, 0xF3, 0xDF),
    rose=(0xD9, 0x8C, 0x7A), ink=(0x2B, 0x2A, 0x26),
)


def font(name, size, axes):
    f = ImageFont.truetype(f"{FONTS}/{name}.ttf", size)
    f.set_variation_by_axes(axes)
    return f


def cover(path, w, h):
    im = Image.open(path).convert("RGB")
    s = max(w / im.width, h / im.height)
    im = im.resize((math.ceil(im.width * s), math.ceil(im.height * s)), Image.LANCZOS)
    l, t = (im.width - w) // 2, (im.height - h) // 2
    return im.crop((l, t, l + w, t + h)).convert("RGBA")


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def gold_map(tuft, warm=0.0):
    """Gradient-map a tuft onto a gold ramp (keeps the ink outline dark)."""
    stops = [(0, PAL["ink"]), (60, (0x7E, 0x50, 0x1A)), (130, (0xD9, 0x9A, 0x2E)), (185, PAL["gold"]), (230, PAL["butter"]), (255, (0xFA, 0xE6, 0x9A))]
    if warm:
        stops = [(p, lerp(c, (0xF0, 0xA8, 0x50), warm * 0.25) if p > 60 else c) for p, c in stops]
    lut = []
    for ch in range(3):
        for v in range(256):
            for (p0, c0), (p1, c1) in zip(stops, stops[1:]):
                if p0 <= v <= p1:
                    t = (v - p0) / (p1 - p0)
                    lut.append(round(c0[ch] + (c1[ch] - c0[ch]) * t))
                    break
    r, g, b, a = tuft.split()
    lum = Image.merge("RGB", (r, g, b)).convert("L")
    # stretch tuft luminance so the body sits in the gold range
    lum = lum.point(lambda v: min(255, int(v * 1.2)))
    mapped = Image.merge("RGB", (lum, lum, lum)).point(lut)
    mapped.putalpha(a)
    return mapped


def tint(tuft, gold_version, t):
    if t <= 0:
        return tuft
    return Image.blend(tuft, gold_version, t)


def grade(img, mult, add=(0, 0, 0)):
    """Simple per-channel grade on RGBA (value / warmth only)."""
    r, g, b, a = img.split()
    r = r.point(lambda v: max(0, min(255, int(v * mult[0] + add[0]))))
    g = g.point(lambda v: max(0, min(255, int(v * mult[1] + add[1]))))
    b = b.point(lambda v: max(0, min(255, int(v * mult[2] + add[2]))))
    return Image.merge("RGBA", (r, g, b, a))


def point_in_poly(x, y, poly):
    inside = False
    n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % n]
        if (y1 > y) != (y2 > y):
            xc = x1 + (y - y1) * (x2 - x1) / (y2 - y1)
            if xc > x:
                inside = not inside
    return inside


def offset_rect_poly(pts, d):
    """Mitre offset outward for a clockwise (screen coords) rectilinear polygon."""
    n = len(pts)
    out = []
    for i in range(n):
        p0, p1, p2 = pts[i - 1], pts[i], pts[(i + 1) % n]
        def normal(a, b):
            dx, dy = b[0] - a[0], b[1] - a[1]
            L = math.hypot(dx, dy)
            return (dy / L, -dx / L)  # outward for clockwise in screen coords
        n1, n2 = normal(p0, p1), normal(p1, p2)
        out.append((p1[0] + (n1[0] + n2[0]) * d, p1[1] + (n1[1] + n2[1]) * d))
    return out


def soil_layer(size, poly_px, lip=6, rng=None):
    """Soil clipped to the polygon, a 6 px lip, a 2 px ink edge, and a soft drop shadow."""
    w, h = size
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    lip_poly = offset_rect_poly(poly_px, lip * SS)
    # soft drop shadow
    sh = Image.new("L", size, 0)
    ImageDraw.Draw(sh).polygon([(x + 4 * SS, y + 8 * SS) for x, y in lip_poly], fill=110)
    sh = sh.filter(ImageFilter.GaussianBlur(10 * SS))
    layer.paste((40, 30, 20, 255), (0, 0), sh)
    # lip (slightly lighter, sun-caught rim)
    d = ImageDraw.Draw(layer)
    d.polygon(lip_poly, fill=(0x95, 0x72, 0x4C, 255))
    # soil body with mottled texture
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).polygon(poly_px, fill=255)
    tex = Image.new("RGB", (w // 8, h // 8), PAL["soil"])
    px = tex.load()
    for y in range(tex.height):
        for x in range(tex.width):
            v = rng.uniform(-14, 14)
            c = PAL["soil"]
            px[x, y] = (int(c[0] + v), int(c[1] + v * 0.85), int(c[2] + v * 0.7))
    tex = tex.resize(size, Image.BICUBIC).filter(ImageFilter.GaussianBlur(3 * SS))
    # inner shade near the edge so the lip reads as a rim
    inner = mask.filter(ImageFilter.GaussianBlur(5 * SS))
    shade = ImageChops.subtract(mask, inner)
    tex = Image.composite(Image.new("RGB", size, (0x5C, 0x42, 0x2A)), tex, shade.point(lambda v: min(255, v * 2)))
    layer.paste(tex, (0, 0), mask)
    # ink edge, 2 px, along the outer edge of the lip
    d = ImageDraw.Draw(layer)
    d.line(lip_poly + [lip_poly[0]], fill=PAL["ink"] + (255,), width=2 * SS, joint="curve")
    return layer


def bug_with_shadow(canvas, sprite_path, cx, cy, size_px, angle_deg, shadow_w=None):
    spr = Image.open(sprite_path).convert("RGBA")
    a = spr.getchannel("A")
    spr = spr.crop(a.getbbox())
    s = size_px * SS / max(spr.size)
    spr = spr.resize((round(spr.width * s), round(spr.height * s)), Image.LANCZOS)
    # code shadow: soft ellipse, never rotated, slightly offset down
    sw = (shadow_w or size_px * 0.9) * SS
    shh = sw * 0.55
    sh = Image.new("L", canvas.size, 0)
    ox, oy = cx + 3 * SS, cy + 7 * SS
    ImageDraw.Draw(sh).ellipse((ox - sw / 2, oy - shh / 2, ox + sw / 2, oy + shh / 2), fill=150)
    sh = sh.filter(ImageFilter.GaussianBlur(3 * SS))
    canvas.paste((30, 25, 15, 255), (0, 0), sh) if False else None
    shadow = Image.new("RGBA", canvas.size, (30, 24, 14, 0))
    shadow.putalpha(sh)
    canvas.alpha_composite(shadow)
    rot = spr.rotate(-angle_deg, resample=Image.BICUBIC, expand=True)
    canvas.alpha_composite(rot, (round(cx - rot.width / 2), round(cy - rot.height / 2)))


def draw_field(canvas, poly, cols, rows, cell, ox, oy, tufts, swept, rng, tuft_grade, gold_warm=0.0, stiff_frac=0.08):
    """tufts: dict name->RGBA 256 tuft. swept: dict (r,c)->goldness/flat info."""
    S = round(1.5 * cell * SS)
    base_x, base_y = S * 128 / 256, S * 236 / 256
    cache = {}

    def get(name, flip, t, flat, bend):
        key = (name, flip, round(t, 2), flat, round(bend, 2))
        if key in cache:
            return cache[key]
        im = tufts[name].resize((S, S), Image.LANCZOS)
        im = tuft_grade(im)
        if t > 0:
            im = tint(im, gold_map(tufts[name].resize((S, S), Image.LANCZOS), gold_warm), t)
        if flip:
            im = im.transpose(Image.FLIP_LEFT_RIGHT)
        if flat:
            # flattened: squash to ~35% height about the base, sheared along the stroke
            FW = round(S * 1.35)
            nh = max(2, round(FW * 0.35))
            im = im.resize((FW, nh), Image.LANCZOS)
            pad = Image.new("RGBA", (S * 2, S), (0, 0, 0, 0))
            pad.alpha_composite(im, (S - FW // 2, round(base_y - nh * 236 / 256)))
            im = pad.transform(pad.size, Image.AFFINE, (1, -bend, bend * base_y, 0, 1, 0), resample=Image.BICUBIC)
        cache[key] = im
        return im

    for r in range(rows):
        for c in range(cols):
            if not point_in_poly(c + 0.5, r + 0.5, poly):
                continue
            name = "stiff" if rng.random() < stiff_frac else "default"
            flip = rng.random() < 0.5
            jx, jy = rng.uniform(-0.2, 0.2) * cell, rng.uniform(-0.12, 0.12) * cell
            info = swept.get((r, c))
            bx = (ox + (c + 0.5) * cell + jx) * SS
            by = (oy + (r + 0.92) * cell + jy) * SS
            if info and info[1]:
                t, _, bend = info
                im = get(name, flip, t, True, bend)
                canvas.alpha_composite(im, (round(bx - S), round(by - 0.18 * cell * SS - base_y)))
            else:
                t = info[0] if info else 0.0
                im = get(name, flip, t, False, 0)
                canvas.alpha_composite(im, (round(bx - base_x), round(by - base_y)))


def trail(cells_poly, cols, rows, segs, radius, fringe):
    """Cells within radius of the polyline are flattened (gold 1.0); a fringe band is standing, partly gold."""
    out = {}
    for r in range(rows):
        for c in range(cols):
            if not point_in_poly(c + 0.5, r + 0.5, cells_poly):
                continue
            px, py = c + 0.5, r + 0.5
            best, bdir = 1e9, (1, 0)
            for (x1, y1), (x2, y2) in segs:
                dx, dy = x2 - x1, y2 - y1
                L2 = dx * dx + dy * dy
                t = max(0, min(1, ((px - x1) * dx + (py - y1) * dy) / L2))
                d = math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
                if d < best:
                    L = math.sqrt(L2)
                    best, bdir = d, (dx / L, dy / L)
            if best <= radius:
                out[(r, c)] = (1.0 if best < radius * 0.6 else 0.8, True, bdir[0] * 0.45)
            elif best <= radius + fringe:
                out[(r, c)] = (0.4, False, 0)
    return out


def rounded(d, box, r, **kw):
    d.rounded_rectangle([v * SS for v in box], radius=r * SS, **kw)


def hud(canvas, name, frac, thresh, warm=False):
    d = ImageDraw.Draw(canvas)
    # soft panel strip
    strip = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(strip)
    rounded(sd, (16, 12, W - 16, 68), 18, fill=PAL["cream"] + (225,), outline=PAL["ink"] + (255,), width=2 * SS)
    sh = Image.new("L", canvas.size, 0)
    ImageDraw.Draw(sh).rounded_rectangle([v * SS for v in (18, 17, W - 14, 73)], radius=18 * SS, fill=70)
    sh = sh.filter(ImageFilter.GaussianBlur(4 * SS))
    shadow = Image.new("RGBA", canvas.size, (40, 30, 20, 0))
    shadow.putalpha(sh)
    canvas.alpha_composite(shadow)
    canvas.alpha_composite(strip)
    d = ImageDraw.Draw(canvas)
    title = font("Fraunces", 30 * SS, [72, 650, 100, 0])
    small = font("Nunito", 15 * SS, [800])
    tiny = font("Nunito", 13 * SS, [700])
    d.text((40 * SS, 40 * SS), name, font=title, fill=PAL["ink"], anchor="lm")
    # energy meter
    mx0, mx1, my = 560, 1110, 40
    bh = 18
    rounded(d, (mx0, my - bh / 2, mx1, my + bh / 2), bh / 2, fill=(0xE9, 0xDF, 0xC4), outline=PAL["ink"], width=2 * SS)
    fill_x = mx0 + (mx1 - mx0) * frac
    fill = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    fd = ImageDraw.Draw(fill)
    for i in range(int((fill_x - mx0) * SS)):
        t = i / ((mx1 - mx0) * SS)
        col = lerp(PAL["butter"], PAL["gold"], min(1, t * 1.4))
        fd.line([(mx0 * SS + i, (my - bh / 2 + 3) * SS), (mx0 * SS + i, (my + bh / 2 - 3) * SS)], fill=col + (255,))
    m = Image.new("L", canvas.size, 0)
    ImageDraw.Draw(m).rounded_rectangle([(mx0 + 3) * SS, (my - bh / 2 + 3) * SS, (fill_x) * SS, (my + bh / 2 - 3) * SS], radius=(bh / 2 - 3) * SS, fill=255)
    fill.putalpha(ImageChops.multiply(fill.getchannel("A"), m))
    canvas.alpha_composite(fill)
    # highlight on fill
    d = ImageDraw.Draw(canvas)
    d.line([((mx0 + 10) * SS, (my - 4) * SS), ((fill_x - 6) * SS, (my - 4) * SS)], fill=(255, 250, 225, 255), width=2 * SS)
    # threshold line
    tx = mx0 + (mx1 - mx0) * thresh
    d.line([(tx * SS, (my - bh / 2 - 6) * SS), (tx * SS, (my + bh / 2 + 6) * SS)], fill=PAL["ink"], width=3 * SS)
    d.polygon([((tx - 6) * SS, (my - bh / 2 - 10) * SS), ((tx + 6) * SS, (my - bh / 2 - 10) * SS), (tx * SS, (my - bh / 2 - 3) * SS)], fill=PAL["ink"])
    d.text(((mx0 - 14) * SS, my * SS), f"{round(frac / thresh * 100)}%", font=small, fill=PAL["ink"], anchor="rm")
    # pause button
    cx, cy = 1160, 40
    d.ellipse([(cx - 17) * SS, (cy - 17) * SS, (cx + 17) * SS, (cy + 17) * SS], fill=PAL["cream"], outline=PAL["ink"], width=2 * SS)
    for dx in (-5, 5):
        d.rounded_rectangle([(cx + dx - 2.5) * SS, (cy - 8) * SS, (cx + dx + 2.5) * SS, (cy + 8) * SS], radius=2 * SS, fill=PAL["ink"])
    # move toolbar hint (bottom) - three round slots, small and quiet
    return d


def warning_ring(canvas, cx, cy, diam):
    ring = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    rd = ImageDraw.Draw(ring)
    r = diam / 2 * SS
    rd.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(0xE0, 0x3A, 0x2E, 60), outline=(0xD8, 0x2A, 0x20, 200), width=3 * SS)
    glow = ring.filter(ImageFilter.GaussianBlur(4 * SS))
    canvas.alpha_composite(glow)
    canvas.alpha_composite(ring)


def make(scene, out, poly, cols, rows, name, swept_segs, trail_r, bugs, frac, thresh, grade_fn, warm, seed, stiff_frac):
    rng = random.Random(seed)
    canvas = cover(scene, W * SS, H * SS)
    hud_h = 80
    avail_h = H - hud_h - 70
    cell = min(avail_h / rows, (W - 120) / cols)
    cell = math.floor(cell)
    fw, fh = cols * cell, rows * cell
    ox = (W - fw) / 2
    oy = hud_h + (H - hud_h - fh) / 2 + 12
    poly_px = [((ox + x * cell) * SS, (oy + y * cell) * SS) for x, y in poly]
    canvas.alpha_composite(soil_layer(canvas.size, poly_px, rng=rng))
    tufts = {n: Image.open(f"{A}/tufts/{n}.png").convert("RGBA") for n in ("default", "stiff")}
    swept = {}
    for segs in swept_segs:
        for k, v in trail(poly, cols, rows, segs, trail_r, 0.9).items():
            if k not in swept or (v[1] and not swept[k][1]) or v[0] > swept[k][0]:
                swept[k] = v
    draw_field(canvas, poly, cols, rows, cell, ox, oy, tufts, swept, rng, grade_fn, warm, stiff_frac)
    for b in bugs:
        bx, by = (ox + b["c"] * cell) * SS, (oy + b["r"] * cell) * SS
        if b.get("ring"):
            warning_ring(canvas, bx, by, b["ring"])
        bug_with_shadow(canvas, b["sprite"], bx, by, b["size"], b["angle"])
    hud(canvas, name, frac, thresh)
    final = canvas.resize((W, H), Image.LANCZOS).convert("RGB")
    final.save(out)
    print(out, "cell", cell, "origin", (ox, oy))


# Morning: grass graded cool and fresh (value + slight cool highlight only)
morning_grade = lambda im: grade(im, (0.97, 1.0, 1.03))
golden_grade = lambda im: grade(im, (1.04, 1.0, 0.9), (6, 2, -4))

L6 = [(0, 0), (21, 0), (21, 12), (12, 12), (12, 21), (0, 21)]
make(
    scene=f"{A}/scenes/morning-16x9.jpg", out=f"{OUT}/frame-morning.png",
    poly=L6, cols=21, rows=21, name="The Garden Corner",
    swept_segs=[[((1.5, 3.0), (8.0, 9.5)), ((8.0, 9.5), (19.0, 6.5))], [((4.0, 19.5), (7.5, 14.0))]],
    trail_r=1.05,
    bugs=[dict(sprite=f"{A}/sprites/ladybug.png", r=15.6, c=3.6, size=36, angle=35)],
    frac=0.46, thresh=0.72, grade_fn=morning_grade, warm=0.0, seed=6, stiff_frac=0.07,
)

SQ = [(0, 0), (29, 0), (29, 29), (0, 29)]
make(
    scene=f"{A}/scenes/golden-16x9.jpg", out=f"{OUT}/frame-golden.png",
    poly=SQ, cols=29, rows=29, name="Orchard Grass",
    swept_segs=[
        [((2.0, 4.0), (11.0, 7.0)), ((11.0, 7.0), (14.0, 15.0))],
        [((20.0, 22.0), (26.5, 26.0))],
        [((5.0, 24.0), (9.0, 20.0)), ((9.0, 20.0), (12.0, 25.5))],
        [((20.5, 3.5), (25.0, 9.0))],
    ],
    trail_r=1.15,
    bugs=[dict(sprite=f"{A}/sprites/bee-full.png", r=14.5, c=19.5, size=40, angle=-20, ring=56)],
    frac=0.64, thresh=0.78, grade_fn=golden_grade, warm=1.0, seed=10, stiff_frac=0.10,
)

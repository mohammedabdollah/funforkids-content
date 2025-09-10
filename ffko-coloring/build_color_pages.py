# -*- coding: utf-8 -*-
import os, sys, html, datetime

ROOT = os.path.dirname(os.path.abspath(__file__))
IMAGES_DIR = os.path.join(ROOT, "images")
OUT_HTML = os.path.join(ROOT, "index.html")
OUT_SITEMAP = os.path.join(ROOT, "sitemap.xml")
OUT_ROBOTS = os.path.join(ROOT, "robots.txt")

SITE_TITLE = "Coloring Pages — Fun For Kids Online | صفحات تلوين للأطفال"
SITE_DESC  = "أكبر مكتبة رسومات تلوين قابلة للطباعة والتنزيل للأطفال — فئات متنوعة وسهلة التصفح."
SITE_URL   = "https://USERNAME.github.io/ffko-coloring/"  # عدّل هذا لاحقًا بعد نشر GitHub Pages

VALID_EXT = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".svg"}

def list_images():
    """
    Scan images/* and return dict: {category_slug: [(rel_path, alt_text), ...], ...}
    Alt text is generated from filename.
    """
    data = {}
    if not os.path.isdir(IMAGES_DIR):
        return data

    for cat in sorted(os.listdir(IMAGES_DIR)):
        cat_dir = os.path.join(IMAGES_DIR, cat)
        if not os.path.isdir(cat_dir): 
            continue
        items = []
        for fn in sorted(os.listdir(cat_dir)):
            ext = os.path.splitext(fn)[1].lower()
            if ext not in VALID_EXT:
                continue
            rel = os.path.join("images", cat, fn).replace("\\", "/")
            # ALT from filename
            base = os.path.splitext(fn)[0]
            base_clean = base.replace("_"," ").replace("-"," ").strip()
            if not base_clean:
                base_clean = "Coloring page"
            alt = f"{base_clean} — Coloring page | صفحة تلوين"
            items.append((rel, alt))
        if items:
            data[cat] = items
    return data

def slug_to_title(slug):
    # Make a neat title from folder name
    t = slug.replace("-", " ").replace("_", " ").strip().title()
    # Arabic additions for known folders
    ar_map = {
        "Sea Life": "كائنات بحرية", "Mandala Kids":"ماندالا للأطفال",
        "Letters Ar":"حروف عربية", "Letters En":"حروف إنجليزية",
        "Islamic":"إسلامي"
    }
    ar = ar_map.get(t, "")
    return f"{t}" + (f" | {ar}" if ar else "")

def build_html(pages):
    # pages: dict(cat_slug -> list[(src, alt)])
    cats = list(pages.keys())
    total = sum(len(v) for v in pages.values())

    # JSON-LD (CollectionPage + ImageGallery)
    ld_images = []
    for cat, items in pages.items():
        for rel, alt in items:
            ld_images.append({
                "@type": "ImageObject",
                "name": alt,
                "contentUrl": SITE_URL + rel
            })
    import json
    ld = {
      "@context":"https://schema.org",
      "@type":"CollectionPage",
      "name": SITE_TITLE,
      "description": SITE_DESC,
      "url": SITE_URL,
      "hasPart": [{
        "@type":"ImageGallery",
        "name":"Coloring Gallery",
        "image": ld_images[:1000]  # حد معقول
      }]
    }
    ld_json = json.dumps(ld, ensure_ascii=False)

    # CSS + JS inline لتبسيط النشر
    return f"""<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>{html.escape(SITE_TITLE)}</title>
<meta name="description" content="{html.escape(SITE_DESC)}"/>
<link rel="canonical" href="{SITE_URL}"/>
<meta property="og:type" content="website"/>
<meta property="og:title" content="{html.escape(SITE_TITLE)}"/>
<meta property="og:description" content="{html.escape(SITE_DESC)}"/>
<meta property="og:url" content="{SITE_URL}"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="{html.escape(SITE_TITLE)}"/>
<meta name="twitter:description" content="{html.escape(SITE_DESC)}"/>
<script type="application/ld+json">{ld_json}</script>
<style>
:root{{--bg:#f7f8fb;--ink:#0f1220;--muted:#5b6075;--card:#fff;--ring:#e7ecf7;--brand:#5a8dee;--brand2:#7dd3fc;--radius:22px}}
*{{box-sizing:border-box}}
body{{margin:0;background:var(--bg);color:var(--ink);font-family:system-ui,-apple-system,"Segoe UI",Tajawal,Arial,sans-serif}}
header{{position:sticky;top:0;z-index:10;background:linear-gradient(135deg,var(--brand),var(--brand2));color:#fff;padding:16px 12px;box-shadow:0 8px 24px #0002}}
.container{{max-width:1200px;margin:0 auto;padding:14px}}
h1{{margin:0;font-size:clamp(20px,3.2vw,32px);font-weight:800}}
.sub{{opacity:.9;font-size:14px;margin-top:6px}}
.toolbar{{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px;align-items:center}}
.input,select{{padding:10px 12px;border-radius:12px;border:1px solid var(--ring);background:#fff;box-shadow:0 6px 16px #0001}}
.btn{{padding:10px 14px;border-radius:12px;border:1px solid #ffffff33;background:#fff;font-weight:700;cursor:pointer;box-shadow:0 8px 20px #0001}}
.grid{{display:grid;gap:14px;margin:16px auto;grid-template-columns:repeat(auto-fill,minmax(160px,1fr))}}
.card{{background:var(--card);border-radius:18px;overflow:hidden;border:1px solid var(--ring);box-shadow:0 10px 24px #0001}}
.thumb{{aspect-ratio:1/1;width:100%;object-fit:cover;display:block;background:#eef2ff}}
.meta{{padding:8px 10px;font-size:12px;color:var(--muted);display:flex;justify-content:space-between;align-items:center}}
.badge{{padding:4px 8px;background:#f0f6ff;border:1px solid var(--ring);border-radius:999px}}
.overlay{{position:fixed;inset:0;background:#0008;display:none;align-items:center;justify-content:center;padding:10px;z-index:50}}
.overlay.show{{display:flex}}
.viewer{{width:min(1000px,98vw);background:var(--card);border-radius:var(--radius);border:1px solid var(--ring);box-shadow:0 30px 60px #0005;overflow:hidden}}
.viewer-head{{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid var(--ring);background:#fbfdff}}
.viewer-actions{{display:flex;gap:8px;align-items:center}}
.viewer-body{{padding:10px;display:flex;justify-content:center;align-items:center;background:#fff}}
.viewer-body img{{max-width:100%;max-height:80vh;border-radius:12px;border:1px solid #e8e8ef}}
.nav{{position:absolute;inset:0;display:flex;align-items:center;justify-content:space-between;pointer-events:none}}
.nav button{{pointer-events:auto;width:44px;height:44px;border-radius:12px;border:0;background:#0006;color:#fff;font-size:18px;display:grid;place-items:center;margin:10px;cursor:pointer}}
.footer{{text-align:center;color:var(--muted);padding:30px 10px}}
.count{{font-weight:800}}
</style>
</head>
<body>
<header>
  <div class="container">
    <h1>صفحات تلوين للأطفال — Coloring Pages</h1>
    <div class="sub">فلترة حسب الفئة + بحث بالاسم | إجمالي الصور: <span class="count" id="totalCount">{total}</span></div>
    <div class="toolbar">
      <select id="catSelect" class="input">
        <option value="">كل الفئات | All Categories</option>
        {"".join(f'<option value="{html.escape(c)}">{html.escape(slug_to_title(c))}</option>' for c in cats)}
      </select>
      <input id="searchInput" class="input" placeholder="بحث بالاسم | Search by name..."/>
      <button id="printBtn" class="btn">🖨️ طباعة</button>
      <a href="sitemap.xml" class="btn" target="_blank" rel="nofollow">🗺️ Sitemap</a>
    </div>
  </div>
</header>

<main class="container">
  <div id="grid" class="grid"></div>
</main>

<div id="overlay" class="overlay" aria-hidden="true">
  <div class="viewer" role="dialog" aria-modal="true">
    <div class="viewer-head">
      <strong id="viewerTitle">Preview</strong>
      <div class="viewer-actions">
        <a id="downloadLink" class="btn" download>⬇️ تنزيل | Download</a>
        <button id="printOne" class="btn">🖨️ طباعة هذه</button>
        <button id="closeBtn" class="btn">✖️ إغلاق</button>
      </div>
    </div>
    <div class="viewer-body">
      <img id="viewerImg" alt="Coloring page"/>
    </div>
  </div>
</div>

<footer class="footer">© {datetime.datetime.utcnow().year} Fun For Kids Online — Coloring Pages</footer>

<script>
const DATA = {pages}; // {{cat: [{src, alt, cat}], ...}}
const grid = document.getElementById('grid');
const catSelect = document.getElementById('catSelect');
const searchInput = document.getElementById('searchInput');
const totalCount = document.getElementById('totalCount');
const overlay = document.getElementById('overlay');
const viewerImg = document.getElementById('viewerImg');
const downloadLink = document.getElementById('downloadLink');
const viewerTitle = document.getElementById('viewerTitle');
const printBtn = document.getElementById('printBtn');
const printOne = document.getElementById('printOne');
const closeBtn = document.getElementById('closeBtn');

let ALL = [];
for (const [cat, items] of Object.entries(DATA)) {{
  items.forEach(x => ALL.push({{...x, cat}}));
}}
let FILTERED = [...ALL];

function render() {{
  grid.innerHTML = "";
  const q = (searchInput.value||"").toLowerCase();
  const c = catSelect.value;
  FILTERED = ALL.filter(it => {{
    const okCat = !c || it.cat === c;
    const okTxt = !q || it.alt.toLowerCase().includes(q);
    return okCat && okTxt;
  }});
  totalCount.textContent = FILTERED.length;
  for (const it of FILTERED) {{
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <img class="thumb" loading="lazy" src="${it.src}" alt="${it.alt}">
      <div class="meta">
        <span class="badge">{'{'}` + "${it.cat}" + `{' }'}</span>
        <span title="${it.alt}">…</span>
      </div>`;
    card.querySelector('.thumb').addEventListener('click', () => openViewer(it));
    grid.appendChild(card);
  }}
}}

function openViewer(it) {{
  viewerImg.src = it.src;
  viewerImg.alt = it.alt;
  viewerTitle.textContent = it.alt;
  downloadLink.href = it.src; // لو عندك نسخة PNG للطباعة ضع رابطها هنا
  overlay.classList.add('show');
  overlay.setAttribute('aria-hidden','false');
}}
function closeViewer() {{
  overlay.classList.remove('show');
  overlay.setAttribute('aria-hidden','true');
  viewerImg.src = "";
}}
overlay.addEventListener('click', (e)=>{{ if(e.target===overlay) closeViewer(); }});
closeBtn.addEventListener('click', closeViewer);
document.addEventListener('keydown', (e)=>{{ if(e.key==='Escape') closeViewer(); }});
catSelect.addEventListener('change', render);
searchInput.addEventListener('input', render);
printBtn.addEventListener('click', ()=>window.print());
printOne.addEventListener('click', ()=>{{ const w=window.open('','_blank'); w.document.write(`<img src="${viewerImg.src}" style="max-width:100%"/>`); w.document.close(); w.print(); }});
render();

// دعم ?cat=animals
const params = new URLSearchParams(location.search);
const firstCat = params.get('cat');
if (firstCat && DATA[firstCat]) {{
  catSelect.value = firstCat;
  render();
}}
</script>
</body>
</html>
"""

def write_html(pages):
    with open(OUT_HTML, "w", encoding="utf-8") as f:
        f.write(build_html(pages))

def write_sitemap():
    now = datetime.datetime.utcnow().strftime("%Y-%m-%d")
    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>{SITE_URL}</loc><lastmod>{now}</lastmod><priority>1.0</priority></url>
</urlset>"""
    with open(OUT_SITEMAP, "w", encoding="utf-8") as f:
        f.write(xml)

def write_robots():
    txt = f"""User-agent: *
Allow: /
Sitemap: {SITE_URL}sitemap.xml
"""
    with open(OUT_ROBOTS, "w", encoding="utf-8") as f:
        f.write(txt)

def main():
    pages_raw = list_images()
    # Transform to JSON-like literal for injection
    # DATA: {cat: [{src, alt}], ...}
    parts = []
    for cat, items in pages_raw.items():
        arr = ",".join([f'{{"src":"{html.escape(src)}","alt":"{html.escape(alt)}"}}' for src,alt in items])
        parts.append(f'"{cat}":[{arr}]')
    pages_literal = "{" + ",".join(parts) + "}"
    write_html(pages_literal)
    write_sitemap()
    write_robots()
    print(f"✅ Done. Categories: {len(pages_raw)} | Images: {sum(len(v) for v in pages_raw.values())}")
    print("Open index.html")

if __name__ == "__main__":
    main()


"""
LinkedIn Platform — System Architecture Diagram  v2
Clean layout: CLIENT | PROXY | SERVICES (2 cols) | KAFKA | DATABASES
"""

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch
import matplotlib.patheffects as pe
import numpy as np

FIG_W, FIG_H = 26, 16
fig, ax = plt.subplots(figsize=(FIG_W, FIG_H))
ax.set_xlim(0, FIG_W)
ax.set_ylim(0, FIG_H)
ax.axis('off')
fig.patch.set_facecolor('#060E1C')
ax.set_facecolor('#060E1C')

# ── Palette ──────────────────────────────────────────────────────────────────
BG       = '#060E1C'
ZONE_BG  = '#0A1628'
BLUE     = '#0A66C2'
BLUE_D   = '#084A8E'
BLUE_H   = '#1E80E0'
NAVY     = '#040E28'
SKY      = '#70B5F9'
WHITE    = '#FFFFFF'
OFF      = '#B8CCEE'
DIM      = '#607898'
GREEN    = '#057A55'
GREEN_H  = '#06A870'
ORANGE   = '#D06010'
ORANGE_H = '#F07820'
TEAL     = '#027B8E'
TEAL_H   = '#04A8C0'
PURPLE   = '#5A18A0'
PURPLE_H = '#8040D0'
KAFKA_BG = '#110628'
KAFKA_BD = '#7030C0'

# ── Core helpers ─────────────────────────────────────────────────────────────

def rbox(x, y, w, h, fc, ec=None, alpha=1.0, r=0.25, lw=1.4, z=4):
    ec = ec or fc
    p = FancyBboxPatch((x, y), w, h,
                       boxstyle=f"round,pad=0,rounding_size={r}",
                       facecolor=matplotlib.colors.to_rgba(fc, alpha),
                       edgecolor=matplotlib.colors.to_rgba(ec, 1.0),
                       linewidth=lw, zorder=z)
    ax.add_patch(p)
    return p

def txt(x, y, s, size=8, c=WHITE, bold=False, ha='center', va='center', z=6, mono=True):
    ff = 'monospace' if mono else 'sans-serif'
    ax.text(x, y, s, fontsize=size, color=c,
            fontweight='bold' if bold else 'normal',
            ha=ha, va=va, zorder=z, fontfamily=ff)

def glow(x, y, s, size=10, c=SKY, bold=True, ha='center', z=7):
    t = ax.text(x, y, s, fontsize=size, color=c,
                fontweight='bold' if bold else 'normal',
                ha=ha, va='center', zorder=z, fontfamily='sans-serif')
    t.set_path_effects([
        pe.withStroke(linewidth=4, foreground=matplotlib.colors.to_rgba(c, 0.18))
    ])

def arr(x1, y1, x2, y2, c=SKY, lw=1.3, alpha=0.75, rad=0.0, z=3, head='->', dash=None):
    ls = '--' if dash else '-'
    ax.annotate('', xy=(x2, y2), xytext=(x1, y1), zorder=z,
                arrowprops=dict(
                    arrowstyle=f'{head}, head_width=0.18, head_length=0.12',
                    color=matplotlib.colors.to_rgba(c, alpha),
                    lw=lw,
                    connectionstyle=f'arc3,rad={rad}',
                    linestyle=ls
                ))

def badge(x, y, s, fc, size=6.5, w=None, z=7):
    pw = w or (len(s) * 0.075 + 0.22)
    rbox(x - pw/2, y - 0.145, pw, 0.29, fc, ec=fc, r=0.1, lw=0.6, z=z)
    txt(x, y, s, size=size, c=WHITE, bold=True, z=z+1)

# ── Service box ──────────────────────────────────────────────────────────────
def svc(x, y, w, h, title, port, lang, fc, ec=None, port_c=SKY):
    ec = ec or fc
    # shadow
    rbox(x+0.05, y-0.05, w, h, '#000000', ec='#000000', alpha=0.35, r=0.2, lw=0, z=3)
    # body
    rbox(x, y, w, h, fc, ec=ec, alpha=0.95, r=0.2, lw=1.6, z=4)
    # header stripe
    rbox(x, y+h-0.5, w, 0.5, ec, ec=ec, alpha=1.0, r=0.2, lw=0, z=5)
    ax.add_patch(plt.Rectangle((x, y+h-0.5), w, 0.26,
                                facecolor=ec, edgecolor='none', zorder=5))
    txt(x+w/2, y+h-0.25, title, size=7.8, c=WHITE, bold=True, z=6)
    txt(x+w/2, y+h*0.52,  port,  size=9,   c=port_c, bold=True, z=6)
    txt(x+w/2, y+h*0.2,   lang,  size=6.5, c=OFF,    z=6)

# ── DB box ───────────────────────────────────────────────────────────────────
def dbbox(x, y, w, h, title, sub1, sub2, fc):
    rbox(x+0.06, y-0.06, w, h, '#000000', alpha=0.3, r=0.2, lw=0, z=3)
    rbox(x, y, w, h, fc, ec=fc, alpha=0.9, r=0.2, lw=1.8, z=4)
    rbox(x, y+h-0.52, w, 0.52, fc, ec=fc, alpha=1.0, r=0.2, lw=0, z=5)
    ax.add_patch(plt.Rectangle((x, y+h-0.52), w, 0.28,
                                facecolor=fc, edgecolor='none', zorder=5))
    txt(x+w/2, y+h-0.26, title, size=8.5, c=WHITE, bold=True, z=6)
    txt(x+w/2, y+h*0.57,  sub1,  size=7,   c=SKY,   z=6)
    txt(x+w/2, y+h*0.3,   sub2,  size=6.3, c=OFF,   z=6)

# ════════════════════════════════════════════════════════════════════════════
# BACKGROUND GRID
# ════════════════════════════════════════════════════════════════════════════
for gx in np.arange(0, FIG_W, 1.0):
    ax.axvline(gx, color='#0C1E34', lw=0.35, alpha=0.6, zorder=0)
for gy in np.arange(0, FIG_H, 1.0):
    ax.axhline(gy, color='#0C1E34', lw=0.35, alpha=0.6, zorder=0)

# ════════════════════════════════════════════════════════════════════════════
# TITLE
# ════════════════════════════════════════════════════════════════════════════
rbox(0, 15.1, FIG_W, 0.9, '#071428', ec=BLUE, alpha=1.0, r=0.0, lw=0, z=3)
ax.add_patch(plt.Rectangle((0, 15.1), FIG_W, 0.05, facecolor=BLUE, zorder=4))
glow(FIG_W/2, 15.62, 'LinkedIn Platform  —  System Architecture', size=15, c=WHITE)
txt(FIG_W/2, 15.25,
    '8 Microservices  ·  Kafka Event Bus (14 Topics)  ·  MySQL + MongoDB + Redis  ·  React 18 Frontend',
    size=8.5, c=SKY, z=5)

# ════════════════════════════════════════════════════════════════════════════
# ZONE BACKGROUNDS
# Layout X positions:
#   Client:  0.3 → 3.1   (w=2.8)
#   Proxy:   3.3 → 5.5   (w=2.2)
#   Svcs:    5.7 → 13.3  (w=7.6)
#   Kafka:   13.5→ 18.5  (w=5.0)
#   DBs:     18.7→ 25.7  (w=7.0)
# ════════════════════════════════════════════════════════════════════════════
zones = [
    (0.3,  0.3, 2.8,  14.5, BLUE,     0.06, BLUE,     'CLIENT'),
    (3.3,  0.3, 2.2,  14.5, TEAL,     0.05, TEAL_H,   'PROXY'),
    (5.7,  0.3, 7.6,  14.5, BLUE_H,   0.04, BLUE_H,   'MICROSERVICES'),
    (13.5, 0.3, 5.0,  14.5, PURPLE,   0.07, PURPLE_H, 'EVENT BUS · KAFKA'),
    (18.7, 0.3, 7.0,  14.5, GREEN,    0.06, GREEN_H,  'DATABASES'),
]
for zx, zy, zw, zh, zc, za, zbc, zlbl in zones:
    rbox(zx, zy, zw, zh, zc, ec=zbc, alpha=za, r=0.5, lw=1.1, z=1)
    glow(zx+zw/2, zy+zh-0.38, zlbl, size=8, c=matplotlib.colors.to_hex(
        matplotlib.colors.to_rgba(zbc, 1.0)), bold=True, z=2)

# ════════════════════════════════════════════════════════════════════════════
# CLIENT
# ════════════════════════════════════════════════════════════════════════════
svc(0.5,  11.2, 2.4, 1.8, 'React 18',      ':3000', 'Vite · JSX · SSE', BLUE_D,  BLUE)
svc(0.5,  8.8,  2.4, 1.8, 'Recruiter',     'Portal', 'React · SSE feed', '#14387A', '#1A50A8')

badge(1.7, 11.0, 'JWT localStorage', '#0A3060', size=5.8)
badge(1.7, 8.6,  'SSE consumer',     TEAL,      size=5.8)

# ════════════════════════════════════════════════════════════════════════════
# VITE PROXY
# ════════════════════════════════════════════════════════════════════════════
rbox(3.4, 1.0, 2.0, 12.8, TEAL, ec=TEAL_H, alpha=0.1, r=0.3, lw=1.0, z=2)
glow(4.4, 13.45, 'VITE PROXY', size=8, c=TEAL_H)

routes = [
    ('/api/members',      '#024858'),
    ('/api/auth',         '#024858'),
    ('/uploads',          '#024858'),
    ('/api/v1/jobs',      '#082E68'),
    ('/api/applications', '#062860'),
    ('/api/connections',  '#043848'),
    ('/api/messaging',    '#032E40'),
    ('/analytics',        '#032E3C'),
    ('/events',           '#032E3C'),
    ('/ai/*',             '#2C0C48'),
]
for i, (route, rc) in enumerate(routes):
    ry = 12.6 - i * 1.12
    rbox(3.48, ry - 0.22, 1.84, 0.44, rc, ec=TEAL, alpha=0.95, r=0.1, lw=0.7, z=4)
    txt(4.4, ry, route, size=6.8, c=SKY)

# ════════════════════════════════════════════════════════════════════════════
# MICROSERVICES — 2 columns, 4 rows
# ════════════════════════════════════════════════════════════════════════════
SW, SH = 1.82, 1.75
C1X = 5.9    # left column x
C2X = 8.05   # right column x

# Row Y centres: 12.2, 9.8, 7.4, 5.0
svcs_data = [
    # x,   y,    title,             port,   lang,                  fc,        ec
    (C1X, 11.4, 'Profile Svc',     ':8002', 'FastAPI · Python',   '#1A4A8C', '#2A6ABA'),
    (C2X, 11.4, 'Job Svc',         ':3002', 'Node.js · Express',  '#124A90', '#1A6ABF'),
    (C1X,  8.9, 'Application Svc', ':5003', 'Node.js · Express',  '#024A80', '#0A6AB0'),
    (C2X,  8.9, 'Connection Svc',  ':3005', 'Node.js · Express',  '#026A7E', '#03AAC8'),
    (C1X,  6.4, 'Messaging Svc',   ':3004', 'Node.js · MongoDB',  '#035C40', '#059060'),
    (C2X,  6.4, 'Analytics Svc',   ':4000', 'Node.js · MongoDB',  '#025868', '#038898'),
    (C1X,  3.9, 'AI Service',      ':8005', 'FastAPI · Python',   '#804000', '#C06010'),
]

for sx, sy, title, port, lang, fc, ec in svcs_data:
    svc(sx, sy, SW, SH, title, port, lang, fc, ec)

# Redis cache box (inline with services)
svc(C2X, 3.9, SW, SH, 'Redis Cache', ':6379', 'In-memory · TTL', '#6A2800', '#C05010',
    port_c='#FFB060')
badge(C2X+SW/2, 5.1, 'search:sha256 → 60s', '#802000', size=5.5)
badge(C2X+SW/2, 4.8, 'job:uuid → 10s',      '#802000', size=5.5)

# ════════════════════════════════════════════════════════════════════════════
# KAFKA BUS
# ════════════════════════════════════════════════════════════════════════════
KX = 13.6
rbox(KX, 0.7, 4.7, 13.3, KAFKA_BG, ec=KAFKA_BD, alpha=0.96, r=0.35, lw=1.8, z=3)
glow(KX+2.35, 13.62, 'KAFKA  :9092', size=10, c=PURPLE_H)
txt(KX+2.35, 13.28, 'Confluent · 14 Topics', size=7.5, c=OFF, z=5)

topics = [
    'job.created', 'job.closed', 'job.viewed', 'job.saved',
    'application.submitted', 'application.status_updated',
    'connection.requested', 'connection.accepted',
    'message.sent',
    'member.created', 'member.updated', 'profile.viewed',
    'ai.requests', 'ai.results',
]
t_colors = ['#22084A', '#1C0640'] * 7
for i, (topic, tc) in enumerate(zip(topics, t_colors)):
    ty = 12.55 - i * 0.82
    rbox(KX+0.12, ty-0.23, 4.46, 0.46, tc, ec='#4A18A0', alpha=0.98, r=0.1, lw=0.7, z=5)
    txt(KX+2.35, ty, topic, size=7.2, c='#C090FF', z=6)

# ════════════════════════════════════════════════════════════════════════════
# DATABASES
# ════════════════════════════════════════════════════════════════════════════
DX = 18.9
DW = 6.5
DH = 3.0

dbbox(DX, 10.6, DW, DH, 'MySQL 8.0',
      'data236 · linkedin_sim · application_db · connections',
      'members · job_postings · applications · connections\nprocessed_events  |  FULLTEXT INDEX',
      '#0A3A70')
badge(DX+DW/2, 10.7, 'FULLTEXT: title + description', '#083060', size=6)

dbbox(DX, 7.1, DW, DH, 'MongoDB 7.0',
      'linkedin_analytics · messaging_db · ai_db',
      'events · threads · messages · ai_tasks\nidempotency_key dedup | 14-topic consumer',
      '#035040')
badge(DX+DW/2, 7.2, 'idempotency_key UNIQUE index', '#023830', size=6)

dbbox(DX, 3.6, DW, DH, 'Redis 7 Alpine',
      'In-memory Cache  :6379',
      'search:{sha256(params)} → TTL 60s\njob:{uuid} → TTL 10s  |  99.9% latency cut',
      '#6A2800')
badge(DX+DW/2, 3.7, '63.5ms cold → 0.9ms warm', '#501800', size=6)

# ════════════════════════════════════════════════════════════════════════════
# ARROWS
# ════════════════════════════════════════════════════════════════════════════

# ── Helper: horizontal elbow arrow (go right to MX, then up/down to target) ──
def elbow(x1, y1, x2, y2, mx, c, lw=1.2, alpha=0.55, z=3):
    """Draw an L-shaped path: horizontal to mx, then vertical to y2, then to x2."""
    ax.annotate('', xy=(x2, y2), xytext=(x1, y1), zorder=z,
                arrowprops=dict(
                    arrowstyle='->, head_width=0.16, head_length=0.11',
                    color=matplotlib.colors.to_rgba(c, alpha),
                    lw=lw,
                    connectionstyle=f'angle,angleA=0,angleB=90,rad=4',
                ))

def hv_arrow(x1, y1, x2, y2, c, lw=1.2, alpha=0.55, z=3):
    """Horizontal then vertical arrow."""
    ax.plot([x1, x2], [y1, y1], color=matplotlib.colors.to_rgba(c, alpha),
            lw=lw, zorder=z, solid_capstyle='round')
    ax.annotate('', xy=(x2, y2), xytext=(x2, y1), zorder=z,
                arrowprops=dict(
                    arrowstyle='->, head_width=0.16, head_length=0.11',
                    color=matplotlib.colors.to_rgba(c, alpha),
                    lw=lw, connectionstyle='arc3,rad=0'
                ))

# ── Client → Proxy ───────────────────────────────────────────────────────────
arr(2.9, 12.1, 3.4, 12.1, c=SKY, lw=1.6, alpha=0.8)
arr(2.9, 9.7,  3.4, 10.6, c=SKY, lw=1.6, alpha=0.7)

# ── Proxy → Services (straight horizontals per service row) ──────────────────
proxy_svc_arrows = [
    (12.55, C1X,  12.3),   # Profile
    (11.42, C2X,  12.3),   # Job
    (10.07, C1X,   9.8),   # App
    ( 8.95, C2X,   9.8),   # Conn
    ( 7.60, C1X,   7.3),   # Msg
    ( 6.48, C2X,   7.3),   # Analytics
    ( 5.13, C1X,   4.8),   # AI
]
for py, tx, ty in proxy_svc_arrows:
    arr(5.4, py, tx, ty, c=TEAL_H, lw=1.1, alpha=0.65)

# ── Services → Kafka (right side of each svc row → Kafka left at KX) ─────────
# Use the vertical midpoint of each service box as origin
svc_kafka = [
    (C1X+SW, 12.28, 12.55),  # profile  → member.created (topic row 9)
    (C2X+SW, 12.28, 11.73),  # job      → job.created    (topic row 1)
    (C1X+SW,  9.77, 10.09),  # app      → application.submitted (row 4)
    (C2X+SW,  9.77,  9.27),  # conn     → connection.requested  (row 6)
    (C1X+SW,  7.27,  8.45),  # msg      → message.sent          (row 8)
    (C1X+SW,  4.77,  2.27),  # ai       → ai.requests           (row 12)
]
for x1, y1, ky in svc_kafka:
    arr(x1, y1, KX, ky, c='#8050C0', lw=1.2, alpha=0.6)

# ── Kafka → Analytics (consume all 14 topics) ────────────────────────────────
# Draw as a thick arrow from Kafka left edge back to Analytics right edge
arr(KX, 7.60, C2X+SW, 7.27, c=GREEN_H, lw=2.0, alpha=0.65)
txt(11.5, 7.75, 'all 14 topics', size=6.2, c=GREEN_H)

# ── Kafka → Job svc (applicants_count++) ─────────────────────────────────────
arr(KX, 10.09, C2X+SW, 9.77+0.3, c='#A070E0', lw=1.0, alpha=0.45, rad=-0.2)

# ── Services → Databases — routed ABOVE Kafka via top bus line ───────────────
# Shared top bus Y = 14.2, above all service boxes, goes right to DB zone
BUS_Y = 14.2  # horizontal bus above everything

# Vertical stubs up from each service to bus, then right to DB
for sx, sy_mid, db_y, db_x_offset, c in [
    (C1X+SW/2, 13.15, 12.1,  0.0,  BLUE),     # Profile → MySQL
    (C2X+SW/2, 13.15, 11.9,  0.0,  BLUE),     # Job     → MySQL
    (C1X+SW/2, 10.77, 11.5,  0.0,  BLUE),     # App     → MySQL
    (C2X+SW/2, 10.77, 11.3,  0.0,  BLUE),     # Conn    → MySQL
    (C1X+SW/2,  8.15,  8.6,  0.0,  GREEN),    # Msg     → Mongo
    (C2X+SW/2,  8.15,  8.9,  0.0,  GREEN),    # Analytics→ Mongo
    (C1X+SW/2,  5.65,  7.2,  0.0,  ORANGE),   # AI      → Mongo
]:
    # straight diagonal from service right edge to DB
    ax.annotate('', xy=(DX, sy_mid), xytext=(sx+0.9, sy_mid), zorder=3,
                arrowprops=dict(
                    arrowstyle='->, head_width=0.14, head_length=0.1',
                    color=matplotlib.colors.to_rgba(c, 0.35),
                    lw=1.0,
                    connectionstyle='arc3,rad=0'
                ))

# Actual DB arrows — cleaner: from service right edge horizontal to just right of Kafka, then to DB
# Profile + Job → MySQL
ax.annotate('', xy=(DX, 12.1), xytext=(C1X+SW, 12.28), zorder=3,
            arrowprops=dict(arrowstyle='->, head_width=0.15, head_length=0.11',
                            color=matplotlib.colors.to_rgba(BLUE, 0.5), lw=1.2,
                            connectionstyle='arc3,rad=0'))
ax.annotate('', xy=(DX, 11.9), xytext=(C2X+SW, 12.28), zorder=3,
            arrowprops=dict(arrowstyle='->, head_width=0.15, head_length=0.11',
                            color=matplotlib.colors.to_rgba(BLUE, 0.5), lw=1.2,
                            connectionstyle='arc3,rad=0'))
# App + Conn → MySQL
ax.annotate('', xy=(DX, 11.5), xytext=(C1X+SW, 9.77), zorder=3,
            arrowprops=dict(arrowstyle='->, head_width=0.15, head_length=0.11',
                            color=matplotlib.colors.to_rgba(BLUE, 0.45), lw=1.1,
                            connectionstyle='arc3,rad=0'))
ax.annotate('', xy=(DX, 11.3), xytext=(C2X+SW, 9.77), zorder=3,
            arrowprops=dict(arrowstyle='->, head_width=0.15, head_length=0.11',
                            color=matplotlib.colors.to_rgba(BLUE, 0.45), lw=1.1,
                            connectionstyle='arc3,rad=0'))
# Msg + Analytics → MongoDB
ax.annotate('', xy=(DX, 8.6), xytext=(C1X+SW, 7.27), zorder=3,
            arrowprops=dict(arrowstyle='->, head_width=0.15, head_length=0.11',
                            color=matplotlib.colors.to_rgba(GREEN, 0.55), lw=1.2,
                            connectionstyle='arc3,rad=0'))
ax.annotate('', xy=(DX, 8.9), xytext=(C2X+SW, 7.27), zorder=3,
            arrowprops=dict(arrowstyle='->, head_width=0.15, head_length=0.11',
                            color=matplotlib.colors.to_rgba(GREEN, 0.55), lw=1.2,
                            connectionstyle='arc3,rad=0'))
# AI → MongoDB
ax.annotate('', xy=(DX, 7.2), xytext=(C1X+SW, 4.77), zorder=3,
            arrowprops=dict(arrowstyle='->, head_width=0.15, head_length=0.11',
                            color=matplotlib.colors.to_rgba(ORANGE, 0.55), lw=1.2,
                            connectionstyle='arc3,rad=0'))
# Job ↔ Redis (cache read/write)
ax.annotate('', xy=(DX, 5.1), xytext=(C2X+SW, 4.77), zorder=3,
            arrowprops=dict(arrowstyle='->, head_width=0.15, head_length=0.11',
                            color=matplotlib.colors.to_rgba('#E08030', 0.7), lw=1.5,
                            connectionstyle='arc3,rad=0'))
ax.annotate('', xy=(C2X+SW, 5.0), xytext=(DX, 4.8), zorder=3,
            arrowprops=dict(arrowstyle='->, head_width=0.13, head_length=0.1',
                            color=matplotlib.colors.to_rgba('#E08030', 0.45), lw=1.0,
                            linestyle='--', connectionstyle='arc3,rad=0'))
txt(11.6, 5.35, 'cache R/W', size=6, c='#E08030')

# ── DB labels on arrows ───────────────────────────────────────────────────────
txt(17.5, 12.5, 'MySQL', size=6, c=matplotlib.colors.to_hex(
    matplotlib.colors.to_rgba(BLUE, 0.7)))
txt(17.5,  8.8, 'MongoDB', size=6, c=matplotlib.colors.to_hex(
    matplotlib.colors.to_rgba(GREEN, 0.7)))

# ── SSE back-channel (dashed, from Analytics/AI bottom → Client) ─────────────
ax.annotate('', xy=(2.9, 10.8), xytext=(C2X+SW/2, 6.4), zorder=3,
            arrowprops=dict(arrowstyle='->, head_width=0.15, head_length=0.11',
                            color=matplotlib.colors.to_rgba(TEAL_H, 0.45), lw=1.1,
                            linestyle='--', connectionstyle='arc3,rad=0.35'))
txt(5.2, 5.2, 'SSE push', size=6.5, c=TEAL_H)

# ════════════════════════════════════════════════════════════════════════════
# LEGEND
# ════════════════════════════════════════════════════════════════════════════
rbox(0.3, 0.3, 13.0, 1.2, '#050D1A', ec='#1A2E48', alpha=0.95, r=0.2, lw=1.0, z=5)
glow(1.1, 1.18, 'LEGEND', size=7, c=SKY, z=6)

leg = [
    (1.5,  0.82, SKY,       'Client ↔ Proxy'),
    (1.5,  0.52, TEAL_H,    'Proxy → Service'),
    (4.0,  0.82, '#8050C0', 'Service → Kafka'),
    (4.0,  0.52, GREEN_H,   'Kafka → Service'),
    (6.5,  0.82, BLUE,      'Service → MySQL'),
    (6.5,  0.52, GREEN,     'Service → MongoDB'),
    (9.0,  0.82, '#E08030', 'Job Svc ↔ Redis'),
    (9.0,  0.52, TEAL_H,    'SSE push (dashed)'),
    (11.5, 0.82, ORANGE,    'AI → MongoDB'),
]
for lx, ly, lc, ltxt in leg:
    ax.annotate('', xy=(lx+0.02, ly), xytext=(lx-0.32, ly), zorder=7,
                arrowprops=dict(arrowstyle='->', color=lc, lw=1.8))
    txt(lx+0.75, ly, ltxt, size=6.5, c=OFF, ha='left', z=7)

# ════════════════════════════════════════════════════════════════════════════
# TECH BADGES — bottom right
# ════════════════════════════════════════════════════════════════════════════
tech = [
    ('MySQL 8',   BLUE_D),  ('MongoDB 7', GREEN),  ('Redis 7',  ORANGE),
    ('Kafka',     PURPLE),  ('FastAPI',   '#6A3000'), ('Node.js', '#1A5A1A'),
    ('React 18',  '#0A508A'), ('Docker',  '#084A8A'), ('JWT HS256','#2A1A5A'),
]
for i, (btxt, bc) in enumerate(tech):
    bx = 13.5 + i * 1.42
    rbox(bx, 0.38, 1.3, 0.56, bc, ec=bc, alpha=0.9, r=0.12, lw=0.8, z=6)
    txt(bx+0.65, 0.66, btxt, size=6.5, bold=True, c=WHITE, z=7)

# ════════════════════════════════════════════════════════════════════════════
# FOOTER
# ════════════════════════════════════════════════════════════════════════════
txt(FIG_W/2, 0.16,
    'DATA 236  ·  Group 8  ·  LinkedIn Platform  ·  Spring 2025',
    size=7, c='#304860', z=5)

plt.tight_layout(pad=0)
out = '/Users/dipinjassal/sem_2/linkedin/presentation/architecture_diagram.png'
plt.savefig(out, dpi=200, bbox_inches='tight', facecolor=BG, edgecolor='none')
plt.close()
print(f'Saved: {out}')

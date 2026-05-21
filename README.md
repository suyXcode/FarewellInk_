# 🎓 FarewellInk — Digital Farewell Signature Wall

A **premium dark-themed Flask web app** where college students draw digital
signatures and leave farewell memories before graduation.

---

## 📁 Project Structure

```
farewellink/
│
├── app.py                        ← Flask app, all routes, SocketIO, admin logic
├── requirements.txt              ← Python dependencies
├── README.md                     ← This file
│
├── models/
│   └── models.py                 ← SQLAlchemy ORM (Signature, Admin)
│
├── database/
│   └── farewellink.db            ← SQLite DB (auto-created on first run)
│
├── static/
│   ├── css/
│   │   ├── style.css             ← Main theme: glassmorphism, dark palette,
│   │   │                           particles, animations, responsive grid
│   │   └── sign.css              ← Sign-page extras: canvas sizing, validation
│   │
│   ├── js/
│   │   ├── main.js               ← Loading screen, navbar scroll, particle
│   │   │                           system, confetti, theme toggle, music,
│   │   │                           SocketIO live updates
│   │   ├── sign.js               ← Signature Pad setup, font picker, replay,
│   │   │                           form validation, AJAX submit
│   │   └── wall.js               ← Masonry infinite scroll, search/filter,
│   │                               modal popup, reactions
│   │
│   └── uploads/
│       └── signatures/           ← PNG signature images saved here
│
└── templates/
    ├── base.html                 ← Shared layout: navbar, footer, loading
    │                               screen, toast, confetti canvas, SocketIO
    ├── index.html                ← Hero page, typed quote, particle canvas,
    │                               floating caps, preview cards, QR teaser
    ├── sign.html                 ← Signature canvas, controls, form, font
    │                               picker, success modal
    ├── wall.html                 ← Memory Wall gallery with filters
    ├── signature_detail.html     ← Full-page single signature view
    │
    └── admin/
        ├── login.html            ← Admin login form
        └── dashboard.html        ← Stats, table, approve/reject/delete
```


## 🗃️ Database Schema

```
Table: signatures
  id              INTEGER  PRIMARY KEY
  name            TEXT     NOT NULL
  nickname        TEXT
  branch          TEXT     NOT NULL
  graduation_year INTEGER  NOT NULL
  message         TEXT     NOT NULL
  favorite_memory TEXT
  font            TEXT     DEFAULT 'Pacifico'
  pen_color       TEXT     DEFAULT '#ffffff'
  signature_image TEXT     (path under static/)
  status          TEXT     DEFAULT 'approved'  [approved|pending|rejected]
  likes           INTEGER  DEFAULT 0
  fires           INTEGER  DEFAULT 0
  caps            INTEGER  DEFAULT 0
  created_at      DATETIME DEFAULT NOW

Table: admins
  id              INTEGER  PRIMARY KEY
  username        TEXT     UNIQUE
  password        TEXT
  created_at      DATETIME
```

---

## 🚀 Quick Start

```bash
# 1. Clone / extract the project
cd farewellink

# 2. Create virtual environment (recommended)
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Run the app  (DB is auto-created on first launch)
python app.py

# 5. Open browser
http://localhost:5000
```

---

## 🌐 API Endpoints

| Method | Endpoint                  | Description                        |
|--------|---------------------------|------------------------------------|
| GET    | `/`                       | Home / hero page                   |
| GET    | `/sign`                   | Signature creation page            |
| POST   | `/api/submit`             | Submit signature (JSON)            |
| GET    | `/wall`                   | Memory Wall gallery                |
| GET    | `/api/signatures`         | Paginated JSON feed (search/filter)|
| POST   | `/api/react/<id>`         | Increment reaction counter         |
| GET    | `/signature/<id>`         | Single signature detail page       |
| GET    | `/download/png/<id>`      | Download signature as PNG          |
| GET    | `/qr`                     | QR code image for this site        |
| GET    | `/admin`                  | Admin dashboard (auth required)    |
| POST   | `/admin/delete/<id>`      | Delete a signature                 |
| POST   | `/admin/status/<id>`      | Change signature status            |
| GET    | `/admin/export`           | Export all signatures as CSV       |

---

## 🎨 Design System

| Token           | Value                             |
|-----------------|-----------------------------------|
| Primary gold    | `#e2c97e`                         |
| Background      | `#060610`                         |
| Surface         | `#0d0d1e`                         |
| Glass card bg   | `rgba(255,255,255,0.04)`          |
| Display font    | Playfair Display                  |
| Body font       | DM Sans                           |
| Signature fonts | Pacifico · Great Vibes · Dancing Script · Lobster · Allura |

---

## 📦 Dependencies

```
Flask              3.0        Web framework
Flask-SQLAlchemy   3.1        ORM + SQLite
Flask-SocketIO     5.3        Real-time events
Flask-WTF          1.2        CSRF protection
Pillow             10.1       PNG image processing
qrcode             7.4        QR code generation
fpdf2              2.7        PDF export
eventlet           0.35       Async worker for SocketIO
python-dotenv      1.0        Environment variables
```

### Front-end CDN libraries
- Bootstrap 5.3
- Signature Pad 4.1 (canvas drawing)
- AOS 2.3 (scroll animations)
- Font Awesome 6.5
- Socket.IO 4.6 (client)
- Google Fonts (Playfair Display, DM Sans, Pacifico, Great Vibes, Dancing Script, Lobster, Allura)

---

## ✨ Features Checklist

- [x] Animated hero with particle system & floating graduation caps
- [x] Typing animation for farewell quotes
- [x] Signature Pad (mouse, touch, stylus) with undo, clear, replay
- [x] Stroke width slider + pen color picker
- [x] 5 signature font styles with live preview
- [x] Student details form with real-time validation
- [x] PNG signature saved to `/static/uploads/signatures/`
- [x] SQLite database with full schema
- [x] Memory Wall masonry grid
- [x] Infinite scroll (IntersectionObserver)
- [x] Search by name + filter by branch
- [x] Modal popup for enlarged signature view
- [x] Reaction system ❤️ 🔥 🎓
- [x] Download PNG
- [x] Dark / Light theme toggle (persisted in localStorage)
- [x] Real-time live updates via Flask-SocketIO
- [x] Live visitor counter
- [x] New signature toast notification
- [x] Confetti animation on successful submission
- [x] QR code generation
- [x] Admin dashboard (stats, approve/reject/delete, CSV export)
- [x] Glassmorphism UI cards
- [x] Gradient gold buttons with hover effects
- [x] Animated loading screen
- [x] Background music toggle
- [x] Fully responsive (mobile, tablet, desktop)
- [x] CSRF protection
- [x] Input validation (server + client)
- [x] XSS prevention (output escaping)

---

## 🔧 Production Notes

1. Set `SECRET_KEY` as an environment variable (never commit it)
2. Change admin credentials in `app.py → ADMIN_CREDS`
3. Use `gunicorn` with `eventlet` worker:
   ```bash
   gunicorn -k eventlet -w 1 app:app
   ```
4. Serve `/static` through nginx for better performance
5. Consider PostgreSQL instead of SQLite for multi-worker deployments

"""
FarewellInk — Digital Farewell Signature Wall (2026 Batch)
Persistent storage: PostgreSQL + Cloudinary
"""
import os, io, base64, random, hashlib, csv
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()  # loads .env file for local dev

import cloudinary
import cloudinary.uploader

from PIL import Image
import qrcode

from flask import (Flask, render_template, request, jsonify,
                   redirect, url_for, session, send_file, flash, abort)
from flask_socketio import SocketIO, emit
from flask_wtf.csrf import CSRFProtect

import sys
sys.path.insert(0, os.path.dirname(__file__))
from models.models import db, Signature, Admin

# ── Cloudinary config ─────────────────────────────────────────────────────────
cloudinary.config(
    cloud_name = os.environ.get('CLOUDINARY_CLOUD_NAME', 'dndhnx4dn'),
    api_key    = os.environ.get('CLOUDINARY_API_KEY',    '351745846696943'),
    api_secret = os.environ.get('CLOUDINARY_API_SECRET', 'PgrXucauBqVain7h5Uxq4uiOgyQ'),
    secure     = True,
)

# ── App ───────────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent

app = Flask(__name__)

# ── Database URL ──────────────────────────────────────────────────────────────
# Render sets DATABASE_URL with postgres:// but SQLAlchemy needs postgresql://
DATABASE_URL = os.environ.get('DATABASE_URL', '')
if DATABASE_URL.startswith('postgres://'):
    DATABASE_URL = DATABASE_URL.replace('postgres://', 'postgresql://', 1)

# Fallback to SQLite for local development without PostgreSQL
if not DATABASE_URL:
    DB_PATH    = BASE_DIR / 'database' / 'farewellink.db'
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    DATABASE_URL = f'sqlite:///{DB_PATH}'
    print('⚠️  No DATABASE_URL found — using SQLite (local dev only)')

app.config.update(
    SECRET_KEY                     = os.environ.get('SECRET_KEY', 'farewell-ink-2026-local'),
    SQLALCHEMY_DATABASE_URI        = DATABASE_URL,
    SQLALCHEMY_TRACK_MODIFICATIONS = False,
    WTF_CSRF_ENABLED               = True,
    MAX_CONTENT_LENGTH             = 16 * 1024 * 1024,
)

db.init_app(app)
csrf     = CSRFProtect(app)
socketio = SocketIO(app, cors_allowed_origins='*', async_mode='gevent')

# ── Quotes ────────────────────────────────────────────────────────────────────
QUOTES = [
    "Not goodbye — see you on the other side of greatness. 🌟",
    "The tassel was worth the hassle. 🎓",
    "Go confidently in the direction of your dreams.",
    "This is not the end. It's the end of the beginning.",
    "Don't cry because it's over. Smile because it happened.",
    "May your cap fly as high as your dreams. 🎓",
    "The future belongs to those who believe in their dreams.",
    "You are braver than you believe, stronger than you seem.",
    "It's time to turn the page and write a new chapter.",
    "Class of 2026 — you made history. Now go make the future.",
]

# Admin credentials from environment
ADMIN_CREDS = {
    'username': os.environ.get('ADMIN_USERNAME', 'admin'),
    'password': os.environ.get('ADMIN_PASSWORD', 'farewell2026'),
}

visitor_count = 0

# ═══════════════════════════════════════════════════════════════════════════════
# IMAGE UPLOAD HELPER — saves to Cloudinary (production) or local (dev)
# ═══════════════════════════════════════════════════════════════════════════════

def save_image(data_url, folder_name):
    """
    Upload base64 image to Cloudinary.
    Returns the secure URL (string) or None on failure.
    Falls back to local disk if Cloudinary is not configured.
    """
    if not data_url or not data_url.startswith('data:image/'):
        return None

    try:
        img_bytes = base64.b64decode(data_url.split(',', 1)[1])
    except Exception:
        return None

    # ── Cloudinary upload ──────────────────────────────────────────────────────
    cloud_name = os.environ.get('CLOUDINARY_CLOUD_NAME', '')
    if cloud_name:
        try:
            result = cloudinary.uploader.upload(
                io.BytesIO(img_bytes),
                folder        = f'farewellink/{folder_name}',
                resource_type = 'image',
                format        = 'png',
            )
            return result.get('secure_url')
        except Exception as e:
            print(f'Cloudinary upload error: {e}')
            return None

    # ── Local fallback (SQLite / local dev) ───────────────────────────────────
    try:
        local_folder = BASE_DIR / 'static' / 'uploads' / folder_name
        local_folder.mkdir(parents=True, exist_ok=True)
        ts       = datetime.utcnow().strftime('%Y%m%d%H%M%S%f')
        filename = f'{folder_name[:3]}_{ts}.png'
        img      = Image.open(io.BytesIO(img_bytes)).convert('RGBA')
        img.save(local_folder / filename, 'PNG')
        return f'uploads/{folder_name}/{filename}'   # relative path
    except Exception as e:
        print(f'Local save error: {e}')
        return None


def image_src(path_or_url):
    """
    Return the correct src for <img> tags.
    Cloudinary URLs are absolute; local paths need /static/ prefix.
    """
    if not path_or_url:
        return None
    if path_or_url.startswith('http'):
        return path_or_url
    return f'/static/{path_or_url}'


# Make helper available in Jinja2 templates
app.jinja_env.globals['image_src'] = image_src

# ═══════════════════════════════════════════════════════════════════════════════
# ROUTES — PUBLIC
# ═══════════════════════════════════════════════════════════════════════════════

@app.route('/')
def index():
    global visitor_count
    visitor_count += 1
    socketio.emit('visitor_update', {'count': visitor_count})
    total = Signature.query.filter_by(status='approved').count()
    return render_template('index.html', total=total, quote=random.choice(QUOTES))


@app.route('/sign')
def sign():
    return render_template('sign.html', quote=random.choice(QUOTES))


@app.route('/wall')
def wall():
    branches = [b[0] for b in
                db.session.query(Signature.branch)
                  .filter_by(status='approved').distinct().all()]
    return render_template('wall.html', branches=branches)


@app.route('/signature/<int:sig_id>')
def view_signature(sig_id):
    sig = Signature.query.filter_by(id=sig_id, status='approved').first_or_404()
    return render_template('signature_detail.html', sig=sig)


# ── Submit ─────────────────────────────────────────────────────────────────────
@app.route('/api/submit', methods=['POST'])
@csrf.exempt
def submit_signature():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({'success': False, 'error': 'No data received'}), 400

    for field in ['name', 'branch', 'graduation_year', 'message']:
        val = data.get(field)
        if not val or (isinstance(val, str) and not val.strip()):
            return jsonify({'success': False, 'error': f'{field} is required'}), 400

    name            = data['name'][:120].strip()
    nickname        = data.get('nickname', '')[:80].strip()
    branch          = data['branch'][:100].strip()
    message         = data['message'][:2000].strip()
    favorite_memory = data.get('favorite_memory', '')[:2000].strip()
    font            = data.get('font', 'Pacifico')[:60].strip()
    pen_color       = data.get('pen_color', '#e2c97e')[:20].strip()
    card_theme      = data.get('card_theme', 'gold')[:40].strip()

    try:
        grad_year = int(data['graduation_year'])
        assert 2000 <= grad_year <= 2099
    except Exception:
        return jsonify({'success': False, 'error': 'Invalid graduation year'}), 400

    # Upload images to Cloudinary (or local fallback)
    image_url = save_image(data.get('signature_data', ''), 'signatures')
    photo_url = save_image(data.get('profile_photo', ''),  'photos')

    sig = Signature(
        name=name, nickname=nickname, branch=branch,
        graduation_year=grad_year, message=message,
        favorite_memory=favorite_memory, font=font,
        pen_color=pen_color, card_theme=card_theme,
        signature_image=image_url, profile_photo=photo_url,
        status='approved',
    )
    db.session.add(sig)
    db.session.commit()
    socketio.emit('new_signature', sig.to_dict())
    return jsonify({'success': True, 'id': sig.id, 'quote': random.choice(QUOTES)})


# ── API ───────────────────────────────────────────────────────────────────────
@app.route('/api/signatures')
def api_signatures():
    page   = request.args.get('page', 1, type=int)
    per    = 12
    search = request.args.get('search', '').strip()
    branch = request.args.get('branch', '').strip()
    theme  = request.args.get('theme', '').strip()

    q = Signature.query.filter_by(status='approved')
    if search: q = q.filter(Signature.name.ilike(f'%{search}%'))
    if branch: q = q.filter(Signature.branch == branch)
    if theme:  q = q.filter(Signature.card_theme == theme)

    total   = q.count()
    results = q.order_by(Signature.created_at.desc())\
                .offset((page-1)*per).limit(per).all()

    return jsonify({
        'signatures': [s.to_dict() for s in results],
        'has_more':   (page * per) < total,
        'total':      total,
    })


@app.route('/api/react/<int:sig_id>', methods=['POST'])
@csrf.exempt
def react(sig_id):
    sig  = Signature.query.get_or_404(sig_id)
    kind = (request.get_json(silent=True, force=True) or {}).get('kind', 'likes')
    if kind == 'likes':  sig.likes += 1
    elif kind == 'fires': sig.fires += 1
    elif kind == 'caps':  sig.caps  += 1
    db.session.commit()
    return jsonify({'likes': sig.likes, 'fires': sig.fires, 'caps': sig.caps})


@app.route('/download/png/<int:sig_id>')
def download_png(sig_id):
    sig = Signature.query.filter_by(id=sig_id, status='approved').first_or_404()
    if not sig.signature_image: abort(404)

    # If Cloudinary URL — redirect to it directly
    if sig.signature_image.startswith('http'):
        return redirect(sig.signature_image)

    # Local file
    path = BASE_DIR / 'static' / sig.signature_image
    return send_file(path, as_attachment=True,
                     download_name=f'{sig.name.replace(" ","_")}_signature.png')


@app.route('/qr')
def qr_code():
    img = qrcode.make(request.host_url)
    buf = io.BytesIO()
    img.save(buf, 'PNG')
    buf.seek(0)
    return send_file(buf, mimetype='image/png')


# ═══════════════════════════════════════════════════════════════════════════════
# ADMIN
# ═══════════════════════════════════════════════════════════════════════════════

@app.route('/admin/login', methods=['GET', 'POST'])
@csrf.exempt
def admin_login():
    if request.method == 'POST':
        if (request.form.get('username') == ADMIN_CREDS['username'] and
                request.form.get('password') == ADMIN_CREDS['password']):
            session['admin'] = True
            return redirect(url_for('admin_dashboard'))
        flash('Invalid credentials', 'danger')
    return render_template('admin/login.html')


@app.route('/admin/logout')
def admin_logout():
    session.pop('admin', None)
    return redirect(url_for('index'))


def admin_required(fn):
    from functools import wraps
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not session.get('admin'):
            return redirect(url_for('admin_login'))
        return fn(*args, **kwargs)
    return wrapper


@app.route('/admin')
@admin_required
def admin_dashboard():
    total    = Signature.query.count()
    approved = Signature.query.filter_by(status='approved').count()
    pending  = Signature.query.filter_by(status='pending').count()
    rejected = Signature.query.filter_by(status='rejected').count()
    recent   = Signature.query.order_by(Signature.created_at.desc()).limit(30).all()
    branches = db.session.query(Signature.branch, db.func.count(Signature.id))\
                 .group_by(Signature.branch).all()
    return render_template('admin/dashboard.html',
                           total=total, approved=approved, pending=pending,
                           rejected=rejected, recent=recent, branches=branches,
                           visitor_count=visitor_count)


@app.route('/admin/delete/<int:sig_id>', methods=['POST'])
@csrf.exempt
@admin_required
def admin_delete(sig_id):
    sig = Signature.query.get_or_404(sig_id)
    sig.status = 'rejected'
    db.session.commit()
    socketio.emit('signature_removed', {'id': sig_id})
    return jsonify({'success': True})


@app.route('/admin/status/<int:sig_id>', methods=['POST'])
@csrf.exempt
@admin_required
def admin_status(sig_id):
    sig    = Signature.query.get_or_404(sig_id)
    data   = request.get_json(silent=True, force=True) or {}
    status = data.get('status', 'approved')
    if status in ('approved', 'pending', 'rejected'):
        sig.status = status
        db.session.commit()
        return jsonify({'success': True, 'status': sig.status})
    return jsonify({'success': False}), 400


@app.route('/admin/export')
@admin_required
def admin_export():
    sigs = Signature.query.order_by(Signature.created_at.desc()).all()
    buf  = io.StringIO()
    w    = csv.writer(buf)
    w.writerow(['ID','Name','Nickname','Branch','Year','Message',
                'Font','Theme','Status','SignatureURL','PhotoURL','Created'])
    for s in sigs:
        w.writerow([s.id, s.name, s.nickname, s.branch, s.graduation_year,
                    s.message, s.font, s.card_theme, s.status,
                    s.signature_image, s.profile_photo,
                    s.created_at.strftime('%Y-%m-%d %H:%M')])
    buf.seek(0)
    return send_file(io.BytesIO(buf.getvalue().encode()), mimetype='text/csv',
                     as_attachment=True, download_name='farewellink_2026.csv')


# ═══════════════════════════════════════════════════════════════════════════════
# SOCKETIO
# ═══════════════════════════════════════════════════════════════════════════════

@socketio.on('connect')
def on_connect():
    emit('visitor_update', {'count': visitor_count})


# ═══════════════════════════════════════════════════════════════════════════════
# DB INIT
# ═══════════════════════════════════════════════════════════════════════════════

# ── Auto-create tables on startup (works on Render) ──────────────────────────
with app.app_context():
    db.create_all()
    if not Admin.query.first():
        db.session.add(Admin(
            username=ADMIN_CREDS['username'],
            password=ADMIN_CREDS['password'],
        ))
        db.session.commit()
    print('✅  FarewellInk 2026 — Database ready.')

if __name__ == '__main__':
    socketio.run(app, debug=True, host='0.0.0.0', port=5000, use_reloader=False)

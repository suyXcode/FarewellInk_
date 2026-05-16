"""
FarewellInk — Digital Farewell Signature Wall  (2026 Batch)
"""
import os, io, base64, random, hashlib, csv
from datetime import datetime
from pathlib import Path

import qrcode
from PIL import Image
from flask import (Flask, render_template, request, jsonify,
                   redirect, url_for, session, send_file, flash, abort)
from flask_socketio import SocketIO, emit
from flask_wtf.csrf import CSRFProtect

import sys
sys.path.insert(0, os.path.dirname(__file__))
from models.models import db, Signature, Admin

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE_DIR    = Path(__file__).resolve().parent
SIG_FOLDER  = BASE_DIR / 'static' / 'uploads' / 'signatures'
PHOTO_FOLDER= BASE_DIR / 'static' / 'uploads' / 'photos'
DB_PATH     = BASE_DIR / 'database' / 'farewellink.db'

app = Flask(__name__)
app.config.update(
    SECRET_KEY                     = os.environ.get('SECRET_KEY', 'farewell-ink-2026'),
    SQLALCHEMY_DATABASE_URI        = f'sqlite:///{DB_PATH}',
    SQLALCHEMY_TRACK_MODIFICATIONS = False,
    WTF_CSRF_ENABLED               = True,
    MAX_CONTENT_LENGTH             = 16 * 1024 * 1024,
)

db.init_app(app)
csrf     = CSRFProtect(app)
socketio = SocketIO(app, cors_allowed_origins='*', async_mode='eventlet')

SIG_FOLDER.mkdir(parents=True, exist_ok=True)
PHOTO_FOLDER.mkdir(parents=True, exist_ok=True)

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

visitor_count = 0

# ═══════════════════════════════════════════════════════════════════════
# PUBLIC ROUTES
# ═══════════════════════════════════════════════════════════════════════

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

    # Validate required fields
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
    except:
        return jsonify({'success': False, 'error': 'Invalid graduation year'}), 400

    # Save signature image
    image_path = _save_image(data.get('signature_data', ''),
                             SIG_FOLDER, f'sig_{_ts()}_{_md5(name)}.png')

    # Save profile photo
    photo_path = _save_image(data.get('profile_photo', ''),
                             PHOTO_FOLDER, f'photo_{_ts()}_{_md5(name)}.png')

    sig = Signature(
        name=name, nickname=nickname, branch=branch,
        graduation_year=grad_year, message=message,
        favorite_memory=favorite_memory, font=font,
        pen_color=pen_color, card_theme=card_theme,
        signature_image=image_path, profile_photo=photo_path,
        status='approved',
    )
    db.session.add(sig)
    db.session.commit()
    socketio.emit('new_signature', sig.to_dict())
    return jsonify({'success': True, 'id': sig.id, 'quote': random.choice(QUOTES)})

def _save_image(data_url, folder, filename):
    """Decode base64 data URL and save as PNG; return relative path or None."""
    if not data_url or not data_url.startswith('data:image/'):
        return None
    try:
        raw   = base64.b64decode(data_url.split(',', 1)[1])
        img   = Image.open(io.BytesIO(raw)).convert('RGBA')
        path  = folder / filename
        img.save(path, 'PNG')
        folder_name = folder.name          # 'signatures' or 'photos'
        return f'uploads/{folder_name}/{filename}'
    except Exception as e:
        print(f'Image save error: {e}')
        return None

def _ts():  return datetime.utcnow().strftime('%Y%m%d%H%M%S%f')
def _md5(s): return hashlib.md5(s.encode()).hexdigest()[:8]

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
    if kind == 'likes': sig.likes += 1
    elif kind == 'fires': sig.fires += 1
    elif kind == 'caps':  sig.caps  += 1
    db.session.commit()
    return jsonify({'likes': sig.likes, 'fires': sig.fires, 'caps': sig.caps})

@app.route('/download/png/<int:sig_id>')
def download_png(sig_id):
    sig = Signature.query.filter_by(id=sig_id, status='approved').first_or_404()
    if not sig.signature_image: abort(404)
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

# ═══════════════════════════════════════════════════════════════════════
# ADMIN
# ═══════════════════════════════════════════════════════════════════════
ADMIN_CREDS = {'username': 'admin', 'password': 'farewell2026'}

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
    w.writerow(['ID','Name','Nickname','Branch','Year','Message','Font','Theme','Status','Created'])
    for s in sigs:
        w.writerow([s.id, s.name, s.nickname, s.branch, s.graduation_year,
                    s.message, s.font, s.card_theme, s.status,
                    s.created_at.strftime('%Y-%m-%d %H:%M')])
    buf.seek(0)
    return send_file(io.BytesIO(buf.getvalue().encode()), mimetype='text/csv',
                     as_attachment=True, download_name='farewellink_2026.csv')

# ═══════════════════════════════════════════════════════════════════════
# SOCKETIO
# ═══════════════════════════════════════════════════════════════════════
@socketio.on('connect')
def on_connect():
    emit('visitor_update', {'count': visitor_count})

# ═══════════════════════════════════════════════════════════════════════
# INIT
# ═══════════════════════════════════════════════════════════════════════
def init_db():
    with app.app_context():
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        db.create_all()
        if not Admin.query.first():
            db.session.add(Admin(username='admin', password='farewell2026'))
            db.session.commit()
        print('✅  FarewellInk 2026 — Database ready.')

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)

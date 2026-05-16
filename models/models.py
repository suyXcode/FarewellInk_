"""
FarewellInk — Database Models
"""
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class Signature(db.Model):
    __tablename__ = 'signatures'
    id              = db.Column(db.Integer,  primary_key=True)
    name            = db.Column(db.String(120), nullable=False)
    nickname        = db.Column(db.String(80),  nullable=True)
    branch          = db.Column(db.String(100), nullable=False)
    graduation_year = db.Column(db.Integer,     nullable=False)
    message         = db.Column(db.Text,        nullable=False)
    favorite_memory = db.Column(db.Text,        nullable=True)
    font            = db.Column(db.String(60),  default='Pacifico')
    pen_color       = db.Column(db.String(20),  default='#e2c97e')
    signature_image = db.Column(db.String(255), nullable=True)
    profile_photo   = db.Column(db.String(255), nullable=True)
    card_theme      = db.Column(db.String(40),  default='gold')
    status          = db.Column(db.String(20),  default='approved')
    likes           = db.Column(db.Integer,     default=0)
    fires           = db.Column(db.Integer,     default=0)
    caps            = db.Column(db.Integer,     default=0)
    created_at      = db.Column(db.DateTime,    default=datetime.utcnow)

    def to_dict(self):
        return {
            'id':              self.id,
            'name':            self.name,
            'nickname':        self.nickname,
            'branch':          self.branch,
            'graduation_year': self.graduation_year,
            'message':         self.message,
            'favorite_memory': self.favorite_memory,
            'font':            self.font,
            'pen_color':       self.pen_color,
            'signature_image': self.signature_image,
            'profile_photo':   self.profile_photo,
            'card_theme':      self.card_theme,
            'status':          self.status,
            'likes':           self.likes,
            'fires':           self.fires,
            'caps':            self.caps,
            'created_at':      self.created_at.strftime('%B %d, %Y'),
        }

class Admin(db.Model):
    __tablename__ = 'admins'
    id         = db.Column(db.Integer,     primary_key=True)
    username   = db.Column(db.String(80),  unique=True, nullable=False)
    password   = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime,    default=datetime.utcnow)

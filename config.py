import os


class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY')
    if not SECRET_KEY:
        raise ValueError(
            "SECRET_KEY n'est pas définie. "
            "Ajoutez-la dans les variables d'environnement Railway "
            "(générez-en une avec : python -c \"import secrets; print(secrets.token_hex(32))\")"
        )

    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL', 'sqlite:///bm.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Railway utilise postgres:// mais SQLAlchemy veut postgresql://
    if SQLALCHEMY_DATABASE_URI.startswith('postgres://'):
        SQLALCHEMY_DATABASE_URI = SQLALCHEMY_DATABASE_URI.replace('postgres://', 'postgresql://', 1)

    # Sécurité des cookies de session
    SESSION_COOKIE_SECURE = True      # Transmis uniquement en HTTPS
    SESSION_COOKIE_HTTPONLY = True    # Inaccessible via JavaScript
    SESSION_COOKIE_SAMESITE = 'Lax'  # Protection CSRF basique

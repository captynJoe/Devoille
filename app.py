#!/usr/bin/env python3
import base64
import html
import io
import json
import os
import secrets
import sqlite3
import time
import urllib.parse
import urllib.error
import urllib.request
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    Image = None

MAX_IMAGE_DIMENSION = 1600
IMAGE_JPEG_QUALITY = 85
BACKFILL_IMAGE_THRESHOLD = 300_000

ROOT = Path(__file__).resolve().parent
DATA_DIR = Path(os.environ.get("DEVOILE_DATA_DIR", ROOT / "data"))
DB_PATH = DATA_DIR / "devoile.sqlite3"
SESSION_COOKIE = "devoile_session"
PESAPAL_TOKEN = {"token": "", "expires_at": 0}
MPESA_TOKEN = {"token": "", "expires_at": 0}
PESAPAL_LIVE_BASE = "https://pay.pesapal.com/v3"
PESAPAL_SANDBOX_BASE = "https://cybqa.pesapal.com/pesapalv3"
MPESA_LIVE_BASE = "https://api.safaricom.co.ke"
MPESA_SANDBOX_BASE = "https://sandbox.safaricom.co.ke"

DEFAULT_PRODUCTS = [
    {"id":"aroma-30","name":"Aroma 30ml","category":"Aroma","price":2500,"compareAt":None,"status":"in_stock","stock":18,"visual":"dropper","tone":"scent","image":"/assets/products/aroma-card.webp","images":[],"short":"A concentrated scent oil that stays close, clean, and intentional.","description":"A concentrated scent oil built for everyday wear rather than a single occasion. The 30ml dropper bottle is sized for a bedside table or a travel pouch, and the formula is designed to sit close to the skin instead of announcing itself across a room.\n\nApply a small amount to pulse points and let it settle for a few minutes before layering with fragrance-free products. Store away from direct sunlight to preserve the scent's character."},
    {"id":"classic-jumbo-500","name":"Dèvoilè Classic Jumbo | 500ml","category":"Lubricants","price":1099,"compareAt":1599,"status":"sale","stock":6,"visual":"jumbo","tone":"","image":"/assets/products/amber-card.webp","images":[],"short":"The larger amber bottle for customers who keep Classic in regular rotation.","description":"The same Classic formula in a 500ml jumbo amber bottle, built for customers who already know it works and don't want to reorder every month. The wider base and pump-friendly neck make it easy to keep on a nightstand or in a drawer.\n\nWater-based, easy to clean up, and compatible with most materials. Patch test first if you have sensitive skin."},
    {"id":"classic-250","name":"Dèvoilè Classic | 250ml","category":"Lubricants","price":599,"compareAt":899,"status":"sale","stock":42,"visual":"tall","tone":"featured","image":"/assets/products/classic-card.webp","images":["/assets/products/classic-focus.webp"],"short":"The signature 250ml bottle: clean feel, easy reset, discreet enough for the shelf.","description":"Dévoilé's signature 250ml bottle. A clean, water-based formula with a light, easy-to-reset feel and a shape that reads as skincare rather than anything else on a shared shelf.\n\nWorks well for everyday use, layers easily, and rinses off without residue. This is the size most customers start with before moving up to the 500ml jumbo bottle."},
    {"id":"mint-85","name":"Dèvoilè Mint Sensation Lubricant | 85ml","category":"Lubricants","price":649,"compareAt":None,"status":"in_stock","stock":21,"visual":"small mint","tone":"","image":"/assets/products/amber-card.webp","images":[],"short":"A pocket 85ml formula with a crisp, cooling finish.","description":"A pocket-sized 85ml bottle with a crisp, cooling mint finish. Sized for travel, a bag, or a bedside drawer without taking up much room.\n\nSame water-based Dévoilé base as the rest of the range, with a lighter, brighter finish for customers who want a cooling sensation instead of a neutral one."},
    {"id":"painless-85","name":"Dèvoilè Painless Lubricant | 85ml","category":"Lubricants","price":649,"compareAt":None,"status":"in_stock","stock":5,"visual":"small rose","tone":"","image":"/assets/products/classic-card.webp","images":[],"short":"A gentler comfort bottle for customers who want a softer first experience.","description":"A gentler formula in the same 85ml travel size, made for a softer first experience or for customers who found other formulas too intense. \n\nWater-based and easy to rinse off. Start with a small amount and add more as needed."},
    {"id":"signature-candle","name":"Dèvoilè Signature Scented Candle","category":"Ambiance","price":1499,"compareAt":None,"status":"sold_out","stock":0,"visual":"candle","tone":"sold","image":"/assets/products/dark-card.webp","images":[],"short":"A room-setting candle for scent layering, shelf styling, and evening atmosphere.","description":"A room-setting candle designed to layer with the Aroma line rather than compete with it. Burns clean with a slow, even wax pool and a warm, low throw suited to a bedroom or a quiet corner in the evening.\n\nTrim the wick before each burn and keep away from drafts for the most even burn time. Currently sold out — restocks are announced on Instagram and TikTok."},
    {"id":"original-aroma-10","name":"Original Aroma | 10ml","category":"Aroma","price":1200,"compareAt":None,"status":"sold_out","stock":0,"visual":"mini-dropper","tone":"sold scent","image":"/assets/products/aroma-card.webp","images":[],"short":"A 10ml scent trial for travel pouches, gifting, and quiet restocks.","description":"A 10ml trial size of the original Aroma formula, sized for a gift, a travel pouch, or a first try before committing to the full 30ml bottle.\n\nSame concentrated, close-to-skin character as the 30ml size, just less of it. Currently sold out — restocks are announced on Instagram and TikTok."},
]

LEGACY_SAMPLE_ORDER_IDS = ("#DE-1048", "#DE-1047", "#DE-1046", "#DE-1045")

DEFAULT_SITE_SETTINGS = {
    "facebook_url": "https://www.facebook.com/devoilessentials",
    "instagram_url": "https://www.instagram.com/devoilessentials",
    "tiktok_url": "https://www.tiktok.com/@devoilessentials",
    "contact_email": "Devoilessentials@gmail.com",
    "privacy_url": "/privacy",
    "footer_blurb": "Private scent, comfort, and care essentials with discreet Nairobi pickup and Kenya-wide delivery.",
}

SITE_SETTING_KEYS = tuple(DEFAULT_SITE_SETTINGS.keys())



def db():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS products (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              category TEXT NOT NULL,
              price REAL NOT NULL,
              compare_at REAL,
              status TEXT NOT NULL,
              stock INTEGER NOT NULL,
              visual TEXT NOT NULL,
              tone TEXT NOT NULL DEFAULT '',
              image TEXT NOT NULL DEFAULT '',
              short TEXT NOT NULL DEFAULT '',
              description TEXT NOT NULL DEFAULT '',
              images TEXT NOT NULL DEFAULT '[]',
              updated_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS users (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              email TEXT UNIQUE NOT NULL,
              name TEXT,
              provider TEXT NOT NULL DEFAULT 'local',
              created_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS sessions (
              token TEXT PRIMARY KEY,
              user_id INTEGER NOT NULL,
              expires_at INTEGER NOT NULL,
              FOREIGN KEY(user_id) REFERENCES users(id)
            );
            CREATE TABLE IF NOT EXISTS admin_actions (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              actor_email TEXT,
              action TEXT NOT NULL,
              target_type TEXT NOT NULL,
              target_id TEXT,
              payload TEXT,
              created_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS orders (
              id TEXT PRIMARY KEY,
              customer TEXT NOT NULL,
              items TEXT NOT NULL,
              fulfillment TEXT NOT NULL,
              status TEXT NOT NULL,
              status_tone TEXT NOT NULL,
              total REAL NOT NULL,
              created_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS tasks (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              label TEXT NOT NULL,
              done INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS subscriber_points (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              value INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS subscribers (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              email TEXT UNIQUE NOT NULL,
              source TEXT NOT NULL DEFAULT 'footer',
              created_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS site_settings (
              key TEXT PRIMARY KEY,
              value TEXT NOT NULL,
              updated_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS checkout_orders (
              id TEXT PRIMARY KEY,
              customer_name TEXT,
              email TEXT,
              phone TEXT,
              items TEXT NOT NULL,
              subtotal REAL NOT NULL,
              total REAL NOT NULL,
              currency TEXT NOT NULL,
              fulfillment TEXT NOT NULL,
              status TEXT NOT NULL,
              payment_provider TEXT,
              pesapal_tracking_id TEXT,
              pesapal_redirect_url TEXT,
              payment_status TEXT,
              payment_method TEXT,
              confirmation_code TEXT,
              mpesa_checkout_request_id TEXT,
              mpesa_merchant_request_id TEXT,
              mpesa_phone TEXT,
              mpesa_result_code TEXT,
              mpesa_result_desc TEXT,
              mpesa_receipt_number TEXT,
              mpesa_callback_payload TEXT,
              created_at INTEGER NOT NULL,
              updated_at INTEGER NOT NULL
            );
            """
        )
        existing_columns = {row["name"] for row in conn.execute("PRAGMA table_info(products)").fetchall()}
        if "description" not in existing_columns:
            conn.execute("ALTER TABLE products ADD COLUMN description TEXT NOT NULL DEFAULT ''")
        if "images" not in existing_columns:
            conn.execute("ALTER TABLE products ADD COLUMN images TEXT NOT NULL DEFAULT '[]'")
        checkout_columns = {row["name"] for row in conn.execute("PRAGMA table_info(checkout_orders)").fetchall()}
        checkout_migrations = {
            "mpesa_checkout_request_id": "TEXT",
            "mpesa_merchant_request_id": "TEXT",
            "mpesa_phone": "TEXT",
            "mpesa_result_code": "TEXT",
            "mpesa_result_desc": "TEXT",
            "mpesa_receipt_number": "TEXT",
            "mpesa_callback_payload": "TEXT",
        }
        for column, column_type in checkout_migrations.items():
            if column not in checkout_columns:
                conn.execute(f"ALTER TABLE checkout_orders ADD COLUMN {column} {column_type}")
        count = conn.execute("SELECT COUNT(*) AS c FROM products").fetchone()["c"]
        if count == 0:
            for product in DEFAULT_PRODUCTS:
                upsert_product(conn, product)
        else:
            backfill_oversized_product_images(conn)
        for order_id in LEGACY_SAMPLE_ORDER_IDS:
            conn.execute("DELETE FROM orders WHERE id = ?", (order_id,))
        conn.execute("DELETE FROM tasks")
        conn.execute("DELETE FROM subscriber_points")
        for key, value in DEFAULT_SITE_SETTINGS.items():
            conn.execute(
                "INSERT OR IGNORE INTO site_settings (key, value, updated_at) VALUES (?, ?, ?)",
                (key, value, int(time.time())),
            )


def normalize_site_url(value, *, allow_relative=False):
    url = str(value or "").strip()
    if not url:
        return ""
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme in ("http", "https", "mailto", "tel"):
        return url
    if allow_relative and (url.startswith("./") or url.startswith("/")) and not any(ch in url for ch in "\"'<> "):
        return url
    raise ValueError("Use a full http(s), mailto:, or tel: URL" + (" or a relative site path" if allow_relative else ""))


def normalize_site_settings(payload):
    current = {key: str(payload.get(key, DEFAULT_SITE_SETTINGS[key]) or "").strip() for key in SITE_SETTING_KEYS}
    current["facebook_url"] = normalize_site_url(current["facebook_url"])
    current["instagram_url"] = normalize_site_url(current["instagram_url"])
    current["tiktok_url"] = normalize_site_url(current["tiktok_url"])
    current["contact_email"] = str(current["contact_email"] or "").strip()[:160]
    current["privacy_url"] = normalize_site_url(current["privacy_url"], allow_relative=True)
    current["footer_blurb"] = current["footer_blurb"][:240]
    return current


def read_site_settings(conn):
    rows = conn.execute("SELECT key, value FROM site_settings").fetchall()
    settings = dict(DEFAULT_SITE_SETTINGS)
    for row in rows:
        if row["key"] in SITE_SETTING_KEYS:
            settings[row["key"]] = row["value"]
    return settings


def save_site_settings(conn, payload):
    settings = normalize_site_settings(payload)
    now = int(time.time())
    for key, value in settings.items():
        conn.execute(
            "INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at",
            (key, value, now),
        )
    return settings


def normalize_image_path(image):
    if isinstance(image, str) and image.startswith("./assets/"):
        return "/" + image[2:]
    return image


def validate_image_value(image, *, label="Product image"):
    image = str(image or "")
    is_uploaded_image = image.startswith("data:image/")
    is_asset_image = (image.startswith("/assets/") or image.startswith("./assets/")) and not any(ch in image for ch in '\"\'<>')
    if image and not (is_uploaded_image or is_asset_image):
        raise ValueError(f"{label} must be an uploaded browser image data URL or trusted local asset path")
    if is_uploaded_image and len(image) > 5_600_000:
        raise ValueError(f"{label} is too large; keep it under 4MB")
    return image


def fit_image_data_url(data_url, max_dimension=MAX_IMAGE_DIMENSION, quality=IMAGE_JPEG_QUALITY):
    """Re-encode an uploaded data: URL to a bounded JPEG so no oversized upload
    ever gets stored or shipped to every visitor via /api/products, regardless
    of what the browser sent (client-side resizing can't be trusted alone)."""
    if Image is None or not isinstance(data_url, str) or not data_url.startswith("data:image/"):
        return data_url
    try:
        _, encoded = data_url.split(",", 1)
        raw = base64.b64decode(encoded)
        with Image.open(io.BytesIO(raw)) as img:
            img = img.convert("RGB")
            width, height = img.size
            scale = min(1.0, max_dimension / max(width, height))
            if scale < 1.0:
                img = img.resize((max(1, round(width * scale)), max(1, round(height * scale))), Image.LANCZOS)
            buffer = io.BytesIO()
            img.save(buffer, format="JPEG", quality=quality, optimize=True)
        return "data:image/jpeg;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")
    except Exception:
        return data_url


def product_from_row(row):
    try:
        gallery = json.loads(row["images"] or "[]")
    except (TypeError, ValueError):
        gallery = []
    if not isinstance(gallery, list):
        gallery = []
    return {
        "id": row["id"],
        "name": row["name"],
        "category": row["category"],
        "price": row["price"],
        "compareAt": row["compare_at"],
        "status": row["status"],
        "stock": row["stock"],
        "visual": row["visual"],
        "tone": row["tone"],
        "image": normalize_image_path(row["image"]),
        "short": row["short"],
        "description": row["description"] or "",
        "images": [normalize_image_path(item) for item in gallery if isinstance(item, str) and item],
    }


def normalize_product(value):
    required = ["id", "name", "category", "price", "status", "stock", "visual"]
    for key in required:
        if key not in value or value[key] in (None, ""):
            raise ValueError(f"Missing product field: {key}")
    image = validate_image_value(value.get("image"))
    image = fit_image_data_url(image)
    gallery = value.get("images") or []
    if not isinstance(gallery, list):
        raise ValueError("Product images must be a list")
    if len(gallery) > 8:
        raise ValueError("Keep the photo gallery to 8 images or fewer")
    gallery = [validate_image_value(item, label="Gallery image") for item in gallery]
    gallery = [fit_image_data_url(item) for item in gallery]
    gallery = [item for item in gallery if item]
    description = str(value.get("description") or "")
    if len(description) > 6000:
        raise ValueError("Description is too long; keep it under 6000 characters")
    return {
        "id": str(value["id"]).strip(),
        "name": str(value["name"]).strip(),
        "category": str(value["category"]).strip(),
        "price": float(value["price"]),
        "compareAt": float(value["compareAt"]) if value.get("compareAt") not in (None, "") else None,
        "status": str(value["status"]).strip(),
        "stock": int(value["stock"]),
        "visual": str(value["visual"]).strip(),
        "tone": str(value.get("tone") or ""),
        "image": image,
        "short": str(value.get("short") or ""),
        "description": description,
        "images": gallery,
    }


def upsert_product(conn, product):
    p = normalize_product(product)
    conn.execute(
        """
        INSERT INTO products (id, name, category, price, compare_at, status, stock, visual, tone, image, short, description, images, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name=excluded.name, category=excluded.category, price=excluded.price, compare_at=excluded.compare_at,
          status=excluded.status, stock=excluded.stock, visual=excluded.visual, tone=excluded.tone,
          image=excluded.image, short=excluded.short, description=excluded.description, images=excluded.images, updated_at=excluded.updated_at
        """,
        (p["id"], p["name"], p["category"], p["price"], p["compareAt"], p["status"], p["stock"], p["visual"], p["tone"], p["image"], p["short"], p["description"], json.dumps(p["images"]), int(time.time())),
    )
    return p


def backfill_oversized_product_images(conn):
    """One-time-per-row cleanup: shrink any images stored before server-side
    fitting existed (or uploaded from a stale browser tab) so /api/products
    never ships multi-megabyte payloads to every visitor. Leaves updated_at
    untouched since this isn't a content change."""
    rows = conn.execute("SELECT id, image, images FROM products").fetchall()
    for row in rows:
        image = row["image"]
        new_image = image
        if isinstance(image, str) and len(image) > BACKFILL_IMAGE_THRESHOLD and image.startswith("data:image/"):
            new_image = fit_image_data_url(image)
        try:
            gallery = json.loads(row["images"] or "[]")
        except (TypeError, ValueError):
            gallery = []
        if not isinstance(gallery, list):
            gallery = []
        new_gallery = []
        gallery_changed = False
        for item in gallery:
            if isinstance(item, str) and len(item) > BACKFILL_IMAGE_THRESHOLD and item.startswith("data:image/"):
                fitted = fit_image_data_url(item)
                gallery_changed = gallery_changed or fitted != item
                new_gallery.append(fitted)
            else:
                new_gallery.append(item)
        if new_image != image or gallery_changed:
            conn.execute(
                "UPDATE products SET image = ?, images = ? WHERE id = ?",
                (new_image, json.dumps(new_gallery), row["id"]),
            )


def record_action(conn, actor, action, target_type, target_id=None, payload=None):
    conn.execute(
        "INSERT INTO admin_actions (actor_email, action, target_type, target_id, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (actor, action, target_type, target_id, json.dumps(payload or {}, ensure_ascii=False), int(time.time())),
    )


def public_base_url():
    value = os.environ.get("DEVOILE_PUBLIC_BASE_URL") or os.environ.get("GOOGLE_REDIRECT_URI", "").split("/api/", 1)[0]
    return (value or "http://84.247.174.52:8090").rstrip("/")


def pesapal_base_url():
    environment = os.environ.get("PESAPAL_ENVIRONMENT", "live").strip().lower()
    return PESAPAL_SANDBOX_BASE if environment in ("sandbox", "demo", "test") else PESAPAL_LIVE_BASE


def pesapal_configured():
    return bool(os.environ.get("PESAPAL_CONSUMER_KEY") and os.environ.get("PESAPAL_CONSUMER_SECRET"))


def mpesa_base_url():
    environment = os.environ.get("MPESA_ENVIRONMENT", "sandbox").strip().lower()
    return MPESA_SANDBOX_BASE if environment in ("sandbox", "demo", "test") else MPESA_LIVE_BASE


def mpesa_callback_url():
    return (os.environ.get("MPESA_CALLBACK_URL") or (public_base_url() + "/api/payments/mpesa/callback")).strip()


def mpesa_configured():
    return bool(
        os.environ.get("MPESA_CONSUMER_KEY")
        and os.environ.get("MPESA_CONSUMER_SECRET")
        and os.environ.get("MPESA_BUSINESS_SHORT_CODE")
        and os.environ.get("MPESA_PASSKEY")
    )


def configured_admin_email():
    return (os.environ.get("DEVOILE_ADMIN_EMAIL") or "").strip().lower()


def configured_admin_password():
    return os.environ.get("DEVOILE_ADMIN_PASSWORD") or ""


def local_login_allowed(email, password):
    admin_email = configured_admin_email()
    admin_password = configured_admin_password()
    if not admin_email and not admin_password:
        return True
    return email == admin_email and secrets.compare_digest(str(password or ""), admin_password)


def google_login_allowed(email):
    admin_email = configured_admin_email()
    return not admin_email or email == admin_email


def normalize_return_target(value, default="/account"):
    target = str(value or "").strip()
    if not target:
        return default
    if target.startswith("./"):
        target = "/" + target[2:]
    if not target.startswith("/") or target.startswith("//") or any(ch in target for ch in "\\\"'<> "):
        return default
    return target


def build_oauth_state(return_target):
    encoded_return = base64.urlsafe_b64encode(return_target.encode("utf-8")).decode("ascii").rstrip("=")
    return secrets.token_urlsafe(18) + "." + encoded_return


def return_target_from_state(state):
    try:
        encoded_return = str(state or "").split(".", 1)[1]
        padded = encoded_return + "=" * (-len(encoded_return) % 4)
        return normalize_return_target(base64.urlsafe_b64decode(padded.encode("ascii")).decode("utf-8"))
    except Exception:
        return "/account"


def json_http_request(url, payload=None, headers=None, method=None, timeout=25):
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=body, method=method or ("POST" if payload is not None else "GET"))
    for key, value in (headers or {}).items():
        req.add_header(key, value)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            raw = response.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", "replace")
        try:
            data = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            data = {"message": raw}
        message = data.get("message") or (data.get("error") or {}).get("message") or f"HTTP {exc.code}"
        raise RuntimeError(message)


def pesapal_headers(token=None):
    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    return headers


def pesapal_token():
    now = int(time.time())
    if PESAPAL_TOKEN["token"] and PESAPAL_TOKEN["expires_at"] > now + 30:
        return PESAPAL_TOKEN["token"]
    if not pesapal_configured():
        raise RuntimeError("PesaPal credentials are not configured")
    data = json_http_request(
        pesapal_base_url() + "/api/Auth/RequestToken",
        {"consumer_key": os.environ.get("PESAPAL_CONSUMER_KEY"), "consumer_secret": os.environ.get("PESAPAL_CONSUMER_SECRET")},
        pesapal_headers(),
    )
    token = data.get("token")
    if not token:
        raise RuntimeError(data.get("message") or "PesaPal did not return an auth token")
    PESAPAL_TOKEN["token"] = token
    PESAPAL_TOKEN["expires_at"] = now + 240
    return token


def mpesa_headers(token=None):
    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    return headers


def mpesa_token():
    now = int(time.time())
    if MPESA_TOKEN["token"] and MPESA_TOKEN["expires_at"] > now + 30:
        return MPESA_TOKEN["token"]
    if not (os.environ.get("MPESA_CONSUMER_KEY") and os.environ.get("MPESA_CONSUMER_SECRET")):
        raise RuntimeError("M-PESA credentials are not configured")
    credentials = (os.environ.get("MPESA_CONSUMER_KEY") + ":" + os.environ.get("MPESA_CONSUMER_SECRET")).encode("utf-8")
    auth_header = "Basic " + base64.b64encode(credentials).decode("ascii")
    url = mpesa_base_url() + "/oauth/v1/generate?" + urllib.parse.urlencode({"grant_type": "client_credentials"})
    data = json_http_request(url, headers={"Authorization": auth_header, "Accept": "application/json"}, method="GET")
    token = data.get("access_token")
    if not token:
        raise RuntimeError(data.get("errorMessage") or data.get("message") or "M-PESA did not return an auth token")
    MPESA_TOKEN["token"] = token
    MPESA_TOKEN["expires_at"] = now + int(data.get("expires_in") or 3300)
    return token


def normalize_mpesa_phone(value):
    digits = "".join(ch for ch in str(value or "") if ch.isdigit())
    if digits.startswith("0") and len(digits) == 10:
        digits = "254" + digits[1:]
    elif len(digits) == 9 and digits[0] in ("1", "7"):
        digits = "254" + digits
    if not (digits.startswith("254") and len(digits) == 12 and digits[3] in ("1", "7")):
        raise ValueError("Enter a valid Safaricom phone number for M-PESA")
    return digits


def mpesa_password(short_code, passkey, timestamp):
    raw = (short_code + passkey + timestamp).encode("utf-8")
    return base64.b64encode(raw).decode("ascii")


def initiate_mpesa_stk_push(order, phone):
    normalized_phone = normalize_mpesa_phone(phone or order.get("phone"))
    if not mpesa_configured():
        raise RuntimeError("M-PESA is not configured yet. Add the Daraja credentials to .env and rebuild.")
    short_code = os.environ.get("MPESA_BUSINESS_SHORT_CODE", "").strip()
    passkey = os.environ.get("MPESA_PASSKEY", "").strip()
    timestamp = time.strftime("%Y%m%d%H%M%S", time.gmtime())
    transaction_type = os.environ.get("MPESA_TRANSACTION_TYPE", "CustomerPayBillOnline").strip() or "CustomerPayBillOnline"
    account_reference = (os.environ.get("MPESA_ACCOUNT_REFERENCE") or "Devoille").strip()[:12] or "Devoille"
    payload = {
        "BusinessShortCode": short_code,
        "Password": mpesa_password(short_code, passkey, timestamp),
        "Timestamp": timestamp,
        "TransactionType": transaction_type,
        "Amount": max(1, int(round(float(order["total"])))),
        "PartyA": normalized_phone,
        "PartyB": os.environ.get("MPESA_PARTY_B", short_code).strip() or short_code,
        "PhoneNumber": normalized_phone,
        "CallBackURL": mpesa_callback_url(),
        "AccountReference": account_reference,
        "TransactionDesc": order_description(order)[:100],
    }
    data = json_http_request(mpesa_base_url() + "/mpesa/stkpush/v1/processrequest", payload, mpesa_headers(mpesa_token()), timeout=30)
    response_code = str(data.get("ResponseCode") or data.get("responseCode") or "")
    if response_code and response_code != "0":
        raise RuntimeError(data.get("errorMessage") or data.get("ResponseDescription") or "M-PESA STK push failed")
    if not data.get("CheckoutRequestID"):
        raise RuntimeError(data.get("errorMessage") or data.get("ResponseDescription") or "M-PESA did not return a checkout request ID")
    return {**data, "phone": normalized_phone}


def pesapal_ipn_id():
    configured = os.environ.get("PESAPAL_IPN_ID", "").strip()
    if configured:
        return configured
    cache_path = DATA_DIR / "pesapal_ipn.json"
    ipn_url = public_base_url() + "/api/payments/pesapal/ipn"
    if cache_path.exists():
        try:
            cached = json.loads(cache_path.read_text())
            if cached.get("url") == ipn_url and cached.get("ipn_id"):
                return cached["ipn_id"]
        except (OSError, json.JSONDecodeError):
            pass
    token = pesapal_token()
    data = json_http_request(
        pesapal_base_url() + "/api/URLSetup/RegisterIPN",
        {"url": ipn_url, "ipn_notification_type": "POST"},
        pesapal_headers(token),
    )
    ipn_id = data.get("ipn_id")
    if not ipn_id:
        raise RuntimeError(data.get("message") or "PesaPal did not return an IPN ID")
    cache_path.write_text(json.dumps({"url": ipn_url, "ipn_id": ipn_id, "created_at": int(time.time())}))
    return ipn_id


def normalize_contact(value):
    return str(value or "").strip()


def save_subscriber(conn, payload):
    email = normalize_contact(payload.get("email") if isinstance(payload, dict) else "").lower()
    source = normalize_contact(payload.get("source") if isinstance(payload, dict) else "footer")[:80] or "footer"
    if not email or "@" not in email or "." not in email.rsplit("@", 1)[-1]:
        raise ValueError("Enter a valid email address")
    now = int(time.time())
    conn.execute(
        "INSERT INTO subscribers (email, source, created_at) VALUES (?, ?, ?) ON CONFLICT(email) DO UPDATE SET source=excluded.source",
        (email[:180], source, now),
    )
    row = conn.execute("SELECT email, source, created_at FROM subscribers WHERE email = ?", (email[:180],)).fetchone()
    return dict(row)


def split_name(name):
    parts = [part for part in normalize_contact(name).split() if part]
    if not parts:
        return "Dévoilé", "Customer"
    if len(parts) == 1:
        return parts[0], "Customer"
    return parts[0], " ".join(parts[1:])


def build_checkout_order(payload):
    items = payload.get("items") if isinstance(payload, dict) else None
    if not isinstance(items, list) or not items:
        raise ValueError("Your basket is empty")
    customer = payload.get("customer") if isinstance(payload.get("customer"), dict) else {}
    name = normalize_contact(customer.get("name"))
    email = normalize_contact(customer.get("email")).lower()
    phone = normalize_contact(customer.get("phone"))
    if not email and not phone:
        raise ValueError("Enter an email address or phone number for payment")
    fulfillment = normalize_contact(customer.get("fulfillment")) or "Discreet delivery"
    with db() as conn:
        products = {row["id"]: product_from_row(row) for row in conn.execute("SELECT * FROM products").fetchall()}
    normalized_items = []
    subtotal = 0.0
    for item in items:
        product_id = normalize_contact(item.get("id") if isinstance(item, dict) else "")
        qty = int(item.get("quantity") or 0) if isinstance(item, dict) else 0
        if qty <= 0:
            continue
        product = products.get(product_id)
        if not product:
            raise ValueError("One basket item is no longer available")
        if product["status"] == "sold_out" or int(product["stock"] or 0) <= 0:
            raise ValueError(product["name"] + " is sold out")
        qty = min(qty, int(product["stock"] or qty))
        line_total = round(float(product["price"]) * qty, 2)
        subtotal += line_total
        normalized_items.append({"id": product_id, "name": product["name"], "quantity": qty, "price": float(product["price"]), "total": line_total})
    if not normalized_items:
        raise ValueError("Your basket is empty")
    reference = "DEVOILE-" + str(int(time.time())) + "-" + secrets.token_hex(3).upper()
    return {
        "id": reference,
        "customer_name": name or "Dévoilé Customer",
        "email": email,
        "phone": phone,
        "items": normalized_items,
        "subtotal": round(subtotal, 2),
        "total": round(subtotal, 2),
        "currency": "KES",
        "fulfillment": fulfillment,
    }


def order_description(order):
    names = ", ".join(item["name"] for item in order["items"][:2])
    if len(order["items"]) > 2:
        names += ", more"
    return ("Dévoilé Essentials: " + names)[:100]


def save_checkout_order(conn, order, payment_response=None, status="Payment pending", provider="pesapal"):
    now = int(time.time())
    response = payment_response or {}
    payment_status = response.get("payment_status_description") or response.get("payment_status") or response.get("ResponseDescription")
    payment_method = response.get("payment_method") or ("M-PESA" if provider == "mpesa" else None)
    confirmation_code = response.get("confirmation_code") or response.get("MpesaReceiptNumber")
    conn.execute(
        """
        INSERT INTO checkout_orders (id, customer_name, email, phone, items, subtotal, total, currency, fulfillment, status, payment_provider, pesapal_tracking_id, pesapal_redirect_url, payment_status, payment_method, confirmation_code, mpesa_checkout_request_id, mpesa_merchant_request_id, mpesa_phone, mpesa_result_code, mpesa_result_desc, mpesa_receipt_number, mpesa_callback_payload, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          status=excluded.status, payment_provider=excluded.payment_provider, pesapal_tracking_id=excluded.pesapal_tracking_id, pesapal_redirect_url=excluded.pesapal_redirect_url,
          payment_status=excluded.payment_status, payment_method=excluded.payment_method, confirmation_code=excluded.confirmation_code,
          mpesa_checkout_request_id=excluded.mpesa_checkout_request_id, mpesa_merchant_request_id=excluded.mpesa_merchant_request_id, mpesa_phone=excluded.mpesa_phone,
          mpesa_result_code=excluded.mpesa_result_code, mpesa_result_desc=excluded.mpesa_result_desc, mpesa_receipt_number=excluded.mpesa_receipt_number,
          mpesa_callback_payload=COALESCE(excluded.mpesa_callback_payload, checkout_orders.mpesa_callback_payload), updated_at=excluded.updated_at
        """,
        (
            order["id"], order["customer_name"], order["email"], order["phone"], json.dumps(order["items"], ensure_ascii=False), order["subtotal"], order["total"], order["currency"], order["fulfillment"], status, provider,
            response.get("order_tracking_id"), response.get("redirect_url"), payment_status, payment_method, confirmation_code,
            response.get("CheckoutRequestID"), response.get("MerchantRequestID"), response.get("phone"), response.get("ResultCode"), response.get("ResultDesc"), response.get("MpesaReceiptNumber"), response.get("callback_payload"), now, now,
        ),
    )
    conn.execute(
        "INSERT OR REPLACE INTO orders (id, customer, items, fulfillment, status, status_tone, total, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM orders WHERE id = ?), ?))",
        (order["id"], order["customer_name"], ", ".join(f'{item["quantity"]}x {item["name"]}' for item in order["items"]), order["fulfillment"], status, "hold" if status != "Paid" else "paid", order["total"], order["id"], now),
    )


def checkout_order_status(order_id):
    reference = normalize_contact(order_id)
    if not reference:
        raise ValueError("Missing order ID")
    with db() as conn:
        row = conn.execute("SELECT * FROM checkout_orders WHERE id = ?", (reference,)).fetchone()
    if not row:
        raise ValueError("Order not found")
    return {
        "id": row["id"],
        "status": row["status"],
        "payment_provider": row["payment_provider"],
        "payment_status": row["payment_status"],
        "payment_method": row["payment_method"],
        "confirmation_code": row["confirmation_code"],
        "mpesa_result_code": row["mpesa_result_code"],
        "mpesa_result_desc": row["mpesa_result_desc"],
        "mpesa_receipt_number": row["mpesa_receipt_number"],
        "total": row["total"],
        "currency": row["currency"],
        "updated_at": row["updated_at"],
    }


def process_mpesa_callback(payload):
    callback = (((payload or {}).get("Body") or {}).get("stkCallback") or {})
    checkout_request_id = callback.get("CheckoutRequestID")
    if not checkout_request_id:
        raise ValueError("Missing M-PESA checkout request ID")
    result_code = str(callback.get("ResultCode"))
    result_desc = str(callback.get("ResultDesc") or "")
    metadata = callback.get("CallbackMetadata") or {}
    items = metadata.get("Item") if isinstance(metadata, dict) else []
    values = {item.get("Name"): item.get("Value") for item in items or [] if isinstance(item, dict)}
    receipt = values.get("MpesaReceiptNumber")
    phone = values.get("PhoneNumber")
    status = "Paid" if result_code == "0" else "Payment failed"
    now = int(time.time())
    with db() as conn:
        conn.execute(
            """
            UPDATE checkout_orders
            SET status = ?, payment_status = ?, confirmation_code = COALESCE(?, confirmation_code),
                mpesa_result_code = ?, mpesa_result_desc = ?, mpesa_receipt_number = COALESCE(?, mpesa_receipt_number),
                mpesa_phone = COALESCE(?, mpesa_phone), mpesa_callback_payload = ?, updated_at = ?
            WHERE mpesa_checkout_request_id = ?
            """,
            (status, status, receipt, result_code, result_desc, receipt, str(phone) if phone else None, json.dumps(payload, ensure_ascii=False), now, checkout_request_id),
        )
        row = conn.execute("SELECT id FROM checkout_orders WHERE mpesa_checkout_request_id = ?", (checkout_request_id,)).fetchone()
        if row:
            conn.execute("UPDATE orders SET status = ?, status_tone = ? WHERE id = ?", (status, "paid" if status == "Paid" else "hold", row["id"]))
            record_action(conn, "mpesa", "payment_callback", "checkout_order", row["id"], {"ResultCode": result_code, "ResultDesc": result_desc, "MpesaReceiptNumber": receipt})
    return {"ok": True, "status": status, "result_code": result_code, "result_desc": result_desc, "receipt": receipt}


def update_payment_status(order_tracking_id, merchant_reference=None):
    if not order_tracking_id:
        raise ValueError("Missing PesaPal order tracking ID")
    token = pesapal_token()
    url = pesapal_base_url() + "/api/Transactions/GetTransactionStatus?" + urllib.parse.urlencode({"orderTrackingId": order_tracking_id})
    data = json_http_request(url, headers=pesapal_headers(token))
    payment_status = data.get("payment_status_description") or data.get("status") or "Pending"
    status = "Paid" if str(payment_status).upper() == "COMPLETED" else "Payment " + str(payment_status).lower()
    with db() as conn:
        row = None
        if merchant_reference:
            row = conn.execute("SELECT * FROM checkout_orders WHERE id = ?", (merchant_reference,)).fetchone()
        if not row:
            row = conn.execute("SELECT * FROM checkout_orders WHERE pesapal_tracking_id = ?", (order_tracking_id,)).fetchone()
        if row:
            order = {
                "id": row["id"], "customer_name": row["customer_name"], "email": row["email"], "phone": row["phone"],
                "items": json.loads(row["items"]), "subtotal": row["subtotal"], "total": row["total"], "currency": row["currency"], "fulfillment": row["fulfillment"],
            }
            save_checkout_order(conn, order, {**data, "order_tracking_id": order_tracking_id, "redirect_url": row["pesapal_redirect_url"]}, status=status, provider="pesapal")
            record_action(conn, "pesapal", "payment_status", "checkout_order", order["id"], data)
    return data

def create_session(conn, email, name=None, provider="local"):
    now = int(time.time())
    conn.execute(
        "INSERT INTO users (email, name, provider, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(email) DO UPDATE SET name=COALESCE(excluded.name, users.name), provider=excluded.provider",
        (email, name, provider, now),
    )
    user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    token = secrets.token_urlsafe(32)
    conn.execute("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)", (token, user["id"], now + 60 * 60 * 24 * 14))
    record_action(conn, email, "login", "session", None, {"provider": provider})
    return token, user


CLEAN_ROUTE_FILES = {
    "/": "index.html",
    "/shop": "collection.html",
    "/scent-room": "ritual.html",
    "/care-journal": "intimacy-lab.html",
    "/login": "login.html",
    "/account": "user.html",
    "/checkout": "checkout.html",
    "/payment-status": "payment-status.html",
    "/privacy": "privacy.html",
    "/admin": "admin.html",
    "/admin/orders": "admin-orders.html",
    "/admin/products": "admin-products.html",
    "/admin/subscribers": "admin-subscribers.html",
    "/admin/actions": "admin-actions.html",
    "/admin/settings": "admin-settings.html",
}

LEGACY_ROUTE_REDIRECTS = {
    "/product.html": "/shop",
    "/index.html": "/",
    "/collection.html": "/shop",
    "/ritual.html": "/scent-room",
    "/intimacy-lab.html": "/care-journal",
    "/login.html": "/login",
    "/user.html": "/account",
    "/checkout.html": "/checkout",
    "/payment-status.html": "/payment-status",
    "/privacy.html": "/privacy",
    "/admin.html": "/admin",
    "/admin-orders.html": "/admin/orders",
    "/admin-products.html": "/admin/products",
    "/admin-subscribers.html": "/admin/subscribers",
    "/admin-actions.html": "/admin/actions",
    "/admin-settings.html": "/admin/settings",
}


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, ".webp": "image/webp"}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        request_path = urllib.parse.urlparse(getattr(self, "path", "")).path
        if request_path.endswith((".html", ".css", ".js")) or request_path == "/":
            self.send_header("Cache-Control", "no-store, max-age=0")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        super().end_headers()

    def send_json(self, value, status=200, extra_headers=None):
        body = json.dumps(value, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        for key, header_value in (extra_headers or {}).items():
            self.send_header(key, header_value)
        self.end_headers()
        self.wfile.write(body)

    def read_json(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0:
            return {}
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def session_user(self):
        cookie = SimpleCookie(self.headers.get("Cookie"))
        morsel = cookie.get(SESSION_COOKIE)
        if not morsel:
            return None
        with db() as conn:
            row = conn.execute(
                "SELECT users.* FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token = ? AND sessions.expires_at > ?",
                (morsel.value, int(time.time())),
            ).fetchone()
            if not row:
                return None
            user = dict(row)
            admin_email = configured_admin_email()
            if admin_email and str(user.get("email") or "").strip().lower() != admin_email:
                return None
            return user

    def require_user(self):
        user = self.session_user()
        if not user:
            self.send_json({"error": "Authentication required"}, 401)
            return None
        return user

    def handle_product_page(self, product_id):
        try:
            template = (ROOT / "product.html").read_text(encoding="utf-8")
        except OSError:
            self.send_response(500)
            self.end_headers()
            return
        product = None
        if product_id:
            with db() as conn:
                row = conn.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
            if row:
                product = product_from_row(row)
        base_url = public_base_url()
        canonical = base_url + "/product/" + urllib.parse.quote(product_id)
        fallback_image = base_url + "/assets/devoile-amber-hero.png"
        if product:
            status = 200
            title = f"{product['name']} - Dévoilé Essentials"
            source_copy = product["short"] or product["description"] or "Shop Dévoilé Essentials scent and comfort essentials."
            meta_description = " ".join(source_copy.split())[:160]
            robots = "index, follow"
            og_image = product["image"] or ""
            if og_image.startswith("/assets/"):
                og_image = base_url + og_image
            elif not og_image.startswith("http"):
                og_image = fallback_image
            json_ld = json.dumps({
                "@context": "https://schema.org/",
                "@type": "Product",
                "name": product["name"],
                "description": meta_description,
                "image": [og_image],
                "sku": product["id"],
                "category": product["category"],
                "offers": {
                    "@type": "Offer",
                    "priceCurrency": "KES",
                    "price": f"{product['price']:.2f}",
                    "availability": "https://schema.org/OutOfStock" if (product["status"] == "sold_out" or product["stock"] <= 0) else "https://schema.org/InStock",
                    "url": canonical,
                },
            }, ensure_ascii=False).replace("</", "<\\/")
            json_ld_block = f'<script type="application/ld+json">{json_ld}</script>'
        else:
            status = 404
            title = "Product not found - Dévoilé Essentials"
            meta_description = "This product is no longer available on the Dévoilé Essentials shelf."
            robots = "noindex, follow"
            og_image = fallback_image
            json_ld_block = ""
        page = template
        for token, value in {
            "__PDP_TITLE__": title,
            "__PDP_META_DESCRIPTION__": meta_description,
            "__PDP_CANONICAL__": canonical,
            "__PDP_OG_IMAGE__": og_image,
            "__PDP_ROBOTS__": robots,
        }.items():
            page = page.replace(token, html.escape(value))
        page = page.replace("__PDP_JSONLD_BLOCK__", json_ld_block)
        body = page.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store, max-age=0")
        self.end_headers()
        self.wfile.write(body)

    def do_HEAD(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip("/") if parsed.path != "/" else "/"
        if path in LEGACY_ROUTE_REDIRECTS:
            target = LEGACY_ROUTE_REDIRECTS[path]
            if parsed.query:
                target += "?" + parsed.query
            self.send_response(301)
            self.send_header("Location", target)
            self.end_headers()
            return
        if path in CLEAN_ROUTE_FILES:
            self.path = "/" + CLEAN_ROUTE_FILES[path] + (("?" + parsed.query) if parsed.query else "")
            return super().do_HEAD()
        return super().do_HEAD()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip("/") if parsed.path != "/" else "/"
        if path in LEGACY_ROUTE_REDIRECTS:
            target = LEGACY_ROUTE_REDIRECTS[path]
            if parsed.query:
                target += "?" + parsed.query
            self.redirect(target, status=301)
            return
        if path in CLEAN_ROUTE_FILES and path != "/":
            self.path = "/" + CLEAN_ROUTE_FILES[path] + (("?" + parsed.query) if parsed.query else "")
            return super().do_GET()
        if path.startswith("/product/"):
            self.handle_product_page(urllib.parse.unquote(path[len("/product/"):]))
            return
        if path == "/api/settings":
            with db() as conn:
                self.send_json(read_site_settings(conn))
            return
        if path == "/api/products":
            with db() as conn:
                rows = conn.execute("SELECT * FROM products ORDER BY name COLLATE NOCASE").fetchall()
            self.send_json([product_from_row(row) for row in rows])
            return
        if path.startswith("/api/products/"):
            product_id = urllib.parse.unquote(path[len("/api/products/"):])
            with db() as conn:
                row = conn.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
            if not row:
                self.send_json({"error": "Product not found"}, 404)
                return
            self.send_json(product_from_row(row))
            return
        if path == "/api/payments/mpesa/status":
            query = urllib.parse.parse_qs(parsed.query)
            order_id = (query.get("orderId") or query.get("order_id") or [""])[0]
            try:
                self.send_json(checkout_order_status(order_id))
            except Exception as exc:
                self.send_json({"error": str(exc)}, 400)
            return
        if path == "/api/payments/pesapal/status":
            query = urllib.parse.parse_qs(parsed.query)
            tracking_id = (query.get("OrderTrackingId") or query.get("orderTrackingId") or [""])[0]
            reference = (query.get("OrderMerchantReference") or query.get("merchantReference") or [""])[0]
            try:
                self.send_json(update_payment_status(tracking_id, reference))
            except Exception as exc:
                self.send_json({"error": str(exc)}, 400)
            return
        if path == "/api/payments/pesapal/ipn":
            query = urllib.parse.parse_qs(parsed.query)
            tracking_id = (query.get("OrderTrackingId") or [""])[0]
            reference = (query.get("OrderMerchantReference") or [""])[0]
            try:
                self.send_json(update_payment_status(tracking_id, reference) if tracking_id else {"ok": True})
            except Exception as exc:
                self.send_json({"error": str(exc)}, 400)
            return
        if path == "/api/orders":
            user = self.require_user()
            if not user: return
            with db() as conn:
                rows = conn.execute("SELECT * FROM orders ORDER BY created_at DESC").fetchall()
            checkout_rows = {row["id"]: dict(row) for row in conn.execute("SELECT id, payment_provider, payment_method, confirmation_code, mpesa_receipt_number FROM checkout_orders").fetchall()}
            self.send_json([{ "id": r["id"], "customer": r["customer"], "items": r["items"], "fulfillment": r["fulfillment"], "status": r["status"], "statusTone": r["status_tone"], "total": r["total"], "paymentProvider": (checkout_rows.get(r["id"]) or {}).get("payment_provider"), "paymentMethod": (checkout_rows.get(r["id"]) or {}).get("payment_method"), "confirmationCode": (checkout_rows.get(r["id"]) or {}).get("confirmation_code") or (checkout_rows.get(r["id"]) or {}).get("mpesa_receipt_number") } for r in rows])
            return
        if path == "/api/subscribers":
            user = self.require_user()
            if not user: return
            with db() as conn:
                rows = conn.execute("SELECT email, source, created_at FROM subscribers ORDER BY created_at DESC").fetchall()
            self.send_json([dict(row) for row in rows])
            return
        if path == "/api/tasks":
            user = self.require_user()
            if not user: return
            with db() as conn:
                rows = conn.execute("SELECT * FROM tasks ORDER BY id").fetchall()
            self.send_json([{ "id": r["id"], "label": r["label"], "done": bool(r["done"]) } for r in rows])
            return
        if path == "/api/admin/actions":
            user = self.require_user()
            if not user: return
            with db() as conn:
                rows = conn.execute("SELECT * FROM admin_actions ORDER BY created_at DESC LIMIT 100").fetchall()
            self.send_json([dict(row) for row in rows])
            return
        if path == "/api/admin/settings":
            user = self.require_user()
            if not user: return
            with db() as conn:
                self.send_json(read_site_settings(conn))
            return
        if path == "/api/session":
            user = self.session_user()
            self.send_json({"user": {"email": user["email"], "name": user["name"], "provider": user["provider"]} if user else None})
            return
        if path == "/api/auth/google":
            self.handle_google_start()
            return
        if path == "/api/auth/google/callback":
            self.handle_google_callback(parsed)
            return
        return super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        if path == "/api/auth/login":
            payload = self.read_json()
            email = str(payload.get("email") or "").strip().lower()
            password = str(payload.get("password") or "")
            if not email:
                self.send_json({"error": "Email is required"}, 400)
                return
            if not local_login_allowed(email, password):
                self.send_json({"error": "Invalid email or password"}, 401)
                return
            with db() as conn:
                token, user = create_session(conn, email, None, "local")
            self.send_json({"user": {"email": user["email"], "name": user["name"], "provider": user["provider"]}}, extra_headers={"Set-Cookie": self.cookie_header(token)})
            return
        if path == "/api/subscribers":
            try:
                with db() as conn:
                    subscriber = save_subscriber(conn, self.read_json())
                self.send_json({"ok": True, "subscriber": subscriber})
            except (ValueError, TypeError, json.JSONDecodeError) as exc:
                self.send_json({"error": str(exc)}, 400)
            return
        if path == "/api/auth/logout":
            cookie = SimpleCookie(self.headers.get("Cookie"))
            morsel = cookie.get(SESSION_COOKIE)
            with db() as conn:
                if morsel:
                    conn.execute("DELETE FROM sessions WHERE token = ?", (morsel.value,))
            self.send_json({"ok": True}, extra_headers={"Set-Cookie": f"{SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0"})
            return
        if path == "/api/checkout/mpesa":
            try:
                payload = self.read_json()
                order = build_checkout_order(payload)
                customer = payload.get("customer") if isinstance(payload, dict) and isinstance(payload.get("customer"), dict) else {}
                response = initiate_mpesa_stk_push(order, customer.get("mpesaPhone") or customer.get("phone"))
                with db() as conn:
                    save_checkout_order(conn, order, response, status="Payment pending", provider="mpesa")
                    record_action(conn, "checkout", "submit", "checkout_order", order["id"], {"provider": "mpesa", "total": order["total"]})
                self.send_json({"order_id": order["id"], "payment_provider": "mpesa", "payment_status": "Payment pending", "checkout_request_id": response.get("CheckoutRequestID"), "status_url": "/payment-status?" + urllib.parse.urlencode({"orderId": order["id"]})})
            except (ValueError, TypeError, json.JSONDecodeError, RuntimeError) as exc:
                self.send_json({"error": str(exc)}, 400)
            return
        if path == "/api/payments/mpesa/callback":
            try:
                self.send_json(process_mpesa_callback(self.read_json()))
            except Exception as exc:
                self.send_json({"error": str(exc)}, 400)
            return
        if path == "/api/checkout/pesapal":
            try:
                order = build_checkout_order(self.read_json())
                first_name, last_name = split_name(order["customer_name"])
                token = pesapal_token()
                request_payload = {
                    "id": order["id"],
                    "currency": order["currency"],
                    "amount": order["total"],
                    "description": order_description(order),
                    "callback_url": public_base_url() + "/payment-status",
                    "cancellation_url": public_base_url() + "/shop",
                    "notification_id": pesapal_ipn_id(),
                    "branch": "Dévoilé Essentials",
                    "billing_address": {
                        "email_address": order["email"],
                        "phone_number": order["phone"],
                        "country_code": "KE",
                        "first_name": first_name,
                        "middle_name": "",
                        "last_name": last_name,
                        "line_1": order["fulfillment"],
                        "line_2": "",
                        "city": "Nairobi",
                        "state": "",
                        "postal_code": "",
                        "zip_code": ""
                    }
                }
                response = json_http_request(pesapal_base_url() + "/api/Transactions/SubmitOrderRequest", request_payload, pesapal_headers(token))
                if not response.get("redirect_url"):
                    raise RuntimeError(response.get("message") or "PesaPal did not return a checkout URL")
                with db() as conn:
                    save_checkout_order(conn, order, response, status="Payment pending", provider="pesapal")
                    record_action(conn, "checkout", "submit", "checkout_order", order["id"], {"provider": "pesapal", "total": order["total"]})
                self.send_json({"redirect_url": response.get("redirect_url"), "merchant_reference": order["id"], "order_tracking_id": response.get("order_tracking_id")})
            except (ValueError, TypeError, json.JSONDecodeError, RuntimeError) as exc:
                self.send_json({"error": str(exc)}, 400)
            return
        if path == "/api/payments/pesapal/ipn":
            try:
                payload = self.read_json()
                tracking_id = payload.get("OrderTrackingId") or payload.get("orderTrackingId")
                reference = payload.get("OrderMerchantReference") or payload.get("merchantReference")
                self.send_json(update_payment_status(tracking_id, reference) if tracking_id else {"ok": True})
            except Exception as exc:
                self.send_json({"error": str(exc)}, 400)
            return
        if path == "/api/products":
            user = self.require_user()
            if not user: return
            try:
                payload = self.read_json()
                with db() as conn:
                    product = upsert_product(conn, payload)
                    record_action(conn, user["email"], "upsert", "product", product["id"], product)
                self.send_json(product)
            except (ValueError, TypeError, json.JSONDecodeError) as exc:
                self.send_json({"error": str(exc)}, 400)
            return
        if path == "/api/products/reset":
            user = self.require_user()
            if not user: return
            with db() as conn:
                conn.execute("DELETE FROM products")
                for product in DEFAULT_PRODUCTS:
                    upsert_product(conn, product)
                record_action(conn, user["email"], "reset", "product_catalog", None, {})
            self.send_json({"ok": True})
            return
        if path == "/api/admin/settings":
            user = self.require_user()
            if not user: return
            try:
                payload = self.read_json()
                with db() as conn:
                    settings = save_site_settings(conn, payload)
                    record_action(conn, user["email"], "update", "site_settings", None, settings)
                self.send_json(settings)
            except (ValueError, TypeError, json.JSONDecodeError) as exc:
                self.send_json({"error": str(exc)}, 400)
            return
        self.send_json({"error": "Not found"}, 404)

    def do_PUT(self):
        if self.path.startswith("/api/tasks/"):
            user = self.require_user()
            if not user: return
            task_id = int(self.path.rsplit("/", 1)[-1])
            payload = self.read_json()
            with db() as conn:
                conn.execute("UPDATE tasks SET done = ? WHERE id = ?", (int(bool(payload.get("done"))), task_id))
                record_action(conn, user["email"], "update", "task", str(task_id), payload)
            self.send_json({"ok": True})
            return
        self.send_json({"error": "Not found"}, 404)

    def do_DELETE(self):
        if self.path.startswith("/api/products/"):
            user = self.require_user()
            if not user: return
            product_id = urllib.parse.unquote(self.path.rsplit("/", 1)[-1])
            with db() as conn:
                conn.execute("DELETE FROM products WHERE id = ?", (product_id,))
                record_action(conn, user["email"], "delete", "product", product_id, {})
            self.send_json({"ok": True})
            return
        self.send_json({"error": "Not found"}, 404)

    def cookie_header(self, token):
        secure = "; Secure" if os.environ.get("DEVOILE_COOKIE_SECURE") == "1" else ""
        return f"{SESSION_COOKIE}={token}; HttpOnly; SameSite=Lax; Path=/; Max-Age={60*60*24*14}{secure}"

    def redirect(self, target, status=302, headers=None):
        self.send_response(status)
        self.send_header("Location", target)
        for key, value in (headers or {}).items():
            self.send_header(key, value)
        self.end_headers()

    def handle_google_start(self):
        client_id = os.environ.get("GOOGLE_CLIENT_ID")
        redirect_uri = os.environ.get("GOOGLE_REDIRECT_URI")
        parsed = urllib.parse.urlparse(self.path)
        query = urllib.parse.parse_qs(parsed.query)
        return_target = normalize_return_target((query.get("return") or [""])[0])
        if not client_id or not redirect_uri:
            self.redirect("/login?error=google_not_configured&return=" + urllib.parse.quote(return_target))
            return
        state = build_oauth_state(return_target)
        params = urllib.parse.urlencode({
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": "openid email profile",
            "state": state,
            "prompt": "select_account",
        })
        self.redirect("https://accounts.google.com/o/oauth2/v2/auth?" + params, headers={"Set-Cookie": f"google_oauth_state={state}; HttpOnly; SameSite=Lax; Path=/; Max-Age=600"})

    def handle_google_callback(self, parsed):
        client_id = os.environ.get("GOOGLE_CLIENT_ID")
        client_secret = os.environ.get("GOOGLE_CLIENT_SECRET")
        redirect_uri = os.environ.get("GOOGLE_REDIRECT_URI")
        query = urllib.parse.parse_qs(parsed.query)
        code = (query.get("code") or [""])[0]
        state = (query.get("state") or [""])[0]
        cookie = SimpleCookie(self.headers.get("Cookie"))
        expected_state = cookie.get("google_oauth_state")
        return_target = return_target_from_state(state)
        if not client_id or not client_secret or not redirect_uri or not code or not expected_state or expected_state.value != state:
            self.redirect("/login?error=google_login_failed&return=" + urllib.parse.quote(return_target))
            return
        try:
            token_payload = urllib.parse.urlencode({
                "client_id": client_id,
                "client_secret": client_secret,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": redirect_uri,
            }).encode("utf-8")
            req = urllib.request.Request("https://oauth2.googleapis.com/token", data=token_payload, headers={"Content-Type": "application/x-www-form-urlencoded"})
            token_data = json.loads(urllib.request.urlopen(req, timeout=12).read().decode("utf-8"))
            user_req = urllib.request.Request("https://www.googleapis.com/oauth2/v3/userinfo", headers={"Authorization": "Bearer " + token_data["access_token"]})
            profile = json.loads(urllib.request.urlopen(user_req, timeout=12).read().decode("utf-8"))
            email = profile.get("email")
            if not email:
                raise RuntimeError("Google profile did not include email")
            email = email.lower()
            if not google_login_allowed(email):
                raise RuntimeError("Google profile is not authorized for admin access")
            with db() as conn:
                token, user = create_session(conn, email, profile.get("name"), "google")
            self.redirect(return_target, headers={"Set-Cookie": self.cookie_header(token)})
        except Exception:
            self.redirect("/login?error=google_login_failed&return=" + urllib.parse.quote(return_target))


def main():
    init_db()
    port = int(os.environ.get("PORT", "8090"))
    server = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    print(f"Dévoilé app serving on :{port} with SQLite at {DB_PATH}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()

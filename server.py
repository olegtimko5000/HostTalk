from flask import Flask,render_template,request,jsonify,send_from_directory
from flask_socketio import SocketIO,emit,join_room,leave_room
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash, check_password_hash
import webbrowser
import socket
import subprocess
import threading
import platform
import os
import sys
import shutil
import time
import uuid

CERT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cert.pem")
KEY_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "key.pem")

# ---------------------------------------------------------------------------
# Colored console logging
#   green  -> server itself: startup, shutdown, connect/disconnect
#   red    -> site activity: chats (join/leave/message) and calls
#   purple -> file activity: uploads / files sent in chat
#   orange -> critical errors (something actually failed / degraded)
#   yellow -> non-critical warnings (rejected attempts, missing optional info)
#   blue   -> highlighted inline within another color: a chat's name/password
# ---------------------------------------------------------------------------
_GREEN = "\033[92m"
_RED = "\033[91m"
_PURPLE = "\033[95m"
_ORANGE = "\033[38;5;208m"
_YELLOW = "\033[93m"
_BLUE = "\033[94m"
_CYAN = "\033[96m"
_RESET = "\033[0m"

def log_server(msg):
    print(f"{_GREEN}{msg}{_RESET}")

def log_activity(msg):
    print(f"{_RED}{msg}{_RESET}")

def log_file(msg):
    print(f"{_PURPLE}{msg}{_RESET}")

def log_error(msg):
    print(f"{_ORANGE}{msg}{_RESET}")

def log_warning(msg):
    print(f"{_YELLOW}{msg}{_RESET}")

def hl(text, base_color):
    """Highlight a chat name/password in blue within a line of another color."""
    return f"{_BLUE}{text}{_RESET}{base_color}"

def ip_tag(ip, base_color):
    """Highlight a user's IP address in turquoise/cyan within a line of another color."""
    return f"{_CYAN}[{ip}]{_RESET}{base_color}"


def ensure_self_signed_cert():
    """Generate a self-signed HTTPS certificate once, reuse it on later runs.

    eventlet (which Flask-SocketIO uses under the hood) needs real cert/key
    files -- it doesn't understand Werkzeug's ssl_context='adhoc' shortcut.
    """
    if os.path.exists(CERT_PATH) and os.path.exists(KEY_PATH):
        return CERT_PATH, KEY_PATH

    import datetime
    from cryptography import x509
    from cryptography.x509.oid import NameOID
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import rsa

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "HostTalk")])
    now = datetime.datetime.now(datetime.timezone.utc)

    cert = (
        x509.CertificateBuilder()
        .subject_name(name)
        .issuer_name(name)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - datetime.timedelta(days=1))
        .not_valid_after(now + datetime.timedelta(days=3650))
        .add_extension(
            x509.SubjectAlternativeName([x509.DNSName("localhost")]),
            critical=False,
        )
        .sign(key, hashes.SHA256())
    )

    with open(CERT_PATH, "wb") as f:
        f.write(cert.public_bytes(serialization.Encoding.PEM))
    with open(KEY_PATH, "wb") as f:
        f.write(key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption(),
        ))

    log_server(f"│ Generated self-signed certificate: {CERT_PATH}")
    return CERT_PATH, KEY_PATH

if(platform.system()=="Windows"):
    import pystray
    from PIL import Image
    from pystray import MenuItem as dihtem
    import ctypes

HOSTTALK0INFO0VER=1.0

APPDATAAHH=os.getenv("APPDATA")
if APPDATAAHH:
    APPROOT=os.path.join(APPDATAAHH,"HostTalk")
else:
    APPROOT=os.path.join(os.path.expanduser("~"),".hosttalk")
os.makedirs(APPROOT,exist_ok=True)

def exe():
    if getattr(sys,'frozen',False):
        return sys._MEIPASS
    return os.path.dirname(os.path.abspath(__file__))

temp0dih0server=exe()

def packurbagsahh(dih,seconddih):
    # Wipe the destination first so files removed/renamed in the source
    # (old icon versions etc.) can never linger and get served by mistake.
    if os.path.exists(seconddih):
        shutil.rmtree(seconddih)
    os.makedirs(seconddih,exist_ok=True)
    for dihh in os.listdir(dih):
        sdih=os.path.join(dih,dihh)
        ddih=os.path.join(seconddih,dihh)
        if os.path.isdir(sdih):
            shutil.copytree(sdih,ddih,dirs_exist_ok=True)
        else:
            shutil.copy2(sdih,ddih)

packurbagsahh(os.path.join(temp0dih0server,"static"),
              os.path.join(APPROOT,"static"))
packurbagsahh(os.path.join(temp0dih0server,"templates"),
              os.path.join(APPROOT,"templates"))

log_server(f"│ Server files source : {temp0dih0server}")
log_server(f"│ Served from (live)  : {APPROOT}")
_attach_check = os.path.join(APPROOT, "static", "icons")
if os.path.isdir(_attach_check):
    log_server(f"│ Icons currently served: {', '.join(sorted(os.listdir(_attach_check)))}")

if(platform.system()=="Windows"):
    ker=ctypes.WinDLL("kernel32")
    use=ctypes.WinDLL("user32")
    SH=5
    HI=0

    def consolepi():
        return ker.GetConsoleWindow()

    def hideall():
        h=consolepi()
        if(h):
            use.ShowWindow(h,HI)

    def showall():
        h=consolepi()
        if h:
            use.ShowWindow(h,SH)

    def traySH(ic,it):
        if platform.system() == "Windows":
            h=consolepi()
            if h:
                use.ShowWindow(h,SH)

    def trayQU(ic,it):
        try:
            s.stop()
        except:
            pass
        ic.stop()
        os._exit(0)

    def trayIC():
        if platform.system() != "Windows":
            return
        img=Image.open(os.path.join(exe(),'icon.ico'))
        menu=(
            dihtem("show console",traySH),
            dihtem("quit",trayQU)
        )
        icon=pystray.Icon("HostTalk",img,"HostTalk Server",menu)
        icon.run()
else:
    def consolepi():
        return None

ss='Error'
se='Error'
pref0admintoall=True
pref0showall=True
startcommandline=False #remember ur ahh to turn ts to false in production

if startcommandline:
    temp0in0com=input("Press Enter to start server or enter -s to enter command mode... ")
    if temp0in0com.strip()=="":
        pass
    elif temp0in0com=="-s":
        print('Commands activated.')
        print('Enter "settings" to change settings')
        temp0in0call=input()
        if(temp0in0call.lower().strip()=="settings"):
            print("SETTINGS :\n 1 => Admin permission to any user(bool)\n 2 => Show sensitive information in the server console(bool)")
            temp0in0set=input()
            if(temp0in0set.lower().strip()=="1"):
                input("")
        else:
            print('Unknown command. Starting server')
            pass

def cityboii():
    se=socket.socket(socket.AF_INET,socket.SOCK_DGRAM)
    try:
        se.connect(('8.8.8.8',80))
        f=se.getsockname()[0]
    except Exception:
        f='127.0.0.1'
    finally:
        se.close()
    try:
        if(platform.system()=='Windows'):
            ss=subprocess.check_output(['powershell',"-Command","(Get-NetConnectionProfile | Where-object {$_.InterfaceAlias -like '*Wi-Fi*'}).Name"],
                                        text=True).strip()
        elif(platform.system()=="Linux"):
            ss=subprocess.check_output(['iwgetid',"-r"],text=True).strip()
        elif(platform.system()=='Darwin'):
            ss=subprocess.check_output(['/System/Library/PrivateFrameworks/Apple80211.framework/Version/Current/Resources/airport',"-I"],text=True).split(
                'SSID: ')[1].splitlines()[0]
    except Exception as e:
        log_warning(f'Failed to get your ssid | {e}')
        return f,'Failed to get your ssid'
    return f,ss

app=Flask(__name__,template_folder=os.path.join(APPROOT,"templates"),static_folder=os.path.join(APPROOT,"static"))
app.config["AUTH"]="local"

# ---------------------------------------------------------------------------
# File uploads: root/uzer-files/<username>/
# ---------------------------------------------------------------------------
MAX_FILE_SIZE = int(1.35 * 1024 * 1024 * 1024)  # 1.35 GB
UZER_FILES_ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uzer-files")
os.makedirs(UZER_FILES_ROOT, exist_ok=True)
app.config["MAX_CONTENT_LENGTH"] = MAX_FILE_SIZE

IMAGE_EXTS = {"png","jpg","jpeg","gif","webp","bmp","svg"}
VIDEO_EXTS = {"mp4","webm","mov","mkv","avi"}

def safe_username(name):
    name = "".join(c for c in (name or "") if c.isalnum() or c in ("-","_","."))
    name = name.strip(".")
    return name or "unknown"

def file_kind(filename):
    ext = filename.rsplit(".",1)[-1].lower() if "." in filename else ""
    if ext in IMAGE_EXTS:
        return "image"
    if ext in VIDEO_EXTS:
        return "video"
    return "file"

s=SocketIO(app,cors_allowed_origins="*")

# ---------------------------------------------------------------------------
# Multi-room chat state
# ---------------------------------------------------------------------------
MAX_HISTORY = 50

rooms_data = {}      # room_name -> list of message dicts (history, capped)
sid_rooms = {}        # sid -> { room_name: display_name }  (rooms this connection is in)
rooms_meta = {}        # room_name -> {"has_password": bool, "password_hash": str|None, "created_by": str}
call_participants = {}  # room_name -> {sid: name}  (who is currently in the voice/video call)
sid_ips = {}            # sid -> real client ip (resolved once, on connect)


def get_client_ip():
    """Best-effort real client IP, even behind a reverse proxy/tunnel like ngrok."""
    xff = request.headers.get("X-Forwarded-For", "")
    if xff:
        # X-Forwarded-For can be a chain "client, proxy1, proxy2" -- first entry is the client
        return xff.split(",")[0].strip()
    real_ip = request.headers.get("X-Real-IP", "")
    if real_ip:
        return real_ip.strip()
    return request.remote_addr or "unknown"


def ip_for(sid):
    return sid_ips.get(sid, "unknown")


def get_room_messages(room):
    return rooms_data.setdefault(room, [])


def push_room_message(room, msg):
    msgs = get_room_messages(room)
    msgs.append(msg)
    rooms_data[room] = msgs[-MAX_HISTORY:]
    return msg


def display_name_for(sid):
    """Best-effort name for logging / admin checks (first room the sid is in)."""
    rooms = sid_rooms.get(sid, {})
    if rooms:
        return next(iter(rooms.values()))
    return sid


@app.route('/',methods=["GET"])
def w():
    return render_template('index.html')


@s.on("connect")
def on_connect():
    sid_rooms[request.sid] = {}
    ip = get_client_ip()
    sid_ips[request.sid] = ip
    log_server(f"│ User connected ({request.sid}) {ip_tag(ip, _GREEN)}")


@s.on("create_room")
def on_create_room(data):
    data = data or {}
    room = (data.get("room") or "").strip()
    name = (data.get("name") or "").strip()
    password = (data.get("password") or "").strip()
    has_password = bool(data.get("has_password")) and bool(password)
    sid = request.sid

    if not room or not name:
        emit("create_error", {"error": "Назва чату та ваше ім'я обов'язкові.", "room": room})
        log_warning("│ Rejected create_room: missing room name or username")
        return
    if len(room) > 40 or len(name) > 30:
        emit("create_error", {"error": "Назва чату або ім'я закороткі/задовгі.", "room": room})
        log_warning(f"│ Rejected create_room: room/name too long ('{hl(room, _YELLOW)}')")
        return
    if room in rooms_meta:
        emit("create_error", {"error": "Чат з такою назвою вже існує. Скористайтесь 'Приєднатись'.", "room": room})
        log_warning(f"│ {name} tried to create chat '{hl(room, _YELLOW)}' but it already exists")
        return

    rooms_meta[room] = {
        "has_password": has_password,
        "password_hash": generate_password_hash(password) if has_password else None,
        "created_by": name,
    }

    stamp = time.strftime("%H:%M:%S")
    if has_password:
        log_activity(f"│ [{stamp}] {name} {ip_tag(ip_for(sid), _RED)} created chat '{hl(room, _RED)}' (password: {hl(password, _RED)})")
    else:
        log_activity(f"│ [{stamp}] {name} {ip_tag(ip_for(sid), _RED)} created chat '{hl(room, _RED)}' (no password)")

    _enter_room(sid, room, name)


@s.on("join_room")
def on_join_room(data):
    data = data or {}
    room = (data.get("room") or "").strip()
    name = (data.get("name") or "").strip()
    password = (data.get("password") or "").strip()
    sid = request.sid

    if not room or not name:
        emit("join_error", {"error": "Room name and your name are both required.", "room": room})
        log_warning("│ Rejected join_room: missing room name or username")
        return
    if len(room) > 40 or len(name) > 30:
        emit("join_error", {"error": "Room or name is too long.", "room": room})
        log_warning(f"│ Rejected join_room: room/name too long ('{hl(room, _YELLOW)}')")
        return

    meta = rooms_meta.get(room)
    if not meta:
        emit("join_error", {"error": "Такого чату не існує. Створіть його спочатку.", "room": room})
        log_warning(f"│ {name} tried to join non-existent chat '{hl(room, _YELLOW)}'")
        return
    if meta["has_password"] and not check_password_hash(meta["password_hash"], password):
        emit("join_error", {"error": "Невірний пароль.", "room": room})
        log_warning(f"│ {name} entered wrong password for chat '{hl(room, _YELLOW)}' (tried: {hl(password, _YELLOW)})")
        return

    user_rooms = sid_rooms.setdefault(sid, {})
    if room in user_rooms:
        emit("join_error", {"error": "You're already in that chat.", "room": room})
        log_warning(f"│ {name} tried to re-join chat '{hl(room, _YELLOW)}' they're already in")
        return

    _enter_room(sid, room, name)


def _enter_room(sid, room, name):
    """Shared logic: actually place a connection into a room's socket.io group."""
    join_room(room)
    sid_rooms.setdefault(sid, {})[room] = name

    # Send existing history to the person who just joined (only to them)
    emit("history", {"room": room, "messages": get_room_messages(room)})

    system_msg = {"system": True, "name": None, "msg": f"{name} joined the chat", "ts": time.time()}
    push_room_message(room, system_msg)
    emit("message", dict(system_msg, room=room), room=room, include_self=False)
    emit("joined", {"room": room, "name": name})

    log_activity(f"│ {name} {ip_tag(ip_for(sid), _RED)} joined room '{hl(room, _RED)}'")


@s.on("leave_room")
def on_leave_room(data):
    data = data or {}
    room = (data.get("room") or "").strip()
    sid = request.sid
    user_rooms = sid_rooms.get(sid, {})
    name = user_rooms.pop(room, None)
    if not name:
        return

    leave_room(room)
    _leave_call(sid, room, notify=True)
    system_msg = {"system": True, "name": None, "msg": f"{name} left the chat", "ts": time.time()}
    push_room_message(room, system_msg)
    emit("message", dict(system_msg, room=room), room=room)
    log_activity(f"│ {name} {ip_tag(ip_for(sid), _RED)} left room '{hl(room, _RED)}'")


@s.on("message")
def on_message(data):
    data = data or {}
    room = (data.get("room") or "").strip()
    text = (data.get("msg") or "").strip()
    sid = request.sid

    name = sid_rooms.get(sid, {}).get(room)
    if not name or not text:
        return
    if len(text) > 2000:
        text = text[:2000]

    m = {"system": False, "name": name, "msg": text, "ts": time.time()}
    push_room_message(room, m)
    emit("message", dict(m, room=room), room=room)

    if pref0showall:
        stamp = time.strftime("%H:%M:%S")
        log_activity(f'│ [{stamp}] [{hl(room, _RED)}] {name} {ip_tag(ip_for(sid), _RED)}: {text}')
    else:
        log_activity(f"│ [{hl(room, _RED)}] {name} {ip_tag(ip_for(sid), _RED)} sent a message")


@s.on("file_message")
def on_file_message(data):
    data = data or {}
    room = (data.get("room") or "").strip()
    sid = request.sid

    name = sid_rooms.get(sid, {}).get(room)
    url = data.get("url")
    filename = data.get("filename")
    if not name or not url or not filename:
        return

    m = {
        "system": False,
        "name": name,
        "msg": None,
        "ts": time.time(),
        "file": {
            "url": url,
            "filename": filename,
            "kind": data.get("kind", "file"),
            "size": data.get("size"),
        },
    }
    push_room_message(room, m)
    emit("message", dict(m, room=room), room=room)

    stamp = time.strftime("%H:%M:%S")
    log_file(f'│ [{stamp}] [{hl(room, _PURPLE)}] {name} {ip_tag(ip_for(sid), _PURPLE)} sent a file: {filename}')


def _leave_call(sid, room, notify=True):
    participants = call_participants.get(room)
    if not participants or sid not in participants:
        return
    del participants[sid]
    if not participants:
        call_participants.pop(room, None)
    if notify:
        emit("call_user_left", {"room": room, "sid": sid}, room=room)


@s.on("call_join")
def on_call_join(data):
    data = data or {}
    room = (data.get("room") or "").strip()
    sid = request.sid
    name = sid_rooms.get(sid, {}).get(room)
    if not name:
        return

    existing = call_participants.setdefault(room, {})
    others = [{"sid": psid, "name": pname} for psid, pname in existing.items()]
    existing[sid] = name

    emit("call_participants", {"room": room, "participants": others})
    emit("call_user_joined", {"room": room, "sid": sid, "name": name}, room=room, include_self=False)

    stamp = time.strftime("%H:%M:%S")
    log_activity(f"│ [{stamp}] {name} {ip_tag(ip_for(sid), _RED)} joined the call in '{hl(room, _RED)}'")


@s.on("call_leave")
def on_call_leave(data):
    data = data or {}
    room = (data.get("room") or "").strip()
    sid = request.sid
    name = sid_rooms.get(sid, {}).get(room, sid)
    _leave_call(sid, room, notify=True)
    stamp = time.strftime("%H:%M:%S")
    log_activity(f"│ [{stamp}] {name} {ip_tag(ip_for(sid), _RED)} left the call in '{hl(room, _RED)}'")


@s.on("call_signal")
def on_call_signal(data):
    """Relay WebRTC offer/answer/ICE-candidate messages directly between two peers."""
    data = data or {}
    to_sid = data.get("to")
    room = (data.get("room") or "").strip()
    sid = request.sid
    name = sid_rooms.get(sid, {}).get(room)
    if not name or not to_sid:
        return
    payload = dict(data)
    payload["from"] = sid
    payload["fromName"] = name
    emit("call_signal", payload, room=to_sid)


@s.on("disconnect")
def on_disconnect():
    sid = request.sid
    ip = ip_for(sid)
    user_rooms = sid_rooms.pop(sid, {})
    for room, name in user_rooms.items():
        leave_room(room)
        _leave_call(sid, room, notify=True)
        system_msg = {"system": True, "name": None, "msg": f"{name} disconnected", "ts": time.time()}
        push_room_message(room, system_msg)
        emit("message", dict(system_msg, room=room), room=room)
    log_server(f"│ User disconnected ({sid}) {ip_tag(ip, _GREEN)}")
    sid_ips.pop(sid, None)


@app.route('/upload', methods=['POST'])
def upload_file():
    username = safe_username(request.form.get('name'))
    room = (request.form.get('room') or '').strip()
    f = request.files.get('file')

    if not f or f.filename == '' or not room:
        log_warning(f"│ Rejected file upload from '{username}': missing file or room")
        return jsonify({"error": "Файл, ім'я та назва групи обов'язкові"}), 400

    user_dir = os.path.join(UZER_FILES_ROOT, username)
    os.makedirs(user_dir, exist_ok=True)

    original_name = secure_filename(f.filename) or "file"
    unique_name = f"{uuid.uuid4().hex}_{original_name}"
    save_path = os.path.join(user_dir, unique_name)
    f.save(save_path)

    size = os.path.getsize(save_path)

    return jsonify({
        "url": f"/uzer-files/{username}/{unique_name}",
        "filename": original_name,
        "kind": file_kind(original_name),
        "size": size,
    })


@app.route('/uzer-files/<username>/<path:filename>')
def serve_user_file(username, filename):
    username = safe_username(username)
    user_dir = os.path.join(UZER_FILES_ROOT, username)
    return send_from_directory(user_dir, filename)


@app.route('/api/ip')
def ip():
    ip,ssid=cityboii()
    return jsonify({"ip": ip,
                     "ssid":ssid})


@s.on("shut")
#yo fix ts before uploadin to github
def off():
    name = display_name_for(request.sid)
    if pref0admintoall:
        log_server(f"│ {name} shut down the server.")
        s.stop()
    else:
        log_warning(f"│ {name} tried to shut down the server.")
        log_warning(f"│ Permission denied. {name} doesnt have the permission to shut down the server down")
        log_warning(f"│ Turn on 'Admin to all' to give permission to {name} shut down the server down")


if __name__=='__main__':
    if platform.system()=="Windows":
        if consolepi():
            hideall()
        threading.Thread(target=trayIC,daemon=True).start()

    print(
        f"""
{_GREEN}`7MMF'      `7MMF'                  mm    MMP""MM""YMM        `7MM  `7MM
  MM          MM                    MM    P'   MM   `7          MM    MM
  MM          MM   ,pW"Wq. ,pP"Ybd mmMMmm      MM      ,6"Yb.    MM    MM  ,MP'
  MMmmmmmmMM   MM  6W'   `Wb8I   `"  MM        MM     8)   MM    MM    MM ;Y
  MM          MM  8M     M8`YMMMa.  MM        MM      ,pm9MM    MM    MM;Mm
  MM          MM  YA.   ,A9L.   I8  MM        MM     8M   MM    MM    MM `Mb.
.JMML.      .JMML. `Ybmd9' M9mmmP'  `Mbmo   .JMML.   `Moo9^Yo..JMML..JMML. YA.

{HOSTTALK0INFO0VER}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━{_RESET}
""")
    sss,ssss=cityboii()

    try:
        cert_path, key_path = ensure_self_signed_cert()
        ssl_kwargs = {"certfile": cert_path, "keyfile": key_path}
        scheme = "https"
    except Exception as e:
        log_error(f"│ WARNING: couldn't set up HTTPS ({e}). Falling back to plain HTTP —")
        log_error(f"│ mic/camera access will only work for the host (localhost).")
        ssl_kwargs = {}
        scheme = "http"

    log_server(f"│ Server : running ({'HTTPS, self-signed certificate' if scheme == 'https' else 'HTTP'})")
    log_server(f"│ Local access : {scheme}://127.0.0.1:6767/")
    log_server(f"│ Lan access (other devices/wifi): {scheme}://{sss}:6767/")
    log_server(f"│ Wifi SSID : {ssss}")
    log_server(" ")
    if scheme == "https":
        log_server("│ ПЕРШИЙ РАЗ браузер покаже попередження 'З'єднання не приватне' —")
        log_server("│ це нормально (самопідписаний сертифікат). Тисни 'Додатково' -> 'Перейти на сайт'.")
        log_server(" ")
    log_server(f"│ Opening : {scheme}://{sss}:6767/")
    try:
        webbrowser.open_new_tab(f'{scheme}://{sss}:6767/')
    except Exception:
        pass
    print('')

    s.run(app,host="0.0.0.0",port=6767,debug=False,**ssl_kwargs)

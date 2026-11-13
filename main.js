// RamGroupTalk — 카톡 단톡방 자동 저장·정리 위젯 (만든 사람: 김예람)
const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, shell, screen, dialog, globalShortcut, safeStorage, Notification, powerMonitor } = require("electron");
const http = require("http");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const { execFile } = require("child_process");
let autoUpdater = null;
try { autoUpdater = require("electron-updater").autoUpdater; } catch {}

if (!app.requestSingleInstanceLock()) { app.quit(); }
app.setName("RamGroupTalk");
if (process.platform === "win32") app.setAppUserModelId("com.yeram.ramgrouptalk");

const DATA_DIR = app.getPath("userData");
const DATA_FILE = path.join(DATA_DIR, "data.json");
const CONF_FILE = path.join(DATA_DIR, "settings.json");
const DEFAULT_CONF = {
  rooms: [],
  geminiKey: "",
  model: "gemini-flash-latest",
  dailyTime: "",
  exportDir: path.join(app.getPath("documents"), "RamGroupTalk 대화 저장"),
  alwaysOnTop: false,
  closeToTray: false,
  openAtLogin: true,
  bounds: null,
  lastAuto: ""
};

function readJson(f, d) { try { return JSON.parse(fs.readFileSync(f, "utf8").replace(/^\uFEFF/, "")); } catch { return d; } }  // PowerShell이 붙이는 BOM 제거
function writeJson(f, v) { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f + ".tmp", JSON.stringify(v)); fs.renameSync(f + ".tmp", f); }
let conf = { ...DEFAULT_CONF, ...readJson(CONF_FILE, {}) };
const saveConf = () => writeJson(CONF_FILE, conf);

let win = null, tray = null, quitting = false;

// ---------- 앱 아이콘 (설정에서 6가지 중 고르기, 1번이 기본) ----------
const iconNo = () => { const n = +conf.appIcon; return n >= 1 && n <= 6 ? n : 1; };
const iconFile = () => path.join(__dirname, "renderer", "icons", `icon${iconNo()}.ico`);
// 바로가기·작업 표시줄은 실제 파일이 필요해서(asar 안은 못 읽음) 사용자 폴더에 복사해 씀
function iconDiskPath() {
  if (iconNo() === 1 && app.isPackaged) return process.execPath;
  const dst = path.join(DATA_DIR, `appicon${iconNo()}.ico`);
  try { if (!fs.existsSync(dst)) { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(dst, fs.readFileSync(iconFile())); } } catch {}
  return dst;
}
function setTasks() {
  if (process.platform !== "win32" || !app.isPackaged) return;
  const ic = iconDiskPath();
  app.setUserTasks([
    { program: process.execPath, arguments: "--run-export", iconPath: ic, iconIndex: 0, title: "지금 카톡 가져오기", description: "설정한 단톡방을 저장하고 정리해요" },
    { program: process.execPath, arguments: "--open-folder", iconPath: ic, iconIndex: 0, title: "저장 폴더 열기", description: "카톡 대화가 저장된 폴더를 열어요" },
    { program: process.execPath, arguments: "--check-update", iconPath: ic, iconIndex: 0, title: "업데이트 확인", description: "새 버전이 있는지 확인해요" }
  ]);
}
function applyAppIcon(force) {
  const img = nativeImage.createFromPath(iconFile());
  if (!img.isEmpty()) { if (win) win.setIcon(img); if (tray) tray.setImage(img.resize({ width: 16, height: 16 })); }
  if (process.platform !== "win32" || !app.isPackaged) return;
  const ic = iconDiskPath();
  try { if (win) win.setAppDetails({ appId: "com.yeram.ramgrouptalk", appIconPath: ic, appIconIndex: 0, relaunchDisplayName: "RamGroupTalk" }); } catch {}
  setTasks();
  const ad = process.env.APPDATA || "";
  const links = [path.join(app.getPath("desktop"), "RamGroupTalk.lnk"),
    path.join(ad, "Microsoft", "Windows", "Start Menu", "Programs", "RamGroupTalk.lnk"),
    path.join(ad, "Microsoft", "Internet Explorer", "Quick Launch", "User Pinned", "TaskBar", "RamGroupTalk.lnk")];
  let changed = false;
  for (const l of links) {
    try {
      if (!fs.existsSync(l)) continue;
      const cur = shell.readShortcutLink(l);
      if ((cur.icon || cur.target) !== ic) { shell.writeShortcutLink(l, "update", { icon: ic, iconIndex: 0 }); changed = true; }
    } catch {}
  }
  if (changed || force) execFile(path.join(process.env.WINDIR || "C:\\Windows", "System32", "ie4uinit.exe"), ["-show"], { windowsHide: true }, () => {});
}

function createWindow() {
  const wa = screen.getPrimaryDisplay().workArea;
  const b = conf.bounds || { width: 1100, height: 760, x: wa.x + wa.width - 1120, y: wa.y + 20 };
  win = new BrowserWindow({
    ...b, minWidth: 420, minHeight: 360, frame: false, show: false,
    backgroundColor: "#f6f7f9", alwaysOnTop: conf.alwaysOnTop, title: "RamGroupTalk", icon: iconFile(),
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false }
  });
  if (process.platform === "win32") { try { win.setAppDetails({ appId: "com.yeram.ramgrouptalk", appIconPath: iconDiskPath(), appIconIndex: 0, relaunchDisplayName: "RamGroupTalk" }); } catch {} }
  win.loadFile(path.join(__dirname, "renderer", "index.html"));
  win.once("ready-to-show", () => { if (conf.reopenHidden) { conf.reopenHidden = false; saveConf(); } else win.show(); });
  win.on("focus", () => { if (Date.now() - lastSync > 30000) scheduleSync(500); });
  const remember = () => { if (!win.isMinimized() && !win.isMaximized()) { conf.bounds = win.getBounds(); saveConf(); } };
  win.on("moved", remember); win.on("resized", remember);
  win.on("close", e => { if (!quitting && conf.closeToTray) { e.preventDefault(); win.hide(); } else { quitting = true; } });
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: "deny" }; });
  win.webContents.on("will-navigate", (e, url) => { if (!url.startsWith("file:")) { e.preventDefault(); shell.openExternal(url); } });
}

function trayMenu() {
  if (!tray) return;
  tray.setContextMenu(Menu.buildFromTemplate([
    ...(updReady ? [{ label: `새 버전 ${updReady} — 지금 업데이트`, click: () => installUpdate() }, { type: "separator" }] : []),
    { label: "열기", click: () => { win.show(); win.focus(); } },
    { label: "지금 카톡 가져오기", click: () => { win.show(); win.webContents.send("run-export"); } },
    { label: "가져오기 중단", click: () => cancelExport() },
    { label: "저장 폴더 열기", click: () => { fs.mkdirSync(conf.exportDir, { recursive: true }); shell.openPath(conf.exportDir); } },
    { type: "separator" },
    { label: "업데이트 확인", click: () => checkUpdate(true) },
    { label: "버전 " + app.getVersion(), enabled: false },
    { type: "separator" },
    { label: "끝내기", click: () => { quitting = true; app.quit(); } }
    ]));
  tray.setToolTip(updReady ? `RamGroupTalk — 새 버전 ${updReady} 준비됨` : "RamGroupTalk");
}
function createTray() {
  const icon = nativeImage.createFromPath(iconFile());
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon.resize({ width: 16, height: 16 }));
  if (icon.isEmpty()) app.getFileIcon(process.execPath, { size: "small" }).then(i => tray.setImage(i)).catch(() => {});
  tray.setToolTip("RamGroupTalk");
  trayMenu();

  tray.on("click", () => { win.isVisible() ? win.focus() : win.show(); });
}

// ---------- 카톡 자동 저장 (PowerShell UI 자동화) ----------
function scriptPath() {
  const p1 = path.join(process.resourcesPath || "", "scripts", "kakao_export.ps1");
  return fs.existsSync(p1) ? p1 : path.join(__dirname, "scripts", "kakao_export.ps1");
}
const STOP_FILE = path.join(DATA_DIR, "export-stop.flag");
let exportProc = null, killT = null;
function cancelExport() {
  if (!exportProc) return false;
  try { fs.writeFileSync(STOP_FILE, "stop"); } catch {}
  const pid = exportProc.pid;
  killT = setTimeout(() => { if (exportProc && exportProc.pid === pid) execFile("taskkill", ["/PID", String(pid), "/T", "/F"], { windowsHide: true }, () => {}); }, 6000);
  return true;
}
function runExport(only) {
  const list = Array.isArray(only) && only.length ? only.map(String) : conf.rooms;
  return new Promise(resolve => {
    if (process.platform !== "win32") return resolve({ ok: false, error: "윈도우에서만 쓸 수 있어요" });
    if (!list.length) return resolve({ ok: false, error: "설정에서 가져올 단톡방 이름을 먼저 넣어 주세요" });
    fs.mkdirSync(conf.exportDir, { recursive: true });
    const roomsFile = path.join(DATA_DIR, "rooms.json");
    fs.writeFileSync(roomsFile, JSON.stringify(list), "utf8");
    const startedAt = Date.now();
    const resultFile = path.join(DATA_DIR, "export-result.json");
    try { fs.unlinkSync(resultFile); } catch {}
    try { fs.unlinkSync(STOP_FILE); } catch {}
    try { globalShortcut.register("CommandOrControl+Shift+Q", () => cancelExport()); } catch {}
    exportProc = execFile("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-STA", "-File", scriptPath(),
      "-RoomsFile", roomsFile, "-OutDir", conf.exportDir, "-ResultFile", resultFile, "-StopFile", STOP_FILE],
      { windowsHide: true, timeout: 60 * 60 * 1000 }, (err) => {
        exportProc = null; clearTimeout(killT); try { globalShortcut.unregister("CommandOrControl+Shift+Q"); } catch {}
        const res = readJson(resultFile, null);
        if (res) { try { fs.writeFileSync(path.join(conf.exportDir, "가져오기-기록.txt"), [new Date().toLocaleString("ko-KR"), ...(res.errors || []).map(e => "오류: " + e.room + " - " + e.msg), ...(res.debug || [])].join("\r\n"), "utf8"); } catch {} return resolve({ ok: true, ...res }); }
        // 결과 파일이 없어도 이번에 저장된 txt가 있으면 그걸로 진행
        let files = [];
        try { files = fs.readdirSync(conf.exportDir).filter(n => /\.txt$/i.test(n)).map(n => path.join(conf.exportDir, n)).filter(p => fs.statSync(p).mtimeMs >= startedAt - 5000); } catch {}
        if (files.length) return resolve({ ok: true, saved: files.map(p => ({ room: path.basename(p).replace(/^KakaoTalk_|_\d{8}_\d{6}\.txt$/g, ""), path: p })), errors: [] });
        resolve({ ok: false, error: err ? String(err.message || err).split("\n").pop().slice(0, 200) || "가져오기가 중간에 멈췄어요" : "결과를 읽지 못했어요" });
      });
  });
}

// ---------- 제미나이 요약 ----------
async function gemini(prompt) {
  if (!conf.geminiKey) { const e = new Error("no_key"); e.code = "no_key"; throw e; }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(conf.model || "gemini-flash-latest")}:generateContent?key=${encodeURIComponent(conf.geminiKey)}`;
  const r = await fetch(url, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.2 } })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error((j.error && j.error.message) || ("HTTP " + r.status));
    e.code = r.status === 429 ? "rate_limited" : (r.status === 400 || r.status === 403) ? "bad_key" : "upstream_error";
    throw e;
  }
  const text = (((j.candidates || [])[0] || {}).content || {}).parts?.map(p => p.text || "").join("") || "";
  const m = text.match(/\[[\s\S]*\]/);
  try { return JSON.parse(m ? m[0] : text); } catch { const e = new Error("invalid_json"); e.code = "invalid_json"; throw e; }
}

// ---------- IPC ----------
ipcMain.handle("data:load", () => readJson(DATA_FILE, {}));
ipcMain.handle("data:save", (_e, docs) => { writeJson(DATA_FILE, docs); scheduleSync(4000); return true; });
ipcMain.handle("conf:get", () => ({ ...conf, gRefresh: undefined, gClientSecret: undefined, geminiKey: conf.geminiKey ? "••••" + conf.geminiKey.slice(-4) : "", hasKey: !!conf.geminiKey }));
ipcMain.handle("conf:set", (_e, patch) => {
  if (patch.geminiKey === undefined || String(patch.geminiKey).startsWith("••••")) delete patch.geminiKey;
  delete patch.gRefresh;
  const iconChanged = patch.appIcon !== undefined && +patch.appIcon !== iconNo();
  conf = { ...conf, ...patch };
  saveConf();
  if (iconChanged) applyAppIcon(true);
  if (patch.autoApply === true && updReady) startAutoApply();
  if (win) win.setAlwaysOnTop(!!conf.alwaysOnTop);
  if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: !!conf.openAtLogin });
  return true;
});
ipcMain.handle("folder:pick", async (_e, cur) => {
  const r = await dialog.showOpenDialog(win, { title: "대화 저장 폴더 고르기", defaultPath: cur || conf.exportDir, properties: ["openDirectory", "createDirectory"] });
  return r.canceled || !r.filePaths[0] ? "" : r.filePaths[0];
});
ipcMain.handle("app:ver", () => app.getVersion());
ipcMain.handle("export:run", (_e, only) => runExport(only));
ipcMain.handle("export:cancel", () => cancelExport());
ipcMain.handle("file:read", (_e, p) => fs.readFileSync(p, "utf8"));
ipcMain.handle("ai:json", async (_e, prompt) => {
  try { return { ok: true, value: await gemini(prompt) }; }
  catch (e) { return { ok: false, code: e.code || "upstream_error", message: String(e.message || e) }; }
});
ipcMain.handle("key:test", async (_e, key, model) => {
  const k = String(key || "").startsWith("••••") ? conf.geminiKey : String(key || "").trim();
  if (!k) return { ok: false, code: "bad_key", message: "" };
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model || conf.model || "gemini-flash-latest")}:generateContent?key=${encodeURIComponent(k)}`;
  try {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "ok" }] }], generationConfig: { maxOutputTokens: 5 } }) });
    if (r.ok || r.status === 429) { conf.geminiKey = k; saveConf(); }
    if (r.ok) return { ok: true, masked: "••••" + k.slice(-4) };
    const j = await r.json().catch(() => ({}));
    return { ok: false, code: r.status === 429 ? "rate_limited" : (r.status === 400 || r.status === 403) ? "bad_key" : "upstream_error", message: (j.error && j.error.message) || ("HTTP " + r.status) };
  } catch (e) { return { ok: false, code: "network", message: "인터넷 연결을 확인해 주세요" }; }
});
ipcMain.handle("backup:export", async () => {
  const d = new Date(), stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const r = await dialog.showSaveDialog(win, { defaultPath: path.join(app.getPath("documents"), `RamGroupTalk-백업-${stamp}.json`), filters: [{ name: "백업", extensions: ["json"] }] });
  if (r.canceled || !r.filePath) return { ok: false };
  fs.writeFileSync(r.filePath, JSON.stringify({ ramgrouptalk: "backup", version: 1, docs: readJson(DATA_FILE, {}) }, null, 1), "utf8");
  return { ok: true };
});

// ---------- 구글 캘린더 (Ram Calendar와 같은 방식: PKCE + 루프백 로그인, 알림 없이 등록) ----------
const GAPI = "https://www.googleapis.com/calendar/v3";
const GSCOPE = "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/drive.appdata";
let GBUILTIN = { clientId: "", clientSecret: "" };
try { GBUILTIN = { ...GBUILTIN, ...JSON.parse(fs.readFileSync(path.join(__dirname, "creds.json"), "utf8").replace(/^﻿/, "")) }; } catch {}
const gId = () => conf.gClientId || GBUILTIN.clientId;
const gSecret = () => (conf.gClientId ? conf.gClientSecret : GBUILTIN.clientSecret);
function encS(s) { if (!s) return ""; try { if (safeStorage.isEncryptionAvailable()) return "enc:" + safeStorage.encryptString(s).toString("base64"); } catch {} return "raw:" + Buffer.from(s).toString("base64"); }
function decS(s) { if (!s) return ""; try { if (s.startsWith("enc:")) return safeStorage.decryptString(Buffer.from(s.slice(4), "base64")); if (s.startsWith("raw:")) return Buffer.from(s.slice(4), "base64").toString(); } catch {} return ""; }
const b64url = b => b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
let gAccess = null, gExp = 0;
function gLogin() {
  return new Promise((resolve, reject) => {
    if (!gId() || !gSecret()) return reject(Object.assign(new Error("구글 연결 키가 없어요"), { code: "NO_CLIENT" }));
    const verifier = b64url(crypto.randomBytes(32));
    const challenge = b64url(crypto.createHash("sha256").update(verifier).digest());
    const state = b64url(crypto.randomBytes(12));
    let done = false;
    const page = m => `<!doctype html><meta charset="utf-8"><title>RamGroupTalk</title><body style="font-family:'Malgun Gothic',sans-serif;padding:40px;font-size:18px">${m}</body>`;
    const server = http.createServer(async (req, res) => {
      const u = new URL(req.url, "http://127.0.0.1");
      if (u.pathname !== "/") { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      const code = u.searchParams.get("code");
      if (u.searchParams.get("error") || !code || u.searchParams.get("state") !== state) { res.end(page("연결이 취소됐어요. RamGroupTalk에서 다시 시도해 주세요.")); return finish(new Error("LOGIN_FAILED")); }
      try {
        const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ code, client_id: gId(), client_secret: gSecret(), redirect_uri: `http://127.0.0.1:${server.address().port}`, grant_type: "authorization_code", code_verifier: verifier }) });
        const j = await r.json();
        if (!r.ok || !j.refresh_token) throw new Error(j.error_description || j.error || "NO_REFRESH_TOKEN");
        conf.gRefresh = encS(j.refresh_token); saveConf();
        gAccess = j.access_token; gExp = Date.now() + (j.expires_in - 60) * 1000;
        res.end(page("✅ 구글 캘린더 연결 완료! 이 창을 닫고 RamGroupTalk으로 돌아가세요."));
        finish(null);
      } catch (e) { res.end(page("연결 중 문제가 생겼어요: " + String(e.message).replace(/</g, "&lt;"))); finish(e); }
    });
    const timer = setTimeout(() => finish(new Error("TIMEOUT")), 5 * 60 * 1000);
    function finish(e) { if (done) return; done = true; clearTimeout(timer); setTimeout(() => server.close(), 500); if (win) { win.show(); win.focus(); } e ? reject(e) : resolve(true); }
    server.listen(0, "127.0.0.1", () => {
      shell.openExternal("https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({ client_id: gId(), redirect_uri: `http://127.0.0.1:${server.address().port}`,
        response_type: "code", scope: GSCOPE, access_type: "offline", prompt: "consent", code_challenge: challenge, code_challenge_method: "S256", state }));
    });
  });
}
async function gToken() {
  if (gAccess && Date.now() < gExp) return gAccess;
  const rt = decS(conf.gRefresh);
  if (!rt) throw Object.assign(new Error("구글 캘린더가 연결돼 있지 않아요"), { code: "NOT_LOGGED_IN" });
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: gId(), client_secret: gSecret(), refresh_token: rt, grant_type: "refresh_token" }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { if (j.error === "invalid_grant") { conf.gRefresh = ""; saveConf(); throw Object.assign(new Error("연결이 만료됐어요. 다시 연결해 주세요."), { code: "NOT_LOGGED_IN" }); } throw new Error(j.error_description || j.error || "토큰 갱신 실패"); }
  gAccess = j.access_token; gExp = Date.now() + (j.expires_in - 60) * 1000; return gAccess;
}
async function gApi(method, p, query, body) {
  const t = await gToken();
  const r = await fetch(GAPI + p + (query ? "?" + new URLSearchParams(query) : ""), { method, headers: { Authorization: "Bearer " + t, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  if (r.status === 204) return null;
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { if (r.status === 401) gAccess = null; throw new Error((j.error && j.error.message) || ("HTTP " + r.status)); }
  return j;
}
const wrap = f => async (...a) => { try { return { ok: true, value: await f(...a) } } catch (e) { return { ok: false, code: e.code || "ERR", message: String(e.message || e) }; } };
ipcMain.handle("gcal:status", () => ({ sync: syncState, syncedAt: lastSync, connected: !!conf.gRefresh, hasKey: !!(gId() && gSecret()), custom: !!conf.gClientId }));
ipcMain.handle("gcal:login", wrap(async () => { await gLogin(); scheduleSync(300); return true; }));
ipcMain.handle("gcal:logout", () => { const rt = decS(conf.gRefresh); if (rt) fetch("https://oauth2.googleapis.com/revoke?token=" + encodeURIComponent(rt), { method: "POST" }).catch(() => {}); conf.gRefresh = ""; gAccess = null; saveConf(); return true; });
// 같은 날 같은 제목 일정이 이미 있으면 새로 만들지 않음
ipcMain.handle("gcal:add", wrap(async (_e, body) => {
  const day = (body.start.date || body.start.dateTime.slice(0, 10));
  const tMin = new Date(day + "T00:00:00+09:00"), tMax = new Date(tMin.getTime() + 86400000);
  const found = await gApi("GET", "/calendars/primary/events", { q: body.summary.replace(/^\S+?\]\s*/, "").slice(0, 40), timeMin: tMin.toISOString(), timeMax: tMax.toISOString(), singleEvents: "true", maxResults: "20" });
  const dup = (found.items || []).find(e => (e.summary || "") === body.summary);
  if (dup) return { duplicate: true, link: dup.htmlLink };
  const ev = await gApi("POST", "/calendars/primary/events", null, body);
  return { duplicate: false, link: ev.htmlLink };
}));

// ---------- 구글 로그인 동기화: 내 구글 드라이브의 앱 전용 숨김 공간(appDataFolder)에 정리 내용 저장 ----------
// 문서마다 고친 시각(__ts)과 지운 시각(__del)을 기억해, 두 컴퓨터에서 바꾼 것 중 나중 것을 남긴다
const SYNC_NAME = "ramgrouptalk-data.json";
function mergeDocs(a, b) {
  a = a || {}; b = b || {};
  const out = { __ts: {}, __del: {} };
  const ta = a.__ts || {}, tb = b.__ts || {}, da = a.__del || {}, db = b.__del || {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b), ...Object.keys(da), ...Object.keys(db)].filter(k => !k.startsWith("__")));
  for (const k of keys) {
    const A = a[k] ? (ta[k] || 1) : 0, B = b[k] ? (tb[k] || 1) : 0, D = Math.max(da[k] || 0, db[k] || 0);
    const best = Math.max(A, B);
    if (D && D >= best) { out.__del[k] = D; continue; }
    if (!best) continue;
    out[k] = A >= B ? a[k] : b[k]; out.__ts[k] = best;
  }
  return out;
}
async function gDrive(method, url, body, raw) {
  const t = await gToken();
  const r = await fetch(url, { method, headers: { Authorization: "Bearer " + t, ...(raw ? { "Content-Type": raw } : body ? { "Content-Type": "application/json" } : {}) }, body: raw ? body : body ? JSON.stringify(body) : undefined });
  if (r.status === 403 || r.status === 401) { const j = await r.json().catch(() => ({})); throw Object.assign(new Error((j.error && j.error.message) || "권한 없음"), { code: "SCOPE" }); }
  if (!r.ok) throw new Error("드라이브 " + r.status);
  return r;
}
let syncBusy = false, syncTimer = null, lastSync = 0, syncState = "";
function scheduleSync(ms) { if (!conf.gRefresh) return; clearTimeout(syncTimer); syncTimer = setTimeout(syncNow, ms || 1000); }
async function syncNow() {
  if (!conf.gRefresh || syncBusy) return;
  syncBusy = true;
  try {
    const q = encodeURIComponent(`name='${SYNC_NAME}'`);
    const list = await (await gDrive("GET", `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${q}&fields=files(id)`)).json();
    const id = list.files && list.files[0] && list.files[0].id;
    const remote = id ? await (await gDrive("GET", `https://www.googleapis.com/drive/v3/files/${id}?alt=media`)).json().catch(() => ({})) : {};
    const local = readJson(DATA_FILE, {});
    const merged = mergeDocs(local, remote);
    const ms = JSON.stringify(merged);
    if (ms !== JSON.stringify(mergeDocs(local, {}))) { writeJson(DATA_FILE, merged); if (win) win.webContents.send("data:remote", merged); }
    if (!id || ms !== JSON.stringify(mergeDocs(remote, {}))) {
      if (id) await gDrive("PATCH", `https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media`, ms, "application/json");
      else {
        const bnd = "rgt" + Date.now();
        const bodyM = `--${bnd}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: SYNC_NAME, parents: ["appDataFolder"] })}\r\n--${bnd}\r\nContent-Type: application/json\r\n\r\n${ms}\r\n--${bnd}--`;
        await gDrive("POST", "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", bodyM, "multipart/related; boundary=" + bnd);
      }
    }
    lastSync = Date.now(); syncState = "ok";
  } catch (e) { syncState = e.code === "SCOPE" ? "relogin" : "error"; }
  finally { syncBusy = false; if (win) win.webContents.send("sync:state", { state: syncState, at: lastSync }); }
}
setInterval(() => scheduleSync(10), 90 * 1000);
ipcMain.handle("sync:now", async () => { await syncNow(); return { state: syncState, at: lastSync }; });
ipcMain.handle("open:url", (_e, u) => { if (/^https?:/.test(u)) shell.openExternal(u); });
ipcMain.handle("open:folder", () => { fs.mkdirSync(conf.exportDir, { recursive: true }); shell.openPath(conf.exportDir); });
ipcMain.on("win:min", () => win.minimize());
ipcMain.on("win:max", () => (win.isMaximized() ? win.unmaximize() : win.maximize()));
ipcMain.on("win:hide", () => { if (conf.closeToTray) win.hide(); else { quitting = true; app.quit(); } });

// 매일 정해 둔 시각에 자동 가져오기
setInterval(() => {
  if (!conf.dailyTime || !win) return;
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const hm = String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
  if (hm >= conf.dailyTime && conf.lastAuto !== today) {
    conf.lastAuto = today; saveConf();
    win.webContents.send("run-export");
  }
}, 60 * 1000);

// ---------- 업데이트 ----------
let updBusy = false, updManual = false;
function msg(text, detail, buttons) {
  return dialog.showMessageBox(win && win.isVisible() ? win : null, { type: "info", title: "RamGroupTalk", message: text, detail: detail || "", buttons: buttons || ["확인"], defaultId: 0, cancelId: (buttons || ["확인"]).length - 1 });
}
let updReady = "", lastCheck = 0;
const RELEASES = "https://github.com/dpfkadpfka/RamGroupTalk/releases";
function notify(title, body, onClick) {
  try {
    if (!Notification.isSupported()) return false;
    const n = new Notification({ title, body, icon: iconFile(), silent: false });
    if (onClick) n.on("click", onClick);
    n.show(); return true;
  } catch { return false; }
}
function installUpdate(silent) { if (!updReady || !autoUpdater) return; quitting = true; try { if (win) { conf.bounds = win.getBounds(); conf.reopenHidden = !win.isVisible(); saveConf(); } } catch {} autoUpdater.quitAndInstall(!!silent, true); }
// 받아 둔 새 버전을 앱을 안 쓸 때 저절로 설치(조용히 설치 후 다시 켜짐)
let rendererBusy = false, applyTimer = null;
ipcMain.on("app:busy", (_e, b) => { rendererBusy = !!b; });
function startAutoApply() {
  if (applyTimer || conf.autoApply === false) return;
  applyTimer = setInterval(() => {
    if (!updReady || exportProc || rendererBusy) return;
    let idle = 0; try { idle = powerMonitor.getSystemIdleTime(); } catch {}
    const notLooking = !win || !win.isVisible() || win.isMinimized() || !win.isFocused();
    if ((notLooking && idle >= 60) || idle >= 300) { clearInterval(applyTimer); applyTimer = null; installUpdate(true); }
  }, 30 * 1000);
}
function setupUpdater() {
  if (!autoUpdater) return;
  autoUpdater.autoDownload = true; autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on("update-available", i => { if (updManual) msg(`새 버전 ${i.version}을(를) 받고 있어요`, "다 받으면 다시 알려 드릴게요."); if (win) win.webContents.send("upd:state", { state: "downloading", version: i.version }); });
  autoUpdater.on("update-not-available", () => { if (updManual) msg("지금 최신 버전이에요", "버전 " + app.getVersion()); updBusy = false; updManual = false; });
  autoUpdater.on("update-downloaded", async i => {
    const manual = updManual; updBusy = false; updManual = false;
    const first = updReady !== i.version; updReady = i.version; trayMenu();
    if (win) win.webContents.send("upd:state", { state: "ready", version: i.version });
    if (manual) {
      const r = await msg(`새 버전 ${i.version} 준비 완료`, "지금 다시 시작해서 업데이트할까요?", ["지금 업데이트", "나중에(끌 때 자동 설치)"]);
      if (r.response === 0) installUpdate();
    } else if (first) {
      if (conf.autoApply === false) notify(`RamGroupTalk ${i.version} 업데이트가 준비됐어요`, "알림을 누르면 바로 업데이트해요. 그냥 두면 앱을 끌 때 설치돼요.", () => installUpdate());
      else notify(`RamGroupTalk ${i.version} 업데이트가 준비됐어요`, "앱을 쓰지 않을 때 저절로 설치하고 다시 켜 둘게요. 지금 하려면 알림을 누르세요.", () => installUpdate());
    }
    startAutoApply();
  });
  autoUpdater.on("error", e => { if (updManual) msg("업데이트를 확인하지 못했어요", String(e && e.message || e).slice(0, 200)); updBusy = false; updManual = false; });
  // 자주 확인: 30분마다, 절전에서 깨어날 때, 창을 다시 볼 때(30분 지났으면)
  setInterval(() => checkUpdate(false), 30 * 60 * 1000);
  try { powerMonitor.on("resume", () => setTimeout(() => checkUpdate(false), 15000)); } catch {}
  // 업데이트 뒤 처음 켤 때 바뀐 점 알림
  const v = app.getVersion();
  if (conf.lastVer && conf.lastVer !== v) {
    setTimeout(() => notify(`RamGroupTalk ${v}로 업데이트됐어요`, "알림을 누르면 바뀐 점을 볼 수 있어요.", () => shell.openExternal(`${RELEASES}/tag/v${v}`)), 4000);
    setTimeout(() => { if (win) win.webContents.send("upd:state", { state: "updated", version: v }); }, 2500);
  }
  if (conf.lastVer !== v) { conf.lastVer = v; saveConf(); }
}
function checkUpdate(manual) {
  if (!app.isPackaged || !autoUpdater) { if (manual) msg("설치한 앱에서만 업데이트를 확인할 수 있어요"); return; }
  if (!manual && updReady) return;
  if (updBusy) { if (manual) msg("업데이트를 확인하는 중이에요"); return; }
  updBusy = true; updManual = !!manual; lastCheck = Date.now();
  autoUpdater.checkForUpdates().catch(() => { updBusy = false; });
}
ipcMain.handle("upd:get", () => ({ ready: updReady }));
ipcMain.handle("upd:install", () => installUpdate());
ipcMain.handle("upd:notes", (_e, v) => shell.openExternal(`${RELEASES}/tag/v${v || app.getVersion()}`));
app.on("browser-window-focus", () => { if (Date.now() - lastCheck > 30 * 60 * 1000) checkUpdate(false); });
function handleArgs(argv) {
  if (argv.includes("--check-update")) checkUpdate(true);
  else if (argv.includes("--open-folder")) { fs.mkdirSync(conf.exportDir, { recursive: true }); shell.openPath(conf.exportDir); }
  else if (argv.includes("--run-export")) { if (win) { win.show(); win.webContents.send("run-export"); } }
}

app.on("second-instance", (_e, argv) => { if (win) { win.show(); win.focus(); } handleArgs(argv || []); });
app.whenReady().then(() => {
  createWindow(); createTray();
  if (app.isPackaged) {
    app.setLoginItemSettings({ openAtLogin: !!conf.openAtLogin });
    // 업데이트 뒤 처음 켤 때 윈도우 아이콘 캐시 새로 고침
    if (process.platform === "win32" && conf.iconFix !== app.getVersion()) {
      conf.iconFix = app.getVersion(); saveConf();
      execFile(path.join(process.env.WINDIR || "C:\\Windows", "System32", "ie4uinit.exe"), ["-show"], { windowsHide: true }, () => {});
    }
    setupUpdater(); checkUpdate(false);
    scheduleSync(3000);
    applyAppIcon(false);
  }
});
app.on("before-quit", () => { quitting = true; });
app.on("window-all-closed", () => { if (!conf.closeToTray) app.quit(); });

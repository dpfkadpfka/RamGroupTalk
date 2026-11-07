// RamGroupTalk — 카톡 단톡방 자동 저장·정리 위젯 (만든 사람: 김예람)
const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, shell, screen, dialog, globalShortcut } = require("electron");
const path = require("path");
const fs = require("fs");
const { execFile } = require("child_process");
let autoUpdater = null;
try { autoUpdater = require("electron-updater").autoUpdater; } catch {}

if (!app.requestSingleInstanceLock()) { app.quit(); }

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
  openAtLogin: true,
  bounds: null,
  lastAuto: ""
};

function readJson(f, d) { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return d; } }
function writeJson(f, v) { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f + ".tmp", JSON.stringify(v)); fs.renameSync(f + ".tmp", f); }
let conf = { ...DEFAULT_CONF, ...readJson(CONF_FILE, {}) };
const saveConf = () => writeJson(CONF_FILE, conf);

let win = null, tray = null, quitting = false;

function createWindow() {
  const wa = screen.getPrimaryDisplay().workArea;
  const b = conf.bounds || { width: 1100, height: 760, x: wa.x + wa.width - 1120, y: wa.y + 20 };
  win = new BrowserWindow({
    ...b, minWidth: 420, minHeight: 360, frame: false, show: false,
    backgroundColor: "#f6f7f9", alwaysOnTop: conf.alwaysOnTop, title: "RamGroupTalk",
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false }
  });
  win.loadFile(path.join(__dirname, "renderer", "index.html"));
  win.once("ready-to-show", () => win.show());
  const remember = () => { if (!win.isMinimized() && !win.isMaximized()) { conf.bounds = win.getBounds(); saveConf(); } };
  win.on("moved", remember); win.on("resized", remember);
  win.on("close", e => { if (!quitting) { e.preventDefault(); win.hide(); } });
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: "deny" }; });
  win.webContents.on("will-navigate", (e, url) => { if (!url.startsWith("file:")) { e.preventDefault(); shell.openExternal(url); } });
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, "renderer", "icon.png"));
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon.resize({ width: 16, height: 16 }));
  if (icon.isEmpty()) app.getFileIcon(process.execPath, { size: "small" }).then(i => tray.setImage(i)).catch(() => {});
  tray.setToolTip("RamGroupTalk");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "열기", click: () => { win.show(); win.focus(); } },
    { label: "지금 카톡 가져오기", click: () => { win.show(); win.webContents.send("run-export"); } },
    { label: "가져오기 중단", click: () => cancelExport() },
    { type: "separator" },
    { label: "끝내기", click: () => { quitting = true; app.quit(); } }
  ]));
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
function runExport() {
  return new Promise(resolve => {
    if (process.platform !== "win32") return resolve({ ok: false, error: "윈도우에서만 쓸 수 있어요" });
    if (!conf.rooms.length) return resolve({ ok: false, error: "설정에서 가져올 단톡방 이름을 먼저 넣어 주세요" });
    fs.mkdirSync(conf.exportDir, { recursive: true });
    const roomsFile = path.join(DATA_DIR, "rooms.json");
    fs.writeFileSync(roomsFile, JSON.stringify(conf.rooms), "utf8");
    const resultFile = path.join(DATA_DIR, "export-result.json");
    try { fs.unlinkSync(resultFile); } catch {}
    try { fs.unlinkSync(STOP_FILE); } catch {}
    try { globalShortcut.register("CommandOrControl+Shift+Q", () => cancelExport()); } catch {}
    exportProc = execFile("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-STA", "-File", scriptPath(),
      "-RoomsFile", roomsFile, "-OutDir", conf.exportDir, "-ResultFile", resultFile, "-StopFile", STOP_FILE],
      { windowsHide: true, timeout: 10 * 60 * 1000 }, (err) => {
        exportProc = null; clearTimeout(killT); try { globalShortcut.unregister("CommandOrControl+Shift+Q"); } catch {}
        const res = readJson(resultFile, null);
        if (res) return resolve({ ok: true, ...res });
        resolve({ ok: false, error: err ? String(err.message || err).slice(0, 300) : "결과를 읽지 못했어요" });
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
ipcMain.handle("data:save", (_e, docs) => { writeJson(DATA_FILE, docs); return true; });
ipcMain.handle("conf:get", () => ({ ...conf, geminiKey: conf.geminiKey ? "••••" + conf.geminiKey.slice(-4) : "", hasKey: !!conf.geminiKey }));
ipcMain.handle("conf:set", (_e, patch) => {
  if (patch.geminiKey === undefined || String(patch.geminiKey).startsWith("••••")) delete patch.geminiKey;
  conf = { ...conf, ...patch };
  saveConf();
  if (win) win.setAlwaysOnTop(!!conf.alwaysOnTop);
  if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: !!conf.openAtLogin });
  return true;
});
ipcMain.handle("export:run", () => runExport());
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
ipcMain.handle("open:url", (_e, u) => { if (/^https?:/.test(u)) shell.openExternal(u); });
ipcMain.handle("open:folder", () => { fs.mkdirSync(conf.exportDir, { recursive: true }); shell.openPath(conf.exportDir); });
ipcMain.on("win:min", () => win.minimize());
ipcMain.on("win:max", () => (win.isMaximized() ? win.unmaximize() : win.maximize()));
ipcMain.on("win:hide", () => win.hide());

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

app.on("second-instance", () => { if (win) { win.show(); win.focus(); } });
app.whenReady().then(() => {
  createWindow(); createTray();
  if (app.isPackaged) {
    app.setLoginItemSettings({ openAtLogin: !!conf.openAtLogin });
    if (autoUpdater) { autoUpdater.autoInstallOnAppQuit = true; autoUpdater.checkForUpdatesAndNotify().catch(() => {}); }
  }
});
app.on("before-quit", () => { quitting = true; });
app.on("window-all-closed", () => {});

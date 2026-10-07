const { app, BrowserWindow, Tray, Menu, ipcMain, screen, nativeImage, shell } = require('electron');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');

let cfg, ws, picker, tray, pingTimer, users = [];

// Settings live in the user's app-data folder so they can be edited after the app is installed.
// First launch copies the bundled config.json there.
function loadConfig() {
  const dir = app.getPath('userData');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'config.json');
  if (!fs.existsSync(file)) fs.copyFileSync(path.join(__dirname, 'config.json'), file);
  const f = JSON.parse(fs.readFileSync(file, 'utf8'));
  // Environment variables override the file (handy for running several test instances)
  cfg = {
    name: process.env.TA_NAME || f.name,
    server: process.env.TA_SERVER || f.server,
    token: process.env.TA_TOKEN ?? f.token,
  };
  return file;
}

function connect() {
  ws = new WebSocket(cfg.server);
  ws.on('open', () => {
    ws.send(JSON.stringify({ type: 'hello', name: cfg.name, token: cfg.token }));
    clearInterval(pingTimer);
    pingTimer = setInterval(() => ws.readyState === 1 && ws.send(JSON.stringify({ type: 'ping' })), 4 * 60 * 1000);
  });
  ws.on('message', (d) => {
    const m = JSON.parse(d);
    if (m.type === 'presence') {
      users = m.users.filter((u) => u !== cfg.name);
      if (picker && !picker.isDestroyed()) picker.webContents.send('users', users);
    } else showPopup(m);
  });
  ws.on('close', () => setTimeout(connect, 3000)); // auto-reconnect
  ws.on('error', () => {});
}

function showPopup(m) {
  const { workArea } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const w = new BrowserWindow({
    width: 380, height: 160, x: workArea.x + workArea.width - 400, y: workArea.y + 20,
    frame: false, alwaysOnTop: true, resizable: false, skipTaskbar: true, show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), autoplayPolicy: 'no-user-gesture-required' },
  });
  w.setAlwaysOnTop(true, 'screen-saver');                                  // above everything
  w.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });        // over full-screen apps
  w.loadFile('alert.html', { query: { from: m.from, type: m.type, text: m.text } });
  w.once('ready-to-show', () => w.showInactive());                         // doesn't steal typing focus
  setTimeout(() => !w.isDestroyed() && w.close(), 30000);
}

function openPicker() {
  if (picker && !picker.isDestroyed()) return picker.show();
  const b = tray.getBounds();
  picker = new BrowserWindow({
    width: 260, height: 340, x: Math.round(b.x - 110), y: b.y + b.height + 4,
    frame: false, resizable: false, alwaysOnTop: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  picker.loadFile('index.html');
  picker.on('blur', () => picker.hide());
}

app.whenReady().then(() => {
  const cfgFile = loadConfig();
  if (app.dock) app.dock.hide();
  tray = new Tray(nativeImage.createEmpty());
  tray.setTitle('🔔 ' + cfg.name);
  tray.on('click', openPicker);
  tray.on('right-click', () => tray.popUpContextMenu(Menu.buildFromTemplate([
    { label: 'Edit settings (name / server)…', click: () => shell.openPath(cfgFile) },
    { label: 'Restart app', click: () => { app.relaunch(); app.quit(); } },
    { type: 'separator' },
    { role: 'quit' },
  ])));
  connect();
});

app.on('window-all-closed', (e) => e.preventDefault()); // keep running in menu bar

ipcMain.handle('getUsers', () => users);
ipcMain.on('alert', (_, to) => ws.send(JSON.stringify({ type: 'alert', to })));
ipcMain.on('reply', (e, { to, text }) => {
  ws.send(JSON.stringify({ type: 'reply', to, text }));
  BrowserWindow.fromWebContents(e.sender).close();
});
ipcMain.on('close', (e) => BrowserWindow.fromWebContents(e.sender).close());

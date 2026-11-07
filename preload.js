const { contextBridge, ipcRenderer, webUtils } = require("electron");
contextBridge.exposeInMainWorld("ramtalk", {
  load: () => ipcRenderer.invoke("data:load"),
  save: docs => ipcRenderer.invoke("data:save", docs),
  getConf: () => ipcRenderer.invoke("conf:get"),
  setConf: p => ipcRenderer.invoke("conf:set", p),
  runExport: () => ipcRenderer.invoke("export:run"),
  readFile: p => ipcRenderer.invoke("file:read", p),
  testKey: (key, model) => ipcRenderer.invoke("key:test", key, model),
  exportBackup: () => ipcRenderer.invoke("backup:export"),
  aiJson: prompt => ipcRenderer.invoke("ai:json", prompt),
  openUrl: u => ipcRenderer.invoke("open:url", u),
  openFolder: () => ipcRenderer.invoke("open:folder"),
  min: () => ipcRenderer.send("win:min"),
  max: () => ipcRenderer.send("win:max"),
  hide: () => ipcRenderer.send("win:hide"),
  onRunExport: f => ipcRenderer.on("run-export", () => f()),
  pathOf: file => { try { return webUtils.getPathForFile(file); } catch { return ""; } }
});

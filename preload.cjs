const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

contextBridge.exposeInMainWorld('electron', {
    ipcRenderer: {
        send: (channel, ...args) => ipcRenderer.send(channel, ...args),
        invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
        on: (channel, func) => ipcRenderer.on(channel, (event, ...args) => func(event, ...args)),
        removeListener: (channel, func) => ipcRenderer.removeListener(channel, func)
    },
    process: {
        get __dirname() { return __dirname; }
    },
    fs: {
        exists: (p) => fs.existsSync(p),
        read: (p, opt) => fs.readFileSync(p, opt)
    },
    path: {
        join: (...args) => path.join(...args)
    }
});

// preload.ts での機能提供
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('songListApi', {
  loadSongList: async () => {
    // 外部JSONファイルを読み込む処理
    return await ipcRenderer.invoke('load-song-list');
  }
});
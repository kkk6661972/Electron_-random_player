// src/index.ts (メインプロセス)
import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';

// メインライブラリをインポート
import { import_ini, get_song_levels, update_song_level } from './util/main_lib';
// 曲リストマネージャーのインポート
import { result_random_manager } from './util/random_manager_module';
// json マネージャーのインポート
import { json_manager } from './util/json_manager_module';
// 演奏履歴マネージャーのインポート
import { play_history_manager } from './util/play_history_manager_module';
// サブウィンドウのメインプロセスをインポート
import { list_config_window } from './list_config/list_config_main';

// デバッグメッセージを受け取るイベントリスナーを追加
ipcMain.on('debug_message', (event, message) => {
    console.log('[Debug]:', message);
});

// メインウィンドウを作成する
function open_main_window() {
    const win = new BrowserWindow({
        width: 1000,
        height: 600,
        webPreferences: { // レンダラープロセスでNode.jsのAPIを使用するための設定
            nodeIntegration: true,
            contextIsolation: false,
            defaultEncoding: 'utf8',
            // webviewタグを有効化
            webviewTag: true,
            // セキュリティ対策として、sandboxモードを無効化
            sandbox: false
        }
    });

    // ランチャー用のメインウィンドウ
    win.loadFile('public/index.html');
    
    // 開発時にDevToolsを開く
    //win.webContents.openDevTools();
    // デバッグ情報をより詳細に表示
    win.webContents.on('did-finish-load', () => {
        win.webContents.executeJavaScript(`
            console.debug = (...args) => {
                console.log('[DEBUG]', ...args);
            };
        `);
    });


}

// メインウィンドウを作成する
app.whenReady().then(open_main_window);

// リスト設定ウィンドウを作成する
ipcMain.on('list_config_window', () => { 
    list_config_window();
}
);

// 曲情報編集ウィンドウを作成する
ipcMain.on('song_config_window', (event, song_config_renderer) => {
    const win = new BrowserWindow({
        width: 400,
        height: 400,
        webPreferences: { // レンダラープロセスでNode.jsのAPIを使用するための設定
            nodeIntegration: true,
            contextIsolation: false,
            preload: undefined  // 明示的に無効化
        }
    });
    // HTMLファイルを読み込む
    win.loadFile('public/list_config/list_config2.html');
});

// ________________________________________________________________________________________________________________________
// 曲情報プロセッサー

// app_set.iniのパス
const ini_path = path.join(process.cwd(), 'my_data', 'app_set.ini');
// app_set.iniファイルから設定を読み込み
const config = import_ini(ini_path);
// 既存の曲リストのJSONファイルのパス
const current_json_path = config.MediaPath.new_music_list;
// ランダム選曲のタイプ 1 = 一次関数、2 = 二次関数
let random_type = null;
random_type = 2;
// 重み指数
let exp_base = null;
exp_base = 5;

// 'request_random_song' メッセージを受信して処理
ipcMain.on('request_random_song', (event) => {

    // ランダム選曲関数を実行して曲情報を取得
    const song_data = result_random_manager(current_json_path , random_type, exp_base);

    // 曲のレベルを更新（play_count >= level の場合にレベルを下げる）
    json_manager('adjust_levels', "");
    event.reply('random_song_play', song_data);

    // 演奏履歴の一覧をレンダラープロセスへ送信
    const play_history = play_history_manager('list', "");
    event.reply('play_history_list', play_history);
});

// 'next_song_data' メッセージを受信して処理
ipcMain.on('next_song_data', (event, record_hash) => {

    // 演奏済みの曲を履歴に追加 (record_hash が null の場合は何もしない)
    play_history_manager('add', record_hash);

    // 再生完了した曲の情報をハッシュ値をキーにして更新
    if (record_hash !== null) {
        const res = json_manager('played', record_hash);
    } 

    // 次の曲をランダムで選択して送信
    const song_data = result_random_manager(current_json_path , random_type, exp_base);
    // 曲のレベルを更新（play_count >= level の場合にレベルを下げる）
    json_manager('adjust_levels', "");
    event.reply('random_song_play', song_data);

    // 演奏履歴の一覧をレンダラープロセスへ送信
    const play_history = play_history_manager('list', "");
    event.reply('play_history_list', play_history);
});

// ________________________________________________________________________________________________________________________
// 曲設定ウィンドウを開く関数

// メインウィンドウからの曲設定リクエストを処理
ipcMain.on('open_song_config', (event, song_data) => {
    open_song_config_window(song_data);
});

// 曲設定ウィンドウを開く
function open_song_config_window(song_data: any) {
    const config_window = new BrowserWindow({
        width: 400,
        height: 400,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    // song_config.htmlを読み込む
    config_window.loadFile('public/song_config.html');

    // 利用可能なレベル一覧を取得
    const available_levels = get_song_levels();
    
    // ウィンドウの準備ができたら曲データを送信
    config_window.webContents.on('did-finish-load', () => {
        config_window.webContents.send('song_data', {
            ...song_data,
            available_levels: available_levels
        });
    });
}

// レベル更新リクエストを処理
ipcMain.on('update_song_level', (event, data) => {
    const result = update_song_level(data.record_hash, data.new_level);
});
import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
// ダイアログライブラリをインポート
import { dialog } from 'electron';

// 共通クラスモジュールをインポート
import { json_processor } from '../util/main_class';

// 曲情報登録モジュールをインポート
import { check_new_list, input_new_list, move_wav_files} from '../util/input_new_list_lib';

// メインプロセス内で保持する値に使用するクラス
class list_config_value {
    private check_result: any = null;
    private path_result: string = ''; 
    get input_song_list_data() {
        return this.check_result;
    }
    get input_song_list_folder_path() {
        return this.path_result;
    }
    set input_song_list_data(value) {
        this.check_result = value;
    }
    set input_song_list_folder_path(value) {
        this.path_result = value;
    }
}

// メインプロセスのスコープでインスタンスを作成
const config_manager = new list_config_value();

// 曲リスト管理ウィンドウの立ち上げ（親メインプロセスにエクスポート）
export function list_config_window() {
    ipcMain.on('list_config_window', (event, list_config_renderer) => {
        const win = new BrowserWindow({
            width: 800,
            height: 600,
            webPreferences: { // レンダラープロセスでNode.jsのAPIを使用するための設定
                nodeIntegration: true,
                contextIsolation: false,
                preload: undefined  // 明示的に無効化
            }
        });
        // HTMLファイルを読み込む
        win.loadFile('public/list_config/list_config.html');
    });
}


// ____________________________________________________________
/**
 * JSファイルからJSONデータを抽出して保存する関数
 * @returns Promise<void>
 */

// 曲情報のインターフェース
interface Song {
    play_count?: number;
    // 他のプロパティもここに追加できます
}

// ____________________________________________________________
// IPCイベントリスナーの設定

// 新規の曲情報登録のイベントハンドラ

// 新規曲のフォルダ選択のダイアログ表示
ipcMain.on('select_new_list_folder_dialog', async (event) => {
    const result = await dialog.showOpenDialog({
        properties: ['openDirectory']
    });
    
    // 選択されたパスをレンダラープロセスに送信
    event.reply('selected_new_list_folder', result.canceled ? '' : result.filePaths[0]);
});

// チェック結果表示用のウィンドウを管理する関数
function create_check_result_window(check_result: any) {
    const result_window = new BrowserWindow({
        width: 600,
        height: 400,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    // チェック結果表示用のHTMLを読み込む
    result_window.loadFile('public/list_config/new_song_list_check_result.html');

    // ウィンドウの準備ができたらデータを送信
    result_window.webContents.on('did-finish-load', () => {
        result_window.webContents.send('check_result_data', check_result);
    });
}

// 新規曲の登録前のチェック
ipcMain.on('input_song_list_folder_path', async (event, input_song_list_folder_path) => {
    try {
        // フォルダパスをオブジェクトに保存
        config_manager.input_song_list_folder_path = input_song_list_folder_path;
        // 設定ファイルのパスを取得
        const ini_path = './my_data/app_set.ini';
        // 新規曲リストチェックの実行（モジュールの関数で実行）
        config_manager.input_song_list_data = await check_new_list(ini_path, input_song_list_folder_path);

        // チェック結果を表示するウィンドウを作成
        // config_manager.input_song_list_data : チェック結果のオブジェクト
        create_check_result_window(config_manager.input_song_list_data);
    } catch (error) {
        console.error('新規曲の登録でエラーが発生しました:', error);
        event.reply('result_check_input_song_list', 'エラーが発生しました');
    }
});

ipcMain.on('new_list_regist', async (event) => {
    try {
        // 設定ファイルのパスを取得
        const ini_path = './my_data/app_set.ini';
        // 新規曲リストの登録（モジュールの関数で実行）
        input_new_list(ini_path, config_manager.input_song_list_data);

        // WAVファイルを移動
        console.log("新規登録曲のあるフォルダパス：", config_manager.input_song_list_folder_path);
        move_wav_files(ini_path, config_manager.input_song_list_folder_path);

        // 完了メッセージを送信
        event.reply('result_check_input_song_list', '新規曲の登録が完了しました');
    } catch (error) {
        console.error('新規曲の登録でエラーが発生しました:', error);
        event.reply('result_check_input_song_list', 'エラーが発生しました');
    }
});

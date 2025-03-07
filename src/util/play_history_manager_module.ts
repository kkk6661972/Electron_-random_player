/*
test_new_my_randam_player\src\util\
play_history_manager_module.ts
*/
import * as fs from 'fs';
import * as path from 'path';
import { exit, loadEnvFile } from "process";
import { ipcMain } from 'electron';

// 履歴として保存する最大曲数
const MAX_HISTORY_SIZE = 100;

// メインライブラリをインポート
import { import_ini, get_song_data } from './main_lib';

// 設定ファイルを読み込み
const config = import_ini('./my_data/app_set.ini');

// list_song.jsonのパス
config.MediaPath.new_music_list

// JSONファイルを読み込んでパース
let list_song_json = require(config.MediaPath.new_music_list);

// 再生履歴リストファイルの作成
function create_history_file(): boolean {
    try {
        // 履歴リストファイルのパスを取得
        const history_path = config.MediaPath.play_history_data;
        
        // ファイルが存在しない場合のみ作成
        if (!fs.existsSync(history_path)) {
            // 空のファイルを作成
            fs.writeFileSync(history_path, '', 'utf8');
            return true;
        }
        
        return true; // ファイルが既に存在する場合も成功とみなす
        
    } catch (error) {
        console.error('履歴ファイルの作成に失敗:', error);
        return false;
    }
}

// 履歴ファイルへ演奏済みの曲を追加
function add_play_history(history_path: string, record_hash: string): boolean {
    try {
        // 現在の履歴を読み込み
        let history: string[] = [];
        if (fs.existsSync(history_path)) {
            history = fs.readFileSync(history_path, 'utf8')
                .split('\n')
                .filter(line => line.trim() !== '');
        }

        // 新しい履歴を最後に追加
        history.push(record_hash);

        // 最大件数を超える場合は古い履歴（先頭）を削除
        if (history.length > MAX_HISTORY_SIZE) {
            history = history.slice(-MAX_HISTORY_SIZE);
        }

        // ファイルに保存
        fs.writeFileSync(history_path, history.join('\n'), 'utf8');
        return true;

    } catch (error) {
        console.error('履歴の追加に失敗:', error);
        return false;
    }
}

// 演奏履歴の取得
function get_play_history(history_path: string): {
    title: string;
    played: boolean;
    play_count: number;
}[] {
    try {
        // 履歴ファイルが存在しない場合は空配列を返す
        if (!fs.existsSync(history_path)) {
            return [];
        }

        // 履歴ファイルを読み込み
        const history = fs.readFileSync(history_path, 'utf8')
            .split('\n')
            .filter(line => line.trim() !== '');

        // 各ハッシュ値に対応する曲データを取得
        const song_history = history
            .map(hash => get_song_data(hash))
            .filter((data): data is NonNullable<typeof data> => data !== null);
        return song_history;

    } catch (error) {
        console.error('履歴の取得に失敗:', error);
        return [];
    }
}


function play_history_manager(type: string, record_hash: string): {
    title: string;
    played: boolean;
    play_count: number;
}[] | void {
    // 再生履歴リストファイルの作成
    if (!create_history_file()) {
        return;
    }
    
    switch (type) {
        case 'add':
            // 履歴ファイルへ曲を追加
            if (!add_play_history(config.MediaPath.play_history_data, record_hash)) {
                return;
            }
            break;
        case 'list':
            // 履歴ファイルの内容を表示
            const song_history = get_play_history(config.MediaPath.play_history_data);
            return song_history;
            break;
        default:
            ipcMain.emit('debug_message', null, `曲履歴モジュールの不明な操作: ${type}`);
            break;
    }
}

export {
    play_history_manager
}
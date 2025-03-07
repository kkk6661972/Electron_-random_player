/*
test_new_my_randam_player\src\util\
json_manager_module.ts
*/
import * as fs from 'fs';
import * as path from 'path';
import { exit, loadEnvFile } from "process";
import { ipcMain } from 'electron';

// メインライブラリをインポート
import { import_ini, update_hash_number, generate_file_hash } from './main_lib';

// 設定ファイルを読み込み
const config = import_ini('./my_data/app_set.ini');

// list_song.jsonのパス
//config.MediaPath.new_music_list

// JSONファイルを読み込んでパース
//let list_song_json = require(config.MediaPath.new_music_list);

// JSONファイルを上書き保存する関数
function save_list_song_json(json_path: string, update_list_song_json: any): void {
    try {
        // JSONファイルの上書き保存
        fs.writeFileSync(json_path, JSON.stringify(update_list_song_json, null, 2), 'utf8');
    } catch (error) {
        ipcMain.emit('debug_message', null, `JSONファイルの上書き保存に失敗しました`);
    }
}
// 加工後のJSONデータを上書き保存のコード
//save_list_song_json(jsonのパス, アップデートしたJSONデータ);

// 曲データを更新する関数
function update_song_data(record_hash: string, list_song_json: any): void {
    // record_hash = 曲に登録されたハッシュ値
    // 各レベルをループ
    for (const level in list_song_json) {
        // 各レベルの曲リストをループ
        for (const song of list_song_json[level]) {
            // record_hashが一致する曲を見つけた場合
            if (song.record_hash === record_hash) {
                // playedをtrueに設定
                song.played = true;
                // play_countをインクリメント
                song.play_count += 1;
                return list_song_json; // 更新されたJSONデータを返す
            }
        }
    }
    ipcMain.emit('debug_message', null, `指定されたrecord_hashの曲が見つかりませんでした: ${record_hash}`);
    return list_song_json; // 更新がない場合も返す
}

// 曲のレベルを更新（play_count >= level の場合にレベルを下げる）
function update_song_levels(json_path: string): string {
    try {
        // JSONファイルを読み込んでパース
        let list_song_json = require(json_path);

        // 全ての曲データをスキャン
        for (const level in list_song_json) {
            const current_level = parseInt(level);
            if (current_level === 0) continue; // レベル0はスキップ

            for (const song of list_song_json[level]) {
                // play_countがキー値（レベル）よりも大きい場合
                if (song.play_count >= current_level) {
                    // レベルを下げるが、レベル1の場合はそのまま
                    const new_level = current_level > 1 ? current_level - 1 : current_level;
                    if (new_level !== current_level) {
                        list_song_json[new_level].push({
                            ...song,
                            play_count: 1 // play_countを1にリセット
                        });
                        // 元のレベルから曲を削除
                        list_song_json[level] = list_song_json[level].filter((s: { record_hash: string }) => s.record_hash !== song.record_hash);
                    }
                    if (new_level !== 1) {
                        ipcMain.emit('debug_message', null, `${current_level} に登録の"${song.title}" のレベルを ${new_level} に下げました`);
                    }
                    
                }
            }
        }

        // JSONファイルを上書き保存
        save_list_song_json(json_path, list_song_json);
        return 'success update song levels';
    } catch (error) {
        ipcMain.emit('debug_message', null, `曲データのレベル更新に失敗しました`);
        return 'failure update song levels';
    }
}

function json_manager(type: string, record_hash: string): string {
    // JSONファイルを読み込んでパース
    let list_song_json = require(config.MediaPath.new_music_list);
    
    switch (type) {
        // 曲の演奏終了
        case 'played':
            // 曲データを更新
            const update_json_data = update_song_data(record_hash, list_song_json);
            // JSONファイルを上書き保存
            save_list_song_json(config.MediaPath.new_music_list, update_json_data);
            return 'update_data_end_play';

        // レベルの調整
        case 'adjust_levels':
            // 曲のレベルを更新（play_count >= level の場合にレベルを下げる）
            return update_song_levels(config.MediaPath.new_music_list);
        // その他の場合
        default:
            break;
    }
    return 'error';
}

export {
    json_manager
}
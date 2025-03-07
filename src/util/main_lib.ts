import * as fs from 'fs';
import * as ini from 'ini';
import { ipcMain } from 'electron';
import { createHash } from 'crypto';
import { json } from 'stream/consumers';

// ________________________________________________________________________________________________________________________
// iniファイル操作関連の関数


// ini設定ファイルの型定義
interface app_set {
    MediaPath: {
        music_list: string;
        wave_dir: string;
        new_music_list: string;
        play_history_data: string;
    };
    HashNumber?: {
        hash_number: string | number;
    };
    System: {
        encoding: string;
    };
}


/**
 * iniファイルを読み込んで設定オブジェクトを返す関数
 * @param ini_path - iniファイルの絶対パス
 * @returns PlayerConfig型の設定オブジェクト
 * @throws Error - ファイルが存在しない、またはパースエラーの場合
 */
export function import_ini(ini_path: string): app_set {
    try {
        // ファイルの存在確認
        if (!fs.existsSync(ini_path)) {
            throw new Error(`iniファイルが存在しません: ${ini_path}`);
        }

        // iniファイルを読み込み
        const config_text = fs.readFileSync(ini_path, 'utf-8');
        
        // iniをパースして設定オブジェクトとして返す
        return ini.parse(config_text) as app_set;

    } catch (error) {
        // エラーハンドリング
        if (error instanceof Error) {
            throw new Error(`設定ファイルの読み込みに失敗: ${error.message}`);
        }
        throw error;
    }
}


/**
 * iniファイルのハッシュナンバーを更新する関数
 * @param ini_path - iniファイルの絶対パス
 * @param new_hash_number - 更新する新しいハッシュナンバー
 * @throws Error - ファイルが存在しない、書き込み権限がない、またはパースエラーの場合
 */
export function update_hash_number(ini_path: string, new_hash_number: number): void {
    try {
        // ファイルの存在確認
        if (!fs.existsSync(ini_path)) {
            throw new Error(`iniファイルが存在しません: ${ini_path}`);
        }

        // iniファイルを読み込み
        const config_text = fs.readFileSync(ini_path, 'utf-8');
        
        // 現在の設定をパース
        const config = ini.parse(config_text);

        // ハッシュナンバーを更新
        if (!config.HashNumber) {
            config.HashNumber = {};
        }
        config.HashNumber.hash_number = new_hash_number;

        // 更新した設定をiniフォーマットに変換
        const updated_config = ini.stringify(config, {
            section: '',
            whitespace: true
        });

        // ファイルに書き込み
        fs.writeFileSync(ini_path, updated_config, 'utf-8');

    } catch (error) {
        // エラーハンドリング
        if (error instanceof Error) {
            throw new Error(`ハッシュナンバーの更新に失敗: ${error.message}`);
        }
        throw error;
    }
}


// ________________________________________________________________________________________________________________________
// ファイルハッシュ生成関連の関数
/**
 * ファイル名と連番からハッシュ値を生成する関数
 * 
 * @param file_name - ハッシュ生成対象のファイル名
 * @param sequence_number - 単調増加する連番
 * @returns 生成されたハッシュ値（16進数文字列）
 * 
 * @example
 * const hash = generate_file_hash("example.mp3", 1);
 */
export function generate_file_hash(file_name: string, sequence_number: number): string {
    // 入力値の検証
    if (!file_name || sequence_number < 0) {
        throw new Error('Invalid input parameters');
    }

    // ファイル名と連番を結合して一意の文字列を作成
    const unique_string = `${file_name}_${sequence_number}`;

    // SHA-256アルゴリズムを使用してハッシュを生成
    const hash = createHash('sha256')
        .update(unique_string)
        .digest('hex');

    return hash;
}

// ________________________________________________________________________________________________________________________
// 曲情報関連の関数

// 設定ファイルを読み込み
const config = import_ini('./my_data/app_set.ini');
// list_song.jsonのパス
config.MediaPath.new_music_list

// JSONデータを読み込んでパースする関数
function read_json_data(json_path: string): any {
    try {
        // JSONファイルを読み込んでパース
        const json_data = require(json_path);
        return json_data;

    } catch (error) {
        // エラーが発生した場合
        ipcMain.emit('debug_message', null, `JSONデータの読み込みに失敗: ${error instanceof Error ? error.message : 'unknown error'}`);
        return null;
    }
}


// 曲情報を取得する関数
export function get_song_data(record_hash: string): { 
    level: number;
    title: string;
    played: boolean;
    play_count: number;
    record_hash: string;
} | null {
    try {
        // JSONファイルを読み込み
        const song_data = read_json_data(config.MediaPath.new_music_list);

        // 全レベルを検索
        for (const level in song_data) {
            // 各レベル内の曲を検索
            const song = song_data[level].find((song: { record_hash: string; }) => 
                song.record_hash === record_hash
            );

            // 曲が見つかった場合、必要な情報を返す
            if (song) {
                return {
                    level: parseInt(level),
                    title: song.title,
                    played: song.played,
                    play_count: song.play_count,
                    record_hash: record_hash
                };
            }
        }

        // 曲が見つからなかった場合
        return null;

    } catch (error) {
        // エラーが発生した場合
        ipcMain.emit('debug_message', null, `曲データの取得に失敗: ${error instanceof Error ? error.message : 'unknown error'}`);
        return null;
    }
}

// jsonに登録されているキー（レベル）を取得する関数
export function get_song_levels(): string[] {
    try {
        // JSONファイルを読み込み
        const song_data = read_json_data(config.MediaPath.new_music_list);

        // レベルを取得
        const levels = Object.keys(song_data);

        return levels;

    } catch (error) {
        // エラーが発生した場合
        ipcMain.emit('debug_message', null, `曲データの取得に失敗: ${error instanceof Error ? error.message : 'unknown error'}`);
        return [];
    }
}

// 曲のレベルを更新する関数
export function update_song_level(record_hash: string, new_level: string): boolean {
    try {
        // JSONファイルを読み込み
        const song_data = read_json_data(config.MediaPath.new_music_list);

        // 曲データを一時保存する変数
        let song_to_update: any = null;

        // 全JSONデータからハッシュ値に対応する曲を検索
        for (const level in song_data) {
            // 各レベル内の曲を検索
            const songIndex = song_data[level].findIndex((song: { record_hash: string; }) => 
                song.record_hash === record_hash
            );
            // 曲が見つかった場合、レベルを更新
            if (songIndex !== -1) {
                // ハッシュ値に合致したデータをコピー
                song_to_update = { ...song_data[level][songIndex] };
                ipcMain.emit('debug_message', null, `コピーする対象のデータ: ${JSON.stringify(song_to_update)}`);
                // 現在のレベルから曲を削除
                song_data[level].splice(songIndex, 1);
                break;
            }
        }

        // 曲が見つからなかった場合
        if (!song_to_update) {
            return false;
        }

        // 新しいレベルに曲を追加
        if (!song_data[new_level]) {
            song_data[new_level] = [];
        }
        song_data[new_level].push(song_to_update);

        // JSONファイルを更新
        fs.writeFileSync(config.MediaPath.new_music_list, JSON.stringify(song_data, null, 2), 'utf-8');

        return true;

    } catch (error) {
        // エラーが発生した場合
        ipcMain.emit('debug_message', null, `曲データの更新に失敗: ${error instanceof Error ? error.message : 'unknown error'}`);
        return false;
    }
}
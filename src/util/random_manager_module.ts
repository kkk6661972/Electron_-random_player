/*
test_new_my_randam_player\src\util\
random_manager_module.ts
*/
import * as fs from 'fs';
import * as path from 'path';
import { exit, loadEnvFile } from "process";
import { ipcMain } from 'electron';

// メインライブラリをインポート
import { import_ini, update_hash_number, generate_file_hash } from './main_lib';

// 設定ファイルのパスを取得
const ini_path = './my_data/app_set.ini';

// マクロ曲リスト情報を作成する関数
function export_macro_song_data(json_path: string): { [key: string]: number } {
    // JSONファイルを読み込んでパース
    const raw_data = require(json_path);
    // レベルごとの曲数を格納するオブジェクト
    let res: { [key: string]: number } = {};
    // レベルごとの曲数をカウント
    Object.keys(raw_data).forEach(level => {
        if (level !== "0") {
            res[level] = raw_data[level].length;
        }
    });
    return res; 
}

// 一次関数によるレベルの曲数の割り振り
function make_random_level_linear(macro_song_data: { [key: string]: number }, exp_base: number): { [key: string]: number } {
    // サンプル macro_song_data = { "1": 10, "2": 20, "3": 30, "4": 40, "5": 50, "6": 60, "7": 70, "8": 80, "9": 90, "10": 100 };
    let load_exp_base = null;
    // 重み指数のトータルをカウント
    let total_weight_value = 0;

    // キーの値分だけループ
    Object.keys(macro_song_data).forEach(level => {
        // 一次関数による割り振り
        if (level == "1") {
            // level = 1 では、重み指数は曲数のまま
            macro_song_data[level] = Math.floor(macro_song_data[level]);
            // 加工した重みデータを配列に格納
            // 重み指数のトータルをカウント
            total_weight_value += macro_song_data[level];
        } else {
            // level = 1 以外の場合 重み指数の計算　曲数 * level + 重み指数
            // levelを数値に変換して、重み指数と加算
            load_exp_base = parseInt(level) + exp_base;
            macro_song_data[level] = Math.floor(macro_song_data[level] * load_exp_base);
            // 重み指数のトータルをカウント
            total_weight_value += macro_song_data[level];
        }
    });
    // レベルごとの重み指数の割合を格納するオブジェクト
    let level_ratios: { [key: string]: number } = {};
    // キーの値分だけループ
    Object.keys(macro_song_data).forEach(level => {
        // レベルごとの重み指数の割合を計算
        level_ratios[level] = macro_song_data[level] / total_weight_value;
    });

    return level_ratios;
}

// 二次関数によるレベルの曲数の割り振り
function make_random_level_quadratic(macro_song_data: { [key: string]: number }, exp_base: number): { [key: string]: number } {
    // サンプル macro_song_data = { "1": 10, "2": 20, "3": 30, "4": 40, "5": 50, "6": 60, "7": 70, "8": 80, "9": 90, "10": 100 };
    
    // 重み指数のトータルをカウント
    let total_weight_value = 0;

    // キーの値分だけループ
    Object.keys(macro_song_data).forEach(level => {
        // 二次関数による割り振り
        if (level == "1") {
            // level = 1 では、重み指数は曲数のまま
            macro_song_data[level] = Math.floor(macro_song_data[level]);
        } else {
            // level = 1 以外の場合は二次関数の重み計算
            // ax² + b の形式で計算（ここでは a = exp_base/2、b = 1 とする）
            const level_num = parseInt(level);
            const quadratic_factor = exp_base / 2; // 二次関数の係数（小さくして急激な増加を抑制）
            
            // 二次関数の計算: 曲数 × (quadratic_factor × level² + 1)
            // 1を加えることで必ず元の曲数以上になるようにする
            const weight_multiplier = quadratic_factor * Math.pow(level_num, 2) + 1;
            macro_song_data[level] = Math.floor(macro_song_data[level] * weight_multiplier);
        }
        
        // 重み指数のトータルをカウント
        total_weight_value += macro_song_data[level];
    });
    
    // レベルごとの重み指数の割合を格納するオブジェクト
    let level_ratios: { [key: string]: number } = {};
    
    // キーの値分だけループ
    Object.keys(macro_song_data).forEach(level => {
        // レベルごとの重み指数の割合を計算
        level_ratios[level] = macro_song_data[level] / total_weight_value;
    });

    return level_ratios;
}

// 選曲対象レベルをランダムに選択
function select_random_level(level_ratios: { [key: string]: number }): string {
    // 乱数生成
    const random_value = Math.random();
    // 累積確率
    let cumulative_ratio = 0;
    // キーの値分だけループ
    for (const level in level_ratios) {
        // 累積確率を計算
        cumulative_ratio += level_ratios[level];
        // 乱数と累積確率を比較
        if (random_value < cumulative_ratio) {
            // 乱数が累積確率を下回ったらそのレベルを返す
            return level;
        }
    }
    // デフォルトで最初のレベルを返す
    return Object.keys(level_ratios)[0]; 
}

// 曲選択関数
function select_random_song(json_path: string, level: number): string | null {
    // Song 型を定義
    interface Song {
        played: boolean;
        record_hash: string;
    }

    // JSONファイルを読み込んでパース
    const song_data = require(json_path);

    // 未再生曲の抽出
    const unplayed_songs = song_data[level].filter((song: Song) => !song.played);
    
    // 未再生曲が存在する場合はランダムに1曲選択
    if (unplayed_songs.length > 0) {
        const selected_index = Math.floor(Math.random() * unplayed_songs.length);
        return unplayed_songs[selected_index].record_hash;
    }
    
    return null;
}

// 再生状態リセット関数
function change_played(json_path: string, level: number): boolean {
    // Song 型を定義
    interface Song {
        played: boolean;
        record_hash: string;
    }
    try {
        // JSONファイルを読み込んでパース
        const song_data = require(json_path);
        
        // 指定レベルの全曲のplayed状態をfalseに変更
        song_data[level].forEach((song: Song) => song.played = false);
        
        // JSONファイルに書き戻し
        fs.writeFileSync(json_path, JSON.stringify(song_data, null, 2), 'utf8');
        return true;
    } catch (error) {
        return false;
    }
}

// 曲データのインターフェース
interface SongData {
    title: string;
    record_hash: string;
}

type SongList = {
    [key: string]: SongData[];
}

// 再生URL生成関数
function create_play_url(record_hash: string, json_path: string, wave_dir: string): string | null {
    try {
        const song_data: SongList = require(json_path);
        
        // 全レベルから対象の曲を検索
        for (const level in song_data) {
            const song = song_data[level].find(s => s.record_hash === record_hash);
            if (song) {
                // URLを生成して返す
                const file_path = path.join(wave_dir, `${song.title}.wav`);
                return `file:///${file_path.replace(/\\/g, '/')}`;
            }
        }
        return null;
    } catch (error) {
        return null;
    }
}

// 曲データの型定義を追加
interface SongData {
    title: string;
    played: boolean;
    play_count: number;
    record_hash: string;
}

// ランダム選曲関数
function result_random_manager(json_path: string, random_type: number, exp_base: number): { 
    url: string | null, 
    record_hash: string | null,
    song_data: SongData | null,
    song_level: number
} {
    // 設定ファイルを読み込み
    const config = import_ini(ini_path);
    
    // マクロ曲リスト情報
    const macro_song_data = export_macro_song_data(json_path);
    let level_ratios: { [key: string]: number } = {};
    if (random_type === 1) {
        // 一次関数によるレベルの曲数の割り振り
        level_ratios = make_random_level_linear(macro_song_data, exp_base);
    } else if (random_type === 2) {
        // 二次関数によるレベルの曲数の割り振り
        level_ratios = make_random_level_quadratic(macro_song_data, exp_base);
    } else {
        console.log("ランダム選曲のタイプが不正です");
    }

    // 選曲対象のレベル
    const select_level = select_random_level(level_ratios);

    // 未再生の曲選択
    let play_record_hash = select_random_song(json_path, parseInt(select_level));
    
    if (play_record_hash === null) {
        console.log("再生可能な曲がありませんでした 全てplayed = falese に変更します");
        // 再生状態リセット
        const res = change_played(json_path, parseInt(select_level));
        if (res === false) {
            console.log("JSONデータのアップデートに失敗しました");
            exit(1);
        }
        // 再度未再生の曲選択
        play_record_hash = select_random_song(json_path, parseInt(select_level));
        if (play_record_hash === null) {
            console.log("再生可能な曲がありませんでした");
            exit(1);
        }
    }

    
    // 曲データを取得
    let song_data = require(json_path)[select_level].find((song: SongData) => 
        song.record_hash === play_record_hash
    ) || null;
    // レベル情報を追加
    ipcMain.emit('debug_message', null, `追加するレベル情報の前の値: ${song_data.level}`);

    // 再生URLの生成
    const play_url = create_play_url(play_record_hash, json_path, config.MediaPath.wave_dir);
    return { 
        url: play_url, 
        record_hash: play_record_hash,
        song_data: song_data,
        song_level: parseInt(select_level)
    };
}

export {
    result_random_manager
}

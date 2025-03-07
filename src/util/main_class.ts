/*
test_new_my_randam_player\src\util\
main_class.ts
*/

import * as fs from 'fs';
import { import_ini, update_hash_number, generate_file_hash } from './main_lib';


// ________________________________________________________________________________________________________________________
//　JSONデータ操作関連のクラス

/**
使用方法の例
try {
    // プロセッサーのインスタンスを作成
    const processor = new json_processor(
        'path/to/app_set.ini',
        'path/to/サンプル_list_song.json'
    );

    // ハッシュ値を追加
    const processed_count = processor.add_hash_to_songs();
    console.log(`${processed_count}曲にハッシュ値を追加しました`);

    // 更新されたデータを保存
    processor.save_json('path/to/output.json');
} catch (error) {
    console.error(error.message);
} 
*/


/**
 * 音楽データの型定義
 * プレイリストの各曲のデータ構造を表現
 */
interface music_data {
    title: string;
    played: boolean;
    play_count: number;
    record_hash?: string;  // ハッシュ値を格納する新しいフィールド
}

/**
 * プレイリストの型定義
 * 数値キーと音楽データの配列のマッピング
 */
interface playlist_data {
    [key: string]: music_data[];
}

/**
 * JSONデータ処理クラス
 * 既存の音楽プレイリストにハッシュ値を追加する処理を担当
 */
export class json_processor {
    private ini_path: string;
    private json_path: string;
    private playlist_data: playlist_data;

    /**
     * コンストラクタ
     * @param ini_path - 設定ファイルのパス
     * @param json_path - 処理対象のJSONファイルのパス
     */
    constructor(ini_path: string, json_path: string) {
        this.ini_path = ini_path;
        this.json_path = json_path;
        this.playlist_data = this.load_json();
    }

    /**
     * JSONファイルを読み込む
     * @returns プレイリストデータ
     * @private
     */
    private load_json(): playlist_data {
        try {
            const json_text = fs.readFileSync(this.json_path, 'utf-8');
            return JSON.parse(json_text);
        } catch (error) {
            throw new Error(`JSONファイルの読み込みに失敗: ${error instanceof Error ? error.message : 'unknown error'}`);
        }
    }

    /**
     * 全ての曲データにハッシュ値を追加
     * @returns 処理された曲の数
     */
    public add_hash_to_songs(): number {
        try {
            // 設定ファイルから現在のハッシュナンバーを取得
            const config = import_ini(this.ini_path);
            let current_hash_number = Number(config.HashNumber?.hash_number ?? 1);
            let processed_count = 0;

            // 全てのプレイリストをループ
            for (const playlist_key in this.playlist_data) {
                const playlist = this.playlist_data[playlist_key];
                
                // プレイリスト内の各曲にハッシュを追加
                playlist.forEach(song => {
                    if (!song.record_hash) {  // ハッシュが未設定の場合のみ処理
                        song.record_hash = generate_file_hash(song.title, current_hash_number);
                        current_hash_number++;
                        processed_count++;
                    }
                });
            }

            // 更新されたハッシュナンバーを保存
            update_hash_number(this.ini_path, current_hash_number);

            return processed_count;
        } catch (error) {
            throw new Error(`ハッシュ値の追加に失敗: ${error instanceof Error ? error.message : 'unknown error'}`);
        }
    }

    /**
     * 更新されたJSONデータを保存
     * @param output_path - 出力先のファイルパス
     */
    public save_json(output_path: string): void {
        try {
            const json_text = JSON.stringify(this.playlist_data, null, 2);
            fs.writeFileSync(output_path, json_text, 'utf-8');
        } catch (error) {
            throw new Error(`JSONファイルの保存に失敗: ${error instanceof Error ? error.message : 'unknown error'}`);
        }
    }
}

// ________________________________________________________________________________________________________________________
//　JSONデータ操作クラス　プレイリストデータの新規登録・更新に対応すること

/**
使用方法の例
// クラスのインスタンス化
const json_ops = new json_operations('app_set.ini', 'playlist.json');

// 新規曲の追加
const add_result = json_ops.add_song('0', '新しい曲のタイトル');
if (add_result.success) {
    console.log(add_result.message);
}

// 既存の曲の更新
const update_result = json_ops.update_song('0', 'existing_hash', {
    played: true,
    play_count: 1
});
if (update_result.success) {
    console.log(update_result.message);
}

// 変更の保存
const save_result = json_ops.save_json('updated_playlist.json');
if (save_result.success) {
    console.log(save_result.message);
}

*/

/**
 * JSONデータ操作の結果を表す型
 */
interface operation_result {
    success: boolean;
    message: string;
    affected_items?: number;
    data?: any;
}

/**
 * JSONファイルの操作を管理するクラス
 * 新規登録と更新の共通処理を提供
 */
export class json_operations {
    private ini_path: string;
    private json_path: string;
    private playlist_data: playlist_data;

    constructor(ini_path: string, json_path: string) {
        this.ini_path = ini_path;
        this.json_path = json_path;
        this.playlist_data = this.load_json();
    }

    /**
     * JSONファイルを読み込む
     * @private
     */
    private load_json(): playlist_data {
        try {
            if (fs.existsSync(this.json_path)) {
                const json_text = fs.readFileSync(this.json_path, 'utf-8');
                return JSON.parse(json_text);
            }
            return {}; // 新規作成の場合は空のオブジェクトを返す
        } catch (error) {
            throw new Error(`JSONファイルの読み込みに失敗: ${error instanceof Error ? error.message : 'unknown error'}`);
        }
    }

    /**
     * プレイリストに新しい曲を追加
     * @param playlist_key - プレイリストの識別子
     * @param song_title - 追加する曲のタイトル
     */
    public add_song(playlist_key: string, song_title: string): operation_result {
        try {
            // 設定ファイルから現在のハッシュナンバーを取得
            const config = import_ini(this.ini_path);
            const current_hash = Number(config.HashNumber?.hash_number ?? 1);

            // プレイリストが存在しない場合は新規作成
            if (!this.playlist_data[playlist_key]) {
                this.playlist_data[playlist_key] = [];
            }

            // 重複チェック
            const exists = this.playlist_data[playlist_key].some(song => song.title === song_title);
            if (exists) {
                return {
                    success: false,
                    message: '指定された曲は既に存在します',
                };
            }

            // 新しい曲データの作成
            const new_song: music_data = {
                title: song_title,
                played: false,
                play_count: 0,
                record_hash: generate_file_hash(song_title, current_hash)
            };

            // プレイリストに追加
            this.playlist_data[playlist_key].push(new_song);

            // ハッシュナンバーの更新
            update_hash_number(this.ini_path, current_hash + 1);

            return {
                success: true,
                message: '曲の追加に成功しました:"Songs have been successfully added!"',
                affected_items: 1,
                data: new_song
            };
        } catch (error) {
            return {
                success: false,
                message: `曲の追加に失敗: ${error instanceof Error ? error.message : 'unknown error'}`,
            };
        }
    }

    /**
     * 既存の曲データを更新
     * @param playlist_key - プレイリストの識別子
     * @param record_hash - 更新対象の曲のハッシュ値
     * @param updated_data - 更新するデータ
     */
    public update_song(playlist_key: string, record_hash: string, updated_data: Partial<music_data>): operation_result {
        try {
            const playlist = this.playlist_data[playlist_key];
            if (!playlist) {
                return {
                    success: false,
                    message: '指定されたプレイリストが存在しません',
                };
            }

            // 更新対象の曲を検索
            const song_index = playlist.findIndex(song => song.record_hash === record_hash);
            if (song_index === -1) {
                return {
                    success: false,
                    message: '指定された曲が見つかりません',
                };
            }

            // データの更新（ハッシュ値は変更不可）
            const song = playlist[song_index];
            delete updated_data.record_hash; // ハッシュ値の更新を防止
            Object.assign(song, updated_data);

            return {
                success: true,
                message: '曲データの更新に成功しました',
                affected_items: 1,
                data: song
            };
        } catch (error) {
            return {
                success: false,
                message: `曲データの更新に失敗: ${error instanceof Error ? error.message : 'unknown error'}`,
            };
        }
    }

    /**
     * 更新されたJSONデータを保存
     * @param output_path - 保存先のファイルパス
     */
    public save_json(output_path: string): operation_result {
        try {
            const json_text = JSON.stringify(this.playlist_data, null, 2);
            fs.writeFileSync(output_path, json_text, 'utf-8');
                encoding: 'utf8'  // エンコーディングを明示的に指定
            
            return {
                success: true,
                message: 'JSONファイルの保存に成功しました',
            };
        } catch (error) {
            return {
                success: false,
                message: `JSONファイルの保存に失敗: ${error instanceof Error ? error.message : 'unknown error'}`,
            };
        }
    }
}



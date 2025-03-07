// 日本語出力のための文字コード設定
process.env.LANG = 'ja_JP.UTF-8';

import * as fs from 'fs';
import * as path from 'path';
import * as ini from 'ini';

// メインライブラリをインポート
import { import_ini, update_hash_number, generate_file_hash } from './main_lib';

// ________________________________________________________________
// クラス定義

// json_operationsをインポート
import { json_operations } from './main_class';


// インターフェース定義
interface song_info {
    title: string;
    played: boolean;
    play_count: number;
    record_hash: string;
}

interface music_data {
    [key: string]: song_info[];
}

// アプリケーション設定ファイルのインターフェース
// MediaPathの定義名を変える場合はiniファイルも変更すること
interface config_data {
    MediaPath: {
        new_music_list: string;
        wave_dir: string;
    };
    System: {
        encoding: string;
    };
}

interface audio_path_info {
    url: string;
    title: string;
    record_hash: string;
}

// エラークラス定義
class file_error extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'FileError';
    }
}

class parse_error extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ParseError';
    }
}

/**
 * 音楽ライブラリを管理するクラス
 */
export class music_manager {
    private _config_path: string;
    private _music_data: music_data = {};
    private _config: config_data | null = null;

    // json_operationsのインスタンスを保持するプロパティ
    private _json_ops: json_operations;

    
    /**
     * コンストラクタ
     * @param config_path 設定ファイルのパス
     */
    constructor(config_path: string) {
        this._config_path = config_path;
        this._load_config();      // コンストラクタで同期的に設定を読み込む
        this.load_music_data();   // コンストラクタで同期的に音楽データを読み込む

        // json_operationsの初期化
        // 設定ファイルのパスと音楽データファイルのパスを渡す
        if (!this._config) throw new Error('Configuration not loaded');
        this._json_ops = new json_operations(
            this._config_path,
            this._config.MediaPath.new_music_list
        );
    }

    // 設定ファイルを同期的に読み込む
    private _load_config(): void {
        try {
            const config_content = fs.readFileSync(this._config_path, 'utf8');
            this._config = ini.parse(config_content) as config_data;

            if (!this._config?.MediaPath?.new_music_list || !this._config?.MediaPath?.wave_dir) {
                throw new parse_error('Required configuration is missing');
            }
        } catch (error) {
            if (error instanceof Error) {
                throw new file_error(`Failed to load config: ${error.message}`);
            }
        }
    }

    // 音楽データを同期的に読み込む
    public load_music_data(): void {
        try {
            if (!this._config) throw new Error('Configuration not loaded');

            const json_path = this._config.MediaPath.new_music_list;
            const json_content = fs.readFileSync(json_path, 'utf8');

            this._music_data = JSON.parse(json_content);
        } catch (error) {
            if (error instanceof Error) {
                throw new file_error(`Failed to load music data: ${error.message}`);
            }
        }
    }

    // ________________________________________________________________
    /**
     * audioタグ用のURLを生成する
     */
    private _build_audio_url(song_title: string): string {
        if (!this._config) throw new Error('Configuration not loaded');
    
        const file_path = path.join(this._config.MediaPath.wave_dir, `${song_title}.wav`);
    
        // 元のファイル名でそのまま存在確認
        if (!fs.existsSync(file_path)) {
            throw new Error(`音楽ファイルが見つかりません: ${file_path}`);
        }
    
        const normalized_path = file_path.replace(/\\/g, '/');
        return `file:///${normalized_path}`;
    }

    // ________________________________________________________________
    /**
     * 曲の再生完了時の処理を行うメソッド
     * played状態とplay_countを更新します
     * 
     * @param record_hash - 更新対象の曲のハッシュ値
     * @returns 更新が成功したかどうか
     */
    public update_played_status(record_hash: string): boolean {
        console.log('RUN "update_played_status"');
        console.log('record_hash:', record_hash);
        // まず、この曲が含まれているプレイリストのキーを探します
        let target_playlist_key: string | null = null;

        // _music_dataの各プレイリストを検索
        for (const [key, songs] of Object.entries(this._music_data)) {
            // 指定されたハッシュ値を持つ曲を探す
            const found = songs.some(song => song.record_hash === record_hash);
            if (found) {
                target_playlist_key = key;
                break;
            }
        }
        console.log('target_playlist_key:', target_playlist_key);

        // 曲が見つからなかった場合は更新失敗
        if (!target_playlist_key) {
            return false;
        }

        try {
            // json_operationsを使って更新を実行
            const update_result = this._json_ops.update_song(
                target_playlist_key,
                record_hash,
                {
                    played: true,
                    play_count: this._get_current_play_count(target_playlist_key, record_hash) + 1
                }
            );
    
            // 更新が成功した場合、明示的に保存を実行
            if (update_result.success && this._config) {
                const save_result = this._json_ops.save_json(
                    this._config.MediaPath.new_music_list
                );
                
                // メモリ上のデータも更新
                this.load_music_data();
                
                return save_result.success;
            }
    
            return false;
    
        } catch (error) {
            console.error('Failed to update played status:', error);
            return false;
        }
    }

    /**
     * 現在の再生回数を取得する内部メソッド
     * 
     * @param playlist_key - プレイリストのキー// json_operationsの初期化
        // 設定ファイルのパスと音楽データファイルのパスを渡す
        if (!this._config) throw new Error('Configuration not loaded');
        this._json_ops = new json_operations(
            this._config_path,
            this._config.MediaPath.new_music_list
        );
     * @param record_hash - 曲のハッシュ値
     * @returns 現在の再生回数
     * @private
     */
    private _get_current_play_count(playlist_key: string, record_hash: string): number {
        const song = this._music_data[playlist_key]
            .find(song => song.record_hash === record_hash);
        
        return song ? song.play_count : 0;
    }



    // ______________________________________________________________
    /**
     * ランダムに1曲選択する
     */
    public get_random_song(): audio_path_info | null {
        // データが空の場合
        const groups = Object.keys(this._music_data);
        if (groups.length === 0) return null;

        // ランダムにグループを選択
        const random_group = groups[Math.floor(Math.random() * groups.length)];
        const songs = this._music_data[random_group];

        // グループ内の曲が空の場合
        if (songs.length === 0) return null;

        // ランダムに曲を選択
        const random_song = songs[Math.floor(Math.random() * songs.length)];

        return {
            url: this._build_audio_url(random_song.title),
            title: random_song.title,
            record_hash: random_song.record_hash
        };
    }



}
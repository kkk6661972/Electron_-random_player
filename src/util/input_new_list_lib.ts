/*
test_new_my_randam_player/src/util/
input_new_list_lib.ts
*/

import * as fs from 'fs';
import * as path from 'path';
// メインライブラリをインポート
import { import_ini, update_hash_number, generate_file_hash } from './main_lib';

// 共通クラスモジュールをインポート
import { json_processor } from './main_class';

// スキャン結果の型定義
interface check_result {
    valid_files: string[];
    invalid_files: string[];
    duplicate_files: string[];
    json_status: {
        last_level: number;
    }
}

// 新規曲リスト登録チェック
export async function check_new_list(ini_path: string, input_song_folder_path: string): Promise<check_result> {
    try {
        // app_set.iniファイルから設定を読み込み
        const config = import_ini(ini_path);
        //  既存の曲リストのJSONファイルのパス
        const current_json_path = config.MediaPath.new_music_list;
        
        // JSONファイルの読み込み
        // existing_data : JSONファイルの内容をオブジェクトに変換
        const existing_data = JSON.parse(fs.readFileSync(current_json_path, 'utf-8'));
        
        // フォルダ内のファイル一覧を取得
        const files = fs.readdirSync(input_song_folder_path)
            .filter(file => path.extname(file).toLowerCase() === '.wav')  // wavファイルのみ抽出
            .sort(); // 名前順にソート

        // ファイル形式チェックの結果を格納する配列
        const valid_files: string[] = [];
        const invalid_files: string[] = [];
        const duplicate_files: string[] = [];
        
        // audioタグで使用できない文字のパターン
        const invalid_chars_pattern = /[<>:"\/\\|?*]/;

        // 6. 各ファイルの検証

        for (const file of files) {
            const file_name = path.basename(file, '.wav');
            
            // 重複チェック
            let is_duplicate = false;
            // existing_data : JSONに登録されている全曲データーのオブジェクト
            // level : JSONのキー(レベル)
            for (const level in existing_data) {
                // some() : 配列の中に指定した条件を満たす要素が1つでもあるかどうかを判定
                // song : JSONの中の曲データーを登録する一時使用変数
                if (existing_data[level].some((song: { title: string; }) => song.title === file_name)) {
                    duplicate_files.push(file_name);
                    is_duplicate = true;
                    break;
                }
            }
            if (is_duplicate) continue;

            // ファイル名の検証
            if (invalid_chars_pattern.test(file_name)) {
                invalid_files.push(file_name);
            } else {
                valid_files.push(file_name);
            }
        }

        // 7. JSONの状態を解析
        const levels = Object.keys(existing_data).map(Number);
        const last_level = Math.max(...levels);

        // 8. 結果を返す
        return {
            valid_files,
            invalid_files,
            duplicate_files,
            json_status: {
                last_level: last_level,
            }
        };

    } catch (error) {
        console.error('チェック処理でエラーが発生:', error);
        throw error;
    }
}

export function input_new_list(ini_path: string, input_song_list_data: any): boolean {
    try {
        // app_set.iniファイルから設定を読み込み
        const config = import_ini(ini_path);
        
        // 現在のJSONファイルを読み込み
        const current_json = JSON.parse(fs.readFileSync(config.MediaPath.new_music_list, 'utf-8'));

        // 新しいレベル番号を設定（最後のレベル + 1）
        const new_level = (input_song_list_data.json_status.last_level + 1).toString();
        
        // 新しいレベルの配列を初期化
        current_json[new_level] = [];

        // 設定ファイルから現在のハッシュナンバーを取得
        let current_hash_number = Number(config.HashNumber?.hash_number ?? 1);

        // 有効なファイルを順次登録
        input_song_list_data.valid_files.forEach((title: string) => {
            // 新規曲データのオブジェクトを作成
            const new_song = {
                title: title,
                played: false,
                play_count: 0,
                record_hash: generate_file_hash(title, current_hash_number)
            };

            // 新しいレベルの配列に曲データを追加
            current_json[new_level].push(new_song);
            
            // ハッシュナンバーをインクリメント
            current_hash_number++;
        });

        // 更新されたハッシュナンバーを設定ファイルに保存
        update_hash_number(ini_path, current_hash_number);

        // 更新されたJSONをファイルに保存
        fs.writeFileSync(
            config.MediaPath.new_music_list,
            JSON.stringify(current_json, null, 2),
            'utf-8'
        );

        return true;  // 全ての処理が成功

    } catch (error) {
        console.error('Registration failed:', error);
        return false;  // エラーが発生した場合
    }
}

/**
 * JSONデータと照合しながらwavファイルを移動する関数
 * @param ini_path - 設定ファイルのパス
 * @param source_folder - 移動元フォルダのパス
 * @returns 処理結果を示すboolean値
 */
export function move_wav_files(ini_path: string, source_folder: string): boolean {
    try {
        // 設定ファイルを読み込み
        const config = import_ini(ini_path);
        const target_folder = config.MediaPath.wave_dir;
        
        // JSONファイルからtitleリストを取得
        const json_data = JSON.parse(fs.readFileSync(config.MediaPath.new_music_list, 'utf-8'));
        const registered_titles = new Set<string>();
        
        // 型アサーションを使用して、JSON構造を明示的に指定
        Object.values(json_data).forEach((level: any) => {
            // レベルが配列であることを確認してから処理
            if (Array.isArray(level)) {
                level.forEach(song => {
                    if (typeof song === 'object' && song !== null && 'title' in song) {
                        registered_titles.add(song.title);
                    }
                });
            }
        });

        // 移動元フォルダ内のwavファイルを取得
        const files = fs.readdirSync(source_folder)
            .filter(file => path.extname(file).toLowerCase() === '.wav');

        // 各ファイルの処理
        for (const file of files) {
            const file_name = path.basename(file, '.wav');
            
            // JSONに登録されているtitleと一致するか確認
            if (!registered_titles.has(file_name)) {
                console.error(`エラー: JSONに登録されていないファイルです: ${file}`);
                return false;
            }

            // 移動先のパスを構築
            const source_path = path.join(source_folder, file);
            const target_path = path.join(target_folder, file);

            // 移動先に同名ファイルが存在するかチェック
            if (fs.existsSync(target_path)) {
                console.error(`エラー: 移動先に同名のファイルが存在します: ${file}`);
                return false;
            }

            // ファイルを移動
            try {
                fs.renameSync(source_path, target_path);
            } catch (moveError) {
                console.error(`エラー: ファイルの移動に失敗しました: ${file}`);
                console.error(moveError);
                return false;
            }
        }

        console.log('全てのファイルの移動が完了しました');
        return true;

    } catch (error) {
        console.error('ファイル移動処理でエラーが発生しました:', error);
        return false;
    }
}
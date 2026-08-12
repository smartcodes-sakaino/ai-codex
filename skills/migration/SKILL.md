---
name: migration
description: Use this skill when the user wants to migrate an application built with the Google Sheets pseudo-database approach (from build-kickoff) to a production environment with a real database and hosting, such as AWS or an in-house server — phrases like "本番環境に移行したい", "スプレッドシートDBから本番DBに移したい", "AWSに移行して" or similar. This skill covers choosing the target environment, generating SQL to migrate spreadsheet data into a real database, and updating the app's data-access logic accordingly.
---

# 本番移行用Skill (migration)

build-kickoffで作成した「Googleスプレッドシートを簡易DBとして使うアプリ」を、本番のデータベース・サーバー環境へ移行するSkill。作成環境がローカル/Google Drive+スプレッドシート方式のどちらであっても、DBは常にスプレッドシートで統一されているため、この移行フローは共通で使える。

## コマンド実行時のルール(全ステップ共通)

ファイル操作やコマンド実行など、承認ダイアログが表示される操作を行う前には、必ずその直前に「何をするための操作か」を平易な日本語で一文説明してから実行すること。(配布物のCLAUDE.mdの共通ルールに準じる)

## 全体の流れ

1. 移行先環境の確認
2. スプレッドシートの内容を分析し、本番DBのテーブル設計を作る
3. データ移行用のSQLを作成
4. アプリのDB取得ロジックを改修
5. 移行後の動作確認

---

## Step 1: 移行先環境の確認

**「どの環境に移行するか」を必ずユーザーに確認する。** 固定の選択肢を決め打ちせず、以下のような観点をヒアリングする。

- ホスティング先(例: AWS、自社サーバー、その他クラウド)
- 使用したいデータベースの種類(例: MySQL、PostgreSQLなど。分からなければ提案してよい)
- 現在デプロイ先(Vercel/Cloudflare/Replit等)で公開しているアプリを完全に置き換えるのか、並行稼働させる期間を設けるのか

## Step 2: 本番DBのテーブル設計

1. build-kickoffで作成した「スプレッドシート設計書」と、実際のGoogleスプレッドシートの中身を読み込む
2. スプレッドシートの各シートを、本番DBのテーブルに変換する設計を作る(シート名→テーブル名、列→カラム、データ型の見直し、主キー・外部キーの設定など)
3. 作成したテーブル設計をユーザーに提示し、確認を取る。**ここで一度立ち止まる。**

## Step 3: データ移行用SQLの作成

1. Step 2の設計に基づき、テーブル作成用のSQL(CREATE TABLE等)を作成する
2. スプレッドシートの実データを、本番DBに投入するためのSQL(INSERT文、またはCSVインポート用のスクリプト)を作成する
3. 作成したSQL/スクリプトをユーザーに提示し、実行してよいか確認してから進める

## Step 4: アプリのDB取得ロジックの改修

1. build-kickoffで作成したAPI設計書・実装コードを確認し、スプレッドシートAPIへの読み書き処理を、本番DBへのアクセス処理(SQLクエリ、または該当するORM経由の処理)に置き換える
2. 環境変数・接続情報(DBホスト、認証情報など)の設定方法をユーザーに案内する。**認証情報を直接コードに書き込まない**(`.env`等で管理し、Gitの管理対象外にする)
3. 改修後、Step 1で確認した移行先環境にデプロイする手順を案内する

## Step 5: 移行後の動作確認

1. build-kickoff/test-runnerで作成済みのテスト仕様書を使い、本番DB接続後も同様に動作するか確認する
2. スプレッドシート側のデータと本番DB側のデータに差異がないか、主要なデータについて突き合わせる
3. 問題がなければ、デプロイ先(Vercel/Cloudflare/Replit等)のアプリをどうするか(廃止するか、並行稼働させるか)をユーザーに確認して完了とする

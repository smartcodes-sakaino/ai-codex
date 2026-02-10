# AI Codex

## 概要
AI Codex - プログラミング学習のためのドキュメント管理アプリケーションです。チャプター、問題、解説をブロックベースのエディタで管理し、AI解説・AIレビュー・セルフレビュー機能をサポートします。

## 主な機能
- **ダッシュボード**: チャプターをカードグリッドで表示
  - 編集モードでチャプターの追加/削除/編集
  - ジャンルによる絞り込み機能
  - 名前順/作成日順/カスタム順の並び替え
  - チャプターの順番入れ替え機能（ドラッグ&ドロップ）
  - AI生成アイコン付きチャプターカード
- **チャプターページ**: 問題リストの表示、追加/削除/名前変更/並べ替え
- **問題詳細ページ**: ブロックベースのコンテンツエディタ
  - 問題ブロック: リッチテキスト、画像アップロード（Object Storage）、動画埋め込み
  - コードブロック: シンタックスハイライト、言語選択、コピー機能
  - テキストブロック: 解説テキスト、AI解説生成機能
  - AIレビューダイアログ: 問題・模範解答・解説を基にコードレビュー
  - セルフレビューリンク発行: 研修生向け共有リンクの生成・コピー
- **セルフレビューページ** (`/self-review/:token`): 研修生がコードを提出しAIフィードバックを受ける公開ページ
  - コード入力（テキストエリア）またはZIPファイルアップロード
  - AIが修正不要なら「総評」のみ、修正必要なら「総評/良かった点/改善点/修正点」の4項目を出力
- **設定ページ** (`/settings`): プロンプトテンプレート管理（3タブ）
  - 解説作成用プロンプト
  - AIレビュー用プロンプト
  - セルフレビュー用プロンプト
- **AI機能**: Gemini API (Replit AI Integrations経由)
  - AI解説生成
  - AIコードレビュー
  - セルフレビューフィードバック
  - チャプターアイコン自動生成（画像AI）
- **ダーク/ライトモード**: テーマ切り替え対応
- **マスコット**: Codey（白いブロブに博士帽、ヘッダーとfaviconに表示）

## 技術スタック
- **フロントエンド**: React, TypeScript, Tailwind CSS, Wouter (ルーティング), TanStack Query
- **バックエンド**: Express.js, Drizzle ORM
- **データベース**: PostgreSQL (Neon)
- **ストレージ**: Replit Object Storage（画像・アイコン保存）
- **UI**: shadcn/ui コンポーネント
- **AI**: Google Gemini API (Replit AI Integrations経由、`AI_INTEGRATIONS_GEMINI_API_KEY`)
- **マークダウン**: react-markdown + remark-gfm（AIレビュー結果表示）

## データモデル (shared/schema.ts)
- **chapters**: id, title, genre, icon, colorIndex, order, createdAt
- **problems**: id, chapterId (FK→chapters), title, order, createdAt
- **blocks**: id, problemId (FK→problems), type ("problem"|"code"|"text"), content (JSONB), order
- **prompts**: id ("explanation"|"review"|"self_review"), name, template, updatedAt
- **selfReviewLinks**: id, problemId (FK→problems), token (unique), createdAt

### ブロックコンテンツ型
- **problem**: { text, images[], videoUrl? }
- **code**: { code, language }
- **text**: { text }

## ディレクトリ構造
```
client/
├── src/
│   ├── components/
│   │   ├── blocks/              # ブロックコンポーネント
│   │   │   ├── problem-block.tsx
│   │   │   ├── code-block.tsx
│   │   │   └── text-block.tsx
│   │   ├── ai-review-dialog.tsx # AIレビューダイアログ
│   │   ├── chapter-card.tsx
│   │   ├── problem-card.tsx
│   │   ├── breadcrumb.tsx
│   │   ├── help-dialog.tsx
│   │   ├── ObjectUploader.tsx   # ファイルアップロード
│   │   └── theme-toggle.tsx
│   ├── pages/
│   │   ├── dashboard.tsx        # ダッシュボード
│   │   ├── chapter.tsx          # チャプター詳細
│   │   ├── problem.tsx          # 問題詳細（ブロックエディタ）
│   │   ├── settings.tsx         # 設定（プロンプト管理 3タブ）
│   │   ├── self-review.tsx      # セルフレビューページ（公開）
│   │   └── not-found.tsx
│   ├── lib/
│   │   ├── api.ts               # API関数群
│   │   ├── queryClient.ts       # TanStack Query設定
│   │   └── utils.ts
│   └── hooks/
│       ├── use-theme.tsx        # テーマ管理
│       ├── use-toast.ts
│       └── use-upload.ts        # ファイルアップロード
server/
├── routes.ts                    # API ルート定義
├── storage.ts                   # ストレージインターフェース (Drizzle ORM)
├── db.ts                        # DB接続
├── index.ts                     # サーバーエントリポイント
├── static.ts                    # 静的ファイル配信
├── vite.ts                      # Vite開発サーバー連携
└── replit_integrations/         # Replit統合機能
    ├── object_storage/          # Object Storage連携
    ├── image/                   # 画像生成AI
    ├── chat/                    # チャットAI
    └── batch/                   # バッチ処理
shared/
└── schema.ts                    # データスキーマ・型定義（Drizzle + Zod）
```

## API エンドポイント

### チャプター
- `GET /api/chapters` - チャプター一覧（問題数付き）
- `GET /api/chapters/:id` - チャプター取得
- `POST /api/chapters` - チャプター作成
- `PATCH /api/chapters/:id` - チャプター更新
- `DELETE /api/chapters/:id` - チャプター削除
- `POST /api/chapters/reorder` - チャプター並び替え
- `GET /api/genres` - ジャンル一覧

### 問題
- `GET /api/chapters/:chapterId/problems` - 問題一覧
- `GET /api/problems/:id` - 問題取得（ブロック付き）
- `POST /api/problems` - 問題作成
- `PATCH /api/problems/:id` - 問題更新
- `DELETE /api/problems/:id` - 問題削除
- `POST /api/problems/reorder` - 問題並び替え

### ブロック
- `GET /api/problems/:problemId/blocks` - ブロック一覧
- `POST /api/blocks` - ブロック作成
- `PATCH /api/blocks/:id` - ブロック更新
- `DELETE /api/blocks/:id` - ブロック削除
- `POST /api/blocks/reorder` - ブロック並び替え

### AI
- `POST /api/ai/explain` - AI解説生成
- `POST /api/ai/review` - AIコードレビュー
- `POST /api/ai/self-review` - セルフレビュー実行
- `POST /api/ai/generate-icon` - チャプターアイコン生成

### プロンプト
- `GET /api/prompts` - プロンプト一覧
- `GET /api/prompts/:id` - プロンプト取得
- `PUT /api/prompts/:id` - プロンプト作成/更新

### セルフレビューリンク
- `POST /api/self-review-links` - リンク発行（既存あれば再利用）
- `GET /api/self-review-links/problem/:problemId` - 問題IDでリンク取得
- `GET /api/self-review/:token` - トークンで問題情報取得（公開API）

### ファイルアップロード
- `POST /api/uploads/request-url` - プリサインドURL取得
- Object Storage経由でファイルアップロード

## ルーティング (フロントエンド)
- `/` - ダッシュボード
- `/chapter/:id` - チャプター詳細
- `/problem/:id` - 問題詳細
- `/settings` - 設定ページ
- `/self-review/:token` - セルフレビューページ（公開）

## デザインシステム
- **カラー**: オレンジ (#FF8C42), ピンク (#FF6B9D), ブルー (#4A90E2)
- **グラデーション**: チャプターカードの背景（6色パターン）
- **ボーダー半径**: 16px (カード), 12px (ボタン)
- **シャドウ**: ホバー時に昇格
- **マスコット**: Codey - 白いブロブ、黒い点の目、ピンクの頬、博士帽

## セルフレビュー機能の仕様
- 問題詳細ページからセルフレビューリンクを発行（解説がある問題のみ）
- リンクは問題ごとに1つ生成し、既存があれば再利用（再生成しない）
- トークンはUUIDベースの16文字ランダム文字列
- セルフレビューページは公開アクセス可能（認証不要）
- プロンプトテンプレートはHandlebars風の変数展開（`{{variable}}`、`{{#if variable}}...{{/if}}`）

## 重要な技術的メモ
- AI クライアントは `AI_INTEGRATIONS_GEMINI_API_KEY` と `AI_INTEGRATIONS_GEMINI_BASE_URL` を使用（Replit AI Integrations経由）
- テキスト生成と画像生成の両方で同じAIクライアントを使用
- アセットパス: `@assets` は `attached_assets/` を指す（`client/src/assets/` ではない）
- Object Storage: アイコンは `/objects/icons/` パスに保存
- テーマ設定はlocalStorageに保存

## 開発コマンド
- `npm run dev` - 開発サーバー起動（Express + Vite同時起動、ポート5000）

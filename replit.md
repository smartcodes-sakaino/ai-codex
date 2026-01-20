# AI Codex

## 概要
AI Codex - プログラミング学習のためのドキュメント管理アプリケーションです。チャプター、問題、解説をブロックベースのエディタで管理し、AI解説機能をサポートします。

## 主な機能
- **ダッシュボード**: チャプターをカードグリッドで表示
  - 編集モードでチャプターの追加/削除/編集
  - ジャンルによる絞り込み機能
  - 名前順/作成日順/カスタム順の並び替え
  - チャプターの順番入れ替え機能
- **チャプターページ**: 問題リストの表示、追加/削除/名前変更/並べ替え
- **問題詳細ページ**: ブロックベースのコンテンツエディタ
  - 問題ブロック: リッチテキスト、画像アップロード、動画埋め込み
  - コードブロック: シンタックスハイライト、言語選択、コピー機能
  - テキストブロック: 解説テキスト、AI解説生成機能
- **AI解説機能**: Gemini APIを使用した自動解説生成
- **ダーク/ライトモード**: テーマ切り替え対応
- **ローカルストレージ**: データはブラウザのlocalStorageに保存

## 技術スタック
- **フロントエンド**: React, TypeScript, Tailwind CSS, Wouter (ルーティング)
- **バックエンド**: Express.js
- **UI**: shadcn/ui コンポーネント
- **AI**: Google Gemini API (Replit AI Integrations経由)

## ディレクトリ構造
```
client/
├── src/
│   ├── components/
│   │   ├── blocks/           # ブロックコンポーネント
│   │   │   ├── problem-block.tsx
│   │   │   ├── code-block.tsx
│   │   │   └── text-block.tsx
│   │   ├── chapter-card.tsx
│   │   ├── problem-card.tsx
│   │   ├── breadcrumb.tsx
│   │   └── theme-toggle.tsx
│   ├── pages/
│   │   ├── dashboard.tsx
│   │   ├── chapter.tsx
│   │   └── problem.tsx
│   ├── lib/
│   │   └── storage.ts        # ローカルストレージ管理
│   └── hooks/
│       └── use-theme.tsx     # テーマ管理
server/
├── routes.ts                 # API ルート (AI解説生成)
shared/
└── schema.ts                 # データスキーマ定義
```

## API エンドポイント
- `POST /api/ai/explain` - AI解説生成
  - リクエスト: `{ problem: string, code?: string }`
  - レスポンス: `{ explanation: string }`

## デザインシステム
- **カラー**: オレンジ (#FF8C42), ピンク (#FF6B9D), ブルー (#4A90E2)
- **グラデーション**: チャプターカードの背景
- **ボーダー半径**: 16px (カード), 12px (ボタン)
- **シャドウ**: ホバー時に昇格

## ユーザー設定
- テーマ設定はlocalStorageに保存
- チャプター、問題、ブロックのデータはlocalStorageに保存

## 開発コマンド
- `npm run dev` - 開発サーバー起動

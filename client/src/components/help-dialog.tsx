import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface HelpItem {
  title: string;
  description: string;
}

interface HelpDialogProps {
  title: string;
  items: HelpItem[];
}

export function HelpDialog({ title, items }: HelpDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          data-testid="button-help"
        >
          <HelpCircle className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>
            このページの操作方法を説明します
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          {items.map((item, index) => (
            <div key={index} className="space-y-1">
              <h4 className="font-medium text-sm">{item.title}</h4>
              <p className="text-sm text-muted-foreground">{item.description}</p>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export const dashboardHelp = {
  title: "ダッシュボードの使い方",
  items: [
    {
      title: "チャプターの追加",
      description: "編集モードをONにして「+ チャプター追加」ボタンをクリックします。タイトルとジャンルを入力して作成できます。",
    },
    {
      title: "チャプターの編集・削除",
      description: "編集モードON時に各カードの鉛筆アイコンで名前変更、ゴミ箱アイコンで削除ができます。",
    },
    {
      title: "並び替え",
      description: "編集モードON時に矢印ボタンでチャプターの順番を入れ替えられます。または上部の並び替えメニューから名前順・作成日順に変更できます。",
    },
    {
      title: "フィルター",
      description: "ジャンルでチャプターを絞り込むことができます。",
    },
  ],
};

export const chapterHelp = {
  title: "チャプターページの使い方",
  items: [
    {
      title: "問題の追加",
      description: "編集モードをONにして「+ 問題を追加」ボタンをクリックし、問題のタイトルを入力します。",
    },
    {
      title: "問題の編集",
      description: "編集モードON時に問題カードの鉛筆アイコンで名前変更、ゴミ箱アイコンで削除ができます。",
    },
    {
      title: "問題の並び替え",
      description: "編集モードON時に矢印ボタンで問題の順番を入れ替えられます。",
    },
    {
      title: "問題の詳細",
      description: "問題カードをクリックすると、問題の詳細ページに移動します。",
    },
  ],
};

export const problemHelp = {
  title: "問題ページの使い方",
  items: [
    {
      title: "ブロックの追加",
      description: "「+ ブロック追加」ボタンから問題ブロック、コードブロック、テキストブロックを追加できます。",
    },
    {
      title: "問題ブロック",
      description: "問題文を入力できます。画像のアップロード、YouTube/Vimeoの埋め込み、ローカル動画のアップロードが可能です。",
    },
    {
      title: "コードブロック",
      description: "プログラミング言語を選択してコードを入力できます。シンタックスハイライトが適用されます。",
    },
    {
      title: "テキストブロック",
      description: "解説テキストを入力できます。「AI解説生成」ボタンで問題とコードに基づいた解説を自動生成できます。",
    },
    {
      title: "編集モード",
      description: "「コンテンツ編集」ボタンで編集モードをON/OFFできます。編集モードON時にブロックの並び替えや削除ができます。",
    },
  ],
};

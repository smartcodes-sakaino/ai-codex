// The 取扱説明書 image is offered only for the 総まとめ problems below.
// "full": 旧版の社会人基礎研修 order 11「総まとめ：自分の取扱説明書を作る」（①〜⑦＝名前・タイプ・認知タイプ・心理機能・勉強法・自信・未熟な点）
// "light": 社会人基礎研修（ライト版）8時間目（①入力層 ②タイプ ③納得の条件と劣等機能への備え ④勉強法 ⑤成長の流れ（自信・段） ⑥⑦ルール）
export type SelfManualVariant = "full" | "light";

export const SELF_MANUAL_PROBLEMS: Record<string, SelfManualVariant> = {
  "0966abd1-163b-462e-8aa4-62f99af83888": "full",
  "a708225f-82cc-4bb5-95dd-2f5c53d79e63": "light",
};

export function selfManualVariant(problemId: string): SelfManualVariant | undefined {
  return SELF_MANUAL_PROBLEMS[problemId];
}

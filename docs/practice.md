# 練習與 FSRS

## 題型與佇列

同一設定頁把本機中文詞義、拼字和已存題型放進佇列。已存題型為 vocabulary、grammar、cloze、wordBank、discourse、reading，可選集合、題數與難度。每字一義預設開啟，本機詞義題每字最多一次。

`meaning-questions.ts` 用已保存教材產生四個中文選項，種子打亂保持可重現。干擾答案排除目標字的所有詞義並去重；不足三個不同答案就略過。符合任何接受詞義都判正確，不呼叫 AI。

拼字由 review card 判斷；選擇及文章題由 question card 判斷，錯誤／略過／標記可進結果與重練。輸入法組字、文字欄位、modifier keys 及忙碌狀態隔離快捷鍵，避免編輯時切題。

## 保存與接續

先保存 FSRS／成績，再更新畫面與題序。失敗顯示重試。Snapshot v4 保存 tasks、entryIds、答案、題序、選項、錯題與原本 meaningChoices，重新進入可接續同一次練習。

localStorage 草稿保留操作進度，IndexedDB 保存學習事實；恢復已保存結果不應再次記分。主要模組是 `use-practice-session-actions.ts`、`use-practice-persistence.ts` 與 learning store。

## 排程與進度

`src/lib/fsrs.ts` 使用 ts-fsrs，關閉 fuzz，判定映射 again／good。以 SenseId 為鍵，新的卡或 due <= now 為到期。Stability 至少 21 天計入掌握，lapses 至少四次辨識為難記項目。

每日活動在讀／寫時依日期滾動，沒有 browser 關閉後仍執行的 FSRS Cron。連續七天可取得一次 streak freeze，最多兩次，缺一天可消耗一個。活動保留 90 天，進度從保存資料計算。

## 結果解說

卡片的 AI 解說是單字介紹，題目才分析錯誤答案；混合結果依 typed content 選語意，不能把卡片捏造成答錯題目。解說是可選線上工作，主要作答與排程不靠 AI。

動態結果用一般文件流，底部操作保留在全部結果之後，長解說不被手機操作列覆蓋。相關程式見 `practice-queue.ts` 與結果元件。

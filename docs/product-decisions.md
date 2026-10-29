# Confirmed product decisions

## 單字集內容獨立與遷移（2026-10-10）

依使用者要求，每個單字集各自保存單字、詞義、例句與題目。同一拼字出現在不同集時，編輯、補充詞義與刪除都只作用於所選集。新題目的全部來源必須在同一集。分享匯入會重建整組來源與子題 ID，不保留跨集可變的參照。

舊共享資料按每集原本收錄的詞義與可見題目，一次複製為獨立資料。每詞義的學習卡與歷史明細各自承接；帳號總次數、每日紀錄與連續天數不因此增加。舊文章題若來源橫跨多集，保存在明確的「遷移保留題組」，保留文章與全部子題。

單字集的題目分頁可一次清空本集題目，涵蓋不在搜尋結果中的題目與歷史文法題。題目只在所屬單字集裡瀏覽，沒有跨單字集的題庫總覽頁。確認視窗說明範圍與數量，保存成功後才顯示完成。單字、詞義、例句與其他集的題目保持原狀。保存例句不會自動建立題目；英選中仍是即時單字複習，不寫入題庫。

英選中的正解仍只採本集收錄詞義。其他集同拼字的合法意思只參與「排除錯項」：例如 bank 分別收錄銀行與河岸，兩義不會互相當作錯誤翻譯；不把別集詞義補進本集答案或教材。同一輪以各集單字身份為來源，每個身份最多一次。

本機和雲端各自從舊格式完成一次遷移。新版雲端使用 v9 路徑，保留原待送編輯與刪除的來源紀錄，不把未修改的本機舊副本當成新編輯覆蓋雲端。遷移中斷可接續；完整發布後才清理雲端舊資料。練習草稿重綁原所選集，題序與呈現選項不重抽；來源無法確認時保留原稿並提示處理。

## App 離線與更新流程（2026-10-02）

重新連線不重整正在使用的畫面；原本 Serwist 的 `reloadOnOnline` 預設為 true，
此專案明確關閉。新版 service worker 等候明確的更新操作，第一次安裝仍正常
啟用。依據 [Serwist reloadOnOnline](https://serwist.pages.dev/docs/next/configuring/reload-on-online)、
[等待更新與接管說明](https://serwist.pages.dev/docs/window) 及
[web.dev PWA Update](https://web.dev/learn/pwa/update)。

「我的」顯示檢查更新／重新啟動更新，取得新版時不另外跳出視窗。重啟先等
帳號資料、教材與練習草稿的本機寫入結束，再要求新版接管；接管後
才重新啟動，而且使用者仍須停留在更新入口。其他分頁的更新不重整目前
畫面；離線時保留現在的 App，連線後可再檢查。沒有用 package 版號或 commit
假裝伺服器目前版本，僅呈現實際的等待／接管狀態。

頁面載入失敗時可以重試原 URL，或回到 App；不把所有載入失敗都稱為斷線。
同步狀態仍有 pending 時呈現「等待同步」，也不顯示手動同步完成的成功訊息。
同步期間仍可登出，舊操作完成不會清除登出的忙碌狀態或顯示過期的成功訊息。
既有帳號切換檢查會拒絕舊同步的回覆與完成狀態；登入完成只宣告身分登入。
此輪沒有改持久化 schema。
Serwist 預設的跨來源 NetworkFirst 會保存 API GET 回覆，不能當成帳號資料的
離線存放處。帶 Authorization 的 GET 與跨來源動態資料明確走 NetworkOnly；
啟用新版時刪除舊的登入回覆及 cross-origin 資料快取，App 頁面、公開圖片、
字型、程式與其他資產不因這個清理被刪除。教材與練習內容仍由帳號 namespace
的 IndexedDB 保存，帳號與同步狀態不使用 HTTP 快取補值。

## 備份與同步期間的資料保留（2026-10-02）

備份確認只保存原始檔案與所選帳號，不保存要寫回的本機快照。確認數量隨
最新教材更新；開始執行後固定該次確認內容。教材在儲存佇列內合併最新資料，
重試同一來源也不覆蓋期間新增的內容。匯入失敗時，訊息明確說明原因與可重試
操作；成功才顯示完成。確認文案遵循 [Apple Alerts](https://developer.apple.com/design/human-interface-guidelines/alerts)
的清楚描述與具體行動原則，不暗示尚未發生的刪除或成功。

完整匯入／匯出與帳號 namespace 切換共用佇列。切換不會插入匯入流程之間，
過期帳號的備份操作在寫入前拒絕；匯出先等現有教材寫入完成。同步合併也在
佇列內讀取最新資料與 dirty 記錄，保留同步請求期間的本機編輯。此輪未改
持久化 schema。
同步只有在登入帳號與已載入的 namespace 相符時開始。同步游標、dirty 清除
與完成標記同樣在帳號佇列內檢查 owner，過期的同步不修改新帳號狀態。

## 確認操作的執行回饋（2026-10-02）

共用確認視窗負責執行中、失敗與重試狀態。點下確認後停用再次提交與關閉，
顯示正在處理；成功完成後才關閉。失敗原因留在原視窗，焦點回到重試按鈕，
不另外開一個錯誤視窗。較長內容可在視窗內捲動。依據
[Apple Feedback](https://developer.apple.com/design/human-interface-guidelines/feedback)
與 [Progress indicators](https://developer.apple.com/design/human-interface-guidelines/progress-indicators) 的狀態與可恢復錯誤指引。

單字集、資料夾、題目刪除與備份匯入共用這段行為。登入前的本機資料提示也
保留登入失敗原因，讓人直接重試。備份讀取期間在原本的匯入操作顯示讀取狀態；
正式匯入仍需確認。教材與備份資料都儲存成功，才顯示匯入完成。

## 搜尋與返回位置（2026-10-02）

教材搜尋保留所在資料夾與關鍵字；題庫保留關鍵字、題型與難度。搜尋即時更新，
清除按鈕保留輸入焦點，Escape 可清除搜尋且不干擾中文輸入法。無結果時提供
直接清除搜尋／篩選的操作。參考 [Apple Search fields](https://developer.apple.com/design/human-interface-guidelines/search-fields) 的搜尋範圍與即時回饋指引。

從列表進入單字集，或編輯單字、一般題與閱讀題，返回和儲存後回到原本的
列表條件或單字集分頁。瀏覽狀態由路由參數承載，輸入時只替換當前歷史項目，
不讓返回鍵逐字倒退。教材搜尋只比對該單字集收錄的意思與例句，避免共享
單字的其他意思讓結果看起來不相關。

Decisions here are product truth unless a later entry supersedes them
explicitly. `PRODUCT.md` states the direction; this file records what was
actually settled, and why.

## Brand

**Forest ink green on mist-white neutral surfaces.**

The implementation is a nine-step ramp (`--brand-50` … `--brand-900`) whose dark
theme inverts the ramp rather than introducing a second palette, so one set of
utilities serves both themes. `--success` is deliberately shifted toward teal so
that a success state cannot be read as ordinary brand chrome, and success and
failure always pair an icon with text rather than relying on colour alone.

Decorative illustration stays monochromatic within the green family. Open
Doodles appears only in unused space, loading, empty and completion states.

See `docs/design-system.md` for the tokens, typography and component rules that
follow from this.

## Typeface

Two faces with a strict division of labour: **HarmonyOS Sans TC** for all
interface text, **Newsreader** for lexical content — page titles, section
headings, headwords, parts of speech, example sentences, and figures meant to be
read as results.

HarmonyOS Sans TC is retained as the interface face by explicit decision; it is
bundled locally rather than fetched.

## Agent 寫入

**Agent 產生語言內容，Lexiro 負責結構。**

Agent 撰寫完整句子、干擾項與文章；程式挖空、排序選項、配對理由、建立 id／fingerprint 與來源綁定。Agent 不提供 `answerIndex`，也不自行填底線。題目保留 Agent 的情境干擾項；例句仍是教材，不會自動轉成題目。錯誤題目回逐題診斷，partial 保留有效題，atomic 有錯則不保存。

**Agent 透過 MCP 寫入。** 使用者登入授權後，Agent 可依需求查詢、新增、編輯及刪除自己帳號的教材。Lexiro 不呼叫模型、不管理點數、方案或 provider credentials；命題提示由 Agent 端維護。

## Question formats

**Lexiro stores the formats a Taiwanese senior-high student actually sits.** Generic "which option means X" multiple choice was replaced, because it does not appear on any paper they will take.

The catalogue is `src/lib/question-formats.ts`, and it is the only place counts
are written down. It follows the 115 學年度 學測 paper:

| Format | 題型 | Shape |
| --- | --- | --- |
| `vocabulary` | 詞彙題 | one sentence, one blank, four options |
| `cloze` | 綜合測驗 | passage with blanks, each blank its own four options |
| `wordBank` | 文意選填 | passage with blanks, one shared bank, each option used once |
| `discourse` | 篇章結構 | passage with four sentences removed, five sentence options |
| `reading` | 閱讀測驗 | passage with three to five comprehension questions |

篇章結構 is five-options-for-four-blanks, which is the 115 學年度 change from the
previous four-for-four; getting one wrong no longer forces a second one wrong.

詞彙題保留單格四選一。2026-10-03 使用者指定只留學測題型，獨立文法題與拼字
已移除；英選中保留為單字複習。文法在綜合測驗的文章中處理。舊 grammar record
保留供備份，題庫、計數及練習不納入。

Free-response 中譯英 and 英文作文 are deliberately out of scope: they cannot be
graded automatically, and a wrong auto-grade on a translation teaches the wrong
thing.

## Settings

偏好設定只有外觀主題：跟隨系統、淺色或深色，由本機 `next-themes` 保存，不涉及帳號資料。

Agent 連線與授權在「我的 → Agent 連線」管理，可查看 MCP 網址與已授權應用程式並解除。Agent 使用自己平台的額度，Lexiro 沒有點數、方案或管理員入口。

## Interface

The selected composition is **Focus Canvas / 專注畫布**. Desktop and mobile carry
the same destinations, capabilities, labels and task order.

Structure is carried by hairlines, margins and typographic hierarchy rather than
by nested cards; at most one orchestrated entrance animation per screen.

**練習使用同一份題型清單。** 範圍、題數、英選中與學測五種選擇題型在同一頁設定，
單字複習與學測題型分組，可以混在同一輪。舊的 track 連結只預選題型。
英選中直接從單字庫出題，不呼叫外部服務，也不新增題庫紀錄。每題顯示一個英文單字
與四個不同的中文選項；任何已收錄詞義都可以作為正解，但選項只包含其中一義。
其他三項來自其他單字，排除目標單字的所有已收錄詞義與重複中文；不足三個干擾項
就不出該題。英選中每輪同一個集內的字只出一次，且不受題目難度篩選影響。
答題會記錄題型表現與單字練習進度，不做間隔重複排程（FSRS 已移除）。保存成功才揭答與前進；閱讀
文章的子題仍保持連續，共用已用正解在按鈕及快捷鍵上都停用。

題目、選項與對錯回饋共同置中；固定操作列的預留空間在置中群組之外。視窗高度
不足時，內容從上方開始並可捲動。中斷的英選中練習保存當次選項及答案順序，
v3 單字卡草稿先轉為英選中，再升為 v5，移除退役模式並重排答案及題序；既有學習資料不變。

Saved sets open in read mode at `/app/sets/[setId]`; headwords are not controls.
The explicit edit button opens a word-edit subpage, while adding manually and changing set metadata each open their own subpage. Saving reads the latest library and replaces only that word. The old set edit URL redirects to the view, and `/app/sets/new` retains new-set creation. Questions remain in the neighboring tab.

The 我的 destination is a menu, not the settings form itself. Account, appearance preferences, backup and Agent connections each use a separate route so only the chosen task is revealed and browser Back returns to the menu.

## Cloud sync

**A deletion is something the cloud says, not something it fails to mention.**
Sync used to publish the Library as one packed snapshot and decide, per sync,
whether the local or the cloud copy won. That model has no way to express "this
was deleted": an absent record is indistinguishable from one the other device
has not seen yet, so the cloud copy came back on the next sync and deleting
something took several attempts. Each record now has its own document, and
deleting one writes a tombstone rather than removing it.

**Records sync one at a time.** Two devices that touch different words no longer
conflict at all, and a device that renamed one set sends one document instead of
the whole Library. Reads are a change feed ordered by the server's timestamp, so
a sync costs a query for what changed rather than a download of everything. The
packed model needed a write lock to keep its manifest consistent; that lock had
a five minute lease, and a tab closed mid-publish wedged every other device
until it expired. Independent records need no lock, so there is none.

**A merge repairs, it never refuses.** Two devices can each make a change that
is valid alone and invalid together — the same new folder name on both, or a
question whose set the other device deleted. Rejecting such a pair would leave
the account permanently unable to sync with nothing the user could do about it,
so `repairLibraryState` resolves every conflict to something: a duplicate name
gets a suffix, a reference to something that is gone is dropped.

Credentials are no longer browser data. Journal v5 preserves queued library work,
tracks practice and preference blobs, and records unresolved legacy sources during
set isolation. Full backup v5 contains the current library; v4 is migrated once on import.

**The workspace opens on local data.** Startup waited for the first cloud
reconciliation before showing anything, which put a network round trip — and
every retry of it — in front of the app. The data on the device is the data the
user was working with; sync catches it up underneath.

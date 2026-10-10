# Confirmed product decisions

## 單字集內容獨立與重新出題（2026-10-10）

依使用者要求，每個單字集各自保存單字、詞義、例句與題目。同一拼字出現在不同集時，編輯、補充詞義、刪除與生成都只作用於所選集。新題目的全部來源必須在同一集；全題庫的生成入口先選集。分享匯入會重建整組來源與子題 ID，不保留跨集可變的參照。

舊共享資料按每集原本收錄的詞義與可見題目，一次複製為獨立資料。每詞義的學習卡與歷史明細各自承接；帳號總次數、每日紀錄與連續天數不因此增加。舊文章題若來源橫跨多集，保存在明確的「遷移保留題組」，保留文章與全部子題。

單字集的題目分頁可一次清空本集題目；全題庫可一次清空全部題目，涵蓋不在篩選結果中的題目與歷史文法題。確認視窗說明範圍與數量，保存成功後才顯示完成並提供「重新生成題目」。單字、詞義、例句、學習紀錄與其他集的題目保持原狀。保存例句不會自動建立題目；英選中仍是即時單字複習，不寫入題庫。

英選中的正解仍只採本集收錄詞義。其他集同拼字的合法意思只參與「排除錯項」：例如 bank 分別收錄銀行與河岸，兩義不會互相當作錯誤翻譯；不把別集詞義補進本集答案或教材。同一輪以各集單字身份為來源，每個身份最多一次。

本機和雲端各自從舊格式完成一次遷移。新版雲端使用 v9 路徑，保留原待送編輯與刪除的來源紀錄，不把未修改的本機舊副本當成新編輯覆蓋雲端。遷移中斷可接續；完整發布後才清理雲端舊資料。已完成的生成結果與練習草稿重綁原所選集；原付費操作 ID、用量、題序與呈現選項不重抽。來源無法確認時保留原稿並提示處理，不自動開新付費工作。

## 出題與練習的接續回饋（2026-10-09）

AI 生成重新開啟後保留實際完成數與原工作操作 ID。只接續未完成段落，不把部分成果標為全部完成，也不默默重新付費。帳號、來源與出題契約必須相符；超過 30 分鐘的未完成操作無法續接，已完成題目仍可校對保存。校對排除選擇保留到使用者明確重新生成。

題目儲存中途失敗時，已加入的題目保留，畫面說明數量、原因與重試操作。重試以題庫去重，不重複收錄。練習返回箭頭暫停目前一輪，直接提供既有的接續／重新開始選擇。學習紀錄寫入失敗時，這一題維持未答，錯誤提示留在題目附近，重試成功才揭答與更新進度。

本輪延續既有森林綠工作區、固定操作列與題目靠上配置，沒有替換導覽或版型。生成接續的原始回覆與修復路徑只存在所屬帳號的本機草稿；完成保存後清除草稿。

## App 離線與更新流程（2026-10-02）

重新連線不重整正在使用的畫面；原本 Serwist 的 `reloadOnOnline` 預設為 true，
此專案明確關閉。新版 service worker 等候明確的更新操作，第一次安裝仍正常
啟用。依據 [Serwist reloadOnOnline](https://serwist.pages.dev/docs/next/configuring/reload-on-online)、
[等待更新與接管說明](https://serwist.pages.dev/docs/window) 及
[web.dev PWA Update](https://web.dev/learn/pwa/update)。

「我的」顯示檢查更新／重新啟動更新，取得新版時不另外跳出視窗。重啟先等
帳號資料、教材、學習與模型偏好的本機寫入結束，再要求新版接管；接管後
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
字型、程式與其他資產不因這個清理被刪除。教材與學習內容仍由帳號 namespace
的 IndexedDB 保存，額度與管理結果不使用 HTTP 快取補值。

## 備份與同步期間的資料保留（2026-10-02）

備份確認只保存原始檔案與所選帳號，不保存要寫回的本機快照。確認數量隨
最新教材與學習卡更新；開始執行後固定該次確認內容。教材與學習紀錄分別在
各自的儲存佇列內合併最新資料，重試同一來源也不覆蓋期間新增的內容。
教材已成功而學習紀錄失敗時，訊息明確說明已完成與未完成的部分；兩段都
成功才顯示完成。既有學習卡優先，本機有學習活動時保留本機統計，否則採用
備份統計。確認文案遵循 [Apple Alerts](https://developer.apple.com/design/human-interface-guidelines/alerts)
的清楚描述與具體行動原則，不暗示尚未發生的刪除或成功。

完整匯入／匯出與帳號 namespace 切換共用佇列。切換不會插入兩段匯入之間，
過期帳號的備份操作在寫入前拒絕；匯出先等現有教材與學習寫入完成。同步的
教材／學習合併也在各自佇列內讀取最新資料與 dirty 記錄，保留同步請求期間
的本機編輯。此輪未改持久化 schema，完整備份仍為 v4。
同步只有在登入帳號與已載入的 namespace 相符時開始。同步游標、dirty 清除
與完成標記同樣在帳號佇列內檢查 owner，過期的同步不修改新帳號狀態。

## 管理操作與資料一致性（2026-10-02）

帳號點數／額度變動在儲存前確認目標帳號、變動方向、每期額度與預估餘額；
只改備註時直接儲存。請求只帶有變動的欄位與管理員閱讀時的狀態。帳號或
管理設定已變動時，後端原子拒絕舊狀態，介面提供重新載入，再由管理員確認
新的調整。生成中的預留不會被備註更新歸零，點數及額度仍需等待結算。

儲存完成的畫面、餘額訊息與快取使用後端回傳的實際結果。關閉免費試用只
影響新帳號，不刪除既有點數或教材。缺少歷史成本、待核對或未回報的用量
保留未知狀態，不以 0 代替，也不計算假的單位成本差異。

## 確認操作的執行回饋（2026-10-02）

共用確認視窗負責執行中、失敗與重試狀態。點下確認後停用再次提交與關閉，
顯示正在處理；成功完成後才關閉。失敗原因留在原視窗，焦點回到重試按鈕，
不另外開一個錯誤視窗。較長內容可在視窗內捲動。依據
[Apple Feedback](https://developer.apple.com/design/human-interface-guidelines/feedback)
與 [Progress indicators](https://developer.apple.com/design/human-interface-guidelines/progress-indicators) 的狀態與可恢復錯誤指引。

單字集、資料夾、題目刪除與備份匯入共用這段行為。登入前的本機資料提示也
保留登入失敗原因，讓人直接重試。備份讀取期間在原本的匯入操作顯示讀取狀態；
正式匯入仍需確認。教材與學習紀錄都儲存成功，才顯示匯入完成。

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

## AI generation

**Anything a program can decide is not asked of a model.**

Every field a model has to produce is a field it can get wrong, so the model is
asked only for what needs language judgement — a natural sentence, a plausible
distractor, a coherent passage — and the rest is built in code. In practice:

- The model writes complete prose with the target word still in it, and names
  the span that is the answer. **Code cuts the blank.** A model asked to type
  `_____` in the right place will sometimes type two, sometimes leave the answer
  next to the blank, sometimes number them out of order; a model asked for an
  ordinary sentence does none of that.
- The model never returns `answerIndex`. Code places the answer among the
  distractors and reports where it landed.
- The model never returns ids, fingerprints, timestamps, or the link back to the
  source sense. Those are minted from the request.
- Saved exam questions retain the model's context-specific distractors after
  validation. Example sentences remain study material; they are never converted
  automatically into saved questions.
- An item the model got wrong is dropped and reported, not saved; a batch with
  nothing usable fails so it can be retried.

**AI uses the managed Worker with bounded independent requests.** Learners sign in, choose Lite,
Thinking or Pro, and see point estimates before generation. Provider settings,
credentials and prompts belong to the private backend. The previous manual
copy/paste prompt workflow and BYO-key settings have been removed.

Typed lists and photos first pass through AI organization with a point estimate. The
learner edits and confirms the resulting list before paying for generation.
Generated words preserve supplied meanings, may add at most one common meaning,
and include an example for each meaning. Preview edits are saved only when applied.

Batch size comes from the format table (`questionBatchSize`), not from one global
constant: a 文意選填 passage absorbs eight words, a 篇章結構 passage four. It is the
size of one request, **not** a limit on how much the user may select.

A failing batch does not discard the run: partial results are kept, the failed
batches are listed, and only those can be retried. Cancelling aborts in-flight
requests and keeps what has already been produced.

## Question formats

**Lexiro generates the formats a Taiwanese senior-high student actually sits.**
Generic "which option means X" multiple choice was replaced, because it does not
appear on any paper they will take.

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

詞彙題保留單格四選一。2026-10-03 使用者指定只留學測題型，獨立文法生成與拼字
已移除；英選中保留為單字複習。文法在綜合測驗的文章中處理。舊 grammar record 與
歷史統計保留供備份，題庫、計數及練習不納入。

Free-response 中譯英 and 英文作文 are deliberately out of scope: they cannot be
graded automatically, and a wrong auto-grade on a translation teaches the wrong
thing.

## Settings

Learning preferences save automatically. The account page shows managed point
balance and renewal; authorized administrators manage account allowances there.

AI 模型在學習設定中全域選擇 GPT-5.6 Luna 或 GPT-6 Luna，只影響目前帳號。
兩者共用 Lite／Thinking／Pro 與既有 prompt，分別使用 low／medium／high。
文字整理、圖片整理、單字與題目生成、解析都套用此選擇；一輪執行期間固定
使用啟動時的模型，新的工作才讀取新的偏好。

模型偏好另存於帳號的 `preferences/ai`，以獨立 v1 schema 同步，不混入學習
統計。IndexedDB 依帳號隔離，sync journal 的 v2／v3 遷移到 v4，保留既有
待上傳內容並新增 preferences 標記。其他裝置監聽偏好文件，單獨改模型也能
更新，不必等待教材異動。尚未選擇的帳號預設 GPT-6 Luna。

預估與預留依模型調整；5.6 使用 token 牌價最大比例 2.4 倍作為保守預估。
真正扣款仍按每次回覆的 input、cache read、cache write、output 計算，套用
該模型的快取及長上下文費率，不再乘一次檔位倍率。官方來源：
[GPT-5.6 Luna](https://developers.openai.com/api/docs/models/gpt-5.6-luna) 與
[Standard pricing](https://developers.openai.com/api/docs/pricing)。

## Interface

The selected composition is **Focus Canvas / 專注畫布**. Desktop and mobile carry
the same destinations, capabilities, labels and task order.

Structure is carried by hairlines, margins and typographic hierarchy rather than
by nested cards; at most one orchestrated entrance animation per screen.

**練習使用同一份題型清單。** 範圍、題數、英選中與學測五種選擇題型在同一頁設定，
單字複習與學測題型分組，可以混在同一輪。舊的 track 連結只預選題型。
英選中直接從單字庫出題，不呼叫 AI，也不新增題庫紀錄。每題顯示一個英文單字
與四個不同的中文選項；任何已收錄詞義都可以作為正解，但選項只包含其中一義。
其他三項來自其他單字，排除目標單字的所有已收錄詞義與重複中文；不足三個干擾項
就不出該題。英選中每輪同一個集內的字只出一次，且不受 AI 題目難度篩選影響。
答題會記錄題型表現與單字練習進度，保留 FSRS 排程。保存成功才揭答與前進；閱讀
文章的子題仍保持連續，共用已用正解在按鈕及快捷鍵上都停用。

題目、選項與對錯回饋共同置中；固定操作列的預留空間在置中群組之外。視窗高度
不足時，內容從上方開始並可捲動。中斷的英選中練習保存當次選項及答案順序，
v3 單字卡草稿先轉為英選中，再升為 v5，移除退役模式並重排答案及題序；既有學習資料不變。

Saved sets open in read mode at `/app/sets/[setId]`; headwords are not controls.
The explicit edit button opens a word-edit subpage, while adding manually,
adding with AI and changing set metadata each open their own subpage. The same
word editor serves AI previews, with separate example rows. Saving reads the
latest library and replaces only that word. The old set edit URL redirects to
the view, and `/app/sets/new` retains new-set creation. Questions remain in the
neighboring tab.

The 我的 destination is a menu, not the settings form itself. Account, learning
preferences, plan, backup and administrator tasks each use a separate route so
only the chosen task is revealed and browser Back returns to the menu.

Administration follows the same rule. Account listing, account creation or
editing, usage, and global settings live at distinct `/app/me/admin/...` routes.
Trial points and the initial and monthly defaults for accounts are changed there;
they are not literals chosen by the public account form.

Credit labels use the credit icon as the unit and put `預計` beside estimates.
The public client contains no money-to-credit conversion rule. Administrators
receive the already-settled credit equivalent from the private Worker beside
token and dollar usage, both for one run and for the 30-day report.

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

AI credentials are no longer browser data. Journal v5 preserves queued library
and learning work, tracks the separate model preference, and records unresolved
legacy sources during set isolation. Full backup v5 contains the current library,
learning progress and statistics without credentials; v4 is migrated once on import.

**The workspace opens on local data.** Startup waited for the first cloud
reconciliation before showing anything, which put a network round trip — and
every retry of it — in front of the app. The data on the device is the data the
user was working with; sync catches it up underneath.

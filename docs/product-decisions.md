# Confirmed product decisions

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
- Locally built questions use same-part-of-speech library distractors. Generated
  questions retain the model's context-specific distractors after validation.
- A 詞彙題 whose sense already has an example sentence containing the base form
  is built with **no request at all**: their sentence, their word, their
  distractors.
- An item the model got wrong is dropped and reported, not saved; a batch with
  nothing usable fails so it can be retried.

**AI uses the managed Worker and runs serially.** Learners sign in, choose Lite,
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
| `grammar` | 文法題 | same shape, tests structure rather than meaning (段考) |
| `cloze` | 綜合測驗 | passage with blanks, each blank its own four options |
| `wordBank` | 文意選填 | passage with blanks, one shared bank, each option used once |
| `discourse` | 篇章結構 | passage with four sentences removed, five sentence options |
| `reading` | 閱讀測驗 | passage with three to five comprehension questions |

篇章結構 is five-options-for-four-blanks, which is the 115 學年度 change from the
previous four-for-four; getting one wrong no longer forces a second one wrong.

Both sentence formats require exactly one blank, because a 詞彙題 without a
blank is not a 詞彙題.

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

**練習使用同一份題型清單。** 不再先選每日複習或做題目；範圍、題數、英選中、
拼字與既有六種題型在同一頁設定，可以混在同一輪。舊的 track 連結只預選題型。
英選中直接從單字庫出題，不呼叫 AI，也不新增題庫紀錄。每題顯示一個英文單字
與四個不同的中文選項；任何已收錄詞義都可以作為正解，但選項只包含其中一義。
其他三項來自其他單字，排除目標單字的所有已收錄詞義與重複中文；不足三個干擾項
就不出該題。英選中每輪同一個字只出一次，且不受 AI 題目難度篩選影響。
答題會記錄題型表現與單字練習進度，保留 FSRS 排程。拼字使用實際輸入判分，
確認結果後按下一題儲存，不再詢問是否記得。閱讀文章的子題仍保持連續。

題目、選項與對錯回饋共同置中；固定操作列的預留空間在置中群組之外。視窗高度
不足時，內容從上方開始並可捲動。中斷的英選中練習保存當次選項及答案順序，
v3 單字卡草稿遷移為 v4 英選中草稿，已有的學習資料不變。

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

AI configuration is no longer browser data. Journal v3 retires the AI dirty flag
and local credentials while preserving queued library work. Full backup v2
imports v1 library and learning data but discards its retired AI settings.

**The workspace opens on local data.** Startup waited for the first cloud
reconciliation before showing anything, which put a network round trip — and
every retry of it — in front of the app. The data on the device is the data the
user was working with; sync catches it up underneath.

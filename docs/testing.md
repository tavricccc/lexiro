# 測試與驗證

| 指令 | 檢查 |
| --- | --- |
| `npm run typecheck` | TypeScript |
| `npm run lint` | app／components／lib／stores／src／tests-next 的 Oxlint |
| `npm run test` | vitest.next.config.ts 的單元與元件測試 |
| `npm run build` | Next.js production build，再跑 client prompt boundary |
| `npm run format:check` | stores 和 src/lib 的格式 |

## 依改動驗證

只改文件先跑 `git diff --check`、相對連結與指令核對。地圖產生器另驗原碼引用、資料覆蓋、inline script 和桌面／手機實際操作；沒有改 App 不必為文件新增 App 測試。

Domain 變更主要檢查保存、schema migration、同步與帳號交接；React 變更檢查可操作結果與必要無障礙狀態。使用現有案例，只增加能證明新行為的必要斷言。完整前端交付依序跑 typecheck、lint、test、build。

| 責任 | 既有案例類型 |
| --- | --- |
| 本機原子保存 | library repository、store mutation、learning persistence |
| Sync／帳號 | cloud consistency、sync journal、AI preference |
| 備份 | backup actions、匯入合併與失敗重試 |
| 練習 | setup、meaning choices、review、keyboard、snapshot |
| AI 公開層 | parser、assembly、managed client、serial runner、partial recovery |
| 介面 | navigation、search／return route、confirm dialog、settings autosave |
| PWA | update sequence、cache classification、sync status |

Frontend build 成功不證明真正 Firebase Rules、付費 AI、跨裝置同步或瀏覽器安裝。發布後要分別確認真實登入、同步、AI 串流／結算、PWA 與更新。

Private Worker 的檢查在自己的 repo：typecheck、lint、test、build，使用 Miniflare D1 與合成 Responses。Prompt 評測另見[評測文件](prompt-evaluation.md)，不在普通驗證中自動消耗帳號用量。Node benchmark 不能當成 Cloudflare CPU 額度證明。

## 2026-10-09 本機交付

前端 63 檔／351 項、Worker 14 檔／168 項測試通過，兩邊型別、lint、建置也通過；前端 client boundary 檢查 101 個產物。CLI 模型採樣與這些程式檢查分開記錄，沒有把結構通過當成語意合格。

真正 App 的合成教材在 1366×900、390×844、320×740 深色尺寸驗證作答、重新整理接續、暫停返回、排除名單、部分儲存失敗／重試與完成頁導覽；沒有橫向溢出或 JS 錯誤。最新版錯誤訊息的桌機／手機圖片另由 fresh reviewer 開啟確認。圖片及回條保存在 ignored `.impeccable/review/20261009-ux/`。這不是實體 iPhone 長按翻譯、正式 Firebase／provider 計費或上線驗收。

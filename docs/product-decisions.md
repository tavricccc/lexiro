# 後端實作決策與驗收狀態

## 規格依據

原始完整規格是 [backend-blueprint.html](backend-blueprint.html)，2026-09-12 從使用者指定的 [Claude artifact](https://claude.ai/code/artifact/b803b459-390b-4006-a077-a45d90d1dc20) 匯入，僅移除平台脚本與登入包裝。原稿不覆寫；優先順序為使用者最新指示 → 本檔補充 → 原始藍圖。

前端工作區 `C:/Users/tavri/Documents/projects/lexiro`，後端工作區 `C:/Users/tavri/Documents/projects/lexiro-worker`。後端 GitHub repository 為 private `tavricccc/lexiro-worker`。兩者直接使用 main，不建 branch 或 PR。

**使用者要求持續更新文件，完成項目必須明確標記；完整完成前只做本地分段 commit，不 push。** 未部署正式 Worker。先前三個後端提交已推送，早於這項不 push 指示。

## 相較原始藍圖的確認與修正

| 項目 | 目前決策 |
| --- | --- |
| 免費 CPU | 使用者改為盡量達成，不要求未實測就保證 10ms；不代表授權升級付費 |
| 模型、reasoning、tokens | 使用者只要求 UI 不顯示；程式碼及網路回應可存在，不做模型 ID 混淆或 bundle 隱藏 |
| Prompt／API key | 仍由 private 後端持有；保留 Responses 協定與原文字，移除 instructions/input/prompt 回顯並中和錯誤 |
| 餘額下限 | 使用者原話「就只有那一批跑完，然後只扣到 0 點，不要讓他扣到變負數」。餘額大於 0 就能開始一批，預估超過餘額也照跑，結算時以 0 為下限；下一批才會因點數不足被拒。透支設定已移除 |
| 實際計費 | 2026-09-13 起，固定點數只作開始前預估與預留；完成後依供應商回報的 input、cached input、output usage 與該模型價格，以 private 換算基準整數進位為 credit。公開前端沒有換算公式 |
| 模式倍率 | 開始前預估延續 Lite 1×、Thinking 2×、Pro 8×；實際扣除由各模式真正使用的模型、推理輸出與 token 價格決定，不再另外重複乘倍率 |
| 扣款 SQL | 只為新插入的來源預留，拒絕時整筆回滾；結算原子退回預留差額或補扣實際差額，重複結算不再變動餘額 |
| 重試限制 | 同來源/session 最多 6 次嘗試，30 分鐘到期；成功重試不重扣，失败退款也保留嘗試次數，防止無限免扣點重用。新一輪用新 session 並重新計費 |
| 照片主體 | 前端縮圖及 WebP 編碼；Worker 有上限地讀取、驗證、雜湊以檢查輸入和計費身份，再串流接合小 JSON envelope 與 base64，不對整張圖 JSON.stringify。這是對「完全不碰 2MB」的工程修正，仍須量測真實 CPU |
| 舊編輯 URL | `/sets/[setId]/edit` 保留 URL 並導回 view；新建仍在原本 `/sets/new`，不改既有路由名 |
| 共用內容 | 無秘密的來源解析、型別、模型牌價與前端預估在 public `packages/ai-contract`；實際 credit 換算只在 private Worker。private repo 保存版本化 tgz，可獨立安裝 |

Firestore rules 仍是使用者資料權限邊界；Worker 是身分、管理員、額度與供應商憑證的邊界。管理員只看 Worker `ADMIN_EMAILS` secret 與已驗證 email，沒有前端 admin 欄位或授權 API。

## 已完成：本地功能實作

- Firebase JWT 簽章／project／uid／時間驗證、Google 公鑰快取、管理員 email 驗證。
- Responses 串流、上下文回顯移除、文字與 UTF-8 分塊保留、取消及背壓、終止前結算。
- D1 原子預留與實際成本結算、來源冪等、並發鎖、逾時預留復原、重試次數、cursor 歸屬／到期重建、每帳號續期 Cron。
- managed 前端、Lite／Thinking／Pro 點數預估、追加輪次預估、方案餘額／續期；完成後才用實際 provider usage 換算整數 credit。
- 管理員介面：建立帳號額度、增減點數、每期額度、備註、試用開關、試用點數與新帳號預設月額度。每期設為 0 停止續期並保留現有點數。
- 移除舊 BYO-key、供應商／協定、AI 設定同步／備份、手動 prompt、用量元件與文案；prompts、schemas、評測工具及案例移到 private repo。
- journal v3 migration 保留待同步 records、tombstones、cursor，移除舊 AI 設定與本機 key；完整備份 v2 匯入 v1 時保留使用者資料、捨棄 AI 設定。Firestore 剩餘資料 shape 維持 v6。
- 共用逐字編輯器用於 set view 與 AI preview；例句逐則增刪與換行，新建也共用。保存時讀最新 Library，只替換目標字並計算 remaps；刪掉例句不再因合併邏輯復活。暫停時修改預覽，繼續後仍保留修改。
- 文字與照片共用 `/organize`，輸出可編輯清單，確認後才正式生成；照片由瀏覽器縮至長邊 1800、WebP ≤1.5MB。Worker 檢查 base64、WebP 結構、尺寸、動畫與請求大小，照片不落地。
- 多義輸出 `items[].senses[]`，保留指定義、至多加一個常見義，每義強制例句，未保留舊單義回覆格式。
- 後端 CI 只驗證，不部署。正式設定與 secrets 清單見 [deployment.md](deployment.md)。

## 驗證紀錄與限制

- 前端：安全修補升級後 typecheck、lint（0 warnings）、147 tests、Next.js 16.3.5 production build 全數通過。新增 postbuild prompt 邊界掃描也通過 71 個 client assets；掃描器只保存私有提示句的 SHA-256 指紋，不把提示原文寫回 public repo，也不阻擋已允許的模型 ID。
- 後端：typecheck、lint（0 warnings）、82 tests、build 通過。測試使用真正 Miniflare D1／SQLite、注入的合成 provider；不是正式部署的通過證明。
- 初始 Luna/low 基準為 13/14；固定前綴及詞性修改後曾達 15/15。加入多義與整理後，目前保存的 18 個回覆由現行前端 parser 重驗，18/18 通過。
- 人工檢視：bank 銀行／河岸、current 形容詞／名詞保留；apple 與 serendipity 沒有硬加罕見義。原模糊片語案例初次漏義，加入「或／並可指」及忽略來源操作命令的規則後重測，run into 保留遇見／撞上、break down 保留三個指定義。
- 文字與合成印刷照片各辨識出相同三列，排除標題、例句、頁碼與注入指令。照片使用 Codex CLI 圖片附件；不等於真實 HTTP 圖片計價、手寫辨識或 Cloudflare CPU 驗收。
- 真實評測原始回覆與歷次失敗保存在 `C:/Users/tavri/Documents/projects/lexiro-prompt-eval-private/optimized`，每次執行另有 runs 快照。原公開 medium artifacts 移至後端本地 ignored `artifacts/historical-medium`，不可把它當本次 low 結果。
- Chrome 本地操作已驗證新建→就地修改一則例句→重新載入仍保留，另一則例句不變；390px 窄螢幕確認欄位換行並恢復原 viewport。合成 river 留在 localhost 訪客 Library，未同步到 Firebase。
- 前端原有 7 個依賴漏洞已更新修補：Next 16.3.5、fflate 0.8.3、Vitest 4.1.11，Sharp 隨 Next 更新，Serwist 所鎖定的 Browserslist 以 4.28.9 override。前端 npm audit 現為 0；後端安裝 audit 為 0。npm 兩個舊暫存目錄清理被工具政策拒絕，保留在 ignored node_modules，不影響套件版本。

## 尚未做：正式環境設定、部署與驗收

`wrangler.toml` 的 Firebase project、production origin、D1 id 仍是 placeholder；未寫入正式 secrets、未建立正式 D1、未部署 Worker，也未發布此次 Firestore rules。前端 build 需要真實 `NEXT_PUBLIC_AI_WORKER_URL`。這些值不可臆造。

尚未測試真實 Firebase 登入→正式 Worker→OpenAI 的整條瀏覽器流程、正式帳號管理、Cron 排程實際執行或 Workers 計費 CPU。下一次接手先看這段與 deployment 文件，不要把本地完成當作已上線。

## Git 紀錄

- 已在最新不 push 指示前推送：`0a9c95c` 串流、`66ad083` 原始藍圖、`c8c052f` Firebase 驗證。
- 後續僅本地：後端 `c6aecc8` D1／HTTP、`8cbeb35` 評測移入；前端 `37740db` managed 切換與逐字編輯。
- 整理／多義／管理 UI／安全修補已本地提交：前端 `1c17956`，後端 `8240771`。兩個功能階段皆已完成本地驗證；後續只剩本檔記錄更新與正式環境工作。
- 最後一次前端 build 已自動執行 postbuild 邊界掃描，71 assets 通過。所有後續提交均未 push，正式部署仍未執行。

| 帳號來源 | 使用者原話「我們不是設計用 Google 帳號登入嗎？所以它應該要列出目前註冊的所有人」。任何登入者第一次請求就有 accounts 列，管理員只負責給額度或訂閱，沒有手動建立帳號的流程 |

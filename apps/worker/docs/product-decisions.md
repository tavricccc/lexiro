# 後端實作決策與驗收狀態

## 規格依據

原始完整規格是 [backend-blueprint.html](backend-blueprint.html)，2026-09-12 從使用者指定的 [Claude artifact](https://claude.ai/code/artifact/b803b459-390b-4006-a077-a45d90d1dc20) 匯入，僅移除平台脚本與登入包裝。原稿不覆寫；優先順序為使用者最新指示 → 本檔補充 → 原始藍圖。

前端、App 與後端同在 public monorepo `tavricccc/lexiro` 的 `apps/`，直接在 main 分段提交。原實作批次的推送與 Release 授權只適用於當次工作；後續是否推送依該次使用者要求。Main push 會觸發 Agent 部署，本機開發不操作正式 D1 或手動部署 Worker。

## 目前決策

| 項目 | 決策 |
| --- | --- |
| 免費 CPU | 盡量符合免費額度，不把本地 benchmark 當成 Cloudflare CPU 證明，也不自動升級付費方案 |
| Agent 邊界 | Agent Worker 不持有模型 API key，也不呼叫模型；教材內容由 MCP client 產生，Worker 只驗證、儲存與回傳 |
| Prompt／API key | MCP 出題 prompt 與所有 secret 留在 private 後端；回應移除上下文回顯 |
| 資料 | 教材與偏好存於專用 D1，由 Firebase Auth 限定 uid；前端同步與 MCP 共用 repository。Firestore 已停用，不遷移舊資料、不做 fallback |
| 管理員 | 只依 `ADMIN_EMAILS` secret 與 verified email 判定；沒有前端授權管理員的流程；前端「我的 → 管理員」只對 `GET /admin/status` 回 admin 的帳號顯示，所有權限仍由 Worker 判定 |
| 共用套件 | public `packages/agent-contract` 保存無秘密的教材／資料夾／雲端 DTO 與逐題驗證；private repo 使用版本化 tgz，可獨立安裝 |
| MCP 寫入 | 5 個工具、action.type 分派；expectedRevision／operationId 選填，提供時保留版本衝突與重送檢查，省略仍受 D1 交易 CAS 保護 |
| 題目 | 以 senseId 綁定來源，支援 partial／atomic 與逐題 Error／Warning；篇幅只是警告，解說選填。生成題格式錯誤時回條附 hint 指向 prompt 的 outputSchema |
| 單集 URL | 預設兩小時，只管理固定 uid＋setId；bearer token 只存 hash，撤銷即失效 |
| 房間 | 6 碼、最多 8 人，伺服器判分且答案不送給玩家；重連直接回到目前題目，WebSocket 以一次性 ticket 授權 |

Firestore rules 是使用者資料權限邊界；Agent Worker 是 Firebase 身分、教材 D1 與 OAuth 憑證的邊界。

## 部署與驗證界線

正式 D1 已在部署設定中配置；Firebase project 由 GitHub `Production` Environment 注入，不是等待本地填寫的空專案。`.github/workflows/deploy-agent.yml` 在 main push 後先跑四項驗證，再套用兩組 migrations、部署 Agent 及檢查 health／OAuth discovery。**推送 main 會部署**，細節見 [agent-deployment.md](agent-deployment.md)。

本次驗證使用本地 Miniflare D1 與合成 Firebase 身分。覆蓋 OAuth S256、限流、批次 CAS／分頁／帳號隔離、200 筆與資料夾、前端同步互通、單集 URL、分享連結與房間流程。前後端都執行 typecheck、lint、test、build；本地通過不等於正式環境驗收。

未執行真實 Firebase→Agent→D1 的正式批次寫入、Cron 排程實際驗收或 Cloudflare CPU 量測。歷史 Agent 發布回條另見 [agent-deployment.md](agent-deployment.md)，不能當成本次發布的新驗收結果。

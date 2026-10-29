# Lexiro Worker

Lexiro 的 private 後端只保留 Agent Worker。Agent Worker 負責教材 D1 同步、MCP OAuth、單集授權 URL、連線對戰與網站同步；Firebase 只負責登入。AI 生成 Worker 已封存於分支 `archive/managed-ai`，目前教材內容由 MCP（Agent Worker）寫入，服務本身不呼叫模型。

## 請求流程

Firebase ID token／Origin → App Check（選用）→ D1 教材／同步／MCP／單集 URL／房間。管理員只由 `ADMIN_EMAILS` 與已驗證 email 判定，沒有前端授權入口。MCP bearer、link token 與 OAuth provider 端點不套用 App Check。

## 本機

使用 PowerShell 7，配置 `.dev.vars` 後執行：

```powershell
npm ci
npm run db:migrate:agent
npm run db:migrate:cloud
npm run dev:agent
```

本機 migration 只用 local D1。自動測試使用本地 D1 與合成 Firebase 身分，不呼叫模型。

```powershell
npm run typecheck
npm run lint
npm run test
npm run build
```

## 文件

- [程式責任](structure.md)
- [公開端點與資料生命週期](docs/architecture.md)
- [Agent 存取](docs/agent-access.md)
- [D1 Agent 部署](docs/agent-deployment.md)
- [決策與驗收紀錄](docs/product-decisions.md)

共用契約 4.9.0 來自 frontend packages/agent-contract，以 vendor tgz 固定。Agent D1 migration 至 0005，教材 D1 至 0006；正式是否套齊以部署紀錄為準。Main push 會部署 Agent，普通本機檢查不會；本地通過不等於真實 Firebase／D1、Cron 或 Cloudflare CPU 已驗收。

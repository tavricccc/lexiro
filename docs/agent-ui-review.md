# Agent 連線介面驗收

2026-10-10。本次是既有學習工作區的普通延伸：新增單字集 scoped URL、MCP OAuth 同意頁與連線管理，不更換視覺方向。獨立 finish reviewer 的 disposition 為 `ship`，僅適用於指定程式與下列訪客畫面。

## 與既有系統比對

- 新增／已保存單字集的入口沿用頁首 `Button` 與 `Icons.ai`；「我」頁沿用既有列表入口。文案由 `t()` 提供。
- 授權對話框沿用 Radix Dialog、既有浮層表面、`Button`、`Input`、`ListSection`／`ListPicker`；OAuth 與管理頁沿用 `PageHeader`、列表、返回及載入元件。
- 配色與錯誤訊息使用既有語意 token，標題／資料列使用共用字級。沒有新增點陣圖、approved comp、token 或視覺世界；`DESIGN.md` 與 `.impeccable/design.json` 保持不變。

## 證據與範圍

訪客桌機入口與管理頁：[agent-entry-desktop.png](../.impeccable/review/agent-entry-desktop.png)、[agent-connections-desktop.png](../.impeccable/review/agent-connections-desktop.png)。訪客手機對話框、管理頁與 OAuth 登入頁：[agent-dialog-mobile.png](../.impeccable/review/agent-dialog-mobile.png)、[agent-connections-mobile.png](../.impeccable/review/agent-connections-mobile.png)、[agent-oauth-mobile.png](../.impeccable/review/agent-oauth-mobile.png)。本輪 detector JSON 為 `[]`；這不是登入後狀態或全部可及性項目的驗收。

`tests-next/agent-access-dialog.test.tsx` 的三項測試涵蓋登入前不建立單字集、同步失敗重試保留已建集（預設兩小時並可撤銷），以及公開 OAuth 頁初始化登入與授權錯誤。測試使用模擬帳號與 API，不能視為正式服務連線證據。

尚未實測登入後視覺、Firestore／ChatGPT 正式連線、鍵盤焦點循環、computed contrast 或深色模式。本次結論限定為訪客截圖與 `components/agent/{access-dialog,oauth-consent,connections-page}.tsx`、既有 `set-editor`／`set-view`／`me-page` 入口的系統一致性。

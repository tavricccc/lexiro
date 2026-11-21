import { isRouteErrorResponse, useRouteError } from "react-router";
import { ErrorState } from "design-kit";

export function RouteError() {
  const error = useRouteError();
  const stale = error instanceof TypeError && /dynamically imported module|Importing a module script failed/.test(error.message);
  const message = stale ? "Lexiro 有新版本，重新載入即可使用。"
    : isRouteErrorResponse(error) ? `${error.status} ${error.statusText}`
    : error instanceof Error ? error.message : "未知的錯誤";
  return (
    <div className="mx-auto max-w-xl px-6 py-16">
      <ErrorState message={message} onRetry={() => location.reload()} retryLabel="重新載入" title={stale ? "需要更新" : "這個畫面打不開"} />
    </div>
  );
}

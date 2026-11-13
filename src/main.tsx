import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import { routes } from "./app/routes";
import { setKitNavigation } from "./app/root";
import { routerNavigation } from "./app/navigation";
import "./styles/app.css";

const router = createBrowserRouter(routes);
setKitNavigation(routerNavigation(router));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);

// The service worker is built for production only (vite.config.ts).
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => void navigator.serviceWorker.register("/sw.js", { scope: "/" }));
}

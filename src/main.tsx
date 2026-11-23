import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import { UpdateGate } from "./app/update-gate";
import { routes } from "./app/routes";
import { setKitNavigation } from "./app/root";
import { routerNavigation } from "./app/navigation";
import "./styles/app.css";

const router = createBrowserRouter(routes);
setKitNavigation(routerNavigation(router));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <UpdateGate>
      <RouterProvider router={router} />
    </UpdateGate>
  </StrictMode>,
);

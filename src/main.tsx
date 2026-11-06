import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "./pages/App";
import { ConfirmHost, ToastHost } from "./ui/kit";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ToastHost>
      <ConfirmHost>
        <App />
      </ConfirmHost>
    </ToastHost>
  </StrictMode>,
);

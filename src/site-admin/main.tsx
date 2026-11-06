// The CMS that ships inside every exported website (admin.html + cms/admin.js).
// It uses the same editor and preview as the Studio, and saves by committing to the site's own repository.

import { createRoot } from "react-dom/client";
import "../index.css";
import { ConfirmHost, ToastHost } from "../ui/kit";
import { SiteAdmin } from "./SiteAdmin";

createRoot(document.getElementById("root")!).render(
  <ToastHost>
    <ConfirmHost>
      <SiteAdmin />
    </ConfirmHost>
  </ToastHost>,
);

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./pages/app/community-reference-layout-fix.css";
import "./i18n";

createRoot(document.getElementById("root")!).render(<App />);

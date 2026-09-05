import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./pages/app/community-reference-layout-fix.css";
import "./pages/app/community-reference-final.css";
import "./i18n";

document.title = "Voxar.app — StudioVoxario";

createRoot(document.getElementById("root")!).render(<App />);

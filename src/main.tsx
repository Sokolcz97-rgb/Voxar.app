import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./pages/app/community-reference-final.css";
import "./pages/app/community-reference-layout-fix.css";
import "./pages/app/community-reference-pass3.css";
import "./pages/app/community-reference-pass4.css";
import "./pages/app/community-reference-pass5.css";
import "./pages/app/community-reference-pass6.css";
import "./pages/app/community-reference-pass7.css";
import "./components/vox/reference/community-structured-chat.css";
import "./components/vox/reference/community-structured-chat-hotfix.css";
import "./components/vox/reference/community-structured-panels.css";
import "./components/vox/reference/community-channel-list.css";
import "./components/vox/reference/community-structured-shell.css";
import "./components/vox/reference/community-structured-topbar-bridge.css";
import "./components/vox/reference/community-structured-workspace.css";
import "./i18n";

const syncAppTitle = () => {
  if (window.location.pathname.startsWith("/app")) {
    const desired = "Voxar.app — StudioVoxario";
    if (document.title !== desired) document.title = desired;
  }
};

syncAppTitle();
window.addEventListener("popstate", syncAppTitle);

const originalPushState = history.pushState.bind(history);
history.pushState = ((...args: Parameters<History["pushState"]>) => {
  originalPushState(...args);
  queueMicrotask(syncAppTitle);
}) as History["pushState"];

const originalReplaceState = history.replaceState.bind(history);
history.replaceState = ((...args: Parameters<History["replaceState"]>) => {
  originalReplaceState(...args);
  queueMicrotask(syncAppTitle);
}) as History["replaceState"];

const titleObserver = new MutationObserver(syncAppTitle);
titleObserver.observe(document.head, { childList: true, subtree: true, characterData: true });

createRoot(document.getElementById("root")!).render(<App />);

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./components/vox/reference/community-structured-chat.css";
import "./components/vox/reference/community-structured-chat-hotfix.css";
import "./components/vox/reference/community-structured-panels.css";
import "./components/vox/reference/community-channel-list.css";
import "./components/vox/reference/community-structured-shell.css";
import "./components/vox/reference/community-structured-settings.css";
import "./components/vox/reference/community-app-shell-v4.css";
import "./components/vox/reference/community-app-shell-v5.css";
import "./components/vox/reference/community-panel-recovery-v6.css";
import "./components/vox/reference/community-polish-v7.css";
import "./components/vox/reference/community-topbar-polish-v10.css";
import "./components/vox/reference/community-reference-convergence-v14.css";
import "./components/vox/reference/community-reference-lock-v15.css";
import "./components/vox/reference/community-reference-pass-v16.css";
import "./components/vox/reference/community-reference-bundle-v17.css";
import "./components/vox/reference/community-reference-megapass-v18.css";
import "./components/vox/reference/community-reference-megapass-v18-extra.css";
import "./components/vox/reference/community-reference-final-v19.css";
import "./components/vox/reference/community-reference-voice-v19.css";
import "./components/vox/reference/community-reference-final-v19-extra.css";
import "./components/vox/reference/community-reference-master-v20.css";
import "./components/vox/reference/community-reference-chat-v20.css";
import "./components/vox/reference/community-reference-voice-v20.css";
import "./components/vox/reference/community-reference-legibility-v20.css";
import "./components/vox/reference/community-reference-convergence-v21.css";
import "./components/vox/reference/community-reference-cleanup-v21.css";
import "./components/vox/reference/community-reference-convergence-v22.css";
import "./components/vox/reference/community-reference-fixes-v22.css";
import "./components/vox/reference/community-reference-convergence-v23.css";
import "./components/vox/reference/community-reference-voice-v23.css";
import "./components/vox/reference/community-reference-exact-v24.css";
import "./components/vox/reference/community-reference-voice-exact-v24.css";
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

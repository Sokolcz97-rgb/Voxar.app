import { StudioHub } from "@/components/hub/StudioHub";

type DesktopBridge = {
  isDesktop?: boolean;
  returnToLauncher?: () => Promise<unknown>;
};

/**
 * /launcher used to contain a second web module selector (StudioVoxario Hub vs.
 * VoxarioBrowser). The desktop app already has its own native module launcher,
 * so that extra screen only duplicated the choice and forced an unnecessary
 * second click before entering StudioVoxario Hub.
 *
 * The /launcher route is now the Hub itself. In Electron, "Return to Hub"
 * returns to the native StudioVoxario launcher. On the normal website we fall
 * back to browser history (or the home page when there is no previous entry).
 */
export default function GameLauncher() {
  const returnFromStudioHub = () => {
    const desktop = (window as typeof window & { studioVoxarioDesktop?: DesktopBridge }).studioVoxarioDesktop;

    if (desktop?.isDesktop && desktop.returnToLauncher) {
      void desktop.returnToLauncher();
      return;
    }

    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.assign("/");
    }
  };

  return <StudioHub onReturn={returnFromStudioHub} />;
}

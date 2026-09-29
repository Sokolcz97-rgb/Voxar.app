import { QuickHelp } from "@/components/QuickHelp";

/** Desktop-shell compatibility wrapper: no AI/API calls while AI is disabled. */
export function AIHelperHolo() {
  return <QuickHelp variant="holo" />;
}

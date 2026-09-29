import { QuickHelp } from "@/components/QuickHelp";

/** Compatibility wrapper: the former AI helper is temporarily replaced by deterministic local help. */
export function AIHelper() {
  return <QuickHelp variant="web" />;
}

import { supabase } from "@/integrations/supabase/client";
import type { Appearance, Fighter, FightResult, GameState, HeroClass, Item, StatKey } from "./types";

/**
 * Tenká vrstva nad serverovými RPC Ashes of Eryon.
 * Server je autoritativní – klient jen posílá záměr a vykresluje výsledek.
 */
type RpcClient = { rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }> };
const client = supabase as unknown as RpcClient;

async function call<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(cleanError(error.message));
  return data as T;
}

function cleanError(message: string) {
  return message.replace(/^.*?ERROR:\s*/i, "").replace(/\s*CONTEXT:.*$/s, "").trim() || "Něco se pokazilo.";
}

export const ashesApi = {
  state: () => call<GameState>("ashes_state"),
  createCharacter: (name: string, cls: HeroClass, appearance: Appearance) =>
    call<GameState>("ashes_create_character", { p_name: name, p_class: cls, p_appearance: appearance }),
  startQuest: (id: string) => call<GameState>("ashes_start_quest", { p_quest: id }),
  finishQuest: (skip = false) => call<FightResult>("ashes_finish_quest", { p_skip: skip }),
  fightBoss: () => call<FightResult>("ashes_fight_boss"),
  train: (stat: StatKey) => call<GameState>("ashes_train", { p_stat: stat }),
  equip: (id: string, on = true) => call<GameState>("ashes_equip", { p_item: id, p_on: on }),
  sell: (id: string) => call<GameState>("ashes_sell", { p_item: id }),
  shop: () => call<Item[]>("ashes_shop"),
  buy: (id: string) => call<GameState>("ashes_buy", { p_item: id }),
  opponents: () => call<Fighter[]>("ashes_arena_opponents"),
  arenaFight: (id: string) => call<FightResult>("ashes_arena_fight", { p_target: id }),
  hallOfFame: () => call<{ name: string; class: HeroClass; level: number; honor: number; chapter: number; eryon: boolean }[]>("ashes_hall_of_fame"),
  claimEryon: (on: boolean) => call<GameState>("ashes_claim_eryon", { p_on: on }),
  eryonSay: (text: string) => call<GameState>("ashes_eryon_say", { p_text: text }),
  adminWorld: (open: boolean) => call<GameState>("ashes_admin_world", { p_open: open }),
};

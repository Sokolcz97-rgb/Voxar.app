// Výchozí seznam blokovaných slov pro automod.
// Tyto se aplikují VŽDY (pokud je automod zapnutý) – nejde je v UI vypsat.
// Uživatelské automod_blocked_words se přidávají navíc.

export const DEFAULT_BLOCKED_WORDS = [
  // CZ vulgarismy
  'kurva', 'kurvy', 'kurvě', 'kurvo', 'zkurvenej', 'zkurvený', 'zkurvená', 'zkurvene',
  'piča', 'pica', 'piču', 'picu', 'pičo', 'pico', 'pičus', 'picus',
  'mrdat', 'mrdka', 'mrd', 'mrdám', 'vymrdat', 'zmrd', 'zmrde', 'zmrda',
  'kokot', 'kokote', 'kokota', 'kokoti',
  'čurák', 'curak', 'čuráka', 'curaka', 'čuráku', 'curaku',
  'hovno', 'hovna', 'sračka', 'srackа', 'sracky', 'srát', 'serou',
  'debil', 'debile', 'debilní', 'idiot', 'idiote', 'kreten', 'kretén',
  'buzerant', 'buzna', 'buzny', 'teplouš',
  'cikán', 'cikan', 'cigán', 'cigan', 'cigoš', 'cigos',
  'negr', 'negři', 'negra', 'negre',
  'jebat', 'jebe', 'jebnutý', 'jebnuty', 'vyjebat', 'nasrat',
  'svině', 'svine', 'sviňa',
  'šukat', 'sukat', 'šuká', 'suka',
  'prdel', 'prdele', 'prdelka',

  // EN vulgarity / slurs
  'fuck', 'fucking', 'fucker', 'motherfucker', 'fck',
  'shit', 'bullshit', 'bitch', 'bitches', 'asshole', 'ass',
  'cunt', 'dick', 'pussy', 'cock', 'whore', 'slut',
  'bastard', 'twat', 'wanker',
  'retard', 'retarded',
  'faggot', 'fag',

  // N-words (rasistické nadávky – vždy blokováno)
  'nigger', 'niggers', 'nigga', 'niggas', 'n1gger', 'n1gga',

  // NSFW / sexuální obsah
  'porn', 'porno', 'xxx', 'sexchat', 'nude', 'nudes',
];

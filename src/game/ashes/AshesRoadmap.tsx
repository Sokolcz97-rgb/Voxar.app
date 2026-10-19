import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { L, setLang, useLang } from "./i18n";
import "./ashes.css";
import "./roadmap.css";

/**
 * Veřejná roadmapa Ashes of Eryon (studiovoxario.com/hra/roadmap).
 * Termíny a obsah se upravují jen v poli MILESTONES níže.
 */

type Status = "now" | "next" | "planned";
type Milestone = {
  /** Přesný začátek (ISO) – u akce s odpočtem. */
  at?: string;
  when: { cs: string; en: string };
  title: { cs: string; en: string };
  act?: string;
  status: Status;
  text: { cs: string; en: string };
  items: { cs: string; en: string }[];
};

/** První testování: sobota 24. 10. 2026 v 17:00 (letní čas, UTC+2). */
const FIRST_TEST = "2026-10-24T17:00:00+02:00";

const MILESTONES: Milestone[] = [
  {
    at: FIRST_TEST,
    when: { cs: "Sobota 24. 10. 2026 · 17:00", en: "Saturday 24 Oct 2026 · 5 PM CEST" },
    title: { cs: "První testování", en: "First playtest" },
    act: "I",
    status: "now",
    text: {
      cs: "Uzavřený test 1. aktu „Poslední štít“. Otevřený svět pobřeží Kalidry, obě strany války a první příběhové úkoly.",
      en: "Closed test of Act I “The Last Shield”. The open world of Kalidra's coast, both sides of the war and the first story quests.",
    },
    items: [
      { cs: "Přihláška přes ticket na studiovoxario.com", en: "Sign up with a ticket on studiovoxario.com" },
      { cs: "Obránci Kalidry i Legie Rudého slunce", en: "Defenders of Kalidra and the Legion of the Red Sun" },
      { cs: "16 postav s rozhovory, 15 úkolů, aréna a válka o hradby", en: "16 characters to talk to, 15 quests, the arena and the war for the walls" },
      { cs: "Hra v prohlížeči i přes launcher pro Windows", en: "Play in the browser or through the Windows launcher" },
    ],
  },
  {
    when: { cs: "Listopad 2026", en: "November 2026" },
    title: { cs: "Opravy a otevřená alfa", en: "Fixes and open alpha" },
    act: "I",
    status: "next",
    text: {
      cs: "Opravíme vše, co najdete při testu, a otevřeme brány Kalidry všem přihlášeným hráčům.",
      en: "We fix everything you find during the test and open the gates of Kalidra to every signed-in player.",
    },
    items: [
      { cs: "Úpravy podle zpětné vazby testerů", en: "Changes based on tester feedback" },
      { cs: "Lepší modely postav a zvířat", en: "Better character and animal models" },
      { cs: "Hra otevřená všem s účtem StudioVoxario", en: "Open to everyone with a StudioVoxario account" },
    ],
  },
  {
    when: { cs: "Prosinec 2026", en: "December 2026" },
    title: { cs: "Oheň Kalidry", en: "Fire of Kalidra" },
    act: "II",
    status: "planned",
    text: {
      cs: "Druhý akt ságy. Ohně na horách, obležené město a nové části mapy za hradbami.",
      en: "The second act of the saga. Fires on the mountains, a besieged city and new parts of the map beyond the walls.",
    },
    items: [
      { cs: "Nové území a příběhové úkoly", en: "New territory and story quests" },
      { cs: "Píseň „Oheň Kalidry“ v celé kapitole", en: "The song “Fire of Kalidra” throughout the chapter" },
    ],
  },
  {
    when: { cs: "Začátek roku 2027", en: "Early 2027" },
    title: { cs: "Pochod bronzu", en: "March of Bronze" },
    act: "III",
    status: "planned",
    text: {
      cs: "Třetí akt. Vojska vyrážejí z Kalidry a hráči se poprvé spojí do družin.",
      en: "Act III. Armies march out of Kalidra and players band together for the first time.",
    },
    items: [
      { cs: "Družiny a společné výpravy", en: "Warbands and group expeditions" },
      { cs: "Bitvy více hráčů najednou", en: "Battles with several players at once" },
    ],
  },
  {
    when: { cs: "Jaro 2027", en: "Spring 2027" },
    title: { cs: "Moře krve", en: "Sea of Blood" },
    act: "IV",
    status: "planned",
    text: { cs: "Čtvrtý akt. Válka se přenese na moře k černým lodím Legie.", en: "Act IV. The war moves to the sea and the Legion's black ships." },
    items: [{ cs: "Bitvy u pobřeží a na lodích", en: "Battles on the coast and aboard ships" }],
  },
  {
    when: { cs: "Léto 2027", en: "Summer 2027" },
    title: { cs: "Koruna popela", en: "Crown of Ash" },
    act: "V",
    status: "planned",
    text: { cs: "Pátý akt. Kdo vládne popelu, vládne Kalidře.", en: "Act V. Whoever rules the ashes rules Kalidra." },
    items: [{ cs: "Rozhodnutí, která změní svět pro všechny hráče", en: "Decisions that change the world for every player" }],
  },
  {
    when: { cs: "Podzim 2027", en: "Autumn 2027" },
    title: { cs: "Poslední pochod", en: "The Last March" },
    act: "VI",
    status: "planned",
    text: { cs: "Finále ságy Eryona a Azkara.", en: "The finale of the saga of Eryon and Azkar." },
    items: [{ cs: "Závěrečná bitva obou stran", en: "The final battle of both sides" }],
  },
];

function useCountdown(iso: string) {
  const target = new Date(iso).getTime();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const left = Math.max(0, target - now);
  return {
    done: left === 0,
    d: Math.floor(left / 86_400_000),
    h: Math.floor(left / 3_600_000) % 24,
    m: Math.floor(left / 60_000) % 60,
    s: Math.floor(left / 1000) % 60,
  };
}

export default function AshesRoadmap() {
  const lang = useLang();
  const t = (x: { cs: string; en: string }) => x[lang];
  const cd = useCountdown(FIRST_TEST);
  const statusLabel: Record<Status, string> = {
    now: L("Už brzy", "Coming up"),
    next: L("Další krok", "Next step"),
    planned: L("Plánováno", "Planned"),
  };

  return (
    <div className="ashes-root rm-root">
      <div className="rm-bg" aria-hidden />
      <header className="rm-top">
        <Link to="/hra" className="rm-logo"><img src="/game/eryon/wordmark.webp" alt="Ashes of Eryon" /></Link>
        <div className="rm-actions">
          <button className="ash-icon-btn lang" onClick={() => setLang(lang === "cs" ? "en" : "cs")}>{lang === "cs" ? "EN" : "CZ"}</button>
          <Link to="/desktop#ashes" className="ash-btn ghost small">{L("Stáhnout", "Download")}</Link>
          <Link to="/hra" className="ash-btn small">{L("Hrát", "Play")}</Link>
        </div>
      </header>

      <main className="rm-main">
        <section className="rm-hero">
          <div className="ash-kicker">{L("Roadmapa · sága o šesti aktech", "Roadmap · a saga in six acts")}</div>
          <h1 className="ash-title">{L("Cesta Kalidry", "The Road of Kalidra")}</h1>
          <p className="ashes-prose">
            {L(
              "Co a kdy v Ashes of Eryon čekat – od prvního testování až po finále ságy. Termíny vzdálenějších aktů jsou orientační a podle vývoje se mohou posunout.",
              "What to expect in Ashes of Eryon and when – from the first playtest to the finale of the saga. Dates of later acts are estimates and may shift as development goes on.",
            )}
          </p>

          <div className="rm-countdown ash-frame">
            <div>
              <div className="ash-kicker">{L("První testování", "First playtest")}</div>
              <b>{L("Sobota 24. října · 17:00", "Saturday 24 October · 5 PM CEST")}</b>
            </div>
            {cd.done ? (
              <div className="rm-live">{L("Testování právě probíhá!", "The playtest is live!")}</div>
            ) : (
              <div className="rm-clock" aria-label={L("Odpočet do testování", "Countdown to the playtest")}>
                {[
                  [cd.d, L("dní", "days")],
                  [cd.h, L("hod", "hrs")],
                  [cd.m, L("min", "min")],
                  [cd.s, L("s", "sec")],
                ].map(([v, label]) => (
                  <span key={label as string}><b>{String(v).padStart(2, "0")}</b><small>{label}</small></span>
                ))}
              </div>
            )}
          </div>
        </section>

        <ol className="rm-line">
          {MILESTONES.map((m, i) => (
            <li key={i} className="rm-item" data-status={m.status}>
              <div className="rm-node">{m.act ? <span>{m.act}</span> : null}</div>
              <article className="rm-card ash-frame">
                <div className="rm-meta">
                  <span className="rm-when">{t(m.when)}</span>
                  <span className="rm-badge">{statusLabel[m.status]}</span>
                </div>
                <h2 className="ash-title">
                  {m.act && <small>{L("Akt", "Act")} {m.act} · </small>}
                  {t(m.title)}
                </h2>
                <p className="ashes-prose">{t(m.text)}</p>
                <ul>
                  {m.items.map((it, j) => <li key={j}>{t(it)}</li>)}
                </ul>
              </article>
            </li>
          ))}
        </ol>

        <footer className="rm-foot">
          <p>{L("Chceš být u prvního testování? Vytvoř si ticket na studiovoxario.com.", "Want to join the first playtest? Create a ticket on studiovoxario.com.")}</p>
          <Link to="/" className="ash-btn ghost small">StudioVoxario</Link>
        </footer>
      </main>
    </div>
  );
}

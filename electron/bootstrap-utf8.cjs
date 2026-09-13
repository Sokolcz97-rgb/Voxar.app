"use strict";

// Force Windows PowerShell output to UTF-8 before the real desktop bootstrap
// loads. Node decodes child-process stdout as UTF-8, while Windows PowerShell
// can otherwise emit the active legacy console code page when stdout is piped.
// That mismatch produced replacement characters (�) in Czech Windows Update
// titles and other localized Defender/Windows text inside VoxarioProtect.
if (process.platform === "win32") {
  const childProcess = require("child_process");
  const originalSpawn = childProcess.spawn;
  const utf8Prelude = [
    "$__voxarioUtf8 = New-Object System.Text.UTF8Encoding($false)",
    "[Console]::OutputEncoding = $__voxarioUtf8",
    "$OutputEncoding = $__voxarioUtf8",
  ].join(";") + ";";

  childProcess.spawn = function voxarioUtf8Spawn(command, args, options) {
    const argv = Array.isArray(args) ? [...args] : args;
    const executable = String(command || "").replace(/^.*[\\/]/, "").toLowerCase();

    if ((executable === "powershell.exe" || executable === "powershell" || executable === "pwsh.exe" || executable === "pwsh") && Array.isArray(argv)) {
      const commandIndex = argv.findIndex((arg) => String(arg).toLowerCase() === "-command");
      if (commandIndex >= 0 && typeof argv[commandIndex + 1] === "string") {
        argv[commandIndex + 1] = utf8Prelude + argv[commandIndex + 1];
      }
    }

    return originalSpawn.call(childProcess, command, argv, options);
  };
}

// Register the foreground VoxarioProtect Firewall bridge before the main
// bootstrap creates windows. In --protect-background mode the bridge is a no-op.
require("./protect-firewall.cjs").installForegroundBridge();

// Deterministic UI fallback. The first firewall implementation injected its
// tab from a separate window listener. On some packaged builds the Protect
// settings injector rebuilt the tab bar afterwards, so the Firewall category
// disappeared even though the IPC/firewall engine was present. This fallback
// waits for the final tab bar and installs the category again if necessary.
function installProtectFirewallUiFallback() {
  if (process.argv.slice(1).includes("--protect-background")) return;
  const { app } = require("electron");

  app.on("browser-window-created", (_event, win) => {
    const inject = () => {
      try {
        const url = win.webContents.getURL();
        const title = win.getTitle();
        if (!(url.endsWith("/protect.html") || url.includes("protect.html") || title === "VoxarioProtect")) return;
      } catch {
        return;
      }

      const source = `(() => {
        if (window.__voxarioFirewallFallbackV25) return;
        window.__voxarioFirewallFallbackV25 = true;

        const waitForUi = () => {
          const api = window.studioVoxarioDesktop;
          const tabs = document.getElementById('voxarioProtectTabs');
          const layout = document.querySelector('.layout');
          if (!api?.protectFirewallGetStatus || !tabs || !layout) {
            setTimeout(waitForUi, 180);
            return;
          }

          if (!document.getElementById('voxarioProtectFirewallFallbackStyle')) {
            const style = document.createElement('style');
            style.id = 'voxarioProtectFirewallFallbackStyle';
            style.textContent = '.vpfw-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:14px}.vpfw-card{border:1px solid rgba(71,167,161,.2);background:rgba(1,16,27,.52);padding:14px;min-width:0}.vpfw-card small{display:block;color:#78979b;font-size:9px}.vpfw-card strong{display:block;margin-top:5px;font-size:14px;color:#d7f7ef}.vpfw-card p{margin:8px 0 0;color:#87a8aa;font-size:10px;line-height:1.5}.vpfw-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}.vpfw-button{padding:9px 12px;border:1px solid rgba(86,185,177,.38);background:rgba(5,48,59,.78);color:#c7eee4;font-size:10px}.vpfw-button.primary{border-color:#62efad;background:linear-gradient(135deg,#62efad,#3cc59a);color:#052418;font-weight:800}.vpfw-button.danger{border-color:rgba(251,127,145,.55);color:#ffb7c1;background:rgba(80,19,31,.45)}.vpfw-list{display:grid;gap:8px;margin-top:10px}.vpfw-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:11px;border:1px solid rgba(71,167,161,.18);background:rgba(1,16,27,.48)}.vpfw-row b{font-size:11px}.vpfw-row span{display:block;margin-top:4px;color:#83a5a8;font-size:9px;overflow-wrap:anywhere}.vpfw-banner{margin-top:12px;padding:12px;border:1px solid rgba(98,239,173,.25);background:rgba(9,49,51,.42);color:#a9ceca;font-size:10px;line-height:1.55}@media(max-width:900px){.vpfw-grid{grid-template-columns:1fr 1fr}}@media(max-width:620px){.vpfw-grid{grid-template-columns:1fr}.vpfw-row{grid-template-columns:1fr}}';
            document.head.appendChild(style);
          }

          let tab = tabs.querySelector('.vp24-tab[data-tab="firewall"]');
          if (!tab) {
            tab = document.createElement('button');
            tab.className = 'vp24-tab';
            tab.type = 'button';
            tab.dataset.tab = 'firewall';
            tab.textContent = 'Firewall';
            const settingsTab = tabs.querySelector('[data-tab="settings"]');
            tabs.insertBefore(tab, settingsTab || null);
          }

          let panel = document.getElementById('voxarioProtectFirewallV25');
          if (!panel) {
            panel = document.createElement('section');
            panel.id = 'voxarioProtectFirewallV25';
            panel.className = 'panel wide';
            panel.dataset.vpTabPanel = 'firewall';
            panel.innerHTML = '<div class="panel-title"><span>VOXARIO FIREWALL</span><span class="muted">WINDOWS DEFENDER FIREWALL COMPANION</span></div><div class="vpfw-banner" id="vpfwStatus">Načítám stav Windows Defender Firewallu…</div><div class="vpfw-grid" id="vpfwProfiles"></div><div class="vpfw-actions"><button class="vpfw-button primary" id="vpfwBlockProgram" type="button">Vybrat aplikaci a zablokovat odchozí síť</button><button class="vpfw-button" id="vpfwRefresh" type="button">Obnovit stav</button><button class="vpfw-button" id="vpfwOpenWindows" type="button">Otevřít Windows Firewall</button><button class="vpfw-button" id="vpfwOpenSecurity" type="button">Otevřít Windows Zabezpečení</button></div><p class="notice">Protect vytváří pouze vlastní per-program Outbound BLOCK pravidla po potvrzení uživatele a UAC. Nevypíná Windows Firewall, neotevírá porty a nevytváří ALLOW pravidla.</p><div style="margin-top:18px"><div class="panel-title"><span>VLASTNÍ BLOKOVACÍ PRAVIDLA</span><span class="muted" id="vpfwRuleCount">0</span></div><div class="vpfw-list" id="vpfwRules"></div></div><div style="margin-top:18px"><div class="panel-title"><span>PROTECT ↔ DEFENDER CROSS-CHECK</span><span class="muted">DRUHÝ NÁZOR</span></div><div class="vpfw-list" id="vpfwCrossChecks"></div></div>';
            const footer = layout.querySelector('.foot');
            layout.insertBefore(panel, footer || null);
          }

          const setStatus = (text) => { const node = document.getElementById('vpfwStatus'); if (node) node.textContent = text; };
          const confirmAction = async (title, text) => {
            const dialog = document.getElementById('confirmDialog');
            const accept = document.getElementById('confirmAccept');
            const cancel = document.getElementById('confirmCancel');
            if (!dialog || !accept || !cancel) return window.confirm(title + '\n\n' + text);
            document.getElementById('confirmTitle').textContent = title;
            document.getElementById('confirmText').textContent = text;
            dialog.classList.add('on');
            return new Promise((resolve) => {
              const done = (value) => { dialog.classList.remove('on'); accept.onclick = null; cancel.onclick = null; resolve(value); };
              accept.onclick = () => done(true);
              cancel.onclick = () => done(false);
            });
          };

          const render = async () => {
            const result = await api.protectFirewallGetStatus();
            if (!result?.ok) { setStatus(result?.error || 'Stav Windows Firewallu se nepodařilo načíst.'); return; }
            setStatus(result.firewall?.allEnabled ? 'Windows Defender Firewall je aktivní ve všech profilech.' : 'Některý profil Windows Firewallu vyžaduje pozornost.');
            const profiles = document.getElementById('vpfwProfiles');
            profiles.replaceChildren();
            for (const profile of (result.firewall?.profiles || [])) {
              const card = document.createElement('div'); card.className = 'vpfw-card';
              card.innerHTML = '<small></small><strong></strong><p></p>';
              card.querySelector('small').textContent = String(profile.name || 'PROFILE').toUpperCase() + ' PROFILE';
              card.querySelector('strong').textContent = profile.enabled ? 'Aktivní' : 'Vypnuto';
              card.querySelector('p').textContent = 'Příchozí: ' + (profile.defaultInboundAction || '—') + ' · Odchozí: ' + (profile.defaultOutboundAction || '—');
              profiles.appendChild(card);
            }
            const rules = document.getElementById('vpfwRules'); rules.replaceChildren();
            const values = Array.isArray(result.rules) ? result.rules : [];
            document.getElementById('vpfwRuleCount').textContent = values.length + ' pravidel Protect';
            if (!values.length) { const e=document.createElement('div'); e.className='notice'; e.textContent='Protect zatím nevytvořil žádné vlastní blokovací pravidlo.'; rules.appendChild(e); }
            for (const rule of values) {
              const row=document.createElement('div'); row.className='vpfw-row';
              const info=document.createElement('div'); const b=document.createElement('b'); const s=document.createElement('span');
              b.textContent=rule.displayName || 'VoxarioProtect blokace'; s.textContent=(rule.direction||'Outbound')+' · '+(rule.action||'Block')+(rule.program?' · '+rule.program:''); info.append(b,s);
              const remove=document.createElement('button'); remove.className='vpfw-button danger'; remove.textContent='Odblokovat';
              remove.onclick=async()=>{ if(!await confirmAction('Odstranit blokaci?','Odstraní se pouze pravidlo vlastněné VoxarioProtect.')) return; remove.disabled=true; const r=await api.protectFirewallRemoveRule(rule.name); setStatus(r?.ok?'Blokace byla odstraněna.':(r?.error||'Odblokování selhalo.')); await render(); };
              row.append(info,remove); rules.appendChild(row);
            }
            const cross=document.getElementById('vpfwCrossChecks'); cross.replaceChildren();
            const events=Array.isArray(result.background?.crossChecks)?result.background.crossChecks:[];
            if(!events.length){const e=document.createElement('div');e.className='notice';e.textContent='Zatím není žádný Protect ↔ Defender rozpor ani firewall událost.';cross.appendChild(e);} else for(const item of events){const row=document.createElement('div');row.className='vpfw-row';const info=document.createElement('div');const b=document.createElement('b');const s=document.createElement('span');b.textContent=item.title||'Bezpečnostní událost';s.textContent=(item.fileName?item.fileName+' · ':'')+(item.detail||item.type||'událost');info.append(b,s);row.appendChild(info);cross.appendChild(row);}
          };

          const activate = () => {
            document.body.dataset.voxarioProtectTab = 'firewall';
            document.querySelectorAll('[data-vp-tab-panel]').forEach((node) => { node.hidden = node.dataset.vpTabPanel !== 'firewall'; });
            document.querySelectorAll('#voxarioProtectTabs .vp24-tab').forEach((button) => { const active=button.dataset.tab==='firewall'; button.classList.toggle('active',active); button.setAttribute('aria-current',active?'page':'false'); });
            void render();
          };
          if (!tab.dataset.vpfwFallbackBound) { tab.dataset.vpfwFallbackBound='1'; tab.addEventListener('click', activate); }

          const refresh = panel.querySelector('#vpfwRefresh'); if (refresh && !refresh.dataset.bound) { refresh.dataset.bound='1'; refresh.onclick=render; }
          const openWindows = panel.querySelector('#vpfwOpenWindows'); if (openWindows && !openWindows.dataset.bound) { openWindows.dataset.bound='1'; openWindows.onclick=async()=>{const r=await api.protectFirewallOpenWindows();if(!r?.ok)setStatus(r?.error||'Windows Firewall se nepodařilo otevřít.');}; }
          const openSecurity = panel.querySelector('#vpfwOpenSecurity'); if (openSecurity && !openSecurity.dataset.bound) { openSecurity.dataset.bound='1'; openSecurity.onclick=async()=>{const r=await api.protectOpenWindowsSecurity();if(!r?.ok)setStatus(r?.error||'Windows Zabezpečení se nepodařilo otevřít.');}; }
          const block = panel.querySelector('#vpfwBlockProgram'); if (block && !block.dataset.bound) { block.dataset.bound='1'; block.onclick=async()=>{block.disabled=true;try{const selected=await api.protectFirewallSelectProgram();if(!selected?.ok){if(!selected?.canceled)setStatus(selected?.error||'Aplikaci se nepodařilo vybrat.');return;}if(!await confirmAction('Zablokovat odchozí připojení?','Vytvoří se pouze Outbound BLOCK pravidlo pro '+selected.path+'. Windows zobrazí UAC.'))return;setStatus('Čekám na UAC…');const r=await api.protectFirewallBlockSelected(selected.token);setStatus(r?.ok?(r.fileName+' byla odříznuta od odchozí sítě.'):(r?.error||'Blokaci se nepodařilo vytvořit.'));await render();}finally{block.disabled=false;}}; }

          if ((document.body.dataset.voxarioProtectTab || 'overview') !== 'firewall') panel.hidden = true;
        };

        waitForUi();
      })()`;
      win.webContents.executeJavaScript(source, true).catch((error) => console.error("VoxarioProtect Firewall UI fallback failed", error));
    };

    win.webContents.on("did-finish-load", inject);
    win.on("ready-to-show", inject);
    setTimeout(inject, 700).unref?.();
    setTimeout(inject, 1800).unref?.();
  });
}

installProtectFirewallUiFallback();
require("./bootstrap.cjs");

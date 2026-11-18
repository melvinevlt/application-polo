'use strict';
// Application Polo — sport (gym / maison) + calories, 100 % dans le téléphone.
// Seul appel externe : Gemini (photos), avec la clé saisie dans Profil.

// ---------- Outils ----------
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const dateISO = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const aujourdhui = () => dateISO();
const decalerJour = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return dateISO(d); };
const arr = (n) => Math.round(Number(n) || 0);
const num = (v) => { const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : 0; };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const heure = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const mmss = (s) => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${pad(s % 60)}`; };
const dateLongue = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

function toast(msg, ms = 2200) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), ms);
}

// ---------- Données ----------
const CLE = 'polo-v1';
const MODELE_GEMINI = 'gemini-2.5-flash';
const VERSION_APP = 'V1.1 · 18/11/2026'; // à changer à chaque mise en ligne : Polo voit s'il a la dernière version
function etatVide() {
  return {
    profil: { sexe: 'H', age: '', taille: '', poids: '', objectif: 'recompo', montre: false },
    reglages: { cleGemini: '', modele: MODELE_GEMINI },
    jours: {}, pesees: [], salles: [], salleActive: null, favoris: [], charges: {},
    rotation: { gym: 0, maison: 0 }, enCours: null,
    prefsMaison: { minutes: 15, envie: 'equilibre', effort: 40, repos: 20, choix: [] }, derniersMaison: [],
    lieu: 'mine', // 'mine' (photo de l'assiette, salle ou chambre) ou 'appart' (recettes, courses, sport à l'appart)
    courses: { recettes: [], coches: {}, extras: [] }, recettesFav: [],
  };
}
function charger() {
  try {
    const s = JSON.parse(localStorage.getItem(CLE));
    if (s) { const v = etatVide(); return { ...v, ...s, profil: { ...v.profil, ...s.profil }, reglages: { ...v.reglages, ...s.reglages }, rotation: { ...v.rotation, ...s.rotation }, prefsMaison: { ...v.prefsMaison, ...s.prefsMaison }, courses: { ...v.courses, ...s.courses } }; }
  } catch (e) { /* données illisibles : on repart à vide */ }
  return etatVide();
}
let S = charger();
function sauver() {
  try { localStorage.setItem(CLE, JSON.stringify(S)); }
  catch (e) { toast('⚠️ Mémoire pleine : exporte une sauvegarde'); }
}
function jour(d = aujourdhui()) {
  if (!S.jours[d]) S.jours[d] = { repas: [], seances: [], sante: null };
  return S.jours[d];
}

// ---------- Calculs ----------
const OBJECTIFS = {
  perte: { nom: 'Perdre du gras', delta: -0.2 },
  recompo: { nom: 'Recomposition (gras ↓ muscle ↑)', delta: -0.1 },
  maintien: { nom: 'Maintenir', delta: 0 },
  prise: { nom: 'Prendre du muscle', delta: 0.1 },
};
function profilComplet() { const p = S.profil; return num(p.age) > 0 && num(p.taille) > 0 && num(p.poids) > 0; }
function poidsActuel() { const p = S.pesees.at(-1); return p ? p.poids : num(S.profil.poids); }
function metabolismeBase() {
  const p = S.profil; const kg = poidsActuel();
  return 10 * kg + 6.25 * num(p.taille) - 5 * num(p.age) + (p.sexe === 'F' ? -161 : 5);
}
function imc() { const m = num(S.profil.taille) / 100; return m ? poidsActuel() / (m * m) : 0; }

// Bilan d'un jour : ce qui est mangé, ce qui est dépensé, la cible.
function bilan(d) {
  const j = S.jours[d] || { repas: [], seances: [], sante: null };
  const mange = j.repas.reduce((a, r) => ({ kcal: a.kcal + num(r.kcal), p: a.p + num(r.p), g: a.g + num(r.g), l: a.l + num(r.l) }), { kcal: 0, p: 0, g: 0, l: 0 });
  const base = metabolismeBase() * 1.1; // métabolisme de base + digestion
  let actif = 0, sourceActif = 'estimé';
  if (j.sante && num(j.sante.kcal) > 0) { actif = num(j.sante.kcal); sourceActif = 'app Santé'; }
  else if (j.sante && num(j.sante.pas) > 0) { actif = num(j.sante.pas) * 0.0005 * poidsActuel(); sourceActif = 'pas'; }
  else { actif = 300; } // valeur par défaut tant que Santé n'est pas importé
  // Avec une montre, Santé compte déjà les séances : on ne les ajoute pas deux fois.
  const seances = (S.profil.montre && sourceActif === 'app Santé') ? 0 : j.seances.reduce((a, s) => a + num(s.kcal), 0);
  const depense = base + actif + seances;
  const delta = OBJECTIFS[S.profil.objectif]?.delta ?? 0;
  const cible = depense * (1 + delta);
  const kg = poidsActuel();
  const cibleP = kg * 2, cibleL = kg * 0.9;
  const cibleG = Math.max(0, (cible - cibleP * 4 - cibleL * 9) / 4);
  return { j, mange, base, actif, sourceActif, seances, depense, cible, cibleP, cibleG, cibleL, solde: mange.kcal - depense };
}

// ---------- Gemini ----------
async function reduireImage(fichier, max = 1024) {
  const url = URL.createObjectURL(fichier);
  try {
    const img = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = url; });
    const r = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.8);
  } finally { URL.revokeObjectURL(url); }
}
async function gemini(consigne, images = []) {
  const cle = S.reglages.cleGemini.trim();
  if (!cle) throw new Error('Ajoute ta clé Gemini dans Profil → Réglages.');
  if (!navigator.onLine) throw new Error('Pas de réseau. Réessaie au wifi, ou saisis à la main.');
  const parts = [{ text: consigne }, ...images.map((d) => ({ inline_data: { mime_type: 'image/jpeg', data: d.split(',')[1] } }))];
  const modele = (S.reglages.modele || MODELE_GEMINI).trim();
  const rep = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modele)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cle },
    body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: 'application/json', temperature: 0.2 } }),
  });
  const json = await rep.json().catch(() => ({}));
  if (!rep.ok) throw new Error('Gemini : ' + (json.error?.message || rep.status));
  const texte = json.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
  try { return JSON.parse(texte.replace(/^```(json)?|```$/g, '').trim()); }
  catch (e) { throw new Error('Réponse de Gemini illisible, réessaie.'); }
}
const CONSIGNE_REPAS = `Tu es nutritionniste. Estime le contenu nutritionnel du repas (photo et/ou description).
Repère chaque aliment, estime sa quantité en grammes d'après la taille de l'assiette et des couverts, puis ses calories et macros.
Réponds UNIQUEMENT en JSON : {"nom":"nom court du repas en français","aliments":[{"nom":"...","grammes":0,"kcal":0,"p":0,"g":0,"l":0}],"confiance":"faible|moyenne|bonne"}
p = protéines (g), g = glucides (g), l = lipides (g). Nombres entiers.`;
function consigneSalle() {
  return `Voici des photos d'une salle de sport. Liste le matériel visible, uniquement parmi ces identifiants :
${MATERIELS.map((m) => `${m.id} (${m.nom})`).join(', ')}.
Réponds UNIQUEMENT en JSON : {"materiel":["id", ...]}`;
}

// ---------- Génération des séances (locale, sans IA) ----------
function choisirExo(cat, variante, dispo, dejaPris) {
  let possibles = EXERCICES.filter((e) => e.cat === cat && e.mat.every((m) => dispo.has(m)) && !dejaPris.has(e.id));
  // En salle : les exercices avec matériel d'abord ; le poids du corps seulement s'il n'y a rien d'autre.
  if (dispo.size) { const equipes = possibles.filter((e) => e.mat.length); if (equipes.length) possibles = equipes; }
  if (!possibles.length) return null;
  return possibles[variante % possibles.length];
}
function genererGym(salle) {
  const lettres = Object.keys(MODELES_GYM);
  const lettre = lettres[S.rotation.gym % lettres.length];
  const modele = MODELES_GYM[lettre];
  const dispo = new Set(salle ? salle.materiel : []);
  const pris = new Set(); const exos = [];
  modele.slots.forEach(([cat, v], i) => {
    const e = choisirExo(cat, v, dispo, pris); if (!e) return; pris.add(e.id);
    if (e.cat === 'cardio') exos.push({ id: e.id, nom: e.nom, consigne: e.consigne, series: 1, secs: e.mat.length ? 600 : 45, repos: 0 });
    else if (e.temps) exos.push({ id: e.id, nom: e.nom, consigne: e.consigne, series: 3, secs: 45, repos: 45 });
    else exos.push({ id: e.id, nom: e.nom, consigne: e.consigne, series: i < 2 ? 4 : 3, reps: '8-12', repos: i < 2 ? 120 : 90, charge: e.mat.length > 0 });
  });
  return { type: 'gym', lettre, titre: `Salle ${lettre} — ${modele.titre}`, salle: salle?.nom || '', exos };
}
// ----- Séance maison sur mesure : durée + envie → exercices choisis à la main ou générés -----
const DUREES_MAISON = [10, 15, 20, 30, 45];
const ENVIES = { equilibre: { nom: '⚖️ Équilibré', cardio: 0.4 }, cardio: { nom: '🔥 + Cardio', cardio: 0.7 }, renfo: { nom: '💪 + Renfo', cardio: 0.2 } };
const TOURS_MAISON = 3, ECHAUFFEMENT = 120, REPOS_TOURS = 60;
const EXOS_MAISON = EXERCICES.filter((e) => !e.mat.length);
const exoParId = (id) => EXERCICES.find((e) => e.id === id);
// Durée (min) d'un circuit de n exercices : échauffement + 3 tours + repos entre les tours.
function dureeMaison(n, p = S.prefsMaison) {
  if (!n) return 0;
  return (ECHAUFFEMENT + TOURS_MAISON * (n * (p.effort + p.repos) - p.repos) + (TOURS_MAISON - 1) * REPOS_TOURS) / 60;
}
function capaciteMaison(p = S.prefsMaison) { let n = 1; while (dureeMaison(n + 1, p) <= p.minutes) n++; return n; }
const melanger = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
// Génère une séance différente à chaque fois : évite les exercices de la dernière séance, varie les muscles.
function genererChoixMaison(p = S.prefsMaison) {
  const n = capaciteMaison(p);
  const nCardio = Math.round(n * ENVIES[p.envie].cardio);
  const recents = new Set(S.derniersMaison || []);
  const frais = (liste) => [...melanger(liste.filter((e) => !recents.has(e.id))), ...melanger(liste.filter((e) => recents.has(e.id)))];
  const cardio = frais(EXOS_MAISON.filter((e) => e.cat === 'cardio')).slice(0, nCardio);
  // Renfo : un exercice par famille de muscles à tour de rôle (jambes, pecs, dos, abdos…).
  const parFamille = {};
  frais(EXOS_MAISON.filter((e) => e.cat !== 'cardio')).forEach((e) => { (parFamille[FAMILLES[e.cat]] ||= []).push(e); });
  // Ordre des familles : le corps entier d'abord (jambes, poussée, dos, abdos), le reste ensuite.
  const familles = ['Jambes', 'Pecs', 'Dos', 'Abdos', 'Fessiers', 'Épaules', 'Bras'].filter((f) => parFamille[f]); const renfo = [];
  while (renfo.length < n - cardio.length && familles.some((f) => parFamille[f].length)) {
    for (const f of familles) { if (renfo.length >= n - cardio.length) break; const e = parFamille[f].shift(); if (e) renfo.push(e); }
  }
  // Alterne renfo et cardio pour récupérer entre les efforts.
  const ordre = [];
  while (renfo.length || cardio.length) { if (renfo.length) ordre.push(renfo.shift()); if (cardio.length) ordre.push(cardio.shift()); }
  return ordre.slice(0, n).map((e) => e.id);
}
function construireMaison(p = S.prefsMaison) {
  const exos = p.choix.map(exoParId).filter(Boolean).map((e) => ({ id: e.id, nom: e.nom, cat: e.cat, consigne: e.consigne, secs: p.effort, repos: p.repos }));
  return { type: 'maison', titre: `${S.lieu === 'appart' ? 'Appart' : 'Chambre'} ${p.minutes} min — ${ENVIES[p.envie].nom.split(' ').slice(1).join(' ')}`, tours: TOURS_MAISON, minutes: p.minutes, exos };
}
// Transforme une séance en suite d'étapes (travail / repos) pour le lecteur.
function etapes(seance) {
  const E = [{ type: 'travail', nom: 'Échauffement', consigne: 'Jumping jacks, rotations des bras et des hanches, quelques squats lents.', secs: 120 }];
  if (seance.type === 'maison') {
    for (let t = 1; t <= seance.tours; t++) {
      seance.exos.forEach((x, i) => {
        E.push({ type: 'travail', exo: x.id, nom: x.nom, consigne: x.consigne, secs: x.secs, info: `Tour ${t}/${seance.tours}` });
        const dernier = i === seance.exos.length - 1;
        if (!(dernier && t === seance.tours)) E.push({ type: 'repos', secs: dernier ? 60 : x.repos });
      });
    }
  } else {
    seance.exos.forEach((x, i) => {
      for (let s = 1; s <= x.series; s++) {
        E.push({ type: 'travail', exo: x.id, nom: x.nom, consigne: x.consigne, secs: x.secs, reps: x.reps, charge: x.charge, info: `Série ${s}/${x.series}` });
        const fin = i === seance.exos.length - 1 && s === x.series;
        if (!fin && x.repos) E.push({ type: 'repos', secs: x.repos });
      }
    });
  }
  return E;
}
function kcalSeance(type, minutes) {
  const met = type === 'maison' ? 7 : 5; // circuit vs musculation
  return (met - 1) * poidsActuel() * (minutes / 60); // -1 : le repos est déjà compté dans la base
}

// ---------- Navigation ----------
let onglet = 'jour';
let jourVu = aujourdhui();
const vueSport = { mode: null, info: null };
let repasEnCours = null; // résultat d'analyse en attente de validation

function aller(o) { onglet = o; if (o === 'jour') jourVu = aujourdhui(); rendre(); window.scrollTo(0, 0); }
function rendre() {
  $$('#onglets button').forEach((b) => b.classList.toggle('actif', b.dataset.onglet === onglet));
  ({ jour: vueJour, sport: vueSport_, repas: vueRepas, courses: vueCourses, profil: vueProfil })[onglet]();
}
function entete(titre, sous = '') {
  const lieu = S.lieu === 'appart' ? '🏠 Appart' : '⛏️ Mine';
  $('#entete').innerHTML = `<div class="ligne"><h1>${esc(titre)}</h1><button class="lieu" onclick="changerLieu()" aria-label="Changer de lieu">${lieu} ⇄</button></div>${sous ? `<div class="sous">${sous}</div>` : ''}`;
  majBadge();
}
// Mine ou appart : change l'écran Repas (photo / recettes) et l'écran Sport (salle ou chambre / appart).
function changerLieu() {
  S.lieu = S.lieu === 'appart' ? 'mine' : 'appart';
  vueSport.mode = null; ongletRepas = null; sauver(); rendre();
  toast(S.lieu === 'appart' ? '🏠 Mode appart : recettes, courses, sport à l’appart' : '⛏️ Mode mine : photo de l’assiette, salle ou chambre', 3000);
}
function majBadge() {
  const n = articlesCourses().filter((a) => !a.coche).length;
  const b = $('#onglets [data-onglet="courses"]'); if (b) b.dataset.badge = n || '';
}

// ---------- Vue : Aujourd'hui ----------
function anneau(valeur, cible, couleur) {
  const r = 74, c = 2 * Math.PI * r, f = Math.min(1, cible ? valeur / cible : 0);
  return `<svg width="170" height="170" viewBox="0 0 170 170"><circle cx="85" cy="85" r="${r}" stroke="var(--carte2)" stroke-width="14" fill="none"/>
  <circle cx="85" cy="85" r="${r}" stroke="${couleur}" stroke-width="14" fill="none" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - f)}"/></svg>`;
}
// Macros : 3 petits anneaux (protéines, glucides, lipides) avec ce qu'il reste à manger, et la répartition visée.
function petitAnneau(val, cible, couleur) {
  const r = 30, c = 2 * Math.PI * r, f = Math.min(1, cible ? val / cible : 0);
  return `<svg width="76" height="76" viewBox="0 0 76 76" style="transform:rotate(-90deg)"><circle cx="38" cy="38" r="${r}" stroke="var(--carte2)" stroke-width="8" fill="none"/>
  <circle cx="38" cy="38" r="${r}" stroke="${couleur}" stroke-width="8" fill="none" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - f)}"/></svg>`;
}
function blocMacros(b) {
  const M = [['Protéines', b.mange.p, b.cibleP, 'var(--violet)', 4], ['Glucides', b.mange.g, b.cibleG, 'var(--bleu)', 4], ['Lipides', b.mange.l, b.cibleL, 'var(--orange)', 9]];
  const pct = (g, k) => (b.cible ? Math.round((g * k / b.cible) * 100) : 0);
  return `<div class="carte"><h2>Macros du jour</h2><div class="grille3 macros">${M.map(([nom, v, c, coul]) => {
    const reste = c - v;
    return `<div><div class="mini-anneau">${petitAnneau(v, c, coul)}<div class="centre"><b>${arr(v)}</b><span class="doux petit">/${arr(c)} g</span></div></div>
      <div class="petit" style="font-weight:600">${nom}</div><div class="doux petit">${reste >= 0 ? `reste ${arr(reste)} g` : `+${arr(-reste)} g`}</div></div>`;
  }).join('')}</div>
  <p class="doux petit" style="margin-top:10px">Répartition visée : <b style="color:var(--violet)">P ${pct(b.cibleP, 4)} %</b> · <b style="color:var(--bleu)">G ${pct(b.cibleG, 4)} %</b> · <b style="color:var(--orange)">L ${pct(b.cibleL, 9)} %</b> des calories. Les protéines comptent le plus : 2 g par kilo pour garder le muscle.</p></div>`;
}
function barreMacro(nom, val, cible, couleur) {
  return `<div><div class="ligne petit"><span>${nom}</span><span class="doux">${arr(val)} / ${arr(cible)} g</span></div>
  <div class="barre"><div style="width:${Math.min(100, cible ? (val / cible) * 100 : 0)}%;background:${couleur}"></div></div></div>`;
}
function vueJour() {
  const estAuj = jourVu === aujourdhui();
  entete(estAuj ? 'Aujourd’hui' : 'Bilan', dateLongue(jourVu));
  if (!profilComplet()) {
    $('#vue').innerHTML = `<div class="carte"><h2>👋 Bienvenue Polo</h2><p class="doux">Remplis ton profil (âge, taille, poids, objectif) : l’app calcule ton maintien et tes objectifs toute seule.</p>
    <button class="btn principal" onclick="aller('profil')">Compléter mon profil</button></div>`;
    return;
  }
  const b = bilan(jourVu);
  const reste = b.cible - b.mange.kcal;
  const couleur = reste >= 0 ? 'var(--vert)' : 'var(--orange)';
  const s = b.j.sante;
  const ok = (S.profil.objectif === 'prise') ? b.solde >= 0 : b.solde <= 0;
  // Aujourd'hui, la journée n'est pas finie : bilan provisoire, sans verdict.
  const verdict = b.mange.kcal === 0 ? '' : estAuj
    ? `<div class="verdict" style="background:var(--carte2);color:var(--doux)">Pour l’instant : ${b.solde <= 0 ? `déficit de ${arr(-b.solde)} kcal` : `surplus de ${arr(b.solde)} kcal`}</div>`
    : `<div class="verdict ${ok ? 'ok' : 'ko'}">${b.solde <= 0 ? `Déficit de ${arr(-b.solde)} kcal` : `Surplus de ${arr(b.solde)} kcal`} ${ok ? '✅ objectif tenu' : '⚠️ objectif dépassé'}</div>`;
  const bandeauSante = !estAuj ? '' : s
    ? `<div class="carte ligne" style="padding:12px 16px"><span class="petit">❤️ ${arr(s.pas).toLocaleString('fr-FR')} pas · ${arr(s.kcal)} kcal actives <span class="doux">(${esc(s.maj)})</span></span><button class="btn mini" onclick="importerSante()">Actualiser</button></div>`
    : `<button class="btn principal" style="margin-bottom:12px;background:var(--rouge);color:#fff" onclick="importerSante()">❤️ Récupérer mes pas de l’app Santé</button>`;
  $('#vue').innerHTML = `
  <div class="ligne" style="margin-bottom:10px">
    <button class="btn mini" onclick="changerJour(-1)">‹ Veille</button>
    ${estAuj ? '' : `<button class="btn mini" onclick="changerJour(1)">Lendemain ›</button>`}
  </div>
  ${bandeauSante}
  <div class="carte">
    <div class="anneau">${anneau(b.mange.kcal, b.cible, couleur)}
      <div class="centre"><div class="gros">${arr(Math.abs(reste))}</div><div class="doux">${reste >= 0 ? 'kcal restantes' : 'kcal en trop'}</div></div></div>
    <div class="grille3" style="text-align:center">
      <div><b>${arr(b.mange.kcal)}</b><div class="doux petit">mangé</div></div>
      <div><b>${arr(b.cible)}</b><div class="doux petit">objectif</div></div>
      <div><b>${arr(b.depense)}</b><div class="doux petit">dépensé</div></div>
    </div>
    ${verdict}
  </div>
  ${estAuj ? blocIdees(b, reste) : ''}
  ${blocMacros(b)}
  <div class="carte">
    <h2>Dépense</h2>
    <div class="ligne"><span>Corps au repos</span><b>${arr(b.base)} kcal</b></div>
    <div class="ligne"><span>Activité <span class="puce">${b.sourceActif}</span>${s?.pas ? ` <span class="doux petit">${arr(s.pas).toLocaleString('fr-FR')} pas</span>` : ''}</span><b>${arr(b.actif)} kcal</b></div>
    <div class="ligne"><span>Séances${S.profil.montre && b.sourceActif === 'app Santé' ? ' <span class="doux petit">(dans Santé)</span>' : ''}</span><b>${arr(b.seances)} kcal</b></div>
  </div>
  <div class="carte">
    <h2>Repas</h2>
    ${b.j.repas.length ? b.j.repas.map((r) => `<div class="liste-item"><div class="info"><div class="titre">${esc(r.nom)}</div><div class="doux petit">${esc(r.heure)} · P ${arr(r.p)} · G ${arr(r.g)} · L ${arr(r.l)}</div></div><b>${arr(r.kcal)}</b><button class="x" onclick="supprimerRepas('${jourVu}','${r.id}')">×</button></div>`).join('') : '<p class="doux">Rien pour l’instant.</p>'}
    ${estAuj ? `<button class="btn principal" style="margin-top:10px" onclick="aller('repas')">📸 Ajouter un repas</button>` : ''}
  </div>
  <div class="carte">
    <h2>Séances</h2>
    ${b.j.seances.length ? b.j.seances.map((s) => `<div class="liste-item"><div class="info"><div class="titre">${esc(s.titre)}</div><div class="doux petit">${arr(s.minutes)} min${s.salle ? ' · ' + esc(s.salle) : ''}</div></div><b>${arr(s.kcal)}</b><button class="x" onclick="supprimerSeance('${jourVu}','${s.id}')">×</button></div>`).join('') : '<p class="doux">Pas de séance ce jour-là.</p>'}
    ${estAuj && !b.j.seances.length ? `<button class="btn" style="margin-top:10px" onclick="aller('sport')">🏋️ Faire ma séance</button>` : ''}
  </div>
  ${blocSemaine()}`;
}

// ---------- Idées repas selon ce qu'il reste ----------
let decalageIdees = 0;
function suggestions(b, reste) {
  const manqueP = Math.max(0, b.cibleP - b.mange.p);
  const score = (i) => {
    let sc = -Math.abs(Math.min(reste, 650) - i.kcal) / 15; // remplit bien ce qu'il reste
    if (manqueP > 25) sc += (i.p / i.kcal) * 400; // protéines en priorité s'il en manque
    if (reste >= 450 && i.type === 'repas') sc += 15;
    return sc;
  };
  return IDEES.filter((i) => i.kcal <= reste + 30).sort((a, c) => score(c) - score(a));
}
function blocIdees(b, reste) {
  if (!b.mange.kcal && reste <= 0) return '';
  if (S.lieu === 'appart' && reste >= 80) return blocRecettesDuJour(b, reste);
  if (reste < 80) return `<div class="carte"><h2>🍽️ Et maintenant ?</h2><p class="doux">${reste < 0 ? 'Objectif du jour dépassé : demain on se rattrape 💪' : 'Objectif du jour atteint 👌'} Si tu as faim : légumes, soupe, thé ou café.</p></div>`;
  const liste = suggestions(b, reste);
  const n = liste.length, montre = [0, 1, 2].map((k) => liste[(decalageIdees + k) % n]).filter((x, k, t) => x && t.indexOf(x) === k);
  const manqueP = Math.max(0, b.cibleP - b.mange.p);
  return `<div class="carte"><h2>🍽️ Idées pour tes ${arr(reste)} kcal</h2>
    ${manqueP > 25 ? `<p class="doux petit">Il te manque ${arr(manqueP)} g de protéines : les idées en tiennent compte.</p>` : ''}
    ${montre.map((i) => `<div class="liste-item"><div class="info"><div class="titre" style="white-space:normal">${esc(i.nom)}</div><div class="doux petit">${i.kcal} kcal · P ${i.p} g · ${i.type}</div></div><button class="btn mini" onclick="mangerIdee(${IDEES.indexOf(i)})">J’ai mangé ça</button></div>`).join('')}
    <div class="grille2" style="margin-top:10px">${n > 3 ? `<button class="btn" onclick="decalageIdees+=3;vueJour()">🔄 Autres idées</button>` : ''}<button class="btn" onclick="recetteIA(${arr(reste)},${arr(manqueP)})">🤖 Une recette</button></div>
  </div>`;
}
function mangerIdee(k) {
  const i = IDEES[k];
  jour().repas.push({ id: uid(), heure: heure(), nom: i.nom, kcal: i.kcal, p: i.p, g: i.g, l: i.l, source: 'idée' });
  sauver(); toast(`✅ ${i.kcal} kcal ajoutées`); vueJour();
}
let recettesIA = [];
async function recetteIA(reste, manqueP) {
  ouvrirCalque(`<div class="ligne"><h2 style="margin:0">🤖 Recettes pour ${reste} kcal</h2><button class="x" onclick="fermerCalque()">✕</button></div><div class="chargement">Je cherche des idées…</div>`);
  try {
    const r = await gemini(`Propose 2 recettes simples en français pour quelqu'un qui vit en camp minier (cuisine limitée : micro-ondes ou plaque, ingrédients faciles à trouver).
Chaque recette fait au maximum ${reste} kcal${manqueP > 20 ? ` et apporte le plus possible des ${manqueP} g de protéines qu'il lui manque` : ''}.
Réponds UNIQUEMENT en JSON : {"recettes":[{"nom":"...","kcal":0,"p":0,"g":0,"l":0,"temps":"10 min","ingredients":["..."],"etapes":["..."]}]}`);
    recettesIA = (r.recettes || []).slice(0, 3);
    if (!recettesIA.length) throw new Error('Pas de recette reçue, réessaie.');
    $('#calque .contenu').innerHTML = `<div class="ligne"><h2 style="margin:0">🤖 Recettes pour ${reste} kcal</h2><button class="x" onclick="fermerCalque()">✕</button></div>
      ${recettesIA.map((x, k) => `<div class="carte" style="margin-top:12px"><h2>${esc(x.nom)}</h2><p class="doux petit">${arr(x.kcal)} kcal · P ${arr(x.p)} g · G ${arr(x.g)} g · L ${arr(x.l)} g${x.temps ? ' · ' + esc(x.temps) : ''}</p>
        <h3>Ingrédients</h3><ul class="petit">${(x.ingredients || []).map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
        <h3>Étapes</h3><ol class="petit">${(x.etapes || []).map((i) => `<li>${esc(i)}</li>`).join('')}</ol>
        <button class="btn principal" onclick="mangerRecette(${k})">J’ai mangé ça</button></div>`).join('')}`;
  } catch (e) { $('#calque .contenu').innerHTML += `<p style="color:var(--rouge)">${esc(e.message)}</p><button class="btn" onclick="fermerCalque()">Fermer</button>`; $('#calque .chargement')?.remove(); }
}
function mangerRecette(k) {
  const x = recettesIA[k];
  jour().repas.push({ id: uid(), heure: heure(), nom: x.nom, kcal: arr(x.kcal), p: arr(x.p), g: arr(x.g), l: arr(x.l), source: 'recette' });
  sauver(); toast(`✅ ${arr(x.kcal)} kcal ajoutées`); fermerCalque();
}

// ---------- Ma semaine ----------
function blocSemaine() {
  const jours = [...Array(7)].map((_, k) => decalerJour(aujourdhui(), k - 6));
  const B = jours.map((d) => ({ d, b: bilan(d), j: S.jours[d] }));
  const max = Math.max(1, ...B.map(({ b }) => Math.max(b.mange.kcal, b.cible)));
  const barres = B.map(({ d, b, j }) => {
    const rempli = j && j.repas.length;
    const h = rempli ? (b.mange.kcal / max) * 100 : 0, hc = (b.cible / max) * 100;
    const ok = rempli && (S.profil.objectif === 'prise' ? b.mange.kcal >= b.cible : b.mange.kcal <= b.cible);
    const lettre = new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'narrow' });
    return `<div class="col-jour" onclick="jourVu='${d}';vueJour();window.scrollTo(0,0)">
      <div class="col-zone"><div class="col-cible" style="bottom:${hc}%"></div><div class="col-barre" style="height:${h}%;background:${!rempli ? 'transparent' : ok ? 'var(--vert)' : 'var(--orange)'}"></div></div>
      <div class="doux petit">${d === aujourdhui() ? '•' : lettre}</div>${j?.seances.length ? '<div class="petit">🏋️</div>' : '<div class="petit">&nbsp;</div>'}</div>`;
  }).join('');
  const passes = B.filter(({ d, j }) => d !== aujourdhui() && j && j.repas.length);
  const tenus = passes.filter(({ b }) => (S.profil.objectif === 'prise' ? b.solde >= 0 : b.solde <= 0)).length;
  const seances = B.reduce((a, { j }) => a + (j ? j.seances.length : 0), 0);
  const avecPas = B.filter(({ j }) => j?.sante?.pas);
  const pasMoy = avecPas.length ? avecPas.reduce((a, { j }) => a + num(j.sante.pas), 0) / avecPas.length : 0;
  const P = S.pesees.filter((p) => p.date >= decalerJour(aujourdhui(), -30));
  const evol = P.length >= 2 ? P.at(-1).poids - P[0].poids : null;
  return `<div class="carte"><h2>📅 Ma semaine</h2>
    <div class="semaine">${barres}</div>
    <p class="doux petit" style="margin-top:6px">Barre = mangé, trait = objectif. Touche un jour pour voir son bilan.</p>
    <div class="grille2" style="margin-top:8px">
      <div class="stat"><b>${passes.length ? `${tenus}/${passes.length}` : '—'}</b><span class="doux petit">jours dans l’objectif</span></div>
      <div class="stat"><b>${seances}</b><span class="doux petit">séance${seances > 1 ? 's' : ''}</span></div>
      <div class="stat"><b>${pasMoy ? arr(pasMoy).toLocaleString('fr-FR') : '—'}</b><span class="doux petit">pas / jour en moyenne</span></div>
      <div class="stat"><b>${evol == null ? '—' : `${evol > 0 ? '+' : ''}${evol.toFixed(1).replace('.', ',')} kg`}</b><span class="doux petit">poids sur 30 jours</span></div>
    </div></div>`;
}
function changerJour(n) { const d = decalerJour(jourVu, n); if (d > aujourdhui()) return; jourVu = d; vueJour(); }
function supprimerRepas(d, id) { if (!confirm('Supprimer ce repas ?')) return; jour(d).repas = jour(d).repas.filter((r) => r.id !== id); sauver(); rendre(); }
function supprimerSeance(d, id) { if (!confirm('Supprimer cette séance ?')) return; jour(d).seances = jour(d).seances.filter((s) => s.id !== id); sauver(); rendre(); }

// ---------- Santé (Raccourci iOS → presse-papiers ou adresse) ----------
// Format attendu : « POLO;pas=8123;kcal=456 » (kcal = énergie active).
function lireSante(texte) {
  const pas = /pas\s*=\s*([\d\s.,]+)/i.exec(texte), kcal = /kcal\s*=\s*([\d\s.,]+)/i.exec(texte);
  const n = (m) => (m ? num(m[1].replace(/\s/g, '').replace(/[.,](?=\d{3}\b)/g, '')) : 0);
  if (!pas && !kcal) return null;
  return { pas: n(pas), kcal: n(kcal) };
}
function enregistrerSante(v) {
  jour().sante = { pas: v.pas, kcal: v.kcal, maj: heure() }; sauver();
  toast(`❤️ ${arr(v.pas).toLocaleString('fr-FR')} pas · ${arr(v.kcal)} kcal actives`);
}
async function importerSante() {
  let v = null;
  try { v = lireSante(await navigator.clipboard.readText()); } catch (e) { /* presse-papiers refusé */ }
  if (!v) {
    const t = prompt('Lance d’abord ton raccourci « Santé Polo ».\nOu tape tes chiffres : pas=8000;kcal=400');
    if (!t) return; v = lireSante(t);
  }
  if (!v) { toast('Format non reconnu (pas=…;kcal=…)'); return; }
  enregistrerSante(v); rendre();
}
function lireAdresse() {
  const h = decodeURIComponent(location.hash || '');
  if (h.startsWith('#sante')) { const v = lireSante(h); if (v) enregistrerSante(v); history.replaceState(null, '', location.pathname); }
}

// ---------- Vue : Sport ----------
function vueSport_() {
  const appart = S.lieu === 'appart';
  if (appart) vueSport.mode = 'maison'; // à l'appart : toujours une séance sans matériel
  entete('Sport', appart ? 'Séance à l’appart, zéro matériel' : 'Ce soir, tu fais quoi ?');
  const e = S.enCours;
  const reprise = e ? `<div class="carte"><h2>⏸️ Séance en cours</h2><p class="doux">${esc(e.seance.titre)}</p>
    <div class="grille2"><button class="btn principal" onclick="ouvrirLecteur()">Reprendre</button><button class="btn danger" onclick="abandonner()">Abandonner</button></div></div>` : '';
  const historique = Object.entries(S.jours).sort((a, b) => b[0].localeCompare(a[0])).flatMap(([d, j]) => j.seances.map((s) => ({ d, s }))).slice(0, 5);
  let detail = '';
  if (vueSport.mode === 'gym') detail = blocGym();
  if (vueSport.mode === 'maison') detail = blocMaison();
  $('#vue').innerHTML = `${reprise}
  ${appart ? '' : `<div class="grille2" style="margin-bottom:12px">
    <button class="btn gros-choix ${vueSport.mode === 'gym' ? 'choisi' : ''}" onclick="choisirMode('gym')"><span>🏋️</span>Salle</button>
    <button class="btn gros-choix ${vueSport.mode === 'maison' ? 'choisi' : ''}" onclick="choisirMode('maison')"><span>🛏️</span>Chambre</button>
  </div>`}
  ${detail}
  <div class="carte"><h2>Dernières séances</h2>${historique.length ? historique.map(({ d, s }) => `<div class="liste-item"><div class="info"><div class="titre">${esc(s.titre)}</div><div class="doux petit">${dateLongue(d)} · ${arr(s.minutes)} min</div></div><b>${arr(s.kcal)} kcal</b></div>`).join('') : '<p class="doux">Aucune pour l’instant. La première est la plus dure 💪</p>'}</div>`;
}
function choisirMode(m) { vueSport.mode = vueSport.mode === m ? null : m; vueSport_(); }
function apercuSeance(s) {
  return s.exos.map((x) => `<div class="liste-item"><div class="info"><div class="titre">${esc(x.nom)}</div><div class="doux petit">${s.type === 'maison' ? `${x.secs} s` : x.reps ? `${x.series} × ${x.reps}` : x.series > 1 ? `${x.series} × ${x.secs} s` : mmss(x.secs) + ' min'}${S.charges[x.id] ? ` · dernière fois ${S.charges[x.id].kg} kg` : ''}</div></div></div>`).join('');
}
function salleActive() { return S.salles.find((s) => s.id === S.salleActive) || S.salles[0] || null; }
function blocGym() {
  const salle = salleActive();
  if (!salle) return `<div class="carte"><h2>📍 Nouvelle salle</h2><p class="doux">Prends 1 à 3 photos de la salle : l’app repère les machines et compose ta séance avec. À faire une seule fois par salle.</p>
    <button class="btn principal" onclick="nouvelleSalle()">📸 Ajouter ma salle</button></div>`;
  const s = genererGym(salle);
  return `<div class="carte">
    <label class="champ" style="margin-top:0">Salle
      <select onchange="changerSalle(this.value)">${S.salles.map((x) => `<option value="${x.id}" ${x.id === salle.id ? 'selected' : ''}>${esc(x.nom)}</option>`).join('')}<option value="+">+ Nouvelle salle…</option></select></label>
    <h3>${esc(s.titre)} · ~50 min</h3>${apercuSeance(s)}
    <div class="grille2" style="margin-top:12px"><button class="btn" onclick="editerSalle('${salle.id}')">Machines</button><button class="btn principal" onclick="demarrer('gym')">C’est parti</button></div>
  </div>`;
}
function ligneExo(e, dansSeance, plein) {
  const ouvert = vueSport.info === e.id;
  const action = dansSeance
    ? `<button class="x" aria-label="Retirer" onclick="event.stopPropagation();basculerExo('${e.id}')">−</button>`
    : `<button class="btn mini ${plein ? '' : 'principal'}" ${plein ? 'disabled' : ''} onclick="event.stopPropagation();basculerExo('${e.id}')">+</button>`;
  return `<div class="liste-item exo ${plein && !dansSeance ? 'grise' : ''}" onclick="vueSport.info=vueSport.info==='${e.id}'?null:'${e.id}';vueSport_()">
    <div class="picto">${PICTOS[e.cat] || '•'}</div>
    <div class="info"><div class="titre">${esc(e.nom)}</div><div class="doux petit">${FAMILLES[e.cat]} · ⓘ</div>${ouvert ? `<div class="petit consigne-exo">${esc(e.consigne)}</div>` : ''}</div>${action}</div>`;
}
function blocMaison() {
  const p = S.prefsMaison;
  if (!p.choix.length) { p.choix = genererChoixMaison(); sauver(); }
  const cap = capaciteMaison(), duree = dureeMaison(p.choix.length), plein = p.choix.length >= cap;
  const choisis = p.choix.map(exoParId).filter(Boolean);
  const autres = EXOS_MAISON.filter((e) => !p.choix.includes(e.id));
  const familles = [...new Set(autres.map((e) => FAMILLES[e.cat]))];
  const seg = (liste, cle, fmt) => `<div class="segment">${liste.map((v) => `<button class="${p[cle] === v ? 'on' : ''}" onclick="majMaison('${cle}',${typeof v === 'number' ? v : `'${v}'`})">${fmt(v)}</button>`).join('')}</div>`;
  return `<div class="carte">
    <h3 style="margin-top:0">Durée</h3>${seg(DUREES_MAISON, 'minutes', (m) => `${m}′`)}
    <h3>Envie du jour</h3>${seg(Object.keys(ENVIES), 'envie', (k) => ENVIES[k].nom)}
    <button class="btn" style="margin-top:12px" onclick="regenererMaison()">🎲 Nouvelle séance au hasard</button>
  </div>
  <div class="carte">
    <div class="ligne"><h2 style="margin:0">Ta séance</h2><span class="puce">${choisis.length}/${cap} exos · ${Math.round(duree)}/${p.minutes} min</span></div>
    <div class="barre" style="margin:10px 0 4px"><div style="width:${Math.min(100, (duree / p.minutes) * 100)}%;background:${plein ? 'var(--vert)' : 'var(--bleu)'}"></div></div>
    <p class="doux petit">${TOURS_MAISON} tours · ${p.effort} s d’effort, ${p.repos} s de repos · zéro matériel. Touche un exercice pour voir comment le faire.</p>
    ${choisis.map((e) => ligneExo(e, true)).join('') || '<p class="doux">Ajoute au moins un exercice ci-dessous.</p>'}
    <button class="btn principal" style="margin-top:12px" ${choisis.length ? '' : 'disabled'} onclick="demarrer('maison')">▶️ Lancer la séance</button>
    <details style="margin-top:12px"><summary class="doux petit">Réglages du chrono</summary>
      <h3>Effort</h3>${seg([30, 40, 45], 'effort', (s) => `${s} s`)}
      <h3>Repos</h3>${seg([15, 20, 30], 'repos', (s) => `${s} s`)}
    </details>
  </div>
  <div class="carte"><h2>Ajouter un exercice</h2>
    ${plein ? `<p class="doux petit">⏱️ Séance pleine (${p.minutes} min) : retire un exercice pour en ajouter un autre, ou choisis une durée plus longue.</p>` : ''}
    ${familles.map((f) => `<h3>${f}</h3>${autres.filter((e) => FAMILLES[e.cat] === f).map((e) => ligneExo(e, false, plein)).join('')}`).join('')}
  </div>`;
}
function basculerExo(id) {
  const p = S.prefsMaison;
  if (p.choix.includes(id)) p.choix = p.choix.filter((x) => x !== id);
  else if (p.choix.length < capaciteMaison()) p.choix.push(id);
  sauver(); vueSport_();
}
function majMaison(cle, v) {
  const p = S.prefsMaison; p[cle] = v;
  if (cle === 'envie') p.choix = genererChoixMaison();
  else {
    // Durée ou chrono modifiés : on garde ses choix, on retire l'excédent ou on complète automatiquement.
    const cap = capaciteMaison();
    if (p.choix.length > cap) p.choix = p.choix.slice(0, cap);
    else if (cle === 'minutes') for (const id of genererChoixMaison()) { if (p.choix.length >= cap) break; if (!p.choix.includes(id)) p.choix.push(id); }
  }
  sauver(); vueSport_();
}
function regenererMaison() { S.prefsMaison.choix = genererChoixMaison(); sauver(); vueSport_(); toast('🎲 Nouvelle séance'); }
function changerSalle(id) { if (id === '+') { nouvelleSalle(); return; } S.salleActive = id; sauver(); vueSport_(); }

// Salles : photo → Gemini → cases à cocher.
function ouvrirCalque(html) { const c = $('#calque'); c.innerHTML = `<div class="contenu">${html}</div>`; c.hidden = false; c.scrollTop = 0; }
function fermerCalque() { $('#calque').hidden = true; $('#calque').innerHTML = ''; arreterChrono(); rendre(); }
function nouvelleSalle() { editerSalle(null); }
function editerSalle(id) {
  const salle = S.salles.find((s) => s.id === id) || { id: null, nom: '', materiel: [] };
  ouvrirCalque(`<div class="ligne"><h2 style="margin:0">${id ? 'Machines de la salle' : 'Nouvelle salle'}</h2><button class="x" onclick="fermerCalque()">✕</button></div>
  <label class="champ">Nom de la salle<input id="salle-nom" value="${esc(salle.nom)}" placeholder="Ex. Salle du camp"></label>
  <div class="carte" style="margin-top:12px"><h2>📸 Repérage automatique</h2><p class="doux petit">Photos larges de la salle (jusqu’à 3). L’IA coche ce qu’elle voit, tu corriges.</p>
    <label class="btn principal">Prendre / choisir des photos<input type="file" accept="image/*" multiple hidden onchange="analyserSalle(this.files)"></label>
    <div id="salle-etat"></div></div>
  <h3>Matériel disponible</h3>
  <div class="coches">${MATERIELS.map((m) => `<label><input type="checkbox" value="${m.id}" ${salle.materiel.includes(m.id) ? 'checked' : ''}>${esc(m.nom)}</label>`).join('')}</div>
  <div style="display:grid;gap:10px;margin-top:16px"><button class="btn principal" onclick="enregistrerSalle('${salle.id || ''}')">Enregistrer</button>
  ${id ? `<button class="btn danger" onclick="supprimerSalle('${id}')">Supprimer cette salle</button>` : ''}</div>`);
}
async function analyserSalle(fichiers) {
  const etat = $('#salle-etat');
  etat.innerHTML = '<div class="chargement">Repérage des machines…</div>';
  try {
    const imgs = await Promise.all([...fichiers].slice(0, 3).map((f) => reduireImage(f, 1024)));
    const r = await gemini(consigneSalle(), imgs);
    const ids = new Set((r.materiel || []).filter((x) => MATERIELS.some((m) => m.id === x)));
    $$('#calque .coches input').forEach((c) => { if (ids.has(c.value)) c.checked = true; });
    etat.innerHTML = `<p class="doux petit">✅ ${ids.size} équipement(s) repéré(s). Vérifie la liste ci-dessous.</p>`;
  } catch (e) { etat.innerHTML = `<p style="color:var(--rouge)" class="petit">${esc(e.message)}</p><p class="doux petit">Tu peux cocher à la main.</p>`; }
}
function enregistrerSalle(id) {
  const nom = $('#salle-nom').value.trim() || 'Ma salle';
  const materiel = $$('#calque .coches input:checked').map((c) => c.value);
  if (id) Object.assign(S.salles.find((s) => s.id === id), { nom, materiel });
  else { id = uid(); S.salles.push({ id, nom, materiel }); }
  S.salleActive = id; vueSport.mode = 'gym'; sauver(); fermerCalque(); toast('Salle enregistrée');
}
function supprimerSalle(id) {
  if (!confirm('Supprimer cette salle ?')) return;
  S.salles = S.salles.filter((s) => s.id !== id); if (S.salleActive === id) S.salleActive = S.salles[0]?.id || null;
  sauver(); fermerCalque();
}

// ---------- Lecteur de séance (chrono + repos) ----------
let chrono = null, verrouEcran = null, audio = null;
function bip(n = 1) {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    for (let i = 0; i < n; i++) {
      const o = audio.createOscillator(), g = audio.createGain();
      o.frequency.value = i === n - 1 ? 1200 : 880; o.connect(g); g.connect(audio.destination);
      const t = audio.currentTime + i * 0.25; g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      o.start(t); o.stop(t + 0.2);
    }
  } catch (e) { /* pas de son */ }
}
function demarrer(type) {
  const seance = type === 'gym' ? genererGym(salleActive()) : construireMaison();
  S.enCours = { seance, etapes: etapes(seance), i: 0, debut: Date.now(), finEtape: null, series: [] };
  sauver(); bip(1); ouvrirLecteur();
}
async function ouvrirLecteur() {
  try { verrouEcran = await navigator.wakeLock?.request('screen'); } catch (e) { /* non supporté */ }
  lancerEtape(false);
}
function etapeCourante() { return S.enCours.etapes[S.enCours.i]; }
function lancerEtape(nouvelle = true) {
  const e = etapeCourante();
  tic.bipe = false;
  if (nouvelle) S.enCours.pauseReste = null;
  if (S.enCours.pauseReste != null) S.enCours.finEtape = null; // reste en pause jusqu'à « Reprendre »
  else if (nouvelle || !S.enCours.finEtape) S.enCours.finEtape = (e.secs && !e.reps) ? Date.now() + e.secs * 1000 : null;
  sauver(); afficherLecteur();
  arreterChrono();
  if (S.enCours.finEtape) chrono = setInterval(tic, 250);
}
function arreterChrono() { clearInterval(chrono); chrono = null; }
function tic() {
  if (!S.enCours || !S.enCours.finEtape) return;
  const reste = (S.enCours.finEtape - Date.now()) / 1000;
  const el = $('#lecteur-chrono'); if (el) el.textContent = mmss(reste);
  if (reste <= 3.2 && reste > 0 && !tic.bipe) { tic.bipe = true; bip(1); }
  if (reste <= 0) { tic.bipe = false; bip(2); suivant(); }
}
function prochainTravail() { return S.enCours.etapes.slice(S.enCours.i + 1).find((x) => x.type === 'travail'); }
function afficherLecteur() {
  const { etapes: E, i, seance } = S.enCours; const e = E[i];
  const pct = (i / E.length) * 100;
  const prochain = prochainTravail();
  const enPause = S.enCours.pauseReste != null;
  const reste = enPause ? S.enCours.pauseReste : S.enCours.finEtape ? (S.enCours.finEtape - Date.now()) / 1000 : e.secs;
  const picto = e.exo ? `<div class="picto-grand">${PICTOS[exoParId(e.exo)?.cat] || ''}</div>` : '';
  const btnPause = `<button class="btn ${enPause ? 'principal' : ''}" onclick="basculerPause()">${enPause ? '▶️ Reprendre' : '⏸ Pause'}</button>`;
  let milieu;
  if (e.type === 'repos') {
    milieu = `<div class="phase repos">${enPause ? '⏸ En pause' : 'Repos'}</div><div class="chrono" id="lecteur-chrono">${mmss(reste)}</div>
      ${prochain ? `<div class="suivant">Ensuite : <b>${esc(prochain.nom)}</b> ${prochain.info ? '· ' + esc(prochain.info) : ''}</div>` : ''}`;
  } else if (e.reps) {
    const der = S.charges[e.exo];
    milieu = `<div class="phase">${esc(e.info || '')}</div>${picto}<div class="nom-exo">${esc(e.nom)}</div>
      <div class="objectif">${esc(e.reps)} reps</div><p class="consigne">${esc(e.consigne)}</p>
      ${e.charge ? `<div class="grille2"><label class="champ">Charge (kg)<input id="l-kg" inputmode="decimal" value="${der ? der.kg : ''}"></label><label class="champ">Reps faites<input id="l-reps" inputmode="numeric" value="${der ? der.reps : ''}"></label></div>
      ${der ? `<p class="doux petit" style="text-align:center">Dernière fois : ${der.kg} kg × ${der.reps}${der.reps >= 12 ? ' → essaie +2,5 kg 💪' : ''}</p>` : ''}` : ''}`;
  } else {
    milieu = `<div class="phase">${enPause ? '⏸ En pause' : esc(e.info || 'Go !')}</div>${picto}<div class="nom-exo">${esc(e.nom)}</div>
      <div class="chrono" id="lecteur-chrono">${mmss(reste)}</div><p class="consigne">${esc(e.consigne)}</p>
      ${prochain ? `<div class="suivant">Ensuite : ${esc(prochain.nom)}</div>` : ''}`;
  }
  ouvrirCalque(`<div class="lecteur">
    <div class="ligne"><span class="doux petit">${esc(seance.titre)}</span><button class="x" onclick="quitter()">✕</button></div>
    <div class="progression"><div style="width:${pct}%"></div></div>
    ${milieu}
    <div class="bas">
      ${e.type === 'travail' && e.reps ? `<button class="btn principal" onclick="serieFaite()">✅ Série faite</button>` : ''}
      ${e.type === 'repos' ? `<div class="grille3"><button class="btn" onclick="ajouterTemps(15)">+15 s</button>${btnPause}<button class="btn principal" onclick="suivant()">Passer</button></div>` : ''}
      ${e.type === 'travail' && !e.reps ? `<div class="grille2">${btnPause}<button class="btn" onclick="suivant()">Passer ›</button></div>` : ''}
      <button class="btn mini" style="margin:0 auto;background:none;color:var(--doux)" onclick="precedent()">‹ Revenir</button>
    </div></div>`);
}
function serieFaite() {
  const e = etapeCourante();
  if (e.charge) {
    const kg = num($('#l-kg')?.value), reps = arr(num($('#l-reps')?.value));
    if (kg > 0) { S.charges[e.exo] = { kg, reps: reps || 0, date: aujourdhui() }; S.enCours.series.push({ exo: e.exo, kg, reps }); }
  }
  suivant();
}
function ajouterTemps(s) {
  if (S.enCours.pauseReste != null) S.enCours.pauseReste += s; else S.enCours.finEtape += s * 1000;
  sauver(); afficherLecteur();
}
// Pause : on fige le temps restant ; « Reprendre » relance le chrono à partir de là.
function basculerPause() {
  const E = S.enCours;
  if (E.pauseReste != null) { E.finEtape = Date.now() + E.pauseReste * 1000; E.pauseReste = null; arreterChrono(); chrono = setInterval(tic, 250); }
  else if (E.finEtape) { E.pauseReste = Math.max(0, (E.finEtape - Date.now()) / 1000); E.finEtape = null; arreterChrono(); }
  sauver(); afficherLecteur();
}
function precedent() { if (S.enCours.i > 0) { S.enCours.i--; lancerEtape(true); } }
function suivant() {
  arreterChrono();
  if (S.enCours.i >= S.enCours.etapes.length - 1) { terminer(); return; }
  S.enCours.i++; lancerEtape(true);
}
function quitter() {
  if (S.enCours.finEtape) { S.enCours.pauseReste = Math.max(0, (S.enCours.finEtape - Date.now()) / 1000); S.enCours.finEtape = null; }
  sauver(); arreterChrono(); verrouEcran?.release?.(); fermerCalque(); toast('Séance en pause');
}
function abandonner() { if (!confirm('Abandonner la séance ?')) return; S.enCours = null; sauver(); rendre(); }
function terminer() {
  const { seance, debut } = S.enCours;
  const minutes = Math.max(1, Math.round((Date.now() - debut) / 60000));
  const kcal = kcalSeance(seance.type, minutes);
  jour().seances.push({ id: uid(), titre: seance.titre, type: seance.type, salle: seance.salle || '', minutes, kcal: arr(kcal), heure: heure() });
  S.rotation[seance.type]++;
  // Maison : la prochaine séance sera différente (exercices du jour évités).
  if (seance.type === 'maison') { S.derniersMaison = seance.exos.map((x) => x.id); S.prefsMaison.choix = []; }
  S.enCours = null; sauver(); bip(3); verrouEcran?.release?.();
  ouvrirCalque(`<div style="text-align:center;padding-top:60px"><div style="font-size:72px">🏆</div><h1>Séance terminée</h1>
    <p class="doux">${minutes} min · ~${arr(kcal)} kcal</p>
    <button class="btn principal" style="margin-top:24px" onclick="fermerCalque();aller('jour')">Voir mon bilan</button></div>`);
}

// ---------- Vue : Repas (photo en mine, recettes à l'appart) ----------
let ongletRepas = null; // null = selon le lieu
function vueRepas() {
  if (repasEnCours) { entete('Repas', 'Vérifie et valide'); vueResultatRepas(); return; }
  const o = ongletRepas || (S.lieu === 'appart' ? 'recettes' : 'photo');
  entete('Repas', o === 'photo' ? 'Une photo, et c’est noté' : 'Choisis, ajoute aux courses, cuisine');
  const seg = `<div class="segment" style="margin-bottom:12px"><button class="${o === 'photo' ? 'on' : ''}" onclick="ongletRepas='photo';vueRepas()">📸 Photo</button><button class="${o === 'recettes' ? 'on' : ''}" onclick="ongletRepas='recettes';vueRepas()">📖 Recettes</button></div>`;
  if (o === 'recettes') vueRecettes(seg); else vuePhoto(seg);
}
function vuePhoto(seg) {
  const j = jour();
  $('#vue').innerHTML = `${seg}
  <div class="carte"><h2>📸 Photo de l’assiette</h2>
    <label class="champ" style="margin-top:0">Précision (facultatif)<input id="repas-precision" placeholder="Ex. grande assiette, sauce à part"></label>
    <label class="btn principal" style="margin-top:10px">Prendre la photo<input type="file" accept="image/*" capture="environment" hidden onchange="analyserRepas(this.files[0])"></label>
    <div id="repas-etat"></div>
  </div>
  <div class="carte"><h2>✍️ Sans photo</h2>
    <textarea id="repas-texte" placeholder="Ex. 2 steaks hachés, riz, haricots verts, un yaourt"></textarea>
    <button class="btn" style="margin-top:8px" onclick="analyserTexte(this)">Estimer</button>
  </div>
  ${S.favoris.length ? `<div class="carte"><h2>⭐ Favoris (1 clic)</h2>${S.favoris.map((f, i) => `<div class="liste-item"><div class="info"><div class="titre">${esc(f.nom)}</div><div class="doux petit">${arr(f.kcal)} kcal · P ${arr(f.p)}</div></div><button class="btn mini principal" onclick="ajouterFavori(${i})">+</button><button class="x" onclick="retirerFavori(${i})">×</button></div>`).join('')}</div>` : ''}
  <div class="carte"><h2>Saisie manuelle</h2>
    <input id="m-nom" placeholder="Nom">
    <div class="grille2" style="margin-top:8px"><input id="m-kcal" inputmode="numeric" placeholder="kcal"><input id="m-p" inputmode="numeric" placeholder="Protéines (g)"><input id="m-g" inputmode="numeric" placeholder="Glucides (g)"><input id="m-l" inputmode="numeric" placeholder="Lipides (g)"></div>
    <button class="btn" style="margin-top:8px" onclick="ajouterManuel()">Ajouter</button>
  </div>
  <div class="carte"><h2>Aujourd’hui</h2>${j.repas.length ? j.repas.map((r) => `<div class="liste-item"><div class="info"><div class="titre">${esc(r.nom)}</div><div class="doux petit">${esc(r.heure)}</div></div><b>${arr(r.kcal)} kcal</b></div>`).join('') : '<p class="doux">Rien pour l’instant.</p>'}</div>`;
}
// ---------- Recettes ----------
const MACROS_R = Object.fromEntries(RECETTES.map((r) => [r.id, macrosRecette(r)]));
const recetteParId = (id) => RECETTES.find((r) => r.id === id);
const pictoR = (r) => r.photo ? `<img class="picto photo-r" src="${r.photo}" alt="" loading="lazy">` : `<div class="picto">${r.emoji}</div>`;
const TYPES_R = { tout: 'Tout', 'petit-dej': '☀️ Petit-déj', repas: '🍽️ Repas', 'en-cas': '🍎 En-cas', j80: '💪 J80', fav: '⭐ Favoris' };
let filtreRecettes = 'tout';
function ligneRecette(r) {
  const m = MACROS_R[r.id], dansListe = S.courses.recettes.find((x) => x.id === r.id);
  return `<div class="liste-item exo" onclick="ouvrirRecette('${r.id}')">
    ${pictoR(r)}
    <div class="info"><div class="titre" style="white-space:normal">${esc(r.nom)}${S.recettesFav.includes(r.id) ? ' ⭐' : ''}</div>
      <div class="doux petit">${arr(m.kcal)} kcal · P ${arr(m.p)} g · ${r.temps} min${r.source ? ` · <span class="puce">${esc(r.source)}</span>` : ''}</div></div>
    <button class="btn mini ${dansListe ? '' : 'principal'}" onclick="event.stopPropagation();ajouterAuxCourses('${r.id}',1)">${dansListe ? `🛒 ${dansListe.portions}` : '🛒 +'}</button></div>`;
}
function vueRecettes(seg) {
  const liste = RECETTES.filter((r) => filtreRecettes === 'tout' || (filtreRecettes === 'fav' ? S.recettesFav.includes(r.id) : filtreRecettes === 'j80' ? r.source === 'J80' : r.type === filtreRecettes));
  const nb = S.courses.recettes.reduce((a, x) => a + x.portions, 0);
  $('#vue').innerHTML = `${seg}
  <div class="filtres">${Object.entries(TYPES_R).map(([k, v]) => `<button class="${filtreRecettes === k ? 'on' : ''}" onclick="filtreRecettes='${k}';vueRepas()">${v}</button>`).join('')}</div>
  ${nb ? `<button class="btn" style="margin-bottom:12px" onclick="aller('courses')">🛒 Liste de courses : ${nb} portion${nb > 1 ? 's' : ''} → voir</button>` : ''}
  <div class="carte">${liste.map(ligneRecette).join('') || '<p class="doux">Aucune recette ici. Touche ⭐ dans une recette pour la mettre en favori.</p>'}</div>
  <p class="doux petit">Recettes maison : produits bruts, valeurs calculées à partir des ingrédients. Recettes J80 : valeurs J80. Touche 🛒 pour ajouter une portion à la liste de courses.</p>`;
}
let portionsVue = 1;
function ouvrirRecette(id, portions) {
  const r = recetteParId(id); if (!r) return;
  if (portions) portionsVue = portions; else portionsVue = S.courses.recettes.find((x) => x.id === id)?.portions || (r.prep ? 4 : 1);
  const m = MACROS_R[id], fav = S.recettesFav.includes(id);
  ouvrirCalque(`<div class="ligne">${r.photo ? '<span></span>' : `<span style="font-size:40px">${r.emoji}</span>`}<button class="x" onclick="fermerCalque()">✕</button></div>
  ${r.photo ? `<img class="apercu-photo" src="${r.photo}" alt="">` : ''}
  <h2 style="margin:4px 0">${esc(r.nom)}</h2>
  <p class="doux petit">⏱️ ${r.temps} min${r.prep ? ' · se prépare à l’avance' : ''}${r.source ? ` · recette ${esc(r.source)}` : ''}</p>
  <div class="carte"><div class="grille3" style="text-align:center">
    <div><b style="font-size:22px">${arr(m.kcal)}</b><div class="doux petit">kcal / portion</div></div>
    <div><b style="color:var(--violet)">${arr(m.p)} g</b><div class="doux petit">protéines</div></div>
    <div><b><span style="color:var(--bleu)">${arr(m.g)}</span> / <span style="color:var(--orange)">${arr(m.l)}</span></b><div class="doux petit">gluc. / lip.</div></div></div></div>
  <h3>Portions</h3>
  <div class="segment">${[1, 2, 3, 4, 5, 6].map((n) => `<button class="${n === portionsVue ? 'on' : ''}" onclick="ouvrirRecette('${id}',${n})">${n}</button>`).join('')}</div>
  <h3>Ingrédients (${portionsVue} portion${portionsVue > 1 ? 's' : ''})</h3>
  ${r.i.map(([ing, gr]) => { const x = INGREDIENTS[ing]; return `<div class="ligne petit"><span>${esc(x.nom)}</span><b>${x.placard ? 'au goût' : quantite(x, gr * portionsVue)}</b></div>`; }).join('')}
  <h3>Étapes</h3><ol class="etapes">${r.etapes.map((e, k) => `<li><span class="etape-num">${k + 1}</span><span>${esc(e)}</span></li>`).join('')}</ol>
  <div style="display:grid;gap:10px;margin-top:16px">
    <button class="btn principal" onclick="ajouterAuxCourses('${id}',${portionsVue},true)">🛒 Mettre ${portionsVue} portion${portionsVue > 1 ? 's' : ''} sur la liste</button>
    <button class="btn" onclick="mangerRecetteLocale('${id}')">✅ J’en ai mangé une portion</button>
    <button class="btn" onclick="basculerFavRecette('${id}')">${fav ? '★ Retirer des favoris' : '⭐ Ajouter aux favoris'}</button>
  </div>`);
}
// Quantité lisible : en unités entières (œufs, poivrons… 15 % de marge avant d'en ajouter une) ou arrondie aux 10/50 g supérieurs.
function quantite(x, g) {
  const u = x.unite || 'g';
  if (x.piece) { const n = Math.max(1, Math.ceil(g / x.piece - 0.15)); return `${n} pc · ~${arr(g)} ${u}`; }
  const pas = g >= 300 ? 50 : 10;
  return `${Math.ceil(g / pas) * pas} ${u}`;
}
function ajouterAuxCourses(id, portions, remplacer) {
  const x = S.courses.recettes.find((y) => y.id === id);
  if (x) x.portions = remplacer ? portions : x.portions + portions; else S.courses.recettes.push({ id, portions });
  sauver(); toast(`🛒 ${recetteParId(id).nom} ×${S.courses.recettes.find((y) => y.id === id).portions}`);
  if (remplacer) fermerCalque(); else rendre();
}
function mangerRecetteLocale(id) {
  const r = recetteParId(id), m = MACROS_R[id];
  jour().repas.push({ id: uid(), heure: heure(), nom: r.nom, kcal: arr(m.kcal), p: arr(m.p), g: arr(m.g), l: arr(m.l), source: 'recette' });
  sauver(); toast(`✅ ${arr(m.kcal)} kcal ajoutées`); fermerCalque();
}
function basculerFavRecette(id) {
  const f = S.recettesFav; if (f.includes(id)) f.splice(f.indexOf(id), 1); else f.push(id);
  sauver(); ouvrirRecette(id, portionsVue);
}
// Aujourd'hui, mode appart : les recettes qui rentrent dans les calories restantes.
let decalageRecettes = 0;
function blocRecettesDuJour(b, reste) {
  const manqueP = Math.max(0, b.cibleP - b.mange.p);
  const score = (r) => { const m = MACROS_R[r.id]; let sc = -Math.abs(Math.min(reste, 700) - m.kcal) / 15; if (manqueP > 25) sc += (m.p / m.kcal) * 400; if (reste >= 450 && r.type === 'repas') sc += 15; if (S.recettesFav.includes(r.id)) sc += 5; return sc; };
  const liste = RECETTES.filter((r) => MACROS_R[r.id].kcal <= reste + 30).sort((a, c) => score(c) - score(a));
  if (!liste.length) return `<div class="carte"><h2>🍽️ Et maintenant ?</h2><p class="doux">Plus assez de marge pour une recette : un fruit, des légumes ou un yaourt grec.</p></div>`;
  const n = liste.length, montre = [0, 1, 2].map((k) => liste[(decalageRecettes + k) % n]).filter((x, k, t) => x && t.indexOf(x) === k);
  return `<div class="carte"><h2>🍽️ Recettes pour tes ${arr(reste)} kcal</h2>
    ${manqueP > 25 ? `<p class="doux petit">Il te manque ${arr(manqueP)} g de protéines : les recettes en tiennent compte.</p>` : ''}
    ${montre.map((r) => { const m = MACROS_R[r.id]; return `<div class="liste-item exo" onclick="ouvrirRecette('${r.id}')">${pictoR(r)}<div class="info"><div class="titre" style="white-space:normal">${esc(r.nom)}</div><div class="doux petit">${arr(m.kcal)} kcal · P ${arr(m.p)} g · ${r.temps} min</div></div></div>`; }).join('')}
    <div class="grille2" style="margin-top:10px">${n > 3 ? `<button class="btn" onclick="decalageRecettes+=3;vueJour()">🔄 Autres</button>` : ''}<button class="btn" onclick="ongletRepas='recettes';aller('repas')">📖 Toutes</button></div>
  </div>`;
}

// ---------- Vue : Courses ----------
function articlesCourses() {
  const tot = {};
  for (const { id, portions } of S.courses.recettes) {
    const r = recetteParId(id); if (!r) continue;
    for (const [ing, gr] of r.i) { (tot[ing] ||= { g: 0, rec: new Set() }); tot[ing].g += gr * portions; tot[ing].rec.add(r.nom); }
  }
  const A = Object.entries(tot).map(([ing, t]) => { const x = INGREDIENTS[ing]; return { cle: ing, nom: x.nom, r: x.r, qte: x.placard ? 'vérifie le placard' : quantite(x, t.g), ww: x.ww, rec: [...t.rec], coche: !!S.courses.coches[ing] }; });
  S.courses.extras.forEach((e) => A.push({ cle: 'x:' + e.id, nom: e.nom, r: 5, qte: '', rec: [], coche: !!S.courses.coches['x:' + e.id], extra: e.id }));
  return A;
}
function vueCourses() {
  const A = articlesCourses(), restant = A.filter((a) => !a.coche).length;
  entete('Courses', A.length ? `${restant} article${restant > 1 ? 's' : ''} à prendre · Woolworths` : 'Ta liste se remplit avec les recettes');
  const rayons = [...RAYONS, '📝 Autre'];
  const ligne = (a) => `<label class="article ${a.coche ? 'fait' : ''}"><input type="checkbox" ${a.coche ? 'checked' : ''} onchange="cocher('${a.cle}',this.checked)">
    <div class="info"><div class="titre">${esc(a.nom)}</div>${a.ww ? `<div class="doux petit">${esc(a.ww)}</div>` : ''}</div><b class="petit">${esc(a.qte)}</b>
    ${a.extra ? `<button class="x" onclick="event.preventDefault();retirerExtra('${a.extra}')">×</button>` : ''}</label>`;
  $('#vue').innerHTML = `
  ${S.courses.recettes.length ? `<div class="carte"><h2>Recettes de la semaine</h2>${S.courses.recettes.map(({ id, portions }) => { const r = recetteParId(id); return r ? `<div class="liste-item">${pictoR(r)}<div class="info"><div class="titre" style="white-space:normal">${esc(r.nom)}</div></div>
    <button class="btn mini" onclick="changerPortions('${id}',-1)">−</button><b>${portions}</b><button class="btn mini" onclick="changerPortions('${id}',1)">+</button></div>` : ''; }).join('')}</div>`
  : `<div class="carte"><h2>🛒 Liste vide</h2><p class="doux">Va dans <b>Repas → Recettes</b> et touche 🛒 sur ce que tu veux cuisiner : les ingrédients s’additionnent ici, rangés par rayon.</p><button class="btn principal" onclick="ongletRepas='recettes';aller('repas')">📖 Choisir des recettes</button></div>`}
  ${A.length ? rayons.map((ry, k) => { const L = A.filter((a) => a.r === k).sort((a, b) => a.coche - b.coche); return L.length ? `<div class="carte"><h2>${ry}</h2>${L.map(ligne).join('')}</div>` : ''; }).join('') : ''}
  <div class="carte"><h2>➕ Autre chose</h2><div class="ligne"><input id="extra-nom" placeholder="Ex. éponges, café, dentifrice" onkeydown="if(event.key==='Enter')ajouterExtra()"><button class="btn mini principal" onclick="ajouterExtra()">Ajouter</button></div></div>
  ${A.length ? `<button class="btn ${restant ? '' : 'principal'}" onclick="viderCourses()">✅ Courses faites : vider la liste</button>` : ''}`;
}
function cocher(cle, v) { if (v) S.courses.coches[cle] = true; else delete S.courses.coches[cle]; sauver(); vueCourses(); }
function changerPortions(id, d) {
  const x = S.courses.recettes.find((y) => y.id === id); if (!x) return;
  x.portions += d; if (x.portions <= 0) S.courses.recettes = S.courses.recettes.filter((y) => y.id !== id);
  sauver(); vueCourses();
}
function ajouterExtra() { const nom = $('#extra-nom').value.trim(); if (!nom) return; S.courses.extras.push({ id: uid(), nom }); sauver(); vueCourses(); $('#extra-nom')?.focus(); }
function retirerExtra(id) { S.courses.extras = S.courses.extras.filter((e) => e.id !== id); delete S.courses.coches['x:' + id]; sauver(); vueCourses(); }
function viderCourses() { if (!confirm('Courses faites ? La liste sera vidée.')) return; S.courses = { recettes: [], coches: {}, extras: [] }; sauver(); vueCourses(); }

async function analyserRepas(fichier) {
  if (!fichier) return;
  const etat = $('#repas-etat'); etat.innerHTML = '<div class="chargement">Analyse de l’assiette…</div>';
  try {
    const img = await reduireImage(fichier, 1024);
    const precision = $('#repas-precision').value.trim();
    const r = await gemini(CONSIGNE_REPAS + (precision ? `\nPrécision de l'utilisateur : ${precision}` : ''), [img]);
    repasEnCours = { ...normaliserRepas(r), photo: img, facteur: 1, source: 'photo' }; vueRepas();
  } catch (e) { etat.innerHTML = `<p style="color:var(--rouge)" class="petit">${esc(e.message)}</p>`; }
}
async function analyserTexte(btn) {
  const t = $('#repas-texte').value.trim(); if (!t) return;
  btn.disabled = true; btn.textContent = 'Estimation…';
  try { const r = await gemini(CONSIGNE_REPAS + `\nDescription du repas : ${t}`); repasEnCours = { ...normaliserRepas(r), facteur: 1, source: 'texte' }; vueRepas(); }
  catch (e) { toast(e.message, 4000); btn.disabled = false; btn.textContent = 'Estimer'; }
}
function normaliserRepas(r) {
  const aliments = (r.aliments || []).map((a) => ({ nom: String(a.nom || 'Aliment'), grammes: arr(a.grammes), kcal: num(a.kcal), p: num(a.p), g: num(a.g), l: num(a.l), garde: true }));
  return { nom: String(r.nom || 'Repas'), aliments, confiance: r.confiance || '' };
}
function totalRepas(R) {
  return R.aliments.filter((a) => a.garde).reduce((t, a) => ({ kcal: t.kcal + a.kcal * R.facteur, p: t.p + a.p * R.facteur, g: t.g + a.g * R.facteur, l: t.l + a.l * R.facteur }), { kcal: 0, p: 0, g: 0, l: 0 });
}
function vueResultatRepas() {
  const R = repasEnCours, t = totalRepas(R);
  $('#vue').innerHTML = `<div class="carte">
    ${R.photo ? `<img class="apercu-photo" src="${R.photo}" alt="">` : ''}
    <input id="r-nom" value="${esc(R.nom)}" onchange="repasEnCours.nom=this.value">
    <div class="grille3" style="text-align:center;margin:14px 0">
      <div><b style="font-size:24px">${arr(t.kcal)}</b><div class="doux petit">kcal</div></div>
      <div><b>${arr(t.p)} g</b><div class="doux petit">protéines</div></div>
      <div><b>${arr(t.g)} / ${arr(t.l)}</b><div class="doux petit">gluc. / lip.</div></div>
    </div>
    ${R.confiance ? `<p class="doux petit">Confiance de l’estimation : ${esc(R.confiance)}</p>` : ''}
    <h3>Portion</h3>
    <div class="segment">${[0.5, 0.75, 1, 1.25, 1.5, 2].map((f) => `<button class="${f === R.facteur ? 'on' : ''}" onclick="repasEnCours.facteur=${f};vueResultatRepas()">×${String(f).replace('.', ',')}</button>`).join('')}</div>
    <h3>Détail (décoche ce que tu n’as pas mangé)</h3>
    ${R.aliments.map((a, i) => `<div class="liste-item"><input type="checkbox" style="width:22px;height:22px;accent-color:var(--vert)" ${a.garde ? 'checked' : ''} onchange="repasEnCours.aliments[${i}].garde=this.checked;vueResultatRepas()">
      <div class="info"><div class="titre">${esc(a.nom)}</div><div class="doux petit">~${a.grammes} g · P ${arr(a.p)} · G ${arr(a.g)} · L ${arr(a.l)}</div></div><b>${arr(a.kcal * R.facteur)}</b></div>`).join('')}
    <div style="display:grid;gap:10px;margin-top:14px">
      <button class="btn principal" onclick="validerRepas(false)">Ajouter à aujourd’hui</button>
      <button class="btn" onclick="validerRepas(true)">Ajouter + garder en favori ⭐</button>
      <button class="btn danger" onclick="repasEnCours=null;vueRepas()">Annuler</button>
    </div></div>`;
}
function validerRepas(favori) {
  const R = repasEnCours, t = totalRepas(R);
  const nom = ($('#r-nom')?.value || R.nom).trim();
  const r = { id: uid(), heure: heure(), nom, kcal: arr(t.kcal), p: arr(t.p), g: arr(t.g), l: arr(t.l), source: R.source };
  jour().repas.push(r);
  if (favori) S.favoris.unshift({ nom, kcal: r.kcal, p: r.p, g: r.g, l: r.l });
  repasEnCours = null; sauver(); toast(`✅ ${r.kcal} kcal ajoutées`); aller('jour');
}
function ajouterFavori(i) { const f = S.favoris[i]; jour().repas.push({ id: uid(), heure: heure(), ...f, source: 'favori' }); sauver(); toast(`✅ ${f.nom}`); rendre(); }
function retirerFavori(i) { if (!confirm('Retirer ce favori ?')) return; S.favoris.splice(i, 1); sauver(); rendre(); }
function ajouterManuel() {
  const kcal = num($('#m-kcal').value); if (!kcal) { toast('Indique au moins les kcal'); return; }
  jour().repas.push({ id: uid(), heure: heure(), nom: $('#m-nom').value.trim() || 'Repas', kcal, p: num($('#m-p').value), g: num($('#m-g').value), l: num($('#m-l').value), source: 'manuel' });
  sauver(); toast('✅ Ajouté'); rendre();
}

// ---------- Vue : Profil ----------
function courbePoids() {
  const P = S.pesees.slice(-30); if (P.length < 2) return '';
  const min = Math.min(...P.map((p) => p.poids)) - 0.5, max = Math.max(...P.map((p) => p.poids)) + 0.5;
  const pts = P.map((p, i) => `${(i / (P.length - 1)) * 300},${80 - ((p.poids - min) / (max - min)) * 70}`).join(' ');
  return `<svg viewBox="-5 0 310 90" style="width:100%;height:90px;margin-top:8px"><polyline points="${pts}" fill="none" stroke="var(--vert)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}
function vueProfil() {
  entete('Profil', 'Réglages et sauvegarde');
  const p = S.profil, ok = profilComplet();
  const m = imc();
  $('#vue').innerHTML = `
  <div class="carte"><h2>Moi</h2>
    <div class="segment"><button class="${p.sexe === 'H' ? 'on' : ''}" onclick="majProfil('sexe','H')">Homme</button><button class="${p.sexe === 'F' ? 'on' : ''}" onclick="majProfil('sexe','F')">Femme</button></div>
    <div class="grille3"><label class="champ">Âge<input inputmode="numeric" value="${esc(p.age)}" onchange="majProfil('age',this.value)"></label>
    <label class="champ">Taille (cm)<input inputmode="numeric" value="${esc(p.taille)}" onchange="majProfil('taille',this.value)"></label>
    <label class="champ">Poids (kg)<input inputmode="decimal" value="${esc(S.pesees.at(-1)?.poids ?? p.poids)}" onchange="majPoids(this.value)"></label></div>
    <label class="champ">Objectif<select onchange="majProfil('objectif',this.value)">${Object.entries(OBJECTIFS).map(([k, o]) => `<option value="${k}" ${k === p.objectif ? 'selected' : ''}>${o.nom}</option>`).join('')}</select></label>
    <div class="coches" style="display:block;margin-top:10px"><label><input type="checkbox" ${p.montre ? 'checked' : ''} onchange="majProfil('montre',this.checked)">Je porte une Apple Watch pendant le sport</label></div>
  </div>
  ${ok ? `<div class="carte"><h2>Mes chiffres</h2>
    <div class="ligne"><span>Métabolisme de base</span><b>${arr(metabolismeBase())} kcal</b></div>
    <div class="ligne"><span>Maintien estimé (jour type)</span><b>${arr(metabolismeBase() * 1.1 + 300)} kcal</b></div>
    <div class="ligne"><span>Protéines visées</span><b>${arr(poidsActuel() * 2)} g / jour</b></div>
    <div class="ligne"><span>Lipides visés</span><b>${arr(poidsActuel() * 0.9)} g / jour</b></div>
    <div class="ligne"><span>Glucides</span><b>le reste des calories</b></div>
    <div class="ligne"><span>IMC</span><b>${m.toFixed(1)}</b></div>
    <p class="doux petit">Le maintien réel change chaque jour avec tes pas et tes séances : c’est l’onglet Aujourd’hui qui fait le calcul.</p>
    ${courbePoids()}
    <p class="doux petit">Mets ton poids à jour quand tu te pèses : la courbe se dessine toute seule.</p></div>` : ''}
  <div class="carte"><h2>❤️ App Santé</h2>
    <p class="doux petit">Un raccourci iPhone copie tes pas et tes calories actives ; l’app les lit quand tu touches « Importer mes pas ».</p>
    <button class="btn" onclick="guideRaccourci()">Créer le raccourci (2 min)</button></div>
  <div class="carte"><h2>🤖 Photos (Gemini)</h2>
    <label class="champ" style="margin-top:0">Clé API Gemini<input type="password" autocomplete="off" value="${esc(S.reglages.cleGemini)}" placeholder="Colle ta clé ici" onchange="S.reglages.cleGemini=this.value.trim();sauver();toast('Clé enregistrée sur ce téléphone')"></label>
    <label class="champ">Modèle<input value="${esc(S.reglages.modele)}" onchange="S.reglages.modele=this.value.trim()||MODELE_GEMINI;sauver()"></label>
    <button class="btn" style="margin-top:10px" onclick="testerCle(this)">Tester la clé</button>
    <p class="doux petit">La clé reste dans ce téléphone. Clé sur <b>aistudio.google.com</b> → « Get API key ».</p></div>
  <div class="carte"><h2>💬 Un retour pour Melvin ?</h2>
    <p class="doux petit">Un bug, une idée, un truc pas clair : écris-le, puis envoie-le par WhatsApp.</p>
    <textarea id="retour-texte" placeholder="Ex. dans Courses, j’aimerais pouvoir…"></textarea>
    <button class="btn principal" style="margin-top:8px" onclick="envoyerRetour()">Envoyer mon retour</button>
    <p class="doux petit" style="text-align:center;margin-top:10px">Application Polo · ${VERSION_APP}</p></div>
  <div class="carte"><h2>💾 Sauvegarde</h2>
    <p class="doux petit">Tout est stocké dans ce téléphone. Exporte de temps en temps (Fichiers, iCloud…) pour ne rien perdre en changeant de téléphone.</p>
    <div class="grille2"><button class="btn" onclick="exporter()">Exporter</button><label class="btn">Importer<input type="file" accept="application/json,.json" hidden onchange="importer(this.files[0])"></label></div></div>`;
}
// Retour de Polo : feuille de partage iPhone (WhatsApp…) avec la version et le contexte, sinon copie.
async function envoyerRetour() {
  const t = $('#retour-texte').value.trim(); if (!t) { toast('Écris ton retour d’abord'); return; }
  const msg = `📱 Retour Application Polo (${VERSION_APP}, mode ${S.lieu === 'appart' ? 'appart' : 'mine'}) :\n${t}`;
  try { if (navigator.share) { await navigator.share({ text: msg }); $('#retour-texte').value = ''; return; } } catch (e) { if (e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(msg); toast('Copié : colle-le dans WhatsApp', 3000); } catch (e) { prompt('Copie ce texte dans WhatsApp :', msg); }
}
function majProfil(k, v) { S.profil[k] = v; sauver(); vueProfil(); }
function majPoids(v) {
  const kg = num(v); if (!kg) return;
  S.profil.poids = kg;
  const d = aujourdhui(); S.pesees = S.pesees.filter((p) => p.date !== d); S.pesees.push({ date: d, poids: kg });
  S.pesees.sort((a, b) => a.date.localeCompare(b.date)); sauver(); vueProfil();
}
async function testerCle(btn) {
  btn.disabled = true; btn.textContent = 'Test…';
  try { const r = await gemini('Réponds en JSON : {"ok":true}'); toast(r.ok ? '✅ La clé marche' : 'Réponse inattendue'); }
  catch (e) { toast(e.message, 4000); }
  btn.disabled = false; btn.textContent = 'Tester la clé';
}
function exporter() {
  const blob = new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `polo-sauvegarde-${aujourdhui()}.json`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
async function importer(f) {
  if (!f) return;
  try {
    const d = JSON.parse(await f.text()); if (!d.jours || !d.profil) throw new Error();
    if (!confirm('Remplacer les données de ce téléphone par cette sauvegarde ?')) return;
    localStorage.setItem(CLE, JSON.stringify(d)); S = charger(); toast('✅ Sauvegarde restaurée'); rendre();
  } catch (e) { toast('Fichier de sauvegarde invalide'); }
}
function guideRaccourci() {
  ouvrirCalque(`<div class="ligne"><h2 style="margin:0">Raccourci « Santé Polo »</h2><button class="x" onclick="fermerCalque()">✕</button></div>
  <p class="doux">À faire une seule fois, dans l’app <b>Raccourcis</b> de l’iPhone.</p>
  <ol class="etapes">
    <li><span class="etape-num">1</span><span>Raccourcis → <b>+</b> → nomme-le <b>Santé Polo</b>.</span></li>
    <li><span class="etape-num">2</span><span>Ajoute l’action <b>Rechercher des échantillons de santé</b> : type <b>Pas</b>, date « est aujourd’hui ». Puis <b>Calculer les statistiques</b> → <b>Somme</b>.</span></li>
    <li><span class="etape-num">3</span><span>Ajoute à nouveau <b>Rechercher des échantillons de santé</b> : type <b>Énergie active</b>, « est aujourd’hui », puis <b>Calculer les statistiques</b> → <b>Somme</b>.</span></li>
    <li><span class="etape-num">4</span><span>Ajoute <b>Texte</b> et écris : <b>POLO;pas=</b>[Somme des pas]<b>;kcal=</b>[Somme de l’énergie] (insère les variables avec le bouton au-dessus du clavier).</span></li>
    <li><span class="etape-num">5</span><span>Ajoute <b>Copier dans le presse-papiers</b>.</span></li>
    <li><span class="etape-num">6</span><span>Lance-le une fois et autorise l’accès à Santé.</span></li>
    <li><span class="etape-num">7</span><span><b>Pour que ça tourne tout seul</b> : onglet <b>Automatisation</b> → <b>+</b> → <b>Heure de la journée</b> (ex. 12 h, puis refais-en une à 19 h et 22 h) → <b>Exécuter immédiatement</b> → choisis <b>Santé Polo</b>.</span></li>
  </ol>
  <div class="carte" style="margin-top:12px"><b>Ensuite :</b> l’iPhone prépare tes chiffres tout seul aux heures choisies. Dans l’app, touche <b>❤️ Récupérer mes pas</b> et autorise le collage. Pour avoir les chiffres à la minute près, lance « Santé Polo » toi-même (Siri ou écran d’accueil) juste avant.</div>
  <p class="doux petit">Pourquoi un bouton à toucher ? Apple ne laisse pas une app installée depuis Safari lire l’app Santé directement : le raccourci sert de pont.</p>
  <button class="btn principal" onclick="fermerCalque()">Compris</button>`);
}

// ---------- Démarrage ----------
$$('#onglets button').forEach((b) => b.addEventListener('click', () => aller(b.dataset.onglet)));
lireAdresse();
rendre();
if (S.enCours) toast('Séance en cours : onglet Sport pour reprendre', 3500);
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});

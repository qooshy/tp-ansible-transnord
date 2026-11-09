const path = require("path");
const fs = require("fs");
const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const fa = require("react-icons/fa");
const { applyTheme } = require(process.env.SKILL_DIR + "/scripts/apply_theme.js");

const OUT = process.argv[2];
const HERE = __dirname;

const THEME = {
  name: "TransNord",
  headFontFace: "Calibri",
  bodyFontFace: "Calibri",
  colors: {
    dk1: "1D2733", lt1: "FFFFFF", dk2: "13263B", lt2: "EEF2F6",
    accent1: "E8890C", accent2: "1E7D43", accent3: "B3261E", accent4: "2F6DB5",
    accent5: "5F6B7A", accent6: "FFB020", hlink: "2F6DB5", folHlink: "5F6B7A",
  },
};
const HEX = THEME.colors;

async function icon(Comp, color, size = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(Comp, { color: "#" + color, size: String(size) }));
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}

(async () => {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";              // 10 x 5.625 in
  pres.author = "Alexis Rodrigues";
  pres.company = "TransNord";
  pres.title = "TransNord - une informatique qui ne bloque plus les camions";
  pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
  const C = pres.SchemeColor;

  // ------------------------------------------------------------ layouts
  pres.defineSlideMaster({
    title: "Titre sombre",
    background: { color: HEX.dk2 },
    objects: [
      { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 1.55, w: 8.8, h: 1.5, fontSize: 40, bold: true, color: C.background1, valign: "bottom", align: "left", margin: 0 }, text: "" } },
      { placeholder: { options: { name: "body", type: "body", x: 0.6, y: 3.25, w: 8.8, h: 1.0, fontSize: 18, color: C.background2, valign: "top", margin: 0 }, text: "" } },
    ],
  });
  pres.defineSlideMaster({
    title: "Conclusion sombre",
    background: { color: HEX.dk2 },
    objects: [
      { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 0.45, w: 8.8, h: 0.8, fontSize: 32, bold: true, color: C.background1, valign: "middle", align: "left", margin: 0 }, text: "" } },
      { placeholder: { options: { name: "body", type: "body", x: 0.6, y: 1.45, w: 8.8, h: 2.9, fontSize: 20, color: C.background1, valign: "top", margin: 0 }, text: "" } },
    ],
  });
  pres.defineSlideMaster({
    title: "Contenu",
    background: { color: HEX.lt1 },
    margin: [0.5, 0.5, 0.5, 0.5],
    objects: [
      { placeholder: { options: { name: "title", type: "title", x: 0.5, y: 0.3, w: 7.6, h: 0.75, fontSize: 28, bold: true, color: C.text2, valign: "middle", align: "left", margin: 0 }, text: "" } },
      { text: { text: "TransNord - infrastructure Lille & Dunkerque", options: { x: 0.5, y: 5.2, w: 6, h: 0.3, fontSize: 10, color: C.accent5, margin: 0 } } },
    ],
    slideNumber: { x: 9.0, y: 5.2, w: 0.5, h: 0.3, fontSize: 10, color: HEX.accent5, align: "right" },
  });

  // ------------------------------------------------------------ helpers
  const ic = {};
  const want = {
    truck: [fa.FaTruck, HEX.lt1], link: [fa.FaUnlink, HEX.lt1], lock: [fa.FaLock, HEX.lt1], db: [fa.FaDatabase, HEX.lt1],
    shield: [fa.FaShieldAlt, HEX.lt1], id: [fa.FaIdCard, HEX.lt1], bell: [fa.FaBell, HEX.lt1], book: [fa.FaBook, HEX.lt1],
    euro: [fa.FaEuroSign, HEX.lt1], server: [fa.FaServer, HEX.dk2], building: [fa.FaBuilding, HEX.dk2], warehouse: [fa.FaWarehouse, HEX.dk2],
    check: [fa.FaCheck, HEX.lt1], times: [fa.FaTimes, HEX.lt1], play: [fa.FaPlay, HEX.lt1], history: [fa.FaHistory, HEX.lt1],
    file: [fa.FaFileExcel, HEX.lt1], user: [fa.FaUserClock, HEX.lt1], envelope: [fa.FaEnvelope, HEX.lt1], chart: [fa.FaChartLine, HEX.lt1],
    redo: [fa.FaRedo, HEX.lt1], plus: [fa.FaPlusCircle, HEX.lt1], arrow: [fa.FaArrowRight, HEX.accent5], sync: [fa.FaSyncAlt, HEX.lt1],
  };
  for (const [k, [Comp, col]] of Object.entries(want)) ic[k] = await icon(Comp, col);

  function circleIcon(slide, key, x, y, d, fill, name) {
    slide.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: fill }, line: { color: fill }, objectName: name + " cercle" });
    const p = d * 0.25;
    slide.addImage({ data: ic[key], x: x + p, y: y + p, w: d - 2 * p, h: d - 2 * p, objectName: name + " icone" });
  }
  function demoBadge(slide, label) {
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 8.15, y: 0.42, w: 1.35, h: 0.5, rectRadius: 0.25, fill: { color: C.accent1 }, line: { color: C.accent1 }, objectName: "Badge demo" });
    slide.addImage({ data: ic.play, x: 8.32, y: 0.55, w: 0.24, h: 0.24, objectName: "Badge demo icone" });
    slide.addText(label, { x: 8.6, y: 0.42, w: 0.85, h: 0.5, fontSize: 14, bold: true, color: C.background1, valign: "middle", margin: 0, isTextBox: true, objectName: "Badge demo texte" });
  }
  function card(slide, x, y, w, h, name, fill = C.background2) {
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.08, fill: { color: fill }, line: { color: fill }, objectName: name });
  }
  const content = (section) => pres.addSlide({ masterName: "Contenu", sectionTitle: section });

  // ============================================================ 1. Titre
  pres.addSection({ title: "Introduction" });
  let s = pres.addSlide({ masterName: "Titre sombre", sectionTitle: "Introduction" });
  s.addText("Une informatique qui ne bloque plus les camions", { placeholder: "title" });
  s.addText("TransNord - Lille & Dunkerque\nAlexis Rodrigues - projet d'infrastructure, novembre 2026", { placeholder: "body" });
  circleIcon(s, "truck", 0.6, 0.55, 0.85, HEX.accent1, "Camion");
  s.addNotes(`[0:00 - 0:45]
Bonjour. Vous m'avez confié votre informatique avec une liste de problèmes très concrets : des camions bloqués, des salaires qui ont fuité, trois jours de travail à la main...
Je ne vais pas vous parler de technique. Je vais reprendre vos problèmes un par un, vous dire ce qui se passe maintenant, et pour trois d'entre eux vous le montrer en direct.

Avant la présentation : VM démarrées (vagrant up --no-provision 15 min avant), onglets ouverts : TrackR https://192.168.56.20 connecté en j.moreau, Grafana http://192.168.56.10:3000, boîte mail http://192.168.56.10:8025, terminal "vagrant ssh ops01" dans /srv/infra/ansible.`);

  // ============================================================ 2. Ce que vous nous avez dit
  s = content("Introduction");
  s.addText("Ce que vous nous avez dit", { placeholder: "title" });
  const pains = [
    ["truck", "TrackR en panne 1 heure", "Les camions attendaient au quai"],
    ["link", "La liaison avec Dunkerque coupée", "Un site entier à l'arrêt"],
    ["lock", "Des fiches de salaire ont fuité", "En interne, sans savoir qui"],
    ["db", "Serveur compta en panne", "3 jours de travail à la main"],
    ["shield", "L'assureur veut des preuves", "Que tout est à jour et suivi"],
    ["id", "Accès et prestataires", "Qui a accès à quoi, jusqu'à quand ?"],
  ];
  pains.forEach(([k, t, d], i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = 0.5 + col * 3.05, y = 1.3 + row * 1.85;
    card(s, x, y, 2.85, 1.6, "Carte " + t);
    circleIcon(s, k, x + 0.2, y + 0.25, 0.6, i < 4 ? HEX.accent3 : HEX.accent5, t);
    s.addText(t, { x: x + 0.95, y: y + 0.2, w: 1.75, h: 0.75, fontSize: 15, bold: true, color: C.text1, valign: "middle", margin: 0, isTextBox: true, objectName: "Titre " + t });
    s.addText(d, { x: x + 0.2, y: y + 1.0, w: 2.5, h: 0.5, fontSize: 12, color: C.accent5, valign: "top", margin: 0, isTextBox: true, objectName: "Detail " + t });
  });
  s.addNotes(`[0:45 - 1:45]
Voici ce que vous m'avez dit. Je les ai rangés : en rouge, ce qui a déjà coûté de l'argent ; en gris, ce qui inquiète pour demain.
Tout ce que j'ai construit répond à une de ces cases. Aucune technologie n'a été choisie "parce que c'est bien" : chacune répond à un de ces problèmes.`);

  // ============================================================ 3. La solution en une image
  s = content("Introduction");
  s.addText("La solution en une image", { placeholder: "title" });
  // Lille
  card(s, 0.5, 1.25, 3.6, 3.7, "Site Lille");
  circleIcon(s, "building", 0.7, 1.4, 0.6, HEX.lt1, "Lille");
  s.addText([{ text: "Lille", options: { bold: true, fontSize: 18, breakLine: true } }, { text: "Siège : direction, RH, compta, informatique", options: { fontSize: 12, color: C.accent5 } }],
    { x: 1.4, y: 1.35, w: 2.6, h: 0.75, valign: "middle", margin: 0, color: C.text1, isTextBox: true, objectName: "Lille titre" });
  const lille = [["Annuaire (connexions)", "Chacun garde son identifiant si la liaison tombe"], ["Coffre de sauvegardes", "Copie chiffrée de tout, hors de Dunkerque"]];
  lille.forEach(([t, d], i) => {
    const y = 2.35 + i * 1.25;
    card(s, 0.7, y, 3.2, 1.05, "Lille " + t, C.background1);
    s.addImage({ data: ic.server, x: 0.85, y: y + 0.3, w: 0.4, h: 0.4, objectName: "Lille icone " + i });
    s.addText([{ text: t, options: { bold: true, fontSize: 14, breakLine: true } }, { text: d, options: { fontSize: 11, color: C.accent5 } }],
      { x: 1.4, y: y + 0.1, w: 2.4, h: 0.85, valign: "middle", margin: 0, color: C.text1, isTextBox: true, objectName: "Lille " + t });
  });
  // liaison
  s.addShape(pres.shapes.LINE, { x: 4.2, y: 3.1, w: 1.3, h: 0, line: { color: C.accent5, width: 2, dashType: "dash" }, objectName: "Liaison" });
  s.addText("liaison\nréseau", { x: 4.2, y: 3.2, w: 1.3, h: 0.5, fontSize: 11, color: C.accent5, align: "center", margin: 0, isTextBox: true, objectName: "Liaison texte" });
  // Dunkerque
  card(s, 5.6, 1.25, 3.9, 3.7, "Site Dunkerque");
  circleIcon(s, "warehouse", 5.8, 1.4, 0.6, HEX.lt1, "Dunkerque");
  s.addText([{ text: "Dunkerque", options: { bold: true, fontSize: 18, breakLine: true } }, { text: "Quai, exploitation, salle serveur", options: { fontSize: 12, color: C.accent5 } }],
    { x: 6.5, y: 1.35, w: 2.9, h: 0.75, valign: "middle", margin: 0, color: C.text1, isTextBox: true, objectName: "Dunkerque titre" });
  const dk = [["TrackR en double", "Deux serveurs : si l'un tombe, l'autre prend le relais"], ["Annuaire + partage Paie", "Connexions locales, salaires protégés"], ["Poste de pilotage", "Surveillance, alertes, accès à distance"]];
  dk.forEach(([t, d], i) => {
    const y = 2.3 + i * 0.88;
    card(s, 5.8, y, 3.5, 0.78, "Dunkerque " + t, C.background1);
    s.addImage({ data: ic.server, x: 5.95, y: y + 0.2, w: 0.38, h: 0.38, objectName: "Dunkerque icone " + i });
    s.addText([{ text: t, options: { bold: true, fontSize: 13, breakLine: true } }, { text: d, options: { fontSize: 10.5, color: C.accent5 } }],
      { x: 6.45, y: y + 0.05, w: 2.8, h: 0.68, valign: "middle", margin: 0, color: C.text1, isTextBox: true, objectName: "Dunkerque " + t });
  });
  s.addNotes(`[1:45 - 2:45]
Concrètement : 7 serveurs virtuels, répartis sur vos deux sites.
À Dunkerque, là où sont les camions : TrackR en double, l'annuaire des comptes, et le poste de pilotage qui surveille tout.
À Lille : un deuxième annuaire, pour que Lille continue de se connecter même si la liaison tombe, et les sauvegardes, volontairement loin de Dunkerque : si la salle serveur brûle, les données sont ailleurs.
Tout est installé automatiquement par un seul outil, Ansible. J'y reviens à la fin.`);

  // ============================================================ 4. TrackR
  pres.addSection({ title: "Vos incidents" });
  s = content("Vos incidents");
  s.addText("TrackR ne bloquera plus les camions", { placeholder: "title" });
  demoBadge(s, "DÉMO 1");
  card(s, 0.5, 1.3, 2.7, 3.6, "Avant", "FBEAE8");
  s.addText([{ text: "Avant", options: { bold: true, fontSize: 14, color: C.accent3, breakLine: true } },
    { text: "1 heure", options: { bold: true, fontSize: 44, color: C.accent3, breakLine: true } },
    { text: "de panne, un seul serveur, des camions qui attendent au quai", options: { fontSize: 13, color: C.text1 } }],
    { x: 0.75, y: 1.5, w: 2.25, h: 3.2, valign: "middle", margin: 0, isTextBox: true, objectName: "Avant texte" });
  const steps = [
    ["server", "Deux serveurs TrackR", "Les données sont copiées en continu de l'un à l'autre."],
    ["sync", "Bascule automatique en moins de 15 secondes", "Si un serveur tombe, l'autre reprend son adresse et ses données. Personne n'intervient."],
    ["truck", "Le poste du quai n'attend jamais", "Si aucun serveur ne répond, la saisie est gardée sur le poste et envoyée dès le retour, sans doublon."],
  ];
  steps.forEach(([k, t, d], i) => {
    const y = 1.3 + i * 1.25;
    circleIcon(s, k === "server" ? "check" : k, 3.55, y + 0.15, 0.65, HEX.accent2, t);
    s.addText([{ text: t, options: { bold: true, fontSize: 16, color: C.text1, breakLine: true } }, { text: d, options: { fontSize: 13, color: C.accent5 } }],
      { x: 4.4, y, w: 5.1, h: 1.1, valign: "middle", margin: 0, isTextBox: true, objectName: "Etape " + t });
  });
  s.addNotes(`[2:45 - 5:00]  DÉMO 1 (environ 2 min)
Votre pire incident : TrackR en panne une heure. Aujourd'hui, TrackR tourne sur deux serveurs qui se copient en permanence.

DÉMO :
1. Montrer TrackR (onglet 1) : saisir un camion "AB-123-CD", référence "EXP-0001", heure prévue il y a 30 min -> Arrivée. La ligne apparaît en RETARD. En bas : "servi par web01".
2. "Je débranche le serveur principal." Sur le PC (terminal Windows, dossier du projet) :
     vagrant halt web01 --force
3. Revenir sur TrackR : le bandeau passe au rouge quelques secondes, puis "Connecté - serveur web02". Saisir un 2e camion : ça marche.
4. Dire : "Personne n'a rien fait. Pendant ce temps, l'équipe informatique a reçu un e-mail." (on le montrera après la démo 2, il arrive en ~1 min).

Si ça ne bascule pas : montrer la capture du tableau de bord (slide 9) et passer à la suite.
Après la présentation : vagrant up web01, puis
     bash ../scripts/deploy playbooks/ops/trackr-reconstruire-secours.yml -e serveur=web01`);

  // ============================================================ 5. Liaison
  s = content("Vos incidents");
  s.addText("Liaison coupée : chaque site continue seul", { placeholder: "title" });
  demoBadge(s, "DÉMO 2");
  const cols = [
    ["warehouse", "Dunkerque", ["TrackR fonctionne normalement", "Les connexions passent par l'annuaire local", "Les camions sont suivis"]],
    ["building", "Lille", ["Les postes se connectent via l'annuaire de Lille", "Les journaux attendent et partent au retour", "Tout se resynchronise seul"]],
  ];
  cols.forEach(([k, t, items], i) => {
    const x = 0.5 + i * 2.75;
    card(s, x, 1.3, 2.55, 3.0, "Site " + t);
    circleIcon(s, k, x + 0.2, 1.45, 0.55, HEX.lt1, t);
    s.addText(t, { x: x + 0.85, y: 1.45, w: 1.6, h: 0.55, fontSize: 18, bold: true, color: C.text1, valign: "middle", margin: 0, isTextBox: true, objectName: "Site titre " + t });
    s.addText(items.map((it, j) => ({ text: it, options: { bullet: { indent: 16 }, breakLine: j < items.length - 1 } })),
      { x: x + 0.2, y: 2.2, w: 2.2, h: 2.5, fontSize: 13, color: C.text1, valign: "top", paraSpaceAfter: 8, margin: 0, isTextBox: true, objectName: "Site points " + t });
  });
  s.addImage({ path: path.join(HERE, "mail-crop.png"), x: 6.15, y: 1.3, w: 3.35, h: 2.66, objectName: "Capture e-mail alerte" });
  s.addText("L'alerte reçue par l'équipe informatique, en français, avec quoi faire.", { x: 6.15, y: 4.05, w: 3.35, h: 0.6, fontSize: 11, italic: true, color: C.accent5, margin: 0, valign: "top", isTextBox: true, objectName: "Legende e-mail" });
  s.addNotes(`[5:00 - 6:30]  DÉMO 2 (environ 1 min 30)
Quand la liaison a été coupée, Dunkerque était bloqué. Maintenant chaque site a son propre annuaire : il continue seul.

DÉMO (terminal ops01, dossier /srv/infra/ansible) :
1.   bash ../scripts/deploy playbooks/demo/couper-liaison.yml
2. Montrer : TrackR fonctionne toujours (saisir un 3e camion).
3. Onglet tableau de bord : "Liaison Lille - Dunkerque : COUPÉE" (en ~1 min).
4. Onglet boîte mail : montrer l'e-mail "Le serveur TrackR web01 ne répond plus" (démo 1) et "Site lille injoignable".
   "Vous voyez : l'équipe est prévenue avant que vos clients appellent."
5.   bash ../scripts/deploy playbooks/demo/retablir-liaison.yml`);

  // ============================================================ 6. Salaires
  s = content("Vos incidents");
  s.addText("Les salaires restent entre les RH et vous", { placeholder: "title" });
  demoBadge(s, "DÉMO 3");
  card(s, 0.5, 1.3, 4.35, 2.5, "Autorises", "E7F3EC");
  circleIcon(s, "check", 0.7, 1.5, 0.55, HEX.accent2, "Autorises");
  s.addText("Peuvent ouvrir les fiches de paie", { x: 1.4, y: 1.5, w: 3.3, h: 0.55, fontSize: 15, bold: true, color: C.text1, valign: "middle", margin: 0, isTextBox: true, objectName: "Autorises titre" });
  s.addText([{ text: "Les RH", options: { bullet: { indent: 16 }, breakLine: true } }, { text: "La direction", options: { bullet: { indent: 16 } } }],
    { x: 0.75, y: 2.2, w: 3.9, h: 1.4, fontSize: 18, color: C.text1, paraSpaceAfter: 6, margin: 0, valign: "top", isTextBox: true, objectName: "Autorises liste" });
  card(s, 5.15, 1.3, 4.35, 2.5, "Refuses", "FBEAE8");
  circleIcon(s, "times", 5.35, 1.5, 0.55, HEX.accent3, "Refuses");
  s.addText("Tous les autres", { x: 6.05, y: 1.5, w: 3.3, h: 0.55, fontSize: 15, bold: true, color: C.text1, valign: "middle", margin: 0, isTextBox: true, objectName: "Refuses titre" });
  s.addText([{ text: "Comptabilité, quai, prestataires...", options: { bullet: { indent: 16 }, breakLine: true } }, { text: "Ils ne voient même pas que le dossier existe", options: { bullet: { indent: 16 } } }],
    { x: 5.4, y: 2.2, w: 3.9, h: 1.4, fontSize: 15, color: C.text1, paraSpaceAfter: 6, margin: 0, valign: "top", isTextBox: true, objectName: "Refuses liste" });
  card(s, 0.5, 4.0, 9.0, 0.9, "Trace");
  circleIcon(s, "history", 0.7, 4.13, 0.62, HEX.dk2, "Trace");
  s.addText([{ text: "Chaque ouverture et chaque tentative refusée est enregistrée avec le nom de la personne. ", options: { bold: true } },
    { text: "En cas de fuite, on sait qui." }], { x: 1.5, y: 4.05, w: 7.85, h: 0.8, fontSize: 14, color: C.text1, valign: "middle", margin: 0, isTextBox: true, objectName: "Trace texte" });
  s.addNotes(`[6:30 - 7:30]  DÉMO 3 (environ 1 min)
Les fiches de paie ont fuité. Aujourd'hui, seuls les RH et vous y ont accès, et tout accès est tracé.

DÉMO (terminal ops01) - mot de passe de démo : ansible-vault view inventories/lab/group_vars/all/vault.yml (vault_users_initial_password)
1. La comptable :
     smbclient //dc01.transnord.lan/Paie -U 'TRANSNORD\\c.martin' --client-protection=encrypt -c ls
   -> NT_STATUS_ACCESS_DENIED
2. La responsable RH :
     smbclient //dc01.transnord.lan/Paie -U 'TRANSNORD\\s.lefebvre' --client-protection=encrypt -c ls
   -> la fiche "Fiche_paie_2026-10_Durand.txt"
3. "Et la tentative de la comptable est enregistrée, avec son nom, l'heure et le poste."`);

  // ============================================================ 7. Sauvegardes
  s = content("Vos incidents");
  s.addText("Plus jamais trois jours de travail à la main", { placeholder: "title" });
  const stats = [["Chaque nuit", "toutes les données sont sauvegardées"], ["À Lille", "loin de la salle serveur de Dunkerque"], ["1 commande", "pour tout remettre en quelques minutes"]];
  stats.forEach(([big, small], i) => {
    const x = 0.5 + i * 3.05;
    card(s, x, 1.3, 2.85, 1.75, "Chiffre " + big);
    s.addText([{ text: big, options: { bold: true, fontSize: 26, color: C.accent1, breakLine: true } }, { text: small, options: { fontSize: 13, color: C.text1 } }],
      { x: x + 0.2, y: 1.4, w: 2.45, h: 1.55, valign: "middle", margin: 0, isTextBox: true, objectName: "Chiffre texte " + big });
  });
  const guar = [["lock", "Chiffrées", "Illisibles pour qui les volerait"], ["shield", "Impossibles à effacer depuis un serveur", "Même un pirate ou une erreur ne les détruit pas"], ["redo", "Testées", "Restauration réellement faite pendant ce projet"]];
  guar.forEach(([k, t, d], i) => {
    const x = 0.5 + i * 3.05;
    circleIcon(s, k, x, 3.55, 0.6, HEX.dk2, t);
    s.addText([{ text: t, options: { bold: true, fontSize: 14, color: C.text1, breakLine: true } }, { text: d, options: { fontSize: 12, color: C.accent5 } }],
      { x: x + 0.75, y: 3.45, w: 2.15, h: 1.3, valign: "top", margin: 0, isTextBox: true, objectName: "Garantie " + t });
  });
  s.addNotes(`[7:30 - 8:30]
L'hiver dernier, le serveur de compta est tombé et vous avez travaillé 3 jours à la main.
Maintenant, chaque nuit, tout est sauvegardé, chiffré, et envoyé à Lille. Les serveurs peuvent ajouter des sauvegardes mais jamais les effacer : un virus qui prendrait un serveur ne pourrait pas détruire les copies.
Et je l'ai testé : j'ai volontairement effacé toutes les expéditions de TrackR, puis tout restauré depuis Lille en une commande, en quelques minutes.
(Si on vous pose la question : playbooks/demo/sinistre-trackr.yml puis playbooks/ops/restaurer-trackr.yml)`);

  // ============================================================ 8. Identités
  s = content("Vos incidents");
  s.addText("Un seul identifiant, piloté par les RH", { placeholder: "title" });
  const flow = [["file", "Les RH tiennent un tableau", "Arrivée, départ, changement de poste : une ligne dans un fichier Excel"],
    ["sync", "L'informatique l'applique", "Une seule commande, quelques minutes"],
    ["check", "Tout suit automatiquement", "Compte, droits, accès TrackR, accès à distance"]];
  flow.forEach(([k, t, d], i) => {
    const x = 0.5 + i * 3.1;
    card(s, x, 1.3, 2.75, 2.0, "Etape " + t);
    circleIcon(s, k, x + 0.2, 1.45, 0.6, HEX.accent4, t);
    s.addText([{ text: t, options: { bold: true, fontSize: 15, color: C.text1, breakLine: true } }, { text: d, options: { fontSize: 12, color: C.accent5 } }],
      { x: x + 0.2, y: 2.15, w: 2.4, h: 1.05, valign: "top", margin: 0, isTextBox: true, objectName: "Etape texte " + t });
    if (i < 2) s.addImage({ data: ic.arrow, x: x + 2.82, y: 2.15, w: 0.22, h: 0.22, objectName: "Fleche " + i });
  });
  card(s, 0.5, 3.55, 9.0, 1.35, "Prestataires", "FFF4E0");
  circleIcon(s, "user", 0.7, 3.78, 0.7, HEX.accent1, "Prestataires");
  s.addText([{ text: "Prestataires : ", options: { bold: true } },
    { text: "un compte à part, qui ne voit que TrackR (sans le nom de vos salariés) et qui se ", options: {} },
    { text: "verrouille tout seul le jour de la fin de mission", options: { bold: true } },
    { text: ", même si personne n'y pense.", options: {} }],
    { x: 1.6, y: 3.6, w: 7.75, h: 1.25, fontSize: 14, color: C.text1, valign: "middle", margin: 0, isTextBox: true, objectName: "Prestataires texte" });
  s.addNotes(`[8:30 - 9:30]
Vous m'avez dit : ce sont les RH qui décident qui arrive. Alors ce sont les RH qui tiennent la liste, dans un simple tableau.
Exemple réel testé : Thomas Roux passe du quai à l'exploitation. On change un mot dans le tableau, une commande, et son compte change de service, il perd les droits du quai et gagne ceux de l'exploitation.
Un départ : le compte est désactivé partout, y compris l'accès à distance.
Les prestataires sont dans un annuaire séparé : ils ne voient que ce dont ils ont besoin, et leur accès s'arrête seul à la date de fin de mission.`);

  // ============================================================ 9. Supervision & assureur
  s = content("Vos incidents");
  s.addText("Prévenus avant vos clients", { placeholder: "title" });
  s.addImage({ path: path.join(HERE, "grafana-crop.png"), x: 0.5, y: 1.3, w: 5.6, h: 1.68, objectName: "Capture tableau de bord" });
  s.addText("Le tableau de bord : vert = tout va bien. Lisible sans être informaticien.", { x: 0.5, y: 3.05, w: 5.6, h: 0.35, fontSize: 11, italic: true, color: C.accent5, margin: 0, isTextBox: true, objectName: "Legende tableau de bord" });
  const sup = [["envelope", "Alerte par e-mail", "Panne, disque bientôt plein, sauvegarde manquée : l'équipe est prévenue avant l'impact"],
    ["shield", "Mises à jour de sécurité chaque nuit", "Installées automatiquement sur tous les serveurs"],
    ["file", "Rapport pour l'assureur", "Une page datée : chaque serveur à jour et sauvegardé, générée en 1 minute"]];
  sup.forEach(([k, t, d], i) => {
    const y = 1.3 + i * 1.22;
    circleIcon(s, k, 6.4, y + 0.1, 0.55, HEX.dk2, t);
    s.addText([{ text: t, options: { bold: true, fontSize: 14, color: C.text1, breakLine: true } }, { text: d, options: { fontSize: 11.5, color: C.accent5 } }],
      { x: 7.1, y, w: 2.4, h: 1.12, valign: "top", margin: 0, isTextBox: true, objectName: "Supervision " + t });
  });
  card(s, 0.5, 3.6, 5.6, 1.3, "Qui a fait quoi");
  circleIcon(s, "history", 0.7, 3.88, 0.7, HEX.accent4, "Qui a fait quoi");
  s.addText([{ text: "Qui a fait quoi, et quand ? ", options: { bold: true } }, { text: "Chaque connexion, chaque action d'administrateur et chaque saisie TrackR est enregistrée et conservée un an, hors des serveurs concernés." }],
    { x: 1.6, y: 3.65, w: 4.35, h: 1.2, fontSize: 13, color: C.text1, valign: "middle", margin: 0, isTextBox: true, objectName: "Qui a fait quoi texte" });
  s.addNotes(`[9:30 - 10:30]
Vous voulez être prévenu avant que les clients appellent : c'est ce que vous avez vu pendant les démos, l'e-mail arrive en moins d'une minute.
Le tableau de bord se lit sans être informaticien : vert, tout va bien.
L'assureur : les mises à jour de sécurité s'installent toutes seules chaque nuit, et en une commande je produis une page datée qui montre, serveur par serveur, qu'il est à jour et sauvegardé.
(Commande : bash ../scripts/deploy playbooks/ops/rapport-assureur.yml -> fichier ansible/reports/rapport-assureur-<date>.html)
Et en cas de problème, on retrouve qui a fait quoi et quand, y compris les actions des informaticiens.`);

  // ============================================================ 10. Si l'informaticien part
  pres.addSection({ title: "Pour demain" });
  s = content("Pour demain");
  s.addText("Si votre informaticien part demain", { placeholder: "title" });
  const fut = [["book", "Tout est écrit", "Comment c'est construit, comment ça marche, quoi faire quand ça casse : une procédure par panne."],
    ["redo", "Tout se reconstruit seul", "Une seule commande réinstalle l'ensemble à l'identique, sans appeler l'ancien informaticien."],
    ["plus", "Un nouveau site en une demi‑journée", "On ajoute quelques lignes de description : annuaire, surveillance et sauvegardes suivent."],
    ["euro", "Rien à racheter", "100 % logiciels libres : aucune licence, aucun abonnement."]];
  fut.forEach(([k, t, d], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 0.5 + col * 4.6, y = 1.3 + row * 1.85;
    card(s, x, y, 4.4, 1.65, "Avenir " + t);
    circleIcon(s, k, x + 0.25, y + 0.3, 0.7, HEX.accent2, t);
    s.addText([{ text: t, options: { bold: true, fontSize: 16, color: C.text1, breakLine: true } }, { text: d, options: { fontSize: 12.5, color: C.accent5 } }],
      { x: x + 1.15, y: y + 0.15, w: 3.1, h: 1.35, valign: "middle", margin: 0, isTextBox: true, objectName: "Avenir texte " + t });
  });
  s.addNotes(`[10:30 - 11:30]
Votre crainte : que tout reparte avec l'informaticien. Ici, l'infrastructure entière est décrite dans des fichiers : c'est à la fois la documentation et l'installation.
Un nouvel informaticien lit le dossier, tape une commande, et retrouve exactement la même installation. Je l'ai fait plusieurs fois pendant ce projet.
Ouvrir un 3e site : on ajoute quelques lignes, et l'annuaire, la surveillance et les sauvegardes s'étendent tout seuls. Pas deux ans : une demi-journée.`);

  // ============================================================ 11. Coûts
  s = content("Pour demain");
  s.addText("Ce que ça coûte", { placeholder: "title" });
  const cost = [["0 €", "de licences logicielles", "Annuaire, base de données, supervision, sauvegardes, VPN : tout est libre et gratuit", HEX.accent2],
    ["~2 000 €", "économisés", "par rapport à deux serveurs Windows, sans compter les licences par utilisateur", HEX.accent1],
    ["2 serveurs", "physiques suffisent", "un par site, plus un disque de sauvegarde à Lille", HEX.accent4]];
  cost.forEach(([big, mid, d, col], i) => {
    const x = 0.5 + i * 3.05;
    card(s, x, 1.3, 2.85, 2.5, "Cout " + big);
    s.addText([{ text: big, options: { bold: true, fontSize: 40, color: col, breakLine: true } }, { text: mid, options: { bold: true, fontSize: 15, color: C.text1, breakLine: true } },
      { text: d, options: { fontSize: 12, color: C.accent5 } }],
      { x: x + 0.2, y: 1.45, w: 2.45, h: 2.25, valign: "top", margin: 0, paraSpaceAfter: 4, isTextBox: true, objectName: "Cout texte " + big });
  });
  s.addText("Un budget serré a guidé chaque choix : on a d'abord essayé Windows Server, puis retenu une solution gratuite et plus légère qui fait la même chose.",
    { x: 0.5, y: 4.0, w: 9.0, h: 0.7, fontSize: 14, italic: true, color: C.text1, margin: 0, valign: "middle", isTextBox: true, objectName: "Cout conclusion" });
  s.addNotes(`[11:30 - 12:15]
Votre budget est serré. Tous les logiciels sont gratuits. J'ai d'abord essayé de faire l'annuaire sous Windows Server : c'était quatre fois plus gourmand et payant. J'ai remplacé par Samba, qui fait exactement la même chose pour vos postes, gratuitement.
Matériel : deux serveurs physiques, un par site, suffisent pour faire tourner les 7 machines virtuelles, plus un disque de sauvegarde à Lille.`);

  // ============================================================ 12. Conclusion
  s = pres.addSlide({ masterName: "Conclusion sombre", sectionTitle: "Pour demain" });
  s.addText("Ce que vous obtenez", { placeholder: "title" });
  s.addText([{ text: "Les camions ne sont plus bloqués, même en cas de panne", options: { bullet: { indent: 16 }, breakLine: true } },
    { text: "Chaque site travaille seul si la liaison tombe", options: { bullet: { indent: 16 }, breakLine: true } },
    { text: "Les salaires sont protégés et chaque accès est tracé", options: { bullet: { indent: 16 }, breakLine: true } },
    { text: "Rien n'est perdu, tout se reconstruit sans dépendre d'une personne", options: { bullet: { indent: 16 } } }],
    { placeholder: "body", paraSpaceAfter: 12 });
  s.addText("Prochaine étape : votre accord pour commander les 2 serveurs, puis une journée d'installation.",
    { x: 0.6, y: 4.2, w: 8.8, h: 0.5, fontSize: 16, bold: true, color: C.accent6, margin: 0, isTextBox: true, objectName: "Prochaine etape" });
  s.addNotes(`[12:15 - 13:00]
Pour résumer : vos problèmes de cette année ne peuvent plus se reproduire de la même façon. Et si un jour quelque chose casse, on est prévenu, on sait quoi faire, et c'est écrit.
Ce que je vous demande aujourd'hui : votre accord pour commander deux serveurs. L'installation prend une journée, puisque tout est automatisé.
Merci. Je réponds à vos questions.`);

  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("ok", OUT);
})().catch((e) => { console.error(e); process.exit(1); });

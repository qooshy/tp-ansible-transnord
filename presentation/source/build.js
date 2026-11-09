// Génère presentation/LogiNord-presentation.pptx (pptxgenjs).
//   SKILL_DIR=<dossier du skill pptx> node build.js <sortie.pptx>
const path = require("path");
const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const fa = require("react-icons/fa");
const { applyTheme } = require(process.env.SKILL_DIR + "/scripts/apply_theme.js");

const OUT = process.argv[2];
const HERE = __dirname;

const THEME = {
  name: "LogiNord",
  headFontFace: "Calibri",
  bodyFontFace: "Calibri",
  colors: {
    dk1: "1D2733", lt1: "FFFFFF", dk2: "14365D", lt2: "EEF2F6",
    accent1: "E8890C", accent2: "1E7D43", accent3: "B3261E", accent4: "2F6DB5",
    accent5: "5F6B7A", accent6: "FFB020", hlink: "2F6DB5", folHlink: "5F6B7A",
  },
};
const HEX = THEME.colors;
const LAB = "Labo : vagrant ssh ctl, puis bash /srv/loginord/lab/deploy.sh <playbook>. École : ansible-playbook <playbook> à la racine du dépôt.";

async function icon(Comp, color, size = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(Comp, { color: "#" + color, size: String(size) }));
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}

(async () => {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";              // 10 x 5.625 in
  pres.author = "Alexis Rodrigues";
  pres.company = "LogiNord";
  pres.title = "LogiNord - une informatique qui ne bloque plus les camions";
  pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
  const C = pres.SchemeColor;

  // ------------------------------------------------------------ dispositions
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
      { placeholder: { options: { name: "body", type: "body", x: 0.6, y: 1.45, w: 8.8, h: 2.6, fontSize: 20, color: C.background1, valign: "top", margin: 0 }, text: "" } },
    ],
  });
  pres.defineSlideMaster({
    title: "Contenu",
    background: { color: HEX.lt1 },
    margin: [0.5, 0.5, 0.5, 0.5],
    objects: [
      { placeholder: { options: { name: "title", type: "title", x: 0.5, y: 0.3, w: 7.6, h: 0.75, fontSize: 28, bold: true, color: C.text2, valign: "middle", align: "left", margin: 0 }, text: "" } },
      { text: { text: "LogiNord - infrastructure Lille & Dunkerque", options: { x: 0.5, y: 5.2, w: 6, h: 0.3, fontSize: 10, color: C.accent5, margin: 0 } } },
    ],
    slideNumber: { x: 9.0, y: 5.2, w: 0.5, h: 0.3, fontSize: 10, color: HEX.accent5, align: "right" },
  });

  // ------------------------------------------------------------ outils
  const ic = {};
  const want = {
    truck: [fa.FaTruck, HEX.lt1], link: [fa.FaUnlink, HEX.lt1], lock: [fa.FaLock, HEX.lt1], db: [fa.FaDatabase, HEX.lt1],
    shield: [fa.FaShieldAlt, HEX.lt1], id: [fa.FaIdCard, HEX.lt1], book: [fa.FaBook, HEX.lt1], euro: [fa.FaEuroSign, HEX.lt1],
    server: [fa.FaServer, HEX.dk2], building: [fa.FaBuilding, HEX.dk2], warehouse: [fa.FaWarehouse, HEX.dk2],
    check: [fa.FaCheck, HEX.lt1], play: [fa.FaPlay, HEX.lt1], history: [fa.FaHistory, HEX.lt1],
    file: [fa.FaFileExcel, HEX.lt1], user: [fa.FaUserClock, HEX.lt1], envelope: [fa.FaEnvelope, HEX.lt1],
    redo: [fa.FaRedo, HEX.lt1], plus: [fa.FaPlusCircle, HEX.lt1], arrow: [fa.FaArrowRight, HEX.accent5], sync: [fa.FaSyncAlt, HEX.lt1],
    eye: [fa.FaEye, HEX.lt1], home: [fa.FaHome, HEX.lt1], folder: [fa.FaFolderOpen, HEX.lt1],
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
  function iconText(slide, key, color, x, y, w, title, detail, name, d = 0.6, tsize = 15, dsize = 12) {
    circleIcon(slide, key, x, y, d, color, name);
    slide.addText([{ text: title, options: { bold: true, fontSize: tsize, color: C.text1, breakLine: true } }, { text: detail, options: { fontSize: dsize, color: C.accent5 } }],
      { x: x + d + 0.15, y: y - 0.1, w: w - d - 0.15, h: d + 0.7, valign: "top", margin: 0, isTextBox: true, objectName: name + " texte" });
  }
  const content = (section) => pres.addSlide({ masterName: "Contenu", sectionTitle: section });

  // ============================================================ 1. Titre
  pres.addSection({ title: "Introduction" });
  let s = pres.addSlide({ masterName: "Titre sombre", sectionTitle: "Introduction" });
  s.addText("Une informatique qui ne bloque plus les camions", { placeholder: "title" });
  s.addText("LogiNord - Lille & Dunkerque\nAlexis Rodrigues - projet d'infrastructure, novembre 2026", { placeholder: "body" });
  circleIcon(s, "truck", 0.6, 0.55, 0.85, HEX.accent1, "Camion");
  s.addNotes(`[0:00 - 0:45]
Bonjour. Vous m'avez confié votre informatique avec une liste de problèmes très concrets : des camions bloqués, une liaison qui tombe, trois jours de travail à la main...
Je ne vais pas vous parler de technique. Je reprends vos problèmes un par un, je vous dis ce qui se passe maintenant, et pour trois d'entre eux je vous le montre en direct.

AVANT LA PRÉSENTATION (voir docs/DEMO.md) : VM démarrées 15 min avant, onglets TrackR + tableau de bord + boîte mail ouverts, terminal sur le poste Ansible.
${LAB}`);

  // ============================================================ 2. Ce que vous nous avez dit
  s = content("Introduction");
  s.addText("Ce que vous nous avez dit", { placeholder: "title" });
  const pains = [
    ["truck", "TrackR en panne 1 heure", "Les camions attendaient au quai"],
    ["link", "La liaison avec Dunkerque coupée", "Un site entier à l'arrêt"],
    ["db", "Serveur compta en panne", "3 jours de travail à la main"],
    ["lock", "Des fiches de salaire ont fuité", "En interne, sans savoir qui"],
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
  s.addNotes(`[0:45 - 1:30]
Voici ce que vous m'avez dit. En rouge, ce qui a déjà coûté de l'argent ; en gris, ce qui inquiète pour demain.
Tout ce que j'ai construit répond à une de ces cases.`);

  // ============================================================ 3. La solution en une image
  s = content("Introduction");
  s.addText("La solution en une image", { placeholder: "title" });
  card(s, 0.5, 1.25, 3.6, 3.7, "Site Lille");
  circleIcon(s, "building", 0.7, 1.4, 0.6, HEX.lt1, "Lille");
  s.addText([{ text: "Lille", options: { bold: true, fontSize: 18, breakLine: true } }, { text: "Siège : direction, RH, compta, informatique", options: { fontSize: 12, color: C.accent5 } }],
    { x: 1.4, y: 1.35, w: 2.6, h: 0.75, valign: "middle", margin: 0, color: C.text1, isTextBox: true, objectName: "Lille titre" });
  [["Annuaire Windows", "Chacun garde son identifiant si la liaison tombe"], ["Coffre de sauvegardes", "Copie chiffrée de tout, loin de Dunkerque"]].forEach(([t, d], i) => {
    const y = 2.35 + i * 1.25;
    card(s, 0.7, y, 3.2, 1.05, "Lille " + t, C.background1);
    s.addImage({ data: ic.server, x: 0.85, y: y + 0.3, w: 0.4, h: 0.4, objectName: "Lille icone " + i });
    s.addText([{ text: t, options: { bold: true, fontSize: 14, breakLine: true } }, { text: d, options: { fontSize: 11, color: C.accent5 } }],
      { x: 1.4, y: y + 0.1, w: 2.4, h: 0.85, valign: "middle", margin: 0, color: C.text1, isTextBox: true, objectName: "Lille " + t });
  });
  s.addShape(pres.shapes.LINE, { x: 4.2, y: 3.1, w: 1.3, h: 0, line: { color: C.accent5, width: 2, dashType: "dash" }, objectName: "Liaison" });
  s.addText("tunnel\nchiffré", { x: 4.2, y: 3.2, w: 1.3, h: 0.5, fontSize: 11, color: C.accent5, align: "center", margin: 0, isTextBox: true, objectName: "Liaison texte" });
  card(s, 5.6, 1.25, 3.9, 3.7, "Site Dunkerque");
  circleIcon(s, "warehouse", 5.8, 1.4, 0.6, HEX.lt1, "Dunkerque");
  s.addText([{ text: "Dunkerque", options: { bold: true, fontSize: 18, breakLine: true } }, { text: "Quai, exploitation, salle serveur", options: { fontSize: 12, color: C.accent5 } }],
    { x: 6.5, y: 1.35, w: 2.9, h: 0.75, valign: "middle", margin: 0, color: C.text1, isTextBox: true, objectName: "Dunkerque titre" });
  [["TrackR et sa base", "Le suivi des camions, sur place"], ["Annuaire Windows", "Les connexions restent locales"], ["Surveillance", "Prévient l'informatique au moindre souci"]].forEach(([t, d], i) => {
    const y = 2.3 + i * 0.88;
    card(s, 5.8, y, 3.5, 0.78, "Dunkerque " + t, C.background1);
    s.addImage({ data: ic.server, x: 5.95, y: y + 0.2, w: 0.38, h: 0.38, objectName: "Dunkerque icone " + i });
    s.addText([{ text: t, options: { bold: true, fontSize: 13, breakLine: true } }, { text: d, options: { fontSize: 10.5, color: C.accent5 } }],
      { x: 6.45, y: y + 0.05, w: 2.8, h: 0.68, valign: "middle", margin: 0, color: C.text1, isTextBox: true, objectName: "Dunkerque " + t });
  });
  s.addNotes(`[1:30 - 2:30]
Vos deux sites sont reliés par un tunnel chiffré, et chacun a son propre annuaire : c'est lui qui vérifie les mots de passe.
À Dunkerque, là où sont les camions : TrackR, sa base de données, et la surveillance qui veille sur tout.
À Lille : un coffre de sauvegardes, volontairement loin de la salle serveur de Dunkerque.
Tout est installé par un seul outil, Ansible, à partir de fichiers de description. J'y reviens à la fin.
(Détail si on demande : 9 machines - 2 routeurs, 2 contrôleurs de domaine Windows, web01, db01, mon01, ldap01 pour les prestataires, bkp01.)`);

  // ============================================================ 4. TrackR
  pres.addSection({ title: "Vos incidents" });
  s = content("Vos incidents");
  s.addText("TrackR ne bloquera plus les camions", { placeholder: "title" });
  demoBadge(s, "DÉMO 1");
  card(s, 0.5, 1.3, 2.7, 3.6, "Avant", "FBEAE8");
  s.addText([{ text: "Avant", options: { bold: true, fontSize: 14, color: C.accent3, breakLine: true } },
    { text: "1 heure", options: { bold: true, fontSize: 44, color: C.accent3, breakLine: true } },
    { text: "de panne, des camions qui attendent au quai, et personne de prévenu", options: { fontSize: 13, color: C.text1 } }],
    { x: 0.75, y: 1.5, w: 2.25, h: 3.2, valign: "middle", margin: 0, isTextBox: true, objectName: "Avant texte" });
  [["redo", "Il redémarre seul en 5 secondes", "Même arrêté brutalement, le programme est relancé automatiquement, sans intervention."],
   ["db", "Sa base est à part, sauvegardée chaque heure", "Une panne de l'application ne touche pas les données."],
   ["eye", "Il est surveillé toutes les 15 secondes", "Testé comme le ferait un agent de quai : l'informatique est prévenue avant vous."]].forEach(([k, t, d], i) => {
    const y = 1.3 + i * 1.25;
    circleIcon(s, k, 3.55, y + 0.15, 0.65, HEX.accent2, t);
    s.addText([{ text: t, options: { bold: true, fontSize: 16, color: C.text1, breakLine: true } }, { text: d, options: { fontSize: 13, color: C.accent5 } }],
      { x: 4.4, y, w: 5.1, h: 1.1, valign: "middle", margin: 0, isTextBox: true, objectName: "Etape " + t });
  });
  s.addNotes(`[2:30 - 4:00]  DÉMO 1 (environ 1 min 30) - voir docs/DEMO.md
Votre pire incident : TrackR arrêté une heure. Aujourd'hui, s'il plante, il repart tout seul.

1. Onglet TrackR : créer une expédition (référence LN-2001, un client, Dunkerque -> Lille, date du jour) -> elle apparaît.
2. Terminal :   demo-panne-trackr.yml
   Il affiche : "TrackR tué (PID ...), relancé seul par systemd (PID ...)".
3. Rafraîchir TrackR : tout est là.
À dire : "J'ai tué le programme de la façon la plus brutale qui existe. Il est revenu en 5 secondes. Avant, c'était une heure."
${LAB}`);

  // ============================================================ 5. Liaison
  s = content("Vos incidents");
  s.addText("Liaison coupée : chaque site continue seul", { placeholder: "title" });
  demoBadge(s, "DÉMO 2");
  [["warehouse", "Dunkerque", ["TrackR et sa base sont sur place", "Les connexions passent par l'annuaire local", "Les camions sont suivis"]],
   ["building", "Lille", ["Les postes se connectent à l'annuaire de Lille", "Les journaux attendent et partent au retour", "Tout se resynchronise seul"]]].forEach(([k, t, items], i) => {
    const x = 0.5 + i * 2.75;
    card(s, x, 1.3, 2.55, 3.0, "Site " + t);
    circleIcon(s, k, x + 0.2, 1.45, 0.55, HEX.lt1, t);
    s.addText(t, { x: x + 0.85, y: 1.45, w: 1.6, h: 0.55, fontSize: 18, bold: true, color: C.text1, valign: "middle", margin: 0, isTextBox: true, objectName: "Site titre " + t });
    s.addText(items.map((it, j) => ({ text: it, options: { bullet: { indent: 16 }, breakLine: j < items.length - 1 } })),
      { x: x + 0.2, y: 2.2, w: 2.2, h: 2.0, fontSize: 13, color: C.text1, valign: "top", paraSpaceAfter: 8, margin: 0, isTextBox: true, objectName: "Site points " + t });
  });
  s.addImage({ path: path.join(HERE, "mail-crop.png"), x: 6.15, y: 1.3, w: 3.35, h: 2.66, objectName: "Capture e-mail alerte" });
  s.addText("L'alerte reçue par l'informatique 85 secondes après la coupure, avec quoi faire.", { x: 6.15, y: 4.05, w: 3.35, h: 0.6, fontSize: 11, italic: true, color: C.accent5, margin: 0, valign: "top", isTextBox: true, objectName: "Legende e-mail" });
  s.addNotes(`[4:00 - 6:00]  DÉMO 2 (environ 2 min)
Quand la liaison a été coupée, Dunkerque était bloqué. Maintenant chaque site a son annuaire, et TrackR est à Dunkerque.

1. Terminal :   demo-couper-liaison.yml        -> "Liaison coupée"
2. TrackR : créer une 2e expédition -> ça marche.
3. Tableau de bord : "Liaison Lille - Dunkerque : COUPÉE" (environ 1 minute).
4. Boîte mail : "[FIRING] Le tunnel Lille - Dunkerque est coupé".
   À dire : "L'informatique est prévenue avant que quelqu'un appelle."
5. Terminal :   demo-couper-liaison.yml -e retablir=oui    -> la liaison revient.
${LAB}`);

  // ============================================================ 6. Sauvegardes
  s = content("Vos incidents");
  s.addText("Plus jamais trois jours de travail à la main", { placeholder: "title" });
  demoBadge(s, "DÉMO 3");
  [["Toutes les heures", "la base de TrackR est sauvegardée"], ["À Lille", "une copie loin de la salle serveur"], ["1 commande", "pour tout remettre en quelques minutes"]].forEach(([big, small], i) => {
    const x = 0.5 + i * 3.05;
    card(s, x, 1.3, 2.85, 1.75, "Chiffre " + big);
    s.addText([{ text: big, options: { bold: true, fontSize: 26, color: C.accent1, breakLine: true } }, { text: small, options: { fontSize: 13, color: C.text1 } }],
      { x: x + 0.2, y: 1.4, w: 2.45, h: 1.55, valign: "middle", margin: 0, isTextBox: true, objectName: "Chiffre texte " + big });
  });
  [["lock", "Chiffrées", "Illisibles pour qui les volerait"], ["shield", "Impossibles à effacer depuis un serveur", "Même un pirate ou une erreur ne les détruit pas"], ["check", "Testées", "La restauration est vérifiée, pas seulement la copie"]].forEach(([k, t, d], i) => {
    iconText(s, k, HEX.dk2, 0.5 + i * 3.05, 3.55, 2.9, t, d, "Garantie " + t, 0.6, 14, 12);
  });
  s.addNotes(`[6:00 - 7:30]  DÉMO 3 (environ 1 min 30)
L'hiver dernier, le serveur de compta est tombé et vous avez travaillé 3 jours à la main. Je vous montre le pire : on efface tout.

1. Terminal :   demo-sinistre-trackr.yml       -> "Toutes les expéditions effacées"
2. TrackR : rafraîchir -> "Aucune expédition."
3. Terminal :   restaurer-trackr.yml -e cible=trackr -e confirmer=oui
   -> "N expéditions restaurées dans la base trackr"
4. TrackR : rafraîchir -> tout est revenu, y compris les expéditions des démos 1 et 2.
À dire : "Une sauvegarde qu'on n'a jamais restaurée, ce n'est pas une sauvegarde. Celle-ci, on vient de la restaurer devant vous."
${LAB}`);

  // ============================================================ 7. Identités
  s = content("Vos incidents");
  s.addText("Un seul identifiant, piloté par les RH", { placeholder: "title" });
  [["file", "Les RH tiennent la liste", "Arrivée, changement de poste, départ : une ligne dans un fichier"],
   ["sync", "L'informatique l'applique", "Une seule commande, quelques minutes"],
   ["check", "Tout suit automatiquement", "Compte, droits, accès à distance ; un départ est coupé le soir même"]].forEach(([k, t, d], i) => {
    const x = 0.5 + i * 3.1;
    card(s, x, 1.3, 2.75, 1.85, "Etape " + t);
    circleIcon(s, k, x + 0.2, 1.42, 0.55, HEX.accent4, t);
    s.addText([{ text: t, options: { bold: true, fontSize: 15, color: C.text1, breakLine: true } }, { text: d, options: { fontSize: 12, color: C.accent5 } }],
      { x: x + 0.2, y: 2.05, w: 2.4, h: 1.05, valign: "top", margin: 0, isTextBox: true, objectName: "Etape texte " + t });
    if (i < 2) s.addImage({ data: ic.arrow, x: x + 2.82, y: 2.1, w: 0.22, h: 0.22, objectName: "Fleche " + i });
  });
  card(s, 0.5, 3.4, 4.4, 1.5, "Prestataires", "FFF4E0");
  circleIcon(s, "user", 0.65, 3.6, 0.6, HEX.accent1, "Prestataires");
  s.addText([{ text: "Prestataires : ", options: { bold: true } }, { text: "un annuaire à part. Ils n'accèdent qu'à leur serveur, et leur compte se " },
    { text: "verrouille seul à la fin de la mission", options: { bold: true } }, { text: "." }],
    { x: 1.4, y: 3.45, w: 3.4, h: 1.4, fontSize: 13, color: C.text1, valign: "middle", margin: 0, isTextBox: true, objectName: "Prestataires texte" });
  card(s, 5.1, 3.4, 4.4, 1.5, "Salaires", "EEF2F6");
  circleIcon(s, "folder", 5.25, 3.6, 0.6, HEX.dk2, "Salaires");
  s.addText([{ text: "Salaires : ", options: { bold: true } }, { text: "les droits viennent du service. Le dossier de paie ne s'ouvrira qu'aux " },
    { text: "RH et à la direction", options: { bold: true } }, { text: " (prochaine étape : le serveur de fichiers)." }],
    { x: 6.0, y: 3.45, w: 3.4, h: 1.4, fontSize: 13, color: C.text1, valign: "middle", margin: 0, isTextBox: true, objectName: "Salaires texte" });
  s.addNotes(`[7:30 - 8:30]
Vous m'avez dit : ce sont les RH qui décident qui arrive. Alors ce sont les RH qui tiennent la liste du personnel, dans un fichier.
Un changement de poste : on change un mot, une commande, et les droits suivent. Les anciens droits sont retirés, pas cumulés.
Un départ : le compte est désactivé le soir même partout, y compris sur les serveurs et l'accès à distance. Jamais supprimé : la compta garde ses données.
Les prestataires sont dans un annuaire séparé, et leur accès s'arrête seul à la date de fin.
Les salaires : chaque droit vient du service de la personne. Le dossier de paie sera ouvert aux seuls RH et direction ; c'est l'étape suivante, avec le serveur de fichiers.
(Fichier : data/personnel.yml - commande : personnel.yml. Démontrable à l'école, avec les contrôleurs de domaine Windows.)`);

  // ============================================================ 8. Supervision & assureur
  s = content("Vos incidents");
  s.addText("Prévenus avant vos clients", { placeholder: "title" });
  s.addImage({ path: path.join(HERE, "grafana-crop.png"), x: 0.5, y: 1.25, w: 9.0, h: 1.14, objectName: "Capture tableau de bord" });
  s.addText("Le tableau de bord, lisible sans être informaticien : vert, tout va bien.", { x: 0.5, y: 2.45, w: 9.0, h: 0.3, fontSize: 11, italic: true, color: C.accent5, margin: 0, isTextBox: true, objectName: "Legende tableau de bord" });
  [["envelope", "Alerte immédiate", "Panne, liaison, disque, sauvegarde : un e-mail en français"],
   ["shield", "Toujours à jour", "Sécurité chaque nuit, le reste le dimanche, serveur par serveur"],
   ["file", "Preuve pour l'assureur", "Un rapport daté, serveur par serveur, en une commande"],
   ["history", "Qui a fait quoi", "Chaque connexion et chaque action admin, gardées 3 mois"]].forEach(([k, t, d], i) => {
    const x = 0.5 + i * 2.3;
    card(s, x, 3.0, 2.15, 1.9, "Supervision " + t);
    circleIcon(s, k, x + 0.15, 3.15, 0.5, HEX.dk2, t);
    s.addText([{ text: t, options: { bold: true, fontSize: 13, color: C.text1, breakLine: true } }, { text: d, options: { fontSize: 11, color: C.accent5 } }],
      { x: x + 0.15, y: 3.75, w: 1.9, h: 1.1, valign: "top", margin: 0, isTextBox: true, objectName: "Supervision texte " + t });
  });
  s.addNotes(`[8:30 - 9:45]
Être prévenu avant que les clients appellent : vous l'avez vu pendant la démo 2, l'e-mail arrive en moins de deux minutes.
Toutes les nuits, les correctifs de sécurité s'installent seuls. Le dimanche, jour sans camions, le reste, un serveur après l'autre, jamais les deux annuaires en même temps.
Pour l'assureur, une commande produit un rapport daté qui montre chaque serveur.
(Commandes : campagne-mises-a-jour.yml, rapport-assureur.yml -> reports/rapport-assureur-<date>.html)
Et tout ce qui se passe sur les serveurs est gardé trois mois : on sait qui a fait quoi, et quand.`);

  // ============================================================ 9. Si l'informaticien part
  pres.addSection({ title: "Pour demain" });
  s = content("Pour demain");
  s.addText("Si votre informaticien part demain", { placeholder: "title" });
  [["book", "Tout est écrit", "Comment c'est construit, comment ça marche, quoi faire quand ça casse : une procédure par panne."],
   ["redo", "Tout se reconstruit seul", "Une commande réinstalle l'ensemble à l'identique, sans appeler l'ancien informaticien."],
   ["plus", "Un nouveau site en une demi‑journée", "Un routeur, un annuaire, quelques lignes : le réseau et la surveillance suivent."],
   ["home", "Intervenir de chez soi", "Un accès sécurisé par informaticien, la nuit et le week-end, retiré à son départ."]].forEach(([k, t, d], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 0.5 + col * 4.6, y = 1.3 + row * 1.85;
    card(s, x, y, 4.4, 1.65, "Avenir " + t);
    circleIcon(s, k, x + 0.25, y + 0.3, 0.7, HEX.accent2, t);
    s.addText([{ text: t, options: { bold: true, fontSize: 16, color: C.text1, breakLine: true } }, { text: d, options: { fontSize: 12.5, color: C.accent5 } }],
      { x: x + 1.15, y: y + 0.15, w: 3.1, h: 1.35, valign: "middle", margin: 0, isTextBox: true, objectName: "Avenir texte " + t });
  });
  s.addNotes(`[9:45 - 10:45]
Votre crainte : que tout reparte avec l'informaticien. Ici, l'infrastructure entière est décrite dans des fichiers : c'est à la fois la documentation et l'installation.
Un nouvel informaticien lit le dossier, tape une commande, et retrouve la même installation. Je l'ai vérifié : relancée une seconde fois, elle ne change plus rien, preuve que tout est conforme.
Ouvrir un troisième site, c'est un routeur et un annuaire de plus : pas deux ans, une demi-journée.
Et vos informaticiens peuvent intervenir de chez eux, chacun avec son propre accès.`);

  // ============================================================ 10. Coûts
  s = content("Pour demain");
  s.addText("Ce que ça coûte", { placeholder: "title" });
  [["0 €", "de logiciels", "Base de données, surveillance, sauvegardes, accès distant : tout est libre et gratuit", HEX.accent2],
   ["2", "licences Windows Server", "Pour les deux annuaires, au cœur des postes de travail Windows", HEX.accent1],
   ["+1", "petit serveur à Lille", "Pour le coffre de sauvegardes, loin de Dunkerque", HEX.accent4]].forEach(([big, mid, d, col], i) => {
    const x = 0.5 + i * 3.05;
    card(s, x, 1.3, 2.85, 2.5, "Cout " + big);
    s.addText([{ text: big, options: { bold: true, fontSize: 40, color: col, breakLine: true } }, { text: mid, options: { bold: true, fontSize: 15, color: C.text1, breakLine: true } },
      { text: d, options: { fontSize: 12, color: C.accent5 } }],
      { x: x + 0.2, y: 1.45, w: 2.45, h: 2.25, valign: "top", margin: 0, paraSpaceAfter: 4, isTextBox: true, objectName: "Cout texte " + big });
  });
  s.addText("Le budget serré a guidé chaque choix : on ne paie que Windows, déjà indispensable aux postes des salariés.",
    { x: 0.5, y: 4.0, w: 9.0, h: 0.7, fontSize: 14, italic: true, color: C.text1, margin: 0, valign: "middle", isTextBox: true, objectName: "Cout conclusion" });
  s.addNotes(`[10:45 - 11:30]
Votre budget est serré. Tous les logiciels sont gratuits, sauf Windows Server pour les deux annuaires : vos postes de travail sont sous Windows, c'est le standard.
En plus de l'existant, un seul petit serveur à Lille pour garder les sauvegardes hors de Dunkerque.`);

  // ============================================================ 11. Conclusion
  s = pres.addSlide({ masterName: "Conclusion sombre", sectionTitle: "Pour demain" });
  s.addText("Ce que vous obtenez", { placeholder: "title" });
  s.addText([{ text: "TrackR repart seul, et vous êtes prévenu avant vos clients", options: { bullet: { indent: 18 }, breakLine: true } },
    { text: "Chaque site travaille seul si la liaison tombe", options: { bullet: { indent: 18 }, breakLine: true } },
    { text: "Rien n'est perdu : sauvegarde chaque heure, copie à Lille", options: { bullet: { indent: 18 }, breakLine: true } },
    { text: "Tout se reconstruit sans dépendre d'une personne", options: { bullet: { indent: 18 } } }],
    { placeholder: "body", paraSpaceAfter: 12 });
  s.addText("Prochaines étapes : le serveur de fichiers (salaires réservés aux RH), puis la mise en production.",
    { x: 0.6, y: 4.2, w: 8.8, h: 0.6, fontSize: 16, bold: true, color: C.accent6, margin: 0, isTextBox: true, objectName: "Prochaine etape" });
  s.addNotes(`[11:30 - 12:15]
Pour résumer : vos incidents de cette année ne peuvent plus se reproduire de la même façon. Et si quelque chose casse, on est prévenu, on sait quoi faire, et c'est écrit.
La suite : le serveur de fichiers, pour que les fiches de paie ne soient visibles que des RH et de la direction, puis la mise en production.
Merci. Je réponds à vos questions.

APRÈS : demo-couper-liaison.yml -e retablir=oui si besoin, verifier.yml, puis "vagrant halt" pour le labo.`);

  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("ok", OUT);
})().catch((e) => { console.error(e); process.exit(1); });

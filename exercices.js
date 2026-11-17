// Bibliothèque d'exercices et modèles de séances (programmes originaux, recomposition corporelle).
// mat = matériel nécessaire (tous requis). [] = poids du corps, zéro équipement.
// L'ordre dans chaque catégorie = priorité en salle.

const MATERIELS = [
  { id: 'barre', nom: 'Barre + rack' },
  { id: 'halteres', nom: 'Haltères' },
  { id: 'banc', nom: 'Banc' },
  { id: 'kettlebell', nom: 'Kettlebell' },
  { id: 'poulie', nom: 'Poulie / vis-à-vis' },
  { id: 'smith', nom: 'Smith machine' },
  { id: 'presse', nom: 'Presse à cuisses' },
  { id: 'leg_ext', nom: 'Leg extension' },
  { id: 'leg_curl', nom: 'Leg curl' },
  { id: 'machine_pecs', nom: 'Machine pectoraux' },
  { id: 'machine_epaules', nom: 'Machine épaules' },
  { id: 'tirage_vertical', nom: 'Tirage vertical' },
  { id: 'tirage_horizontal', nom: 'Tirage horizontal assis' },
  { id: 'barre_traction', nom: 'Barre de traction' },
  { id: 'barres_dips', nom: 'Barres à dips' },
  { id: 'tapis', nom: 'Tapis de course' },
  { id: 'velo', nom: 'Vélo' },
  { id: 'rameur', nom: 'Rameur' },
  { id: 'elliptique', nom: 'Elliptique' },
];

const EXERCICES = [
  // Squat (cuisses, fessiers)
  { id: 'squat_barre', nom: 'Squat à la barre', cat: 'squat', mat: ['barre'], consigne: 'Pieds largeur d’épaules, descends cuisses parallèles, dos droit.' },
  { id: 'presse', nom: 'Presse à cuisses', cat: 'squat', mat: ['presse'], consigne: 'Pieds au milieu du plateau, ne verrouille pas les genoux en haut.' },
  { id: 'squat_smith', nom: 'Squat à la Smith', cat: 'squat', mat: ['smith'], consigne: 'Pieds légèrement devant la barre, descends contrôlé.' },
  { id: 'goblet', nom: 'Goblet squat', cat: 'squat', mat: ['halteres'], consigne: 'Haltère contre la poitrine, coudes entre les genoux en bas.' },
  { id: 'squat_pdc', nom: 'Squat', cat: 'squat', mat: [], consigne: 'Bras devant, descends lentement (3 s), remonte vite.' },
  { id: 'squat_saute', nom: 'Squat sauté', cat: 'squat', mat: [], consigne: 'Descends en squat, explose vers le haut, atterris en souplesse.' },
  // Charnière (ischios, fessiers, bas du dos)
  { id: 'rdl_barre', nom: 'Soulevé de terre jambes tendues (barre)', cat: 'charniere', mat: ['barre'], consigne: 'Genoux légèrement fléchis, pousse les fesses en arrière, barre près des jambes.' },
  { id: 'rdl_halteres', nom: 'Soulevé de terre roumain (haltères)', cat: 'charniere', mat: ['halteres'], consigne: 'Dos plat, descends jusqu’à sentir l’étirement derrière les cuisses.' },
  { id: 'leg_curl', nom: 'Leg curl', cat: 'charniere', mat: ['leg_curl'], consigne: 'Ramène les talons vers les fesses, redescends lentement.' },
  { id: 'swing', nom: 'Kettlebell swing', cat: 'charniere', mat: ['kettlebell'], consigne: 'Le mouvement vient des hanches, pas des bras.' },
  { id: 'pont_fessier', nom: 'Pont fessier', cat: 'charniere', mat: [], consigne: 'Allongé, pieds au sol, monte les hanches et serre les fessiers 1 s en haut.' },
  { id: 'pont_1jambe', nom: 'Pont fessier sur une jambe', cat: 'charniere', mat: [], consigne: 'Une jambe tendue en l’air, alterne à chaque série.' },
  // Unilatéral (jambes, équilibre)
  { id: 'fentes_halteres', nom: 'Fentes marchées (haltères)', cat: 'unilateral', mat: ['halteres'], consigne: 'Grand pas, genou arrière frôle le sol, buste droit.' },
  { id: 'leg_ext', nom: 'Leg extension', cat: 'unilateral', mat: ['leg_ext'], consigne: 'Tends les jambes, tiens 1 s en haut, redescends lentement.' },
  { id: 'fentes_arriere', nom: 'Fentes arrière', cat: 'unilateral', mat: [], consigne: 'Recule une jambe, genou arrière près du sol, alterne.' },
  { id: 'fentes_sautees', nom: 'Fentes sautées', cat: 'unilateral', mat: [], consigne: 'Change de jambe en l’air, atterris en douceur.' },
  // Poussée horizontale (pectoraux)
  { id: 'dc_barre', nom: 'Développé couché (barre)', cat: 'pousse_h', mat: ['barre', 'banc'], consigne: 'Omoplates serrées, barre au bas des pectoraux.' },
  { id: 'dc_halteres', nom: 'Développé couché (haltères)', cat: 'pousse_h', mat: ['halteres', 'banc'], consigne: 'Descends les haltères au niveau de la poitrine, coudes à 45°.' },
  { id: 'machine_pecs', nom: 'Machine pectoraux', cat: 'pousse_h', mat: ['machine_pecs'], consigne: 'Pousse sans verrouiller les coudes, reviens lentement.' },
  { id: 'dips', nom: 'Dips', cat: 'pousse_h', mat: ['barres_dips'], consigne: 'Buste légèrement penché, descends coudes à 90°.' },
  { id: 'pompes', nom: 'Pompes', cat: 'pousse_h', mat: [], consigne: 'Corps gainé, poitrine près du sol. Trop dur : sur les genoux.' },
  { id: 'pompes_larges', nom: 'Pompes mains larges', cat: 'pousse_h', mat: [], consigne: 'Mains plus larges que les épaules, descends lentement.' },
  // Poussée verticale (épaules)
  { id: 'dm_halteres', nom: 'Développé épaules (haltères)', cat: 'pousse_v', mat: ['halteres'], consigne: 'Assis ou debout, pousse au-dessus de la tête sans cambrer.' },
  { id: 'machine_epaules', nom: 'Machine épaules', cat: 'pousse_v', mat: ['machine_epaules'], consigne: 'Pousse vers le haut, redescends jusqu’aux oreilles.' },
  { id: 'dm_barre', nom: 'Développé militaire (barre)', cat: 'pousse_v', mat: ['barre'], consigne: 'Debout, fessiers serrés, barre devant le visage.' },
  { id: 'pompes_piquees', nom: 'Pompes piquées', cat: 'pousse_v', mat: [], consigne: 'Fesses en l’air (V inversé), descends la tête vers le sol.' },
  // Tirage vertical (dos large)
  { id: 'tractions', nom: 'Tractions', cat: 'tire_v', mat: ['barre_traction'], consigne: 'Menton au-dessus de la barre. Trop dur : fais des négatives (descente lente).' },
  { id: 'tirage_vertical', nom: 'Tirage vertical', cat: 'tire_v', mat: ['tirage_vertical'], consigne: 'Tire la barre vers le haut de la poitrine, coudes vers le sol.' },
  { id: 'poulie_bras_tendus', nom: 'Tirage bras tendus à la poulie', cat: 'tire_v', mat: ['poulie'], consigne: 'Bras presque tendus, ramène la barre vers les cuisses.' },
  { id: 'ytw', nom: 'Y-T-W allongé', cat: 'tire_v', mat: [], consigne: 'À plat ventre, bras en Y puis T puis W, serre les omoplates.' },
  // Tirage horizontal (milieu du dos)
  { id: 'rowing_halteres', nom: 'Rowing haltère', cat: 'tire_h', mat: ['halteres'], consigne: 'Une main appuyée, tire l’haltère vers la hanche.' },
  { id: 'tirage_horizontal', nom: 'Tirage horizontal assis', cat: 'tire_h', mat: ['tirage_horizontal'], consigne: 'Dos droit, tire vers le nombril, serre les omoplates.' },
  { id: 'rowing_barre', nom: 'Rowing barre', cat: 'tire_h', mat: ['barre'], consigne: 'Buste penché à 45°, barre vers le nombril.' },
  { id: 'rowing_poulie', nom: 'Rowing à la poulie', cat: 'tire_h', mat: ['poulie'], consigne: 'Tire vers le ventre, coudes près du corps.' },
  { id: 'superman', nom: 'Superman', cat: 'tire_h', mat: [], consigne: 'À plat ventre, décolle bras et jambes, tiens 2 s, redescends.' },
  { id: 'superman_rowing', nom: 'Superman rowing', cat: 'tire_h', mat: [], consigne: 'Bras et buste décollés, ramène les coudes vers les côtes.' },
  // Bras
  { id: 'curl_halteres', nom: 'Curl haltères', cat: 'biceps', mat: ['halteres'], consigne: 'Coudes collés au corps, pas d’élan.' },
  { id: 'curl_poulie', nom: 'Curl à la poulie', cat: 'biceps', mat: ['poulie'], consigne: 'Coudes fixes, serre en haut.' },
  { id: 'curl_barre', nom: 'Curl barre', cat: 'biceps', mat: ['barre'], consigne: 'Dos droit, monte sans balancer.' },
  { id: 'triceps_poulie', nom: 'Extension triceps à la poulie', cat: 'triceps', mat: ['poulie'], consigne: 'Coudes collés, tends les bras vers le bas.' },
  { id: 'triceps_haltere', nom: 'Extension triceps haltère', cat: 'triceps', mat: ['halteres'], consigne: 'Haltère derrière la tête, tends les bras vers le haut.' },
  { id: 'pompes_diamant', nom: 'Pompes serrées', cat: 'triceps', mat: [], consigne: 'Mains rapprochées sous la poitrine, coudes le long du corps.' },
  // Gainage (en secondes)
  { id: 'gainage', nom: 'Gainage', cat: 'core', mat: [], temps: true, consigne: 'Sur les avant-bras, corps aligné, ventre serré.' },
  { id: 'gainage_lateral', nom: 'Gainage latéral', cat: 'core', mat: [], temps: true, consigne: 'Sur le côté, hanches hautes. Change de côté à mi-temps.' },
  { id: 'crunch_velo', nom: 'Crunch vélo', cat: 'core', mat: [], temps: true, consigne: 'Coude vers le genou opposé, alterne sans tirer sur la nuque.' },
  { id: 'releves_jambes', nom: 'Relevés de jambes', cat: 'core', mat: [], temps: true, consigne: 'Allongé, mains sous les fesses, monte les jambes tendues.' },
  // Cardio
  { id: 'rameur', nom: 'Rameur', cat: 'cardio', mat: ['rameur'], temps: true, consigne: 'Rythme soutenu mais régulier.' },
  { id: 'velo', nom: 'Vélo', cat: 'cardio', mat: ['velo'], temps: true, consigne: 'Résistance moyenne, rythme soutenu.' },
  { id: 'tapis', nom: 'Tapis (marche inclinée ou course)', cat: 'cardio', mat: ['tapis'], temps: true, consigne: 'Inclinaison 8-10 %, marche rapide.' },
  { id: 'elliptique', nom: 'Elliptique', cat: 'cardio', mat: ['elliptique'], temps: true, consigne: 'Rythme soutenu, utilise les bras.' },
  { id: 'mountain_climbers', nom: 'Mountain climbers', cat: 'cardio', mat: [], temps: true, consigne: 'Position de pompe, ramène les genoux vite vers la poitrine.' },
  { id: 'burpees', nom: 'Burpees', cat: 'cardio', mat: [], temps: true, consigne: 'Au sol, pompe (facultative), saute. À ton rythme.' },
  { id: 'jumping_jacks', nom: 'Jumping jacks', cat: 'cardio', mat: [], temps: true, consigne: 'Écarte bras et jambes en sautant.' },
  { id: 'montees_genoux', nom: 'Montées de genoux', cat: 'cardio', mat: [], temps: true, consigne: 'Sur place, genoux à hauteur des hanches.' },
  // Poids du corps en plus, pour varier les séances maison
  { id: 'squat_jacks', nom: 'Squat jacks', cat: 'cardio', mat: [], temps: true, consigne: 'Saute pieds écartés en squat, puis pieds joints debout.' },
  { id: 'talons_fesses', nom: 'Talons-fesses', cat: 'cardio', mat: [], temps: true, consigne: 'Sur place, ramène les talons vers les fesses, rythme rapide.' },
  { id: 'patineur', nom: 'Sauts du patineur', cat: 'cardio', mat: [], temps: true, consigne: 'Saute d’un pied sur l’autre sur le côté, comme un patineur.' },
  { id: 'shadow_boxing', nom: 'Shadow boxing', cat: 'cardio', mat: [], temps: true, consigne: 'Enchaîne directs et crochets dans le vide, reste sur la pointe des pieds.' },
  { id: 'planche_jacks', nom: 'Planche jacks', cat: 'cardio', mat: [], temps: true, consigne: 'En planche, écarte et resserre les pieds en sautant.' },
  { id: 'chenille', nom: 'Chenille (inchworm)', cat: 'cardio', mat: [], temps: true, consigne: 'Penche-toi, avance sur les mains jusqu’à la planche, reviens.' },
  { id: 'squat_pulse', nom: 'Squat pulsé', cat: 'squat', mat: [], consigne: 'Reste en bas du squat et fais de petits rebonds.' },
  { id: 'chaise', nom: 'Chaise contre le mur', cat: 'squat', mat: [], temps: true, consigne: 'Dos au mur, cuisses parallèles au sol, tiens la position.' },
  { id: 'fentes_laterales', nom: 'Fentes latérales', cat: 'unilateral', mat: [], consigne: 'Grand pas sur le côté, fléchis une jambe, l’autre tendue. Alterne.' },
  { id: 'mollets', nom: 'Montées sur pointes', cat: 'unilateral', mat: [], consigne: 'Monte sur la pointe des pieds, tiens 1 s, redescends lentement.' },
  { id: 'pompes_lentes', nom: 'Pompes lentes (3 s)', cat: 'pousse_h', mat: [], consigne: 'Descends en 3 secondes, remonte normalement. Sur les genoux si besoin.' },
  { id: 'planche_epaules', nom: 'Planche touchers d’épaules', cat: 'pousse_v', mat: [], temps: true, consigne: 'En planche, touche l’épaule opposée sans bouger les hanches.' },
  { id: 'bird_dog', nom: 'Bird dog', cat: 'tire_h', mat: [], consigne: 'À quatre pattes, tends bras et jambe opposés, tiens 2 s. Alterne.' },
  { id: 'hollow', nom: 'Hollow hold', cat: 'core', mat: [], temps: true, consigne: 'Sur le dos, bras et jambes tendus décollés, bas du dos plaqué au sol.' },
  { id: 'dead_bug', nom: 'Dead bug', cat: 'core', mat: [], temps: true, consigne: 'Sur le dos, descends bras et jambe opposés sans décoller le bas du dos.' },
  { id: 'russian_twist', nom: 'Russian twist', cat: 'core', mat: [], temps: true, consigne: 'Assis, pieds décollés, tourne le buste d’un côté à l’autre.' },
];

// Petite image de chaque famille d'exercices (affichée dans les listes et le lecteur).
const PICTOS = { squat: '🦵', unilateral: '🦿', charniere: '🍑', pousse_h: '💪', pousse_v: '🙌', tire_v: '🦅', tire_h: '🔙', biceps: '💪', triceps: '💪', core: '🧱', cardio: '🔥' };
const FAMILLES = { squat: 'Jambes', unilateral: 'Jambes', charniere: 'Fessiers', pousse_h: 'Pecs', pousse_v: 'Épaules', tire_v: 'Dos', tire_h: 'Dos', biceps: 'Bras', triceps: 'Bras', core: 'Abdos', cardio: 'Cardio' };

// Séances en salle : rotation A → B → C. v = variante (n-ième exercice disponible de la catégorie).
const MODELES_GYM = {
  A: { titre: 'Bas du corps + poussée', slots: [['squat', 0], ['pousse_h', 0], ['tire_v', 0], ['charniere', 0], ['pousse_v', 0], ['core', 0]] },
  B: { titre: 'Dos + bras', slots: [['charniere', 1], ['tire_h', 0], ['pousse_v', 1], ['unilateral', 0], ['biceps', 0], ['triceps', 0]] },
  C: { titre: 'Full body + cardio', slots: [['unilateral', 1], ['pousse_h', 1], ['tire_h', 1], ['squat', 1], ['core', 1], ['cardio', 0]] },
};


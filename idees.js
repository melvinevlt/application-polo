// Idées de repas et d'en-cas simples (cantine de mine, chambre, supérette), valeurs moyennes par portion.
// L'app propose celles qui rentrent dans les calories restantes, en priorité les plus riches en protéines s'il en manque.
const IDEES = [
  // En-cas
  { nom: 'Yaourt grec nature + une poignée de fruits rouges', kcal: 180, p: 15, g: 14, l: 6, type: 'en-cas' },
  { nom: 'Skyr ou fromage blanc 0 % (250 g)', kcal: 150, p: 25, g: 10, l: 0, type: 'en-cas' },
  { nom: 'Shaker de protéine à l’eau', kcal: 120, p: 24, g: 3, l: 2, type: 'en-cas' },
  { nom: 'Shaker de protéine au lait + 1 banane', kcal: 330, p: 32, g: 45, l: 5, type: 'en-cas' },
  { nom: '2 œufs durs', kcal: 150, p: 13, g: 1, l: 10, type: 'en-cas' },
  { nom: 'Pomme + 15 amandes', kcal: 190, p: 5, g: 22, l: 10, type: 'en-cas' },
  { nom: '1 banane', kcal: 105, p: 1, g: 27, l: 0, type: 'en-cas' },
  { nom: 'Boîte de thon au naturel + 2 galettes de riz', kcal: 200, p: 26, g: 15, l: 2, type: 'en-cas' },
  { nom: 'Barre protéinée', kcal: 210, p: 20, g: 20, l: 7, type: 'en-cas' },
  { nom: 'Jerky de bœuf (50 g)', kcal: 140, p: 22, g: 6, l: 3, type: 'en-cas' },
  { nom: 'Lait (300 ml) + 2 biscuits', kcal: 230, p: 11, g: 30, l: 8, type: 'en-cas' },
  { nom: 'Bâtonnets de crudités + houmous (60 g)', kcal: 170, p: 6, g: 15, l: 10, type: 'en-cas' },
  { nom: 'Tranche de pain complet + beurre de cacahuète', kcal: 200, p: 8, g: 17, l: 11, type: 'en-cas' },
  { nom: 'Fromage blanc + flocons d’avoine (40 g) + miel', kcal: 330, p: 24, g: 48, l: 4, type: 'en-cas' },
  // Repas (cantine ou simple à préparer)
  { nom: 'Poulet grillé, riz (1 louche), légumes verts', kcal: 520, p: 45, g: 55, l: 10, type: 'repas' },
  { nom: 'Steak, pommes de terre vapeur, salade', kcal: 560, p: 40, g: 45, l: 22, type: 'repas' },
  { nom: 'Saumon, quinoa, brocolis', kcal: 580, p: 38, g: 45, l: 24, type: 'repas' },
  { nom: 'Grande salade poulet, œuf, maïs, vinaigrette légère', kcal: 450, p: 40, g: 25, l: 20, type: 'repas' },
  { nom: 'Omelette 3 œufs + jambon + pain complet', kcal: 480, p: 35, g: 30, l: 24, type: 'repas' },
  { nom: 'Wrap poulet crudités', kcal: 430, p: 30, g: 45, l: 13, type: 'repas' },
  { nom: 'Pâtes bolognaise (assiette moyenne)', kcal: 620, p: 32, g: 80, l: 18, type: 'repas' },
  { nom: 'Chili con carne + riz (petite assiette)', kcal: 550, p: 33, g: 62, l: 17, type: 'repas' },
  { nom: 'Soupe de légumes + 2 tranches de jambon + pain', kcal: 330, p: 22, g: 40, l: 8, type: 'repas' },
  { nom: 'Assiette légumes + poisson blanc', kcal: 300, p: 32, g: 18, l: 10, type: 'repas' },
  { nom: 'Burger maison + salade (sans frites)', kcal: 600, p: 35, g: 45, l: 30, type: 'repas' },
  { nom: 'Bol de riz, œufs, légumes sautés', kcal: 500, p: 22, g: 65, l: 16, type: 'repas' },
];

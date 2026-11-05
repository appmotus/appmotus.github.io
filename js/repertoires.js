// Motus — Répertoires des émotions et des besoins (Liberté pour Aimer), intensités, couleurs de la journée
'use strict';


/* ───────────── Répertoire des émotions (Liberté pour Aimer) ───────────── */
const FAM = [
  {k:'peur', n:'Peur', b:'Besoin de sécurité & de protection', c:'#5B6BB5',
   l:['Inquiet(e)','Préoccupé(e)','Hésitant(e)','Méfiant(e)','Indécis(e)'],
   m:['Anxieux(se)','Angoissé(e)','Insécure','Craintif(ve)','Vulnérable','Tendu(e)'],
   i:['Terrorisé(e)','Paniqué(e)','Effrayé(e)','Sidéré(e)','En détresse']},
  {k:'colere', n:'Colère', b:'Besoin de limites & de respect', c:'#C2453A',
   l:['Contrarié(e)','Agacé(e)','Impatient(e)','Irrité(e)','Mécontent(e)'],
   m:['Frustré(e)','Aigri(e)','Exaspéré(e)','Plein(e) de rancœur','Offensé(e)'],
   i:['Enragé(e)','Furieux(se)','Indigné(e)','Hors de moi','Hostile']},
  {k:'tristesse', n:'Tristesse', b:'Besoin de réconfort & de soutien', c:'#3E7CA6',
   l:['Mélancolique','Nostalgique','Abattu(e)','Déçu(e)','Seul(e)'],
   m:['Découragé(e)','Désillusionné(e)','Résigné(e)','Blessé(e)'],
   i:['Désespéré(e)','Anéanti(e)','Dévasté(e)','Abandonné(e)','En deuil']},
  {k:'joie', n:'Joie', b:'Besoin de partage & de célébration', c:'#B07F12',
   l:['Serein(e)','Apaisé(e)','Soulagé(e)','Détendu(e)','En paix'],
   m:['Satisfait(e)','Enthousiaste','Fier(ère)','Confiant(e)','Stimulé(e)'],
   i:['Euphorique','Ravi(e)','Émerveillé(e)','Reconnaissant(e)','Plein(e) de gratitude']},
  {k:'degout', n:'Dégoût & rejet', b:'Besoin d’éloignement & d’alignement', c:'#5E8A49',
   l:['Gêné(e)','Réticent(e)','Mal à l’aise','Refroidi(e)'],
   m:['Écœuré(e)','Distant(e)','Plein(e) d’antipathie','Méprisant(e)'],
   i:['Révulsé(e)','Dégoûté(e)','Horrifié(e)','En rejet total']},
  {k:'surprise', n:'Surprise', b:'Besoin de réorientation & d’intégration', c:'#9B559A',
   l:['Curieux(se)','Intrigué(e)','Étonné(e)','Perplexe'],
   m:['Déconcerté(e)','Désorienté(e)','Sous le choc','Ébahi(e)'],
   i:['Sidéré(e)','Stupéfait(e)','Saisi(e)','Totalement émerveillé(e)']},
];
const FAMK = Object.fromEntries(FAM.map(f => [f.k, f]));
/* ───────────── Répertoire des besoins (Liberté pour Aimer) ─────────────
   Chaque famille de besoins répond à une famille d'émotions (f) et en prend la couleur ; trois groupes par famille (g).
   Un besoin noté est enregistré dans la note de l'émotion qu'il éclaire : {b: famille, w: besoin}. */
const BES = [
  {k:'securite', f:'peur', c:'Sécurité', n:'Sécurité & vitalité', m:'Moteur d’apaisement de la Peur & du Stress', g:[
    ['L’Ancrage', ['Sécurité','Protection','Calme','Stabilité','Repères','Sérénité']],
    ['Le Corps', ['Sommeil','Repos','Détente','Santé','Nutrition','Mouvement']],
    ['La Prévisibilité', ['Clarté','Ordre','Structure','Continuité','Confort physique']]]},
  {k:'identite', f:'colere', c:'Identité', n:'Identité & autonomie', m:'Moteur d’affirmation & de Limites', g:[
    ['L’Intégrité', ['Respect','Considération','Dignité','Espace personnel','Limites']],
    ['La Liberté', ['Autonomie','Choix','Indépendance','Spontanéité','Pouvoir d’agir']],
    ['L’Authenticité', ['Alignement','Cohérence','Estime de soi','Fidélité à soi']]]},
  {k:'lien', f:'tristesse', c:'Lien', n:'Lien & appartenance', m:'Moteur de Réconfort & d’Accueil de la Tristesse', g:[
    ['L’Affection', ['Tendresse','Chaleur humaine','Réconfort','Soutien','Écoute']],
    ['L’Inclusion', ['Appartenance','Partage','Communion','Accueil','Présence']],
    ['La Connexion', ['Intimité','Proximité','Empathie','Confiance réciproque']]]},
  {k:'accomplissement', f:'joie', c:'Accomplis&shy;sement', n:'Accomplissement & joie', m:'Moteur de Vitalité & d’Épanouissement', g:[
    ['La Célébration', ['Joie','Plaisir','Gratitude','Fête','Légèreté','Émerveillement']],
    ['La Réalisation', ['Contribution','Création','Compétences','Fierté','Efficacité']],
    ['L’Élan', ['Jeu','Stimulation','Aventure','Passion','Liberté d’expression']]]},
  {k:'alignement', f:'degout', c:'Alignement', n:'Alignement & harmonie', m:'Moteur de Clarification du Dégoût/Aversion', g:[
    ['La Propreté', ['Pureté','Harmonie','Beauté','Environnement sain','Équilibre']],
    ['La Vérité', ['Sincérité','Honnêteté','Justice','Transparence','Éthique']],
    ['La Paix', ['Tranquillité','Harmonie relationnelle','Bienveillance','Apaisement']]]},
  {k:'sens', f:'surprise', c:'Sens', n:'Sens & compréhension', m:'Moteur d’Orientation de la Surprise', g:[
    ['La Clarté', ['Compréhension','Discernement','Ordre','Apprentissage']],
    ['La Direction', ['Sens','Projet','Utilité','Cohérence de vie','Orientation']],
    ['La Découverte', ['Curiosité','Évolution','Ouverture d’esprit','Spiritualité']]]},
];
const BESK = Object.fromEntries(BES.map(b => [b.k, b]));
const coulB = k => FAMK[BESK[k]?.f]?.c || 'var(--accent)';
const sansArticle = s => s.replace(/^(L’|Le |La |Les )/, '');
const INT = [['l','Légère'],['m','Modérée'],['i','Intense']];
const INTN = Object.fromEntries(INT);
const COL = ['vert','jaune','rouge'];
const COLNAME = {vert:'Vert', jaune:'Jaune', rouge:'Rouge'};
const DEF_LABELS = {vert:'Bonne journée', jaune:'Journée mitigée', rouge:'Journée difficile'};


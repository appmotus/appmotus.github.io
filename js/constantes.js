// Motus — Version de l'app, compteurs de travail, engagements de la version d'essai, messages, toast
'use strict';

const APP_VERSION = 42;   // même numéro que CACHE dans sw.js
const HEURES_TRAVAIL = 33;   // à chaque nouvelle version : résultat de outils/compter-heures.ps1, arrondi à l'heure
const JETONS_CONSOMMES = {total:972, cache:957, envoyes:11.9, ecrits:3.3};   // en millions, même script, même moment
const RGPD_VERSION = 4; // version de confidentialite.html ; l'augmenter redemande l'acceptation à tous les comptes
const ESSAI_VERSION = 1; // engagements de la version d'essai ; l'augmenter les redemande à tous les comptes
const ESSAI_INTRO = 'Cette application est en version d’essai. Je l’utilise avec l’accord de l’administrateur. En l’utilisant, je m’engage à :';
const ENGAGEMENTS = [
  'Ne pas en parler autour de moi.',
  'Ne pas la diffuser sans l’accord de l’administrateur (contact dans Paramètres › Nous contacter).',
  'Sauvegarder régulièrement mes données : même si c’est peu probable, des pertes de données sont possibles (Paramètres › Sauvegarde).',
  'Faire remonter à l’administrateur les anomalies rencontrées et mes idées d’amélioration (Paramètres › Nous contacter).',
];
const MAIL_AIDE = {
  client:'Votre mail sert uniquement à récupérer votre compte ou à effacer vos données. Un code vous sera envoyé pour le confirmer.',
  therapeute:'Votre mail professionnel sert à récupérer votre compte, à effacer vos données et à recevoir les envois de vos clients : il leur est transmis une fois leur demande acceptée. Un code vous sera envoyé pour le confirmer.',
};
const MAIL_NOM = {client:'Mail de récupération', therapeute:'Mail professionnel'};
let toastTimer;
function toast(msg) {
  document.querySelector('.toast')?.remove();
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg; t.setAttribute('role', 'status');
  document.body.appendChild(t);
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.remove(), 2600);
}


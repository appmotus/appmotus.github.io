// Motus — fonction « recuperation » (Supabase › Edge Functions)
// Enregistre l'empreinte de l'adresse de récupération, envoie le code par Brevo, change le mot de passe.
// L'adresse n'est jamais stockée : elle n'est utilisée qu'au moment où l'utilisateur la saisit.
//
// Secrets à définir dans Supabase (Edge Functions › Secrets) :
//   RECUPERATION_SECRET  longue valeur aléatoire
//   BREVO_API_KEY        clé d'API Brevo
//   EMAIL_EXPEDITEUR     adresse d'expéditeur validée dans Brevo

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const BASE = Deno.env.get("SUPABASE_URL")!;
const ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SECRET = Deno.env.get("RECUPERATION_SECRET")!;
const enc = new TextEncoder();

const rep = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const toB64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();

async function empreinte(valeur: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", enc.encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toB64(new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(valeur))));
}

async function db(path: string, init: RequestInit = {}) {
  const r = await fetch(`${BASE}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: ROLE, Authorization: `Bearer ${ROLE}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  if (!r.ok) throw new Error(`base ${r.status}: ${await r.text()}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

const ligneRecup = async (profil: string) =>
  (await db(`recuperation?profil=eq.${profil}&select=*`))[0] ?? null;

async function profilDe(identifiant: string) {
  const l = await db(`profils?identifiant=eq.${encodeURIComponent(identifiant)}&select=id`);
  return l[0]?.id ?? null;
}

async function envoyer(email: string, subject: string, textContent: string): Promise<boolean> {
  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": Deno.env.get("BREVO_API_KEY")!, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: { name: "Motus", email: Deno.env.get("EMAIL_EXPEDITEUR") },
      to: [{ email }],
      subject,
      textContent,
    }),
  });
  if (!r.ok) console.error("Brevo", r.status, await r.text());
  return r.ok;
}

// Identifie l'utilisateur connecté à partir de son jeton
async function utilisateur(req: Request): Promise<string | null> {
  const u = await fetch(`${BASE}/auth/v1/user`, {
    headers: { apikey: ROLE, Authorization: req.headers.get("Authorization") ?? "" },
  });
  return u.ok ? (await u.json()).id : null;
}

// Administrateur uniquement : e-mails restants selon Brevo, pour la carte « Services et limites »
async function quotaEnvoi(req: Request) {
  const id = await utilisateur(req);
  if (!id) return rep(401, { code: "session", message: "Session invalide" });
  const p = (await db(`profils?id=eq.${id}&select=est_admin,actif`))[0];
  if (!p?.est_admin || !p.actif) return rep(403, { code: "interdit", message: "Réservé à l'administrateur" });
  const r = await fetch("https://api.brevo.com/v3/account", { headers: { "api-key": Deno.env.get("BREVO_API_KEY")! } });
  if (!r.ok) return rep(502, { code: "serveur", message: "Brevo indisponible" });
  const plan = ((await r.json()).plan ?? []).find((x: { type: string }) => x.type !== "sms");
  return rep(200, { credits: plan?.credits ?? null, type: plan?.type ?? null });
}

const nouveauCode = () => String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0");

// L'utilisateur connecté enregistre ou remplace son adresse : elle reste en attente jusqu'à la saisie du code reçu
async function definir(req: Request, email: string) {
  const id = await utilisateur(req);
  if (!id) return rep(401, { code: "session", message: "Session invalide" });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return rep(400, { code: "email_invalide", message: "Adresse invalide" });
  const existante = await ligneRecup(id);
  if (existante?.derniere_confirmation && Date.now() - new Date(existante.derniere_confirmation).getTime() < 60_000) {
    return rep(429, { code: "patience", message: "Attendez une minute avant un nouvel envoi" });
  }
  const cle = existante?.cle_secours ?? toB64(crypto.getRandomValues(new Uint8Array(32)));
  const code = nouveauCode();
  await db("recuperation?on_conflict=profil", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({
      profil: id,
      cle_secours: cle,
      attente_empreinte: await empreinte(`${id}|${email}`),
      confirm_empreinte: await empreinte(`confirmer|${id}|${code}`),
      confirm_expire: new Date(Date.now() + 30 * 60_000).toISOString(),
      confirm_essais: 0,
      derniere_confirmation: new Date().toISOString(),
    }),
  });
  const ok = await envoyer(email, "Votre code de confirmation",
    `Votre code de confirmation : ${code}\n\nSaisissez-le dans l'app pour confirmer votre adresse de récupération. Il est valable 30 minutes. Si vous n'avez rien demandé, ignorez ce message.`);
  return ok ? rep(200, { ok: true }) : rep(502, { code: "envoi", message: "E-mail non envoyé" });
}

// Saisie du code reçu : elle prouve que la boîte mail est bien la bonne
async function confirmer(req: Request, code: string) {
  const id = await utilisateur(req);
  if (!id) return rep(401, { code: "session", message: "Session invalide" });
  const invalide = rep(400, { code: "code_invalide", message: "Code incorrect ou expiré" });
  const l = await ligneRecup(id);
  if (!l?.attente_empreinte || !l.confirm_empreinte || new Date(l.confirm_expire).getTime() < Date.now() || l.confirm_essais >= 5) return invalide;
  if (l.confirm_empreinte !== (await empreinte(`confirmer|${id}|${code}`))) {
    await db(`recuperation?profil=eq.${id}`, { method: "PATCH", body: JSON.stringify({ confirm_essais: l.confirm_essais + 1 }) });
    return invalide;
  }
  await db(`recuperation?profil=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify({ email_empreinte: l.attente_empreinte, attente_empreinte: null, confirm_empreinte: null, confirm_expire: null, confirm_essais: 0 }),
  });
  return rep(200, { ok: true });
}

// Toujours la même réponse : personne ne peut savoir si un compte ou une adresse existe
async function demande(identifiant: string, email: string) {
  const id = await profilDe(identifiant);
  const l = id && (await ligneRecup(id));
  if (l && l.email_empreinte === (await empreinte(`${id}|${email}`))) {
    const attente = l.derniere_demande && Date.now() - new Date(l.derniere_demande).getTime() < 60_000;
    // Un code de 6 chiffres se devine plus facilement : au plus 5 demandes par 24 heures, 5 essais par code
    const neuf = !l.demandes_depuis || Date.now() - new Date(l.demandes_depuis).getTime() > 24 * 3600_000;
    const nb = neuf ? 0 : l.demandes_nb;
    if (!attente && nb < 5) {
      const code = nouveauCode();
      await db(`recuperation?profil=eq.${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          code_empreinte: await empreinte(`code|${id}|${code}`),
          code_expire: new Date(Date.now() + 15 * 60_000).toISOString(),
          essais: 0,
          derniere_demande: new Date().toISOString(),
          demandes_nb: nb + 1,
          demandes_depuis: neuf ? new Date().toISOString() : l.demandes_depuis,
        }),
      });
      await envoyer(email, "Votre code de récupération",
        `Votre code de récupération : ${code}\n\nIl est valable 15 minutes. Si vous n'avez rien demandé, ignorez ce message.`);
    }
  }
  return rep(200, { ok: true });
}

async function confirme(identifiant: string, code: string, motDePasse: string) {
  const invalide = rep(400, { code: "code_invalide", message: "Code incorrect ou expiré" });
  if (motDePasse.length < 8) return rep(400, { code: "mot_de_passe_faible", message: "Mot de passe trop court" });
  const id = await profilDe(identifiant);
  const l = id && (await ligneRecup(id));
  if (!l?.code_empreinte || !l.code_expire || new Date(l.code_expire).getTime() < Date.now() || l.essais >= 5) return invalide;
  if (l.code_empreinte !== (await empreinte(`code|${id}|${code}`))) {
    await db(`recuperation?profil=eq.${id}`, { method: "PATCH", body: JSON.stringify({ essais: l.essais + 1 }) });
    return invalide;
  }
  const r = await fetch(`${BASE}/auth/v1/admin/users/${id}`, {
    method: "PUT",
    headers: { apikey: ROLE, Authorization: `Bearer ${ROLE}`, "Content-Type": "application/json" },
    body: JSON.stringify({ password: motDePasse }),
  });
  if (!r.ok) {
    console.error("Mot de passe", r.status, await r.text());
    return rep(400, { code: "mot_de_passe_faible", message: "Mot de passe refusé" });
  }
  await db(`recuperation?profil=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify({ code_empreinte: null, code_expire: null, essais: 0 }),
  });
  return rep(200, { cle_secours: l.cle_secours });
}

// Effacer ses données : le code prouve l'accès à la boîte mail. L'effacement lui-même se fait sur l'appareil.
// Partage le code en cours et les limites du mot de passe oublié, mais un code ne vaut jamais pour l'autre usage.
async function effacerDemande(req: Request, email: string) {
  const id = await utilisateur(req);
  if (!id) return rep(401, { code: "session", message: "Session invalide" });
  const l = await ligneRecup(id);
  if (!l?.email_empreinte || l.email_empreinte !== (await empreinte(`${id}|${email}`))) {
    return rep(400, { code: "adresse", message: "Adresse incorrecte" });
  }
  if (l.derniere_demande && Date.now() - new Date(l.derniere_demande).getTime() < 60_000) {
    return rep(429, { code: "patience", message: "Attendez une minute avant un nouvel envoi" });
  }
  const neuf = !l.demandes_depuis || Date.now() - new Date(l.demandes_depuis).getTime() > 24 * 3600_000;
  const nb = neuf ? 0 : l.demandes_nb;
  if (nb >= 5) return rep(429, { code: "limite", message: "Trop de demandes aujourd'hui" });
  const code = nouveauCode();
  await db(`recuperation?profil=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      code_empreinte: await empreinte(`effacer|${id}|${code}`),
      code_expire: new Date(Date.now() + 15 * 60_000).toISOString(),
      essais: 0,
      derniere_demande: new Date().toISOString(),
      demandes_nb: nb + 1,
      demandes_depuis: neuf ? new Date().toISOString() : l.demandes_depuis,
    }),
  });
  const ok = await envoyer(email, "Votre code pour effacer vos données",
    `Votre code pour effacer vos données Motus : ${code}\n\nIl est valable 15 minutes. Le saisir efface définitivement les notes de votre téléphone. Si vous n'avez rien demandé, ne le communiquez à personne et changez votre mot de passe.`);
  return ok ? rep(200, { ok: true }) : rep(502, { code: "envoi", message: "E-mail non envoyé" });
}

async function effacerConfirme(req: Request, code: string, email: string) {
  const id = await utilisateur(req);
  if (!id) return rep(401, { code: "session", message: "Session invalide" });
  const invalide = rep(400, { code: "code_invalide", message: "Code incorrect ou expiré" });
  const l = await ligneRecup(id);
  if (!l?.code_empreinte || !l.code_expire || new Date(l.code_expire).getTime() < Date.now() || l.essais >= 5) return invalide;
  if (l.code_empreinte !== (await empreinte(`effacer|${id}|${code}`))) {
    await db(`recuperation?profil=eq.${id}`, { method: "PATCH", body: JSON.stringify({ essais: l.essais + 1 }) });
    return invalide;
  }
  await db(`recuperation?profil=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify({ code_empreinte: null, code_expire: null, essais: 0 }),
  });
  // Mail de confirmation : un échec d'envoi ne doit pas empêcher l'effacement demandé
  if (l.email_empreinte === (await empreinte(`${id}|${email}`))) {
    await envoyer(email, "Vos notes ont bien été effacées",
      `Vos notes Motus ont bien été effacées de votre téléphone. Votre compte reste actif.\n\nSi vous n'êtes pas à l'origine de cette demande, changez votre mot de passe sans attendre.`).catch(console.error);
  }
  return rep(200, { ok: true });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return rep(405, { code: "methode", message: "POST uniquement" });
  try {
    const b = await req.json();
    if (b.action === "quota_envoi") return await quotaEnvoi(req);
    if (b.action === "definir") return await definir(req, norm(b.email));
    if (b.action === "confirmer") return await confirmer(req, String(b.code ?? "").trim());
    if (b.action === "effacer_demande") return await effacerDemande(req, norm(b.email));
    if (b.action === "effacer_confirme") return await effacerConfirme(req, String(b.code ?? "").trim(), norm(b.email));
    if (b.action === "demande") return await demande(norm(b.identifiant), norm(b.email));
    if (b.action === "confirme") return await confirme(norm(b.identifiant), String(b.code ?? "").trim(), String(b.mot_de_passe ?? ""));
    return rep(400, { code: "action", message: "Action inconnue" });
  } catch (e) {
    console.error(e);
    return rep(500, { code: "serveur", message: "Erreur du serveur" });
  }
});

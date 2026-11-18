# Login-Dienst für den Editor (`/admin`)
Eigener Cloudflare Worker (`iseler-cms-auth`). Leon meldet sich mit Benutzername + Passwort an, ohne GitHub-Konto.
Der Worker gibt ein signiertes Sitzungs-Token (30 Tage) aus und leitet API-Aufrufe des Editors nur für
`finnjung/iseler-website` an GitHub weiter, mit einem Installations-Token der GitHub App „Iseler Website Editor“
(App-ID 5819512, nur Contents lesen/schreiben, nur auf diesem Repo installiert). Login: 10 Versuche/Minute/IP.

- Deploy: `cd cms-auth && wrangler deploy`
- Secrets: `APP_PRIVATE_KEY` (PKCS#8), `SESSION_SECRET`, `USERS`
- Benutzer anlegen / Passwort ändern: `node neuer-benutzer.mjs <name> "<Anzeigename>"` → gibt Passwort + neues USERS-JSON aus
- Alle abmelden: `SESSION_SECRET` neu setzen. Eine Person abmelden: ihr `v` in USERS erhöhen.

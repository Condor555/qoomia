# Qoomia V4.3 — patch cumulativa conservativa

## Obiettivo
Trasferire sulla baseline reale V4.2.2 il linguaggio visivo del prototipo Figma senza importarne dati demo, navigazione simulata, stato locale di tema/palette o composer semplificato.

## Implementato
- Sidebar desktop responsiva con le route Next.js reali e bottom navigation mobile invariata nel comportamento.
- Top bar adattiva con `SpaceSwitcher` reale: selezione Personale/Famiglia ancora collegata a `/api/spaces/select` e agli eventi di spazio attivo.
- Home ricomposta in hero saldo + Budget, insight, movimenti recenti, categorie e obiettivi usando esclusivamente `/api/stats`, `/api/transactions` e `/api/categories`.
- Nuovi token chiaro/scuro, gerarchia tipografica, card, raggi, ombre, spaziature e griglie ispirati al Figma.
- Riutilizzo di `QoomiaLogo`, `CategoryIcon`, `Icon`, Phosphor e degli asset locali già presenti. Nessuna copia di `src/App.tsx`, `src/index.css` o `public/qoomia/`.
- Versione applicativa 4.3.0 e suite di guardia aggiornata per mantenere i controlli cumulativi precedenti.

## Logica deliberatamente non modificata
- API route, schema e migrazioni Supabase.
- Calcoli Budget, statistiche, trend, obiettivi, ricorrenze e import/export.
- Autenticazione, middleware, i18n e persistenza tema.
- Service worker, manifest, install prompt e flusso PWA.
- Composer reale, Smart Autocomplete, categorie e distinzione Personale/Famiglia.

## File applicativi modificati
- `app/globals.css`
- `app/layout.tsx`
- `app/page.tsx`
- `app/account/informazioni/page.tsx`
- `components/AppHeader.tsx`
- `components/Nav.tsx`
- `package.json`
- `package-lock.json`

## File di verifica/release
- `scripts/verify-v4.1.6.mjs`
- `scripts/verify-v4.1.8.mjs`
- `scripts/verify-v4.2.mjs`
- `scripts/verify-v4.2.2.mjs`
- `scripts/verify-v4.3.mjs`
- `QOOMIA-V4.3-PATCH.md`

## Da verificare dopo il deploy
1. Login/registrazione/callback Supabase su dominio reale e redirect middleware.
2. Cambio Personale/Famiglia con dati reali in Home, Budget, Movimenti e Statistiche.
3. Light/dark/system dopo reload e in PWA standalone.
4. Installazione PWA, aggiornamento service worker e safe-area su iPhone/Android.
5. Import/export CSV con file reali e download dai browser target.
6. Notifiche push con chiavi VAPID e permessi del dominio di produzione.
7. Controllo visuale a 320, 390, 430, 768, 1024 e 1440 px con dataset vuoto, normale e molto lungo.

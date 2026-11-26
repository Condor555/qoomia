<div align="center">

# Qoomia

**Finanze personali e familiari, finalmente leggibili.**

Smart Finance, budget, movimenti, ricorrenze, obiettivi e statistiche in una PWA moderna.

[![Version](https://img.shields.io/badge/version-4.3.2-0F766E?style=flat-square)](#stato-del-progetto)
[![Next.js](https://img.shields.io/badge/Next.js-15.5.29-111827?style=flat-square&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com/)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?style=flat-square&logo=vercel&logoColor=white)](https://vercel.com/)
[![PWA](https://img.shields.io/badge/PWA-installabile-E76F51?style=flat-square&logo=pwa&logoColor=white)](#pwa-e-notifiche)

[Apri Qoomia](https://qoomia.vercel.app) · [Funzionalità](#funzionalità) · [Configurazione](#configurazione) · [Deploy](#deploy-su-vercel)

</div>

---

## Cos'è Qoomia

Qoomia è un'applicazione web per gestire le finanze quotidiane in uno spazio **Personale** o **Famiglia**. Riunisce registrazione dei movimenti, budget, obiettivi, ricorrenze, analisi e previsioni in un'interfaccia mobile-first, installabile come PWA.

La versione **V4.3.2** introduce un flusso Smart Finance più trasparente, il riconoscimento delle entrate future e un sistema affidabile di auto-post delle ricorrenze con notifiche push.

> [!IMPORTANT]
> Smart Finance produce stime basate sui dati disponibili: non è consulenza finanziaria e non garantisce il saldo effettivo futuro.

## Funzionalità

| Area | Cosa offre |
| --- | --- |
| **Smart Finance** | Stima del saldo di fine mese con composizione chiara di saldo attuale, entrate attese e uscite previste. |
| **Entrate future** | Riconoscimento da ricorrenze e, in assenza di una ricorrenza utile, dallo storico recente. |
| **Qoomia Insights** | Indicatori sintetici, lettura dell'andamento e messaggi contestuali sui dati finanziari. |
| **Personale / Famiglia** | Gestione dei dati nel contesto attivo, con passaggio tra spazio personale e familiare. |
| **Budget** | Limiti di spesa, avanzamento e controllo per categoria. |
| **Movimenti** | Registro di entrate e uscite con data, categoria, importo e descrizione. |
| **Ricorrenze** | Scadenze ripetute, registrazione automatica, recupero degli arretrati e prevenzione dei duplicati. |
| **Notifiche** | Push per gli eventi abilitati, inclusa la registrazione dei movimenti ricorrenti. |
| **Statistiche** | Riepiloghi, composizione per categoria, grafici e accesso ai dettagli Smart Finance. |
| **Obiettivi** | Monitoraggio separato dei traguardi di risparmio. |
| **CSV** | Importazione ed esportazione per trasferire o analizzare i movimenti. |
| **Backup** | Esportazione e ripristino dei dati per continuità operativa. |
| **PWA** | Esperienza mobile-first, installazione sul dispositivo e supporto alle notifiche web. |
| **Tema e accessibilità** | Light e dark mode, focus visibile, target touch adeguati e rispetto di `prefers-reduced-motion`. |

## Smart Finance in V4.3.2

La previsione di fine mese segue questa logica:

```text
saldo attuale
+ entrate programmate
+ entrate abituali riconosciute
− uscite programmate
− spesa variabile stimata
= saldo previsto di fine mese
```

### Riconoscimento delle entrate future

Qoomia cerca prima le **entrate ricorrenti future**. Se non trova una ricorrenza utilizzabile, valuta lo storico recente e può riconoscere un'entrata abituale quando:

- compare in almeno **3 degli ultimi 4 mesi**;
- gli importi restano sufficientemente coerenti, con variazione entro il **20%**;
- la cadenza è compatibile, comprese le variazioni tipiche di fine mese e dei weekend;
- non è già stata ricevuta o conteggiata da un'altra fonte.

La sezione **Verifica entrate future** rende visibili origine, data prevista, inclusione o esclusione ed eventuale motivazione. I dettagli tecnici restano raccolti nella sezione espandibile **Come è calcolato**.

## Ricorrenze, auto-post e notifiche

Le ricorrenze vengono elaborate lato server:

1. Vercel Cron richiama la route protetta dedicata;
2. il server individua le scadenze da registrare;
3. ogni occorrenza è identificata dalla coppia ricorrenza/data per evitare duplicati;
4. il movimento viene creato nello spazio corretto;
5. se l'opzione è attiva, viene inviata la notifica push;
6. aprendo **Ricorrenze**, l'app può recuperare subito eventuali scadenze arretrate senza attendere il ciclo successivo.

Gli errori di invio push non annullano un movimento già registrato.

## Stack

- **Frontend e API:** Next.js 15.5.29, React e TypeScript
- **Database e autenticazione:** Supabase / PostgreSQL
- **Hosting e job pianificati:** Vercel e Vercel Cron
- **Push:** Web Push con chiavi VAPID
- **Distribuzione:** Progressive Web App
- **UI:** CSS applicativo, responsive design e icone Phosphor

## Requisiti

- Git
- Node.js compatibile con Next.js 15; consigliato **Node.js 20 LTS**
- npm
- un progetto Supabase
- un progetto Vercel per deploy, Cron e notifiche in produzione

## Avvio rapido

```bash
git clone https://github.com/Condor555/qoomia.git
cd qoomia
npm ci
npm run dev
```

Apri `http://localhost:3000`.

Prima dell'avvio configura le variabili d'ambiente e applica le migration Supabase come descritto di seguito.

## Configurazione

### Variabili d'ambiente

Inserisci i valori reali soltanto in `.env.local` per lo sviluppo e nelle **Environment Variables** del progetto Vercel. Non salvare mai credenziali nel repository.

| Variabile | Scopo | Visibilità consigliata |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del progetto Supabase | Client; Production e, se usata, Preview |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chiave pubblica anon di Supabase | Client; Production e, se usata, Preview |
| `SUPABASE_SERVICE_ROLE_KEY` | Operazioni server-side privilegiate, incluso l'auto-post | **Server only**; Production |
| `CRON_SECRET` | Protezione della route richiamata dal Cron | **Server only**; Production |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Sottoscrizione del browser alle notifiche push | Client; Production e, se usata, Preview |
| `VAPID_PRIVATE_KEY` | Firma server-side dei messaggi Web Push | **Server only**; Production |
| `VAPID_SUBJECT` | Identità di contatto del mittente Web Push | **Server only**; Production |

> [!CAUTION]
> Le variabili con prefisso `NEXT_PUBLIC_` sono esposte al browser. Non usare mai quel prefisso per `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` o `VAPID_PRIVATE_KEY`.

Le chiavi VAPID pubblica e privata devono essere generate come **un'unica coppia coerente**. È possibile generarle con:

```bash
npx web-push generate-vapid-keys --json
```

Conserva la chiave privata esclusivamente tra i secret server-side. La rotazione delle chiavi richiede una nuova sottoscrizione dei dispositivi.

### Database Supabase

1. Crea o seleziona il progetto Supabase.
2. Apri **SQL Editor**.
3. Esegui le migration presenti in `supabase/migrations` nell'ordine previsto dal progetto.
4. Per V4.3.2 verifica che sia stata applicata anche:

```text
supabase/migrations/20261126_v4_3_2_autopost_smart_finance.sql
```

5. Mantieni attive e verifica le policy di accesso ai dati prima di usare l'app in produzione.
6. Crea un backup prima di applicare migration a un database già popolato.

La migration V4.3.2 abilita il flusso server-side necessario per auto-post e Smart Finance ed è progettata per essere rieseguibile senza creare movimenti duplicati.

## Sviluppo locale

```bash
# server di sviluppo
npm run dev

# build di produzione
npm run build

# avvio della build locale
npm run start
```

Esegui sempre `npm run build` prima di pubblicare modifiche a logica finanziaria, route API, ricorrenze o notifiche.

## Deploy su Vercel

1. Importa la repository in Vercel.
2. Mantieni il framework rilevato come **Next.js**.
3. Aggiungi tutte le variabili della tabella precedente, rispettando la separazione tra valori pubblici e secret server-side.
4. Verifica che `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` e `VAPID_PRIVATE_KEY` non siano esposti alle Preview se non strettamente necessario.
5. Esegui il deploy e attendi lo stato **Ready**.
6. Controlla che il Cron configurato in `vercel.json` richiami la route di elaborazione delle ricorrenze.
7. Esegui la checklist post-deploy.

### Checklist post-deploy

- [ ] Login e caricamento dello spazio attivo
- [ ] Creazione di un movimento di prova
- [ ] Budget e statistiche aggiornati
- [ ] Apertura diretta di Smart Finance dalla Home
- [ ] Entrate future incluse o motivate correttamente
- [ ] Saldo previsto di fine mese coerente con il dettaglio
- [ ] Auto-post di una ricorrenza senza duplicati
- [ ] Notifica push ricevuta quando abilitata
- [ ] Import ed export CSV
- [ ] Backup e ripristino verificati su dati non critici
- [ ] Installazione PWA da dispositivo supportato

## PWA e notifiche

Per il funzionamento completo delle notifiche servono:

- HTTPS, fornito automaticamente da Vercel;
- una coppia VAPID valida;
- permesso notifiche concesso dall'utente;
- una sottoscrizione push registrata dal dispositivo;
- l'opzione di notifica desiderata attiva in Qoomia.

Su dispositivi mobili installa Qoomia dalla funzione **Aggiungi alla schermata Home** del browser supportato. Le capacità PWA e Web Push possono variare in base a browser e sistema operativo.

## CSV, backup e ripristino

- Controlla intestazioni, formato data, separatore decimale e segno degli importi prima di importare un CSV.
- Esegui un backup prima di importazioni estese o migration.
- Prova il ripristino su dati non critici prima di considerare una copia come backup valido.
- Non conservare esportazioni contenenti dati finanziari in percorsi pubblici o non protetti.

## Privacy e sicurezza

Qoomia tratta dati finanziari personali. In ogni installazione:

- conserva chiavi privilegiate e secret soltanto lato server;
- non inserire file `.env*`, dump, CSV o backup nel repository;
- mantieni le policy Supabase coerenti con la separazione tra utenti e spazi;
- limita l'accesso al progetto Supabase e all'account Vercel;
- ruota immediatamente una credenziale esposta;
- verifica periodicamente log, sottoscrizioni push e job pianificati;
- comunica chiaramente agli utenti finali finalità, conservazione ed eventuale cancellazione dei dati.

## Struttura essenziale

```text
app/                    pagine, layout e route API Next.js
components/             componenti dell'interfaccia
lib/                    logica condivisa, Smart Finance e integrazioni
public/                 asset statici e risorse PWA
supabase/migrations/    schema e migration del database
vercel.json             configurazione Vercel e job pianificati
```

## Stato del progetto

- **Versione corrente:** V4.3.2
- **Stato:** funzionante in produzione
- **Auto-post ricorrenze:** attivo
- **Smart Finance:** riconoscimento entrate future e previsione di fine mese attivi
- **Deploy di riferimento:** Vercel

---

<div align="center">

**Qoomia V4.3.2** · Controllo quotidiano, previsioni comprensibili, dati sotto la tua gestione.

</div>

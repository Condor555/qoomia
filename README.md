<div align="center">

<img src="./public/icons/qoomia-v4-1.svg" alt="Logo Qoomia" width="112" height="112" />

# 🟢 Qoomia

**Dai senso alle tue spese, in privato o in famiglia.**

[![Versione](https://img.shields.io/badge/versione-4.1.5-0F766E?style=flat-square)](#stato-del-progetto)
[![Next.js](https://img.shields.io/badge/Next.js-15-000000?style=flat-square&logo=nextdotjs)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com/)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?style=flat-square&logo=vercel)](https://vercel.com/)

</div>

**Qoomia** è una web app mobile-first per gestire finanze personali e condivise. Il nome nasce dall'unione di **Quota** — Budget, impegni programmati e rollover — e **Mia** — uno spazio finanziario personale, chiaro e su misura.

Permette di registrare entrate e uscite, organizzare categorie e ricorrenze, pianificare il Budget e consultare statistiche in **Spazi Privati** o **Spazi Condivisi** con partner e famiglia.

I pilastri dell'esperienza sono **Spazi Privati e Condivisi**, **Macro Budget e Rollover** e **Chiarezza Immediata** nell'inserimento e nella lettura dei dati.

## Funzionalità implementate

### Spazi e account

- autenticazione email/password con Supabase Auth;
- onboarding e profilo utente;
- Spazio Privato per ogni account;
- Spazi Condivisi con ruoli owner/member e codice invito;
- selezione dello spazio coerente tra Home, Movimenti, Statistiche, Budget e Categorie;
- temi chiaro, scuro e automatico;
- interfaccia Italiano/English con preferenza persistita.

### Movimenti e categorie

- entrate, uscite e trasferimenti;
- descrizione, importo, data, categoria e spazio di destinazione;
- ricerca, paginazione e filtri per periodo, categoria, autore e tipo;
- modifica ed eliminazione con conferma;
- categorie distinte per **Uscite/Entrate** e per spazio;
- catalogo locale di icone categoria con ricerca e suggerimenti;
- import CSV compatibile con intestazioni italiane e inglesi;
- export CSV.

### Esperienza V4.1.5

- hotfix iPhone 16: SpacePicker sempre sopra la bottom navigation, CTA movimento adattiva alla tastiera, conferma modifiche più leggibile e grabber rimosso dalle sheet con chiusura X;
- donut Statistiche con label esterne che usano le icone Icons8 locali e legenda completa icona, categoria, importo e percentuale;
- componenti condivisi per skeleton, errori inline, stati vuoti, toast e pulsanti asincroni, senza falsi valori zero durante il caricamento;
- barra Cerca movimenti con filtri immediati raccolti in `AdaptiveSheet` e indicatore dei filtri attivi;
- detail, modifica, selezione categoria, categorie, ricorrenze, obiettivi, Budget e conferme uniformati con `AdaptiveSheet`;
- Category Picker con ricerca, categorie recenti/frequenti e icone Icons8 Color locali;
- Home focalizzata su saldo, flussi, Budget, movimenti recenti, obiettivi e categorie principali;
- report per categoria con icone e collegamento ai Movimenti già filtrati;
- CSS iPhone/PWA consolidato mantenendo lo sheet flottante e il DateInput V4.1.4.

### Esperienza V4.1.4

- `AdaptiveSheet` condivisa con focus trap, Escape, ripristino del focus, blocco dello sfondo e presentazione adattiva mobile/desktop;
- “Nuovo movimento” aperto come compose sheet tramite route intercettata, mantenendo `/nuovo` come pagina completa per URL diretto e refresh;
- conferme distruttive coerenti al posto di `confirm()` e form di rinomina al posto di `prompt()`;
- valori non ancora caricati mostrati come skeleton/“—”, senza falsi zeri;
- caricamento differito del grafico Home e rendering diretto delle icone locali senza doppio preload;
- nuovi indici PostgreSQL per lista, filtri e ricerca testuale dei movimenti.

### Budget e pianificazione

- limite mensile per spazio;
- distribuzione percentuale in categorie Budget;
- impegni ricorrenti, spesa discrezionale e residuo disponibile;
- rollover opzionale;
- impegni programmati separati dal budget allocato: riducono il budget discrezionale complessivo ma non diventano il budget di una categoria;
- percentuale di utilizzo mostrata soltanto quando esiste un budget allocato;
- soglie di utilizzo e proiezione del mese;
- permessi di modifica coerenti con il ruolo nello spazio;
- stato vuoto, errore recuperabile e timeout per evitare caricamenti infiniti.

### Ricorrenze e statistiche

- un solo motore Ricorrenze per regole settimanali, mensili o annuali;
- **Ricorrenza** per movimenti periodici in entrata o uscita; **Abbonamento** per servizi continuativi sempre trattati come uscita, preservando eventuali casi legacy;
- lista delle regole in primo piano e form **Nuova ricorrenza** aperto solo su richiesta;
- costo mensile/annuale equivalente degli abbonamenti;
- calendario delle scadenze e conferma dei pagamenti;
- conferma atomica che crea una sola transazione nello stesso spazio e impedisce duplicati;
- saldo, entrate, uscite e media giornaliera;
- andamento a 6/12 mesi;
- categorie principali, fonti di entrata e ripartizione per autore negli spazi condivisi.

### Obiettivi di risparmio V4.1

- obiettivi associati allo Spazio Privato o a uno Spazio Condiviso;
- target, importo accumulato, residuo, scadenza opzionale, icona e colore;
- contributi con data, nota e attribuzione dell'autore;
- contributo mensile e settimanale suggerito quando è presente una scadenza futura;
- configurazione riservata a owner/creatore e contributi consentiti ai membri;
- accantonamenti separati dalle transazioni: non sono uscite e non alterano Budget o Statistiche.

## Stack

| Area | Tecnologia |
|---|---|
| Framework | Next.js 15, React 19, App Router |
| Linguaggio | TypeScript |
| Database e autenticazione | Supabase PostgreSQL + Supabase Auth |
| Sicurezza dati | Row Level Security |
| Grafici | Recharts |
| Validazione | Zod |
| Import CSV | Papa Parse |
| Icone UI | Phosphor Icons |
| Icone categorie e brand | Icons8 Color locali + fallback Phosphor Tag |
| Deploy | Vercel o piattaforma compatibile con Next.js |

## Avvio locale

### Requisiti

- Node.js 20 o superiore;
- npm;
- un progetto Supabase;
- Git.

```bash
git clone https://github.com/Condor555/qoomia.git
cd qoomia
npm install
```

Creare `.env.local` senza versionarlo:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SITE_URL=
```

Non inserire mai chiavi `service_role` o altri segreti in variabili `NEXT_PUBLIC_*`.

### Database

Per una nuova installazione eseguire `supabase/schema.sql` nel SQL Editor di Supabase.

Per un'istanza esistente applicare soltanto le migration necessarie, nell'ordine documentato nella cartella `supabase/migrations/`. La release corrente include, tra le altre:

- `20261119_v3_6_multiuser.sql`;
- `20261119_v3_7_v3_9.sql`;
- `20261120_v3_9_3_macro_budgets.sql`;
- `20261120_v3_9_3_category_kinds_hotfix.sql`;
- `20261120_v3_9_4_user_language.sql`.
- `20261120_v4_1_savings_goals.sql`.
- `20261120_v4_1_1_ux_icon_cleanup.sql`.
- `20261123_v4_1_4_performance.sql`.

Avviare quindi l'ambiente di sviluppo:

```bash
npm run dev
```

## Deploy

1. collegare la repository alla piattaforma di deploy;
2. configurare le tre variabili d'ambiente indicate sopra;
3. configurare in Supabase Auth il Site URL e i callback `/auth/callback` del proprio dominio;
4. eseguire i controlli di release;
5. pubblicare soltanto dopo una build riuscita.

```bash
npm test
npm run audit:icons
npm run build
```

## Sicurezza e privacy

- le tabelle applicative sono protette tramite RLS;
- l'accesso ai dati è vincolato alla membership dello spazio;
- gli spazi personali sono isolati tra utenti;
- gli spazi condivisi applicano ruoli e permessi server-side;
- le query dati sono filtrate per `space_id`;
- la repository non deve contenere dati finanziari, chiavi, email o configurazioni di istanze reali.

Prima di un utilizzo pubblico sono raccomandati backup, revisione delle policy, test con account separati e monitoraggio degli errori.

## Icone e attribuzioni

- le icone funzionali dell'interfaccia usano [Phosphor Icons](https://phosphoricons.com/);
- categorie e brand usano asset Icons8 Color salvati localmente in `public/icons/categories/` e `public/icons/brands/`;
- l’interfaccia e la navigazione usano Phosphor Icons;
- ogni identificatore non presente nel catalogo locale usa il fallback Phosphor Tag;
- nessuna API di icone viene chiamata a runtime;
- l’attribuzione Icons8 è mantenuta nel progetto e va rispettata secondo la licenza applicabile.

Verificare sempre i termini delle rispettive licenze prima di distribuire o modificare gli asset.

## Stato del progetto

**Versione corrente: V4.1.5 UX Consistency.**

Sono implementati multiutente, Spazi Privati e Condivisi, movimenti, categorie per tipo e spazio, Budget con rollover, ricorrenze, statistiche, Obiettivi di risparmio, import/export CSV, i18n e PWA.

### Roadmap

Le seguenti funzioni sono pianificate e **non sono disponibili nella release corrente**:

- **V4.2 / futura release:** Backup e portabilità guidata, sezione Privacy ed eliminazione sicura di account e dati nel rispetto degli spazi condivisi;
- Conti/Portafogli multipli;
- Debiti e crediti.

## Struttura essenziale

```text
app/                  pagine e Route Handler
components/           componenti UI condivisi
lib/                  logica applicativa e client Supabase
public/icons/         asset locali e branding
scripts/              verifiche statiche e audit
supabase/schema.sql   schema completo
supabase/migrations/  aggiornamenti incrementali
```

## Contributi

Issue e pull request sono benvenute. Prima di proporre una modifica:

1. mantenere la separazione dei dati per spazio;
2. non indebolire RLS o controlli server-side;
3. aggiungere o aggiornare i test statici pertinenti;
4. eseguire `npm test`, `npm run audit:icons` e `npm run build`.

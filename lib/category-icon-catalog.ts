export type IconCatalogEntry={
  id:string;label:string;englishLabel:string;asset:string;group:string;keywords:string[];brand?:boolean;
};
const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('it').trim();
const words=(value:string)=>normalize(value).split(/[^a-z0-9]+/).filter(Boolean);
const icon=(id:string,label:string,englishLabel:string,group:string,keywords:string):IconCatalogEntry=>({id,label,englishLabel,asset:`/icons/categories/${id}.png`,group,keywords:words(`${label} ${englishLabel} ${id} ${keywords}`)});
const brand=(id:string,label:string,file:string,keywords:string):IconCatalogEntry=>({id:`brand:${id}`,label,englishLabel:label,asset:`/icons/brands/${file}.png`,group:'Brand',brand:true,keywords:words(`${label} ${id} ${keywords}`)});

/** Qoomia V4.1.3: catalogo locale Icons8 Color PNG 96x96. */
export const categoryIconCatalog:IconCatalogEntry[]=[
  icon('grocery-store','Supermercato','Grocery store','Alimentazione','spesa alimentari alimentazione market'),
  icon('restaurant','Ristorante','Restaurant','Alimentazione','ristorante pranzo cena trattoria'),
  icon('coffee','Caffè e bar','Coffee','Alimentazione','bar caffe colazione'),
  icon('pizza','Pizza','Pizza','Alimentazione','pizza pizzeria'),
  icon('burger','Fast food','Burger','Alimentazione','hamburger panino fast food'),
  icon('food-delivery','Delivery','Food delivery','Alimentazione','consegna cibo delivery asporto'),
  icon('beer','Birra','Beer','Alimentazione','birra pub aperitivo'),
  icon('wine','Vino','Wine','Alimentazione','vino enoteca aperitivo'),
  icon('dessert','Dolci','Dessert','Alimentazione','dolce torta dessert pasticceria'),
  icon('food','Cibo','Food','Alimentazione','cibo alimentazione mangiare'),

  icon('car','Auto','Car','Mobilità','auto macchina automobile'),
  icon('gas-station','Benzina','Gas station','Mobilità','benzina diesel carburante gpl distributore'),
  icon('car-service','Manutenzione auto','Car service','Mobilità','officina tagliando manutenzione meccanico'),
  icon('parking','Parcheggio','Parking','Mobilità','parcheggio sosta garage'),
  icon('train','Treno','Train','Mobilità','treno ferrovia'),
  icon('bus','Autobus','Bus','Mobilità','bus autobus trasporto pubblico'),
  icon('scooter','Scooter','Scooter','Mobilità','scooter motorino'),
  icon('motorcycle','Moto','Motorcycle','Mobilità','moto motocicletta'),
  icon('bicycle','Bicicletta','Bicycle','Mobilità','bici bicicletta ciclismo'),
  icon('taxi','Taxi','Taxi','Mobilità','taxi ncc'),
  icon('airplane','Aereo','Airplane','Mobilità','aereo volo aeroporto'),
  icon('ship','Nave','Ship','Mobilità','nave traghetto crociera'),
  icon('road','Strada e pedaggi','Road','Mobilità','strada autostrada pedaggio telepass'),

  icon('house','Casa','House','Casa e utenze','casa abitazione domestica'),
  icon('rent','Affitto','Rent','Casa e utenze','affitto locazione canone mutuo'),
  icon('apartment','Condominio','Apartment','Casa e utenze','appartamento condominio'),
  icon('electricity','Elettricità','Electricity','Casa e utenze','luce corrente elettricita bolletta'),
  icon('gas','Gas','Gas bottle','Casa e utenze','gas utenza bombola'),
  icon('water','Acqua','Water','Casa e utenze','acqua utenza bolletta'),
  icon('internet','Internet','Internet','Casa e utenze','wifi fibra router connessione'),
  icon('phone','Telefono','Phone','Casa e utenze','telefono cellulare smartphone ricarica'),
  icon('home-maintenance','Manutenzione casa','Home maintenance','Casa e utenze','riparazione manutenzione lavori ristrutturazione'),
  icon('furniture','Arredamento','Furniture','Casa e utenze','mobili arredamento'),
  icon('appliances','Elettrodomestici','Appliances','Casa e utenze','elettrodomestici casa'),

  icon('health','Salute','Health','Salute','salute benessere'),
  icon('doctor','Medico','Medical doctor','Salute','medico dottore visita specialista'),
  icon('pharmacy','Farmacia','Pharmacy','Salute','farmacia medicine medicinali'),
  icon('hospital','Ospedale','Hospital','Salute','ospedale clinica pronto soccorso'),
  icon('dentist','Dentista','Dentist','Salute','dentista denti odontoiatra'),
  icon('laboratory','Analisi','Laboratory','Salute','laboratorio analisi sangue esami'),
  icon('pill','Farmaci','Pill','Salute','farmaci pillole medicine'),
  icon('physiotherapy','Fisioterapia','Physical therapy','Salute','fisioterapia riabilitazione'),

  icon('shopping','Shopping','Shopping bag','Shopping e tempo libero','shopping acquisti abbigliamento vestiti scarpe'),
  icon('gift','Regali','Gift','Shopping e tempo libero','regalo regali compleanno'),
  icon('cinema','Cinema','Cinema','Shopping e tempo libero','cinema film'),
  icon('music','Musica','Music','Shopping e tempo libero','musica concerto'),
  icon('football','Calcio','Football','Shopping e tempo libero','calcio pallone'),
  icon('sport','Sport','Sports','Shopping e tempo libero','sport attivita'),
  icon('gym','Palestra','Dumbbell','Shopping e tempo libero','palestra fitness allenamento'),
  icon('gaming','Videogiochi','Game controller','Shopping e tempo libero','gaming videogiochi console'),
  icon('books','Libri','Book','Shopping e tempo libero','libri cultura lettura'),
  icon('pets','Animali','Paw','Shopping e tempo libero','animali cane gatto veterinario'),

  icon('beach-umbrella','Mare','Beach umbrella','Viaggi e famiglia','mare spiaggia lido ombrellone balneare'),
  icon('beach','Spiaggia','Beach','Viaggi e famiglia','spiaggia mare'),
  icon('suitcase','Vacanze','Suitcase','Viaggi e famiglia','vacanza ferie valigia'),
  icon('hotel','Hotel','Hotel','Viaggi e famiglia','hotel albergo alloggio b&b'),
  icon('travel','Viaggi','Travel','Viaggi e famiglia','viaggio vacanza turismo'),
  icon('camping','Campeggio','Camping','Viaggi e famiglia','campeggio tenda'),
  icon('island','Isola','Island','Viaggi e famiglia','isola mare vacanza'),
  icon('luggage','Bagaglio','Luggage','Viaggi e famiglia','bagaglio valigia'),
  icon('family','Famiglia','Family','Viaggi e famiglia','famiglia parenti'),
  icon('child','Bambini','Baby','Viaggi e famiglia','figli bambini infanzia'),
  icon('wedding','Matrimonio','Wedding rings','Viaggi e famiglia','matrimonio nozze fedi wedding'),
  icon('couple','Coppia','Couple','Viaggi e famiglia','moglie marito compagna compagno coppia amore'),

  icon('salary','Stipendio','Paycheque','Entrate e finanza','stipendio salario retribuzione paga'),
  icon('income','Entrata','Income','Entrate e finanza','entrata reddito altra entrata'),
  icon('refund','Rimborso','Refund','Entrate e finanza','rimborso rimborsi'),
  icon('savings','Risparmio','Money box','Entrate e finanza','risparmio salvadanaio obiettivo'),
  icon('investment','Investimenti','Investment','Entrate e finanza','investimento azioni fondi rendita interessi dividendi'),
  icon('bonus','Bonus','Money bag','Entrate e finanza','bonus premio premi'),
  icon('pension','Pensione','Cash','Entrate e finanza','pensione'),
  icon('sales-income','Vendite','Cash in hand','Entrate e finanza','vendita vendite incasso'),
  icon('tax','Tasse','Tax','Entrate e finanza','tasse imposte tributi f24'),
  icon('payment','Pagamenti','Payment','Entrate e finanza','pagamento pagamenti'),
  icon('credit-card','Carta','Credit card','Entrate e finanza','carta credito debito bancomat'),
  icon('cash','Contanti','Cash','Entrate e finanza','contanti cash'),
  icon('wallet','Portafoglio','Wallet','Entrate e finanza','portafoglio conto'),
];

export const iconGroups=[...new Set(categoryIconCatalog.map(entry=>entry.group))];
export const brandCatalog:IconCatalogEntry[]=[
  brand('apple','Apple','apple','icloud iphone apple tv apple music'),
  brand('netflix','Netflix','netflix','streaming film serie'),
  brand('spotify','Spotify','spotify','musica streaming'),
  brand('amazon','Amazon','amazon','shopping prime'),
  brand('amazon-prime','Amazon Prime','amazon-prime','prime video streaming'),
  brand('disney','Disney+','disney','disney plus streaming'),
  brand('youtube','YouTube','youtube','video premium streaming'),
  brand('playstation','PlayStation','playstation','gaming console'),
  brand('xbox','Xbox','xbox','gaming console'),
  brand('google','Google','google','servizi cloud'),
  brand('paypal','PayPal','paypal','pagamenti finanza'),
];

const categoryIds=new Set(categoryIconCatalog.map(entry=>entry.id));
export const legacyIconAliases:Record<string,string>={
  'beach':'beach','umbrella-beach':'beach-umbrella','wedding-rings':'wedding','woman':'couple','wife':'couple','female':'couple',
  'cart':'grocery-store','shopping-cart':'grocery-store','cart-shopping':'grocery-store','food':'food','fork-knife':'restaurant','utensils':'restaurant',
  'mug-hot':'coffee','gas-pump':'gas-station','square-parking':'parking','plane':'airplane','airplane-take-off':'airplane',
  'bag':'shopping','bag-shopping':'shopping','handbag':'shopping','clapperboard':'cinema','film-slate':'cinema','movie':'cinema',
  'gamepad':'gaming','game-controller':'gaming','paw':'pets','paw-print':'pets','dumbbell':'gym','futbol':'football','soccer-ball':'football',
  'wallet':'wallet','bank':'wallet','building-columns':'wallet','refund':'refund','other-income':'income','store':'sales-income','piggy-bank':'savings',
  'money-bill-wave':'salary','money':'cash','money-bill':'cash','heart':'couple','users':'family','users-three':'family','baby':'child',
  'stethoscope':'doctor','pills':'pill','tooth':'dentist','receipt':'payment','repeat':'payment','tag':'tag'
};
export function normalizeIconId(id?:string|null){
  if(!id)return 'tag';
  if(id.startsWith('brand:'))return brandCatalog.some(entry=>entry.id===id)?id:'tag';
  const raw=id.startsWith('color:')?id.slice(6):id;
  const mapped=legacyIconAliases[raw]||raw;
  return categoryIds.has(mapped)?mapped:'tag';
}
export const allIconCatalog=[...categoryIconCatalog,...brandCatalog];
export function findIconEntry(id?:string|null){const normalized=normalizeIconId(id);return allIconCatalog.find(entry=>entry.id===normalized)}

const preferredSuggestions:[RegExp,string[]][]=[
  [/netflix/i,['brand:netflix']],[/spotify/i,['brand:spotify']],[/amazon prime/i,['brand:amazon-prime']],[/amazon/i,['brand:amazon']],
  [/apple|icloud/i,['brand:apple']],[/disney/i,['brand:disney']],[/youtube/i,['brand:youtube']],[/playstation/i,['brand:playstation']],[/xbox/i,['brand:xbox']],[/paypal/i,['brand:paypal']],
  [/mare|spiaggia|lido|ombrellone/i,['beach-umbrella','beach']],[/matrimonio|nozze|fedi/i,['wedding']],[/moglie|marito|compagna|compagno|coppia/i,['couple']],
  [/supermercato|spesa|alimentari/i,['grocery-store']],[/benzina|diesel|carburante|gpl/i,['gas-station']],[/manutenzione auto|officina|tagliando/i,['car-service']],
  [/ristorante|pranzo|cena/i,['restaurant']],[/bar|caffe|colazione/i,['coffee']],[/stipendio|salario/i,['salary']],[/pensione/i,['pension']],
  [/rimbor/i,['refund']],[/risparm/i,['savings']],[/investiment|interess|rendit/i,['investment']],[/regal/i,['gift']],
];
export function suggestIconsForCategory(name:string,limit=8){
  const clean=normalize(name);if(!clean)return [];
  const preferred=preferredSuggestions.filter(([rule])=>rule.test(clean)).flatMap(([,ids])=>ids);
  const tokens=words(clean);
  const scored=allIconCatalog.map(entry=>{
    const haystack=normalize(`${entry.label} ${entry.englishLabel} ${entry.id} ${entry.keywords.join(' ')}`);
    const score=tokens.reduce((total,token)=>total+(haystack.includes(token)?2:0)+(normalize(entry.label).startsWith(token)?4:0)+(entry.id.includes(token)?5:0),0);
    const index=preferred.indexOf(entry.id);
    return {entry,score:score+(index>=0?40-index:0)};
  }).filter(item=>item.score>0).sort((a,b)=>b.score-a.score||a.entry.label.localeCompare(b.entry.label,'it'));
  return scored.slice(0,limit).map(item=>item.entry);
}



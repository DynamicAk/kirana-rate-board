// Offline catalog-aware bilingual ranked search. No external search API.
const HINDI = {
  "dal":"दाल","daal":"दाल","toor":"तूर","tur":"तूर","arhar":"अरहर","moong":"मूंग","mung":"मूंग","masoor":"मसूर","urad":"उड़द","chana":"चना","chole":"छोले","rajma":"राजमा",
  "atta":"आटा","aata":"आटा","ata":"आटा","flour":"आटा","besan":"बेसन","maida":"मैदा","rice":"चावल","chawal":"चावल","sugar":"चीनी","chini":"चीनी","cheeni":"चीनी",
  "salt":"नमक","namak":"नमक","oil":"तेल","tel":"तेल","ghee":"घी","haldi":"हल्दी","turmeric":"हल्दी","mirch":"मिर्च","mirchi":"मिर्च","chilli":"मिर्च","chili":"मिर्च",
  "jeera":"जीरा","cumin":"जीरा","dhaniya":"धनिया","coriander":"धनिया","poha":"पोहा","suji":"सूजी","sooji":"सूजी","daliya":"दलिया","jaggery":"गुड़","gud":"गुड़",
  "badam":"बादाम","almond":"बादाम","kaju":"काजू","cashew":"काजू","kismis":"किशमिश","raisins":"किशमिश","sabudana":"साबूदाना","papad":"पापड़","ajwain":"अजवाइन",
  "wheat":"गेहूं","gram":"चना","black":"काला","red":"लाल","white":"सफेद","green":"हरा","yellow":"पीला","powder":"पाउडर","whole":"साबुत","mustard":"सरसों","sarson":"सरसों",
  "tea":"चाय","chai":"चाय","coffee":"कॉफी","soap":"साबुन","sabun":"साबुन","biscuit":"बिस्कुट","biscuits":"बिस्कुट","packet":"पैकेट"
};

function normalize(v){return String(v??"").toLowerCase().normalize("NFKC").replace(/[\u200c\u200d]/g,"").replace(/[०-९]/g,ch=>String(ch.charCodeAt(0)-0x966)).replace(/[^\p{L}\p{M}\p{N}]+/gu," ").trim().replace(/\s+/g," ");}
const GROUPS = [
  [
    "chilli",
    "chili",
    "mirch",
    "mirchi",
    "मिर्च",
    "मिर्ची",
    "चिली"
  ],
  [
    "turmeric",
    "haldi",
    "हल्दी",
    "टरमरिक"
  ],
  [
    "coriander",
    "dhaniya",
    "dhania",
    "धनिया"
  ],
  [
    "cumin",
    "jeera",
    "jira",
    "zeera",
    "जीरा"
  ],
  [
    "carom",
    "ajwain",
    "ajvain",
    "ajmain",
    "अजवाइन",
    "अजमाइन"
  ],
  [
    "nutmeg",
    "jaiphal",
    "jayphal",
    "जायफल"
  ],
  [
    "amchoor",
    "amchur",
    "आमचूर",
    "dry mango"
  ],
  [
    "bay leaf",
    "tej patta",
    "तेज पत्ता"
  ],
  [
    "sugar",
    "chini",
    "cheeni",
    "चीनी",
    "शुगर"
  ],
  [
    "jaggery",
    "gud",
    "gur",
    "गुड़",
    "गुड"
  ],
  [
    "atta",
    "aata",
    "आटा",
    "wheat flour"
  ],
  [
    "besan",
    "बेसन",
    "gram flour",
    "chickpea flour"
  ],
  [
    "maida",
    "मैदा",
    "refined flour"
  ],
  [
    "kuttu",
    "कुट्टू",
    "buckwheat"
  ],
  [
    "singhara",
    "singhada",
    "सिंघाड़ा",
    "water chestnut"
  ],
  [
    "suji",
    "sooji",
    "सूजी",
    "semolina"
  ],
  [
    "rice",
    "chawal",
    "चावल",
    "राइस"
  ],
  [
    "taj mahal",
    "taj",
    "ताज महल",
    "ताज"
  ],
  [
    "puffed rice",
    "murmure",
    "मुरमुरे"
  ],
  [
    "poha",
    "पोहा",
    "flattened rice"
  ],
  [
    "chuda",
    "chura",
    "चूड़ा"
  ],
  [
    "bajra",
    "बाजरा",
    "pearl millet"
  ],
  [
    "daliya",
    "dalia",
    "दलिया",
    "broken wheat"
  ],
  [
    "dal",
    "daal",
    "दाल",
    "lentil",
    "lentils"
  ],
  [
    "arhar",
    "toor",
    "tur",
    "तूर",
    "अरहर",
    "तुअर"
  ],
  [
    "moong",
    "mung",
    "मूंग",
    "मूँग"
  ],
  [
    "masoor",
    "malka",
    "मसूर",
    "मलका"
  ],
  [
    "urad",
    "udad",
    "उड़द",
    "उरद"
  ],
  [
    "chana",
    "चना",
    "gram"
  ],
  [
    "chhole",
    "chole",
    "छोले",
    "chickpeas"
  ],
  [
    "rajma",
    "राजमा",
    "kidney beans"
  ],
  [
    "oil",
    "tel",
    "तेल",
    "ऑयल"
  ],
  [
    "fortune",
    "फार्चून",
    "फॉर्च्यून"
  ],
  [
    "til",
    "teel",
    "तील",
    "तिल",
    "sesame"
  ],
  [
    "ghee",
    "घी",
    "ghi"
  ],
  [
    "dalda",
    "डालडा"
  ],
  [
    "rath",
    "रथ"
  ],
  [
    "gola",
    "गोला",
    "coconut",
    "नारियल"
  ],
  [
    "chhuhara",
    "chuhara",
    "छुहारा",
    "dry dates"
  ],
  [
    "kaju",
    "काजू",
    "cashew",
    "cashews"
  ],
  [
    "badam",
    "बादाम",
    "almond",
    "almonds"
  ],
  [
    "kismis",
    "kishmish",
    "किसमिस",
    "किशमिश",
    "raisins",
    "raisin"
  ],
  [
    "moongfali",
    "mungfali",
    "मूंगफली",
    "peanut",
    "peanuts"
  ],
  [
    "sabudana",
    "sabudane",
    "साबूदाना",
    "साबुदाने",
    "साबूदाने",
    "sago"
  ],
  [
    "vrat",
    "व्रत",
    "fasting"
  ],
  [
    "jhadu",
    "jhaadu",
    "झाड़ू",
    "broom"
  ],
  [
    "supari",
    "सुपारी",
    "betel nut"
  ],
  [
    "papad",
    "papadum",
    "पापड़",
    "पापड"
  ],
  [
    "chips",
    "चिप्स",
    "चीप्स"
  ],
  [
    "red",
    "lal",
    "लाल"
  ],
  [
    "black",
    "kala",
    "काला"
  ],
  [
    "white",
    "safed",
    "सफेद"
  ],
  [
    "green",
    "hara",
    "hari",
    "हरा",
    "हरी"
  ],
  [
    "yellow",
    "peela",
    "पीला"
  ],
  [
    "whole",
    "sabut",
    "साबुत"
  ],
  [
    "ground",
    "pisa",
    "pisi",
    "पीसा",
    "पिसी",
    "powder",
    "पाउडर"
  ],
  [
    "loose",
    "khula",
    "khulla",
    "खुला",
    "खुल्ला"
  ],
  [
    "packet",
    "pkt",
    "pack",
    "पैकेट"
  ],
  [
    "small",
    "chhota",
    "chota",
    "छोटा"
  ],
  [
    "large",
    "bada",
    "बड़ा"
  ],
  [
    "split",
    "dhuli",
    "धुली"
  ],
  [
    "aloo",
    "आलू",
    "potato"
  ],
  [
    "ajinomoto",
    "ajina moto",
    "आजीना मोटो",
    "अजीनोमोटो"
  ],
  [
    "soyabean",
    "soybean",
    "soya bean",
    "सोयाबीन"
  ],
  [
    "phenyl",
    "फिनाइल",
    "फिनायल"
  ],
  [
    "pasta",
    "पास्ता"
  ],
  [
    "macaroni",
    "मैकरोनी",
    "मकरोनी"
  ],
  [
    "mishri",
    "मिश्री",
    "rock sugar"
  ],
  [
    "bhura",
    "भूरा",
    "bura"
  ],
  [
    "batasha",
    "batasa",
    "बताशा",
    "बतासा"
  ],
  [
    "salt",
    "namak",
    "नमक"
  ],
  [
    "soap",
    "sabun",
    "साबुन"
  ],
  [
    "tea",
    "chai",
    "चाय"
  ]
];
export function suggestHindi(text) {
  const words=normalize(text).split(" ").filter(Boolean);
  if(!words.length)return "";
  // Unknown words are left unchanged for manual correction; never invent a translation.
  return words.map(w=>HINDI[w]||w).join(" ");
}

function romanize(v){
 const cons={"क":"k","ख":"kh","ग":"g","घ":"gh","ङ":"n","च":"ch","छ":"chh","ज":"j","झ":"jh","ञ":"n","ट":"t","ठ":"th","ड":"d","ढ":"dh","ण":"n","त":"t","थ":"th","द":"d","ध":"dh","न":"n","प":"p","फ":"ph","ब":"b","भ":"bh","म":"m","य":"y","र":"r","ल":"l","व":"v","श":"sh","ष":"sh","स":"s","ह":"h","ळ":"l"};
 const vowels={"अ":"a","आ":"a","इ":"i","ई":"i","उ":"u","ऊ":"u","ऋ":"ri","ए":"e","ऐ":"ai","ओ":"o","औ":"au","ऑ":"o","ऍ":"e"};
 const marks={"ा":"a","ि":"i","ी":"i","ु":"u","ू":"u","ृ":"ri","े":"e","ै":"ai","ो":"o","ौ":"au","ॉ":"o","ॅ":"e","्":""};
 return normalize(v).normalize("NFD").replace(/\u093c/g,"").split(" ").map(word=>{const chars=Array.from(word);let result="";for(let i=0;i<chars.length;i++){const ch=chars[i];if(cons[ch]){result+=cons[ch];if(Object.prototype.hasOwnProperty.call(marks,chars[i+1]))result+=marks[chars[++i]];else if(i<chars.length-1)result+="a";}else if(vowels[ch])result+=vowels[ch];else if(ch==="ं"||ch==="ँ")result+=/[पफबभम]/.test(chars[i+1]||"")?"m":"n";else if(ch==="ः")result+="h";else if(!/[\u0900-\u097f]/.test(ch))result+=ch;}return result;}).join(" ");
}

function sound(v){return romanize(v).replace(/aa/g,"a").replace(/ee/g,"i").replace(/oo/g,"u").replace(/chh/g,"ch").replace(/ph/g,"f").replace(/w/g,"v").replace(/(.)\1+/g,"$1");}

function distance(a,b){const x=Array.from(a),y=Array.from(b),rows=[Array.from({length:y.length+1},(_,i)=>i)];for(let i=1;i<=x.length;i++){const row=[i];for(let j=1;j<=y.length;j++){row[j]=Math.min(row[j-1]+1,rows[i-1][j]+1,rows[i-1][j-1]+(x[i-1]===y[j-1]?0:1));if(i>1&&j>1&&x[i-1]===y[j-2]&&x[i-2]===y[j-1])row[j]=Math.min(row[j],rows[i-2][j-2]+1);}rows.push(row);}return rows[x.length][y.length];}

function tokenScore(a,b){if(a===b)return 100;const x=sound(a),y=sound(b);if(!x||!y)return 0;if(x===y)return 94;if(/^\d/.test(a)||/^\d/.test(b))return 0;if(a.length>=2&&b.startsWith(a))return 83;if(x.length>=3&&y.startsWith(x))return 78;if(x.length<4||y.length<4)return 0;const max=Math.max(x.length,y.length),d=distance(x,y);return d<=(max>=7?2:1)&&1-d/max>=.72?70-d*5:0;}

function containsPhrase(text,phrase){return (" "+text+" ").includes(" "+phrase+" ");}

function buildIndex(item,rates=[]){
 const names=[...new Set([item.nameEn,item.nameHi,item.itemName].filter(Boolean).flatMap(v=>[normalize(v),...String(v).split(/[()]/).map(normalize)]).filter(Boolean))];
 const direct=new Set(names.flatMap(n=>n.split(" "))),aliases=new Set();
 for(const group of GROUPS)if(group.some(a=>names.some(n=>containsPhrase(n,a))))for(const a of group)aliases.add(a);
 const broad={"flour":["atta","aata","besan","maida","kuttu","singhara","आटा","बेसन","मैदा","कुट्टू","सिंघाड़ा"],"pulses":["dal","arhar","moong","urad","chana","rajma","chhole","malka","दाल","अरहर","मूंग","उड़द","चना","राजमा","छोले","मलका"],"lentils":["dal","arhar","moong","urad","chana","malka","दाल","अरहर","मूंग","उड़द","चना","मलका"],"oil":["fortune","फार्चून","20 20 gold","20 20 गोल्ड"]};
 for(const [term,members] of Object.entries(broad))if(names.some(n=>members.some(a=>containsPhrase(n,a))))aliases.add(term);
 return {names,direct:[...direct],aliases:[...aliases],aliasTokens:[...new Set([...aliases].flatMap(a=>a.split(" ")))],meta:normalize(item.category).split(" "),rateTerms:rates.flatMap(r=>[normalize(r.quantity),normalize(r.price)]).flatMap(t=>[t,...t.split(" ")]).filter(Boolean)};
}

function scoreIndex(index,query){const q=normalize(query);if(!q)return 1;if(index.names.includes(q))return 140;if(index.names.some(n=>containsPhrase(n,q)))return 130;if(index.aliases.includes(q))return 116;const words=q.split(" "),scores=words.map(w=>{let best=0;for(const t of index.direct)best=Math.max(best,tokenScore(w,t));for(const t of index.aliasTokens){const s=tokenScore(w,t);if(s)best=Math.max(best,s-12);}if(words.length===1||/^\d/.test(w))for(const t of [...index.meta,...index.rateTerms])if(w===t)best=Math.max(best,40);return best;});return scores.some(s=>!s)?0:scores.reduce((a,b)=>a+b,0)/scores.length;}

export function rankItems(items,query,ratesFor=()=>[]){const q=normalize(query);if(!q)return items.map(item=>({item,score:1}));return items.map((item,i)=>({item,i,score:scoreIndex(buildIndex(item,ratesFor(item)),q)})).filter(r=>r.score>0).sort((a,b)=>b.score-a.score||a.i-b.i);}

export function chooseTranscript(alternatives,items,ratesFor=()=>[],clean=x=>x){let best=null;for(const a of alternatives){const query=clean(a.transcript);if(!normalize(query))continue;const results=rankItems(items,query,ratesFor),score=results.length?results[0].score:0,quality=score+Math.min(1,Math.max(0,Number(a.confidence)||0))*3;if(!best||quality>best.quality)best={query,score,quality};}return best;}

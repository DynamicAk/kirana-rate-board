// Offline grocery-name suggestions and typo-tolerant search (no paid API).
import { SEARCH_SYNONYMS } from "./data/synonyms.js";
const HINDI = {
  "dal":"दाल","daal":"दाल","toor":"तूर","tur":"तूर","arhar":"अरहर","moong":"मूंग","mung":"मूंग","masoor":"मसूर","urad":"उड़द","chana":"चना","chole":"छोले","rajma":"राजमा",
  "atta":"आटा","aata":"आटा","ata":"आटा","flour":"आटा","besan":"बेसन","maida":"मैदा","rice":"चावल","chawal":"चावल","sugar":"चीनी","chini":"चीनी","cheeni":"चीनी",
  "salt":"नमक","namak":"नमक","oil":"तेल","tel":"तेल","ghee":"घी","haldi":"हल्दी","turmeric":"हल्दी","mirch":"मिर्च","mirchi":"मिर्च","chilli":"मिर्च","chili":"मिर्च",
  "jeera":"जीरा","cumin":"जीरा","dhaniya":"धनिया","coriander":"धनिया","poha":"पोहा","suji":"सूजी","sooji":"सूजी","daliya":"दलिया","jaggery":"गुड़","gud":"गुड़",
  "badam":"बादाम","almond":"बादाम","kaju":"काजू","cashew":"काजू","kismis":"किशमिश","raisins":"किशमिश","sabudana":"साबूदाना","papad":"पापड़","ajwain":"अजवाइन",
  "wheat":"गेहूं","gram":"चना","black":"काला","red":"लाल","white":"सफेद","green":"हरा","yellow":"पीला","powder":"पाउडर","whole":"साबुत","mustard":"सरसों","sarson":"सरसों",
  "tea":"चाय","chai":"चाय","coffee":"कॉफी","soap":"साबुन","sabun":"साबुन","biscuit":"बिस्कुट","biscuits":"बिस्कुट","packet":"पैकेट"
};
const normalize = v => String(v||"").toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{M}\p{N}]+/gu," ").trim();
const roman = s => normalize(s).replace(/aa/g,"a").replace(/ee/g,"i").replace(/oo/g,"u");
export function suggestHindi(text) {
  const words=normalize(text).split(" ").filter(Boolean);
  if(!words.length)return "";
  // Unknown words are left unchanged for manual correction; never invent a translation.
  return words.map(w=>HINDI[w]||w).join(" ");
}
function distance(a,b,limit=2) {
  if(Math.abs(a.length-b.length)>limit)return limit+1;
  let prev=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){
    const row=[i];let min=i;
    for(let j=1;j<=b.length;j++){row[j]=Math.min(row[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));min=Math.min(min,row[j]);}
    if(min>limit)return limit+1;prev=row;
  }
  return prev[b.length];
}
export function matchesItem(item, query, rates) {
  const q=normalize(query);if(!q)return true;
  const names=[item.itemName,item.nameEn,item.nameHi,item.category,...rates.flatMap(r=>[r.quantity,String(r.price)])].filter(Boolean);
  const terms=new Set(names.flatMap(v=>[normalize(v),...normalize(v).split(" ")]));
  for(const [key,values] of Object.entries(SEARCH_SYNONYMS)){
    const group=[key,...values].map(normalize);
    if(group.some(x=>x&&names.some(n=>normalize(n).includes(x))))group.forEach(x=>terms.add(x));
  }
  for(const [key,value] of Object.entries(HINDI)){
    if(names.some(n=>normalize(n).includes(normalize(value))))terms.add(key);
  }
  if([...terms].some(t=>t.includes(q)||q.includes(t)&&t.length>=3))return true;
  const words=q.split(" ");
  return words.every(word=>{
    if(word.length<3)return false;
    const limit=word.length>=7?2:1;
    return [...terms].some(t=>t.split(" ").some(w=>w.length>=3&&distance(roman(word),roman(w),limit)<=limit));
  });
}

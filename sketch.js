const DATA_URL   = "data/volcanoes-2025-10-27 - Es.3 - Original Data.csv"; // collego il csv
const LEGEND_FILL = "#ff3b30";   // colore fisso rosso per le icone nella legenda
const SYMBOL_SIZE = 100;          // grandezza simboli (area)

/*PRENDO LE PARTI DI CSV CHE MI SERVONO*/
const mapWrap   = document.getElementById("mapWrap"); // contenitore della mappa a destra
const svg       = document.getElementById("map");     // svg dove metto i punti dei vulcani
const tooltip   = document.getElementById("tooltip"); // nuvoletta con info
const elevRange = document.getElementById("elevRange");// slider per il filtro
const elevOut   = document.getElementById("elevOut");  // numerino sotto lo slider

/*VARIABILI CHE CAMBIANO*/
let data = [];
let width = 0, height = 0;

const fmt = v => (v == null || isNaN(v)) ? "—" : `${Math.round(v)} m`;

/* converto longitudine/latitudine in coordinate x,y dentro il mio svg, che sennò non lo carica bene */
function lonLatToXY(lon, lat){
  const x = (lon + 180) / 360 * width;
  const y = (90 - lat) / 180 * height;
  return [x, y];
}

function resizeAndRedraw(){
  const r = mapWrap.getBoundingClientRect();
  width  = Math.max(1, r.width);
  height = Math.max(1, r.height);
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  drawPoints();
}
window.addEventListener("resize", resizeAndRedraw);
window.addEventListener("load",   resizeAndRedraw);

/* aggiorno la scheda info a sinistra con i campi del vulcano corrente
   se non ho i dati metto dei trattini, perchè alcuni campi sono vuoti */
function setInfoCard(v){
  document.getElementById("v-num").textContent     = v?.["Volcano Number"] ?? "—";
  document.getElementById("v-country").textContent = v?.Country ?? "—";
  document.getElementById("v-type").textContent    = v?.Type ?? (v?.["TypeCategory"] ?? "—");
  document.getElementById("v-status").textContent  = v?.Status ?? "—";
  document.getElementById("v-elev").textContent    = fmt(v?.["Elevation (m)"]);
  document.getElementById("v-last").textContent    = v?.["Last Known Eruption"] ?? "—";
}

/*CATEGORIE
  trasformo il testo che arriva dal csv
  in uno dei nomi che voglio vedere in legenda
*/
function normalizeCategory(typeCategory, type){
  const s = (typeCategory || type || "Other / Unknown").toString().trim().toLowerCase();
  if (s.includes("stratovol")) return "Stratovolcano";
  if (s.includes("shield"))    return "Shield Volcano";
  if (s.includes("caldera"))   return "Caldera";
  if (s.includes("lava dome")) return "Lava dome";
  if (s.includes("field"))     return "Volcanic field";
  if (s.includes("crater"))    return "Crater System";
  if (s.includes("submarine")) return "Submarine volcano";
  if (s.includes("cone"))      return "Cone";
  return "Other / Unknown";
}

/* FORME (me ne serve una diversa per ogni categoria)*/
const SHAPE_GENERATORS = [
  () => d3.symbol().type(d3.symbolTriangle).size(SYMBOL_SIZE)(),
  () => d3.symbol().type(d3.symbolSquare).size(SYMBOL_SIZE)(),
  () => d3.symbol().type(d3.symbolStar).size(SYMBOL_SIZE)(),
  () => d3.symbol().type(d3.symbolDiamond).size(SYMBOL_SIZE)(),
  () => d3.symbol().type(d3.symbolWye).size(SYMBOL_SIZE)(),
  () => d3.symbol().type(d3.symbolCross).size(SYMBOL_SIZE)(),
  () => d3.symbol().type(d3.symbolCircle).size(SYMBOL_SIZE)()
];
let SHAPE_PATH = {};
function pathForCategory(cat){
  const f = SHAPE_PATH[cat] || SHAPE_PATH["Other / Unknown"];
  return f();
}

/*COLORI PER ALTEZZA (le icone della mappa rispecchiano il colore assegnato alla loro altitudine)*/
function lerpColorHex(h1,h2,t){
  const a=[1,3,5].map(i=>parseInt(h1.substr(i,2),16));
  const b=[1,3,5].map(i=>parseInt(h2.substr(i,2),16));
  const c=a.map((v,i)=>Math.round(v+(b[i]-v)*t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
function colorForElevation(elev, min, max){
  const t = Math.max(0, Math.min(1, (elev - min) / (max - min)));
  // prima metà: da nero a rosso, seconda metà: da rosso a rosino
  return (t<=0.5) ? lerpColorHex("#1a1a1a","#ff0000", t/0.5)
                  : lerpColorHex("#ff0000","#ff9d98",(t-0.5)/0.5);
}


function drawPoints(){
  svg.innerHTML = "";

  const thr = +elevRange.value;
  const min = +elevRange.min;
  const max = +elevRange.max;

  const filtered = data.filter(d => thr===0 ? true : (thr>0 ? d.elev>=thr : d.elev<=thr));

  filtered.forEach(d=>{
    const [x,y] = lonLatToXY(d.lon,d.lat);
    if (!isFinite(x) || !isFinite(y)) return;

    const p = document.createElementNS("http://www.w3.org/2000/svg","path");
    p.setAttribute("class","path-dot");
    p.setAttribute("d", pathForCategory(d.cat));
    p.setAttribute("transform", `translate(${x},${y})`);
    p.style.fill = colorForElevation(d.elev, min, max); //il fill lo metto come style inline, così il css non lo rovina
    p.setAttribute("stroke","#1f1b2a");
    p.setAttribute("stroke-width","1.2");

    // tooltip e aggiornamento scheda info
    p.addEventListener("mousemove",(ev)=>{
      tooltip.hidden=false;
      tooltip.style.left=ev.clientX+"px";
      tooltip.style.top =ev.clientY+"px";
      tooltip.innerHTML = `<strong>${d.name}</strong><br>${d.country} — ${fmt(d.elev)}<br>${d.cat}`;
      setInfoCard(d.raw);
      svg.appendChild(p);
    });
    p.addEventListener("mouseleave",()=> tooltip.hidden=true);

    svg.appendChild(p);
  });

  // aggiornoil numerino sotto allo slider
  const v = +elevRange.value;
  elevOut.textContent = (v>0?"+":"") + v + " m";
}

/*LEGENDA (metto una icona per ogni categoria che ho trovato)*/
function buildLegend(cats){
  const ul = document.getElementById("legend");
  ul.innerHTML = "";
  cats.forEach(cat=>{
    const li = document.createElement("li");
    li.className="legend-item";

    const sw = document.createElementNS("http://www.w3.org/2000/svg","svg");
    sw.setAttribute("class","legend-swatch");
    sw.setAttribute("viewBox","0 0 22 22");

    const g = document.createElementNS("http://www.w3.org/2000/svg","g");
    g.setAttribute("transform","translate(11,11)");

    const path = document.createElementNS("http://www.w3.org/2000/svg","path");
    path.setAttribute("d", pathForCategory(cat));
    path.style.fill = LEGEND_FILL;
    path.setAttribute("stroke","#1f1b2a");
    path.setAttribute("stroke-width","1.1");

    g.appendChild(path);
    sw.appendChild(g);

    const label = document.createElement("span");
    label.textContent = cat;

    li.appendChild(sw);
    li.appendChild(label);
    ul.appendChild(li);
  });
}

/********* SLIDER (quando muovo lo slider ridisegno i punti e aggiorno il numero)*/
function bindSlider(){
  elevRange.addEventListener("input", drawPoints);
  drawPoints();
}

d3.csv(DATA_URL, d3.autoType).then(rows=>{
  data = rows
    .filter(r => r.Latitude!=null && r.Longitude!=null)
    .map((r,i)=>({
      raw:r,
      id: r["Volcano Number"] ?? i,
      name: r["Volcano Name"] ?? "Unknown",
      country: r.Country ?? "",
      lat: +r.Latitude,
      lon: +r.Longitude,
      elev: Number.isFinite(+r["Elevation (m)"]) ? +r["Elevation (m)"] : 0,
      cat:  normalizeCategory(r["TypeCategory"], r["Type"])
    }));

  // prendo le categorie uniche e assegno una forma diversa a ognuna
  const cats = Array.from(new Set(data.map(d=>d.cat)));
  SHAPE_PATH = {};
  cats.forEach((c,i)=> SHAPE_PATH[c] = SHAPE_GENERATORS[i % SHAPE_GENERATORS.length]);

  buildLegend(cats);
  setInfoCard({});
  resizeAndRedraw();
  bindSlider();
}).catch(err=>{
  console.error("Errore nel caricamento CSV:", err);
  alert("Non riesco a leggere il CSV. Controlla il percorso in sketch.js (DATA_URL) e apri con un server (es. http://localhost).");
});

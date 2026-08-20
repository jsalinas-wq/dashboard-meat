// Dashboard rendering logic. Unlike the original single-file build, DATA/GOALS are no
// longer embedded at build time — they're fetched live (see boot.js) and handed to
// DashboardApp.boot() once the user is authenticated. Everything below this line is
// otherwise unchanged from the original app.js.
window.DashboardApp = (function () {
  "use strict";

  // Everything the dashboard needs to render lives inside boot(): the original app.js
  // ran all of this immediately at script-parse time, reading DATA/GOALS from two
  // <script> JSON blocks that were baked into the page at build time. Now DATA/GOALS
  // arrive asynchronously (fetched live from the Netlify function), so the exact same
  // code just runs once boot() is called with them, instead of at parse time.
  function boot(DATA, GOALS) {
  var MONTHS = DATA.months; // ['2026-01', ...]
  var MONTH_LABELS = { "01":"Ene","02":"Feb","03":"Mar","04":"Abr","05":"May","06":"Jun","07":"Jul","08":"Ago","09":"Sep","10":"Oct","11":"Nov","12":"Dic" };
  function monthLabel(mk) { return MONTH_LABELS[mk.split("-")[1]] || mk; }

  var PLATFORM_ORDER = ["Facebook","Instagram","LinkedIn","TikTok","X","YouTube"];
  var PLATFORM_COLOR_VAR = { "Facebook":"--series-1","Instagram":"--series-2","LinkedIn":"--series-3","TikTok":"--series-4","X":"--series-5","YouTube":"--series-6" };
  var CONTENT_ORDER = ["Imagen","Video","Reel","Carrusel","Enlace/Texto","Otro","Sin dato"];
  var CONTENT_COLOR_VAR = { "Imagen":"--series-1","Video":"--series-2","Reel":"--series-3","Carrusel":"--series-4","Enlace/Texto":"--series-5","Otro":"--series-6","Sin dato":"--series-7" };

  var root = document.querySelector(".viz-root");
  function cssVar(name) { return getComputedStyle(root).getPropertyValue(name).trim(); }

  function fmtCompact(n) {
    if (n === null || n === undefined || isNaN(n)) return "—";
    var sign = n < 0 ? "-" : ""; n = Math.abs(n);
    if (n >= 1e6) return sign + (n/1e6).toFixed(n>=1e7?0:1) + "M";
    if (n >= 1e3) return sign + (n/1e3).toFixed(n>=1e4?0:1) + "K";
    return sign + Math.round(n).toLocaleString("es-CL");
  }
  function fmtPct(x, dec) {
    if (x === null || x === undefined || isNaN(x)) return "—";
    return (x*100).toFixed(dec===undefined?2:dec) + "%";
  }
  function fmtInt(n) {
    if (n === null || n === undefined || isNaN(n)) return "—";
    return Math.round(n).toLocaleString("es-CL");
  }

  // ---------- state ----------
  var state = { brand: null, activePlatforms: new Set(), view: "detail" };
  var lastTables = {}; // target -> html string
  var chartMode = {}; // target -> 'chart' | 'table'

  var brands = DATA.brands.slice().sort(function(a,b){ return a.localeCompare(b, "es"); });
  state.brand = brands[0];

  function rowsForBrand(brand) {
    return DATA.monthly.filter(function(r){ return r.marca === brand; });
  }
  function platformsForBrand(brand) {
    var set = new Set(rowsForBrand(brand).map(function(r){ return r.plataforma_norm; }));
    return PLATFORM_ORDER.filter(function(p){ return set.has(p); });
  }

  // ---------- populate controls ----------
  var brandSelect = document.getElementById("brandSelect");
  brands.forEach(function(b){
    var opt = document.createElement("option");
    opt.value = b; opt.textContent = b;
    brandSelect.appendChild(opt);
  });
  brandSelect.value = state.brand;
  brandSelect.addEventListener("change", function(){
    state.brand = brandSelect.value;
    state.activePlatforms = new Set(platformsForBrand(state.brand));
    renderPlatformChips();
    renderAll();
  });

  function renderPlatformChips() {
    var el = document.getElementById("platformChips");
    el.innerHTML = "";
    var plats = platformsForBrand(state.brand);
    var allChip = makeChip("Todas", state.activePlatforms.size === plats.length, null);
    allChip.addEventListener("click", function(){
      state.activePlatforms = new Set(plats);
      renderPlatformChips(); renderAll();
    });
    el.appendChild(allChip);
    plats.forEach(function(p){
      var active = state.activePlatforms.has(p);
      var chip = makeChip(p, active, cssVar(PLATFORM_COLOR_VAR[p]));
      chip.addEventListener("click", function(){
        if (state.activePlatforms.has(p)) { state.activePlatforms.delete(p); }
        else { state.activePlatforms.add(p); }
        if (state.activePlatforms.size === 0) state.activePlatforms = new Set(plats);
        renderPlatformChips(); renderAll();
      });
      el.appendChild(chip);
    });
  }
  function makeChip(label, active, color) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "chip";
    b.dataset.active = active ? "1" : "0";
    if (color) {
      var dot = document.createElement("span");
      dot.style.display = "inline-block"; dot.style.width = "8px"; dot.style.height = "8px";
      dot.style.borderRadius = "999px"; dot.style.background = color; dot.style.marginRight = "6px";
      dot.style.verticalAlign = "middle";
      b.appendChild(dot);
    }
    b.appendChild(document.createTextNode(label));
    if (active) { b.style.background = "var(--text-primary)"; b.style.color = "var(--surface-1)"; b.style.borderColor = "var(--text-primary)"; }
    return b;
  }

  document.getElementById("viewDetailBtn").addEventListener("click", function(){
    state.view = "detail";
    document.getElementById("detailView").style.display = "";
    document.getElementById("compareView").style.display = "none";
    document.getElementById("viewDetailBtn").dataset.active = "1";
    document.getElementById("viewCompareBtn").dataset.active = "0";
    styleViewToggle();
  });
  document.getElementById("viewCompareBtn").addEventListener("click", function(){
    state.view = "compare";
    document.getElementById("detailView").style.display = "none";
    document.getElementById("compareView").style.display = "";
    document.getElementById("viewDetailBtn").dataset.active = "0";
    document.getElementById("viewCompareBtn").dataset.active = "1";
    styleViewToggle();
    renderCompare();
  });
  function styleViewToggle() {
    ["viewDetailBtn","viewCompareBtn"].forEach(function(id){
      var b = document.getElementById(id);
      if (b.dataset.active === "1") { b.style.background = "var(--text-primary)"; b.style.color = "var(--surface-1)"; }
      else { b.style.background = ""; b.style.color = ""; }
    });
  }

  document.getElementById("metasAnnualBtn").addEventListener("click", function(){
    metasView = "annual";
    document.getElementById("metasAnnualBtn").dataset.active = "1";
    document.getElementById("metasMonthlyBtn").dataset.active = "0";
    styleMetasToggle();
    renderMetas();
  });
  document.getElementById("metasMonthlyBtn").addEventListener("click", function(){
    metasView = "monthly";
    document.getElementById("metasAnnualBtn").dataset.active = "0";
    document.getElementById("metasMonthlyBtn").dataset.active = "1";
    styleMetasToggle();
    renderMetas();
  });
  function styleMetasToggle() {
    ["metasAnnualBtn","metasMonthlyBtn"].forEach(function(id){
      var b = document.getElementById(id);
      if (b.dataset.active === "1") { b.style.background = "var(--text-primary)"; b.style.color = "var(--surface-1)"; }
      else { b.style.background = ""; b.style.color = ""; }
    });
  }

  var themeBtn = document.getElementById("themeToggle");
  var themeState = "auto";
  themeBtn.addEventListener("click", function(){
    if (themeState === "auto") { themeState = "dark"; document.documentElement.setAttribute("data-theme","dark"); themeBtn.textContent = "Modo claro"; }
    else if (themeState === "dark") { themeState = "light"; document.documentElement.setAttribute("data-theme","light"); themeBtn.textContent = "Automático"; }
    else { themeState = "auto"; document.documentElement.removeAttribute("data-theme"); themeBtn.textContent = "Modo oscuro"; }
    renderAll();
    if (state.view === "compare") renderCompare();
  });

  // ---------- tooltip ----------
  var tooltipEl = document.getElementById("tooltip");
  function showTooltip(x, y, html) {
    tooltipEl.innerHTML = html;
    tooltipEl.style.left = (x + 12) + "px";
    tooltipEl.style.top = Math.max(4, y - 10) + "px";
    tooltipEl.style.opacity = "1";
  }
  function hideTooltip() { tooltipEl.style.opacity = "0"; }

  // ---------- KPI row ----------
  // Alcance y engagement rate se reportan siempre como PROMEDIO por publicación
  // (promedio ponderado por cantidad de publicaciones con dato), nunca como suma.
  function computeTotals(brand, platforms) {
    var rows = rowsForBrand(brand).filter(function(r){ return platforms.has(r.plataforma_norm); });
    var totals = { alcanceSum:0, alcanceN:0, interacciones:0, posts:0, nuevos:0, nuevosCount:0, erSum:0, erN:0 };
    rows.forEach(function(r){
      if (r.alcance_avg !== null && r.alcance_avg !== undefined && r.alcance_n) { totals.alcanceSum += r.alcance_avg * r.alcance_n; totals.alcanceN += r.alcance_n; }
      if (r.er_avg !== null && r.er_avg !== undefined && r.er_n) { totals.erSum += r.er_avg * r.er_n; totals.erN += r.er_n; }
      totals.interacciones += r.interacciones || 0;
      totals.posts += r.posts || 0;
      if (r.nuevos_seguidores !== null && r.nuevos_seguidores !== undefined) { totals.nuevos += r.nuevos_seguidores; totals.nuevosCount++; }
    });
    totals.alcance = totals.alcanceN > 0 ? totals.alcanceSum / totals.alcanceN : null;
    totals.er = totals.erN > 0 ? totals.erSum / totals.erN : null;
    return totals;
  }

  function halfSplit(brand, platforms) {
    // compare first half of available months vs second half, for a simple trend delta (promedio simple mensual)
    var rows = rowsForBrand(brand).filter(function(r){ return platforms.has(r.plataforma_norm); });
    var byMonth = {};
    rows.forEach(function(r){
      byMonth[r.mes_key] = byMonth[r.mes_key] || { sum:0, n:0 };
      if (r.alcance_avg !== null && r.alcance_avg !== undefined && r.alcance_n) { byMonth[r.mes_key].sum += r.alcance_avg * r.alcance_n; byMonth[r.mes_key].n += r.alcance_n; }
    });
    var months = Object.keys(byMonth).sort();
    if (months.length < 2) return null;
    var mid = Math.ceil(months.length/2);
    var firstMonths = months.slice(0, mid), secondMonths = months.slice(mid);
    function avgAlc(list) {
      var sum=0, n=0;
      list.forEach(function(m){ sum += byMonth[m].sum; n += byMonth[m].n; });
      return n>0 ? sum/n : null;
    }
    return { prevAvg: avgAlc(firstMonths), lastAvg: avgAlc(secondMonths.length?secondMonths:firstMonths) };
  }

  function renderKPIs() {
    var totals = computeTotals(state.brand, state.activePlatforms);
    var trend = halfSplit(state.brand, state.activePlatforms);
    var deltaHtml = "";
    if (trend && trend.prevAvg > 0) {
      var pct = (trend.lastAvg - trend.prevAvg) / trend.prevAvg * 100;
      var cls = Math.abs(pct) < 3 ? "flat" : (pct > 0 ? "up" : "down");
      var arrow = cls === "up" ? "▲" : (cls === "down" ? "▼" : "→");
      deltaHtml = '<div class="delta ' + cls + '">' + arrow + " " + Math.abs(pct).toFixed(0) + "% alcance promedio, primera vs segunda mitad del periodo</div>";
    }
    var items = [
      { label: "Alcance promedio / publicación", value: fmtCompact(totals.alcance) },
      { label: "Interacciones totales", value: fmtCompact(totals.interacciones) },
      { label: "Engagement rate promedio", value: fmtPct(totals.er) },
      { label: "Publicaciones", value: fmtInt(totals.posts) },
      { label: "Nuevos seguidores", value: totals.nuevosCount > 0 ? fmtCompact(totals.nuevos) : "Sin dato" }
    ];
    var el = document.getElementById("kpiRow");
    el.innerHTML = items.map(function(it, i){
      return '<div class="kpi"><div class="label">' + it.label + '</div><div class="value">' + it.value + '</div>' + (i===0?deltaHtml:'') + '</div>';
    }).join("");
  }

  // ---------- small-multiple line chart (per platform) ----------
  function seriesForMetric(brand, platform, metric) {
    var rows = rowsForBrand(brand).filter(function(r){ return r.plataforma_norm === platform; });
    var byMonth = {};
    rows.forEach(function(r){ byMonth[r.mes_key] = r; });
    return MONTHS.map(function(mk){
      var r = byMonth[mk];
      if (!r) return null;
      if (metric === "er") return r.er_avg;
      if (metric === "alcance") return r.alcance_avg;
      return r[metric];
    });
  }

  function buildMiniLineSVG(values, color, formatter, elWidth, milestones) {
    var w = elWidth || 320, h = 150, padL = 40, padR = 14, padT = 22, padB = 22;
    var plotW = w - padL - padR, plotH = h - padT - padB;
    var nums = values.filter(function(v){ return v !== null && v !== undefined && !isNaN(v); });
    var maxV = nums.length ? Math.max.apply(null, nums) : 1;
    var minV = 0;
    maxV = maxV <= 0 ? 1 : maxV * 1.18;
    function xAt(i) { return padL + (values.length===1 ? plotW/2 : (plotW * i / (values.length - 1))); }
    function yAt(v) { return padT + plotH - ((v - minV) / (maxV - minV)) * plotH; }

    var gridLines = "";
    var ticks = 3;
    for (var t=0;t<=ticks;t++) {
      var val = maxV * t / ticks;
      var y = yAt(val);
      gridLines += '<line x1="'+padL+'" x2="'+(w-padR)+'" y1="'+y+'" y2="'+y+'" stroke="var(--gridline)" stroke-width="1"/>';
      gridLines += '<text x="'+(padL-6)+'" y="'+(y+3)+'" text-anchor="end" font-size="9.5" fill="var(--text-muted)">'+fmtCompact(val)+'</text>';
    }

    var pathPts = [];
    values.forEach(function(v, i){ if (v !== null && v !== undefined && !isNaN(v)) pathPts.push(xAt(i) + "," + yAt(v)); });
    var pathD = pathPts.length ? "M" + pathPts.join(" L") : "";

    var dots = "", hitareas = "";
    values.forEach(function(v, i){
      if (v === null || v === undefined || isNaN(v)) return;
      var cx = xAt(i), cy = yAt(v);
      var isLast = (i === values.length - 1) || (values.slice(i+1).every(function(x){return x===null||x===undefined;}));
      dots += '<circle cx="'+cx+'" cy="'+cy+'" r="'+(isLast?4.5:3)+'" fill="'+color+'" stroke="var(--surface-1)" stroke-width="2"/>';
      hitareas += '<circle class="hitpt" data-i="'+i+'" data-v="'+v+'" cx="'+cx+'" cy="'+cy+'" r="14" fill="transparent"/>';
    });

    var xLabels = "";
    values.forEach(function(v, i){
      if (i % Math.ceil(values.length/7) !== 0 && i !== values.length-1) return;
      xLabels += '<text x="'+xAt(i)+'" y="'+(h-6)+'" text-anchor="middle" font-size="10" fill="var(--text-muted)">'+monthLabel(MONTHS[i])+'</text>';
    });

    var milestoneMark = "";
    (milestones || []).forEach(function(m, mi){
      var idx = m.index;
      if (values[idx] === null || values[idx] === undefined) return;
      var mx = xAt(idx), my = yAt(values[idx]) - 12;
      milestoneMark += '<rect class="hitmilestone" x="'+(mx-4.5)+'" y="'+(my-4.5)+'" width="9" height="9" fill="var(--text-primary)" stroke="var(--surface-1)" stroke-width="1.5" transform="rotate(45 '+mx+' '+my+')" style="cursor:pointer;"/>';
      milestoneMark += '<circle class="hitmilestone-target" data-mi="'+mi+'" cx="'+mx+'" cy="'+my+'" r="12" fill="transparent" style="cursor:pointer;"/>';
    });

    var svg = '<svg viewBox="0 0 '+w+' '+h+'" width="100%" height="'+h+'" preserveAspectRatio="xMidYMid meet">' +
      gridLines +
      (pathD ? '<path d="'+pathD+'" fill="none" stroke="'+color+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' : '') +
      dots + xLabels + hitareas + milestoneMark +
      '</svg>';
    return svg;
  }

  function attachMilestoneHover(svgEl, milestones, metricLabel, metricField, metricFmt) {
    if (!milestones || !milestones.length) return;
    var targets = svgEl.querySelectorAll(".hitmilestone-target");
    targets.forEach(function(target, i){
      var m = milestones[i];
      if (!m || !m.post) return;
      var post = m.post;
      target.addEventListener("mousemove", function(e){
        showTooltip(e.clientX, e.clientY,
          '<div class="row"><strong>Hito · publicación destacada por ' + metricLabel + '</strong></div>' +
          '<div class="row"><span>' + (post.tipo||"Publicación") + ' · ' + post.fecha + '</span></div>' +
          '<div class="row"><span>' + metricLabel.charAt(0).toUpperCase()+metricLabel.slice(1) + '</span><strong>&nbsp;' + metricFmt(post[metricField]) + '</strong></div>' +
          (post.link && /^https?:\/\//i.test(post.link) ? '<div class="row"><span style="color:var(--series-1)">Click para abrir el post</span></div>' : ''));
      });
      target.addEventListener("mouseleave", hideTooltip);
      if (post.link && /^https?:\/\//i.test(post.link)) {
        target.addEventListener("click", function(){ window.open(post.link, "_blank", "noopener,noreferrer"); });
      }
    });
  }

  function bestPostOverall(brand, platform, field) {
    field = field || "alcance";
    var posts = (DATA.posts || []).filter(function(p){ return p.marca === brand && p.plataforma === platform && p[field] !== null && p[field] !== undefined; });
    if (!posts.length) return null;
    posts = posts.slice().sort(function(a,b){ return b[field] - a[field]; });
    return posts[0];
  }
  function bestPostInMonth(brand, platform, month, field) {
    field = field || "alcance";
    var posts = (DATA.posts || []).filter(function(p){ return p.marca === brand && p.plataforma === platform && p.fecha && p.fecha.slice(0,7) === month && p[field] !== null && p[field] !== undefined; });
    if (!posts.length) return null;
    posts = posts.slice().sort(function(a,b){ return b[field] - a[field]; });
    return posts[0];
  }

  // Detects local-maximum "peak" months in a monthly series: a month strictly higher
  // than its immediate neighbors and at least PEAK_FACTOR times the series average.
  // Caps the result to maxCount peaks (keeping the largest ones) so charts stay legible.
  var PEAK_FACTOR = 1.3;
  function findPeakIndices(values, maxCount) {
    maxCount = maxCount || 4;
    var nums = values.filter(function(v){ return v !== null && v !== undefined && !isNaN(v); });
    if (nums.length < 2) return [];
    var avg = nums.reduce(function(a,b){ return a + b; }, 0) / nums.length;
    var threshold = avg * PEAK_FACTOR;
    var peaks = [];
    for (var i = 0; i < values.length; i++) {
      var v = values[i];
      if (v === null || v === undefined || isNaN(v) || v <= 0) continue;
      var prev = i > 0 ? values[i-1] : null;
      var next = i < values.length - 1 ? values[i+1] : null;
      var higherThanPrev = (prev === null || prev === undefined || isNaN(prev)) || v > prev;
      var higherThanNext = (next === null || next === undefined || isNaN(next)) || v > next;
      if (higherThanPrev && higherThanNext && v >= threshold) peaks.push({ index: i, value: v });
    }
    peaks.sort(function(a,b){ return b.value - a.value; });
    peaks = peaks.slice(0, maxCount);
    peaks.sort(function(a,b){ return a.index - b.index; });
    return peaks;
  }

  function milestonesForSeries(brand, platform, values, field) {
    var peaks = findPeakIndices(values, 4);
    return peaks.map(function(pk){
      var month = MONTHS[pk.index];
      var post = bestPostInMonth(brand, platform, month, field);
      return post ? { index: pk.index, post: post } : null;
    }).filter(Boolean);
  }

  function attachHover(svgEl, values, formatter, label, color) {
    var pts = svgEl.querySelectorAll(".hitpt");
    pts.forEach(function(pt){
      pt.addEventListener("mousemove", function(e){
        var i = +pt.dataset.i, v = +pt.dataset.v;
        var rect = svgEl.getBoundingClientRect();
        showTooltip(e.clientX, e.clientY,
          '<div class="row"><span><span class="key" style="background:'+color+'"></span>'+label+'</span></div>' +
          '<div class="row"><span>'+monthLabel(MONTHS[i])+'</span><strong>&nbsp;'+formatter(v)+'</strong></div>');
      });
      pt.addEventListener("mouseleave", hideTooltip);
    });
  }

  function renderSmallMultiples(target, metricKey, formatter) {
    var container = document.getElementById(target === "alcance" ? "chartAlcance" : "chartInteracciones");
    var plats = PLATFORM_ORDER.filter(function(p){ return state.activePlatforms.has(p); });
    if (plats.length === 0) { container.innerHTML = '<div class="empty-state">No hay plataformas seleccionadas.</div>'; return; }
    var grid = document.createElement("div");
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = plats.length > 1 ? "repeat(auto-fit, minmax(220px, 1fr))" : "1fr";
    grid.style.gap = "10px";
    container.innerHTML = "";
    var tableRows = [["Mes"].concat(plats)];
    MONTHS.forEach(function(mk, idx){
      tableRows.push([monthLabel(mk)]);
    });

    plats.forEach(function(p){
      var values = seriesForMetric(state.brand, p, metricKey);
      values.forEach(function(v, idx){ tableRows[idx+1].push(v===null||v===undefined?"—":formatter(v)); });
      var color = cssVar(PLATFORM_COLOR_VAR[p]);
      var card = document.createElement("div");
      var hasAny = values.some(function(v){ return v !== null && v !== undefined && !isNaN(v); });
      var lastVal = null;
      for (var i=values.length-1;i>=0;i--) { if (values[i]!==null && values[i]!==undefined) { lastVal = values[i]; break; } }
      card.innerHTML = '<div style="font-size:12px;font-weight:650;color:'+color+';margin-bottom:2px;">' + p + '</div>' +
        '<div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">' + (hasAny ? ('Último dato: ' + formatter(lastVal)) : '&nbsp;') + '</div>';
      var svgWrap = document.createElement("div");
      if (hasAny) {
        var milestoneField = target === "alcance" ? "alcance" : "interacciones";
        var milestoneLabel = target === "alcance" ? "alcance" : "interacciones";
        var milestones = milestonesForSeries(state.brand, p, values, milestoneField);
        svgWrap.innerHTML = buildMiniLineSVG(values, color, formatter, 280, milestones);
        card.appendChild(svgWrap);
        grid.appendChild(card);
        attachHover(svgWrap.querySelector("svg"), values, formatter, p, color);
        if (milestones.length) attachMilestoneHover(svgWrap.querySelector("svg"), milestones, milestoneLabel, milestoneField, fmtCompact);
      } else {
        svgWrap.innerHTML = '<div class="empty-state" style="padding:40px 6px;font-size:11px;">Sin datos registrados</div>';
        card.appendChild(svgWrap);
        grid.appendChild(card);
      }
    });
    container.appendChild(grid);

    var legend = document.getElementById(target === "alcance" ? "legendAlcance" : "legendInteracciones");
    legend.innerHTML = "";

    lastTables[target] = tableToHTML(tableRows);
  }

  // ---------- overlaid multi-line ER chart ----------
  function renderERChart() {
    var container = document.getElementById("chartER");
    var plats = PLATFORM_ORDER.filter(function(p){ return state.activePlatforms.has(p); });
    if (plats.length === 0) { container.innerHTML = '<div class="empty-state">No hay plataformas seleccionadas.</div>'; return; }
    var w = 700, h = 260, padL = 46, padR = 16, padT = 26, padB = 26;
    var plotW = w - padL - padR, plotH = h - padT - padB;
    var seriesData = plats.map(function(p){ return { p:p, color: cssVar(PLATFORM_COLOR_VAR[p]), values: seriesForMetric(state.brand, p, "er") }; });
    var allVals = [];
    seriesData.forEach(function(s){ s.values.forEach(function(v){ if (v!==null && v!==undefined && !isNaN(v)) allVals.push(v); }); });
    var maxV = allVals.length ? Math.max.apply(null, allVals) * 1.2 : 0.05;
    function xAt(i) { return padL + (plotW * i / (MONTHS.length - 1)); }
    function yAt(v) { return padT + plotH - (v/maxV)*plotH; }

    var gridLines = "";
    for (var t=0;t<=4;t++) {
      var val = maxV*t/4, y = yAt(val);
      gridLines += '<line x1="'+padL+'" x2="'+(w-padR)+'" y1="'+y+'" y2="'+y+'" stroke="var(--gridline)" stroke-width="1"/>';
      gridLines += '<text x="'+(padL-6)+'" y="'+(y+3)+'" text-anchor="end" font-size="10" fill="var(--text-muted)">'+fmtPct(val,1)+'</text>';
    }
    var xLabels = "";
    MONTHS.forEach(function(mk, i){ xLabels += '<text x="'+xAt(i)+'" y="'+(h-6)+'" text-anchor="middle" font-size="10" fill="var(--text-muted)">'+monthLabel(mk)+'</text>'; });

    var lines = "", dots = "", hitcols = "", milestoneMarkup = "";
    var milestoneList = [];
    seriesData.forEach(function(s){
      var pts = [];
      s.values.forEach(function(v, i){ if (v!==null && v!==undefined && !isNaN(v)) { pts.push(xAt(i)+","+yAt(v)); dots += '<circle cx="'+xAt(i)+'" cy="'+yAt(v)+'" r="3" fill="'+s.color+'" stroke="var(--surface-1)" stroke-width="1.5"/>'; } });
      if (pts.length) lines += '<path d="M'+pts.join(" L")+'" fill="none" stroke="'+s.color+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
      var peaks = milestonesForSeries(state.brand, s.p, s.values, "er");
      peaks.forEach(function(m){
        var mi = m.index;
        if (s.values[mi] === null || s.values[mi] === undefined) return;
        var mx = xAt(mi), my = yAt(s.values[mi]) - 11;
        milestoneMarkup += '<rect class="hitmilestone" x="'+(mx-4)+'" y="'+(my-4)+'" width="8" height="8" fill="var(--text-primary)" stroke="var(--surface-1)" stroke-width="1.3" transform="rotate(45 '+mx+' '+my+')"/>';
        milestoneMarkup += '<circle class="hitmilestone-target" cx="'+mx+'" cy="'+my+'" r="11" fill="transparent" style="cursor:pointer;"/>';
        milestoneList.push({ post: m.post, platform: s.p });
      });
    });
    MONTHS.forEach(function(mk, i){
      hitcols += '<rect class="hitcol" data-i="'+i+'" x="'+(xAt(i)-plotW/(MONTHS.length-1)/2)+'" y="'+padT+'" width="'+(plotW/(MONTHS.length-1))+'" height="'+plotH+'" fill="transparent"/>';
    });

    container.innerHTML = '<svg viewBox="0 0 '+w+' '+h+'" width="100%" height="260" preserveAspectRatio="xMidYMid meet">' + gridLines + lines + dots + xLabels + hitcols + milestoneMarkup + '</svg>';

    var svg = container.querySelector("svg");
    svg.querySelectorAll(".hitcol").forEach(function(col){
      col.addEventListener("mousemove", function(e){
        var i = +col.dataset.i;
        var rowsHtml = seriesData.map(function(s){
          var v = s.values[i];
          return '<div class="row"><span><span class="key" style="background:'+s.color+'"></span>'+s.p+'</span><strong>&nbsp;'+fmtPct(v,2)+'</strong></div>';
        }).join("");
        showTooltip(e.clientX, e.clientY, '<div class="row"><strong>'+monthLabel(MONTHS[i])+'</strong></div>' + rowsHtml);
      });
      col.addEventListener("mouseleave", hideTooltip);
    });
    svg.querySelectorAll(".hitmilestone-target").forEach(function(target, idx){
      var info = milestoneList[idx];
      target.addEventListener("mousemove", function(e){
        showTooltip(e.clientX, e.clientY,
          '<div class="row"><strong>Hito · mejor ER · ' + info.platform + '</strong></div>' +
          '<div class="row"><span>' + (info.post.tipo||"Publicación") + ' · ' + info.post.fecha + '</span></div>' +
          '<div class="row"><span>Engagement rate</span><strong>&nbsp;' + fmtPct(info.post.er,2) + '</strong></div>' +
          (info.post.link && /^https?:\/\//i.test(info.post.link) ? '<div class="row"><span style="color:var(--series-1)">Click para abrir el post</span></div>' : ''));
      });
      target.addEventListener("mouseleave", hideTooltip);
      if (info.post.link && /^https?:\/\//i.test(info.post.link)) {
        target.addEventListener("click", function(){ window.open(info.post.link, "_blank", "noopener,noreferrer"); });
      }
    });

    var legend = document.getElementById("legendER");
    legend.innerHTML = seriesData.map(function(s){
      return '<span class="item"><span class="swatch-line" style="background:'+s.color+'"></span>'+s.p+'</span>';
    }).join("");

    var tableRows = [["Mes"].concat(plats)];
    MONTHS.forEach(function(mk, i){
      var row = [monthLabel(mk)];
      seriesData.forEach(function(s){ row.push(fmtPct(s.values[i],2)); });
      tableRows.push(row);
    });
    lastTables["er"] = tableToHTML(tableRows);
  }

  // ---------- content mix stacked bar ----------
  function renderMixChart() {
    var container = document.getElementById("chartMix");
    var rows = DATA.content_mix.filter(function(r){ return r.marca === state.brand; });
    var totals = {};
    rows.forEach(function(r){ totals[r.tipo_norm] = (totals[r.tipo_norm]||0) + r.count; });
    var order = CONTENT_ORDER.filter(function(c){ return totals[c]; });
    var grand = order.reduce(function(s,c){ return s + totals[c]; }, 0);
    if (grand === 0) { container.innerHTML = '<div class="empty-state">Sin datos de tipo de contenido.</div>'; document.getElementById("legendMix").innerHTML=""; return; }

    var w = 700, h = 70, barH = 28, barY = 18;
    var x = 0, segs = "", hitareas = "";
    order.forEach(function(c){
      var frac = totals[c]/grand;
      var segW = frac * w;
      var color = cssVar(CONTENT_COLOR_VAR[c]);
      segs += '<rect x="'+(x+1)+'" y="'+barY+'" width="'+Math.max(segW-2,0)+'" height="'+barH+'" rx="4" fill="'+color+'"/>';
      hitareas += '<rect class="hitseg" data-c="'+c+'" data-n="'+totals[c]+'" data-f="'+frac+'" x="'+x+'" y="'+barY+'" width="'+segW+'" height="'+barH+'" fill="transparent"/>';
      x += segW;
    });
    container.innerHTML = '<svg viewBox="0 0 '+w+' '+h+'" width="100%" height="'+h+'">' + segs + hitareas + '</svg>';
    var svg = container.querySelector("svg");
    svg.querySelectorAll(".hitseg").forEach(function(seg){
      seg.addEventListener("mousemove", function(e){
        showTooltip(e.clientX, e.clientY, '<div class="row"><strong>'+seg.dataset.c+'</strong></div><div class="row"><span>'+fmtInt(+seg.dataset.n)+' publicaciones</span><strong>&nbsp;'+(+seg.dataset.f*100).toFixed(0)+'%</strong></div>');
      });
      seg.addEventListener("mouseleave", hideTooltip);
    });

    var legend = document.getElementById("legendMix");
    legend.innerHTML = order.map(function(c){
      return '<span class="item"><span class="swatch-rect" style="background:'+cssVar(CONTENT_COLOR_VAR[c])+'"></span>'+c+' · '+fmtInt(totals[c])+'</span>';
    }).join("");

    lastTables["mix"] = tableToHTML([["Tipo de contenido","Publicaciones","% del total"]].concat(order.map(function(c){ return [c, fmtInt(totals[c]), (totals[c]/grand*100).toFixed(1)+"%"]; })));
  }

  // ---------- table view toggle ----------
  function tableToHTML(rows) {
    var thead = "<thead><tr>" + rows[0].map(function(h){ return "<th>"+escapeHTML(h)+"</th>"; }).join("") + "</tr></thead>";
    var tbody = "<tbody>" + rows.slice(1).map(function(r){
      return "<tr>" + r.map(function(c){ return "<td>"+escapeHTML(String(c))+"</td>"; }).join("") + "</tr>";
    }).join("") + "</tbody>";
    return '<table class="data-table">' + thead + tbody + '</table>';
  }
  function escapeHTML(s) { var d = document.createElement("div"); d.textContent = s; return d.innerHTML; }

  document.querySelectorAll(".table-toggle").forEach(function(btn){
    btn.addEventListener("click", function(){
      var target = btn.dataset.target;
      var bodyId = { alcance:"chartAlcance", interacciones:"chartInteracciones", er:"chartER", mix:"chartMix" }[target];
      var mode = chartMode[target] || "chart";
      var bodyEl = document.getElementById(bodyId);
      if (mode === "chart") {
        bodyEl.dataset.chartHTML = bodyEl.innerHTML;
        bodyEl.innerHTML = lastTables[target] || "";
        chartMode[target] = "table";
        btn.textContent = "Ver gráfico";
      } else {
        // re-render to restore listeners
        chartMode[target] = "chart";
        btn.textContent = "Ver tabla";
        rerender(target);
      }
    });
  });
  function rerender(target) {
    if (target === "alcance") renderSmallMultiples("alcance", "alcance", fmtCompact);
    else if (target === "interacciones") renderSmallMultiples("interacciones", "interacciones", fmtCompact);
    else if (target === "er") renderERChart();
    else if (target === "mix") renderMixChart();
  }

  // ---------- hallazgos automáticos / alertas ----------
  var STREAK_MIN_WARNING = 2, STREAK_MIN_CRITICAL = 3;
  var MOM_THRESHOLD = { alcance_avg: 0.4, er_avg: 0.3 };

  function orderedSeries(brand, platform, field) {
    var rows = rowsForBrand(brand).filter(function(r){ return r.plataforma_norm === platform; });
    var byMonth = {};
    rows.forEach(function(r){ byMonth[r.mes_key] = r; });
    var out = [];
    MONTHS.forEach(function(mk){
      var r = byMonth[mk];
      var v = r ? r[field] : null;
      if (v !== null && v !== undefined && !isNaN(v)) out.push({ month: mk, value: v });
    });
    return out;
  }

  function computeGoalStreakFindings(brand) {
    var goals = GOALS[brand];
    if (!goals) return [];
    var findings = [];
    Object.keys(goals).forEach(function(platform){
      var g = goals[platform];
      [["er","er_avg","Engagement rate"], ["nuevos_seguidores","nuevos_seguidores","Nuevos seguidores"], ["alcance","alcance_avg","Alcance"]].forEach(function(spec){
        var kpiKey = spec[0], field = spec[1], kpiLabel = spec[2];
        if (g[kpiKey] === undefined) return;
        var meta = g[kpiKey];
        var series = orderedSeries(brand, platform, field);
        if (!series.length) return;
        var dir = null, streak = 0, monthsInStreak = [];
        for (var i = series.length - 1; i >= 0; i--) {
          var above = series[i].value >= meta;
          if (dir === null) { dir = above; streak = 1; monthsInStreak.unshift(series[i].month); }
          else if (above === dir) { streak++; monthsInStreak.unshift(series[i].month); }
          else break;
        }
        var label = platform + " · " + kpiLabel;
        var fmtVal = kpiKey === "er" ? function(v){ return fmtPct(v,2); }
          : kpiKey === "alcance" ? function(v){ return fmtCompact(v) + "/mes"; }
          : function(v){ return fmtInt(v) + "/mes"; };
        if (!dir && streak >= STREAK_MIN_WARNING) {
          findings.push({
            severity: streak >= STREAK_MIN_CRITICAL ? "critical" : "warning",
            badge: streak >= STREAK_MIN_CRITICAL ? "Alerta" : "Aviso",
            title: label + ": bajo meta " + streak + " meses consecutivos",
            detail: "Meses: " + monthsInStreak.map(monthLabel).join(", ") + ". Último real " + fmtVal(series[series.length-1].value) + " vs. meta " + fmtVal(meta) + ".",
            brand: brand, platform: platform, streak: streak
          });
        } else if (dir && streak >= STREAK_MIN_CRITICAL) {
          findings.push({
            severity: "good",
            badge: "Logro",
            title: label + ": meta cumplida " + streak + " meses consecutivos",
            detail: "Meses: " + monthsInStreak.map(monthLabel).join(", ") + ".",
            brand: brand, platform: platform, streak: streak
          });
        }
      });
    });
    return findings;
  }

  function computeMoMFindings(brand) {
    var findings = [];
    platformsForBrand(brand).forEach(function(p){
      [["alcance_avg","Alcance promedio", fmtCompact], ["er_avg","Engagement rate promedio", function(v){ return fmtPct(v,2); }]].forEach(function(spec){
        var field = spec[0], label = spec[1], fmt = spec[2];
        var series = orderedSeries(brand, p, field);
        if (series.length < 2) return;
        var last = series[series.length-1], prev = series[series.length-2];
        if (!prev.value) return;
        var rel = (last.value - prev.value) / prev.value;
        if (Math.abs(rel) >= MOM_THRESHOLD[field]) {
          var up = rel > 0;
          var post = up ? bestPostInMonth(brand, p, last.month) : null;
          findings.push({
            severity: "info",
            badge: up ? "Sube" : "Baja",
            title: p + " · " + label + ": " + (up?"+":"") + (rel*100).toFixed(0) + "% en " + monthLabel(last.month) + " vs " + monthLabel(prev.month),
            detail: fmt(prev.value) + " → " + fmt(last.value) + (post ? (". Publicación destacada del mes: " + (post.tipo||"post") + " del " + post.fecha + " (alcance " + fmtCompact(post.alcance) + ").") : "."),
            post: post, brand: brand, platform: p
          });
        }
      });
    });
    return findings;
  }

  function computeFindings(brand) {
    var order = { critical:0, warning:1, good:2, info:3 };
    return computeGoalStreakFindings(brand).concat(computeMoMFindings(brand)).sort(function(a,b){ return order[a.severity]-order[b.severity]; });
  }

  function renderFindings() {
    var body = document.getElementById("findingsBody");
    var findings = computeFindings(state.brand);
    if (!findings.length) { body.innerHTML = '<div class="empty-state">Sin hallazgos relevantes para ' + state.brand + ' en este periodo.</div>'; return; }
    body.innerHTML = "";
    findings.forEach(function(f){
      var row = document.createElement("div");
      row.className = "finding-item";
      var badge = document.createElement("span");
      badge.className = "finding-badge " + f.severity;
      badge.textContent = f.badge;
      var textWrap = document.createElement("div");
      textWrap.className = "finding-text";
      var titleEl = document.createElement("div");
      titleEl.className = "ftitle"; titleEl.textContent = f.title;
      var detailEl = document.createElement("div");
      detailEl.className = "fdetail"; detailEl.textContent = f.detail;
      textWrap.appendChild(titleEl); textWrap.appendChild(detailEl);
      if (f.post && f.post.link && /^https?:\/\//i.test(f.post.link)) {
        var a = document.createElement("a");
        a.href = f.post.link; a.target = "_blank"; a.rel = "noopener noreferrer"; a.textContent = "Ver post";
        var wrapLink = document.createElement("div");
        wrapLink.appendChild(a);
        textWrap.appendChild(wrapLink);
      }
      row.appendChild(badge); row.appendChild(textWrap);
      body.appendChild(row);
    });
  }

  function renderAlertBanner() {
    var allCritical = [];
    brands.forEach(function(b){
      computeGoalStreakFindings(b).filter(function(f){ return f.severity === "critical"; }).forEach(function(f){ allCritical.push(f); });
    });
    var banner = document.getElementById("alertBanner");
    if (!allCritical.length) { banner.style.display = "none"; return; }
    banner.style.display = "";
    document.getElementById("alertBannerCount").textContent =
      allCritical.length + (allCritical.length === 1 ? " alerta activa" : " alertas activas") + " — bajo meta 3+ meses consecutivos";
    var list = document.getElementById("alertBannerList");
    list.innerHTML = "";
    allCritical.forEach(function(f){
      var btn = document.createElement("button");
      btn.type = "button"; btn.className = "alert-line";
      var strong = document.createElement("strong");
      strong.textContent = f.brand + " · " + f.platform;
      btn.appendChild(strong);
      btn.appendChild(document.createTextNode(": " + f.title.split(": ")[1] || f.title));
      btn.addEventListener("click", function(){
        brandSelect.value = f.brand;
        state.brand = f.brand;
        state.activePlatforms = new Set(platformsForBrand(state.brand));
        renderPlatformChips();
        renderAll();
        document.getElementById("findingsCard").scrollIntoView({ behavior:"smooth", block:"start" });
      });
      list.appendChild(btn);
    });
  }

  function initAlertBannerToggle() {
    var head = document.getElementById("alertBannerHead");
    var toggle = document.getElementById("alertBannerToggle");
    var list = document.getElementById("alertBannerList");
    if (!head || !toggle || !list) return;
    head.addEventListener("click", function(){
      var isOpen = list.style.display !== "none";
      list.style.display = isOpen ? "none" : "";
      toggle.textContent = isOpen ? "Ver detalle ▾" : "Ocultar ▴";
    });
  }

  // ---------- mejores publicaciones ----------
  var topPostsSort = { col: "er", dir: -1 };
  var TOP_POSTS_LIMIT = 15;
  function postsForBrand(brand) {
    return (DATA.posts || []).filter(function(p){ return p.marca === brand; });
  }
  function renderTopPosts() {
    var body = document.getElementById("topPostsBody");
    var sub = document.getElementById("topPostsSub");
    var posts = postsForBrand(state.brand).filter(function(p){ return state.activePlatforms.has(p.plataforma); });
    if (posts.length === 0) { body.innerHTML = '<div class="empty-state">Sin publicaciones para esta selección.</div>'; return; }

    var cols = [
      { key:"fecha", label:"Fecha" },
      { key:"plataforma", label:"Plataforma" },
      { key:"tipo", label:"Tipo" },
      { key:"alcance", label:"Alcance" },
      { key:"interacciones", label:"Interacciones" },
      { key:"er", label:"Engagement rate" }
    ];
    var criterioLabel = { fecha:"fecha", plataforma:"plataforma", tipo:"tipo", alcance:"alcance", interacciones:"interacciones", er:"engagement rate" }[topPostsSort.col];
    sub.textContent = "Top " + TOP_POSTS_LIMIT + " por " + criterioLabel + " · click en un encabezado para cambiar el criterio";

    var sorted = posts.slice().sort(function(a,b){
      var av = a[topPostsSort.col], bv = b[topPostsSort.col];
      if (topPostsSort.col === "fecha" || topPostsSort.col === "plataforma" || topPostsSort.col === "tipo") {
        av = av || ""; bv = bv || "";
        return av.localeCompare(bv, "es") * topPostsSort.dir;
      }
      av = (av===null||av===undefined) ? -Infinity : av;
      bv = (bv===null||bv===undefined) ? -Infinity : bv;
      return (av - bv) * topPostsSort.dir;
    });
    var top = sorted.slice(0, TOP_POSTS_LIMIT);

    var table = document.createElement("table");
    table.className = "data-table";
    var thead = document.createElement("thead");
    var trh = document.createElement("tr");
    cols.forEach(function(c){
      var th = document.createElement("th");
      var arrow = topPostsSort.col === c.key ? (topPostsSort.dir === 1 ? " ▲" : " ▼") : "";
      th.textContent = c.label + arrow;
      th.dataset.col = c.key;
      th.addEventListener("click", function(){
        if (topPostsSort.col === c.key) topPostsSort.dir *= -1;
        else { topPostsSort.col = c.key; topPostsSort.dir = (c.key==="fecha"||c.key==="plataforma"||c.key==="tipo") ? 1 : -1; }
        renderTopPosts();
      });
      trh.appendChild(th);
    });
    var thLink = document.createElement("th"); thLink.textContent = "Post";
    trh.appendChild(thLink);
    thead.appendChild(trh);
    table.appendChild(thead);

    var tbody = document.createElement("tbody");
    top.forEach(function(p){
      var tr = document.createElement("tr");
      [
        p.fecha || "—",
        p.plataforma || "—",
        p.tipo || "—",
        fmtCompact(p.alcance),
        fmtCompact(p.interacciones),
        fmtPct(p.er, 2)
      ].forEach(function(val){
        var td = document.createElement("td");
        td.textContent = val;
        tr.appendChild(td);
      });
      var tdLink = document.createElement("td");
      if (p.link && /^https?:\/\//i.test(p.link)) {
        var a = document.createElement("a");
        a.href = p.link; a.target = "_blank"; a.rel = "noopener noreferrer";
        a.textContent = "Ver post"; a.style.color = "var(--series-1)";
        tdLink.appendChild(a);
      } else { tdLink.textContent = "—"; }
      tr.appendChild(tdLink);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    body.innerHTML = "";
    body.appendChild(table);
  }

  // ---------- metas 2026 ----------
  var KPI_META = {
    er: { label: "Engagement rate", field: "er_avg", fmt: function(v){ return fmtPct(v,2); } },
    alcance: { label: "Alcance", field: "alcance_avg", fmt: fmtCompact },
    nuevos_seguidores: { label: "Nuevos seguidores", field: "nuevos_seguidores", fmt: fmtInt }
  };
  var metasView = "annual"; // "annual" | "monthly"

  function goalRowsForBrand(brand, goals) {
    var rows = [];
    Object.keys(goals).filter(function(platform){ return state.activePlatforms.has(platform); }).forEach(function(platform){
      var g = goals[platform];
      ["er","alcance","nuevos_seguidores"].forEach(function(kpiKey){
        if (g[kpiKey] === undefined) return;
        rows.push({ platform: platform, kpiKey: kpiKey, meta: g[kpiKey], info: KPI_META[kpiKey] });
      });
    });
    return rows;
  }

  function renderMetas() {
    var body = document.getElementById("metasBody");
    var sub = document.getElementById("metasSub");
    var goals = GOALS[state.brand];
    if (!goals) {
      sub.textContent = "";
      body.innerHTML = '<div class="empty-state">' + state.brand + ' todavía no tiene metas 2026 cargadas. Compártelas y las incorporo a este panel.</div>';
      return;
    }
    var rows = goalRowsForBrand(state.brand, goals);
    if (!rows.length) {
      sub.textContent = "";
      body.innerHTML = '<div class="empty-state">Ninguna de las plataformas seleccionadas arriba tiene metas cargadas para ' + state.brand + '. Ajusta el filtro de plataforma o elige "Todas".</div>';
      return;
    }
    if (metasView === "annual") {
      sub.textContent = "Acumulado anual: promedio mensual real (ene–jul 2026) vs. meta mensual — alcance y engagement siempre en promedio";
      var items = rows.map(function(r){ return buildMeterItem(r.platform, r.info.label, r.kpiKey, r.meta); });
      body.innerHTML = '<div class="meters">' + items.join("") + '</div>';
    } else {
      sub.textContent = "Vista mensual: real de cada mes vs. meta mensual (mismo valor de meta se repite cada mes)";
      renderMetasMonthlyTable(body, rows);
    }
  }

  function renderMetasMonthlyTable(body, rows) {
    if (!rows.length) { body.innerHTML = '<div class="empty-state">Sin metas para esta marca.</div>'; return; }
    var table = document.createElement("table");
    table.className = "data-table";
    var thead = document.createElement("thead");
    var trh = document.createElement("tr");
    ["Plataforma · KPI","Meta mensual"].concat(MONTHS.map(monthLabel)).forEach(function(h){
      var th = document.createElement("th"); th.textContent = h; trh.appendChild(th);
    });
    thead.appendChild(trh); table.appendChild(thead);
    var tbody = document.createElement("tbody");
    rows.forEach(function(r){
      var tr = document.createElement("tr");
      var tdLabel = document.createElement("td"); tdLabel.textContent = r.platform + " · " + r.info.label; tdLabel.style.fontWeight = "600";
      tr.appendChild(tdLabel);
      var tdMeta = document.createElement("td"); tdMeta.textContent = r.info.fmt(r.meta); tr.appendChild(tdMeta);
      var series = orderedSeriesAllMonths(state.brand, r.platform, r.info.field);
      series.forEach(function(v){
        var td = document.createElement("td");
        if (v === null || v === undefined || isNaN(v)) { td.textContent = "—"; td.style.color = "var(--text-muted)"; }
        else {
          var above = v >= r.meta;
          td.textContent = r.info.fmt(v);
          td.style.color = above ? "var(--status-good)" : "var(--status-critical)";
          td.style.fontWeight = "600";
        }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    body.innerHTML = "";
    body.appendChild(table);
  }

  function orderedSeriesAllMonths(brand, platform, field) {
    var rows = rowsForBrand(brand).filter(function(r){ return r.plataforma_norm === platform; });
    var byMonth = {};
    rows.forEach(function(r){ byMonth[r.mes_key] = r; });
    return MONTHS.map(function(mk){ var r = byMonth[mk]; return r ? r[field] : null; });
  }

  function buildMeterItem(platform, label, metric, meta) {
    var info = KPI_META[metric];
    var values = seriesForMetric(state.brand, platform, metric).filter(function(v){ return v!==null && v!==undefined && !isNaN(v); });
    var avg = values.length ? values.reduce(function(s,v){return s+v;},0)/values.length : null;
    var cumplimiento = (avg !== null && meta) ? avg/meta : null;
    var status = "critical", statusLabel = "Bajo";
    if (cumplimiento !== null) {
      if (cumplimiento >= 1) { status = "good"; statusLabel = "Cumplido"; }
      else if (cumplimiento >= 0.8) { status = "warning"; statusLabel = "En riesgo"; }
      else { status = "critical"; statusLabel = "Bajo"; }
    }
    var pctWidth = cumplimiento !== null ? Math.min(cumplimiento*100, 130) : 0;
    var avgDisplay = avg === null ? "Sin dato 2026" : info.fmt(avg) + (metric === "er" ? "" : "/mes");
    var metaDisplay = info.fmt(meta) + (metric === "er" ? "" : "/mes");
    var color = "var(--status-" + status + ")";
    return '<div class="meter-item">' +
      '<div class="mtop"><div class="mtitle">' + platform + ' · ' + label + '</div>' +
      (avg!==null ? '<div class="mstate ' + status + '">' + statusLabel + '</div>' : '') + '</div>' +
      '<div class="meter-track"><div class="meter-fill" style="width:' + (avg!==null ? Math.min(pctWidth,100) : 0) + '%;background:' + color + '"></div></div>' +
      '<div class="mvals"><span>Real: <b>' + avgDisplay + '</b></span><span>Meta: <b>' + metaDisplay + '</b></span>' +
      (cumplimiento!==null ? '<span>' + (cumplimiento*100).toFixed(0) + '%</span>' : '') + '</div>' +
      '</div>';
  }

  // ---------- comparativo ----------
  var compareSort = { col: "alcance", dir: -1 };
  function computeCompareRows() {
    return brands.map(function(b){
      var t = computeTotals(b, new Set(PLATFORM_ORDER));
      return { marca: b, alcance: t.alcance, interacciones: t.interacciones, er: t.er, posts: t.posts, nuevos: t.nuevosCount>0?t.nuevos:null };
    });
  }
  function renderCompare() {
    var rows = computeCompareRows();
    var cols = [
      { key:"marca", label:"Marca", fmt:function(v){return v;} },
      { key:"alcance", label:"Alcance promedio", fmt:fmtCompact },
      { key:"interacciones", label:"Interacciones", fmt:fmtCompact },
      { key:"er", label:"ER promedio", fmt:function(v){return fmtPct(v,2);} },
      { key:"posts", label:"Publicaciones", fmt:fmtInt },
      { key:"nuevos", label:"Nuevos seguidores", fmt:function(v){return v===null?"Sin dato":fmtCompact(v);} }
    ];
    rows.sort(function(a,b){
      var av = a[compareSort.col], bv = b[compareSort.col];
      if (typeof av === "string") return av.localeCompare(bv, "es") * (compareSort.dir);
      av = av===null?-Infinity:av; bv = bv===null?-Infinity:bv;
      return (av - bv) * compareSort.dir;
    });
    var maxAlcance = Math.max.apply(null, rows.map(function(r){return r.alcance;}));
    var thead = "<thead><tr>" + cols.map(function(c){
      var arrow = compareSort.col === c.key ? (compareSort.dir === 1 ? " ▲" : " ▼") : "";
      return '<th data-col="' + c.key + '">' + c.label + arrow + '</th>';
    }).join("") + "</tr></thead>";
    var tbody = "<tbody>" + rows.map(function(r){
      var bg = "background: linear-gradient(90deg, color-mix(in srgb, var(--series-1) " + Math.round(r.alcance/maxAlcance*16) + "%, transparent), transparent 60%);";
      return "<tr>" + cols.map(function(c){
        var cell = c.fmt(r[c.key]);
        return c.key === "marca" ? '<td style="' + bg + 'font-weight:600;">' + escapeHTML(cell) + '</td>' : "<td>" + escapeHTML(String(cell)) + "</td>";
      }).join("") + "</tr>";
    }).join("") + "</tbody>";
    var el = document.getElementById("compareTable");
    el.innerHTML = '<table class="data-table">' + thead + tbody + '</table>';
    el.querySelectorAll("th").forEach(function(th){
      th.addEventListener("click", function(){
        var col = th.dataset.col;
        if (compareSort.col === col) compareSort.dir *= -1;
        else { compareSort.col = col; compareSort.dir = col === "marca" ? 1 : -1; }
        renderCompare();
      });
    });
  }

  // ---------- init ----------
  function renderAll() {
    renderKPIs();
    renderFindings();
    chartMode = {};
    document.querySelectorAll(".table-toggle").forEach(function(b){ b.textContent = "Ver tabla"; });
    renderSmallMultiples("alcance", "alcance", fmtCompact);
    renderSmallMultiples("interacciones", "interacciones", fmtCompact);
    renderERChart();
    renderMixChart();
    renderTopPosts();
    renderMetas();
  }

  state.activePlatforms = new Set(platformsForBrand(state.brand));
  renderPlatformChips();
  renderAll();
  renderAlertBanner();
  initAlertBannerToggle();
  styleViewToggle();
  styleMetasToggle();
  } // end boot()

  return { boot: boot };
})();

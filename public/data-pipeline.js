// data-pipeline.js
// Reproduces, in the browser, the exact aggregation logic that used to run in a Python
// build step: turns raw MASTER_DATA / METAS 2026 rows (as returned by the Google Sheets
// API) into the same DATA / GOALS JSON shape app.js already expects. Keeping app.js
// unchanged and moving only this transform to the client is what lets the dashboard load
// "live" data on every visit, without a rebuild step, while carrying over every business
// rule validated in the original pipeline (averages, not sums, for alcance/engagement;
// null-safe sum/mean/max; brand-name normalization for goal matching).
window.DataPipeline = (function () {
  "use strict";

  var PLATFORM_ORDER = ["Facebook", "Instagram", "LinkedIn", "TikTok", "X", "YouTube"];

  // Google Sheets (and Excel) serial dates count days since 1899-12-30.
  var SHEETS_EPOCH_MS = Date.UTC(1899, 11, 30);

  function serialToISODate(v) {
    if (v === null || v === undefined || v === "") return null;
    if (typeof v === "number") {
      var d = new Date(SHEETS_EPOCH_MS + Math.round(v) * 86400000);
      return d.toISOString().slice(0, 10);
    }
    // Some Sheets configs return already-formatted date strings (e.g. "2026-01-15" or "1/15/2026").
    var parsed = new Date(v);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
    return null;
  }

  function normPlatform(raw) {
    if (!raw) return null;
    var s = String(raw).trim();
    if (s.toLowerCase() === "youtube") return "YouTube";
    return s;
  }

  var TIPO_MAP = {
    imagen: "Imagen", imagenes: "Imagen", foto: "Imagen", fotos: "Imagen",
    photo: "Imagen", photos: "Imagen", "imagen de instagram": "Imagen",
    "estático": "Imagen", "estática": "Imagen",
    video: "Video", videos: "Video", "vídeo": "Video", "video de instagram": "Video",
    "en vivo": "Video",
    reel: "Reel", reels: "Reel", "reel de instagram": "Reel", "reel de facebook": "Reel",
    carrusel: "Carrusel", carousel: "Carrusel", secuencia: "Carrusel",
    "secuencia de instagram": "Carrusel",
    texto: "Enlace/Texto", enlace: "Enlace/Texto", link: "Enlace/Texto",
    status: "Enlace/Texto", animated_gif: "Enlace/Texto"
  };

  function normTipo(raw) {
    if (raw === null || raw === undefined) return "Sin dato";
    var s = String(raw).trim();
    if (!s) return "Sin dato";
    var mapped = TIPO_MAP[s.toLowerCase()];
    return mapped || "Otro";
  }

  function toNum(v) {
    if (v === null || v === undefined || v === "" || v === "-") return null;
    var n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
    return isNaN(n) ? null : n;
  }

  function notNull(x) { return x !== null && x !== undefined && !isNaN(x); }
  function mean(arr) {
    var v = arr.filter(notNull);
    return v.length ? v.reduce(function (a, b) { return a + b; }, 0) / v.length : null;
  }
  function sumMinCount1(arr) {
    var v = arr.filter(notNull);
    return v.length ? v.reduce(function (a, b) { return a + b; }, 0) : null;
  }
  function maxOrNull(arr) {
    var v = arr.filter(notNull);
    return v.length ? Math.max.apply(null, v) : null;
  }
  function countNotNull(arr) { return arr.filter(notNull).length; }

  function normBrandKey(s) {
    return String(s || "").trim().toUpperCase().replace(/\s+/g, "");
  }

  // rows: array of arrays (row 0 = header), MASTER_DATA column order:
  // fecha_publicacion, link, mes, mes fecha, marca, categoria, plataforma, tipo_contenido,
  // alcance, reproducciones, interacciones_totales, engagement_rate, seguidores_mes, nuevos_seguidores
  // periodYear: filters to this calendar year only (based on fecha_publicacion), matching
  // the original "solo 2026" scoping. Pass null to include every year present.
  function buildDataset(rows, periodYear) {
    var body = rows.slice(1);
    var recs = [];
    body.forEach(function (r) {
      var fechaISO = serialToISODate(r[0]);
      if (!fechaISO) return;
      if (periodYear && parseInt(fechaISO.slice(0, 4), 10) !== periodYear) return;
      var marca = r[4] ? String(r[4]).trim() : null;
      var plataforma = normPlatform(r[6]);
      if (!marca || !plataforma) return;
      recs.push({
        fecha: fechaISO,
        mesKey: fechaISO.slice(0, 7),
        link: r[1] || null,
        marca: marca,
        plataforma: plataforma,
        tipo: normTipo(r[7]),
        alcance: toNum(r[8]),
        reproducciones: toNum(r[9]),
        interacciones: toNum(r[10]),
        er: toNum(r[11]),
        seguidores_mes: toNum(r[12]),
        nuevos_seguidores: toNum(r[13])
      });
    });

    var brandsSet = {}, platformsSet = {}, monthsSet = {};
    recs.forEach(function (p) { brandsSet[p.marca] = 1; platformsSet[p.plataforma] = 1; monthsSet[p.mesKey] = 1; });
    var brands = Object.keys(brandsSet).sort(function (a, b) { return a.localeCompare(b, "es"); });
    var platforms = PLATFORM_ORDER.filter(function (p) { return platformsSet[p]; });
    var months = Object.keys(monthsSet).sort();

    var groups = {};
    recs.forEach(function (p) {
      var key = p.mesKey + "|" + p.marca + "|" + p.plataforma;
      if (!groups[key]) groups[key] = { mes_key: p.mesKey, marca: p.marca, plataforma_norm: p.plataforma, items: [] };
      groups[key].items.push(p);
    });

    var monthly = Object.keys(groups).map(function (k) {
      var g = groups[k];
      var alcanceArr = g.items.map(function (p) { return p.alcance; });
      var erArr = g.items.map(function (p) { return p.er; });
      // "posts" counts only items with a real, verifiable link — some rows are bulk metric
      // snapshots without a captured URL, so they feed the averages/sums below but are not
      // counted as a distinct trackable "publicación" in the KPI card.
      var linkedCount = g.items.filter(function (p) { return p.link && /^https?:\/\//i.test(p.link); }).length;
      return {
        mes_key: g.mes_key, marca: g.marca, plataforma_norm: g.plataforma_norm,
        posts: linkedCount,
        alcance_avg: mean(alcanceArr), alcance_n: countNotNull(alcanceArr),
        interacciones: sumMinCount1(g.items.map(function (p) { return p.interacciones; })),
        reproducciones: sumMinCount1(g.items.map(function (p) { return p.reproducciones; })),
        er_avg: mean(erArr), er_n: countNotNull(erArr),
        seguidores_mes: maxOrNull(g.items.map(function (p) { return p.seguidores_mes; })),
        nuevos_seguidores: sumMinCount1(g.items.map(function (p) { return p.nuevos_seguidores; }))
      };
    });

    var cmGroups = {};
    recs.forEach(function (p) {
      var key = p.marca + "|" + p.tipo;
      cmGroups[key] = (cmGroups[key] || 0) + 1;
    });
    var content_mix = Object.keys(cmGroups).map(function (k) {
      var parts = k.split("|");
      return { marca: parts[0], tipo_norm: parts[1], count: cmGroups[k] };
    });

    var posts = recs.map(function (p) {
      return {
        fecha: p.fecha, marca: p.marca, plataforma: p.plataforma, tipo: p.tipo,
        alcance: p.alcance, reproducciones: p.reproducciones, interacciones: p.interacciones,
        er: p.er, link: p.link
      };
    });

    return {
      meta: {
        period_start: months[0] || null,
        period_end: months[months.length - 1] || null,
        source: "MASTER_SOCIAL_2026 (Google Drive)"
      },
      brands: brands, platforms: platforms, months: months,
      monthly: monthly, content_mix: content_mix, posts: posts
    };
  }

  // metaRows: array of arrays (row 0 = header: ["Marca","Métrica", <platform columns...>]).
  // brandList: canonical brand names from buildDataset(), used to match METAS 2026's
  // (sometimes typo'd/uppercase) brand names via a whitespace/case-insensitive key.
  function buildGoals(metaRows, brandList) {
    if (!metaRows || !metaRows.length) return { goals: {}, unmatched: [] };
    var header = metaRows[0] || [];
    var platformCols = header.slice(2).map(function (h) { return String(h || "").trim(); });
    var brandIndex = {};
    brandList.forEach(function (b) { brandIndex[normBrandKey(b)] = b; });

    var goals = {}, unmatched = [], seenUnmatched = {};
    metaRows.slice(1).forEach(function (row) {
      var rawBrand = row[0], metric = row[1];
      if (!rawBrand || !metric) return;
      var key = normBrandKey(rawBrand);
      var brand = brandIndex[key];
      if (!brand) {
        if (!seenUnmatched[key]) { unmatched.push(String(rawBrand)); seenUnmatched[key] = true; }
        return;
      }
      var metricNorm = String(metric).trim().toLowerCase();
      var kpiKey = metricNorm.indexOf("engagement") >= 0 ? "er" :
        metricNorm.indexOf("nuevos") >= 0 ? "nuevos_seguidores" :
        metricNorm.indexOf("alcance") >= 0 ? "alcance" : null;
      if (!kpiKey) return;
      platformCols.forEach(function (platform, i) {
        if (!platform) return;
        var val = toNum(row[2 + i]);
        if (val === null) return;
        if (!goals[brand]) goals[brand] = {};
        if (!goals[brand][platform]) goals[brand][platform] = {};
        goals[brand][platform][kpiKey] = val;
      });
    });
    return { goals: goals, unmatched: unmatched };
  }

  return { buildDataset: buildDataset, buildGoals: buildGoals };
})();

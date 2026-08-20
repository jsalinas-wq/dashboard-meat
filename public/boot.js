// boot.js — fetches the data and hands it to DashboardApp.boot(). No password gate
// right now (access is just "whoever has the site's URL", per Javi's request) — if a
// password gate gets added back later, this is the file that would show a login form
// before calling loadDashboard().
(function () {
  "use strict";

  var loadError = document.getElementById("loadError");

  function showLoadError(message) {
    loadError.textContent = message;
    loadError.style.display = "";
  }

  function loadDashboard() {
    loadError.style.display = "none";
    return fetch("/api/data", { credentials: "same-origin" })
      .then(function (res) {
        if (!res.ok) {
          return res.json().catch(function () { return {}; }).then(function (body) {
            throw new Error(body.detail || body.error || ("HTTP " + res.status));
          });
        }
        return res.json();
      })
      .then(function (raw) {
        var DATA = window.DataPipeline.buildDataset(raw.masterData, 2026);
        var goalsResult = window.DataPipeline.buildGoals(raw.metas, DATA.brands);
        if (goalsResult.unmatched.length) {
          // Surface unmatched goal brand names in the console rather than silently
          // dropping them — mirrors the original pipeline's behavior of reporting,
          // never guessing, when a METAS 2026 brand name doesn't match MASTER_DATA.
          console.warn("Marcas de METAS 2026 sin coincidencia en MASTER_DATA:", goalsResult.unmatched);
        }
        var periodSub = document.getElementById("periodSub");
        if (periodSub && DATA.meta.period_start) {
          var freshness = raw.lastRebuiltAt
            ? " · datos actualizados el " + new Date(raw.lastRebuiltAt).toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" })
            : "";
          periodSub.textContent = "Fuente: MASTER_SOCIAL_2026 (Google Drive), periodo " +
            DATA.meta.period_start + " a " + DATA.meta.period_end + freshness +
            " · Datos a nivel de publicación agregados por mes, marca y plataforma.";
        }
        window.DashboardApp.boot(DATA, goalsResult.goals);
      })
      .catch(function (err) {
        console.error(err);
        showLoadError("No se pudo cargar la información: " + err.message + ". Reintenta en un momento.");
      });
  }

  loadDashboard();
})();

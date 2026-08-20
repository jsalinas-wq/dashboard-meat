// Serves the MASTER_SOCIAL_2026 data — LIVE on every request. This function fetches the
// Google Sheet's own "export as xlsx" URL directly (no Google Cloud project, no service
// account, no OAuth) and parses it in-process with the "xlsx" (SheetJS) package. That
// export URL only works if the sheet's general access is set to "Anyone with the link –
// Viewer" (Javi enabled this on purpose so the dashboard can update itself automatically
// whenever a new month gets added, with no scheduled task and no tokens to manage).
//
// Row shape returned here (masterData / metas) is intentionally identical to what the
// old static-JSON version served: a plain 2D array per sheet (header row + data rows),
// with dates as day-serial numbers (days since 1899-12-30, matching Excel/Sheets). That
// means public/data-pipeline.js — already verified row-for-row against this exact shape
// — needed zero changes when this function switched from "read bundled JSON" to "fetch
// live and parse".
//
// NOTE: there is no password/session check here — access control is just "whoever has
// the site's URL" (per Javi's request, "por el momento"). If MEAT wants a password gate
// later, ask and it's a small addition.
const XLSX = require("xlsx");

const SHEET_ID = "1P7NamWx3Pv3arDSqEN0p17uGkJpCuftFegRmAQ1Bx9c";
const EXPORT_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=xlsx`;

// Mirrors MASTER_MAX_COL / METAS_MAX_COL from scripts/rebuild_data.py — bounded to the
// known schema widths so extra stray columns in the sheet never leak into the dashboard.
const MASTER_MAX_COL = 14; // fecha_publicacion .. nuevos_seguidores
const METAS_MAX_COL = 7; // Marca, Métrica, Facebook, Instagram, TikTok, LinkedIn, X

function extractSheet(workbook, sheetName, maxCol) {
  const ws = workbook.Sheets[sheetName];
  if (!ws) {
    throw new Error(
      `No encontré la pestaña "${sheetName}" en la planilla. Pestañas disponibles: ${workbook.SheetNames.join(", ")}`
    );
  }
  const rows = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    raw: true, // keep dates as day-serial numbers instead of formatted strings
    defval: null,
    blankrows: true,
  });
  return rows.map((row) => {
    const trimmed = row.slice(0, maxCol);
    while (trimmed.length < maxCol) trimmed.push(null);
    return trimmed;
  });
}

exports.handler = async () => {
  try {
    const res = await fetch(EXPORT_URL, { redirect: "follow" });
    if (!res.ok) {
      if (res.status === 401 || res.status === 403 || res.status === 404) {
        throw new Error(
          "No pude leer la planilla de Google Drive (HTTP " + res.status + "). " +
            "Lo más probable es que el acceso general de MASTER_SOCIAL_2026 no esté en " +
            '"Cualquiera con el enlace" — revísalo en el botón Compartir de la planilla.'
        );
      }
      throw new Error("No pude leer la planilla de Google Drive (HTTP " + res.status + ").");
    }
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });

    const masterData = extractSheet(workbook, "MASTER_DATA", MASTER_MAX_COL);
    const metas = extractSheet(workbook, "METAS 2026", METAS_MAX_COL);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        // Short cache so a burst of page loads doesn't re-fetch/re-parse the whole
        // workbook on every single request, while staying "live" within a couple minutes.
        "Cache-Control": "public, max-age=120",
      },
      body: JSON.stringify({ masterData, metas, lastRebuiltAt: new Date().toISOString() }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "data_not_available",
        detail: String((err && err.message) || err),
      }),
    };
  }
};

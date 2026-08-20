// Serves the MASTER_SOCIAL_2026 data. Reads two static JSON files bundled alongside
// this function (netlify/functions/_data/master_data.json and metas.json). Those files
// are refreshed periodically (see the scheduled rebuild task described in SETUP.md) and
// redeployed — so "up to date" here means "as of the last scheduled rebuild".
//
// NOTE: there is no password/session check here right now — access control is just
// "whoever has the site's URL" (per Javi's request, "por el momento"). If MEAT wants a
// password gate later, ask and it's a small addition (a login endpoint + a session
// cookie check right here) — the pieces from the earlier password-protected version can
// be restored.
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "_data");

exports.handler = async () => {
  try {
    const masterData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "master_data.json"), "utf8"));
    const metas = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "metas.json"), "utf8"));
    const meta = fs.existsSync(path.join(DATA_DIR, "meta.json"))
      ? JSON.parse(fs.readFileSync(path.join(DATA_DIR, "meta.json"), "utf8"))
      : null;
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=30" },
      body: JSON.stringify({ masterData, metas, lastRebuiltAt: meta && meta.lastRebuiltAt }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "data_not_available",
        detail: "No se encontraron los archivos de datos empaquetados. " + String((err && err.message) || err),
      }),
    };
  }
};

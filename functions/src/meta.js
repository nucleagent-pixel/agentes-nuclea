"use strict";

// Gasto del día por campaña desde la API de anuncios de Meta (solo lectura,
// permiso ads_read). La cuenta publicitaria de NUCLEA está en COP.
async function gastoPorCampana(fecha, { token, cuenta, version = "v23.0" }) {
  const id = String(cuenta).startsWith("act_") ? cuenta : "act_" + cuenta;
  const params = new URLSearchParams({
    level: "campaign",
    fields: "campaign_name,spend",
    time_range: JSON.stringify({ since: fecha, until: fecha }),
    limit: "500",
    access_token: token,
  });
  let url = `https://graph.facebook.com/${version}/${id}/insights?${params}`;
  const campanas = [];
  while (url) {
    const res = await fetch(url);
    const body = await res.json();
    if (!res.ok || body.error) {
      throw new Error("Meta respondió con error: " + ((body.error && body.error.message) || res.status));
    }
    for (const fila of body.data || []) {
      campanas.push({ campana: fila.campaign_name, gasto: Math.round(parseFloat(fila.spend) || 0) });
    }
    url = body.paging && body.paging.next;
  }
  return campanas;
}

module.exports = { gastoPorCampana };

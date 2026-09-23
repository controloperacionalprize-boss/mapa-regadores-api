import express from "express";
import cors from "cors";
import pg from "pg";

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
});

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

// Health check
app.get("/", (req, res) => res.json({ status: "ok" }));

// === SESSIONS ===
app.post("/api/sessions", async (req, res) => {
  try {
    const s = req.body;
    const { rows } = await pool.query(
      `INSERT INTO sesiones_gps (id, fundo, modulo_origen, turno_origen, modulo_destino, turno_destino, iniciado_en, terminado_en, dispositivo, app, usuario)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (id) DO NOTHING
       RETURNING *`,
      [s.id, s.fundo, s.modulo_origen, s.turno_origen, s.modulo_destino, s.turno_destino, s.iniciado_en, s.terminado_en, s.dispositivo, s.app, s.usuario]
    );
    res.json(rows[0] || { id: s.id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch("/api/sessions", async (req, res) => {
  try {
    const { id, ...updates } = req.body;
    const keys = Object.keys(updates);
    const sets = keys.map((k, i) => `${k} = $${i + 2}`);
    await pool.query(
      `UPDATE sesiones_gps SET ${sets.join(", ")} WHERE id = $1`,
      [id, ...keys.map((k) => updates[k])]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/sessions", async (req, res) => {
  try {
    const { usuario, limit } = req.query;
    let query = `SELECT * FROM sesiones_gps WHERE app = 'mapa_regadores'`;
    const params = [];
    if (usuario) {
      params.push(usuario);
      query += ` AND usuario = $${params.length}`;
    }
    query += ` ORDER BY iniciado_en DESC`;
    if (limit) {
      params.push(parseInt(limit));
      query += ` LIMIT $${params.length}`;
    }
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// === POINTS ===
app.post("/api/points", async (req, res) => {
  try {
    const points = Array.isArray(req.body) ? req.body : [req.body];
    if (points.length === 0) return res.json({ inserted: 0 });

    const values = [];
    const placeholders = [];
    let idx = 1;
    for (const p of points) {
      placeholders.push(`($${idx},$${idx+1},$${idx+2},$${idx+3},$${idx+4},$${idx+5},$${idx+6},$${idx+7},$${idx+8})`);
      values.push(p.sesion_id, p.lat, p.lng, p.velocidad, p.precision_metros, p.fundo, p.modulo_actual, p.turno_actual, p.grabado_en);
      idx += 9;
    }
    await pool.query(
      `INSERT INTO punto_gps (sesion_id, lat, lng, velocidad, precision_metros, fundo, modulo_actual, turno_actual, grabado_en)
       VALUES ${placeholders.join(",")}
       ON CONFLICT DO NOTHING`,
      values
    );
    res.json({ inserted: points.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/points", async (req, res) => {
  try {
    const { sesion_id } = req.query;
    const { rows } = await pool.query(
      `SELECT id, sesion_id, lat, lng, velocidad, precision_metros, fundo, grabado_en, offline
       FROM punto_gps WHERE sesion_id = $1 ORDER BY grabado_en ASC`,
      [sesion_id]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.head("/api/points", async (req, res) => {
  try {
    const { sesion_id } = req.query;
    const { rows } = await pool.query(`SELECT count(*)::int as count FROM punto_gps WHERE sesion_id = $1`, [sesion_id]);
    res.setHeader("x-total-count", rows[0].count);
    res.status(200).end();
  } catch (e) {
    res.status(500).end();
  }
});

// === DISPOSITIVOS ===
app.post("/api/dispositivos", async (req, res) => {
  try {
    const { android_id, modelo } = req.body;
    const existing = await pool.query(`SELECT id FROM dispositivos WHERE android_id = $1`, [android_id]);
    if (existing.rows.length > 0) {
      await pool.query(`UPDATE dispositivos SET modelo = $1, ultimo_acceso = NOW() WHERE android_id = $2`, [modelo, android_id]);
    } else {
      await pool.query(`INSERT INTO dispositivos (android_id, modelo) VALUES ($1, $2)`, [android_id, modelo]);
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// === PARADAS ===
app.post("/api/paradas", async (req, res) => {
  try {
    const { id, sesion_id, lat, lng, inicio } = req.body;
    await pool.query(
      `INSERT INTO paradas (id, sesion_id, lat, lng, inicio) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`,
      [id, sesion_id, lat, lng, inicio]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch("/api/paradas", async (req, res) => {
  try {
    const { id, fin, nota } = req.body;
    await pool.query(
      `UPDATE paradas SET fin = COALESCE($2, fin), nota = COALESCE($3, nota) WHERE id = $1`,
      [id, fin, nota]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/paradas", async (req, res) => {
  try {
    const { id } = req.query;
    await pool.query(`DELETE FROM parada_fotos WHERE parada_id = $1`, [id]);
    await pool.query(`DELETE FROM paradas WHERE id = $1`, [id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/paradas", async (req, res) => {
  try {
    const { sesion_id } = req.query;
    const { rows } = await pool.query(`SELECT * FROM paradas WHERE sesion_id = $1 ORDER BY inicio ASC`, [sesion_id]);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// === PARADA FOTOS ===
app.post("/api/parada-fotos", async (req, res) => {
  try {
    const { parada_id, url, grabado_en } = req.body;
    await pool.query(`INSERT INTO parada_fotos (parada_id, url, grabado_en) VALUES ($1,$2,$3)`, [parada_id, url, grabado_en]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// === ALERTAS ===
app.post("/api/alertas", async (req, res) => {
  try {
    const { android_id, tipo, mensaje } = req.body;
    await pool.query(`INSERT INTO alertas (android_id, tipo, mensaje) VALUES ($1,$2,$3)`, [android_id, tipo, mensaje]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`API running on port ${PORT}`));

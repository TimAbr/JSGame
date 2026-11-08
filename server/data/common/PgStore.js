import pg from "pg";

export async function createPgStore(connectionString) {
  const local = /localhost|127\.0\.0\.1/.test(connectionString);
  const pool = new pg.Pool({
    connectionString,
    ssl: local ? false : { rejectUnauthorized: false },
  });
  await pool.query(`
    CREATE TABLE IF NOT EXISTS rooms (
      code text PRIMARY KEY,
      listed boolean NOT NULL,
      phase text NOT NULL,
      state jsonb NOT NULL,
      updated_at bigint NOT NULL
    )
  `);
  const loaded = await pool.query("SELECT state FROM rooms");
  const saved = new Map();
  for (const row of loaded.rows) {
    const room = row.state;
    saved.set(room.code, JSON.stringify(room));
  }
  return {
    async load() {
      const rooms = {};
      for (const raw of saved.values()) {
        const room = JSON.parse(raw);
        rooms[room.code] = room;
      }
      return { rooms };
    },
    async save(state) {
      const next = state.rooms ?? {};
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        for (const code of saved.keys()) {
          if (!next[code]) {
            await client.query("DELETE FROM rooms WHERE code = $1", [code]);
            saved.delete(code);
          }
        }
        for (const room of Object.values(next)) {
          const raw = JSON.stringify(room);
          if (saved.get(room.code) === raw) continue;
          await client.query(
            `INSERT INTO rooms (code, listed, phase, state, updated_at)
             VALUES ($1, $2, $3, $4::jsonb, $5)
             ON CONFLICT (code) DO UPDATE
             SET listed = EXCLUDED.listed,
                 phase = EXCLUDED.phase,
                 state = EXCLUDED.state,
                 updated_at = EXCLUDED.updated_at`,
            [room.code, room.listed !== false, room.phase, raw, room.updatedAt ?? 0],
          );
          saved.set(room.code, raw);
        }
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
  };
}

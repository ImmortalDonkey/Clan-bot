const db = require('../database.cjs');

async function getActiveLikeEvent(guildId) {
  return await db.get(
    `SELECT * FROM events
     WHERE guild_id = ? AND status IN ('ACTIVE', 'SCHEDULED', 'PENDING_EXP')
     ORDER BY
       CASE status
         WHEN 'ACTIVE' THEN 1
         WHEN 'SCHEDULED' THEN 2
         WHEN 'PENDING_EXP' THEN 3
         ELSE 4
       END,
       CASE WHEN status = 'PENDING_EXP' THEN end_time END DESC,
       start_time ASC
     LIMIT 1`,
    [guildId]
  );
}

async function getExpTargetEvent(guildId) {
  return await db.get(
    `SELECT * FROM events
     WHERE guild_id = ? AND status IN ('PENDING_EXP', 'ACTIVE', 'SCHEDULED')
     ORDER BY
       CASE status
         WHEN 'PENDING_EXP' THEN 1
         WHEN 'ACTIVE' THEN 2
         WHEN 'SCHEDULED' THEN 3
         ELSE 4
       END,
       CASE WHEN status = 'PENDING_EXP' THEN end_time END DESC,
       start_time ASC
     LIMIT 1`,
    [guildId]
  );
}

module.exports = {
  getActiveLikeEvent,
  getExpTargetEvent
};

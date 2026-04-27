const db = require('../database.cjs');

const CHECK_INTERVAL_MS = 30_000;
let timer = null;
let running = false;

async function safeSend(client, channelId, content) {
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) return false;
    await channel.send(content);
    return true;
  } catch (err) {
    console.error(`❌ Failed to send scheduler message to channel ${channelId}:`, err.message);
    return false;
  }
}

async function startEvent(client, event) {
  const now = db.nowMs();

  await db.updateEvent(event.id, {
    status: 'ACTIVE',
    started_at: now
  });

  console.log(`✅ Event started: ${event.name} (#${event.id})`);

  await safeSend(
    client,
    event.announcement_channel_id,
    `📢 **${event.name} has started!**\n\nStart: <t:${Math.floor(event.start_time / 1000)}:F>\nEnd: <t:${Math.floor(event.end_time / 1000)}:F>`
  );
}

async function endEvent(client, event) {
  const now = db.nowMs();

  await db.updateEvent(event.id, {
    status: 'PENDING_EXP',
    ended_at: now
  });

  console.log(`⏳ Event ended and is pending EXP: ${event.name} (#${event.id})`);

  await safeSend(
    client,
    event.announcement_channel_id,
    `⏳ **${event.name} has ended.**\n\nPokémon submissions are now closed. Final results are pending EXP calculation.`
  );
}

async function tick(client) {
  if (running) return;
  running = true;

  try {
    const now = db.nowMs();

    const toStart = await db.getEventsToStart(now);
    for (const event of toStart) {
      await startEvent(client, event);
    }

    const toEnd = await db.getEventsToEnd(now);
    for (const event of toEnd) {
      await endEvent(client, event);
    }
  } catch (err) {
    console.error('❌ Event scheduler tick failed:', err);
  } finally {
    running = false;
  }
}

function startEventScheduler(client) {
  if (timer) return;

  console.log(`✅ Event scheduler running (${CHECK_INTERVAL_MS / 1000}s interval)`);
  tick(client);
  timer = setInterval(() => tick(client), CHECK_INTERVAL_MS);
}

module.exports = {
  startEventScheduler
};

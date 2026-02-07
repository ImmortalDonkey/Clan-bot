function parseRoleIds(envValue) {
  return String(envValue || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

function isClanLeader(member) {
  if (!member) return false;

  // Admin always qualifies
  if (member.permissions?.has?.('Administrator')) return true;

  const leaderRoles = parseRoleIds(process.env.CLAN_LEADER_ROLE_IDS);
  if (!leaderRoles.length) return false;

  return member.roles?.cache?.some(r => leaderRoles.includes(r.id)) || false;
}

module.exports = { isClanLeader };
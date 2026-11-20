// Recovery freshness is distinct from risk-based preservation approval.
export function backupFreshness(baselineTables, currentTables) {
  for (const tables of [baselineTables, currentTables]) {
    if (!tables || typeof tables !== 'object' || Array.isArray(tables))
      throw new Error('BACKUP_FINGERPRINT_MISSING');
    for (const table of Object.values(tables))
      if (!table || typeof table.contentSha256 !== 'string' || !table.contentSha256)
        throw new Error('BACKUP_FINGERPRINT_MISSING');
  }
  const changedTables = [
    ...new Set([...Object.keys(baselineTables), ...Object.keys(currentTables)]),
  ]
    .filter(
      (name) =>
        !baselineTables[name] ||
        !currentTables[name] ||
        baselineTables[name].contentSha256 !== currentTables[name].contentSha256,
    )
    .sort();
  return {
    backupDataStillCurrent: changedTables.length === 0,
    freshBackupRequired: changedTables.length !== 0,
    changedTables,
  };
}

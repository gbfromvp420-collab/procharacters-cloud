const { loadMemory, saveMemory } = require('./memory-store');

function getCharacterMemory(characterId, userId = 'default') {
  const memory = loadMemory();
  const key = `${characterId}:${userId}`;
  return memory[key] || { history: [], kinkProfile: {} };
}

function updateCharacterMemory(characterId, userId = 'default', newData) {
  const memory = loadMemory();
  const key = `${characterId}:${userId}`;
  memory[key] = { ...memory[key], ...newData, updatedAt: new Date().toISOString() };
  saveMemory(memory);
  return memory[key];
}

module.exports = { getCharacterMemory, updateCharacterMemory };

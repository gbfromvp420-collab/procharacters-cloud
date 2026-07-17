const fs = require('fs');
const path = require('path');

const MEMORY_FILE = path.join(__dirname, '../../data/character-memory.json');

function loadMemory() {
  if (fs.existsSync(MEMORY_FILE)) {
    return JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf8'));
  }
  return {};
}

function saveMemory(memory) {
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2));
}

module.exports = { loadMemory, saveMemory };

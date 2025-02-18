const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  nickname: String,
  level: { type: Number, default: 1 },
  experience: { type: Number, default: 0 },
  health: { type: Number, default: 100 },
  maxHealth: { type: Number, default: 100 }, // Add this to track upgraded HP
  coins: { type: Number, default: 0 },
  mysticGems: { type: Number, default: 0 },
  lastDaily: { type: Date, default: Date.now },
  dailyStreak: { type: Number, default: 0 }, 
  inventory: {
    weapons: [String],
    battleItems: mongoose.Schema.Types.Mixed,
    fish: mongoose.Schema.Types.Mixed,
    craftableItems: mongoose.Schema.Types.Mixed
  },
  equippedWeapon: String,
  equippedBattleItem: { type: String, default: null }, // ✅ Add this line
  quests: {
    active: mongoose.Schema.Types.Mixed,
    progress: mongoose.Schema.Types.Mixed,
    lastReset: Date,
    lastQuestGeneration: Date
  },
  guild: { type: String, default: null },
  
  // New fields for areas and defeated enemies
  currentArea: { type: String, default: 'mystic outskirts' }, // Store the current area
  defeatedEnemies: { type: [Number], default: [] } // Track defeated enemy IDs
});

module.exports = mongoose.model('User', userSchema);

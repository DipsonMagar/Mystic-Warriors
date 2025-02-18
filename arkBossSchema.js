const mongoose = require('mongoose');

const arkBossSchema = new mongoose.Schema({
    bossName: { type: String, required: true, unique: true },
    hp: { type: Number, required: true },
    maxHp: { type: Number, required: true },

});

module.exports = mongoose.model('ArkBoss', arkBossSchema);

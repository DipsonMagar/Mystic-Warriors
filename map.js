const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const User = require('./userSchema');
const path = require('path');

const maps = {
    'mystic outskirts': {  // ✅ Updated name
        name: 'Mystic Outskirts',
        enemies: [
            { id: 1, name: 'Goblin' },
            { id: 2, name: 'Wolf' },
            { id: 3, name: 'Orc' },
            { id: 4, name: 'Cursed Knight' },
            { id: 5, name: 'Elysia' },
            { id: 6, name: 'Ancient Guard' },
            { id: 7, name: 'Tundragon' },
            {id: 99, name: 'Goblin Lord'}
        ],
        image: './images/area1.jpg' // Local path to the image
    },
    'the forsaken ruins': {  // ✅ Updated name
        name: 'The Forsaken Ruins',
        enemies: [
            { id: 8, name: 'Goblin Raider' },
            { id: 9, name: 'Shadow Revenant' }
        ],
        image: './images/area2.jpg', // Local path to the image
        unlockRequirement: 7 // Enemy ID required to unlock
    }
};

async function handleMapCommand(message) {
    const userId = message.author.id;
    let user = await User.findOne({ userId });
    if (!user) return message.channel.send("You need to create a profile using `!mw`.");

    const currentArea = user.currentArea || 'mystic outskirts'; // ✅ Updated default area name

// Ensure area exists, otherwise reset to Mystic Outskirts
if (!maps[currentArea]) {
    console.log(`Invalid area detected: ${user.currentArea}, resetting to Mystic Outskirts`);
    user.currentArea = 'mystic outskirts';
    await user.save();
}

    const areaData = maps[currentArea];
    
    const enemyList = areaData.enemies.map(e => `**${e.name}**`).join(', ');

    const imageAttachment = new AttachmentBuilder(path.join(__dirname, areaData.image));

    const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle(`🗺️ ${areaData.name}`)
        .setDescription(`You are in **${areaData.name}**.
        
        **Available Mobs:** ${enemyList}`)
        .setImage('attachment://' + path.basename(areaData.image)); // Attach the local image

    message.channel.send({ embeds: [embed], files: [imageAttachment] });
}

async function handleExploreCommand(message, args) {
    const userId = message.author.id;
    let user = await User.findOne({ userId });
    if (!user) return message.channel.send("You need to create a profile using `!mw`.");

    const targetArea = args.join(' ').toLowerCase();
    if (!maps[targetArea]) return message.channel.send("Invalid area. Available areas: Mystic Outskirts, The Forsaken Ruins");

    if (maps[targetArea].unlockRequirement && !user.defeatedEnemies.includes(maps[targetArea].unlockRequirement)) {
        return message.channel.send("You must defeat **Tundragon (ID 7)** to unlock The Forsaken Ruins!");
    }

    user.currentArea = targetArea;
    await user.save();
    message.channel.send(`You have moved to **${maps[targetArea].name}**!`);
}

async function handleFightRestriction(user, enemyId) {
    const userArea = user.currentArea || 'mystic outskirts'; // ✅ Updated default area name
    const areaData = maps[userArea];
    return areaData.enemies.some(e => e.id === enemyId);
}

module.exports = { handleMapCommand, handleExploreCommand, handleFightRestriction };

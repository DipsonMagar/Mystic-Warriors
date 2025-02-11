const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const path = require('path');
const { questTypes,updateQuestProgress } = require('../quests');
const User = require('../userSchema');
const { activeBattles } = require('../state');
const { isUserInBattle, addUserToBattle, removeUserFromBattle } = require('../state');
const Guild = require('../guildSchema');


let frostbiteHits = 0; // Initialize a variable to keep track of the number of hits for the frostbite axe
let canUseHealPotion = true; // Cooldown tracking for Heal Potion



// Player stats (reset HP after each battle)
const playerStats = {
    maxHp: 100,
    hp: 100,
    damage: 5,
    frostbiteHits: 0,
    riftbreakerhits: 0,
};

// Enemy data with original HP values, coin rewards, and exp rewards
const enemies = {
    goblin: {
        id: 1, // 👈 Assign an ID
        maxHp: 50,
        hp: 50,
        damage: { min: 3, max: 6 },
        coinReward: { min: 10, max: 50 },
        expReward: 50,
        imagePath: path.join(__dirname, '..', 'images', 'pixelGoblin.png'),
    },
    wolf: {
        id: 2, 
        maxHp: 70,
        hp: 70,
        damage: { min: 6, max: 12 },
        coinReward: { min: 50, max: 100 },
        expReward: 100,
        imagePath: path.join(__dirname, '..', 'images', 'wolfSh.png'),
    },
    orc: {
        id: 3,
        maxHp: 200,
        hp: 200,
        damage: { min: 12, max: 24 },
        coinReward: { min: 100, max: 500 },
        expReward: 150,
        imagePath: path.join(__dirname, '..', 'images', 'pixelOrc.png'),
    },
    elysia: {
        id: 4,
        maxHp: 250,
        hp: 300,
        damage: { min: 17, max: 32 },
        coinReward: { min: 300, max: 1000 },
        expReward: 170,
        imagePath: path.join(__dirname, '..', 'images', 'pixelElysia.png'),
    },
    cursed_knight: {
        id: 5,
        maxHp: 2000,
        hp: 2000,
        damage: { min: 14, max: 21 },
        coinReward: { min: 500, max: 1500 },
        expReward: 200,
        imagePath: path.join(__dirname, '..', 'images', 'pixelCursedKnight.png'),
    },
    ancient_guard: {
        id: 6,
        maxHp: 5000,
        hp: 5000,
        damage: { min: 5, max: 18},
        coinReward: { min: 2000, max: 5000 },
        expReward: 500,
        imagePath: path.join(__dirname, '..', 'images', 'pixelAg.png'),
    },
    Tundragon: {
        id: 7,
        maxHp: 10000,
        hp: 10000,
        damage: { min: 19, max: 59 },
        coinReward: { min: 10000, max: 20000 },
        expReward: 2000,
        imagePath: path.join(__dirname, '..', 'images', 'pixelTundrag2.png'),
    }
};



// Emojis
const knifeEmoji = '<:pixelKnife:1338477364522254338>';
const steelswordEmoji = '<:pixelSteelSword:1338484405647310914>';
const coinrpgEmoji = '<:coin:1300687053792739328>';
const jadeEmoji = '<:pixelJandeSpear:1338489447775338618>';
const phoenixEmoji = '<:pixelPhoenixBlade:1338493659082919936>';
const frostbiteEmoji = '<:pixelFrostbiteAxe:1338506316557062236>';
const ancient_shard = '<:pixelAS:1338474216043057183>';
const riftbreaker = '<:pixelRiftBreaker1:1338488373890781265>';
const healpotion = '<:HealPotion:1336312639739002890>';
const mysticGemsemoji = '<:mysticgem:1336377747357831311>';
const warscythe = '<:pixelWarScythe:1338496009205973034>';
const arcaneGemstoneemoji = '<:arcanegemstone:1336716210657693727>';
const lunarfangemoji = '<:pixelLunarFang:1338500036627136623>';
const guildperkemoji = '<:guildperk:1338414611707465821>';


const weaponEmojis = {
    "knife": "<:pixelKnife:1338477364522254338>",
    "steel sword": "<:pixelSteelSword:1338484405647310914>",
    "jade spear": "<:pixelJandeSpear:1338489447775338618>",
    "phoenix blade": "<:pixelPhoenixBlade:1338493659082919936>",
    "frostbite axe": "<:pixelFrostbiteAxe:1338506316557062236>",
    "riftbreaker" : "<:pixelRiftBreaker1:1338488373890781265>",
    "war scythe" : "<:pixelWarScythe:1338496009205973034>",
    "lunar fang" : "<:pixelLunarFang:1338500036627136623>"
};


// Level up function
function checkLevelUp(userProfile) {
    const levelThresholds = [0, 100, 550, 1000, 3000, 6000, 12000, 24000, 48000, 96000,192000];
    const levelRewards = [0, 100, 500, 1000, 2000, 3000, 4000, 5000, 6000, 7000,80000];
    
    let leveledUp = false;
    let coinReward = 0;
    
    while (userProfile.experience >= levelThresholds[userProfile.level] && userProfile.level < 11) {
        userProfile.level++;
        leveledUp = true;
        coinReward += levelRewards[userProfile.level - 1];
    }
    
    return { leveledUp, coinReward };
}

const cloneEnemy = (enemyType) => {
    if (!enemies[enemyType]) {
        return null;
    }
    // Deep clone the enemy object to avoid sharing between players
    return JSON.parse(JSON.stringify(enemies[enemyType]));
};


// Function to generate the health bar
function generateHealthBar(currentHp, maxHp) {
    const barLength = 8; // Length of the health bar
    const validHp = Math.max(0, currentHp); // Ensure HP is never negative
    const filledLength = Math.max(0, Math.floor((validHp / maxHp) * barLength)); // Prevent negative repeat values
    const emptyLength = barLength - filledLength; // Remaining empty slots
    const filledBar = '▰'.repeat(filledLength); // Create filled part
    const emptyBar = '▱'.repeat(emptyLength); // Create empty part
    return `${filledBar}${emptyBar} ${validHp}/${maxHp}`; // Return formatted health bar
}

//knock
const knockedOutPlayers = new Map(); // Tracks players who are knocked out

async function handleKnockout(playerId, message) {
    knockedOutPlayers.set(playerId, true);
    
    // Send a knock-out message to the player
    // await message.channel.send(`<@${playerId}> You have been knocked out and cannot fight for **30 seconds!**`);

    // Reset knock-out status after 30 seconds
    setTimeout(() => {
        knockedOutPlayers.delete(playerId);
        message.channel.send(`<@${playerId}> You are no longer knocked out! You can fight again.`);
    }, 30000);
}


//battle
const fight = async (message, enemyType, userProfile) => {

    if (knockedOutPlayers.has(message.author.id)) {
        return message.channel.send(`<@${message.author.id}> You're knocked out! Wait until your recovery time ends before jumping back into battle.`);
    }


    const enemy = cloneEnemy(enemyType);
    if (!enemy) {
        message.channel.send('Invalid enemy type! Use !fight goblin, !fight wolf, or !fight orc.');
        return;
    }

      // 🚫 Prevent multiple battles
      if (isUserInBattle(message.author.id)) {
        return message.channel.send(`<@${message.author.id}>, you are already in a battle! Finish it first.`);
    }

    addUserToBattle(message.author.id); // ✅ Mark user as in battle


    // Player stats (reset HP after each battle)
const playerStats = {
    maxHp: userProfile.maxHealth, // Use maxHealth from DB, default to 100
    hp: userProfile.maxHealth, // Start battle with full HP
    damage: 5,
    frostbiteHits: 0,
    riftbreakerhits: 0,
    shield: 200,
};

    // Reset enemy HP and player HP at the start of each battle
    enemy.hp = enemy.maxHp;
    playerStats.hp = playerStats.maxHp;
    playerStats.riftbreakerhits = 0;

    // Initialize shield at the start of the battle
    playerStats.shield = 200; 

     // Reset frostbiteHits at the start of the battle
     playerStats.frostbiteHits = 0; 

    // Initial battle embed message
    const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle(`Fighting a ${enemyType}!`)
        .setDescription(`Your HP: ❤️${playerStats.hp}\n${enemyType.charAt(0).toUpperCase() + enemyType.slice(1)} HP: 💚${enemy.hp}`)
        .setImage(`attachment://${enemyType}_image.png`)
        .setTimestamp();

    const attachment = { files: [{ name: `${enemyType}_image.png`, attachment: enemy.imagePath }] };

    await message.channel.send({ embeds: [embed], ...attachment });


    const attackEmoji = weaponEmojis[userProfile.equippedWeapon?.toLowerCase()] || '👊'; // Default emoji if no weapon equipped

    const attackButton = new ButtonBuilder()
        .setCustomId('attack')
        .setLabel('Attack')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(attackEmoji);

    const forfeitButton = new ButtonBuilder()
        .setCustomId('forfeit')
        .setLabel('🚪Forfeit')
        .setStyle(ButtonStyle.Danger);

        const healPotionButton = new ButtonBuilder()
        .setCustomId('healPotion')
        .setLabel('Heal Potion')
        .setEmoji('1336312639739002890')
        .setStyle(ButtonStyle.Success)
        .setDisabled(!userProfile.inventory.battleItems || !userProfile.inventory.battleItems["Heal Potion"] || userProfile.inventory.battleItems["Heal Potion"] <= 0);

    
        

    const row = new ActionRowBuilder().addComponents(attackButton, forfeitButton, healPotionButton);

    await message.channel.send({ embeds: [embed], components: [row] });

    const filter = (interaction) => interaction.user.id === message.author.id;
    const collector = message.channel.createMessageComponentCollector({ filter, time: 300000 });
    
    collector.on('collect', async (interaction) => {
        if (!interaction.isButton()) return; // Ensure it's a button press

const userId = interaction.user.id;

if (!activeBattles[userId]) {
    activeBattles[userId] = { lastPress: 0 };
}

const now = Date.now();
const cooldown = 1000; // 1 second cooldown per button press

if (now - activeBattles[userId].lastPress < cooldown) {
    return interaction.reply({ content: '⏳ Slow down! Wait a moment before pressing again.', ephemeral: true });
}

activeBattles[userId].lastPress = now;

        if (interaction.customId === 'healPotion') {
            if (!canUseHealPotion)return;
            

            if (userProfile.inventory.battleItems["Heal Potion"] > 0) {
                playerStats.hp = Math.min(playerStats.hp + 30, playerStats.maxHp);
                userProfile.inventory.battleItems["Heal Potion"] -= 1;
                canUseHealPotion = false; // Disable Heal Potion usage for the next turn

    
                // Update the database with the new count
                await User.findByIdAndUpdate(userProfile._id, { $set: { 'inventory.battleItems': userProfile.inventory.battleItems } });
    
                embed.setDescription(`HP: 💚 ${generateHealthBar(enemy.hp, enemy.maxHp)}\n\nYour HP: ❤️ ${generateHealthBar(playerStats.hp, playerStats.maxHp)}\n\nYou used a ${healpotion} Heal Potion! ❤️ Your HP is now ${playerStats.hp}/${playerStats.maxHp}.`);
                healPotionButton.setDisabled(true); // Disable the button immediately
                // healPotionButton.setDisabled(userProfile.inventory.battleItems["Heal Potion"] <= 0);
                row.setComponents(attackButton, forfeitButton, healPotionButton);
    
                try {
                    if (interaction.replied || interaction.deferred) {
                        await interaction.followUp({ embeds: [embed], components: [row] });
                    } else {
                        await interaction.update({ embeds: [embed], components: [row] });
                    }
                } catch (error) {
                    console.error("Failed to update interaction:", error.message);
                }
                
            } else {
                await interaction.reply({ content: 'You have no Heal Potions left!', ephemeral: true });
            }
        }


        if (interaction.customId === 'attack') {

        let arcaneBoostMessage = ""; // Ensure it's always initialized
        let instantkill = "";
        let dodgemsg = "";


            let playerDamage = playerStats.damage;
            let attackName = 'Punch';
            let healingMessage = '';
            
           
            

            if (userProfile.equippedWeapon) {

                if (userProfile.equippedWeapon === 'knife') {
                    playerDamage = 15;
                    attackName = `Cut with ${knifeEmoji} Knife`;
                } else if (userProfile.equippedWeapon === 'steel sword') {
                    playerDamage = 40;
                    attackName = `Slash with ${steelswordEmoji}Steel Sword`;
                } else if (userProfile.equippedWeapon === 'jade spear'){
                    playerDamage = 65;
                    attackName = `Pierce with ${jadeEmoji} Jade Spear`;
                }  else if (userProfile.equippedWeapon === 'phoenix blade') {
                    playerDamage = 298; // Set base damage
                    attackName = `Phoenix Flame Strike with ${phoenixEmoji} Phoenix Blade!`;

                    // Heal the player by 10 HP
                    if (playerStats.hp < playerStats.maxHp) {
                        playerStats.hp += 30; // Heal player
                        if (playerStats.hp > playerStats.maxHp) {
                            playerStats.hp = playerStats.maxHp; // Cap HP at maxHp
                        }
                        // Add healing message
                        healingMessage = `You healed ❤️30 HP! using **Phoenix Robe**`;
                    }
                } else if (userProfile.equippedWeapon === 'frostbite axe') {
                    playerStats.frostbiteHits++; // Increment the hit count
                    playerDamage = 130 + (playerStats.frostbiteHits - 1) * 20; // Calculate damage based on hits
                    
                    // Cap the damage to a maximum of 599
                    if (playerDamage > 599) {
                        playerDamage = 599;
                    }
                
                    attackName = `Blizzard Strike with ${frostbiteEmoji} Frostbite Axe!`;
                    
                    // Set message for increased attack
                    if (playerStats.frostbiteHits > 1) {
                        attackName += `\nWeapon Attack has increased by 10! Current damage: ${playerDamage}`;
                    }
                }else  if (userProfile.equippedWeapon === 'riftbreaker') {
                    playerStats.riftbreakerhits++; // Increment the attack count
                    
                    // Regular attack damage
                    playerDamage = 500;
                    attackName = `Titan’s Rift Cleave with ${riftbreaker} Riftbreaker`;
                
                    // If the player has hit 5 times, trigger the Ultimate attack automatically
                    if (playerStats.riftbreakerhits >= 2) {
                        const riftbreakerDamage = 500; // Base damage of Riftbreaker
                        const ultimateDamage = riftbreakerDamage * 3; // Ultimate damage multiplier
                        enemy.hp -= ultimateDamage; // Apply damage to the enemy
                
                        // Heal the player by 50 HP (but not exceeding max HP)
                        playerStats.hp = Math.min(playerStats.hp + 50, playerStats.maxHp);
                
                        // Reset the hit count
                        playerStats.riftbreakerhits = 0;
                
                        // Update attack name to reflect the Ultimate attack
                        attackName = `💥Titan’s Wrath 💥${ultimateDamage} damage! You gained ❤️50 HP!`;
                    }
                }else if (userProfile.equippedWeapon === 'war scythe') {
                    playerDamage = 289;
                    attackName = `Phantom Strike with ${warscythe} War Scythe`;
                
                    // 🔥 Reaper’s Fury: If HP is below 40%, double the damage
                    if (playerStats.hp <= playerStats.maxHp * 0.5) {
                        playerDamage *= 2;
                        attackName += `\n🩸 **Reaper’s Fury Activated!** Damage Doubled to 💥${playerDamage}!`;
                    }
                }else if (userProfile.equippedWeapon === 'lunar fang') {
                    playerDamage = 399;
                    attackName = `Shadow Slash with ${lunarfangemoji} Lunar Fang`;

                    // Instant Kill Logic
                    if (enemy.hp <= enemy.maxHp * 0.25) {
                        enemy.hp = 0;
                        instantkill = `${lunarfangemoji} **Lunar Fang's deadly edge instantly slays the ${enemyType}!**\n`;
                    }

                    // Night Veil Activation
                    if (userProfile.equippedWeapon === 'lunar fang') {
                        const nightVeilChance = Math.random();
                        if (nightVeilChance <= 0.5) {
                            playerStats.nightVeilActive = true;
                            dodgemsg = `\n**Night Veil Activated! You dodge enemy attack!**`;
                        } else {
                            dodgemsg = '';
                        }
                    } else {
                        playerStats.nightVeilActive = false; // Reset Night Veil when not using Lunar Fang
                    }
                    
                }
                
                


                //battleitems
                if (userProfile.equippedBattleItem === 'Arcane Gemstone') {
                    playerDamage += 299;
                    arcaneBoostMessage = `\n${arcaneGemstoneemoji} Arcane Gemstone boosted Damage!`;
                } 
            }

            enemy.hp -= playerDamage;

            



            if (enemy.hp <= 0) {
                collector.stop();
            
                const goldReward = Math.floor(Math.random() * (enemy.coinReward.max - enemy.coinReward.min + 1)) + enemy.coinReward.min;

                // Default final gold reward (no bonus)
                let finalGoldReward = goldReward;
                let guildBonusMessage = "";
                
                // Check if the user is in a guild and if the guild has perks
                if (userProfile.guild) {
                    const guild = await Guild.findOne({ name: userProfile.guild });
                    if (guild && guild.level > 1) { // Only apply bonus if Level > 1
                        const bonusPercentage = guild.goldBonus || 0;
                        const bonusAmount = Math.floor((goldReward * bonusPercentage) / 100);
                        finalGoldReward += bonusAmount;
                        guildBonusMessage = `\n${guildperkemoji} **Coin Bonus (Guild Perk):** ${coinrpgEmoji} +${bonusAmount} coins (${bonusPercentage}%)`;
                    }
                }
                
                // Apply the final gold reward
                userProfile.coins += finalGoldReward;
                
                const expReward = enemy.expReward;
                userProfile.experience += expReward;
                




                //drop items boss
                //Ancient Shard
                if (enemyType === 'ancient_guard') {
                    const dropChance = Math.random();
                    if (dropChance <= 0.3) { 
                        // Generate a random number between 1 and 5
                        const droppedAmount = Math.floor(Math.random() * 5) + 1;
                        const droppedItem = 'Ancient Shard';
                
                        // Ensure the inventory and craftableItems object exists
                        if (!userProfile.inventory.craftableItems) {
                            userProfile.inventory.craftableItems = {};
                        }
                
                        // Increment the count or add the item
                        userProfile.inventory.craftableItems[droppedItem] =
                            (userProfile.inventory.craftableItems[droppedItem] || 0) + droppedAmount;
                
                        // Save the updated user profile to MongoDB
                        await User.findByIdAndUpdate(
                            userProfile._id,
                            { $set: { 'inventory.craftableItems': userProfile.inventory.craftableItems } },
                            { new: true }
                        );
                
                        // Send plain text message with the random drop amount
                        await message.channel.send(`<@${message.author.id}> Ancient Guard dropped x${droppedAmount} ${ancient_shard} ${droppedItem}`);
                    }
                }
                
                if (enemyType === 'Tundragon') {
                    const dropChance = Math.random(); // Generates a number between 0 and 1
                
                    if (dropChance <= 0.4) { // 40% chance
                        const mysticGemsDropped = Math.floor(Math.random() * 10) + 1; // Random between 1 and 10
                
                        // Ensure the inventory exists
                        if (!userProfile.mysticGems) {
                            userProfile.mysticGems = 0;
                        }
                
                        userProfile.mysticGems += mysticGemsDropped;
                
                        // Save the updated user profile to MongoDB
                        await User.findByIdAndUpdate(
                            userProfile._id,
                            { $set: { mysticGems: userProfile.mysticGems } },
                            { new: true }
                        );
                
                        await message.channel.send(`<@${message.author.id}> **Tundragon dropped ${mysticGemsemoji} ${mysticGemsDropped} Mystic Gems!**`);
                    }
                }

                if (enemyType === 'ancient_guard') {
                    const dropChance = Math.random(); // Generates a number between 0 and 1
                
                    if (dropChance <= 0.3) { // 30% chance
                        const mysticGemsDropped = Math.floor(Math.random() * 5) + 1; // Random between 1 and 10
                
                        // Ensure the inventory exists
                        if (!userProfile.mysticGems) {
                            userProfile.mysticGems = 0;
                        }
                
                        userProfile.mysticGems += mysticGemsDropped;
                
                        // Save the updated user profile to MongoDB
                        await User.findByIdAndUpdate(
                            userProfile._id,
                            { $set: { mysticGems: userProfile.mysticGems } },
                            { new: true }
                        );
                
                        await message.channel.send(`<@${message.author.id}> **Ancient Guard dropped ${mysticGemsemoji} ${mysticGemsDropped} Mystic Gems!**`);
                    }
                }
                
                if (enemyType === 'cursed_knight') {
                    const dropChance = Math.random(); // Generates a number between 0 and 1
                
                    if (dropChance <= 0.2) { // 20% chance
                        const mysticGemsDropped = Math.floor(Math.random() * 3) + 1; // Random between 1 and 10
                
                        // Ensure the inventory exists
                        if (!userProfile.mysticGems) {
                            userProfile.mysticGems = 0;
                        }
                
                        userProfile.mysticGems += mysticGemsDropped;
                
                        // Save the updated user profile to MongoDB
                        await User.findByIdAndUpdate(
                            userProfile._id,
                            { $set: { mysticGems: userProfile.mysticGems } },
                            { new: true }
                        );
                
                        await message.channel.send(`<@${message.author.id}> **Cursed Knight dropped ${mysticGemsemoji} ${mysticGemsDropped} Mystic Gems!**`);
                    }
                }
                
                
                // Create a new embed for the victory message
                const victoryEmbed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle(`Victory against ${enemyType}!`)
                    .setDescription(`${instantkill}\nYou defeated the ${enemyType} and earned ${coinrpgEmoji} ${goldReward} Coins and ${expReward} EXP!\n${guildBonusMessage}`)
                    .setTimestamp();

                    
                
                // Check for level up
                const levelUpResult = checkLevelUp(userProfile);
                if (levelUpResult.leveledUp) {
                    victoryEmbed.addFields(
                        { name: 'Level Up!', value: `You've reached level ${userProfile.level}!` }
                    );
                    if (levelUpResult.coinReward > 0) {
                        userProfile.coins += levelUpResult.coinReward;
                        victoryEmbed.addFields(
                            { name: 'Level Up Reward', value: `You've earned ${coinrpgEmoji} ${levelUpResult.coinReward} coins!` }
                        );
                    }
                }


            
                // Update quest progress and add quest completion message
                // Inside your fight function, where you handle quest completion
               // Update quest progress and add quest completion message
                console.log('Before updating quest progress:', userProfile.quests); // Debug log

                // Update quest progress
                // Update quest progress
                const questResult = await updateQuestProgress(userProfile, enemyType); // Ensure this is awaited

                if (questResult) {
                    console.log('Quest progress updated and saved:', questResult);

                    if (questResult.completedQuests.length > 0) {
                        const questNames = questResult.completedQuestNames.join('\n• ');
                        victoryEmbed.addFields({
                            name: '🎯 Quests Completed!',
                            value: `You completed the following quests:\n• ${questNames}\n\nRewards earned:\n${questResult.rewardsGained.coins} coins\n${questResult.rewardsGained.exp} EXP`,
                        });
                    }
                } else {
                    console.log('No quests were updated.');
                }


                console.log('Quests object before saving:', JSON.stringify(userProfile.quests, null, 2));



                await userProfile.save();
                
                // Send the final victory message with all rewards
                await interaction.update({ embeds: [victoryEmbed], components: [] });
                collector.stop();   
                
            } else {
                let enemyDamage = Math.floor(Math.random() * (enemy.damage.max - enemy.damage.min + 1)) + enemy.damage.min;
                if (playerStats.nightVeilActive) {
                    enemyDamage = Math.floor(enemyDamage * 0);
                    playerStats.nightVeilActive = false; // Reset Night Veil after reducing damage
                }
                // playerStats.hp -= enemyDamage;
                let damageTaken = enemyDamage;

                let shieldMessage = '';
                

                // Check if shield is active and the equipped weapon is Frostbite Axe
                if (playerStats.shield > 0 && userProfile.equippedWeapon === 'frostbite axe') {
                    const damageBlocked = Math.min(damageTaken, playerStats.shield);
                    playerStats.shield -= damageBlocked; // Reduce shield
                    damageTaken -= damageBlocked; // Remaining damage after shield

                    // Set the shield message
                    shieldMessage = `**Frost Shield** is active! Your shield blocked ${damageBlocked} damage! Shield remaining: 🛡️${playerStats.shield}`;

                    // Check if shield is broken
                if (playerStats.shield <= 0) {
                    shieldMessage += `\nShield broke!`;
                    }
                }

                // Apply remaining damage to player's HP
                playerStats.hp -= damageTaken;

                // Prepare the embed description
                // Update battle embed after an attack
                let description = ` ${enemyType.charAt(0).toUpperCase() + enemyType.slice(1)} HP: 💚 ${generateHealthBar(enemy.hp, enemy.maxHp)}\n\nYour HP: ❤️ ${generateHealthBar(playerStats.hp, playerStats.maxHp)}\n\nYou used **${attackName}** and did 💥${playerDamage} damage! | ${enemyType.charAt(0).toUpperCase() + enemyType.slice(1)} attacked you! 💥${enemyDamage} damage!\n ${arcaneBoostMessage}\n${dodgemsg}`;

                // ✅ Re-enable heal button ONLY IF player still has potions
            if (userProfile.inventory.battleItems && userProfile.inventory.battleItems["Heal Potion"] > 0) {
            canUseHealPotion = true;
            healPotionButton.setDisabled(false);
        }
            row.setComponents(attackButton, forfeitButton, healPotionButton);

                if (healingMessage) {
                    description += `\n${healingMessage}`; // This will only add if healing occurred
                }

                // Add shield message if it exists
                if (shieldMessage) {
                    description += `\n${shieldMessage}`;
                }

                embed.setDescription(description);
                try {
                    if (interaction.replied || interaction.deferred) {
                        await interaction.followUp({ embeds: [embed], components: [row] });
                    } else {
                        await interaction.update({ embeds: [embed], components: [row] });
                    }
                } catch (error) {
                    console.error("Failed to update interaction:", error.message);
                }
                

                if (playerStats.hp <= 0) {
                    playerStats.hp = 0; // Ensure no negative HP
                    collector.stop(); // Stop this player's battle
                
                    await handleKnockout(message.author.id, message);
                
                    const defeatEmbed = new EmbedBuilder()
                        .setColor('#FF0000')
                        .setTitle('Defeat')
                        .setDescription(`You were defeated by the ${enemyType}. You are knocked out!💫`)
                        .setTimestamp();
                
                    await interaction.followUp({ embeds: [defeatEmbed], components: [] });
                    return;
                }
                
                
            } 


            
            

        } else if (interaction.customId === 'forfeit') {
            embed.setDescription('Forfeited! You have chosen to forfeit the battle.');
            await interaction.update({ embeds: [embed], components: [] });
            collector.stop();
        }
    });

    collector.on('end', () => {
        removeUserFromBattle(message.author.id); // ✅ Remove user from battle when fight ends
        message.channel.send({ content: 'The battle has ended!', embeds: [], components: [] });
    });

};

module.exports = { fight, enemies, knockedOutPlayers };
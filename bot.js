require('dotenv').config(); // Load environment variables
const fs = require('fs'); // Import the file system module
const { Client, GatewayIntentBits, EmbedBuilder, ActivityType, AttachmentBuilder } = require('discord.js');
const mongoose = require('mongoose');
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
const { fight, enemies, knockedOutPlayers } = require('./battle/battle');
const { questTypes,generateDailyQuests, updateQuestProgress, claimQuest, displayQuests, remainingCooldown } = require('./quests');
const { random } = require('lodash');
const User = require('./userSchema'); // Import your model
const { activeBattles, isUserSearching, addUserToSearch, removeUserFromSearch, searchingPlayers } = require('./state.js');
const Market = require('./marketSchema.js'); // Market schema to store listings
const allowedMarketWeapons = ['riftbreaker', 'frostbite axe'];
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Guild = require('./guildSchema');
const { handleMapCommand, handleExploreCommand } = require('./map.js');
const ArkBoss = require('./arkBossSchema'); // Import schema

async function getUserProfile(userId) {
    try {
        return await User.findOne({ userId: userId });
    } catch (error) {
        console.error("Error fetching user profile:", error);
        return null;
    }
}

async function updateUserProfile(userId, updateData) {
    try {
        // Update the user profile with new data
        return await User.findOneAndUpdate({ userId: userId }, updateData, { new: true, upsert: true });
    } catch (error) {
        console.error("Error updating user profile:", error);
    }
}



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


const battleItemEmojis = {
    "heal potion": "<:HealPotion:1336312639739002890>",
    "arcane gemstone": "<:arcanegemstone:1336716210657693727>"
   
};

const fishEmojis = {
    "tuna": "🐟",
    "salmon": "🐠",
    "golden salmon": "<:goldensalmon:1336395082852728932>",
    "golden tuna": "<:goldentuna:1336394637161529416>"
};

const craftableItemEmojis = {
    "ancient shard": "<:pixelAS:1338474216043057183>",
};

const verify = {
    "verified" : "<:Verified:1338013411304411196>"
}

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    
    // Updated status setting syntax
    client.user.setActivity('!mwhelp', { type: ActivityType.Playing });
});



// Replace loadProfiles() with:
async function getUserProfile(userId) {
    let user = await User.findOne({ userId });
    if (!user) {
      user = new User({ userId });
      await user.save();
    }
    return user;
  }
  
  // Replace saveProfiles() with:
  async function saveUserProfile(user) {
    await user.save();
  }

  async function hasProfile(userId) {
    const userProfile = await getUserProfile(userId);
    return userProfile && userProfile.nickname; // Ensure the profile has a nickname, which indicates a complete profile
}

const cooldowns = {};
// Command listener
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const userId = message.author.id;

    // !mw command to create profile
    if (message.content === '!mw') {
        let userProfile = await getUserProfile(userId);

        if (!userProfile || !userProfile.nickname) { // If the user doesn't have a profile or a nickname
            // Create a new profile
            if (!userProfile) {
                userProfile = new User({
                    userId: userId,
                    nickname: null,
                    level: 1,
                    experience: 0,
                    health: 100,
                    coins: 0,
                    mysticGems: 0,
                    lastDaily: 0,
                    dailyStreak: 0,
                    inventory: {
                        weapons: [],
                        battleItems: {},
                        fish: {},
                        craftableItems: {}
                    },
                    guild: null, // ✅ Add guild field
                    currentArea: 'mystic outskirts', // ✅ Ensure new players start in Area 1
                    defeatedEnemies: [] // ✅ Initialize defeated enemies array
                });
            }

            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('⚔️WELCOME TO Mystic Warriors!⚔️')
                .setDescription('Your profile has been created! 👼\nPlease provide a **nickname by typing** it below.');

            await message.channel.send({ embeds: [embed] });

            // Collect the nickname from the user
            const filter = (response) => response.author.id === userId;
            const collector = message.channel.createMessageCollector({ filter, time: 30000, max: 1 });

            collector.on('collect', async (response) => {
                const nickname = response.content.trim();

                if (nickname.length === 0) {
                    message.channel.send("Invalid nickname. Please try again later using the !nick command.");
                    return;
                }

                // Save the nickname and update the user profile
                userProfile.nickname = nickname;
                await saveUserProfile(userProfile);

                const embed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('Nickname Set!')
                    .setDescription(`Your nickname has been set to **${nickname}**. You can now use \`!mw\` to start playing.`);
                    

                await message.channel.send({ embeds: [embed] });
            });

            collector.on('end', async (collected) => {
                if (collected.size === 0) {
                    message.channel.send('No nickname was set. You can set it later using !nick.');
                }
            });
        } else {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('⚔️WELCOME BACK TO Mystic Warriors!⚔️')
                .setDescription('What do you want to do?\n `!quests` \n `!fight` \n `!fish` \n `!shop` \n`!inventory`');

            await message.channel.send({ embeds: [embed] });
        }
        return; // Make sure to return after processing the !mw command
    }

    // Global check for other commands to ensure user has a profile
// List of valid commands
const validCommands = [
    "!fight", "!ft", "!fish", "!shop", "!sh", "!mwhelp", "!nick", "!profile", "!pro",
    "!inventory", "!inv", "!daily", "!balance", "!bal", "!give", "!quests", "!q",
    "!sell", "!craft", "!finfo", "!weapons", "!wp", "!enemy", "!enm"
];

// Check if the message is a valid command
const isCommand = validCommands.some(cmd => message.content.startsWith(cmd));

if (isCommand) {
    let userProfile = await getUserProfile(userId);
    if (!userProfile || !userProfile.nickname) {
        message.channel.send("You need to create a profile first by using `!mw`.");
        return;
    }
}



    // Cooldown time in milliseconds (5 seconds = 5000 milliseconds)
    const cooldownTime = 15000;

    // Handle !fish command with cooldown
    if (message.content.startsWith('!fish')) {
        const lastUsed = cooldowns[`fish_${userId}`];

        if (lastUsed && (Date.now() - lastUsed) < cooldownTime) {
            const timeLeft = ((cooldownTime - (Date.now() - lastUsed)) / 1000).toFixed(1);
            message.channel.send(`You must wait **${timeLeft}** seconds before using \`!fish\` again.`);
            return;
        }

        // Execute the !fish command logic
        // message.channel.send("You cast your fishing rod 🎣!");
        // Update the cooldown for the user
        cooldowns[`fish_${userId}`] = Date.now();
    }



    // Command to set nickname
if (message.content.startsWith('!nick')) {
    const userId = message.author.id;
    const args = message.content.split(' ').slice(1);
    const nickname = args.join(' ').trim();

    try {
        // Fetch user profile from MongoDB
        let userProfile = await getUserProfile(userId);

        if (!userProfile) {
            message.channel.send("You need to create a profile first using !mw.");
            return;
        }

        if (nickname.length === 0) {
            message.channel.send("Please provide a valid nickname.");
            return;
        }

        // Set the user's nickname in their profile
        userProfile.nickname = nickname;

        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('Nickname Set!')
            .setDescription(`Your nickname has been set to **${nickname}**.`);

        // Send confirmation message
        await message.channel.send({ embeds: [embed] });

        // Save the updated profile to MongoDB
        await saveUserProfile(userProfile);

    } catch (error) {
        console.error('Error setting nickname:', error);
        message.channel.send("An error occurred while setting your nickname. Please try again later.");
    }
}

//profile view

if (message.content.startsWith('!profile') || message.content.startsWith('!pro')) {
    const mentionedUser = message.mentions.users.first() || message.author;
    const userId = mentionedUser.id;

    // Fetch user profile from MongoDB
    let userProfile = await getUserProfile(userId);

    if (userProfile) {
        const nickname = userProfile.nickname || mentionedUser.username;

        // Check if the player is knocked out
        const isKnockedOut = knockedOutPlayers.has(userId);
        const healthStatus = isKnockedOut 
            ? '💫 **Knocked Out (0 HP ❤️)**' 
            : `**${userProfile.maxHealth} HP**`;

        // Fetch guild information (if the user is in a guild)
        const userGuild = await Guild.findOne({ members: userId });
        let guildInfo = "❌ No Guild";
        if (userGuild) {
            guildInfo = `**${userGuild.name}** ${userGuild.verified ? verify.verified : "❌ Not Verified"}`;
        }

        // Create the fancy profile embed
        const embed = new EmbedBuilder()
            .setColor('#ff9500') // Vibrant gold-orange color
            .setTitle(`👑 ${nickname}'s Profile`)
            .setThumbnail(mentionedUser.displayAvatarURL({ dynamic: true, size: 256 }))
            .setDescription(
                `**🆔 Name:** ${nickname}\n` +
                `**🎚 Level:** ${userProfile.level}\n` +
                `**⭐ Experience:** ${userProfile.experience}\n` +
                `**🛡️ Guild:** ${guildInfo}\n` +
                `**❤️ Health:** ${healthStatus}`
            )
            .setFooter({ text: "Mystic Warriors RPG", iconURL: message.guild.iconURL() })
            .setTimestamp();

        message.channel.send({ embeds: [embed] });

    } else {
        const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('❌ Profile Not Found')
            .setDescription(`${mentionedUser.username} does not have a profile yet. Use **!mw** to create one!`)
            .setThumbnail(mentionedUser.displayAvatarURL({ dynamic: true, size: 256 }));

        message.channel.send({ embeds: [embed] });
    }
}
    
    
        // BATTLE
        // Prevent command usage if the user is in a battle
        if (activeBattles.has(message.author.id)) {
            return message.channel.send(`<@${message.author.id}>, you are currently in battle! Finish your fight before using other commands.`);
        }
        
        if (isUserSearching(message.author.id)) {
            return message.channel.send(`<@${message.author.id}>, you're already searching for an enemy. Please wait until the search is complete.`);
        }
        

        if (message.content.startsWith('!fight') || message.content.startsWith('!ft')) {
            const knightsearch = '<a:GUPE_KNIGHT:1336599928713252955>';
            const fightingEmoji = '<a:battleing:1336603306788651039>';

            const args = message.content.split(' ').slice(1);
            if (args.length === 0) {
                return message.channel.send("Please specify an enemy name or ID. Example: `!fight goblin` or `!fight 1`. View available enemy : `!enm or !enemy`");
            }else if (knockedOutPlayers.has(message.author.id)) {
                return message.channel.send(`<@${message.author.id}>, you're knocked out! Wait until your recovery time ends before jumping back into battle.`);
            }
        
            const userId = message.author.id;
            let enemyType = args[0].toLowerCase();
            let userProfile = await getUserProfile(userId);
        
            if (!userProfile) {
                return message.channel.send("You need to create a profile first using `!mw`.");
            }
        
            let selectedEnemy = Object.keys(enemies).find(key => key === enemyType) ||
                                Object.keys(enemies).find(key => enemies[key].id.toString() === enemyType);
        
            if (!selectedEnemy) {
                const enemyList = Object.entries(enemies)
                    .map(([name, data]) => `${data.id}. ${name.charAt(0).toUpperCase() + name.slice(1)}`)
                    .join("\n");
        
                const embed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle("Available Enemies:")
                    .setDescription(`Use \`!fight [enemy name]\` or \`!fight [enemy id]\`.\n\n${enemyList}`);
        
                return message.channel.send({ embeds: [embed] });
            }
        
            if (isUserSearching(userId)) {
                return message.channel.send("You're already searching for an enemy. Please wait.");
            }
        
            addUserToSearch(userId); // Mark user as searching
            const searchMessage = await message.channel.send(`${knightsearch} Searching for ${selectedEnemy}...`);
        
            const delay = Math.floor(Math.random() * 9000) + 1000;
        
            setTimeout(async () => {
                await searchMessage.edit(`${selectedEnemy} found! ${fightingEmoji}`);
                fight(message, selectedEnemy, userProfile);
                removeUserFromSearch(userId); // Remove search status after completion
            }, delay);
        }

        /// Add the Shop command
        const knifeEmoji = '<:pixelKnife:1338477364522254338>';
        const steelswordEmoji = '<:pixelSteelSword:1338484405647310914>';
        const coinrpgEmoji = '<:coin:1300687053792739328>';
        const jadeEmoji = '<:pixelJandeSpear:1338489447775338618>';
        const phoenixEmoji = '<:pixelPhoenixBlade:1338493659082919936>';
        const frostbiteEmoji = '<:pixelFrostbiteAxe:1338506316557062236>';
        const healpotion = '<:HealPotion:1336312639739002890>';
        const ancient_shard = '<:pixelAS:1338474216043057183>';
        const riftbreaker = '<:pixelRiftBreaker1:1338488373890781265>';
        const mysticGemsemoji = '<:mysticgem:1336377747357831311>';
        const warscythe = '<:pixelWarScythe:1338496009205973034>';
        const arcaneGemstoneemoji = '<:arcanegemstone:1336716210657693727>';
        const lunarfangemoji = '<:pixelLunarFang:1338500036627136623>';
        const guildemoji = '<:guild:1338012707651190854>';
        const verificationemoji = '<:Verified:1338013411304411196>';


        if (message.content === '!shop' || message.content === '!s') {
            const userId = message.author.id;
        
            // Fetch user profile from MongoDB
            let userProfile = await getUserProfile(userId);
        
            // Check if the user has a profile
            if (!userProfile) {
                message.channel.send("You need to create a profile first using !mw.");
                return;
            }
        
            const coins = userProfile.coins; // Get user's coin balance
            const mysticGems = userProfile.mysticGems; // Get user's gem balance
        
            const embed = new EmbedBuilder()
                .setColor('#ff9300')
                .setTitle('==================⚖️ Welcome to the Shop! ⚖️================== ')
                .setDescription(`**Your Balance**\n${coinrpgEmoji}Coin: **${coins}** | ${mysticGemsemoji}Mystic Gems: **${mysticGems}**\n\n
                **Weapons:**\n
                \`1.\` ${knifeEmoji} \`Knife ---\` ${coinrpgEmoji} \`1000 (Deals 15 Damage)\`\n
                \`2.\` ${steelswordEmoji} \`Steel Sword ---\` ${coinrpgEmoji} \`6500 (Deals 40 Damage)\`\n
                \`3.\` ${jadeEmoji} \`Jade Spear ---\` ${coinrpgEmoji} \`25000 (Deals 65 Damage)\`\n
                \`4.\` ${phoenixEmoji} \`Phoenix Blade ---\` ${mysticGemsemoji} \`219 (Deals 298 Damage and recovers user's HP by +30)\`\n
                \`5.\` ${warscythe} \`War Scythe ---\`${coinrpgEmoji}\`50000 (Deals 189 Damage)\`\n
                \`6.\` ${lunarfangemoji} \`Lunar Fang ---\` ${coinrpgEmoji} \`100000 (Deals 399 Damage, Instantly Kill Enemy If 25% HP, Chance to dodge enemy attack)\`\n\n
                *For more weapon info use \`!wp\`*\n\n
                **Battle Items:**\n
                \`1.\` ${healpotion} \`Heal Potion ---\` ${coinrpgEmoji} \`950 (Heals 10 HP During Battle)\`\n
                \`2.\` ${arcaneGemstoneemoji} \`Arcane Gemstone ---\`${mysticGemsemoji} \`109 (+299 Damage to enemy)\` \n\n
                To buy, use \`!shop buy [item name]\``
                )
                .setTimestamp();
            message.channel.send({ embeds: [embed] });
        }
        
        if (message.content.startsWith('!shop buy') || message.content.startsWith('!s b')) {
            const userId = message.author.id;
            const args = message.content.split(' ');
        
            let itemName, quantity;
        
            // Check if the last argument is a number (for battle items)
            if (!isNaN(args[args.length - 1])) {
                quantity = parseInt(args.pop(), 10); // Remove and store the quantity
                itemName = args.slice(2).join(' ').trim().toLowerCase(); // Get the full item name
            } else {
                quantity = 1; // Default to 1 for weapons
                itemName = args.slice(2).join(' ').trim().toLowerCase();
            }
        
            // Fetch user profile from MongoDB
            let userProfile = await getUserProfile(userId);
        
            if (!userProfile) {
                message.channel.send("You need to create a profile first using !mw.");
                return;
            }
        
            const userInventory = userProfile.inventory.weapons.map(item => item.toLowerCase());
        
            const purchaseItem = async (cost, currency, itemFullName, inventoryType, quantity = 1) => {
                const totalCost = cost * quantity;
        
                if (userProfile[currency] >= totalCost) {
                    userProfile[currency] -= totalCost;
        
                    if (inventoryType === 'weapons') {
                        userProfile.inventory.weapons.push(itemFullName);
                    } else if (inventoryType === 'battleItems') {
                        if (typeof userProfile.inventory.battleItems !== 'object') {
                            userProfile.inventory.battleItems = {};
                        }
        
                        userProfile.inventory.battleItems[itemFullName] =
                            (userProfile.inventory.battleItems[itemFullName] || 0) + quantity;
        
                        await User.updateOne(
                            { userId: userProfile.userId },
                            { $set: { 'inventory.battleItems': userProfile.inventory.battleItems } }
                        );
                    }
        
                    const emoji = weaponEmojis[itemFullName.toLowerCase()] || battleItemEmojis[itemFullName.toLowerCase()] || "";
                    const embed = new EmbedBuilder()
                        .setColor('#ff9300')
                        .setTitle('Purchase Successful!')
                        .setDescription(`You have bought ${emoji} **${quantity}x ${itemFullName} for ${totalCost}**!`);
                    message.channel.send({ embeds: [embed] });
        
                    await saveUserProfile(userProfile);
                } else {
                    message.channel.send({
                        embeds: [new EmbedBuilder()
                            .setColor('#ff0000')
                            .setTitle('Not Enough Funds!')
                            .setDescription(`You need ${totalCost} ${currency === 'coins' ? 'coins' : `${mysticGemsemoji} Mystic Gems`} to buy ${quantity}x ${itemFullName}.`)]
                    });
                }
            };
        
            if (itemName === 'knife') {
                if (userInventory.includes('knife')) {
                    message.channel.send({
                        embeds: [new EmbedBuilder()
                            .setColor('#ff0000')
                            .setTitle(`Already Own Knife!`)
                            .setDescription(`You already have a ${knifeEmoji} Knife in your inventory.`)]
                    });
                } else {
                    await purchaseItem(1000, 'coins', 'Knife', 'weapons');
                }
            } else if (itemName === 'steel sword') {
                if (userInventory.includes('steel sword')) {
                    message.channel.send({
                        embeds: [new EmbedBuilder()
                            .setColor('#ff0000')
                            .setTitle(`Already Own Steel Sword!`)
                            .setDescription(`You already have a ${steelswordEmoji} Steel Sword in your inventory.`)]
                    });
                } else {
                    await purchaseItem(6500, 'coins', 'Steel Sword', 'weapons');
                }
            } else if (itemName === 'jade spear') {
                if (userInventory.includes('jade spear')) {
                    message.channel.send({
                        embeds: [new EmbedBuilder()
                            .setColor('#ff0000')
                            .setTitle(`Already Own Jade Spear!`)
                            .setDescription(`You already have a ${jadeEmoji} Jade Spear in your inventory.`)]
                    });
                } else {
                    await purchaseItem(25000, 'coins', 'Jade Spear', 'weapons');
                }
            } else if (itemName === 'phoenix blade') {
                if (userInventory.includes('phoenix blade')) {
                    message.channel.send({
                        embeds: [new EmbedBuilder()
                            .setColor('#ff0000')
                            .setTitle(`Already Own Phoenix Blade!`)
                            .setDescription(`You already have a ${phoenixEmoji} Phoenix Blade in your inventory.`)]
                    });
                } else {
                    await purchaseItem(219, 'mysticGems', 'Phoenix Blade', 'weapons');
                }
            } else if (itemName === 'heal potion') {
                await purchaseItem(950, 'coins', 'Heal Potion', 'battleItems', quantity);
            } else if (itemName === 'war scythe') {
                if (userInventory.includes('war scythe')) {
                    message.channel.send({
                        embeds: [new EmbedBuilder()
                            .setColor('#ff0000')
                            .setTitle(`Already Own Phoenix Blade!`)
                            .setDescription(`You already have a ${warscythe} War Scythe in your inventory.`)]
                    });
                } else {
                    await purchaseItem(50000, 'coins', 'war scythe', 'weapons');
                }
            }else if (itemName === 'arcane gemstone') {
                // Ensure battleItems exist in inventory before checking
                if (!userProfile.inventory.battleItems) {
                    userProfile.inventory.battleItems = {};
                }
            
                // Check if Arcane Gemstone already exists in the inventory
                if (userProfile.inventory.battleItems["Arcane Gemstone"] && userProfile.inventory.battleItems["Arcane Gemstone"] > 0) {
                    message.channel.send({
                        embeds: [new EmbedBuilder()
                            .setColor('#ff0000')
                            .setTitle('Already Owned!')
                            .setDescription(`You already own an ${battleItemEmojis["arcane gemstone"]} **Arcane Gemstone** and cannot buy another.`)]
                    });
                } else {
                    await purchaseItem(109, 'mysticGems', 'Arcane Gemstone', 'battleItems');
                }
            }else if (itemName === 'lunar fang') {
                if (userInventory.includes('lunar fang')) {
                    message.channel.send({
                        embeds: [new EmbedBuilder()
                            .setColor('#ff0000')
                            .setTitle(`Already Own Lunar Fang!`)
                            .setDescription(`You already have a ${lunarfangemoji} Lunar Fang in your inventory.`)]
                    });
                } else {
                    await purchaseItem(100000, 'coins', 'Lunar Fang', 'weapons');
                }
            }
            
            
            
            
            else {
                message.channel.send({
                    embeds: [new EmbedBuilder()
                        .setColor('#ff0000')
                        .setTitle('Invalid Item!')
                        .setDescription('Item not found in the shop.')]
                });
            }
        }
        
        

       // Add the hold command (updated to separate weapons and battle items)
if (message.content.startsWith('!hold')) {
    const userId = message.author.id;
    const args = message.content.split(' ').slice(1);
    const itemName = args.join(' ').toLowerCase().trim();

    // Fetch user profile from MongoDB
    let userProfile = await getUserProfile(userId);

    if (!userProfile) {
        message.channel.send("You need to create a profile first using `!mw`.");
        return;
    }

    // Ensure inventory objects exist
    if (!userProfile.inventory.battleItems) userProfile.inventory.battleItems = {};
    if (!userProfile.inventory.weapons) userProfile.inventory.weapons = [];

    // ✅ Handle Battle Item Holding (Arcane Gemstone)
    if (itemName === 'arcane gemstone') {
        if (userProfile.equippedBattleItem === "Arcane Gemstone") {
            message.channel.send({
                embeds: [new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('Already Holding!')
                    .setDescription(`You are already holding an ${battleItemEmojis["arcane gemstone"]} **Arcane Gemstone**.`)]
            });
        } else if (userProfile.inventory.battleItems["Arcane Gemstone"] > 0) {
            userProfile.equippedBattleItem = "Arcane Gemstone"; // Equip Arcane Gemstone

            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('Battle Item Equipped!')
                .setDescription(`You are now holding ${battleItemEmojis["arcane gemstone"]} **Arcane Gemstone**.`);
            
            message.channel.send({ embeds: [embed] });
            await saveUserProfile(userProfile);
        } else {
            message.channel.send({
                embeds: [new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('Item Not Found!')
                    .setDescription(`You do not have an ${battleItemEmojis["arcane gemstone"]} **Arcane Gemstone** in your inventory.`)]
            });
        }
        return; // Exit to prevent checking weapons
    }



    // ✅ Handle Weapon Holding (Separate from battle items)
    if (userProfile.equippedWeapon) {
        message.channel.send({
            embeds: [new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('Weapon Already Equipped!')
                .setDescription(`You are already holding a weapon **${userProfile.equippedWeapon}**. Use \`!unhold ${userProfile.equippedWeapon}\` to unequip it first.`)]
        });
        return;
    }

    // Check if user owns the weapon
    const userWeapons = userProfile.inventory.weapons.map(item => item.toLowerCase());
    if (userWeapons.includes(itemName)) {
        userProfile.equippedWeapon = itemName; // Equip weapon
        const emoji = weaponEmojis[itemName] || "";

        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('Weapon Equipped!')
            .setDescription(`You have equipped ${emoji} **${itemName.charAt(0).toUpperCase() + itemName.slice(1)}**.`);
        
        message.channel.send({ embeds: [embed] });
        await saveUserProfile(userProfile);
    } else {
        message.channel.send({
            embeds: [new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('Weapon Not Found!')
                .setDescription(`You do not have ${weaponEmojis[itemName] || ""} **${itemName}** in your inventory.`)]
        });
    }
}


// Add the unhold command (updated to support both weapons and battle items)
if (message.content.startsWith('!unhold')) {
    const userId = message.author.id;
    const args = message.content.split(' ').slice(1);
    const itemName = args.join(' ').toLowerCase().trim(); // Normalize input

    // Fetch user profile from MongoDB
    let userProfile = await getUserProfile(userId);

    if (!userProfile) {
        message.channel.send("You need to create a profile first using `!mw`.");
        return;
    }

    // Check if the item is a Battle Item (Arcane Gemstone)
    if (itemName === 'arcane gemstone') {
        if (userProfile.equippedBattleItem === "Arcane Gemstone") {
            userProfile.equippedBattleItem = null; // Unhold Arcane Gemstone

            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('Battle Item Unequipped!')
                .setDescription(`You have unequipped ${battleItemEmojis["arcane gemstone"]} **Arcane Gemstone**.`);
            
            message.channel.send({ embeds: [embed] });
            await saveUserProfile(userProfile);
        } else {
            message.channel.send({
                embeds: [new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('Item Not Equipped!')
                    .setDescription(`You are not holding an ${battleItemEmojis["arcane gemstone"]} **Arcane Gemstone**.`)]
            });
        }
        return; // Exit here, so it doesn't check weapons
    }

    // Handle Weapon Unequipping
    if (userProfile.equippedWeapon && userProfile.equippedWeapon.toLowerCase() === itemName) {
        userProfile.equippedWeapon = null; // Unhold weapon
        const emoji = weaponEmojis[itemName] || "";

        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('Weapon Unequipped!')
            .setDescription(`You have unequipped ${emoji} **${itemName}**.`);
        
        message.channel.send({ embeds: [embed] });
        await saveUserProfile(userProfile);
    } else {
        message.channel.send({
            embeds: [new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('Weapon Not Equipped!')
                .setDescription(`You are not holding ${weaponEmojis[itemName] || ""} **${itemName}**.`)]
        });
    }
}

        
        



        // Inventory command
if (message.content === '!inventory' || message.content === '!inv') {
    const userId = message.author.id;  // Get the userId

    // Fetch user profile from MongoDB
    let userProfile = await getUserProfile(userId);

    // Check if the user has a profile
    if (!userProfile) {
        message.channel.send("You need to create a profile first using !mw.");
        return;
    }

    // Fetch the user's inventory
    const inventory = userProfile.inventory; // This is now an object
    const equippedWeapon = userProfile.equippedWeapon; // Get the equipped weapon

    // Create a string listing all items in the inventory
    let inventoryList = '';

    // Display weapons
    inventoryList += '**Weapons:**\n';
    if (Array.isArray(inventory.weapons) && inventory.weapons.length > 0) {
        for (const weapon of inventory.weapons) {
            const emoji = weaponEmojis[weapon.toLowerCase()] || ""; // Get emoji or empty string
            if (weapon.toLowerCase() === equippedWeapon?.toLowerCase()) {
                inventoryList += `- ${emoji} **${weapon.charAt(0).toUpperCase() + weapon.slice(1)}** (Equipped)\n`;
            } else {
                inventoryList += `- ${emoji} **${weapon.charAt(0).toUpperCase() + weapon.slice(1)}**\n`;
            }
        }
    } else {
        inventoryList += 'You have no weapons.\n';
    }

    // Display battle items
    inventoryList += '\n**Battle Items:**\n';
    if (inventory.battleItems && Object.keys(inventory.battleItems).length > 0) {
        let hasBattleItems = false;
    
        for (const [itemName, count] of Object.entries(inventory.battleItems)) {
            const emoji = battleItemEmojis[itemName.toLowerCase()] || "";
            let equippedText = (userProfile.equippedBattleItem === itemName) ? ' (Equipped)' : '';
            inventoryList += `- ${emoji} **${itemName}** (x${count})${equippedText}\n`;
            hasBattleItems = true;
        }
    
        if (!hasBattleItems) {
            inventoryList += 'You have no battle items.\n';
        }
    } else {
        inventoryList += 'You have no battle items.\n';
    }
    

    // Display fish
    inventoryList += '\n**Fishing Items:**\n';
    if (typeof inventory.fish === 'object' && Object.keys(inventory.fish).length > 0) {
        for (const [fish, count] of Object.entries(inventory.fish)) {
            const emoji = fishEmojis[fish.toLowerCase()] || "";
            inventoryList += `- ${emoji} **${fish.charAt(0).toUpperCase() + fish.slice(1)}** (x${count})\n`;
        }
    } else {
        inventoryList += 'You have no fishing items.\n';
    }

     // Display craftable items
     inventoryList += '\n**Craftable Items:**\n';
        if (typeof inventory.craftableItems === 'object' && Object.keys(inventory.craftableItems).length > 0) {
            for (const [item, count] of Object.entries(inventory.craftableItems)) {
                const emoji = craftableItemEmojis[item.toLowerCase()] || "";
                inventoryList += `- ${emoji} **${item.charAt(0).toUpperCase() + item.slice(1)}** (x${count})\n`;
            }
        } else {
            inventoryList += 'You have no craftable items.\n';
        }


    const file = new AttachmentBuilder('./images/bag.png', { name: 'bag.png' });
    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle(`${message.author.username}'s Inventory`)
        .setDescription(inventoryList)
        .setThumbnail('attachment://bag.png');
        

    message.channel.send({ embeds: [embed], files: [file] });
}

// Command to claim daily rewards
if (message.content === '!daily') {
    const userId = message.author.id;

    // Fetch user profile from MongoDB
    let userProfile = await getUserProfile(userId);

    // Check if the user has a profile
    if (!userProfile) {
        message.channel.send("You need to create a profile first using `!mw`.");
        return;
    }

    const now = Date.now();
    const lastDaily = userProfile.lastDaily || 0;
    const dailyCooldown = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

    // Initialize streak if not present
    if (!userProfile.dailyStreak) userProfile.dailyStreak = 0;

    if (now - lastDaily >= dailyCooldown) {
        userProfile.dailyStreak += 1; // Increase streak
        userProfile.lastDaily = now; // Update last claim time

        let coinReward = 500; // Base reward
        let mysticGemsReward = 0;

        // Every 5-day streak → Bonus Rewards
        if (userProfile.dailyStreak % 5 === 0) {
            coinReward = 1000; // Increase coin reward
            mysticGemsReward = 2; // Give 2 Mystic Gems
        }

        // Add rewards
        userProfile.coins += coinReward;
        userProfile.mysticGems += mysticGemsReward;

        // Create reward message
        let rewardMessage = `You received ${coinrpgEmoji} **${coinReward} coins**!`;

        if (mysticGemsReward > 0) {
            rewardMessage += `\n🎉 **Bonus Streak Reward!** You also earned ${mysticGemsemoji} **${mysticGemsReward} Mystic Gems**!`;
        }

        // Create embed
        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('Daily Reward Claimed!')
            .setDescription(`${rewardMessage}\n\n**Current Streak:** ${userProfile.dailyStreak} days 🔥`)
            .setFooter({ text: 'Claim daily to keep your streak going!' });

        message.channel.send({ embeds: [embed] });

        // Save updated profile to MongoDB
        await updateUserProfile(userId, {
            coins: userProfile.coins,
            mysticGems: userProfile.mysticGems,
            lastDaily: userProfile.lastDaily,
            dailyStreak: userProfile.dailyStreak,
        });
    } else {
        const timeLeft = dailyCooldown - (now - lastDaily);
        const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
        const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

        const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('Daily Reward Already Claimed ⏳')
            .setDescription(`You can claim your next reward in **${hoursLeft} hours and ${minutesLeft} minutes**.`);

        message.channel.send({ embeds: [embed] });
    }
}



        //help
        if (message.content === '!mwhelp') {
            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('🆘 Help Menu')
                .setDescription('Here are the available commands:')
                .addFields(
                    { name: '`!mw`', value: 'Create your profile.', inline: true },
                    { name: '`!nick [name]`', value: 'Set your nickname.', inline: true },
                    { name: '`!profile [@user]`', value: 'View your profile or another user\'s profile.', inline: true },
                    { name: '`!balance`', value: 'Check your coin balance.', inline: true },
                    { name: '`!daily`', value: 'Claim your daily reward.', inline: true },
                    { name: '`!shop`', value: 'Visit the shop.', inline: true },
                    { name: '`!shop buy [item]`', value: 'Purchase an item from the shop.', inline: true },
                    { name: '`!inventory` or `!inv`', value: 'Check your items.', inline: true },
                    { name: '`!weapons` or `!wp`', value: 'View available weapons.', inline: true },
                    { name: '`!enemy` or `!enm`', value: 'View available enemies.', inline: true },
                    { name: '`!fight [enemy]`', value: 'Engage in battle with an enemy.', inline: true },
                    { name: '`!quests` or `!q`', value: 'View and complete quests for rewards!', inline: true },
                    { name: '`!hold [weapon]`', value: 'Equip a weapon.', inline: true },
                    { name: '`!unhold [weapon]`', value: 'Unequip a weapon.', inline: true },
                    { name: '`!give coin [amount] @user`', value: 'Send coins to another user.', inline: true },
                    { name: '`!fish`', value: 'Go fishing for items and rare catches!', inline: true },
                    { name: '`!finfo`', value: 'View fishing info and rare items.', inline: true },
                    { name: '`!sell [fish] [quantity]`', value: 'Sell fish for coins.', inline: true },
                    { name: '`!craft`', value: 'View available craftable items.', inline: true },
                    { name: '`!craft [item]`', value: 'Craft a specific item if you have the materials.', inline: true },
                    { name: '`!update`', value: 'See the latest game updates.', inline: true },
                    { name: '`!mwhelp`', value: 'Show this help menu.', inline: true }
                )
                .setFooter({ text: 'Use the commands to explore Mystic Warriors!' });
        
            message.channel.send({ embeds: [embed] });
        }
        

        // Add the Give Coin command
        if (message.content.startsWith('!give coin')) {
            const userId = message.author.id;
            const args = message.content.split(' ');
        
            if (args.length < 3) {
                return message.channel.send({
                    embeds: [new EmbedBuilder()
                        .setColor('#ff0000')
                        .setTitle('Invalid Command!')
                        .setDescription('Usage: `!give coin {amount} @user`')]
                });
            }
        
            const amount = parseInt(args[2]);
            const mentionedUser = message.mentions.users.first();
        
            if (isNaN(amount) || amount <= 0) {
                return message.channel.send({
                    embeds: [new EmbedBuilder()
                        .setColor('#ff0000')
                        .setTitle('Invalid Amount!')
                        .setDescription('Please enter a valid amount to give.')]
                });
            }
        
            if (!mentionedUser) {
                return message.channel.send({
                    embeds: [new EmbedBuilder()
                        .setColor('#ff0000')
                        .setTitle('User Not Found!')
                        .setDescription('Please mention a valid user.')]
                });
            }
        
            const receiverId = mentionedUser.id;
        
            // Prevent users from giving coins to themselves
            if (userId === receiverId) {
                return message.channel.send({
                    embeds: [new EmbedBuilder()
                        .setColor('#ff0000')
                        .setTitle('Invalid Action!')
                        .setDescription("You **cannot** give coins to yourself.")]
                });
            }
        
            // Fetch sender and receiver profiles from MongoDB
            let senderProfile = await getUserProfile(userId);
            let receiverProfile = await getUserProfile(receiverId);
        
            if (!receiverProfile) {
                return message.channel.send({
                    embeds: [new EmbedBuilder()
                        .setColor('#ff0000')
                        .setTitle('User Profile Not Found!')
                        .setDescription('The mentioned user does not have a profile.')]
                });
            }
        
            if (senderProfile.coins < amount) {
                return message.channel.send({
                    embeds: [new EmbedBuilder()
                        .setColor('#ff0000')
                        .setTitle('Not Enough Coins!')
                        .setDescription("You **don't** have enough coins to give.")]
                });
            }
        
            // Deduct coins from sender
            senderProfile.coins -= amount;
        
            // Add coins to receiver
            receiverProfile.coins += amount;
        
            // Save both profiles before sending confirmation
            await saveUserProfile(senderProfile);
            await saveUserProfile(receiverProfile);
        
            return message.channel.send({
                embeds: [new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('Transfer Successful!')
                    .setDescription(`You have given <:coin:1300687053792739328> **${amount} coins** to <@${receiverId}>.`)]
            });
        }
        

        //weapons

        if (message.content.startsWith('!weapons') || message.content.startsWith('!wp')) {
            const embed = new EmbedBuilder()
                .setColor('#ff4500')
                .setTitle('🗡️ Available Weapons 🛡️')
                .setDescription('Choose wisely, each weapon has unique power!\n\n**Available Weapons:**')
                .addFields(
                    { name: `${knifeEmoji} Knife`, value: `**Cost:** ${coinrpgEmoji} 1000\n**Damage:** 💥 15\n*A simple but effective weapon.*`, inline: false },
                    { name: `${steelswordEmoji} Steel Sword`, value: `**Cost:** ${coinrpgEmoji} 3500\n**Damage:** 💥 30\n*Forged with sturdy steel for extra damage.*`, inline: false },
                    { name: `${jadeEmoji} Jade Spear`, value: `**Cost:** ${coinrpgEmoji} 15000\n**Damage:** 💥 65\n*An elegant spear crafted from jade, a true warrior's choice.*`, inline: false },
                    { name: `${phoenixEmoji} Phoenix Blade`, value: `**Cost:** ${mysticGemsemoji} 126\n**Damage:** 💥 100\n*Forged in the heart of a phoenix, heals the user by ❤️30 HP per hit*`, inline: false },
                    { name: `${frostbiteEmoji} Frostbite Axe`, value: `**Cost:** ${coinrpgEmoji} Only obtained from fishing!\n**Damage:** 💥 130\n*Forged from ancient magic ice. Gives 🛡️ 100 shields during battle*`, inline: false },
                    { name: `${riftbreaker} Riftbreaker`, value: `**Cost:** ${coinrpgEmoji} Craftable Item.\n**Damage:** 💥 500\n*A legendary weapon ony obtained from crafting ${ancient_shard} Ancient Shards. Deals massive after 2 hit and recovers user's HP by +50*`, inline: false },
                    { name: `${warscythe} War Scythe`, value: `**Cost:** ${coinrpgEmoji} 50000\n**Damage:** 💥 289\n*A deadly polearm with a long, curved blade, designed for sweeping strikes and precise slashes. Forged for battle, it delivers 289 base damage with Phantom Strike, cutting through enemies with relentless force.*`, inline: false },
                    { name: `${lunarfangemoji} Lunar Fang`, value: `**Cost:** ${coinrpgEmoji} 100000\n**Damage:** 💥 399\n*Instantly Kill enemy if hp is 25% and 50% chance to dodge enemy attack*`, inline: false },

                )
                .setFooter({ text: 'Visit the shop `!shop` to purchase these weapons!' });

            message.channel.send({ embeds: [embed] });
        }


        //enemy
        if (message.content.startsWith('!enemy') || message.content.startsWith('!enm')) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('⚔️ Enemy List ⚔️')
                .setDescription('Face the most fearsome foes!\n\n**Enemies:**')
                .addFields(
                    { name: 'Goblin', value: `**Max HP:** 50\n**Damage:** 3 to 6\n**Coin Reward:** 10 - 50 coins\n*A mischievous creature with a taste for trouble.*`, inline: false },
                    { name: 'Wolf', value: `**Max HP:** 70\n**Damage:** 6 to 12\n**Coin Reward:** 50 - 100 coins\n*A fierce wolf, always ready to pounce.*`, inline: false },
                    { name: 'Orc', value: `**Max HP:** 200\n**Damage:** 12 to 24\n**Coin Reward:** 100 - 500 coins\n*Large and brutish, beware of their strength.*`, inline: false },
                    { name: 'Cursed Knight', value: `**Max HP:** 350\n**Damage:** 24 to 48\n**Coin Reward:** 500 - 1500 coins\n*Once noble, now cursed to eternal battle.*`, inline: false },
                    { name: 'Elysia', value: `**Max HP:** 300\n**Damage:** 17 to 32\n**Coin Reward:** 300 - 1000 coins\n*A mysterious warrior from another realm.*`, inline: false },
                    { name: 'Ancient Guard', value: `**Max HP:** 5000\n**Damage:** 5 to 18\n**Coin Reward:** 2000 - 5000 coins\n*An immortal protector of forgotten ruins.*`, inline: false }
                )
                .setFooter({ text: 'Prepare yourself for battle! Use `!fight [enemy]` to engage!' });
        
            message.channel.send({ embeds: [embed] });
        }
        


        // Add the Booster Payment Request Guide command
        if (message.content.startsWith('!boostg')) {
            const embed = new EmbedBuilder()
                .setColor('#00FF00') // Money green color
                .setTitle('💸 Booster Payment Request Guide 💸')
                .setDescription(`
                **Boosters, follow these steps to request your payment efficiently:**

                **Step 1: Create a Ticket**
                In our server, use the TicketTool bot to open a new ticket for your payment request. #⁠💰request-payment💰.

                **Step 2: Submit the Required Information**
                Provide the following details within your ticket:

                **Order Details**: Briefly describe the completed order.
                *(Example: Genshin Impact, Character Build x3, Level 90)*

                **Order Completion Screenshot**: Upload proof that the order was completed.
                *(Example: Screenshot showing the maxed character)*

                **Bank Account Information**: Include your bank account number to receive payment securely.
                ⚠️ **Important**: Share bank details only within your ticket and only with designated mods. Do not disclose this information to anyone else.
                **We accept PayPal✅, Binance✅**

                **For 🇳🇵 Nepalese Booster**:
                We accept : Esewa ✅, Khalti✅ and IME PAY ✅

                **Step 3: Submit and Await Confirmation**
                Once all information is provided, submit your ticket and our team will handle your payment promptly.

                **Thank you for your hard work and dedication!** 💪💼
                `);

            message.channel.send({ embeds: [embed] });
        }

        if (message.content === '!quests' || message.content === '!q') {
            const userId = message.author.id;
        
            // Fetch the user profile from MongoDB
            let userProfile = await getUserProfile(userId);
        
            if (!userProfile) {
                message.channel.send("You need to create a profile first using `!mw`.");
                return;
            }

            console.log('Quests in !quests command:', userProfile.quests); // Debug log
        
            // Generate and display quests
            const { quests, remainingCooldown } = generateDailyQuests(userProfile);
        
            // Save the updated profile to MongoDB
            await updateUserProfile(userId, {
                'quests.active': quests.active,
                'quests.progress': quests.progress,
                'quests.lastReset': quests.lastReset,
                'quests.lastQuestGeneration': quests.lastQuestGeneration,
            });
        
            // Display the quests
            const questEmbed = displayQuests(userProfile);
            message.channel.send({ embeds: [questEmbed] });
        }
        
        

        // Command to check balance
        if (message.content === '!balance' || message.content === '!bal') {
            const userId = message.author.id;
            let userProfile = await getUserProfile(userId);
        
            if (!userProfile) {
                message.channel.send("You need to create a profile first using `!mw`.");
                return;
            }
        
            const coins = userProfile.coins;
            const mysticGems = userProfile.mysticGems;
        
            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle(`${message.author.username}'s Balance`)
                .setDescription(`${coinrpgEmoji} Coins: **${coins}**\n${mysticGemsemoji} Mystic Gems: **${mysticGems}**`);
        
            message.channel.send({ embeds: [embed] });
        }
        

        // Fish Command
if (message.content.startsWith('!fish')) {
    const userId = message.author.id;

    // Fetch user profile from MongoDB
    let userProfile = await getUserProfile(userId);


    if (knockedOutPlayers.has(message.author.id)) {
        return message.channel.send(`<@${message.author.id}>, you're knocked out! Wait until your recovery time ends before jumping back into battle.`);
    }

    // Check if the user has a profile
    if (!userProfile) {
        message.channel.send("You need to create a profile first using `!mw`.");
        return;
    }

    // Fishing animation message with embed
    const fishingEmbed = new EmbedBuilder()
        .setColor('#1E90FF') // Ocean blue color
        .setDescription("You cast your fishing rod 🎣!\nFishing...");
    message.channel.send({ embeds: [fishingEmbed] }).then(() => {
        // Simulate fishing process with a timeout
        setTimeout(async () => {
            // Define the possible catches and their probabilities
            const catches = [
                { item: 'Tuna', chance: 40 },
                { item: 'Salmon', chance: 40 },
                { item: 'Golden Tuna', chance: 10 },
                { item: 'Golden Salmon', chance: 10 },
                { item: 'Frostbite Axe', chance: 1 }
            ];

            // Function to select an item based on weighted random chance
            function weightedRandom(catches) {
                const totalWeight = catches.reduce((sum, catchItem) => sum + catchItem.chance, 0);
                const randomNum = Math.random() * totalWeight;
                let cumulativeWeight = 0;

                for (const catchItem of catches) {
                    cumulativeWeight += catchItem.chance;
                    if (randomNum <= cumulativeWeight) {
                        return catchItem.item;
                    }
                }
                return null;
            }

            const caughtItem = weightedRandom(catches);

            // Ensure the user's inventory exists
            if (!userProfile.inventory) {
                userProfile.inventory = {};
            }
            if (!userProfile.inventory.weapons || typeof userProfile.inventory.weapons !== 'object') {
                userProfile.inventory.weapons = []; // Initialize weapons array if it doesn't exist
            }
            if (!userProfile.inventory.fish || typeof userProfile.inventory.fish !== 'object') {
                userProfile.inventory.fish = {};
            }

            // Normalize fish inventory keys for consistency
            userProfile.inventory.fish = Object.keys(userProfile.inventory.fish).reduce((acc, key) => {
                acc[key.toLowerCase()] = userProfile.inventory.fish[key];
                return acc;
            }, {});

            // Update the user's inventory
            if (caughtItem) {
                if (caughtItem === 'Frostbite Axe') {
                    // Check if the player already has the Frostbite Axe
                    if (userProfile.inventory.weapons.includes(caughtItem)) {
                        // If the player already has the Frostbite Axe, just add one more to the inventory (stacking)
                        const caughtAxeEmbed = new EmbedBuilder()
                            .setColor('#d0c82a')
                            .setDescription(`You already have a **${caughtItem}**. It has been stacked in your inventory!`);
                        userProfile.inventory.weapons.push(caughtItem); // Add the weapon to the inventory
                        message.channel.send({ embeds: [caughtAxeEmbed] });
                    } else {
                        // If the player doesn't have the Frostbite Axe, add it to their inventory
                        userProfile.inventory.weapons.push(caughtItem); // Add the weapon to the inventory
                        const caughtAxeEmbed = new EmbedBuilder()
                            .setColor('#d0c82a')
                            .setDescription(`You found a **${caughtItem}!**`);
                        message.channel.send({ embeds: [caughtAxeEmbed] });
                    }
                }else {
                    // Normalize the caught item and increment its count in the inventory
                    const normalizedCaughtItem = caughtItem.toLowerCase();
                    userProfile.inventory.fish[normalizedCaughtItem] = (userProfile.inventory.fish[normalizedCaughtItem] || 0) + 1;

                    const caughtFishEmbed = new EmbedBuilder()
                        .setColor('#1E90FF')
                        .setDescription(`You caught a 🐟 **${caughtItem}**! You now have 🐟 **${userProfile.inventory.fish[normalizedCaughtItem]}** of them.`);
                    message.channel.send({ embeds: [caughtFishEmbed] });
                }

                // Save updated profile to MongoDB
                await updateUserProfile(userId, {
                    'inventory.fish': userProfile.inventory.fish,
                    'inventory.weapons': userProfile.inventory.weapons,
                    coins: userProfile.coins
                });

                console.log('Updated Inventory:', userProfile.inventory); // Debug log for inventory
            } else {
                const noCatchEmbed = new EmbedBuilder()
                    .setColor('#1E90FF')
                    .setDescription("You didn't catch anything this time. Try again!");
                message.channel.send({ embeds: [noCatchEmbed] });
            }
        }, 5000); // Simulate a 5-second wait for fishing
    });
}


        

// Fish Sell Command
if (message.content.startsWith('!sell')) {
    const userId = message.author.id;
    const args = message.content.split(' ');

    // Validate arguments
    if (args.length < 2) {
        message.channel.send("Invalid usage. Example: `!sell [item] [quantity]` or `!sell fish all`." );
        return;
    }

    let fishItem = args[1].toLowerCase().replace('_', ' ');
    let quantity = args[2];

    // Fetch user profile
    let userProfile = await getUserProfile(userId);
    if (!userProfile) {
        message.channel.send("You need to create a profile first using `!mw`.");
        return;
    }

    if (!userProfile.inventory || typeof userProfile.inventory.fish !== 'object') {
        userProfile.inventory.fish = {};
    }

    const userFishInventory = Object.keys(userProfile.inventory.fish).reduce((acc, key) => {
        acc[key.toLowerCase()] = userProfile.inventory.fish[key];
        return acc;
    }, {});

    const fishPrices = {
        tuna: 20,
        salmon: 20,
        "golden tuna": 1000,
        "golden salmon": 1000
    };

    if (fishItem === 'fish' && quantity === 'all') {
        let totalCoins = 0;
        let soldFish = [];

        for (const [fishName, fishQty] of Object.entries(userFishInventory)) {
            if (fishPrices[fishName]) {
                const coinsEarned = fishPrices[fishName] * fishQty;
                totalCoins += coinsEarned;
                soldFish.push(`**${fishQty} ${fishName}(s)**`);
                delete userFishInventory[fishName];
            }
        }

        if (totalCoins === 0) {
            message.channel.send("You don't have any fish to sell.");
            return;
        }

        userProfile.coins += totalCoins;

        await updateUserProfile(userId, {
            coins: userProfile.coins,
            "inventory.fish": userFishInventory,
        });

        const embed = new EmbedBuilder()
            .setColor("#00ff00")
            .setTitle("All Fish Sold!")
            .setDescription(`You sold ${soldFish.join(", ")} for **${coinrpgEmoji}${totalCoins} coins**!`)
            .setFooter({ text: "Happy fishing and selling!" });
        
        message.channel.send({ embeds: [embed] });
        return;
    }

    if (!userFishInventory[fishItem]) {
        message.channel.send(`You don't have any **${fishItem}** to sell.`);
        return;
    }

    if (quantity === 'all') {
        quantity = userFishInventory[fishItem];
    } else {
        quantity = parseInt(quantity);
        if (isNaN(quantity) || quantity <= 0) {
            message.channel.send("Please provide a valid quantity. Example: `!sell tuna 30` or `!sell tuna all`.");
            return;
        }
    }

    const sellingPrice = fishPrices[fishItem] || 0;
    if (sellingPrice === 0) {
        message.channel.send("This fish item cannot be sold.");
        return;
    }

    if (userFishInventory[fishItem] < quantity) {
        message.channel.send(`You don't have enough **${fishItem}** to sell.`);
        return;
    }

    const totalCoins = sellingPrice * quantity;
    userFishInventory[fishItem] -= quantity;
    if (userFishInventory[fishItem] === 0) {
        delete userFishInventory[fishItem];
    }

    userProfile.coins += totalCoins;

    await updateUserProfile(userId, {
        coins: userProfile.coins,
        "inventory.fish": userFishInventory,
    });

    const embed = new EmbedBuilder()
        .setColor("#00ff00")
        .setTitle("Fish Sold!")
        .setDescription(`You sold **${quantity} ${fishItem}(s)** for **${coinrpgEmoji}${totalCoins} coins**!`)
        .setFooter({ text: "Happy fishing and selling!" });
    
    message.channel.send({ embeds: [embed] });
}






// Fish info command
if (message.content.startsWith('!finfo')) {
    // Create an embed for fish info
    const fishInfoEmbed = new EmbedBuilder()
        .setColor('#1E90FF') // Ocean blue color
        .setTitle('🎣 Fishing Features & Rare Items')
        .setDescription('Here are the details about the fishing system and the rare items you can catch!')
        .addFields(
            { name: 'Fishing Basics', value: 'Use the `!fish` command to cast your line and see what you catch!' },
            { name: 'Possible Catches:', value: 'Here are the items you can catch while fishing:' },
            { name: '🐟 Tuna', value: 'A common catch. Chance: 40%', inline: true },
            { name: '🐟 Salmon', value: 'Another common catch. Chance: 40%', inline: true },
            { name: '✨ Golden Fish', value: 'A rare catch that shines bright. Chance: 10%', inline: true },
            { name: `${frostbiteEmoji} Frostbite Axe`, value: 'A legendary weapon! Chance: 1%. If you already have one, you will receive 10,000 coins instead. `!wp` for more info.', inline: true },
            { name: 'Fishing Tips', value: 'Try fishing during different times of the day for potentially better catches!' }
        )
        .setFooter({ text: 'Happy Fishing! 🎣'}) // Replace with a valid icon URL
        .setTimestamp();

    // Send the embed message
    message.channel.send({ embeds: [fishInfoEmbed] });
}


    // Command: !craft [itemName]
// Command: !craft [itemName]
if (message.content.startsWith('!craft')) {
    const userId = message.author.id;
    const args = message.content.split(' ').slice(1); // Extract the item name

    // Fetch user profile from MongoDB
    let userProfile = await getUserProfile(userId);

    // Check if the user has a profile
    if (!userProfile) {
        message.channel.send("You need to create a profile first using !mw.");
        return;
    }

    // Ensure craftableItems exists
    if (!userProfile.inventory.craftableItems) {
        userProfile.inventory.craftableItems = {};
    }

    // No arguments: Show craftable items list
    if (args.length === 0) {
        const file = new AttachmentBuilder('./images/craft.jpg', { name: 'craft.jpg' });
        const embed = new EmbedBuilder()
            .setColor('#1E90FF') // Blue for crafting info
            .setTitle('🔨 Crafting Menu')
            .setDescription('Use `!craft [itemName]` to craft an item.\nHere are the available craftable items:')
            .addFields(
                {
                    name: `${riftbreaker} **Riftbreaker**`,
                    value: `🛠️ **Materials Needed:** ${ancient_shard} 100 Ancient Shards\n📜 **Description:** A legendary blade forged from rift energy, capable of immense destruction.\n🎮 **Command:** \`!craft riftbreaker\``,
                    inline: false,
                },

                {
                    name: `❓ **?????**`,
                    value: `⚔️ **New Weapon Coming Soon...**\n🔎 Keep an eye out for future updates!`,
                    inline: false,
                }
            )
            .setImage('attachment://craft.jpg')
            .setFooter({ text: 'Gather resources and craft legendary items!' });
    
        await message.channel.send({ embeds: [embed] , files: [file] });
        return;
    }
    

    // Crafting logic for specific items
    const itemName = args.join(' ').toLowerCase(); // Normalize item name
    if (itemName === 'riftbreaker') {
        const requiredShards = 100;
        const currentShards = userProfile.inventory.craftableItems['Ancient Shard'] || 0;

        // Check if the player has enough shards
        if (currentShards < requiredShards) {
            const missingShards = requiredShards - currentShards;

            const embed = new EmbedBuilder()
                .setColor('#FF0000') // Red for error
                .setTitle('🛑 Insufficient Materials')
                .setDescription(
                    `You need **${missingShards} more Ancient Shards** to craft the **Riftbreaker**!`
                );

            await message.channel.send({ embeds: [embed] });
            return;
        }

        // Deduct shards and add Riftbreaker to inventory
        userProfile.inventory.craftableItems['Ancient Shard'] -= requiredShards;

        // Add the Riftbreaker if not already added
        if (!userProfile.inventory.weapons.includes('Riftbreaker')) {
            userProfile.inventory.weapons.push('Riftbreaker');
        }

        // Save the updated profile using updateOne() to ensure the shards are deducted
        try {
            // Update the user's inventory directly in the database
            await User.updateOne(
                { userId: userId }, // Find the user by their userId
                { $set: { 'inventory.craftableItems.Ancient Shard': userProfile.inventory.craftableItems['Ancient Shard'] },
                  $push: { 'inventory.weapons': 'Riftbreaker' } // Add the Riftbreaker weapon if not already present
                }
            );

            // After updating, fetch the updated profile for confirmation
            const updatedProfile = await getUserProfile(userId);
            console.log("Updated Profile After Save:", updatedProfile);

            // Send crafting success message
            const embed = new EmbedBuilder()
                .setColor('#FFD700') // Gold for crafting success
                .setTitle('🛠️ Crafting Successful!')
                .setDescription(
                    `You have successfully crafted the **Riftbreaker**!`
                )
                .addFields(
                    { name: 'Remaining Ancient Shards', value: `${updatedProfile.inventory.craftableItems['Ancient Shard']}` },
                    { name: 'Weapon Added', value: 'Riftbreaker' }
                )
                .setFooter({ text: 'Happy crafting!' });

            await message.channel.send({ embeds: [embed] });

        } catch (error) {
            console.error("Error saving profile: ", error);
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('🛑 Error Saving Profile')
                .setDescription('There was an issue saving your profile. Please try again later.');
            await message.channel.send({ embeds: [embed] });
        }
    } else {
        // Invalid item
        const embed = new EmbedBuilder()
            .setColor('#FF4500') // Orange for invalid item
            .setTitle('⚠️ Invalid Item')
            .setDescription(
                `Currently, you can only craft the following items:\n\n- **Riftbreaker**\n\nUse \`!craft\` to view available items.`
            );

        await message.channel.send({ embeds: [embed] });
    }
}

if (message.content.startsWith('!give gems')) {
    const userId = message.author.id;
    const adminIds = ["569727552877232145"]; // Replace with actual admin IDs

    // Check if the user is an admin
    if (!adminIds.includes(userId)) {
        message.channel.send({ embeds: [new EmbedBuilder().setColor('#ff0000').setTitle('Access Denied!').setDescription('Only admins can use this command.')] });
        return;
    }

    const args = message.content.split(' ');
    if (args.length < 3) {
        message.channel.send({ embeds: [new EmbedBuilder().setColor('#ff0000').setTitle('Invalid Command!').setDescription('Usage: `!give gems {amount} @user`')] });
        return;
    }

    const amount = parseInt(args[2]);
    const mentionedUser = message.mentions.users.first();

    if (isNaN(amount) || amount <= 0) {
        message.channel.send({ embeds: [new EmbedBuilder().setColor('#ff0000').setTitle('Invalid Amount!').setDescription('Please enter a valid amount of Mystic Gems.')] });
        return;
    }

    if (!mentionedUser) {
        message.channel.send({ embeds: [new EmbedBuilder().setColor('#ff0000').setTitle('User Not Found!').setDescription('Please mention a valid user.')] });
        return;
    }

    const receiverId = mentionedUser.id;
    let receiverProfile = await getUserProfile(receiverId);

    if (!receiverProfile) {
        message.channel.send({ embeds: [new EmbedBuilder().setColor('#ff0000').setTitle('User Profile Not Found!').setDescription('The mentioned user does not have a profile.')] });
        return;
    }

    // Generate gems for the user
    receiverProfile.mysticGems += amount;
    await saveUserProfile(receiverProfile);

    message.channel.send({ embeds: [new EmbedBuilder().setColor('#00ff00').setTitle('Gems Granted!').setDescription(`💎 **${amount} Mystic Gems** have been added to <@${receiverId}>.`)] });
}




//weeklyboss{
        
if (message.content.startsWith('!weeklyboss') || message.content.startsWith('!wkb')) {
    const embed = new EmbedBuilder()
        .setColor('#ff9300')
        .setTitle('⚡ Weekly Boss Available: Titan of the Storm ⚡')
        .setDescription('**HP:** 10000/10000\n**Damage:** 19-99\n**Ability:** Lightning Surge - Stuns player for 1 turn\n**Rewards:** Chance to win **2-10 Mystic Gems (15%)**\n\nUse `!raid 7` to start the battle!')
    
    message.channel.send({ embeds: [embed] });
}


//hpupgrade

if (message.content === '!mystats' || message.content === '!ms') {
    const userId = message.author.id;
    let userProfile = await getUserProfile(userId);

    if (!userProfile) {
        return message.channel.send("❌ You need to create a profile first using `!mw`.");
    }

    const hpUpgradeLevel = Math.floor((userProfile.maxHealth - 100) / 10);
    const starRating = "★".repeat(Math.min(hpUpgradeLevel, 5)) + "☆".repeat(Math.max(5 - hpUpgradeLevel, 0));
    const nextUpgradeCost = hpUpgradeLevel < 10 ? (hpUpgradeLevel * 10 + 9) : "MAX";

    const embed = new EmbedBuilder()
        .setColor('#00ff99')
        .setTitle(`📊 ${message.author.username}'s Stats`)
        .setDescription(`💖 **HP:** ${userProfile.maxHealth}\n⭐ **HP Upgrade Level:** ${starRating}\n To upgrade use : \`!mystats upgrade HP\``)
        .addFields(
            { name: '✨ HP Upgrade Info', value: "Increase your max HP by **+10** using Mystic Gems! 💎" },
            { name: '🔼 Next Upgrade Cost', value: userProfile.maxHealth >= 200 ? "**(MAXED) 🏆**" : `**${nextUpgradeCost}** Mystic Gems 💎` }

        )
        .setFooter({ text: 'Keep upgrading to reach MAX level! ⭐⭐⭐⭐⭐' });

    message.channel.send({ embeds: [embed] });
}



if (message.content === '!ms u hp' || message.content === '!mystats upgrade hp') {
    const userId = message.author.id;
    let userProfile = await getUserProfile(userId);

    if (!userProfile) {
        return message.channel.send("❌ You need to create a profile first using `!mw`.");
    }

    const currentMaxHp = userProfile.maxHealth;
    if (currentMaxHp >= 200) {
        return message.channel.send("🌟 Your HP is already at the **maximum upgrade level**!");
    }

    const nextHp = currentMaxHp + 10;
    const upgradeLevel = Math.floor((nextHp - 100) / 10);
    const upgradeCost = Math.min(upgradeLevel * 10 - 1, 99); // Prevents exceeding cost limit

    if (userProfile.mysticGems < upgradeCost) {
        return message.channel.send(`❌ You need **${upgradeCost}** Mystic Gems 💎 to upgrade HP to **${nextHp}**.`);
    }

    userProfile.mysticGems -= upgradeCost;
    userProfile.maxHealth = nextHp;

    await saveUserProfile(userProfile);

    const starRating = "★".repeat(Math.min(upgradeLevel, 5)) + "☆".repeat(Math.max(5 - upgradeLevel, 0));
    const nextUpgradeCost = upgradeLevel < 10 ? (upgradeLevel * 10 + 9) : "MAX";

    const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('💖 HP Upgraded! 🎉')
        .setDescription(`🎊 **Your max HP is now ${nextHp}!**\n⭐ **HP Upgrade Level:** ${starRating}`)
        .addFields(
            { name: '💎 Gems Spent', value: `**-${upgradeCost}** Mystic Gems 💎`, inline: true },
            { name: '🔼 Next Upgrade Cost', value: `**${nextUpgradeCost}** Mystic Gems 💎`, inline: true }
        )
        .setFooter({ text: 'Keep upgrading to reach MAX level! ⭐⭐⭐⭐⭐' });

    message.channel.send({ embeds: [embed] });
}


// Market command
if (message.content === '!market' || message.content === '!m') {
    return displayMarket(message);
}

if (message.content.startsWith('!m sell')) {
    const args = message.content.split(' ').slice(2);
    return sellItem(message, message.author.id, args);
}

if (message.content.startsWith('!m buy')) {
    const args = message.content.split(' ').slice(2); // Get itemId from the command
    const itemId = args[0];
    return buyItem(message, itemId);
}

if (message.content.startsWith('!m remove')) {
    const itemId = message.content.split(' ')[2];
    return removeItemFromMarket(message, itemId);
}

// Display Market Listings
async function displayMarket(message) {
    const listings = await Market.find();
    if (!listings.length) {
        return message.channel.send({
            embeds: [new EmbedBuilder()
                .setColor('#FFD700')
                .setTitle('🏪 Market Listings')
                .setDescription('No items are currently listed for sale. List yours using `!m sell [item] [qty] [price]`')
            ]
        });
    }

    const marketEmbed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🏪 Market Listings')
        .setDescription('Buy items listed by players!');

    listings.forEach((listing, index) => {
        const itemEmoji = weaponEmojis[listing.item] || ''; // Get the emoji for the item
        marketEmbed.addFields({
            name: `**${index + 1}. ${itemEmoji} ${listing.item} (ID: ${listing.itemId})**`,
            value: `🛒 **Seller:** <@${listing.sellerId}>
            📦 **Quantity:** ${listing.quantity}
            💰 **Price:** ${coinrpgEmoji} ${listing.price} coins each
            🛍️ **Total:** ${coinrpgEmoji} ${listing.price * listing.quantity} coins
            Use \`!m buy ${listing.itemId}\` to purchase or \`!m remove ${listing.itemId}\` to remove it.`
        });
    });

    message.channel.send({ embeds: [marketEmbed] });
}

// Sell an item
async function sellItem(message, userId, args) {
    if (args.length < 3) {
        return message.channel.send({
            embeds: [new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('Invalid Format')
                .setDescription('Use: `!m sell [item] [quantity] [price]`')
            ]
        });
    }

    let item = args.slice(0, -2).join(' ').toLowerCase().replace(/_/g, ' ');
    let quantity = parseInt(args[args.length - 2]);
    let price = parseInt(args[args.length - 1]);

    if (isNaN(quantity) || isNaN(price) || quantity <= 0 || price <= 0) {
        return message.channel.send({
            embeds: [new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('Invalid Quantity or Price!')
                .setDescription('Please enter valid numbers. Example: `!m sell frostbite axe 1 1000000`')
            ]
        });
    }

    if (!allowedMarketWeapons.includes(item)) {
        return message.channel.send({
            embeds: [new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('Restricted Item!')
                .setDescription('You cannot sell this item in market')
            ]
        });
    }

    let userProfile = await User.findOne({ userId });
    if (!userProfile || !userProfile.inventory.weapons) {
        return message.channel.send('You do not own this item.');
    }

    let inventoryWeaponsLower = userProfile.inventory.weapons.map(w => w.toLowerCase());
    let itemCount = inventoryWeaponsLower.filter(w => w === item).length;

    if (itemCount < quantity) {
        return message.channel.send({
            embeds: [new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('Not Enough Items!')
                .setDescription(`You are trying to sell **${quantity}x ${item}**, but you only have **${itemCount}**.`)
            ]
        });
    }

    const itemEmoji = weaponEmojis[item] || ''; // Fixed reference to item emoji

    let removed = 0;
    userProfile.inventory.weapons = userProfile.inventory.weapons.filter(w => {
        if (w.toLowerCase() === item && removed < quantity) {
            removed++;
            return false;
        }
        return true;
    });

    await saveUserProfile(userProfile);

    const itemId = Math.floor(100000 + Math.random() * 900000);

    await Market.create({
        sellerId: userId,
        item,
        quantity,
        price,
        itemId
    });

    message.channel.send({
        embeds: [new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('Item Listed!')
            .setDescription(`You listed **${quantity}x ${itemEmoji} ${item}** for ${coinrpgEmoji} **${price} coins each** in the market! (Item ID: ${itemId})`)
        ]
    });
}

// Buy an item from the market
async function buyItem(message, itemId) {
    const marketItem = await Market.findOne({ itemId });
    if (!marketItem) {
        return message.channel.send({
            embeds: [new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('Item Not Found')
                .setDescription('This item could not be found in the market.')
            ]
        });
    }

    if (marketItem.sellerId === message.author.id) {
        return message.channel.send({
            embeds: [new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('You Cannot Buy Your Own Item')
                .setDescription('You cannot purchase your own item from the market.')
            ]
        });
    }

    const itemEmoji = weaponEmojis[marketItem.item] || '';
    let buyerProfile = await User.findOne({ userId: message.author.id });
    if (!buyerProfile) {
        return message.channel.send('User profile not found.');
    }

    if (buyerProfile.coins < marketItem.price * marketItem.quantity) {
        return message.channel.send({
            embeds: [new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('Not Enough Coins')
                .setDescription(`You do not have enough coins to buy **${marketItem.quantity}x ${itemEmoji} ${marketItem.item}**.`)
            ]
        });
    }

    buyerProfile.coins -= marketItem.price * marketItem.quantity;
    let inventory = buyerProfile.inventory.weapons || [];
    for (let i = 0; i < marketItem.quantity; i++) {
        inventory.push(marketItem.item); 
    }

    let sellerProfile = await User.findOne({ userId: marketItem.sellerId });
    if (!sellerProfile) {
        return message.channel.send('Seller profile not found.');
    }

    sellerProfile.coins += marketItem.price * marketItem.quantity;

    await saveUserProfile(buyerProfile);
    await saveUserProfile(sellerProfile);

    await Market.deleteOne({ itemId });

    message.channel.send({
        embeds: [new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('Item Purchased')
            .setDescription(`You have successfully purchased **${marketItem.quantity}x ${itemEmoji} ${marketItem.item}** for **${marketItem.price * marketItem.quantity} coins**. The seller has received the coins.`)
        ]
    });
}

// Remove an item from the market
async function removeItemFromMarket(message, itemId) {
    const marketItem = await Market.findOne({ itemId });
    if (!marketItem) {
        return message.channel.send({
            embeds: [new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('Item Not Found')
                .setDescription('This item could not be found in the market.')
            ]
        });
    }

    let userProfile = await User.findOne({ userId: message.author.id });
    if (!userProfile) {
        return message.channel.send('User profile not found.');
    }

    const itemEmoji = weaponEmojis[marketItem.item] || '';
    let inventory = userProfile.inventory.weapons || [];
    for (let i = 0; i < marketItem.quantity; i++) {
        inventory.push(marketItem.item);
    }

    userProfile.inventory.weapons = inventory;
    await saveUserProfile(userProfile);

    await Market.deleteOne({ itemId });

    message.channel.send({
        embeds: [new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('Item Removed')
            .setDescription(`You have successfully removed ${itemEmoji} **${marketItem.item}** from the market and it has been returned to your inventory.`)
        ]
    });
}


//guild

// Command: !guild
const args = message.content.split(' ');

// Command: !guild
if (message.content === '!guild' || message.content === '!g') {
    let userProfile = await getUserProfile(userId);
    if (!userProfile) return message.channel.send("❌ You need to create a profile first using `!mw`.");

    if (!userProfile.guild) {
        return message.channel.send("❌ You are not in a guild! Use `!guild create [name]` to start one.");
    }

    let guild = await Guild.findOne({ name: userProfile.guild });
    if (!guild) return message.channel.send("❌ Guild data not found.");

    // Leader badge
    const leaderStatus = guild.leader === userId ? "🏆 Guild Leader" : "👥 Member";
    
    // Conditionally set the verification emoji if the guild is verified
    const verifyEmoji = guild.verified ? verify.verified : '';
    
    const embed = new EmbedBuilder()
        .setColor('#3498db')
        .setTitle(`🛡️ Guild Info`)
        .setDescription(`
            **Guild Name:** **__${guild.name}__** ${verifyEmoji}
            **Level:** ${guild.level} 
            **Description:** ${guild.description}
            **Members:** ${guild.members.length}/30 
            **Status:** ${leaderStatus}
        `)
        .addFields(
            { name: 'Guild Leader', value: `${guild.leader === userId ? 'You' : `<@${guild.leader}>`} are the leader`, inline: false }
        )
        .setFooter({ text: `Requested by ${message.author.username}`, iconURL: message.author.displayAvatarURL() })
        .setThumbnail(guild.banner || 'https://default-guild-banner-url.com'); // Ensure the banner is used if set, fallback to default

    // Buttons for interaction
    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('guild_info').setLabel('🛡️ Guild Info').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('guild_members').setLabel('👥 Members').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('guild_shop').setLabel('⚖️ Guild Shop').setStyle(ButtonStyle.Primary)
    );
    // Second ActionRow for Guild Quests at the bottom
    const secondRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('guild_quests').setLabel('📜 Guild Quests').setStyle(ButtonStyle.Success) // Place Quests button at the bottom
    );
    message.channel.send({ embeds: [embed], components: [buttons] , components: [buttons, secondRow]});

    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isButton()) return;
        const userId = interaction.user.id;
        let userProfile = await User.findOne({ userId: userId });
        
        if (!userProfile || !userProfile.guild) {
            return interaction.reply({ content: "❌ You are not in a guild!", ephemeral: true });
        }
    
        let guild = await Guild.findOne({ name: userProfile.guild });
        if (!guild) {
            return interaction.reply({ content: "❌ Guild data not found.", ephemeral: true });
        }
    
        if (interaction.customId === 'guild_info') {
            const leaderStatus = guild.leader === userId ? "🏆 Guild Leader" : "👥 Member";
            const verifyEmoji = guild.verified ? verify.verified : '';
            const embed = new EmbedBuilder()
                .setColor('#3498db')
                .setTitle(`🛡️ Guild Info`)
                .setDescription(`
                    **Guild Name:** **__${guild.name}__** ${verifyEmoji}
                    **Level:** ${guild.level} 
                    **Description:** ${guild.description}
                    **Members:** ${guild.members.length}/30 
                    **Status:** ${leaderStatus}
                `)
                .addFields(
                    { name: 'Guild Leader', value: `${guild.leader === userId ? 'You' : `<@${guild.leader}>`} are the leader`, inline: false }
                )
                .setFooter({ text: `Requested by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
                .setThumbnail(guild.banner || 'https://default-guild-banner-url.com'); // Ensure the banner is used if set, fallback to default
            
            await interaction.update({ embeds: [embed] });
        }
    
        if (interaction.customId === 'guild_members') {
            const membersList = guild.members.map((memberId, index) => 
                `${index + 1}. <@${memberId}> ${memberId === guild.leader ? '👑 (Leader)' : ''}`
            ).join("\n") || "No members yet.";
    
            const embed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setTitle(`👥 Guild Members - ${guild.name}`)
                .setDescription(membersList);
    
            await interaction.update({ embeds: [embed] });
        }
    
        if (interaction.customId === 'guild_shop') {
            const embed = new EmbedBuilder()
                .setColor('#f1c40f')
                .setTitle(`🛒 Guild Shop - ${guild.name}`)
                .setDescription("The shop is currently under construction! 🏗️");
    
            await interaction.update({ embeds: [embed] });
        }
    
    
        if (interaction.customId === 'guild_quests') {
            const embed = new EmbedBuilder()
                .setColor('#e74c3c')
                .setTitle(`🗡️ Guild Quests - Under Construction`)
                .setDescription("The quest system is currently under construction! Please check back later! 🏗️");
    
            await interaction.update({ embeds: [embed] });
        }
    });
}


// Command: !verify guild [guildname] (only admin can use)
if (args[0] === '!verify' && args[1] === 'guild') {
    // Check if the user is an admin
    if (!message.member.permissions.has('ADMINISTRATOR')) {
        return message.channel.send("❌ You must be an admin to verify a guild.");
    }

    // Check if guild name is provided
    if (!args[2]) {
        return message.channel.send("❌ Please provide a guild name. Example: `!verify guild Knights`.");
    }

    let guildName = args.slice(2).join(' ');
    let guild = await Guild.findOne({ name: guildName });

    if (!guild) return message.channel.send("❌ Guild not found!");

    // Update the guild's verified status to true
    guild.verified = true;
    await guild.save();

    message.channel.send(`✅ Guild **${guildName}** has been verified successfully!`);

    // Optionally, update the guild info with the verified emoji:
    const embed = new EmbedBuilder()
        .setColor('#3498db')
        .setTitle(`${guildemoji} Guild: ${guild.name} ${verificationemoji.verified}`)  // Add the verified emoji here
        .setDescription(`
            **Level:** ${guild.level}
            **Description:** ${guild.description}
            **Members:** ${guild.members.length}/30
            **Status:** 🏆 Guild Leader
        `)
        .setFooter({ text: `Requested by ${message.author.username}`, iconURL: message.author.displayAvatarURL() })
        .setThumbnail(guild.banner || 'https://default-guild-banner-url.com'); // Ensure the banner is used if set, fallback to default

    message.channel.send({ embeds: [embed] });
}



// Command: !guild banner [image URL or file upload]
if (message.content.startsWith('!guild banner')) {
    let userProfile = await getUserProfile(userId);
    if (!userProfile) return message.channel.send("❌ You need to create a profile first using `!mw`.");

    if (!userProfile.guild) {
        return message.channel.send("❌ You are not in a guild! Use `!guild create [name]` to start one.");
    }

    let guild = await Guild.findOne({ name: userProfile.guild });
    if (!guild) return message.channel.send("❌ Guild data not found.");

    // Check if user is the guild leader
    if (guild.leader !== userId) {
        return message.channel.send("❌ You must be the guild leader to set the banner.");
    }

    // Extract the banner URL or handle file upload
    let bannerUrl = message.content.split(' ')[2]; // Extract URL from message
    if (!bannerUrl) {
        if (message.attachments.size > 0) {
            // Handle image upload
            bannerUrl = message.attachments.first().url;
        } else {
            return message.channel.send("❌ Please provide an image URL or upload a file.");
        }
    }

    // Update the guild's banner in the database
    guild.banner = bannerUrl;
    await guild.save();

    // Send confirmation message
    message.channel.send(`✅ Guild banner updated successfully!`);

    // Optionally, you can update the embed with the new banner:
    const embed = new EmbedBuilder()
        .setColor('#3498db')
        .setTitle(`🏰 Guild: ${guild.name}`)
        .setDescription(`
            **Level:** ${guild.level}
            **Description:** ${guild.description}
            **Members:** ${guild.members.length}/30
            **Status:** ${guild.leader === userId ? '🏆 Guild Leader' : '👥 Member'}
        `)
        .addFields(
            { name: 'Guild Leader', value: `${guild.leader === userId ? 'You' : `<@${guild.leader}>`} are the leader`, inline: false }
        )
        .setFooter({ text: `Requested by ${message.author.username}`, iconURL: message.author.displayAvatarURL() })
        .setThumbnail(guild.banner || 'https://default-guild-banner-url.com'); // Use the custom banner URL or a default

    message.channel.send({ embeds: [embed] });
}


// Command: !guild create [name]
if (args[0] === '!guild' && args[1] === 'create') {
    let userProfile = await getUserProfile(userId);
    if (!userProfile) return message.channel.send("❌ You need to create a profile first using `!mw`.");

    if (userProfile.guild) return message.channel.send("❌ You are already in a guild!");

    if (!args[2]) return message.channel.send("❌ Please provide a guild name. Example: `!guild create Knights`.");

    let guildName = args.slice(2).join(' ');
    let existingGuild = await Guild.findOne({ name: guildName });
    if (existingGuild) return message.channel.send("❌ This guild name is already taken.");

    if (userProfile.mysticGems < 50) return message.channel.send("❌ You need **50 Mystic Gems** 💎 to create a guild.");

    userProfile.mysticGems -= 50;
    userProfile.guild = guildName;
    await userProfile.save();

    const newGuild = new Guild({
        name: guildName,
        level: 1,
        description: "Welcome to the guild!",
        members: [userId],
        leader: userId
    });
    await newGuild.save();

    const embed = new EmbedBuilder()
        .setColor('#4CAF50')
        .setTitle(`🎉 Guild Created: ${guildName}`)
        .setDescription(`You have successfully created the guild **${guildName}**!
50 Mystic Gems 💎 have been deducted.`);

    message.channel.send({ embeds: [embed] });
}

// Handle Guild Join Request
if (message.content.startsWith('!guild join')) {
    const args = message.content.split(' ');
    const guildName = args.slice(2).join(' ');
    const userId = message.author.id;

    const guild = await Guild.findOne({ name: guildName });

    if (!guild) return message.reply('❌ Guild not found!');
    
    console.log("Guild data:", guild); // Debugging step
    
    // Ensure leader exists and is a valid Discord ID
    if (!guild.leader || typeof guild.leader !== "string") {
        return message.reply('❌ This guild has no leader assigned or leader ID is invalid!');
    }
    
    // Fetch the guild leader
    try {
        const leader = await client.users.fetch(guild.leader); // <-- Fix: Use `guild.leader`
        
        if (!leader) return message.reply('❌ Could not find the guild leader on Discord.');
    
        // Send join request to leader
        const requestEmbed = new EmbedBuilder()
            .setColor('#ffcc00')
            .setTitle('📩 New Guild Join Request')
            .setDescription(`**${message.author.username}** wants to join **${guild.name}**.`)
            .setFooter({ text: 'Use !approve <@user> or !reject <@user>' });
    
        await leader.send({ embeds: [requestEmbed] });
        message.reply(`✅ Join request sent to the leader of **${guild.name}**.`);
    } catch (error) {
        console.error('Error fetching guild leader:', error);
        message.reply('❌ Failed to send request to the leader.');
    }
}    

// Handle Accepting Join Requests
if (message.content.startsWith('!approve')) {
    const mentionedUser = message.mentions.users.first();
    if (!mentionedUser) return message.reply('❌ Mention a user to accept!');

    // Find the guild where the leader is approving
    const leaderGuild = await Guild.findOne({ leader: message.author.id }); 
    if (!leaderGuild) return message.reply('❌ You are not a guild leader!');

    // Add the user to the guild members list
    leaderGuild.members.push(mentionedUser.id);
    await leaderGuild.save();

    // ✅ FIX: Update the player's `guild` field
    await User.findOneAndUpdate(
        { userId: mentionedUser.id },
        { $set: { guild: leaderGuild.name } } // Set the user's guild name
    );

    // Notify the user and confirm in the chat
    try {
        await mentionedUser.send(`🎉 You have been accepted into **${leaderGuild.name}**!`);
    } catch (error) {
        console.error(`Failed to send DM to ${mentionedUser.username}:`, error);
    }

    message.reply(`✅ **${mentionedUser.username}** has joined **${leaderGuild.name}**!`);
}

// Guild Invite Command (Only Guild Leader Can Use)
if (message.content.startsWith('!guild invite')) {
    if (!message.mentions.users.size) {
        return message.channel.send("⚠️ You need to mention a user to invite.");
    }

    const invitedUser = message.mentions.users.first();
    const inviterId = message.author.id;
    const invitedUserId = invitedUser.id;

    let inviterProfile = await getUserProfile(inviterId);
    let invitedProfile = await getUserProfile(invitedUserId);

    if (!inviterProfile || !inviterProfile.guild) {
        return message.channel.send("❌ You are not in a guild, so you cannot invite players.");
    }

    const guild = await Guild.findOne({ name: inviterProfile.guild });

    if (!guild) {
        return message.channel.send("❌ Guild not found.");
    }

    // Check if the sender is the guild leader
    if (guild.leader !== inviterId) {
        return message.channel.send("⚠️ Only the **Guild Leader** can invite players!");
    }

    if (invitedProfile && invitedProfile.guild) {
        return message.channel.send("⚠️ The mentioned user is already in a guild.");
    }

    // Store the invitation in the database
    await Guild.updateOne(
        { name: guild.name },
        { $push: { invites: invitedUserId } }
    );

    return message.channel.send(`✅ <@${invitedUserId}>, you have been invited to join **${guild.name}** by **${message.author.username}**!\nType \`!acceptguild\` to accept.`);
}

// Accept Guild Invitation Command
if (message.content.startsWith('!acceptguild')) {
    const userId = message.author.id;
    let userProfile = await getUserProfile(userId);

    if (!userProfile) {
        return message.channel.send("❌ You need to create a profile first using `!mw`.");
    }

    if (userProfile.guild) {
        return message.channel.send("⚠️ You are already in a guild.");
    }

    const guild = await Guild.findOne({ invites: userId });

    if (!guild) {
        return message.channel.send("❌ You do not have any pending guild invitations.");
    }

    // Add user to the guild
    await Guild.updateOne(
        { name: guild.name },
        { $pull: { invites: userId }, $push: { members: userId } }
    );

    // Update user profile
    await updateUserProfile(userId, { guild: guild.name });

    return message.channel.send(`✅ You have successfully joined **${guild.name}**!`);
}


// Command: !guild leave
if (args[0] === '!guild' && args[1] === 'leave') {
    let userProfile = await getUserProfile(userId);
    if (!userProfile || !userProfile.guild) return message.channel.send("❌ You are not in a guild! Use `!guild join [guildname]` to join a guild.");

    let guild = await Guild.findOne({ name: userProfile.guild });
    if (!guild) return message.channel.send("❌ Guild data not found.");

    // Check if the user is the guild leader
    if (guild.leader === userId) return message.channel.send("❌ You cannot leave the guild as a leader. You must transfer leadership first.");

    // Remove user from guild and update user profile
    guild.members = guild.members.filter(memberId => memberId !== userId);
    userProfile.guild = null;

    await guild.save();
    await userProfile.save();

    const embed = new EmbedBuilder()
        .setColor('#f39c12')
        .setTitle(`🚪 Left Guild: ${guild.name}`)
        .setDescription(`You have successfully left the guild **${guild.name}**.`);

    message.channel.send({ embeds: [embed] });
}

// Command: !guild kick [@user]
if (args[0] === '!guild' && args[1] === 'kick') {
    let userProfile = await getUserProfile(userId);
    if (!userProfile || !userProfile.guild) return message.channel.send("❌ You must be in a guild to kick members.");

    let guild = await Guild.findOne({ name: userProfile.guild });
    if (!guild || guild.leader !== userId) return message.channel.send("❌ Only the guild leader can kick members.");

    let mentionedUser = message.mentions.users.first();
    if (!mentionedUser) return message.channel.send("❌ Please mention a user to kick.");

    let mentionedProfile = await getUserProfile(mentionedUser.id);
    if (!mentionedProfile || mentionedProfile.guild !== userProfile.guild) return message.channel.send("❌ That user is not in your guild.");

    // Remove the user from the guild and update their profile
    guild.members = guild.members.filter(memberId => memberId !== mentionedUser.id);
    mentionedProfile.guild = null;

    await guild.save();
    await mentionedProfile.save();

    const embed = new EmbedBuilder()
        .setColor('#e74c3c')
        .setTitle(`👢 Kicked from Guild: ${guild.name}`)
        .setDescription(`**${mentionedUser.username}** has been kicked from the guild **${guild.name}**.`);

    message.channel.send({ embeds: [embed] });
}


// Command to give daily reward to all members in a verified guild
const giveDailyReward = async (guild) => {
    if (!guild.verified) return; // Skip if the guild is not verified

    const currentTime = new Date();
    const lastRewardedTime = guild.lastRewarded ? new Date(guild.lastRewarded) : null;

    // If lastRewarded is null (first-time reward) or 12 hours have passed, give the reward
    if (!lastRewardedTime || (currentTime - lastRewardedTime) >= 12 * 60 * 60 * 1000) {
        console.log(`[DEBUG] Rewarding Mystic Gems to ${guild.name}`);

        for (const memberId of guild.members) {
            let userProfile = await getUserProfile(memberId);
            if (userProfile) {
                userProfile.mysticGems = (userProfile.mysticGems || 0) + 50;
                await userProfile.save();

                // Send a DM to the member
                try {
                    const user = await client.users.fetch(memberId);
                    await user.send(`🎉 You received **50 Mystic Gems** from **${guild.name}**! 💎`);
                } catch (error) {
                    console.log(`Could not send DM to ${memberId}: ${error.message}`);
                }
            }
        }

        // Update lastRewarded time and save to DB
        guild.lastRewarded = currentTime;
        await guild.save();
    } else {
        console.log(`[DEBUG] Skipping reward for ${guild.name}, cooldown active.`);
    }
};



const distributeGuildRewards = async () => {
    console.log(`[DEBUG] Checking guild rewards at ${new Date().toISOString()}`);

    const verifiedGuilds = await Guild.find({ verified: true });

    for (const guild of verifiedGuilds) {
        await giveDailyReward(guild);
    }
};

// Run once when bot starts
distributeGuildRewards();

// Then run every 12 hours
setInterval(distributeGuildRewards, 12 * 60 * 60 * 1000);
// setInterval(distributeGuildRewards, 60 * 1000); // Runs every 1 minute







// Command: !guildinfo or !ginfo
if (message.content.startsWith('!guildinfo') || message.content.startsWith('!ginfo')) {
    // Extract guild name from the message
    const args = message.content.split(' ');
    const guildName = args.slice(1).join(' '); // Guild name might have spaces, so we join the rest of the arguments.

    if (!guildName) {
        return message.channel.send("❌ Please provide a guild name. Example: `!guildinfo [guildname]`.");
    }

    // Find the guild by name
    let guild = await Guild.findOne({ name: guildName });

    if (!guild) return message.channel.send("❌ Guild not found!");

    // Leader badge
    const leaderStatus = guild.leader === message.author.id ? "🏆 Guild Leader" : "👥 Member";
    const verifiedEmoji = guild.verified ? '<:Verified:1338013411304411196>' : ''; // Show Verified emoji if verified

    // Create Embed
    const embed = new EmbedBuilder()
        .setColor('#3498db')
        .setTitle(`🛡️ Guild`)
        .setDescription(`
            **Guild:** **__${guild.name}__** ${verifiedEmoji}
            **Level:** ${guild.level} 
            **Description:** ${guild.description}
            **Members:** ${guild.members.length}/30 
        `)
        .addFields(
            { name: 'Guild Leader', value: `${guild.leader === message.author.id ? 'You' : `<@${guild.leader}>`}`, inline: false }
        )
        .setFooter({ text: `Requested by ${message.author.username}`, iconURL: message.author.displayAvatarURL() })
        .setThumbnail(guild.banner || 'https://default-guild-banner-url.com'); // Ensure the banner is used if set, fallback to default

    // Send the embed
    message.channel.send({ embeds: [embed] });
}




// Command: !guild list or !g list
if (message.content === '!guild list' || message.content === '!g list') {
    // Fetch all guilds from the database
    let guilds = await Guild.find();

    if (guilds.length === 0) {
        return message.channel.send("❌ No guilds available.");
    }

    // Create a list of guild names and their verification status
    let guildList = guilds.map(guild => {
        const verifiedEmoji = guild.verified ? '<:Verified:1338013411304411196>' : '';
        return `**${guild.name}** ${verifiedEmoji}\n- Level: ${guild.level}\n- Members: ${guild.members.length}/30\n`;
    }).join('\n');

    // Create Embed
    const embed = new EmbedBuilder()
        .setColor('#3498db')
        .setTitle('🌟 Available Guilds 🌟')
        .setDescription(`
            Here are all the available guilds! 🌍
            Choose one to join or view more details below:
            
            ${guildList}

            ----------------------------

            **How to Join a Guild:**
            \`!guild join [guild name]\` to join any of the above guilds. 🏰

            **How to View a Guild's Details:**
            \`!guildinfo [guild name]\` to see more information about the guild. 🔎
        `)
        .setFooter({ text: `Requested by ${message.author.username}`, iconURL: message.author.displayAvatarURL() })
        .setThumbnail('https://example.com/thumbnail-image.jpg'); // Optionally, add a cool thumbnail for the embed

    // Send the embed
    message.channel.send({ embeds: [embed] });
}




//guild upgrade
if (message.content.startsWith('!guild upgrade')) {
    const userId = message.author.id;
    const userProfile = await User.findOne({ userId: userId });
    if (!userProfile || !userProfile.guild) {
        return message.reply('❌ You are not in a guild!');
    }

    const guild = await Guild.findOne({ name: userProfile.guild });
    if (!guild || guild.leader !== userId) {
        return message.reply('❌ Only the guild leader can upgrade the guild!');
    }

    const upgradeCosts = [0, 100, 200, 300, 400, 500, 600, 700, 800, 900];
    const goldBonus = [0, 5, 10, 15, 20, 25, 30, 35, 40, 50];

    if (guild.level >= 10) {
        return message.reply('✅ Your guild is already at the maximum level!');
    }

    const upgradeCost = upgradeCosts[guild.level];
    if (userProfile.mysticGems < upgradeCost) {
        return message.reply(`❌ You need ${upgradeCost} Mystic Gems to upgrade your guild!`);
    }

    // Deduct gems and upgrade guild
    userProfile.mysticGems -= upgradeCost;
    guild.level += 1;
    guild.goldBonus = goldBonus[guild.level - 1] || goldBonus[4]; // Apply correct perk
    await userProfile.save();
    await guild.save();

    const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle(`🏆 Guild Upgrade Successful!`)
        .setDescription(`🎉 **${guild.name}** has leveled up to **Level ${guild.level}**!`)
        .addFields(
            { name: '🔼 New Perk', value: `+${goldBonus[guild.level - 1] || goldBonus[4]}% more gold from battles!`, inline: true },
            { name: '💎 Cost', value: `${upgradeCost} Mystic Gems`, inline: true },
            { name: '📈 Next Upgrade Cost', value: guild.level < 5 ? `${upgradeCosts[guild.level]} Mystic Gems` : 'Max Level', inline: false }
        )
        .setFooter({ text: `Upgrade completed by ${message.author.username}`, iconURL: message.author.displayAvatarURL() });

    message.channel.send({ embeds: [embed] });
}


//guild bank 

if (message.content.startsWith('!guild donate')) {
    const args = message.content.split(' ');
    const userId = message.author.id;
    const guild = await Guild.findOne({ members: userId });
    
    if (!guild) {
        return message.channel.send("❌ You are not in a guild.");
    }

    if (args.length < 3) {
        return message.channel.send("⚠️ Usage: `!guild donate [coins/gems] [amount]`");
    }

    const type = args[2].toLowerCase(); // Either 'coins' or 'gems'
    const amount = parseInt(args[3]);

    if (isNaN(amount) || amount <= 0) {
        return message.channel.send("❌ Please enter a valid donation amount.");
    }

    // Fetch the player's profile
    let userProfile = await getUserProfile(userId);

    if (type === "coins") {
        if (userProfile.coins < amount) {
            return message.channel.send(`❌ You don't have enough <:coin:1300687053792739328> **coins** to donate.`);
        }
        userProfile.coins -= amount;
        guild.bank.coins += amount;
    } else if (type === "gems") {
        if (userProfile.mysticGems < amount) {
            return message.channel.send(`❌ You don't have enough <:mysticgem:1336377747357831311> **Mystic Gems** to donate.`);
        }
        userProfile.mysticGems -= amount;
        guild.bank.gems += amount;
    } else {
        return message.channel.send("⚠️ Invalid donation type. Use `coins` or `gems`.");
    }

    // Save updates
    await userProfile.save();
    await guild.save();

    return message.channel.send(`✅ You donated **${amount} ${type === "coins" ? "<:coin:1300687053792739328>" : "<:mysticgem:1336377747357831311>"}** to **${guild.name}**!`);
}



if (message.content.startsWith('!guild bank')) {
    const userId = message.author.id;
    const guild = await Guild.findOne({ members: userId });

    if (!guild) {
        return message.channel.send("❌ You are not in a guild.");
    }

    const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle(`🏦 ${guild.name} Guild Bank`)
        .setDescription(`Here are the total donations for your guild.`)
        .addFields(
            { name: "Total Coins", value: `<:coin:1300687053792739328> **${guild.bank.coins}**`, inline: true },
            { name: "Total Mystic Gems", value: `<:mysticgem:1336377747357831311> **${guild.bank.gems}**`, inline: true }
        )
        .setFooter({ text: "Donate using `!guild donate [coins/gems] [amount]`" });

    return message.channel.send({ embeds: [embed] });
}

//withdrawl guid bank
if (message.content.startsWith('!guild withdraw') || message.content.startsWith('!guild w')) {
    const args = message.content.split(' ');
    const userId = message.author.id;
    const guild = await Guild.findOne({ leader: userId });

    if (!guild) {
        return message.channel.send("❌ You are not a **Guild Leader**, so you cannot withdraw funds.");
    }

    if (args.length < 3) {
        return message.channel.send("⚠️ Usage: `!guild withdraw [coins/gems] [amount]`");
    }

    const type = args[2].toLowerCase(); // Either 'coins' or 'gems'
    const amount = parseInt(args[3]);

    if (isNaN(amount) || amount <= 0) {
        return message.channel.send("❌ Please enter a **valid amount** to withdraw.");
    }

    // Fetch the leader's profile
    let leaderProfile = await getUserProfile(userId);

    if (type === "coins") {
        if (guild.bank.coins < amount) {
            return message.channel.send(`❌ The guild bank **does not have enough** <:coin:1300687053792739328> **coins**.`);
        }
        guild.bank.coins -= amount;
        leaderProfile.coins += amount;
    } else if (type === "gems") {
        if (guild.bank.gems < amount) {
            return message.channel.send(`❌ The guild bank **does not have enough** <:mysticgem:1336377747357831311> **Mystic Gems**.`);
        }
        guild.bank.gems -= amount;
        leaderProfile.mysticGems += amount;
    } else {
        return message.channel.send("⚠️ Invalid withdrawal type. Use `coins` or `gems`.");
    }

    // Save updates
    await guild.save();
    await leaderProfile.save();

    return message.channel.send(`✅ **${amount} ${type === "coins" ? "<:coin:1300687053792739328>" : "<:mysticgem:1336377747357831311>"}** has been withdrawn from the guild bank and added to your balance!`);
}


//guild points
if (message.content === "!guild points" || message.content === "!g points") {
    let userProfile = await getUserProfile(userId);
    if (!userProfile.guild) return message.channel.send("You're not in a guild!");

    let userGuild = await Guild.findOne({ name: userProfile.guild });
    if (!userGuild) return message.channel.send("Guild not found!");

    let rankings = [...userGuild.memberPoints.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([id, points], index) => `**${index + 1}.** <@${id}> → **${points}** pts`)
        .join("\n");

    const embed = new EmbedBuilder()
        .setColor("#FFD700")
        .setTitle(`🏆 ${userGuild.name} Guild Points`)
        .setDescription(`**Total Guild Points:** **${userGuild.guildPoints}**\n\n**🏅 Member Contributions:**\n${rankings || "No contributions yet."}`)
        .addFields({
            name: "💡 How to Earn Guild Points?",
            value: "Guild Points are earned when a guild member **defeats an enemy** in battle! The stronger the enemy, the more points your guild earns.\n\n" +
                "**💥 Points Per Enemy Defeated:**\n" +
                "- 🟢 **Goblin** → **10 pts**\n" +
                "- 🐺 **Wolf** → **15 pts**\n" +
                "- 🏹 **Orc** → **20 pts**\n" +
                "- 👸 **Elysia** → **25 pts**\n" +
                "- ⚔️ **Cursed Knight** → **30 pts**\n" +
                "- 🛡 **Ancient Guard** → **35 pts**\n" +
                "- 🐉 **Tundragon** → **40 pts**\n\n" +
                "**📈 Why Earn Guild Points?**\n" +
                "- 🏅 **Rank your guild higher** in the leaderboard (`!rank guild`).\n" +
                "- 🎖 **Prove your guild’s strength** and compete against others!\n" +
                "- 🔥 **Weekly Guild Resets** keep the competition fresh!"
        });

    message.channel.send({ embeds: [embed] });
}



if (message.content === "!rank guild") {
    let guilds = await Guild.find().sort({ guildPoints: -1 }).limit(10);

    let leaderboard = guilds.map((g, index) => `**${index + 1}.** ${g.name} → **${g.guildPoints}** pts`).join("\n");

    const embed = new EmbedBuilder()
        .setColor("#FFD700")
        .setTitle("🏆 Guild Leaderboard")
        .setDescription(leaderboard || "No guilds have earned points yet.");

    message.channel.send({ embeds: [embed] });
}

const REWARD_CHANNEL_ID = "1338930761226522735"; // Channel to send results

let isProcessingRewards = false; // Lock to prevent duplicate executions

setInterval(async () => {
    if (isProcessingRewards) return; // Prevent duplicate execution
    isProcessingRewards = true; // Lock the process

    let guilds = await Guild.find().sort({ guildPoints: -1 }).limit(10); // Sort guilds by points
    if (guilds.length === 0) {
        isProcessingRewards = false;
        return;
    }

    const rewards = [
        { gems: 1000, coins: 1000000 }, // 1st place
        { gems: 750, coins: 500000 },   // 2nd place
        { gems: 550, coins: 250000 },   // 3rd place
        { gems: 0, coins: 100000 },     // 4th place
        { gems: 0, coins: 50000 },      // 5th place
        { gems: 0, coins: 10000 },      // 6th place
    ];

    let rewardMessage = "**🏆 Weekly Guild Rankings & Rewards! 🏆**\n\n";
    
    for (let i = 0; i < guilds.length; i++) {
        let guild = guilds[i];
        let reward = rewards[i] || { gems: 0, coins: 5000 }; // Default for 7th and below

        guild.bank.coins += reward.coins;
        guild.bank.gems += reward.gems;
        await guild.save();

        rewardMessage += `**${i + 1}. ${guild.name}** → 🏅 **${guild.guildPoints} pts**\n`;
        rewardMessage += `💰 **+${reward.coins} Coins** | 💎 **+${reward.gems} Gems** added to Guild Bank!\n\n`;
    }

    let resultsChannel = await client.channels.fetch(REWARD_CHANNEL_ID);
    if (resultsChannel) {
        await resultsChannel.send({ embeds: [new EmbedBuilder().setColor("#FFD700").setTitle("🏆 Weekly Guild Results!").setDescription(rewardMessage)] });
    }

    // Reset guildPoints and memberPoints after distributing rewards
    await Guild.updateMany({}, { $set: { guildPoints: 0, memberPoints: {} } });

    console.log("✅ Weekly Guild Points Reset & Rewards Distributed!");

    isProcessingRewards = false; // Unlock after completion
}, 7 * 24 * 60 * 60 * 1000); // Runs every 7 days





// Inside the message event listener
if (message.content === '!map') {
    handleMapCommand(message);
}

if (message.content.startsWith('!map explore') || message.content.startsWith('!map exp')) {
    const args = message.content.split(' ').slice(2);
    handleExploreCommand(message, args);
}



//ark boss
if (message.content.startsWith('!spawn arkboss') || message.content.startsWith('!spawn ab')) {
    if (!message.member.permissions.has('ADMINISTRATOR')) {
        return message.channel.send("❌ You don't have permission to spawn the boss!");
    }

    const bossName = 'goblin_lord';
    const maxHp = 100000;

    let boss = await ArkBoss.findOne({ bossName });
    if (boss) {
        return message.channel.send(`⚠️ **Goblin Lord is already spawned with ${boss.hp} HP!**`);
    }

    boss = new ArkBoss({ bossName, hp: maxHp, maxHp });
    await boss.save();

    message.channel.send(`🔥 **Goblin Lord has been spawned with ${maxHp} HP!**`);

    // ✅ Send a notification to the boss battle channel (1341024607523573874)
    const bossChannel = client.channels.cache.get('1341024607523573874');
    if (bossChannel) {
        bossChannel.send(`⚠️ **A powerful boss has appeared!**\n👹 **Goblin Lord** has been spawned with **100,000 HP**!\nUse \`!fight goblin_lord\` to join the battle! ⚔️`);
    } else {
        console.error("Failed to find channel 1341024607523573874");
    }
}



        
});

    
    



 

    (async () => {
        try {
            await mongoose.connect(process.env.MONGODB_URI, {  });
            console.log("Connected to DB.");
    
            mongoose.connection.on('connected', () => {
                console.log('Mongoose connected to DB');
            });
    
            mongoose.connection.on('error', (err) => {
                console.error('Mongoose connection error:', err);
            });
    
            mongoose.connection.on('disconnected', () => {
                console.log('Mongoose disconnected');
            });
    
            // Call your event handler here if needed
        } catch (error) {
            console.error("Database connection error:", error);
        }
    })();

 
// Save profiles when the bot shuts down
// process.on('exit', saveProfiles);
// process.on('SIGINT', () => {
//     saveProfiles();
//     process.exit();
// });

// Login to Discord with your bot's token
client.login(process.env.TOKEN);





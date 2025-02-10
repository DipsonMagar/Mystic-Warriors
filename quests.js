// quests.js

const { EmbedBuilder } = require('discord.js');
const User = require('./userSchema'); // Update with the correct path to your user schema file


// Quest types and their requirements
const questTypes = {
    killEnemies: {
        name: "Monster Hunter",
        description: "Defeat any combination of enemies",
        required: 10,
        reward: {
            coins: 500,
            exp: 200
        }
    },
    killGoblins: {
        name: "Goblin Slayer",
        description: "Defeat goblins",
        required: 5,
        reward: {
            coins: 300,
            exp: 150
        }
    },
    killWolves: {
        name: "Wolf Hunter",
        description: "Defeat wolves",
        required: 5,
        reward: {
            coins: 400,
            exp: 200
        }
    },
    killOrcs: {
        name: "Orc Vanquisher",
        description: "Defeat orcs",
        required: 3,
        reward: {
            coins: 600,
            exp: 300
        }
    }
};

// Function to generate daily quests for a user
// console.log('questTypes at the start of generateDailyQuests:', questTypes);

function generateDailyQuests(userProfile) {
    if (!userProfile.quests) {
        userProfile.quests = {
            active: {},
            progress: {},
            lastReset: Date.now(),
            lastQuestGeneration: Date.now(),
        };
    } else {
        userProfile.quests.active = userProfile.quests.active || {};
        userProfile.quests.progress = userProfile.quests.progress || {};
        userProfile.quests.lastReset = userProfile.quests.lastReset || Date.now();
        userProfile.quests.lastQuestGeneration = userProfile.quests.lastQuestGeneration || Date.now();
    }

    const now = Date.now();
    const cooldownPeriod = 3600000; // 1 hour in milliseconds
    const timeSinceLastGeneration = now - userProfile.quests.lastQuestGeneration;

    console.log('--- Debug Logs ---');
    console.log('Current Time:', new Date(now).toISOString());
    console.log('Last Quest Generation:', new Date(userProfile.quests.lastQuestGeneration).toISOString());
    console.log('Time Since Last Generation (ms):', timeSinceLastGeneration);

    const allQuestsCompleted = Object.keys(userProfile.quests.active).length === 0;

    if (allQuestsCompleted) {
        // Only start the cooldown if the user has completed all quests
        const isCooldownOver = timeSinceLastGeneration >= cooldownPeriod;

        if (isCooldownOver) {
            // Reset quests and generate new ones
            userProfile.quests.active = {};
            userProfile.quests.progress = {};
            userProfile.quests.lastReset = now;
            userProfile.quests.lastQuestGeneration = now; // Update ONLY when new quests are generated!

            const availableQuests = Object.keys(questTypes);
            const selectedQuests = [];
            while (selectedQuests.length < 3 && availableQuests.length > 0) {
                const randomIndex = Math.floor(Math.random() * availableQuests.length);
                const questType = availableQuests.splice(randomIndex, 1)[0];
                selectedQuests.push(questType);
            }

            selectedQuests.forEach((questType) => {
                userProfile.quests.active[questType] = { ...questTypes[questType] };
                userProfile.quests.progress[questType] = 0;
            });

            console.log('New Quests Generated:', userProfile.quests.active);
        } else {
            console.log('Cooldown is still active. No new quests generated.');
        }
    }

    const remainingCooldown = allQuestsCompleted
        ? Math.max(cooldownPeriod - timeSinceLastGeneration, 0)
        : 0;

    console.log('Remaining Cooldown (ms):', remainingCooldown);
    console.log('-------------------');

    return { quests: userProfile.quests, remainingCooldown };
}






// Function to update quest progress
async function updateQuestProgress(userProfile, enemyType) {
    if (!userProfile.quests || !userProfile.quests.active) {
        console.log('No active quests found for this user.');
        return null;
    }

    let rewardsGained = { coins: 0, exp: 0 };
    let completedQuests = [];
    let completedQuestNames = [];

    console.log('Initial quests:', JSON.stringify(userProfile.quests, null, 2));

    // General kill quest
    if (userProfile.quests.active.killEnemies) {
        userProfile.quests.progress.killEnemies = (userProfile.quests.progress.killEnemies || 0) + 1;
        console.log(`killEnemies progress: ${userProfile.quests.progress.killEnemies}/${userProfile.quests.active.killEnemies.required}`);

        if (userProfile.quests.progress.killEnemies >= userProfile.quests.active.killEnemies.required) {
            rewardsGained.coins += userProfile.quests.active.killEnemies.reward.coins;
            rewardsGained.exp += userProfile.quests.active.killEnemies.reward.exp;
            completedQuests.push('killEnemies');
            completedQuestNames.push(userProfile.quests.active.killEnemies.name);
        }
    }

    // Specific enemy quest mapping
    const questMapping = {
        wolf: 'killWolves',
        goblin: 'killGoblins',
        orc: 'killOrcs'
    };
    const questKey = questMapping[enemyType];

    if (questKey && userProfile.quests.active[questKey]) {
        userProfile.quests.progress[questKey] = (userProfile.quests.progress[questKey] || 0) + 1;
        console.log(`${questKey} progress: ${userProfile.quests.progress[questKey]}/${userProfile.quests.active[questKey].required}`);

        if (userProfile.quests.progress[questKey] >= userProfile.quests.active[questKey].required) {
            rewardsGained.coins += userProfile.quests.active[questKey].reward.coins;
            rewardsGained.exp += userProfile.quests.active[questKey].reward.exp;
            completedQuests.push(questKey);
            completedQuestNames.push(userProfile.quests.active[questKey].name);
        }
    }

    if (completedQuests.length > 0) {
        // Apply rewards
        userProfile.coins += rewardsGained.coins;
        userProfile.experience += rewardsGained.exp;

        // Remove completed quests
        completedQuests.forEach((quest) => {
            delete userProfile.quests.active[quest];
            delete userProfile.quests.progress[quest];
        });
    }

    // Directly update MongoDB
    try {
        const updatedProfile = await User.findOneAndUpdate(
            { userId: userProfile.userId },
            {
                $set: {
                    'quests.active': userProfile.quests.active,
                    'quests.progress': userProfile.quests.progress,
                    coins: userProfile.coins,
                    experience: userProfile.experience,
                }
            },
            { new: true } // Return the updated document
        );

        console.log('Updated quests in MongoDB:', JSON.stringify(updatedProfile.quests, null, 2));
        return { rewardsGained, completedQuests, completedQuestNames };
    } catch (error) {
        console.error('Error updating quest progress in MongoDB:', error);
    }

    return null;
}







// Function to display current quests
function displayQuests(userProfile) {
    const { quests, remainingCooldown } = generateDailyQuests(userProfile);

    const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('🎯 Daily Quests');

    if (Object.keys(quests.active).length > 0) {
        embed.setDescription('Complete your active quests to earn rewards!');
        for (const [questKey, quest] of Object.entries(quests.active)) {
            const progress = userProfile.quests.progress[questKey] || 0; // Read the progress from the user profile
            const progressBar = getProgressBar(progress, quest.required);
            embed.addFields({
                name: quest.name,
                value: `${quest.description}\n${progressBar} (${progress}/${quest.required})\nRewards: ${quest.reward.coins} coins, ${quest.reward.exp} exp`,
            });
        }
    } else if (remainingCooldown > 0) {
        const hours = Math.floor(remainingCooldown / 3600000);
        const minutes = Math.floor((remainingCooldown % 3600000) / 60000);
        const seconds = Math.floor((remainingCooldown % 60000) / 1000);
        embed.setDescription(`Next quest reset in **${hours}h ${minutes}m ${seconds}s**.`);
    } else {
        embed.setDescription('You currently have no active quests. Try again later!');
    }

    return embed;
}



function getProgressBar(current, max, size = 10) {
    const percentage = Math.min(Math.max(current / max, 0), 1); // Ensure percentage is between 0 and 1
    const filled = Math.round(size * percentage);
    const empty = Math.max(size - filled, 0); // Ensure empty is not negative
    return '█'.repeat(filled) + '░'.repeat(empty);
}

module.exports = {
    questTypes, // Ensure this is included
    generateDailyQuests,
    updateQuestProgress,
    displayQuests
};

const activeBattles = new Set();
const activeSearches = new Set();
const searchingPlayers = new Set();


function isUserInBattle(userId) {
    return activeBattles.has(userId);
}

function addUserToBattle(userId) {
    activeBattles.add(userId);
}

function removeUserFromBattle(userId) {
    activeBattles.delete(userId);
}

function isUserSearching(userId) {
    return activeSearches.has(userId);
}

function addUserToSearch(userId) {
    activeSearches.add(userId);
}

function removeUserFromSearch(userId) {
    activeSearches.delete(userId);
}


function isUserSearching(userId) {
    return searchingPlayers.has(userId);
}

function addUserToSearch(userId) {
    searchingPlayers.add(userId);
}

function removeUserFromSearch(userId) {
    searchingPlayers.delete(userId);
}

module.exports = { 
    activeBattles, isUserInBattle, addUserToBattle, removeUserFromBattle, 
    isUserSearching, addUserToSearch, removeUserFromSearch , searchingPlayers
};


const util = require("../util.js");

module.exports = {
    name: "xptracker",
    description: "tracks the gained GXP of players",
    syntax: '{-p <player1> [...players] | -g <guild name>}',
    examples: ['-p Salted HeyZeer0 Jumla', '-g Wynn Content Team, Wynncraft'],
    run: async function (args) {

        // base vars
        let displayAll = null;
        const playerUUIDs = [];
        const players = [];
        const guilds = [];

        // input verification
        const flag = args.shift();
        switch (flag) {
            case "-p": // players: get all player UUIDs and their guilds, make sure all players have a guild and exist
                if (args.length === 0) {
                    util.log('You need to specify at least one player name when using "-p"', "FATAL", "modules/xptracker");
                    global.activeModule = null;
                    return;
                }
                const promises = [];
                for (const p of args) {
                    if (!util.isValidPlayerName(p)) {
                        util.log(`"${p}" is not a valid player name. Player names should only be seperated by spaces`, "FATAL", "modules/xptracker");
                        global.activeModule = null;
                        return;
                    }
                    promises.push(util.requestWynnAPI(util.wynnAPIRoutes.player.replace("<player>", p)));
                }
                const players = await Promise.all(promises).catch(e => {
                    util.log("Error while fetching players, please make sure all names are spelled correctly and try again", "FATAL", "modules/xptracker");
                    global.activeModule = null;
                });
                if (!global.activeModule) return;

                for (const p of players) {
                    if (p.data[0].guild.name) {
                        playerUUIDs.push(p.data[0].uuid);
                        if (!guilds.find(v => v.name === p.data[0].guild.name)) {
                            guilds.push({
                                name: p.data[0].guild.name,
                                tag: undefined,
                                timestamps: []
                            });
                        }
                    } else {
                        util.log(`${p.data[0].username} is not in a guild`, "FATAL", "modules/xptracker");
                        global.activeModule = null;
                        return;
                    }
                }
                displayAll = false;
                break;
            case "-g": // guild: simply parse guild names
                const guildNames = args.join(" ").split(",");
                if (guildNames.length === 0) {
                    util.log('You need to specify at least one guild name when using "-g"', "FATAL", "modules/xptracker");
                    global.activeModule = null;
                    return;
                }
                for (const guild of guildNames) {
                    guilds.push({
                        name: guild.trim(),
                        tag: undefined,
                        timestamps: [],
                    });
                }
                displayAll = true;
                break;
            default:
                util.log('You need to specify either "-p <player1> [...players]" or "-g <guild_name1>[, ...guild_names]"', "FATAL", "modules/xptracker");
                global.activeModule = null;
                return;
        }

        // run module
        // delayed self call
        let c = -1;
        function tick () {
            if (global.activeModule !== "xptracker") {
                util.log("§8Module Stopped!", "INFO", "modules/xptracker");
                return;
            }
            setTimeout(tick, 1000);
            c = (c + 1) % 60;
            if (c === 0) {
                output();
            }
        }

        /**
         * execute tracker
         */
        async function output () {
            const now = Date.now();

            // request api
            const promises = guilds.map(v => util.requestWynnAPI(util.wynnAPIRoutes.guild.replace("<guild>", v.name.split(" ").join("%20"))));
            const guildsData = await Promise.all(promises).catch(e => {
                util.log(`Error while fetching guilds: ${e}`, "WARNING", "modules/xptracker");
                return [];
            });

            if (guildsData.length > 0) {
                const playersToDisplay = playerUUIDs.slice();

                for (const g of guildsData) {
                    // get corresponding element in guild list
                    const guild = guilds.find(v => v.name === g.name);
                    if (guild.timestamps[guild.timestamps.length - 1] >= g.request.timestamp * 1000) {
                        // not all guilds have updated yet, update at later time
                        return;
                    }
                }

                for (const g of guildsData) {
                    // get corresponding elemend in guild list
                    const guild = guilds.find(v => v.name === g.name);

                    // update timestamps
                    while (guild.timestamps[0] + 600000 < now) {
                        guild.timestamps.shift();
                    }
                    guild.timestamps.push(g.request.timestamp * 1000);

                    // set tag
                    if (!guild.tag) {
                        guild.tag = g.prefix;
                    }

                    // iterate over members and update each xp value
                    for (const mem of g.members) {
                        let player = players.find(v => v.uuid === mem.uuid);
                        if (!player) { // create new if not found
                            player = {
                                name: mem.name,
                                uuid: mem.uuid,
                                xp: [],
                                xpAtSessionStart: mem.contributed,
                                guild: guild
                            };
                            players.push(player);
                        }

                        // mark for display
                        const idx = playerUUIDs.findIndex(v => v === player.uuid);
                        if (idx >= 0) {
                            playersToDisplay.splice(idx, 1, player);
                        } else if (mem.contributed - player.xp[player.xp.length - 1] > 0 && displayAll) {
                            playersToDisplay.push(player);
                        }

                        // clear out xp from more than 10 mins ago
                        while (player.xp.length > guild.timestamps.length) {
                            player.xp.shift();
                        }
                        player.xp.push(mem.contributed);
                    }
                }

                // clear out tracked players if they leave their guild
                for (let i = 0; i < playerUUIDs.length; i++) {
                    if (!playersToDisplay.find(v => v.uuid === playerUUIDs[i])) {
                        util.log(`${playerUUIDs[i]} has left their guild and have been removed from tracking`, "WARNING", "modules/xptracker");
                        playerUUIDs.splice(i, 1);
                        i--;
                    }
                }

                const string = `§2
┏━━━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ Players Tracked        ┃ ${players.length.toString().padEnd(80)} ┃
┃ Time Since Last Update ┃                                                                                  ┃${guilds.reduce((p, c) => p + `
┃ - ${c.name.padEnd(20)} ┃ ${util.formatDuration(c.timestamps[c.timestamps.length - 1] - (c.timestamps[c.timestamps.length - 2] || 0), false, true).padEnd(80)} ┃`, "")}
┣━━━━━━━━━━━━━━━━━━┳━━━━━╋━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━━┫
┃      Player Name ┃ Tag ┃     Total Guild XP ┃  Total GXP Gain ┃      Minutely Rates ┃   10-Minute Average ┃
┣━━━━━━━━━━━━━━━━━━╋━━━━━╋━━━━━━━━━━━━━━━━━━━━╋━━━━━━━━━━━━━━━━━╋━━━━━━━━━━━━━━━━━━━━━╋━━━━━━━━━━━━━━━━━━━━━┫${playersToDisplay.reduce((p, c) => {
                        const diff = c.guild.timestamps[c.guild.timestamps.length - 1] - (c.guild.timestamps[c.guild.timestamps.length - 2] || 0);
                        const currentSlope = Math.round((c.xp[c.xp.length - 1] - (c.xp[c.xp.length - 2] || 0)) / diff * 60000);
                        const tenMinuteAverage = Math.round((c.xp[c.xp.length - 1] - c.xp[0]) / (c.guild.timestamps[c.guild.timestamps.length - 1] - c.guild.timestamps[0]) * 60000);
                        return p + `\n┃ ${c.name.padStart(16)} ┃ ${c.guild.tag.padEnd(4)}┃ ${util.formatNumber(c.xp[c.xp.length - 1]).padStart(18)} ┃ ${util.formatNumber(c.xp[c.xp.length - 1] - c.xpAtSessionStart).padStart(15)} ┃ ${util.formatNumber(currentSlope).padStart(14)} XP/m ┃ ${util.formatNumber(tenMinuteAverage).padStart(14)} XP/m ┃`;
                    }, "")}
┗━━━━━━━━━━━━━━━━━━┻━━━━━┻━━━━━━━━━━━━━━━━━━━━┻━━━━━━━━━━━━━━━━━┻━━━━━━━━━━━━━━━━━━━━━┻━━━━━━━━━━━━━━━━━━━━━┛`;

                util.log(string, "INFO", "modules/xptracker");
            }
        }
        tick();
    }
}


const util = require("../util.js");
const terrRegions = { ...require("../data/territoryRegions.json") };
const terrData = require("../data/territories.json");

for (const region in terrRegions) {
    for (let i = 0; i < terrRegions[region].length; i++) {
        if (terrRegions[region][i].startsWith("_r:")) {
            terrRegions[region].splice(i, 1, ...terrRegions[terrRegions[region][i].slice(3)]);
            i--;
        }
    }
}

module.exports = {
    name: "territoryticker",
    description: "tracks taken territories and certain territories on cd",
    syntax: '[-g <guild_name_1> [, <guild_name_2> [, ...]]] [-t {t:<territory_1> | r:<region_1>} [, {t:<territory_2> | r:<region_2>} [, ...]]]',
    examples: ['-g Wynn Content Team -t r:corkus, t:volcano lower', '-g Wynn Content Team, Wynncraft'],
    run: async function (args) {

        // base vars
        const staticGuildData = new Map();
        const lastMap = new Map();
        const guilds = [];
        const territories = [];

        // guild flag
        const guildArgIndex = args.indexOf("-g");
        if (guildArgIndex >= 0) {
            let nextFlag = args.slice(guildArgIndex + 1).findIndex(v => v.startsWith("-"));
            nextFlag += guildArgIndex + 1;
            if (nextFlag === guildArgIndex)
                nextFlag = args.length;

            const guildNames = args.slice(guildArgIndex + 1, nextFlag).join(" ").split(",");
            if (guildNames.length === 0) {
                util.log('You need to specify at least one guild name when using "-g"', "FATAL", "modules/territoryTicker");
                global.activeModule = null;
                return;
            }
            for (const guild of guildNames) {
                guilds.push(guild.trim());
            }
        }
        const terrArgIndex = args.indexOf("-t");
        if (terrArgIndex >= 0) {
            let nextFlag = args.slice(terrArgIndex + 1).findIndex(v => v.startsWith("-"));
            nextFlag += terrArgIndex + 1;
            if (nextFlag === terrArgIndex)
                nextFlag = args.length;

            const identifierNames = args.slice(terrArgIndex + 1, nextFlag).join(" ").split(",");
            if (identifierNames.length === 0) {
                util.log('You need to specify at least one territory or region name when using "-g"', "FATAL", "modules/territoryTicker");
                global.activeModule = null;
                return;
            }
            for (const identifier of identifierNames) {
                const terr = identifier.trim().toUpperCase();
                if (terrData[terr] && terr !== "_DEFAULT") {
                    territories.push(terr);
                } else if (terr.startsWith("R:") && terrRegions[terr.slice(2).split(" ").join("_")]) {
                    for (const t of terrRegions[terr.slice(2).split(" ").join("_")]) {
                        territories.push(t)
                    }
                }
            }
        }

        // fill base map
        const guildsToFetch = [];
        const initialMap = await util.requestWynnAPI(util.wynnAPIRoutes.territoryList).catch(e => util.log(`Error while fetching map state: ${e}`, "FATAL", "modules/territoryTicker"));
        if (!initialMap) {
            global.activeModule = null;
            return;
        }
        for (const t in initialMap.territories) {
            lastMap.set(t, {
                guild: initialMap.territories[t].guild,
                acquired: Date.parse(initialMap.territories[t].acquired.replace(/ /, "T").concat(".000Z"))
            });
            if (!guildsToFetch.includes(initialMap.territories[t].guild))
                guildsToFetch.push(initialMap.territories[t].guild);
        }
        const guildPromises = guildsToFetch.map(v => util.requestWynnAPI(util.wynnAPIRoutes.guild.replace("<guild>", v.split(" ").join("%20"))));
        const fetchedGuilds = await Promise.all(guildPromises).catch(e => {
            util.log(`Error while fetching guilds: ${e}`, "FATAL", "modules/territoryTicker");
            return [];
        });
        if (fetchedGuilds.length === 0) {
            global.activeModule = null;
            return;
        }
        for (const g of fetchedGuilds) {
            staticGuildData.set(g.name, {
                tag: g.prefix
            });
        }

        // run module
        // delayed self call
        let c = -1;
        function tick() {
            if (global.activeModule !== "territoryticker") {
                util.log("§8Module Stopped!", "INFO", "modules/territoryTicker");
                clearInterval(interval);
                return;
            }
            c = (c + 1) % 10;
            if (c === 0) {
                output();
            }
        }

        /**
         * execute tracker
         */
        async function output() {
            const now = Date.now();

            // request api
            const mapAPI = await util.requestWynnAPI(util.wynnAPIRoutes.territoryList).catch(e => util.log(`Error while fetching map state: ${e}`, "WARNING", "modules/territoryTicker"));
            if (!mapAPI)
                return;

            const changes = [];
            const guildsToRequest = [];
            const terrCounts = new Map();

            // parse data
            for (const terr in mapAPI.territories) {
                if (terrCounts.has(mapAPI.territories[terr].guild)) {
                    terrCounts.set(mapAPI.territories[terr].guild, terrCounts.get(mapAPI.territories[terr].guild) + 1);
                } else {
                    terrCounts.set(mapAPI.territories[terr].guild, 1);
                }
            }
            for (const terr in mapAPI.territories) {
                if (lastMap.get(terr).guild !== mapAPI.territories[terr].guild) {
                    const oldG = lastMap.get(terr).guild;
                    const newG = mapAPI.territories[terr].guild;
                    changes.unshift({
                        terr: terr,
                        old: oldG,
                        new: newG,
                        oldCount: terrCounts.get(oldG),
                        newCount: terrCounts.get(newG)
                    });

                    if (!staticGuildData.has(mapAPI.territories[terr].guild) && !guildsToRequest.includes(mapAPI.territories[terr].guild))
                        guildsToRequest.push(mapAPI.territories[terr].guild);

                    lastMap.set(terr, {
                        guild: mapAPI.territories[terr].guild,
                        acquired: Date.parse(mapAPI.territories[terr].acquired.replace(/ /, "T").concat(".000Z"))
                    });
                    terrCounts.set(oldG, terrCounts.get(oldG) + 1);
                    terrCounts.set(newG, terrCounts.get(newG) - 1);
                }
            }

            const cooldown = Object.values(mapAPI.territories)
            .filter(v => territories.length === 0 || territories.includes(v.territory))
            .filter(v => guilds.length === 0 || guilds.includes(v.guild))
            .map(v => {
                return {
                    terr: v.territory,
                    holdTime: Date.now() - Date.parse(v.acquired.replace(/ /, "T").concat(".000Z")),
                    guild: v.guild
                };
            })
            .filter(v => v.holdTime < 720000)
            .sort((a, b) => b.holdTime - a.holdTime)
            .map(v => {
                const color = v.holdTime > 600000 ? "§9" : v.holdTime > 540000 ? "§b" : v.holdTime > 420000 ? "§2" : "§6";
                return `\n┃ ${color}${v.terr.padEnd(35)}§2 ┃ ${color}${v.guild.padEnd(25)}§2 ┃ ${color}${(v.holdTime >= 600000 ? `Out of cooldown for ${util.formatDuration(v.holdTime - 600000, false, false)}` : `Out of cooldown in ${util.formatDuration(600000 - v.holdTime, false, false)}`).padEnd(49)}§2 ┃`;
            });

            // fetch extra data
            if (guildsToRequest.length > 0) {
                const promises = guildsToRequest.map(v => util.requestWynnAPI(util.wynnAPIRoutes.guild.replace("<guild>", v.split(" ").join("%20"))));
                const guildsData = await Promise.all(promises).catch(e => {
                    util.log(`Error while fetching guilds: ${e}`, "WARNING", "modules/territoryTicker");
                    return [];
                });

                if (guildsData.length === 0)
                    return;

                for (const g of guildsData) {
                    staticGuildData.set(g.name, {
                        tag: g.prefix
                    });
                }
            }

            const string = `§2
┏━━━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ Time                   ┃ ${util.formatDate(mapAPI.request.timestamp * 1000, "COMPACTSECOND").padEnd(90)} ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━┻━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃ Territory Taken                     ┃ Previous Owner                        ┃ New Owner                             ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╋━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╋━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫${changes.filter(v => territories.length === 0 || territories.includes(v.terr)).filter(v => guilds.length === 0 || guilds.includes(v.old) || guilds.includes(v.new)).map(v => `
┃ ${v.terr.padEnd(35)} ┃ ${`${v.old} [${staticGuildData.get(v.old).tag}] (${v.oldCount})`.padEnd(37)} ┃ ${`${v.new} [${staticGuildData.get(v.new).tag}] (${v.newCount})`.padEnd(37)} ┃`).join("")}
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╋━━━━━━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━┻━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃ Territory                           ┃ Guild                     ┃ Cooldown                                          ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╋━━━━━━━━━━━━━━━━━━━━━━━━━━━┻━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫${cooldown.join("")}
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┻━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛`;

            util.log(string, "INFO", "modules/territoryTicker");
        }
        const interval = setInterval(tick, 1000);
    }
}

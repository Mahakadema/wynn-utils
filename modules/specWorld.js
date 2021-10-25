
const util = require("../util.js");

module.exports = {
    name: "specworld",
    description: "Shows the amount of players online in a list of worlds",
    syntax: "<world1> [...worlds]",
    examples: ["10 14 20", "WC10 WC14 WC20"],
    run: async function (args) {

        // base vars
        const worldNames = [];
        let exclusiveDisplay = true;
        const worlds = [];
        let lastTimestamp = 0;

        // input verification
        if (args.length === 0) {
            util.log('You need to specify at least one world name', "FATAL", "modules/xptracker");
            global.activeModule = null;
            return;
        }

        if (args[0] === "all") {
            exclusiveDisplay = false;
        } else {
            for (const name of args) {
                if (/^(YT|([A-Z]{2})?[0-9]+)$/.test(name)) { // name is either a number, "YT", or a number preceeded by a two letter network identifier
                    let id = name;
                    if (/^[0-9]+$/.test(name)) { // name is just a number
                        id = `WC${name}`;
                    }
                    worldNames.push(id);
                } else {
                    util.log(`"${name}" is not a valid server`, "FATAL", "modules/xptracker");
                    global.activeModule = null;
                    return;
                }
            }
        }

        // run module
        async function tick() {
            // delayed self call
            if (global.activeModule !== "specworld") {
                util.log("§8Module Stopped!", "INFO", "modules/xptracker");
                return;
            }
            setTimeout(tick, 5000);

            const now = Date.now();

            // request api
            const data = await util.requestWynnAPI(util.wynnAPIRoutes.onlinePlayers).catch(e => {
                util.log(`Error while fetching guilds: ${e}`, "WARNING", "modules/xptracker");
                return;
            });

            if (data.request.timestamp * 1000 <= lastTimestamp) {
                return;
            }

            const apiWorlds = Object.entries(data).filter(([k, v]) => (!exclusiveDisplay && /^(YT|[A-Z]{2}[0-9]+)$/.test(k)) || worldNames.includes(k)).map(([k, v]) => {
                let oldWorld = worlds.find(v1 => v1.id === k);
                if (!oldWorld) {
                    oldWorld = {
                        id: k,
                        players: v
                    };
                    worlds.push(oldWorld);
                }
                const oldPlayers = oldWorld.players.slice();
                oldWorld.players = v;
                return {
                    id: k,
                    players: v.length,
                    joins: v.filter(v1 => !oldPlayers.includes(v1)),
                    leaves: oldPlayers.filter(v1 => !v.includes(v1))
                };
            });

            const string = `§2
┏━━━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ Worlds Tracked         ┃ ${worldNames.length.toString().padEnd(80)} ┃
┃ Time Since Last Update ┃ ${util.formatDuration(data.request.timestamp * 1000 - lastTimestamp).padEnd(80)} ┃
┣━━━━━━━┳━━━━━━━━━┳━━━━━━┻━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃ World ┃ Players ┃ Players joining and leaving                                                             ┃
┣━━━━━━━╋━━━━━━━━━╋━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫${apiWorlds.reduce((p, c) => {
                return p + `
┃ ${c.id.padEnd(5)} ┃ ${c.players >= 45 ? "§9" : c.players >= 40 ? "§B" : c.players >= 37 ? "§A" : "§E"}${c.players.toString().padEnd(7)}§2 ┃ ${(c.joins.length > 0 ? `§A+ ${c.joins.join(", ")} ` : "§r").concat(c.leaves.length > 0 ? `§9- ${c.leaves.join(", ")} ` : "§r").padEnd(91)}§2┃`;
            }, "")}
┗━━━━━━━┻━━━━━━━━━┻━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛`;

            util.log(string, "INFO", "modules/xptracker");

            lastTimestamp = data.request.timestamp * 1000;
        }
        tick();
    }
}

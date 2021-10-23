
const https = require("https");
const fs = require("fs");
const package = require("./package.json");
const readline = require("readline/promises").createInterface({
    input: process.stdin,
    output: process.stdout
});

/**
 * resolves after the specified amount of milliseconds, paired with await or .then(), this can allow for delay in execution
 * @param {Number} ms 
 */
const sleep = ms => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Returns whether a given player name is valid
 * @param {String} name The name to check
 */
const isValidPlayerName = (name) => {
    return /^[0-9a-zA-Z_]*$/.test(name);
};

/**
 * Returns whether a given UUID is valid
 * @param {String} uuid The UUID to check
 */
const isValidUUID = (uuid) => {
    return /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/.test(uuid);
}

/**
 * Returns whether a given guild name is valid
 * @param {String} name The name to check
 */
// ununsed rn
const isValidGuildName = (name) => {
    return /^[a-zA-Z ]*$/.test(name);
};

/**
 * @param {Number} x 
 * @returns x spaced out with commas and the rational part truncated to 7 digits
 */
const formatNumber = (x, precision = 7) => {
    if (Number.isNaN(x)) { return "NAN"; }
    if (!Number.isFinite(x)) { return "Infinity"; }
    const parts = [];
    const sign = x >= 0 ? "" : "-";
    x = Math.abs(x)
    let fraction = (x - Math.floor(x)).toFixed(precision).slice(1);
    while (fraction.endsWith("0")) {
        fraction = fraction.slice(0, fraction.length - 1);
    }
    x = Math.floor(x);
    if (x === 0) {
        parts.unshift("0");
    }
    while (x > 0) {
        parts.unshift(`${x % 1000}`);
        while (parts[0].length < 3 && x > 99) {
            parts[0] = `0${parts[0]}`;
        }
        x = Math.floor(x / 1000);
    }
    return `${sign}${parts.join(",")}${fraction === "." ? "" : fraction}`;
};

/**
 * Returns a String Containing the Years, Days, Hours, Minutes and Seconds in human-readable format
 * @param {Number} ms 
 */
const formatDuration = (ms, truncatePrecision = false, useShortNames = false) => {
    if (ms < 1000) {
        return ms >= 0 ? "0 Seconds" : "Invalid Duration";
    }
    const periods = [
        {
            typeSingular: "Year",
            typePlural: "Years",
            typeShort: "Y",
            multiplier: 31536000000
        },
        {
            typeSingular: "Day",
            typePlural: "Days",
            typeShort: "D",
            multiplier: 86400000
        },
        {
            typeSingular: "Hour",
            typePlural: "Hours",
            typeShort: "H",
            multiplier: 3600000
        },
        {
            typeSingular: "Minute",
            typePlural: "Minutes",
            typeShort: "M",
            multiplier: 60000
        },
        {
            typeSingular: "Second",
            typePlural: "Seconds",
            typeShort: "S",
            multiplier: 1000
        }
    ];
    const strings = [];
    {
        const per0 = Math.floor(ms / periods[0].multiplier);
        if (per0 > 0) {
            strings.push(`${per0} ${useShortNames ? periods[0].typeShort : per0 === 1 ? periods[0].typeSingular : periods[0].typePlural}`);
        }
    }
    for (let i = 1; i < periods.length && (!truncatePrecision || strings.length < 2); i++) {
        const val = Math.floor((ms % periods[i - 1].multiplier) / periods[i].multiplier);
        if (val > 0) {
            strings.push(`${val} ${useShortNames ? periods[i].typeShort : val === 1 ? periods[i].typeSingular : periods[i].typePlural}`);
        }
    }
    let str = strings[strings.length - 1];
    if (strings.length > 1) {
        str = `${strings[strings.length - 2]}${useShortNames ? "," : " And"} ${str}`
    }
    for (let i = strings.length - 3; i >= 0; i--) {
        str = strings[i] + ", " + str;
    }
    return str;
};

/**
 * Returns the UTC Date in format YYYY/MM/DD HH:MM:SS
 * @param {Number} unix The unix timestamp of the date
 * @param {String} style The format mode to use, can be "COMPACT", "COMPACTSECOND", "DATE", "TIMEOFDAY", "TIMEOFDAYSECOND", "TIMESTAMPDAY" or "FULL"
 */
const formatDate = (unix, style = "COMPACT") => {
    const d = new Date(unix);
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth(); //starts from 0
    const day = d.getUTCDate();
    const hour = d.getUTCHours();
    const minute = d.getUTCMinutes();
    const second = d.getUTCSeconds();
    const millisecond = d.getUTCMilliseconds();
    switch (style) {
        case "COMPACT":         // 2021/08/24 18:45
            return `${year}/${(month + 1).toString().padStart(2, "0")}/${day.toString().padStart(2, "0")} ${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
        case "COMPACTSECOND":   // 2021/08/24 18:45:59
            return `${year}/${(month + 1).toString().padStart(2, "0")}/${day.toString().padStart(2, "0")} ${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}:${second.toString().padStart(2, "0")}`;
        case "DATE":            // 2021/08/24
            return `${year}/${(month + 1).toString().padStart(2, "0")}/${day.toString().padStart(2, "0")}`;
        case "TIMEOFDAY":       // 18:45
            return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
        case "TIMEOFDAYSECOND": // 18:45:59
            return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}:${second.toString().padStart(2, "0")}`;
        case "TIMESTAMPDAY":    // 18:45:59.759
            return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}:${second.toString().padStart(2, "0")}.${millisecond.toString().padStart(3, "0")}`;
        case "FULL":            // 24th August 2021 18:45:59
            return `${day}${getNumberSuffix(day)} ${numToMonth(month)} ${year} ${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}:${second.toString().padStart(2, "0")}`;
        default:
            return "Invalid Formatting Mode";
    }
};

let lastMessageOverride = false;
/**
 * Logs a message into console
 * @param {String} message The message to be displayed
 * @param {String} type The log class of the entry, can be "INFO", "WARNING", "ERROR" or "FATAL"
 * @param {String} source The source of the entry, usually the file name, method or path description
 * @param {String | Number} color The color to display the entry in, only has an effect on class "INFO" entries, can be "BLACK", "DARK_BLUE", "DARK_GREEN", "DARK_CYAN", "DARK_RED", "DARK_PURPLE", "DARK_YELLOW", "LIGHT_GRAY", "DARK_GRAY", "LIGHT_BLUE", "LIGHT_GREEN", "LIGHT_CYAN", "LIGHT_RED", "LIGHT_PURPLE", "LIGHT_YELLOW" or "WHITE"
 * @param {boolean} override Whether this message should get overriden by the next message
 */
const log = (message, type = "UNKNOWN", source = "UNKNOWN", override = false) => {

    // delete last entry if flag set
    if (lastMessageOverride) {
        process.stdout.moveCursor(0, -1); // up one line
        process.stdout.clearLine(1); // from cursor to end
    }
    lastMessageOverride = override;

    let msgStart = "";
    let defaultTextColor;
    switch (type) {
        case "INFO":
            msgStart = `[${formatDate(Date.now(), "TIMESTAMPDAY")}]  [${source}/INFO]\x1b[37m`;
            defaultTextColor = "\x1b[37m";
            break;
        case "WARNING":
            msgStart = `\x1b[47m\x1b[30m[${formatDate(Date.now(), "TIMESTAMPDAY")}]  [${source}/WARN]\x1b[43m`;
            defaultTextColor = "\x1b[30m";
            break;
        case "ERROR":
            msgStart = `\x1b[47m\x1b[30m[${formatDate(Date.now(), "TIMESTAMPDAY")}] [${source}/ERROR]\x1b[41m\x1b[37m`;
            defaultTextColor = "\x1b[37m";
            break;
        case "FATAL":
            msgStart = `\x1b[47m\x1b[30m[${formatDate(Date.now(), "TIMESTAMPDAY")}] [${source}/FATAL]\x1b[101m`;
            defaultTextColor = "\x1b[30m";
            break;
        default:
            msgStart = `[${formatDate(Date.now(), "TIMESTAMPDAY")}] [${source}/${type}]`;
            defaultTextColor = "\x1b[37m";
            log(`Unknown log type: ${type}`, "WARNING", "util/log");
            break;
    }

    // parse color codes
    if (typeof message === "string") {
        const colors = {
            "0": "\x1b[30m", // black
            "1": "\x1b[31m", // dark_red
            "2": "\x1b[32m", // dark_green
            "3": "\x1b[33m", // dark_yellow
            "4": "\x1b[34m", // dark_blue
            "5": "\x1b[35m", // dark_aqua
            "6": "\x1b[36m", // dark_purple
            "7": "\x1b[37m", // light_gray
            "8": "\x1b[90m", // dark_gray
            "9": "\x1b[91m", // light_red
            "a": "\x1b[92m", // light_green
            "b": "\x1b[93m", // light_yellow
            "c": "\x1b[94m", // light_blue
            "d": "\x1b[95m", // light_aqua
            "e": "\x1b[96m", // light_purple
            "f": "\x1b[97m", // white

            "r": defaultTextColor // default and reset key
        };
        const msgParts = message.split("§");
        message = msgParts.reduce((p, c) => p + (colors[c.slice(0, 1).toLowerCase()] || colors.r) + c.slice(1));
    }

    console.log(msgStart, message, `\x1b[0m`);
};

const wynnAPIRatelimit = {
    limit: 180,
    remaining: 180,
    reset: Date.now() + 60000,
    queued: []
};
const requestQueue = [];
const priorityRequestQueue = [];
let queueIDCounter = 0;
/**
 * Requests the Wynncraft API with a given route
 * @param {String} route The URL of the resource
 * @param {Number} retries The amount of times the function will repeat to request the API should it fail, defaults to 2
 * @param {Boolean} priorityQueue Whether or not to push this request to the front of the queue
 * @param {Boolean} logInConsole Whether or not to log the requested route in the console
 */
const requestWynnAPI = (route, retries = 2, priorityQueue = false, logInConsole = false) => {
    const now = Date.now();
    if (logInConsole) {
        log(`§8Requesting ${route}, Ratelimit: ${wynnAPIRatelimit.remaining}/${wynnAPIRatelimit.limit} (${formatDuration(wynnAPIRatelimit.reset - now, false, true)})`, "INFO", "util");
    }
    return new Promise(async (resolve, reject) => {
        // spam protection
        if (now > wynnAPIRatelimit.reset) {
            wynnAPIRatelimit.remaining = wynnAPIRatelimit.limit;
        }

        const queueID = queueIDCounter;
        queueIDCounter++;
        if (wynnAPIRatelimit.remaining <= 0) {
            if (priorityRequestQueue.length + requestQueue.length >= 255) {
                reject("Request queue limit reached");
                return;
            }
            let queue;
            if (priorityQueue) {
                queue = priorityRequestQueue;
            } else {
                queue = requestQueue;
            }
            queue.push(queueID);
            if (logInConsole) {
                log(`§8Queued ${queueID}, ${queue.length} ahead in queue (${priorityQueue ? "priority" : "generic"})`, "INFO", "util");
            }
            while ((queue !== priorityRequestQueue && priorityRequestQueue.length > 0) || queue[0] !== queueID || wynnAPIRatelimit.remaining <= 0) {
                await sleep(100 + Math.floor(Math.random() * 2));
                if (wynnAPIRatelimit.reset < Date.now()) {
                    wynnAPIRatelimit.remaining = wynnAPIRatelimit.limit;
                    wynnAPIRatelimit.reset = Date.now() + 60000;
                }
            }
            if (logInConsole) {
                log(`§8Unqueued ${queueID}`, "INFO", "util");
            }
            queue.shift();
        }

        wynnAPIRatelimit.queued.push(queueID);
        wynnAPIRatelimit.remaining--;

        // get data
        const data = await requestJSONAPI(route, retries, true, false).catch(e => {
            reject(e);
            return "_NULL";
        });
        if (wynnAPIRatelimit.queued.includes(queueID)) {
            wynnAPIRatelimit.queued.splice(0, wynnAPIRatelimit.queued.findIndex(id => id === queueID) + 1);
        }
        if (data === "_NULL") return;

        wynnAPIRatelimit.remaining = Math.max(0, data.headers["ratelimit-remaining"] - wynnAPIRatelimit.queued.length);
        wynnAPIRatelimit.reset = Date.now() + data.headers["ratelimit-reset"] * 1000;

        // API requests hit Ratelimit
        if (data.body.message === "API rate limit exceeded") {
            wynnAPIRatelimit.remaining = 0;
            reject(data.body.message);
            return;
        }

        // tried to access a non-existent route
        if (data.body.status === 404) {
            reject("404 NOT FOUND");
            return;
        }

        // failed legacy request
        if (data.body.error) {
            reject(data.body.error);
            return;
        }

        // failed v2 request
        if (data.body.code && data.body.code !== 200) {
            reject(data.body.message || `Unknown Error: ${data.body.code}`);
            return;
        }

        resolve(data.body);
    });
};

/**
 * Returns the JSON data returned by the API at route
 * @param {String} route The URL of the resource
 * @param {Number} retries The amount of times the function will repeat to request the API, should it fail, defaults to 2
 * @param {Boolean} includeHeaders Whether the returned value should be the raw JSON or an object containing the header and response, if the request fails this parameter has no effect
 * @param {Boolean} logInConsole Whether or not to log the requested route in the console
 */
const requestJSONAPI = (route, retries = 2, includeHeaders = false, logInConsole = false) => {
    if (logInConsole) {
        log(`§8Requesting ${route}`, "INFO", "util");
    }
    return new Promise((resolve, reject) => {
        https.get(route, resp => {
            // build data from chunks
            let rawData = "";
            resp.on("data", chunk => {
                rawData += chunk;
            });
            // The whole response has been received. Parse result.
            resp.on("end", async () => {
                let data = undefined;
                try {
                    data = JSON.parse(rawData);
                } catch (e) {
                    log(`Exception caught in requestJSONAPI: ${e}\nReceived Message: ${rawData}`, "ERROR", "util");
                    if (retries >= 1) {
                        const result = await requestJSONAPI(route, retries - 1, true, false).catch(e => {
                            reject(e);
                            return "_NULL";
                        });
                        if (result !== "_NULL") resolve(includeHeaders ? { headers: result.headers, body: result.body } : result.body);
                        return;
                    } else {
                        reject(rawData);
                        return;
                    }
                }
                resolve(includeHeaders ? { headers: resp.headers, body: data } : data);
            });
        }).on("error", async (err) => {
            if (retries > 0) {
                const result = await requestJSONAPI(route, retries - 1, true, false).catch(e => {
                    reject(e);
                    return "_NULL";
                });
                if (result !== "_NULL") resolve(includeHeaders ? { headers: result.headers, body: result.body } : result.body);
                return;
            } else {
                reject(err);
                return;
            }
        });
    });
};

/**
 * returns an integer number based on the rank given. Recruit returns 0, Owner returns 5
 */
const rankToNum = rank => {
    switch (rank) {
        case "RECRUIT":
            return 0;
        case "RECRUITER":
            return 1;
        case "CAPTAIN":
            return 2;
        case "STRATEGIST":
            return 3;
        case "CHIEF":
            return 4;
        case "OWNER":
            return 5;
        default:
            log(`Failed to determine numeric value of guild rank ${rank}`, "WARNING", "util");
            return -1;
    }
}

/**
 * Returns the equivalent color of the color code
 * @param {Number} colorCode The code of the color 0-15
 */
const fourBitColor = (colorCode) => {
    const colors = [
        "§0",
        "§1",
        "§2",
        "§3",
        "§4",
        "§5",
        "§6",
        "§7",
        "§8",
        "§9",
        "§A",
        "§B",
        "§C",
        "§D",
        "§E",
        "§F"
    ];
    if (colorCode >= 0 && colorCode < 16) {
        return colors[colorCode];
    }
    return "§7";
};

/**
 * Returns the amount of xp corresponding to the percentage returned by the API
 * @param {Number} level the current guild level
 * @param {Number} percent the percent returned by the guild API [0-100]
 */
const xpPercentToRaw = (level, percent) => {
    if (level < 1 || level >= levelXP.length) {
        return 0;
    }
    return Math.round(levelXP[level].oldRequirement * percent / 100);
}

const wynnAPIRoutes = {
    player: "https://api.wynncraft.com/v2/player/<player>/stats",
    guild: "https://api.wynncraft.com/public_api.php?action=guildStats&command=<guild>",
    guildList: "https://api.wynncraft.com/public_api.php?action=guildList",
    guildLeaderBoard: "https://api.wynncraft.com/public_api.php?action=statsLeaderboard&type=guild&timeframe=alltime",
    territoryList: "https://api.wynncraft.com/public_api.php?action=territoryList",
    onlinePlayers: "https://api.wynncraft.com/public_api.php?action=onlinePlayers"
};

module.exports = {
    fs: fs,
    https: https,
    package: package,
    readline: readline,
    wynnAPIRoutes: wynnAPIRoutes,
    sleep: sleep,
    isValidPlayerName: isValidPlayerName,
    isValidUUID: isValidUUID,
    isValidGuildName: isValidGuildName,
    formatNumber: formatNumber,
    formatDuration: formatDuration,
    formatDate: formatDate,
    log: log,
    requestWynnAPI: requestWynnAPI,
    requestJSONAPI: requestJSONAPI,
    rankToNum: rankToNum,
    fourBitColor: fourBitColor,
    xpPercentToRaw: xpPercentToRaw
}
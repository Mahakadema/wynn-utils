
const arguments = process.argv.slice(2);
const startup = new Date();
{
    const header = `[${startup.getUTCHours().toString().padStart(2, "0")}:${startup.getUTCMinutes().toString().padStart(2, "0")}:${startup.getUTCSeconds().toString().padStart(2, "0")}.${startup.getUTCMilliseconds().toString().padStart(3, "0")}] [CORE/INFO]`
    console.log(`${header} \x1b[36mStarting wynn-utils at ${Date.now()}\x1b[0m`);
    console.log(`${header} \x1b[36mStartup args: [${arguments.join(", ")}]\x1b[0m`);
}


// utils
const util = require("./util.js");

// controller
global.activeModule = null;
global.interrupt = false;

// module loader
util.log("§F------<Loading Modules>------", "INFO", "LOADER");
const modules = new Map();
const moduleFiles = util.fs.readdirSync("./modules/").filter(v => v.endsWith(".js"));
for (const moduleName of moduleFiles) {
    const module = require(`./modules/${moduleName}`);
    modules.set(module.name, module);
    util.log(`> Module ${module.name} loaded`, "INFO", "LOADER");
}

util.log(`§FWelcome to ${util.package.name} v${util.package.version}`, "INFO", "MAIN");
util.log(`§FType "module_name [arguments]" to activate a module. Currently available modules:`, "INFO", "MAIN");
for (const module of modules.values()) {
    util.log(`§F\n * ${module.name}\n   - Description: ${module.description}\n   - Syntax: ${module.name} ${module.syntax}\n   - Examples:${module.examples.reduce((p, c) => p + `\n     - ${module.name} ${c}`, "")}, `, "INFO", "MAIN");
}

// IO
util.readline.on("line", (line) => {
    // interrupt module on stop command
    if (line === "stop") {
        if (global.activeModule) {
            util.log(`§AStopping module ${global.activeModule}`, "INFO", "MAIN");
            global.activeModule = null;
        } else {
            util.log(`§1There is no active module to stop`, "INFO", "MAIN");
        }
        return;
    }

    // activate new module
    if (global.activeModule) {
        util.log(`$1Module ${global.activeModule} is already running, type "stop" in order to start another module`, "INFO", "MAIN");
    } else {
        const args = line.split(/ +/);
        const moduleName = args.shift().toLowerCase();
        const module = modules.get(moduleName);
        if (module) {
            // start
            global.activeModule = module.name;
            util.log(`§AStarting module ${module.name}! Stop it by typing "stop"`, "INFO", "MAIN");
            module.run(args);
        } else {
            // module not found, exit
            util.log(`§1"${moduleName}" is not a valid module`, "INFO", "MAIN");
        }
    }
});

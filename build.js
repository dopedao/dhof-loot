// Imports
const fs = require("fs");
const path = require('path');
const jsonToEsModule = require('json-to-es-module');

(async () => {
    const files = fs.readdirSync("./output")

    for (let file of files) {
        fs.writeFileSync("./lib/" + path.parse(file).name + ".js", jsonToEsModule(fs.readFileSync("./output/" + file).toString()))
    }
})();
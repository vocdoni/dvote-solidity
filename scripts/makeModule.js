const fs = require("fs")
const serialize = require("serialize-to-js").serializeToModule
const contractsDirectory = __dirname + "/../build/contracts/"
const contractsToExport = ["VotingEntity", "VotingProcess"]
const propertiesToExport = ["abi", "bytecode"] //https://github.com/trufflesuite/truffle-contract-schema

const libDirectory = __dirname + "/../lib"

const deleteLibDirectory = function () {
    if (fs.existsSync(libDirectory)) {
        fs.readdirSync(libDirectory).forEach(function (file, index) {
            var curPath = libDirectory + "/" + file;
            fs.unlinkSync(curPath);
        });
        fs.rmdirSync(libDirectory);
    }
};

const makeLibDirectory = function () {
    if (!fs.existsSync(libDirectory)) {
        fs.mkdirSync(libDirectory)
    }
}

const jsonToJs = function (contract) {

    let path = contractsDirectory + contract + ".json"
    let truffleJson = fs.readFileSync(path).toString()
    let truffleObj = JSON.parse(truffleJson)

    let exportObj = {}
    for (let property of propertiesToExport) {
        exportObj[property] = truffleObj[property]
    }

    //let exportJson = JSON.stringify(exportObj)
    let serialized = serialize(exportObj)
    return serialized
}

let write = (fileName, str) => {
    // console.log(str)
    let path = libDirectory + "/" + fileName + ".js"
    fs.writeFile(path, str, function (err) {
        if (err)
            return console.log(err);
        else
            console.log(' - Created  ' + path);
    });
}

const run = function () {
    deleteLibDirectory()
    makeLibDirectory()

    for (let contractName of contractsToExport) {
        let serialized = jsonToJs(contractName)
        write(contractName, serialized)
    }
}

run()
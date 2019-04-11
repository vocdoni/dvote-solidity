#!/bin/bash
SOLC=./node_modules/.bin/solcjs

echo "Cleaning the build folder"
rm -Rf ./build/*.json ./build/*.js

echo "Compiling contracts"
$SOLC --optimize --bin --abi -o build \
    contracts/VotingProcess.sol contracts/EntityResolver.sol contracts/EntityResolverBase.sol contracts/profiles/AddrResolver.sol contracts/profiles/TextListResolver.sol contracts/profiles/TextResolver.sol

echo "Arranging output files"
echo "{\"abi\": $(cat build/*EntityResolver.abi), \"bytecode\": \"0x$(cat build/*EntityResolver.bin)\"}" > build/entity-resolver.json
echo "{\"abi\": $(cat build/*VotingProcess.abi), \"bytecode\": \"0x$(cat build/*VotingProcess.bin)\"}" > build/voting-process.json

echo "module.exports = {
    EntityResolver: require(\"./entity-resolver.json\"),
    VotingProcess: require(\"./voting-process.json\")
}" > build/index.js

echo "Cleaning intermediate artifacts"
rm -f build/*.abi build/*.bin

echo "Done"

PATH  := node_modules/.bin:$(PATH)
SHELL := /bin/bash

.DEFAULT_GOAL := help
SOLC=./node_modules/.bin/solcjs
TSC=./node_modules/.bin/tsc
CONTRACT_SOURCES=$(wildcard contracts/*.sol contracts/*/*.sol)
OUTPUT_FILES=build/index.js build/entity-resolver.json build/voting-process.json

###############################################################################
## HELP
###############################################################################

.PHONY: help
help:
	@echo "Available targets:"
	@echo
	@echo "  $$ make         Runs 'make help' by default"
	@echo "  $$ make help    Shows this text"
	@echo
	@echo "  $$ make all     Compile the smart contracts and types into 'build'"
	@echo "  $$ make test    Compile and test the contracts"
	@echo "  $$ make clean   Cleanup the build folder"
	@echo

###############################################################################
## RECIPES
###############################################################################

all: node_modules js-output contract-output

node_modules: package.json package-lock.json
	npm install || true
	if [ -d node_modules/web3-providers/node_modules/websocket ]; then \
	  rm -Rf node_modules/web3-providers/node_modules/websocket/.git ; \
	  rm -Rf node_modules/web3-providers-ws/node_modules/websocket/.git ; \
	fi
	@touch $@

js-output: build/index.js
contract-output: build/entity-resolver.json build/voting-process.json

build:
	@mkdir -p build
	@touch $@

build/index.js: build build/entity-resolver.json build/voting-process.json lib/index.ts
	cp lib/index.ts build
	$(TSC) --build tsconfig.json

build/entity-resolver.json: build/solc
	@echo "{\"abi\": $$(cat build/solc/*EntityResolver.abi), \"bytecode\": \"0x$$(cat build/solc/*EntityResolver.bin)\"}" > $@

build/voting-process.json:
	@echo "{\"abi\": $$(cat build/solc/*VotingProcess.abi), \"bytecode\": \"0x$$(cat build/solc/*VotingProcess.bin)\"}" > $@

# Intermediate solidity compiled artifacts
build/solc: $(CONTRACT_SOURCES)
	mkdir -p $@
	$(SOLC) --optimize --bin --abi -o $@ $(CONTRACT_SOURCES)
	@touch $@

test: clean all
	npm run test

clean: 
	rm -Rf ./build

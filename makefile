CONTRACT_SOURCES = $(sort $(notdir $(wildcard contracts/**/*)))
PATH  := node_modules/.bin:$(PATH)
SHELL := /bin/bash

.DEFAULT_GOAL := info
.PHONY: info $(CONTRACT_SOURCES)

###############################################################################
## INFO
###############################################################################

info:
	@echo "Available actions:"
	@echo
	@echo "  $$ make         Runs 'run info' by default"
	@echo "  $$ make info    Shows this text"
	@echo
	@echo "  $$ make build   Compile the smart contracts into 'build'"
	@echo

###############################################################################
## RECIPES
###############################################################################

all: contracts

node_modules: package.json
	npm install

test: contracts
	npm run test

contracts: node_modules $(CONTRACT_SOURCES)
	npm run build

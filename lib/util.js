const HDWalletProvider = require("truffle-hdwallet-provider")
const Web3 = require("web3")
const dotenv = require("dotenv")
const fs = require("fs")

const { abi: entityResolverAbi, bytecode: entityResolverByteCode } = require("../build/entity-resolver.json")
const { abi: votingProcessAbi, bytecode: votingProcessByteCode } = require("../build/voting-process.json")

const config = getConfig()
const provider = new HDWalletProvider(config.MNEMONIC, config.GATEWAY_URL, 0, 10)
const web3 = new Web3(provider)

///////////////////////////////////////////////////////////////////////////////
// ENV HELPERS
///////////////////////////////////////////////////////////////////////////////

/**
 * Read process.env and .env into a unified config
 */
function getConfig() {
	const envDefault = dotenv.parse(fs.readFileSync("./.env"))

	return Object.assign({}, envDefault, process.env)
}

function getWeb3() {
	return web3
}

function getProvider() {
	return provider
}

///////////////////////////////////////////////////////////////////////////////
// DEPLOYMENT
///////////////////////////////////////////////////////////////////////////////

function deployEntityResolver() {
	return web3.eth.getAccounts().then(accounts => {
		return new web3.eth.Contract(entityResolverAbi)
			.deploy({ data: entityResolverByteCode })
			.send({ from: accounts[0], gas: "1200000" })
	})
}

function deployVotingProcess() {
	return web3.eth.getAccounts().then(accounts => {
		return new web3.eth.Contract(votingProcessAbi)
			.deploy({ data: votingProcessByteCode })
			.send({ from: accounts[0], gas: "2600000" })
	})
}

///////////////////////////////////////////////////////////////////////////////
// TESTING UTILS (timestamp)
///////////////////////////////////////////////////////////////////////////////

/**
 * Increase the timestamp of the blockchain by <N> seconds
 * @param {number} seconds 
 * @returns Promise
 * 
 * Make sure to invoke ganache with -t "YYYY MM DD" parameter
 */
function increaseTimestamp(seconds = 10) {
	return new Promise((resolve, reject) => {
		const transaction = {
			jsonrpc: "2.0",
			method: "evm_increaseTime",
			params: [seconds],
			id: Date.now(),
		}
		web3.currentProvider.send(
			transaction,
			error => error ? reject(error) : resolve()
		)
	}).then(() => mineBlock())
}

/**
 * Force to mine a block
 */
function mineBlock() {
	return new Promise((resolve, reject) => {
		const transaction = {
			jsonrpc: "2.0",
			method: "evm_mine",
			params: [],
			id: Date.now(),
		}
		web3.currentProvider.send(
			transaction,
			error => error ? reject(error) : resolve()
		)
	})
}

module.exports = {
	getConfig,
	getWeb3,
	getProvider,

	deployEntityResolver,
	deployVotingProcess,

	increaseTimestamp
}

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
	var account, nonce
	return web3.eth.getAccounts().then(accounts => {
		account = accounts[0]
		return web3.eth.getTransactionCount(accounts[0])
	}).then(n => {
		nonce = n
		return new web3.eth.Contract(entityResolverAbi)
			.deploy({ data: entityResolverByteCode })
			.send({
				from: account,
				gas: "1350000",
				nonce
			})
	})
}

function deployVotingProcess(deployAddress, chainId, validEnvelopeTypes, validModes) {
	return web3.eth.getTransactionCount(deployAddress).then(nonce => {
		return new web3.eth.Contract(votingProcessAbi)
			.deploy({ data: votingProcessByteCode, arguments: [chainId, validEnvelopeTypes, validModes] })
			.send({
				from: deployAddress,
				gas: "3000000",
				nonce
			})
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

///////////////////////////////////////////////////////////////////////////////
// TESTING UTILS (contract interaction abstractions)
///////////////////////////////////////////////////////////////////////////////

async function setProcessStatus(instance, address, processId, status) {
	return instance.methods.setProcessStatus(
		processId,
		status
	).send({
		from: address,
		nonce: await web3.eth.getTransactionCount(address)
	})
}

async function addOracle(instance, deployer, oracle) {
    return instance.methods.addOracle(
        oracle
    ).send({
        from: deployer,
        nonce: await web3.eth.getTransactionCount(deployer)
    })
}

async function addValidator(instance, deployer, validator) {
    return instance.methods.addValidator(
        validator
    ).send({
        from: deployer,
        nonce: await web3.eth.getTransactionCount(deployer)
    })
}

async function removeOracle(instance, deployer, index, oracle) {
	return instance.methods.removeOracle(
		index,
		oracle
	).send({
		from: deployer,
		nonce: await web3.eth.getTransactionCount(deployer)
	})
}

async function removeValidator(instance, deployer, index, validator) {
    return instance.methods.removeValidator(
		index,
		validator
    ).send({
        from: deployer,
        nonce: await web3.eth.getTransactionCount(deployer)
    })
}

async function publishResults(instance, address, processId, results) {
	return instance.methods.publishResults(
		processId,
		results
	).send({
		from: address,
		nonce: await web3.eth.getTransactionCount(address)
	})
}

async function addEnvelopeType(instance, address, envelopeType) {
	return instance.methods.addEnvelopeType(
		envelopeType
	).send({
		from: address,
		nonce: await web3.eth.getTransactionCount(address)
	})
}

async function removeEnvelopeType(instance, address, envelopeType) {
	return instance.methods.removeEnvelopeType(
		envelopeType
	).send({
		from: address,
		nonce: await web3.eth.getTransactionCount(address)
	})
}

async function addMode(instance, address, mode) {
	return instance.methods.addMode(
		mode
	).send({
		from: address,
		nonce: await web3.eth.getTransactionCount(address)
	})
}

async function removeMode(instance, address, mode) {
	return instance.methods.removeMode(
		mode
	).send({
		from: address,
		nonce: await web3.eth.getTransactionCount(address)
	})
}

module.exports = {
	getConfig,
	getWeb3,
	getProvider,

	deployEntityResolver,
	deployVotingProcess,

	increaseTimestamp,

	setProcessStatus,
	addOracle,
	addValidator,
	removeOracle,
	removeValidator,
	publishResults,
	addEnvelopeType,
	removeEnvelopeType,
	addMode,
	removeMode
}
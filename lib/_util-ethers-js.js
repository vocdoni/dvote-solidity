// ALTERNATIVE APPROACH WITH ETHERS.JS

// const HDWalletProvider = require("truffle-hdwallet-provider")
const ethers = require("ethers")
const { getConfig } = require("./util")

const config = getConfig()

const { abi: entityResolverAbi, bytecode: entityResolverByteCode } = require("../build/entity-resolver.json")
const { abi: votingProcessAbi, bytecode: votingProcessByteCode } = require("../build/voting-process.json")

(async function () {

	const provider = new ethers.providers.JsonRpcProvider(config.GATEWAY_URL)
	// const provider = new HDWalletProvider(config.MNEMONIC, config.GATEWAY_URL, 0, 10)
	// var provider = ethers.providers.getDefaultProvider('rinkeby');

	// const address = provider.getAddress()

	// var address  = '0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1';
	// var abi = [{"constant":true,"inputs":[],"name":"name","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getValue","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_name","type":"string"}],"name":"setValue","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"nonpayable","type":"function"}];
	// var privateKey = '0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d';
	const privateKey = ethers.Wallet.fromMnemonic(config.MNEMONIC).privateKey
	const address = await ethers.Wallet.fromMnemonic(config.MNEMONIC).getAddress()

	// const wallet = new ethers.Wallet(privateKey, new ethers.providers.Web3Provider(provider))
	const wallet = new ethers.Wallet(privateKey, provider);

	// deploy
	const resolverFactory = new ethers.ContractFactory(entityResolverAbi, entityResolverByteCode, wallet)
	const processFactory = new ethers.ContractFactory(votingProcessAbi, votingProcessByteCode, wallet)

	const resolverInstance = await resolverFactory.deploy()
	console.log(resolverInstance.address)

	const processInstance = await processFactory.deploy()
	console.log(processInstance.address)

	// attach
	const resolver = new ethers.Contract(address, entityResolverAbi, wallet);
	const process = new ethers.Contract(address, votingProcessAbi, wallet);

	// let privateKey = ethers.Wallet.fromMnemonic(config.MNEMONIC).privateKey;
	// privateKey = "0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d"

	// let wallet = new ethers.Wallet(privateKey, provider);
	// console.log(wallet.address);

	// // Load the wallet to deploy the contract with
	// let wallet = new ethers.Wallet(node.privateKey, provider);

})()

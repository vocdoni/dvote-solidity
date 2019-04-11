// ALTERNATIVE APPROACH WITH ETHERS.JS

const ethers = require("ethers")
const ganache = require("ganache-cli")

const { getConfig } = require("./util")
const config = getConfig()

const { abi: entityResolverAbi, bytecode: entityResolverByteCode } = require("../build/entity-resolver.json")
const { abi: votingProcessAbi, bytecode: votingProcessByteCode } = require("../build/voting-process.json")

async function main() {

	const provider = new ethers.providers.Web3Provider(ganache.provider({
		mnemonic: config.MNEMONIC
	}))
	// const provider = new ethers.providers.JsonRpcProvider(config.GATEWAY_URL)
	const wallet1 = ethers.Wallet.fromMnemonic(config.MNEMONIC).connect(provider)

	// const privateKey = ethers.Wallet.fromMnemonic(config.MNEMONIC).privateKey
	// const wallet2 = new ethers.Wallet(privateKey, provider)
	// const wallet2 = ethers.Wallet.fromMnemonic(config.MNEMONIC).connect(provider)

	// deploy
	const resolverFactory = new ethers.ContractFactory(entityResolverAbi, entityResolverByteCode, wallet1)
	const processFactory = new ethers.ContractFactory(votingProcessAbi, votingProcessByteCode, wallet1)

	const resolverInstance1 = await resolverFactory.deploy()
	console.log("Resolver deployed at", resolverInstance1.address)

	const processInstance1 = await processFactory.deploy()
	console.log("Process deployed at", processInstance1.address)

	// attach
	const resolverAddress = resolverInstance1.address
	const processAddress = processInstance1.address
	const resolverInstance2 = new ethers.Contract(resolverAddress, entityResolverAbi, wallet1)
	const processInstance2 = new ethers.Contract(processAddress, votingProcessAbi, wallet1)

	// use
	const address = await wallet1.getAddress()
	const entityId = await resolverInstance2.getEntityId(address)
	console.log("ENTITY ID", entityId)

	const processId = await processInstance2.getProcessId(address, 0)
	console.log("PROCESS ID", processId)

	const defaultResolver = "0x1234567890123456789012345678901234567890"
	const defaultProcessName = "Process name"
	const defaultMetadataContentUri = "bzz://1234,ipfs://ipfs/1234"
	const defaultEncryptionPublicKey = "0x1234"

	await processInstance2.create(
		defaultResolver,
		defaultProcessName,
		defaultMetadataContentUri,
		Math.ceil(Date.now() / 1000) + 10,
		Math.ceil(Date.now() / 1000) + 10000,
		defaultEncryptionPublicKey)

	const vote = await processInstance2.get(processId)
	console.log(vote)

	console.log("DONE")
}

main()
	.then(() => process.exit())
	.catch(err => console.error(err))

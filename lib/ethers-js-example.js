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
	// const provider = ethers.getDefaultProvider('goerli')
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

	const processInstance1 = await processFactory.deploy(1, [0, 1, 4, 6, 8, 10, 12, 14], [0, 1, 3])
	console.log("Process deployed at", processInstance1.address)

	// // attach
	// const resolverAddress = resolverInstance1.address
	// const processAddress = processInstance1.address
	// const resolverInstance2 = new ethers.Contract(resolverAddress, entityResolverAbi, wallet1)
	// const processInstance2 = new ethers.Contract(processAddress, votingProcessAbi, wallet1)

	// use
	const address = await wallet1.getAddress()
	const entityId = await resolverInstance1.getEntityId(address)
	console.log("ENTITY ID", entityId)

	const processId = await processInstance1.getProcessId(address, 0)
	console.log("PROCESS ID", processId)

	const envelopeType = 0;
	const processMode = 0;
	const metadataOrigin = "ipfs://1234"
	const merkleRoot = "0x1234"
	const merkleTree = "ipfs://1234"
	const startBlock = Math.ceil(Date.now() / 1000) + 10
	const numberOfBlocks = 10000

	const tx = await processInstance1.create(
		envelopeType,
		processMode,
		metadataOrigin,
		merkleRoot,
		merkleTree,
		startBlock,
		numberOfBlocks)

	await tx.wait()

	const vote = await processInstance1.get(processId)
	console.log(vote)

	console.log("DONE")
}

main()
	.then(() => process.exit())
	.catch(err => console.error(err))

const ethers = require("ethers")
const ganache = require("ganache-cli")

const { abi: entityResolverAbi, bytecode: entityResolverByteCode } = require("../build/entity-resolver.json")
const { abi: votingProcessAbi, bytecode: votingProcessByteCode } = require("../build/voting-process.json")

const dotenv = require("dotenv")
const fs = require("fs")
const { ProcessMode, ProcessEnvelopeType } = require("../build/index.js")

const config = getConfig()
const CHAIN_ID = 1

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

	const processInstance1 = await processFactory.deploy(CHAIN_ID)
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

	const mode = ProcessMode.make({ interruptible: true, allowVoteOverwrite: true });
	const envelopeType = ProcessEnvelopeType.make({ serial: true, encryptedVotes: true });
	const metadataOrigin = "ipfs://1234"
	const merkleRoot = "0x1234__merkle_root"
	const merkleTree = "ipfs://1234__merkle_tree"
	const startBlock = 10000
	const blockCount = 110000
	const questionCount = 1
	const maxVoteOverwrites = 2
	const maxValue = 3
	const uniqueValues = true
	const maxTotalCost = 4
	const costExponent = 5
	const namespace = 6
	const paramsSignature = "0xe7fb8f3e702fd22bf02391cc16c6b4bc465084468f1627747e6e21e2005f880e"

	const tx = await processInstance1.create(
		[mode, envelopeType],
		[metadataOrigin, merkleRoot, merkleTree],
		startBlock,
		blockCount,
		[questionCount, maxVoteOverwrites, maxValue],
		uniqueValues,
		[maxTotalCost, costExponent],
		namespace,
		paramsSignature
	)

	await tx.wait()

	const vote = await processInstance1.get(processId)
	console.log(vote)

	console.log("DONE")
}

function getConfig() {
	const envDefault = dotenv.parse(fs.readFileSync("./.env"))

	return Object.assign({}, envDefault, process.env)
}

main()
	.then(() => process.exit())
	.catch(err => console.error(err))

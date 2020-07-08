const { Wallet, Contract, ContractFactory, providers } = require("ethers")
const ganache = require("ganache-cli")

const { abi: entityResolverAbi, bytecode: entityResolverByteCode } = require("../build/entity-resolver.json")
const { abi: processAbi, bytecode: processByteCode } = require("../build/process.json")
const { abi: namespaceAbi, bytecode: namespaceByteCode } = require("../build/namespace.json")

const fs = require("fs")
const { ProcessMode, ProcessEnvelopeType, ProcessContractParameters, ProcessStatus } = require("../build/index.js")


async function main() {
	const mnemonic = Wallet.createRandom().signingKey.mnemonic

	const provider = new providers.Web3Provider(ganache.provider({ mnemonic }))
	// const provider = getDefaultProvider('goerli')
	// const provider = new providers.JsonRpcProvider(config.GATEWAY_URL)
	const wallet1 = Wallet.fromMnemonic(mnemonic).connect(provider)

	// const privateKey = Wallet.fromMnemonic(mnemonic).privateKey
	// const wallet2 = new Wallet(privateKey, provider)
	// const wallet2 = Wallet.fromMnemonic(mnemonic).connect(provider)

	// DEPLOY
	const resolverFactory = new ContractFactory(entityResolverAbi, entityResolverByteCode, wallet1)
	const processFactory = new ContractFactory(processAbi, processByteCode, wallet1)
	const namespaceFactory = new ContractFactory(namespaceAbi, namespaceByteCode, wallet1)

	const resolverInstance1 = await resolverFactory.deploy()
	console.log("Resolver deployed at", resolverInstance1.address)

	const namespaceInstance1 = await namespaceFactory.deploy()
	console.log("Namespace deployed at", namespaceInstance1.address)

	// The process contract needs the address of an already deployed namespace instance
	const parentInstanceAddress = "0x0000000000000000000000000000000000000000"
	const processInstance1 = await processFactory.deploy(parentInstanceAddress, namespaceInstance1.address)
	console.log("Process deployed at", processInstance1.address)

	// ATTACH
	// const resolverAddress = resolverInstance1.address
	// const processAddress = processInstance1.address
	// const namespaceAddress = namespaceInstance1.address
	// const resolverInstance2 = new Contract(resolverAddress, entityResolverAbi, wallet1)
	// const processInstance2 = new Contract(processAddress, processAbi, wallet1)
	// const namespaceInstance2 = new Contract(namespaceAddress, namespaceAbi, wallet1)

	// USE
	const address = await wallet1.getAddress()
	const entityNode = await ensHashAddress(address)
	console.log(await resolverInstance1.test(entityNode, "vnd.vocdoni.metadata"))

	const namespace = 0
	const idx = 0
	const processId = await processInstance1.getProcessId(address, idx, namespace)
	console.log("PROCESS ID", processId)

	// Process creation
	const processParams = ProcessContractParameters.fromParams({
		mode: ProcessMode.make({ interruptible: true, allowVoteOverwrite: true }),
		envelopeType: ProcessEnvelopeType.make({ serial: true, encryptedVotes: true }),
		metadata: "ipfs://1234",
		censusMerkleRoot: "0x1234__merkle_root",
		censusMerkleTree: "ipfs://1234__merkle_tree",
		startBlock: 10000,
		blockCount: 110000,
		questionCount: 2,
		maxVoteOverwrites: 3,
		maxValue: 4,
		uniqueValues: true,
		maxTotalCost: 5,
		costExponent: 6,
		namespace,
		paramsSignature: "0xe7fb8f3e702fd22bf02391cc16c6b4bc465084468f1627747e6e21e2005f880e"
	})
	const params = processParams.toContractParams()
	let tx = await processInstance1.newProcess(...params)
	await tx.wait()

	tx = await processInstance1.setStatus(processId, ProcessStatus.READY)
	await tx.wait()

	tx = await processInstance1.incrementQuestionIndex(processId)
	await tx.wait()

	// Getters
	const processParamsTuple = await processInstance1.get(processId)
	console.log("Raw params", processParamsTuple)
	console.log("Wrapped params", ProcessContractParameters.fromContract(processParamsTuple))

	const signature = await processInstance1.getParamsSignature(processId)
	console.log("Process signature", signature)

	const results = await processInstance1.getResults(processId)
	console.log("Results:", results)

	// Deploying a fork
	const processFactory2 = new ContractFactory(processAbi, processByteCode, wallet1)
	const processInstance2 = await processFactory2.deploy(processInstance1.address, namespaceInstance1.address)
	console.log("Process 2 deployed at", processInstance1.address)

	// Activating it
	tx = await processInstance1.activateSuccessor(processInstance2.address)
	await tx.wait()

	// Reading the old process from the new one
	const processParamsTuple2 = await processInstance1.get(processId)
	console.log("Process params from the fork", ProcessContractParameters.fromContract(processParamsTuple2))

	console.log("DONE")
}

main()
	.then(() => process.exit())
	.catch(err => console.error(err))

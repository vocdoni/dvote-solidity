
import "mocha" // using @types/mocha
import { expect } from "chai"
import { Contract, Wallet, ContractFactory, ContractTransaction } from "ethers"
import { addCompletionHooks } from "../utils/mocha-hooks"
import { getAccounts, incrementTimestamp, TestAccount } from "../utils"
import { ProcessContractMethods, ProcessStatus, ProcessEnvelopeType, ProcessMode, unwrapProcessState, wrapProcessCreateParams } from "../../lib"

import ProcessBuilder, { DEFAULT_METADATA_CONTENT_HASHED_URI, DEFAULT_MERKLE_ROOT, DEFAULT_MERKLE_TREE_CONTENT_HASHED_URI, DEFAULT_START_BLOCK, DEFAULT_BLOCK_COUNT, DEFAULT_QUESTION_COUNT, DEFAULT_CHAIN_ID, DEFAULT_MAX_VOTE_OVERWRITES, DEFAULT_MAX_VALUE, DEFAULT_UNIQUE_VALUES, DEFAULT_MAX_TOTAL_COST, DEFAULT_COST_EXPONENT, DEFAULT_NAMESPACE, DEFAULT_PARAMS_SIGNATURE } from "../builders/process"
import { BigNumber } from "ethers/utils"

const { abi: votingProcessAbi, bytecode: votingProcessByteCode } = require("../../build/voting-process.json")

let accounts: TestAccount[]
let deployAccount: TestAccount
let entityAccount: TestAccount
let randomAccount1: TestAccount
let randomAccount2: TestAccount
let authorizedOracleAccount1: TestAccount
let authorizedOracleAccount2: TestAccount
let processId: string
let contractInstance: ProcessContractMethods & Contract
let chainId: number
let questionCount: number
let tx: ContractTransaction

addCompletionHooks()

describe("Voting Process", () => {
    beforeEach(async () => {
        accounts = getAccounts()
        deployAccount = accounts[0]
        entityAccount = accounts[1]
        randomAccount1 = accounts[2]
        randomAccount2 = accounts[3]
        authorizedOracleAccount1 = accounts[4]
        authorizedOracleAccount2 = accounts[5]

        chainId = DEFAULT_CHAIN_ID
        questionCount = 2
        tx = null

        contractInstance = await new ProcessBuilder().build()
        processId = await contractInstance.getProcessId(entityAccount.address, 0)
    })

    it("should deploy the contract", async () => {
        const contractFactory = new ContractFactory(votingProcessAbi, votingProcessByteCode, entityAccount.wallet)
        const localInstance1: Contract & ProcessContractMethods = await contractFactory.deploy(chainId) as Contract & ProcessContractMethods

        expect(localInstance1).to.be.ok
        expect(localInstance1.address).to.match(/^0x[0-9a-fA-F]{40}$/)
        expect((await localInstance1.getChainId()).toNumber()).to.eq(chainId)

        const localInstance2: Contract & ProcessContractMethods = await contractFactory.deploy(234) as Contract & ProcessContractMethods

        expect(localInstance2).to.be.ok
        expect(localInstance2.address).to.match(/^0x[0-9a-fA-F]{40}$/)
        expect(localInstance2.address).to.not.eq(localInstance1.address)
        expect((await localInstance2.getChainId()).toNumber()).to.eq(234)
    })

    it("should compute a processId based on the entity address and the process index", async () => {
        expect(contractInstance.getProcessId).to.be.ok
        expect(contractInstance.getProcessId.call).to.be.ok

        const proc1 = await contractInstance.getProcessId(accounts[0].address, 0)
        const proc2 = await contractInstance.getProcessId(accounts[0].address, 0)

        const proc3 = await contractInstance.getProcessId(accounts[0].address, 1)
        const proc4 = await contractInstance.getProcessId(accounts[0].address, 1)

        const proc5 = await contractInstance.getProcessId(accounts[0].address, 2)
        const proc6 = await contractInstance.getProcessId(accounts[0].address, 3)

        const proc7 = await contractInstance.getProcessId(accounts[1].address, 0)
        const proc8 = await contractInstance.getProcessId(accounts[1].address, 1)

        expect(proc1).to.eq(proc2)
        expect(proc3).to.eq(proc4)

        expect(proc1).to.not.eq(proc3)
        expect(proc1).to.not.eq(proc5)
        expect(proc1).to.not.eq(proc6)

        expect(proc3).to.not.eq(proc5)
        expect(proc3).to.not.eq(proc6)

        expect(proc5).to.not.eq(proc6)

        expect(proc7).to.not.eq(proc1)
        expect(proc8).to.not.eq(proc3)
    })

    it("should compute the next processId", async () => {
        // The entity already has 1 process at the moment
        const count1 = await contractInstance.getEntityProcessCount(entityAccount.address)
        expect(count1.toNumber()).to.eq(1)
        const processId1Expected = await contractInstance.getProcessId(entityAccount.address, count1.toNumber())
        const processId1Actual = await contractInstance.getNextProcessId(entityAccount.address)

        expect(processId1Actual).to.eq(processId1Expected)

        tx = await contractInstance.create(
            [ProcessMode.make({ autoStart: true }), ProcessEnvelopeType.make()],
            [DEFAULT_METADATA_CONTENT_HASHED_URI, DEFAULT_MERKLE_ROOT, DEFAULT_MERKLE_TREE_CONTENT_HASHED_URI],
            DEFAULT_START_BLOCK,
            DEFAULT_BLOCK_COUNT,
            [DEFAULT_QUESTION_COUNT, DEFAULT_MAX_VOTE_OVERWRITES, DEFAULT_MAX_VALUE],
            DEFAULT_UNIQUE_VALUES,
            [DEFAULT_MAX_TOTAL_COST, DEFAULT_COST_EXPONENT],
            DEFAULT_NAMESPACE,
            DEFAULT_PARAMS_SIGNATURE
        )
        await tx.wait()

        // The entity has 2 processes now
        // So the next process index is 2
        const processId2Expected = await contractInstance.getProcessId(entityAccount.address, 2)
        const processId2Actual = await contractInstance.getNextProcessId(entityAccount.address)

        expect(processId1Actual).to.not.eq(processId2Actual)
        expect(processId2Actual).to.eq(processId2Expected)
    })

    describe("should set genesis", () => {
        let genesis
        beforeEach(() => {
            genesis = "0x1234567890123456789012345678901234567890123123123"
        })

        it("only contract creator", async () => {
            try {
                contractInstance = contractInstance.connect(randomAccount1.wallet) as any
                tx = await contractInstance.setGenesis(genesis)
                await tx.wait()
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert/, "The transaction threw an unexpected error:\n" + err.message)
            }
        })

        it("should persist", async () => {
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.setGenesis(genesis)
            await tx.wait()

            let currentGenesis = await contractInstance.getGenesis()
            expect(currentGenesis).to.eq(genesis, "Gensis should match")

            // Another genesis value
            tx = await contractInstance.setGenesis("1234")
            await tx.wait()

            currentGenesis = await contractInstance.getGenesis()
            expect(currentGenesis).to.eq("1234", "Gensis should match")
        })

        it("should emit an event", async () => {
            contractInstance = contractInstance.connect(deployAccount.wallet) as any

            const result: { genesis: string } = await new Promise((resolve, reject) => {
                contractInstance.on("GenesisUpdated", (genesis: string) => {
                    resolve({ genesis })
                })
                contractInstance.setGenesis(genesis).then(tx => tx.wait()).catch(reject)
            })

            expect(result).to.be.ok
            expect(result.genesis).to.equal(genesis)
        }).timeout(7000)
    })

    describe("should set chainId", () => {
        it("only contract creator", async () => {
            try {
                contractInstance = contractInstance.connect(randomAccount1.wallet) as any
                tx = await contractInstance.setChainId(chainId)
                await tx.wait()
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert/, "The transaction threw an unexpected error:\n" + err.message)
            }
        })

        it("should persist", async () => {
            const chainValue = 200
            contractInstance = contractInstance.connect(deployAccount.wallet) as any

            tx = await contractInstance.setChainId(chainValue)
            await tx.wait()

            await new Promise(resolve => setTimeout(resolve, 1500))

            let currentChainId = await contractInstance.getChainId()
            expect(currentChainId.toNumber()).to.eq(chainValue, "ChainId should match")
        })

        it("should fail if duplicated", async () => {
            contractInstance = contractInstance.connect(deployAccount.wallet) as any

            try {
                // same that it already is
                tx = await contractInstance.setChainId(chainId)
                await tx.wait()

                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert/, "The transaction threw an unexpected error:\n" + err.message)
            }
        })

        it("should emit an event", async () => {
            const newChainId = 200
            contractInstance = contractInstance.connect(deployAccount.wallet) as any

            const result: { chainId: BigNumber } = await new Promise((resolve, reject) => {
                contractInstance.on("ChainIdUpdated", (chainId: BigNumber) => {
                    resolve({ chainId })
                })
                contractInstance.setChainId(newChainId).then(tx => tx.wait()).catch(reject)
            })

            expect(result).to.be.ok
            expect(result.chainId.toNumber()).to.equal(newChainId)
        }).timeout(7000)
    })

    describe("should create processes", () => {
        it("should allow anyone to create a process", async () => {
            expect(contractInstance.create).to.be.ok

            // one is already created by the builder

            let processIdExpected = await contractInstance.getProcessId(entityAccount.address, 1)
            let processIdActual = await contractInstance.getNextProcessId(entityAccount.address)
            expect(processIdExpected).to.eq(processIdActual)

            // 2
            contractInstance = contractInstance.connect(randomAccount1.wallet) as any
            tx = await contractInstance.create(
                [ProcessMode.make({ autoStart: true }), ProcessEnvelopeType.make()],
                [DEFAULT_METADATA_CONTENT_HASHED_URI, DEFAULT_MERKLE_ROOT, DEFAULT_MERKLE_TREE_CONTENT_HASHED_URI],
                DEFAULT_START_BLOCK,
                DEFAULT_BLOCK_COUNT,
                [DEFAULT_QUESTION_COUNT, DEFAULT_MAX_VOTE_OVERWRITES, DEFAULT_MAX_VALUE],
                DEFAULT_UNIQUE_VALUES,
                [DEFAULT_MAX_TOTAL_COST, DEFAULT_COST_EXPONENT],
                DEFAULT_NAMESPACE,
                DEFAULT_PARAMS_SIGNATURE
            )
            await tx.wait()

            processIdExpected = await contractInstance.getProcessId(randomAccount1.address, 1)
            processIdActual = await contractInstance.getNextProcessId(randomAccount1.address)
            expect(processIdExpected).to.eq(processIdActual)

            contractInstance = contractInstance.connect(randomAccount2.wallet) as any
            tx = await contractInstance.create(
                [ProcessMode.make({ autoStart: true }), ProcessEnvelopeType.make()],
                [DEFAULT_METADATA_CONTENT_HASHED_URI, DEFAULT_MERKLE_ROOT, DEFAULT_MERKLE_TREE_CONTENT_HASHED_URI],
                DEFAULT_START_BLOCK,
                DEFAULT_BLOCK_COUNT,
                [DEFAULT_QUESTION_COUNT, DEFAULT_MAX_VOTE_OVERWRITES, DEFAULT_MAX_VALUE],
                DEFAULT_UNIQUE_VALUES,
                [DEFAULT_MAX_TOTAL_COST, DEFAULT_COST_EXPONENT],
                DEFAULT_NAMESPACE,
                DEFAULT_PARAMS_SIGNATURE
            )
            await tx.wait()

            processIdExpected = await contractInstance.getProcessId(randomAccount2.address, 1)
            processIdActual = await contractInstance.getNextProcessId(randomAccount2.address)
            expect(processIdExpected).to.eq(processIdActual)
        })

        it("retrieved metadata should match the one submitted", async () => {
            // 1
            tx = await contractInstance.create(
                [ProcessMode.make({}), ProcessEnvelopeType.make({})],
                [DEFAULT_METADATA_CONTENT_HASHED_URI, DEFAULT_MERKLE_ROOT, DEFAULT_MERKLE_TREE_CONTENT_HASHED_URI],
                DEFAULT_START_BLOCK,
                DEFAULT_BLOCK_COUNT,
                [DEFAULT_QUESTION_COUNT, DEFAULT_MAX_VOTE_OVERWRITES, DEFAULT_MAX_VALUE],
                DEFAULT_UNIQUE_VALUES,
                [DEFAULT_MAX_TOTAL_COST, DEFAULT_COST_EXPONENT],
                DEFAULT_NAMESPACE,
                DEFAULT_PARAMS_SIGNATURE
            )
            await tx.wait()

            let count = Number(await contractInstance.getEntityProcessCount(entityAccount.address))
            let processId = await contractInstance.getProcessId(entityAccount.address, count - 1)

            let processData = await contractInstance.get(processId)

            // { uint8[2] mode_envelopeType, address entityAddress, uint64 startBlock, uint32 blockCount, string[3] metadata_censusMerkleRoot_censusMerkleTree, Status status, uint8[4] questionIndex_questionCount_maxVoteOverwrites_maxValue, bool uniqueValues, uint16[2] maxTotalCost_costExponent, uint16 namespace, bytes32 paramsSignature }

            let [mode1, envelopeType1] = processData[0]
            expect(mode1).to.eq(ProcessMode.make({}))
            expect(envelopeType1).to.eq(ProcessEnvelopeType.make({}))
            let entityAddress1 = processData[1]
            expect(entityAddress1).to.eq(entityAccount.address)
            let [metadata1, censusMerkleRoot1, censusMerkleTree1] = processData[2]
            expect(metadata1).to.eq(DEFAULT_METADATA_CONTENT_HASHED_URI)
            expect(censusMerkleRoot1).to.eq(DEFAULT_MERKLE_ROOT)
            expect(censusMerkleTree1).to.eq(DEFAULT_MERKLE_TREE_CONTENT_HASHED_URI)
            let startBlock1 = processData[3]
            expect(startBlock1.toNumber()).to.eq(DEFAULT_START_BLOCK)
            let blockCount1 = processData[4]
            expect(blockCount1).to.eq(DEFAULT_BLOCK_COUNT)
            let status1 = processData[5]
            expect(status1).to.eq(ProcessStatus.PAUSED, "The process should start paused")
            let [questionIndex1, questionCount1, maxVoteOverwrites1, maxValue1] = processData[6]
            expect(questionIndex1).to.eq(0)
            expect(questionCount1).to.eq(DEFAULT_QUESTION_COUNT)
            expect(maxVoteOverwrites1).to.eq(DEFAULT_MAX_VOTE_OVERWRITES)
            expect(maxValue1).to.eq(DEFAULT_MAX_VALUE)
            let uniqueValues1 = processData[7]
            expect(uniqueValues1).to.eq(DEFAULT_UNIQUE_VALUES)
            let [maxTotalCost1, costExponent1] = processData[8]
            expect(maxTotalCost1).to.eq(DEFAULT_MAX_TOTAL_COST)
            expect(costExponent1).to.eq(DEFAULT_COST_EXPONENT)
            let namespace1 = processData[9]
            expect(namespace1).to.eq(DEFAULT_NAMESPACE)
            let paramsSignature1 = processData[10]
            expect(paramsSignature1).to.eq(DEFAULT_PARAMS_SIGNATURE)

            // 2
            let newMode = ProcessMode.make({ autoStart: true })
            let newEnvelopeType = ProcessEnvelopeType.make({ encryptedVotes: true })
            let newMetadata = "ipfs://ipfs/more-hash-there!sha3-hash"
            let newCensusMerkleRoot = "0x00000001111122222333334444"
            let newCensusMerkleTree = "ipfs://ipfs/more-hash-somewthere!sha3-hash-there"
            let newStartBlock = new BigNumber(1111111)
            let newBlockCount = 22222
            let newQuestionCount = 10
            let newMaxVoteOverwrites = 11
            let newMaxValue = 12
            let newUniqueValues = true
            let newMaxTotalCost = 13
            let newCostExponent = 14
            let newNamespace = 15
            let newParamsSignature = "0x91ba691fb296ba519623fb59163919baf19b26ba91fea9be61b92fab19dbf9df"

            tx = await contractInstance.create(
                [newMode, newEnvelopeType],
                [newMetadata, newCensusMerkleRoot, newCensusMerkleTree],
                newStartBlock,
                newBlockCount,
                [newQuestionCount, newMaxVoteOverwrites, newMaxValue],
                newUniqueValues,
                [newMaxTotalCost, newCostExponent],
                newNamespace,
                newParamsSignature
            )
            await tx.wait()

            count = Number(await contractInstance.getEntityProcessCount(entityAccount.address))
            processId = await contractInstance.getProcessId(entityAccount.address, count - 1)

            processData = await contractInstance.get(processId)

            let [mode2, envelopeType2] = processData[0]
            expect(mode2).to.eq(newMode)
            expect(envelopeType2).to.eq(newEnvelopeType)
            let entityAddress2 = processData[1]
            expect(entityAddress2).to.eq(entityAccount.address)
            let [metadata2, censusMerkleRoot2, censusMerkleTree2] = processData[2]
            expect(metadata2).to.eq(newMetadata)
            expect(censusMerkleRoot2).to.eq(newCensusMerkleRoot)
            expect(censusMerkleTree2).to.eq(newCensusMerkleTree)
            let startBlock2 = processData[3]
            expect(startBlock2.toNumber()).to.eq(newStartBlock.toNumber())
            let blockCount2 = processData[4]
            expect(blockCount2).to.eq(newBlockCount)
            let status2 = processData[5]
            expect(status2).to.eq(ProcessStatus.READY, "The process should start ready")
            let [questionIndex2, questionCount2, maxVoteOverwrites2, maxValue2] = processData[6]
            expect(questionIndex2).to.eq(0)
            expect(questionCount2).to.eq(newQuestionCount)
            expect(maxVoteOverwrites2).to.eq(newMaxVoteOverwrites)
            expect(maxValue2).to.eq(newMaxValue)
            let uniqueValues2 = processData[7]
            expect(uniqueValues2).to.eq(newUniqueValues)
            let [maxTotalCost2, costExponent2] = processData[8]
            expect(maxTotalCost2).to.eq(newMaxTotalCost)
            expect(costExponent2).to.eq(newCostExponent)
            let namespace2 = processData[9]
            expect(namespace2).to.eq(newNamespace)
            let paramsSignature2 = processData[10]
            expect(paramsSignature2).to.eq(newParamsSignature)

            // 3
            newMode = ProcessMode.make({ autoStart: false, interruptible: true, encryptedMetadata: true })
            newEnvelopeType = ProcessEnvelopeType.make({ encryptedVotes: false, anonymousVoters: true })
            newMetadata = "ipfs://ipfs/hello-world-1234!sha3-hash"
            newCensusMerkleRoot = "0x00000001111122222333334444555666777888999"
            newCensusMerkleTree = "ipfs://ipfs/more-hash-somewthere-and-there!sha3-hash-there"
            newStartBlock = new BigNumber(2222222)
            newBlockCount = 33333
            newQuestionCount = 20
            newMaxVoteOverwrites = 21
            newMaxValue = 22
            newUniqueValues = false
            newMaxTotalCost = 23
            newCostExponent = 24
            newNamespace = 25
            newParamsSignature = "0x11ba691fb296ba519623fb59163919baf19b26ba91fea9be61b92fab19dbf9df"

            tx = await contractInstance.create(
                [newMode, newEnvelopeType],
                [newMetadata, newCensusMerkleRoot, newCensusMerkleTree],
                newStartBlock,
                newBlockCount,
                [newQuestionCount, newMaxVoteOverwrites, newMaxValue],
                newUniqueValues,
                [newMaxTotalCost, newCostExponent],
                newNamespace,
                newParamsSignature
            )
            await tx.wait()

            count = Number(await contractInstance.getEntityProcessCount(entityAccount.address))
            processId = await contractInstance.getProcessId(entityAccount.address, count - 1)

            processData = await contractInstance.get(processId)

            let [mode3, envelopeType3] = processData[0]
            expect(mode3).to.eq(newMode)
            expect(envelopeType3).to.eq(newEnvelopeType)
            let entityAddress3 = processData[1]
            expect(entityAddress3).to.eq(entityAccount.address)
            let [metadata3, censusMerkleRoot3, censusMerkleTree3] = processData[2]
            expect(metadata3).to.eq(newMetadata)
            expect(censusMerkleRoot3).to.eq(newCensusMerkleRoot)
            expect(censusMerkleTree3).to.eq(newCensusMerkleTree)
            let startBlock3 = processData[3]
            expect(startBlock3.toNumber()).to.eq(newStartBlock.toNumber())
            let blockCount3 = processData[4]
            expect(blockCount3).to.eq(newBlockCount)
            let status3 = processData[5]
            expect(status3).to.eq(ProcessStatus.PAUSED, "The process should start paused")
            let [questionIndex3, questionCount3, maxVoteOverwrites3, maxValue3] = processData[6]
            expect(questionIndex3).to.eq(0)
            expect(questionCount3).to.eq(newQuestionCount)
            expect(maxVoteOverwrites3).to.eq(newMaxVoteOverwrites)
            expect(maxValue3).to.eq(newMaxValue)
            let uniqueValues3 = processData[7]
            expect(uniqueValues3).to.eq(newUniqueValues)
            let [maxTotalCost3, costExponent3] = processData[8]
            expect(maxTotalCost3).to.eq(newMaxTotalCost)
            expect(costExponent3).to.eq(newCostExponent)
            let namespace3 = processData[9]
            expect(namespace3).to.eq(newNamespace)
            let paramsSignature3 = processData[10]
            expect(paramsSignature3).to.eq(newParamsSignature)
        })

        it("unwrapped metadata should match the unwrapped response", async () => {
            // 1
            const params1 = wrapProcessCreateParams({
                mode: ProcessMode.make({}),
                envelopeType: ProcessEnvelopeType.make({}),
                metadata: DEFAULT_METADATA_CONTENT_HASHED_URI,
                censusMerkleRoot: DEFAULT_MERKLE_ROOT,
                censusMerkleTree: DEFAULT_MERKLE_TREE_CONTENT_HASHED_URI,
                startBlock: DEFAULT_START_BLOCK,
                blockCount: DEFAULT_BLOCK_COUNT,
                questionCount: DEFAULT_QUESTION_COUNT,
                maxVoteOverwrites: DEFAULT_MAX_VOTE_OVERWRITES,
                maxValue: DEFAULT_MAX_VALUE,
                uniqueValues: DEFAULT_UNIQUE_VALUES,
                maxTotalCost: DEFAULT_MAX_TOTAL_COST,
                costExponent: DEFAULT_COST_EXPONENT,
                namespace: DEFAULT_NAMESPACE,
                paramsSignature: DEFAULT_PARAMS_SIGNATURE
            })
            tx = await contractInstance.create(...params1)
            await tx.wait()

            let count = Number(await contractInstance.getEntityProcessCount(entityAccount.address))
            let processId = await contractInstance.getProcessId(entityAccount.address, count - 1)

            const processData1 = unwrapProcessState(await contractInstance.get(processId))

            expect(processData1.mode).to.eq(ProcessMode.make({}))
            expect(processData1.envelopeType).to.eq(ProcessEnvelopeType.make({}))
            expect(processData1.entityAddress).to.eq(entityAccount.address)
            expect(processData1.metadata).to.eq(DEFAULT_METADATA_CONTENT_HASHED_URI)
            expect(processData1.censusMerkleRoot).to.eq(DEFAULT_MERKLE_ROOT)
            expect(processData1.censusMerkleTree).to.eq(DEFAULT_MERKLE_TREE_CONTENT_HASHED_URI)
            expect(processData1.startBlock.toNumber()).to.eq(DEFAULT_START_BLOCK)
            expect(processData1.blockCount).to.eq(DEFAULT_BLOCK_COUNT)
            expect(processData1.status).to.eq(ProcessStatus.PAUSED, "The process should start paused")
            expect(processData1.questionIndex).to.eq(0)
            expect(processData1.questionCount).to.eq(DEFAULT_QUESTION_COUNT)
            expect(processData1.maxVoteOverwrites).to.eq(DEFAULT_MAX_VOTE_OVERWRITES)
            expect(processData1.maxValue).to.eq(DEFAULT_MAX_VALUE)
            expect(processData1.uniqueValues).to.eq(DEFAULT_UNIQUE_VALUES)
            expect(processData1.maxTotalCost).to.eq(DEFAULT_MAX_TOTAL_COST)
            expect(processData1.costExponent).to.eq(DEFAULT_COST_EXPONENT)
            expect(processData1.namespace).to.eq(DEFAULT_NAMESPACE)
            expect(processData1.paramsSignature).to.eq(DEFAULT_PARAMS_SIGNATURE)

            // 2
            let newMode = ProcessMode.make({ autoStart: true })
            let newEnvelopeType = ProcessEnvelopeType.make({ encryptedVotes: true })
            let newMetadata = "ipfs://ipfs/more-hash-there!sha3-hash"
            let newCensusMerkleRoot = "0x00000001111122222333334444"
            let newCensusMerkleTree = "ipfs://ipfs/more-hash-somewthere!sha3-hash-there"
            let newStartBlock = new BigNumber(1111111)
            let newBlockCount = 22222
            let newQuestionCount = 10
            let newMaxVoteOverwrites = 11
            let newMaxValue = 12
            let newUniqueValues = true
            let newMaxTotalCost = 13
            let newCostExponent = 14
            let newNamespace = 15
            let newParamsSignature = "0x91ba691fb296ba519623fb59163919baf19b26ba91fea9be61b92fab19dbf9df"

            const params2 = wrapProcessCreateParams({
                mode: newMode,
                envelopeType: newEnvelopeType,
                metadata: newMetadata,
                censusMerkleRoot: newCensusMerkleRoot,
                censusMerkleTree: newCensusMerkleTree,
                startBlock: newStartBlock,
                blockCount: newBlockCount,
                questionCount: newQuestionCount,
                maxVoteOverwrites: newMaxVoteOverwrites,
                maxValue: newMaxValue,
                uniqueValues: newUniqueValues,
                maxTotalCost: newMaxTotalCost,
                costExponent: newCostExponent,
                namespace: newNamespace,
                paramsSignature: newParamsSignature
            })
            tx = await contractInstance.create(...params2)
            await tx.wait()

            count = Number(await contractInstance.getEntityProcessCount(entityAccount.address))
            processId = await contractInstance.getProcessId(entityAccount.address, count - 1)

            const processData2 = unwrapProcessState(await contractInstance.get(processId))

            expect(processData2.mode).to.eq(newMode)
            expect(processData2.envelopeType).to.eq(newEnvelopeType)
            expect(processData2.entityAddress).to.eq(entityAccount.address)
            expect(processData2.metadata).to.eq(newMetadata)
            expect(processData2.censusMerkleRoot).to.eq(newCensusMerkleRoot)
            expect(processData2.censusMerkleTree).to.eq(newCensusMerkleTree)
            expect(processData2.startBlock.toNumber()).to.eq(newStartBlock.toNumber())
            expect(processData2.blockCount).to.eq(newBlockCount)
            expect(processData2.status).to.eq(ProcessStatus.READY, "The process should start ready")
            expect(processData2.questionIndex).to.eq(0)
            expect(processData2.questionCount).to.eq(newQuestionCount)
            expect(processData2.maxVoteOverwrites).to.eq(newMaxVoteOverwrites)
            expect(processData2.maxValue).to.eq(newMaxValue)
            expect(processData2.uniqueValues).to.eq(newUniqueValues)
            expect(processData2.maxTotalCost).to.eq(newMaxTotalCost)
            expect(processData2.costExponent).to.eq(newCostExponent)
            expect(processData2.namespace).to.eq(newNamespace)
            expect(processData2.paramsSignature).to.eq(newParamsSignature)

            // 2
            newMode = ProcessMode.make({ autoStart: true })
            newEnvelopeType = ProcessEnvelopeType.make({ encryptedVotes: true })
            newMetadata = "ipfs://ipfs/more-hash-there!sha3-hash"
            newCensusMerkleRoot = "0x00000001111122222333334444"
            newCensusMerkleTree = "ipfs://ipfs/more-hash-somewthere!sha3-hash-there"
            newStartBlock = new BigNumber(1111111)
            newBlockCount = 22222
            newQuestionCount = 10
            newMaxVoteOverwrites = 11
            newMaxValue = 12
            newUniqueValues = true
            newMaxTotalCost = 13
            newCostExponent = 14
            newNamespace = 15
            newParamsSignature = "0x91ba691fb296ba519623fb59163919baf19b26ba91fea9be61b92fab19dbf9df"

            const params3 = wrapProcessCreateParams({
                mode: newMode,
                envelopeType: newEnvelopeType,
                metadata: newMetadata,
                censusMerkleRoot: newCensusMerkleRoot,
                censusMerkleTree: newCensusMerkleTree,
                startBlock: newStartBlock,
                blockCount: newBlockCount,
                questionCount: newQuestionCount,
                maxVoteOverwrites: newMaxVoteOverwrites,
                maxValue: newMaxValue,
                uniqueValues: newUniqueValues,
                maxTotalCost: newMaxTotalCost,
                costExponent: newCostExponent,
                namespace: newNamespace,
                paramsSignature: newParamsSignature
            })
            tx = await contractInstance.create(...params3)
            await tx.wait()

            count = Number(await contractInstance.getEntityProcessCount(entityAccount.address))
            processId = await contractInstance.getProcessId(entityAccount.address, count - 1)

            const processData3 = unwrapProcessState(await contractInstance.get(processId))

            expect(processData3.mode).to.eq(newMode)
            expect(processData3.envelopeType).to.eq(newEnvelopeType)
            expect(processData3.entityAddress).to.eq(entityAccount.address)
            expect(processData3.metadata).to.eq(newMetadata)
            expect(processData3.censusMerkleRoot).to.eq(newCensusMerkleRoot)
            expect(processData3.censusMerkleTree).to.eq(newCensusMerkleTree)
            expect(processData3.startBlock.toNumber()).to.eq(newStartBlock.toNumber())
            expect(processData3.blockCount).to.eq(newBlockCount)
            expect(processData3.status).to.eq(ProcessStatus.READY, "The process should start ready")
            expect(processData3.questionIndex).to.eq(0)
            expect(processData3.questionCount).to.eq(newQuestionCount)
            expect(processData3.maxVoteOverwrites).to.eq(newMaxVoteOverwrites)
            expect(processData3.maxValue).to.eq(newMaxValue)
            expect(processData3.uniqueValues).to.eq(newUniqueValues)
            expect(processData3.maxTotalCost).to.eq(newMaxTotalCost)
            expect(processData3.costExponent).to.eq(newCostExponent)
            expect(processData3.namespace).to.eq(newNamespace)
            expect(processData3.paramsSignature).to.eq(newParamsSignature)
        })

        it("should emit an event", async () => {
            const expectedProcessId = await contractInstance.getProcessId(entityAccount.address, 0)

            // One has already been created by the builder

            const result: { entityAddress: string, processId: string } = await new Promise((resolve, reject) => {
                contractInstance.on("ProcessCreated", (entityAddress: string, processId: string) => {
                    resolve({ entityAddress, processId })
                })
                // contractInstance.create(
                //     [ProcessMode.make({ autoStart: true }), ProcessEnvelopeType.make()],
                //     [DEFAULT_METADATA_CONTENT_HASHED_URI, DEFAULT_MERKLE_ROOT, DEFAULT_MERKLE_TREE_CONTENT_HASHED_URI],
                //     DEFAULT_START_BLOCK,
                //     DEFAULT_BLOCK_COUNT,
                //     [DEFAULT_QUESTION_COUNT, DEFAULT_MAX_VOTE_OVERWRITES, DEFAULT_MAX_VALUE],
                //     DEFAULT_UNIQUE_VALUES,
                //     [DEFAULT_MAX_TOTAL_COST, DEFAULT_COST_EXPONENT],
                //     DEFAULT_NAMESPACE,
                //     DEFAULT_PARAMS_SIGNATURE
                // ).then(tx => tx.wait()).catch(reject)
            })

            expect(result).to.be.ok
            expect(result.entityAddress).to.equal(entityAccount.address)
            expect(result.processId).to.equal(expectedProcessId)
        }).timeout(7000)

        it("should increase the processCount of the entity on success", async () => {
            const prev = Number(await contractInstance.getEntityProcessCount(entityAccount.address))
            expect(prev).to.eq(1)

            tx = await contractInstance.create(
                [ProcessMode.make({ autoStart: true }), ProcessEnvelopeType.make()],
                [DEFAULT_METADATA_CONTENT_HASHED_URI, DEFAULT_MERKLE_ROOT, DEFAULT_MERKLE_TREE_CONTENT_HASHED_URI],
                DEFAULT_START_BLOCK,
                DEFAULT_BLOCK_COUNT,
                [DEFAULT_QUESTION_COUNT, DEFAULT_MAX_VOTE_OVERWRITES, DEFAULT_MAX_VALUE],
                DEFAULT_UNIQUE_VALUES,
                [DEFAULT_MAX_TOTAL_COST, DEFAULT_COST_EXPONENT],
                DEFAULT_NAMESPACE,
                DEFAULT_PARAMS_SIGNATURE
            )
            await tx.wait()

            const current = Number(await contractInstance.getEntityProcessCount(entityAccount.address))

            expect(current).to.eq(prev + 1, "processCount should have increased by 1")
        })

        it("should fail if auto start and startBlock is zero", () => {
            expect(() => {
                return contractInstance.create(
                    [ProcessMode.make({ autoStart: true }), ProcessEnvelopeType.make()],
                    [DEFAULT_METADATA_CONTENT_HASHED_URI, DEFAULT_MERKLE_ROOT, DEFAULT_MERKLE_TREE_CONTENT_HASHED_URI],
                    0,
                    DEFAULT_BLOCK_COUNT,
                    [DEFAULT_QUESTION_COUNT, DEFAULT_MAX_VOTE_OVERWRITES, DEFAULT_MAX_VALUE],
                    DEFAULT_UNIQUE_VALUES,
                    [DEFAULT_MAX_TOTAL_COST, DEFAULT_COST_EXPONENT],
                    DEFAULT_NAMESPACE,
                    DEFAULT_PARAMS_SIGNATURE
                )
            }).to.throw
        })

        it("should fail if not interruptible and blockCount is zero", () => {
            expect(() => {
                return contractInstance.create(
                    [ProcessMode.make({ interruptible: false }), ProcessEnvelopeType.make({})],
                    [DEFAULT_METADATA_CONTENT_HASHED_URI, DEFAULT_MERKLE_ROOT, DEFAULT_MERKLE_TREE_CONTENT_HASHED_URI],
                    DEFAULT_START_BLOCK,
                    0,
                    [DEFAULT_QUESTION_COUNT, DEFAULT_MAX_VOTE_OVERWRITES, DEFAULT_MAX_VALUE],
                    DEFAULT_UNIQUE_VALUES,
                    [DEFAULT_MAX_TOTAL_COST, DEFAULT_COST_EXPONENT],
                    DEFAULT_NAMESPACE,
                    DEFAULT_PARAMS_SIGNATURE
                )
            }).to.throw
        })

        it("should fail if the metadata or census references are empty", () => {
            expect(() => {
                return contractInstance.create(
                    [ProcessMode.make({}), ProcessEnvelopeType.make({})],
                    ["", DEFAULT_MERKLE_ROOT, DEFAULT_MERKLE_TREE_CONTENT_HASHED_URI],
                    DEFAULT_START_BLOCK,
                    DEFAULT_BLOCK_COUNT,
                    [DEFAULT_QUESTION_COUNT, DEFAULT_MAX_VOTE_OVERWRITES, DEFAULT_MAX_VALUE],
                    DEFAULT_UNIQUE_VALUES,
                    [DEFAULT_MAX_TOTAL_COST, DEFAULT_COST_EXPONENT],
                    DEFAULT_NAMESPACE,
                    DEFAULT_PARAMS_SIGNATURE
                )
            }).to.throw

            expect(() => {
                return contractInstance.create(
                    [ProcessMode.make({}), ProcessEnvelopeType.make({})],
                    [DEFAULT_METADATA_CONTENT_HASHED_URI, "", DEFAULT_MERKLE_TREE_CONTENT_HASHED_URI],
                    DEFAULT_START_BLOCK,
                    DEFAULT_BLOCK_COUNT,
                    [DEFAULT_QUESTION_COUNT, DEFAULT_MAX_VOTE_OVERWRITES, DEFAULT_MAX_VALUE],
                    DEFAULT_UNIQUE_VALUES,
                    [DEFAULT_MAX_TOTAL_COST, DEFAULT_COST_EXPONENT],
                    DEFAULT_NAMESPACE,
                    DEFAULT_PARAMS_SIGNATURE
                )
            }).to.throw

            expect(() => {
                return contractInstance.create(
                    [ProcessMode.make({}), ProcessEnvelopeType.make({})],
                    [DEFAULT_METADATA_CONTENT_HASHED_URI, DEFAULT_MERKLE_ROOT, ""],
                    DEFAULT_START_BLOCK,
                    DEFAULT_BLOCK_COUNT,
                    [DEFAULT_QUESTION_COUNT, DEFAULT_MAX_VOTE_OVERWRITES, DEFAULT_MAX_VALUE],
                    DEFAULT_UNIQUE_VALUES,
                    [DEFAULT_MAX_TOTAL_COST, DEFAULT_COST_EXPONENT],
                    DEFAULT_NAMESPACE,
                    DEFAULT_PARAMS_SIGNATURE
                )
            }).to.throw
        })

        it("should fail if questionCount is zero", () => {
            expect(() => {
                return contractInstance.create(
                    [ProcessMode.make({}), ProcessEnvelopeType.make({})],
                    [DEFAULT_METADATA_CONTENT_HASHED_URI, DEFAULT_MERKLE_ROOT, DEFAULT_MERKLE_TREE_CONTENT_HASHED_URI],
                    DEFAULT_START_BLOCK,
                    DEFAULT_BLOCK_COUNT,
                    [0, DEFAULT_MAX_VOTE_OVERWRITES, DEFAULT_MAX_VALUE],
                    DEFAULT_UNIQUE_VALUES,
                    [DEFAULT_MAX_TOTAL_COST, DEFAULT_COST_EXPONENT],
                    DEFAULT_NAMESPACE,
                    DEFAULT_PARAMS_SIGNATURE
                )
            }).to.throw
        })

        it("should fail if allowVoteOverwrite is set but maxVoteOverwrites is zero", () => {
            expect(() => {
                return contractInstance.create(
                    [ProcessMode.make({ allowVoteOverwrite: true }), ProcessEnvelopeType.make({})],
                    [DEFAULT_METADATA_CONTENT_HASHED_URI, DEFAULT_MERKLE_ROOT, DEFAULT_MERKLE_TREE_CONTENT_HASHED_URI],
                    DEFAULT_START_BLOCK,
                    DEFAULT_BLOCK_COUNT,
                    [DEFAULT_QUESTION_COUNT, 0, DEFAULT_MAX_VALUE],
                    DEFAULT_UNIQUE_VALUES,
                    [DEFAULT_MAX_TOTAL_COST, DEFAULT_COST_EXPONENT],
                    DEFAULT_NAMESPACE,
                    DEFAULT_PARAMS_SIGNATURE
                )
            }).to.throw
        })

        it("should fail if maxValue is zero", () => {
            expect(() => {
                return contractInstance.create(
                    [ProcessMode.make({}), ProcessEnvelopeType.make({})],
                    [DEFAULT_METADATA_CONTENT_HASHED_URI, DEFAULT_MERKLE_ROOT, DEFAULT_MERKLE_TREE_CONTENT_HASHED_URI],
                    DEFAULT_START_BLOCK,
                    DEFAULT_BLOCK_COUNT,
                    [DEFAULT_QUESTION_COUNT, DEFAULT_MAX_VOTE_OVERWRITES, DEFAULT_MAX_VALUE],
                    DEFAULT_UNIQUE_VALUES,
                    [DEFAULT_MAX_TOTAL_COST, DEFAULT_COST_EXPONENT],
                    DEFAULT_NAMESPACE,
                    DEFAULT_PARAMS_SIGNATURE
                )
            }).to.throw
        })

        it("should not increase the processCount of the entity on error", async () => {
            const prev = Number(await contractInstance.getEntityProcessCount(entityAccount.address))
            expect(prev).to.eq(1)

            try {
                tx = await contractInstance.create(
                    [ProcessMode.make({}), ProcessEnvelopeType.make({})],
                    ["", "", ""],
                    0,
                    0,
                    [0, 0, 0],
                    DEFAULT_UNIQUE_VALUES,
                    [DEFAULT_MAX_TOTAL_COST, DEFAULT_COST_EXPONENT],
                    DEFAULT_NAMESPACE,
                    DEFAULT_PARAMS_SIGNATURE
                )
                await tx.wait()

                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert/, "The transaction threw an unexpected error:\n" + err.message)
            }

            const current = Number(await contractInstance.getEntityProcessCount(entityAccount.address))

            expect(current).to.eq(prev, "processCount should not have changed")
        })
    })

    describe("should add a validator", () => {
        const validatorPublicKey = "0x1234"
        const validatorPublicKey2 = "0x4321"

        it("only when the contract owner requests it", async () => {
            expect(await contractInstance.isValidator(validatorPublicKey)).to.be.false

            // Register a validator
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addValidator(validatorPublicKey)
            await tx.wait()

            // Get validator list
            const result2 = await contractInstance.getValidators()
            expect(result2.length).to.eq(1)
            expect(result2).to.deep.eq([validatorPublicKey])

            // Check validator
            expect(await contractInstance.isValidator(validatorPublicKey)).to.be.true

            // Attempt to add a validator by someone else
            try {
                contractInstance = contractInstance.connect(randomAccount1.wallet) as any
                tx = await contractInstance.addValidator(validatorPublicKey2)
                await tx.wait()
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert/, "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get validator list
            const result3 = await contractInstance.getValidators()
            expect(result3.length).to.eq(1)
            expect(result3).to.deep.eq([validatorPublicKey])

            // Check validator
            expect(await contractInstance.isValidator(validatorPublicKey2)).to.be.false
        })

        it("should add the validator public key to the validator list", async () => {
            // Register validator 1
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addValidator(validatorPublicKey)
            await tx.wait()

            // Get validator list
            const result2 = await contractInstance.getValidators()
            expect(result2.length).to.eq(1)
            expect(result2).to.deep.eq([validatorPublicKey])

            // Check validator
            expect(await contractInstance.isValidator(validatorPublicKey)).to.be.true

            // Adding validator #2
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addValidator(validatorPublicKey2)
            await tx.wait()

            // Get validator list
            const result4 = await contractInstance.getValidators()
            expect(result4.length).to.eq(2)
            expect(result4).to.deep.eq([validatorPublicKey, validatorPublicKey2])

            // Check validator
            expect(await contractInstance.isValidator(validatorPublicKey2)).to.be.true
        })

        it("should not add the validator public key to the validator list if exists", async () => {
            // Register validator 1
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addValidator(validatorPublicKey)
            await tx.wait()

            // Get validator list
            const result2 = await contractInstance.getValidators()
            expect(result2.length).to.eq(1)
            expect(result2).to.deep.eq([validatorPublicKey])

            // Adding validator #2
            try {
                contractInstance = contractInstance.connect(deployAccount.wallet) as any
                tx = await contractInstance.addValidator(validatorPublicKey)
                await tx.wait()
                throw new Error("The transaction should have thrown an error but didn't")
            } catch (err) {
                expect(err.message).to.match(/revert/, "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get validator list
            const result3 = await contractInstance.getValidators()
            expect(result3).to.deep.eq([validatorPublicKey])
            expect(result3.length).to.eq(1)

            // Still valid
            expect(await contractInstance.isValidator(validatorPublicKey)).to.be.true
        })

        it("should emit an event", async () => {
            // Register validator
            contractInstance = contractInstance.connect(deployAccount.wallet) as any

            const result: { validatorPublicKey: string } = await new Promise((resolve, reject) => {
                contractInstance.on("ValidatorAdded", (validatorPublicKey: string) => {
                    resolve({ validatorPublicKey })
                })
                contractInstance.addValidator(validatorPublicKey).then(tx => tx.wait()).catch(reject)
            })

            expect(result).to.be.ok
            expect(result.validatorPublicKey).to.equal(validatorPublicKey)
        }).timeout(7000)
    })

    describe("should remove a validator", () => {

        const validatorPublicKey = "0x1234"

        it("only when the contract owner account requests it", async () => {
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addValidator(validatorPublicKey)
            await tx.wait()

            // Get validator list
            const result1 = await contractInstance.getValidators()
            expect(result1.length).to.eq(1)

            // Attempt to disable the validator from someone else
            try {
                contractInstance = contractInstance.connect(randomAccount1.wallet) as any
                tx = await contractInstance.removeValidator(0, validatorPublicKey)
                await tx.wait()
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert/, "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get validator list
            const result2 = await contractInstance.getValidators()
            expect(result2.length).to.eq(1)
            expect(result2).to.deep.eq([validatorPublicKey])

            // Check validator
            expect(await contractInstance.isValidator(validatorPublicKey)).to.be.true

            // Disable validator from the owner
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.removeValidator(0, validatorPublicKey)
            await tx.wait()

            // Get validator list
            const result4 = await contractInstance.getValidators()
            expect(result4.length).to.eq(0)
            expect(result4).to.deep.eq([])
        })

        it("should fail if the idx does not match validatorPublicKey", async () => {
            const nonExistingValidatorPublicKey = "0x123123"

            contractInstance = contractInstance.connect(deployAccount.wallet) as any

            // Register a validator
            tx = await contractInstance.addValidator(validatorPublicKey)
            await tx.wait()

            // Attempt to disable mismatching validator
            try {
                contractInstance = contractInstance.connect(randomAccount1.wallet) as any
                tx = await contractInstance.removeValidator(0, nonExistingValidatorPublicKey)
                await tx.wait()
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert/, "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get validator list
            expect(await contractInstance.getValidators()).to.deep.eq([validatorPublicKey])

            // Check validators
            expect(await contractInstance.isValidator(validatorPublicKey)).to.be.true
            expect(await contractInstance.isValidator(nonExistingValidatorPublicKey)).to.be.false

            // Attempt to disable non-existing validator
            try {
                contractInstance = contractInstance.connect(randomAccount1.wallet) as any
                tx = await contractInstance.removeValidator(5, validatorPublicKey)
                await tx.wait()
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert/, "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get validator list
            const result4 = await contractInstance.getValidators()
            expect(result4.length).to.eq(1)
            expect(result4).to.deep.eq([validatorPublicKey])

            // Check validator
            expect(await contractInstance.isValidator(validatorPublicKey)).to.be.true
        })

        it("should emit an event", async () => {
            // Register validator
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addValidator(validatorPublicKey)
            await tx.wait()

            const result: { validatorPublicKey: string } = await new Promise((resolve, reject) => {
                contractInstance.on("ValidatorRemoved", (validatorPublicKey: string) => {
                    resolve({ validatorPublicKey })
                })
                contractInstance.removeValidator(0, validatorPublicKey).then(tx => tx.wait()).catch(reject)
            })

            expect(result).to.be.ok
            expect(result.validatorPublicKey).to.equal(validatorPublicKey)
        }).timeout(7000)
    })

    describe("should register an oracle", () => {

        it("only when the contract owner requests it", async () => {
            // Check validator
            expect(await contractInstance.isOracle(authorizedOracleAccount1.address)).to.be.false

            // Register a oracle
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addOracle(authorizedOracleAccount1.address)
            await tx.wait()

            // Get oracle list
            const result2 = await contractInstance.getOracles()
            expect(result2.length).to.eq(1)
            expect(result2).to.deep.eq([authorizedOracleAccount1.address])

            // Check oracle
            expect(await contractInstance.isOracle(authorizedOracleAccount1.address)).to.be.true

            // Attempt to add a oracle by someone else
            try {
                contractInstance = contractInstance.connect(randomAccount2.wallet) as any
                tx = await contractInstance.addOracle(authorizedOracleAccount2.address)
                await tx.wait()
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert/, "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get oracle list
            const result3 = await contractInstance.getOracles()
            expect(result3.length).to.eq(1)
            expect(result3).to.deep.eq([authorizedOracleAccount1.address])

            // Check oracle
            expect(await contractInstance.isOracle(authorizedOracleAccount1.address)).to.be.true
            expect(await contractInstance.isOracle(authorizedOracleAccount2.address)).to.be.false
        })

        it("should add the oracle address to the oracle list", async () => {
            // Register oracle 1
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addOracle(authorizedOracleAccount1.address)
            await tx.wait()

            // Get oracle list
            const result2 = await contractInstance.getOracles()
            expect(result2.length).to.eq(1)
            expect(result2).to.deep.eq([authorizedOracleAccount1.address])

            // Check oracle
            expect(await contractInstance.isOracle(authorizedOracleAccount1.address)).to.be.true

            // Adding oracle #2
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addOracle(authorizedOracleAccount2.address)
            await tx.wait()

            // Get oracle list
            const result4 = await contractInstance.getOracles()
            expect(result4.length).to.eq(2)
            expect(result4).to.deep.eq([authorizedOracleAccount1.address, authorizedOracleAccount2.address])

            // Check oracle
            expect(await contractInstance.isOracle(authorizedOracleAccount1.address)).to.be.true
            expect(await contractInstance.isOracle(authorizedOracleAccount2.address)).to.be.true
        })

        it("should not add the oracle address to the oracle list if exists", async () => {
            // Register oracle 1
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addOracle(authorizedOracleAccount1.address)
            await tx.wait()

            // Get oracle list
            const result2 = await contractInstance.getOracles()
            expect(result2.length).to.eq(1)
            expect(result2).to.deep.eq([authorizedOracleAccount1.address])

            // Check oracle
            expect(await contractInstance.isOracle(authorizedOracleAccount1.address)).to.be.true

            // Adding oracle #2
            try {
                contractInstance = contractInstance.connect(deployAccount.wallet) as any
                tx = await contractInstance.addOracle(authorizedOracleAccount1.address)
                await tx.wait()
                throw new Error("The transaction should have thrown an error but didn't")
            } catch (err) {
                expect(err.message).to.match(/revert/, "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get oracle list
            const result3 = await contractInstance.getOracles()
            expect(result3.length).to.eq(1)
            expect(result3).to.deep.eq([authorizedOracleAccount1.address])

            // Check oracle
            expect(await contractInstance.isOracle(authorizedOracleAccount1.address)).to.be.true
        })

        it("should emit an event", async () => {
            contractInstance = contractInstance.connect(deployAccount.wallet) as any

            const result: { oracleAddress: string } = await new Promise((resolve, reject) => {
                contractInstance.on("OracleAdded", (oracleAddress: string) => {
                    resolve({ oracleAddress })
                })
                contractInstance.addOracle(authorizedOracleAccount1.address).then(tx => tx.wait()).catch(reject)
            })

            expect(result).to.be.ok
            expect(result.oracleAddress).to.equal(authorizedOracleAccount1.address)
        }).timeout(7000)
    })

    describe("should remove an oracle", () => {

        it("only when the contract owner requests it", async () => {
            // Check oracle
            expect(await contractInstance.isOracle(authorizedOracleAccount1.address)).to.be.false

            // Register oracle
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addOracle(authorizedOracleAccount1.address)
            await tx.wait()

            // Check oracle
            expect(await contractInstance.isOracle(authorizedOracleAccount1.address)).to.be.true

            // Attempt to disable the oracle from someone else
            try {
                contractInstance = contractInstance.connect(randomAccount2.wallet) as any
                tx = await contractInstance.removeOracle(0, authorizedOracleAccount1.address)
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert/, "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get oracle list
            const result2 = await contractInstance.getOracles()
            expect(result2.length).to.eq(1)
            expect(result2).to.deep.eq([authorizedOracleAccount1.address])

            // Check oracle
            expect(await contractInstance.isOracle(authorizedOracleAccount1.address)).to.be.true

            // Disable oracle from the creator
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            const result3 = await contractInstance.removeOracle(0, authorizedOracleAccount1.address)

            // Get oracle list
            const result4 = await contractInstance.getOracles()
            expect(result4.length).to.eq(0)
            expect(result4).to.deep.eq([])

            // Check oracle
            expect(await contractInstance.isOracle(authorizedOracleAccount1.address)).to.be.false
        })

        it("should fail if the idx is not valid", async () => {
            // Check oracle
            expect(await contractInstance.isOracle(authorizedOracleAccount1.address)).to.be.false

            // Register a oracle
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addOracle(authorizedOracleAccount1.address)
            await tx.wait()

            // Register a oracle
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addOracle(authorizedOracleAccount2.address)
            await tx.wait()

            // Attempt to disable non-existing oracle
            try {
                contractInstance = contractInstance.connect(deployAccount.wallet) as any
                tx = await contractInstance.removeOracle(5, authorizedOracleAccount2.address)
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert/, "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get oracle list
            const result3 = await contractInstance.getOracles()
            expect(result3.length).to.eq(2)
            expect(result3).to.deep.eq([authorizedOracleAccount1.address, authorizedOracleAccount2.address])

            // Check oracle
            expect(await contractInstance.isOracle(authorizedOracleAccount1.address)).to.be.true
            expect(await contractInstance.isOracle(authorizedOracleAccount1.address)).to.be.true
        })

        it("should fail if the idx does not match oracleAddress", async () => {
            // Register a oracle
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addOracle(authorizedOracleAccount1.address)
            await tx.wait()

            // Register a oracle
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addOracle(authorizedOracleAccount2.address)
            await tx.wait()

            // Attempt to disable non-existing oracle
            try {
                contractInstance = contractInstance.connect(deployAccount.wallet) as any
                tx = await contractInstance.removeOracle(1, randomAccount2.address)
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert/, "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get oracle list
            const result4 = await contractInstance.getOracles()
            expect(result4.length).to.eq(2)
            expect(result4).to.deep.eq([authorizedOracleAccount1.address, authorizedOracleAccount2.address])

            // Check oracle
            expect(await contractInstance.isOracle(authorizedOracleAccount1.address)).to.be.true
            expect(await contractInstance.isOracle(authorizedOracleAccount1.address)).to.be.true
        })

        it("should emit an event", async () => {
            contractInstance = contractInstance.connect(deployAccount.wallet) as any

            // Register oracle
            tx = await contractInstance.addOracle(authorizedOracleAccount1.address)
            await tx.wait()

            const result: { oracleAddress: string } = await new Promise((resolve, reject) => {
                contractInstance.on("OracleRemoved", (oracleAddress: string) => {
                    resolve({ oracleAddress })
                })
                contractInstance.removeOracle(0, authorizedOracleAccount1.address).then(tx => tx.wait()).catch(reject)
            })

            expect(result).to.be.ok
            expect(result.oracleAddress).to.equal(authorizedOracleAccount1.address)
        }).timeout(7000)
    })

    describe("Process Status", () => {
        beforeEach(async () => {
            contractInstance = await new ProcessBuilder().withMode(ProcessMode.make({ autoStart: true })).build()
        })

        it("should create paused processes by default", async () => {
            contractInstance = await new ProcessBuilder().withMode(ProcessMode.make({ autoStart: false })).build()
            const processId1 = await contractInstance.getProcessId(entityAccount.address, 0)

            // one is already created by the builder

            const processData1 = unwrapProcessState(await contractInstance.get(processId1))
            expect(processData1.status).to.eq(ProcessStatus.PAUSED, "The process should be paused")
        })

        it("should create processes in ready status when autoStart is set", async () => {
            contractInstance = await new ProcessBuilder().withMode(ProcessMode.make({ autoStart: true })).build()
            const processId1 = await contractInstance.getProcessId(entityAccount.address, 0)

            const processData1 = unwrapProcessState(await contractInstance.get(processId1))
            expect(processData1.status).to.eq(ProcessStatus.READY, "The process should be ready")
        })

        it("should reject invalid status codes", async () => {
            // interruptible
            let mode = ProcessMode.make({ autoStart: true, interruptible: true })
            contractInstance = await new ProcessBuilder().withMode(mode).build()
            const processId1 = await contractInstance.getProcessId(entityAccount.address, 0)
            // one is already created by the builder

            const processData0 = unwrapProcessState(await contractInstance.get(processId1))
            expect(processData0.status).to.eq(ProcessStatus.READY, "The process should be ready")

            for (let code = 5; code < 8; code++) {
                // Try to set it to invalid values
                try {
                    tx = await contractInstance.setStatus(processId1, code as any)
                    await tx.wait()
                    throw new Error("The transaction should have thrown an error but didn't")
                }
                catch (err) {
                    expect(err.message).to.match(/revert/, "The transaction threw an unexpected error:\n" + err.message)
                }

                const processData1 = unwrapProcessState(await contractInstance.get(processId1))
                expect(processData1.mode).to.eq(mode)
                expect(processData1.entityAddress).to.eq(entityAccount.address)
                expect(processData1.status).to.eq(ProcessStatus.READY, "The process should remain ready")
            }
        })

        describe("non-interruptible", () => {
            it("should allow paused => ready (the first time) if autoStart is not set", async () => {
                // non-interruptible
                let mode = ProcessMode.make({ autoStart: false, interruptible: false })
                contractInstance = await new ProcessBuilder().withMode(mode).build()
                const processId1 = await contractInstance.getProcessId(entityAccount.address, 0)
                // one is already created by the builder

                const processData0 = unwrapProcessState(await contractInstance.get(processId1))
                expect(processData0.status).to.eq(ProcessStatus.PAUSED, "The process should be paused")

                // Set it to ready
                tx = await contractInstance.setStatus(processId1, ProcessStatus.READY)
                await tx.wait()

                const processData1 = unwrapProcessState(await contractInstance.get(processId1))
                expect(processData1.mode).to.eq(mode)
                expect(processData1.entityAddress).to.eq(entityAccount.address)
                expect(processData1.status).to.eq(ProcessStatus.READY, "The process should be ready")

                // Try to set it back to paused
                try {
                    tx = await contractInstance.setStatus(processId1, ProcessStatus.PAUSED)
                    await tx.wait()
                    throw new Error("The transaction should have thrown an error but didn't")
                }
                catch (err) {
                    expect(err.message).to.match(/revert Not interruptible/, "The transaction threw an unexpected error:\n" + err.message)
                }

                const processData2 = unwrapProcessState(await contractInstance.get(processId1))
                expect(processData2.mode).to.eq(mode)
                expect(processData2.entityAddress).to.eq(entityAccount.address)
                expect(processData2.status).to.eq(ProcessStatus.READY, "The process should remain ready")

                // Try to set it back to paused from someone else
                try {
                    contractInstance = contractInstance.connect(randomAccount1.wallet) as ProcessContractMethods & Contract
                    tx = await contractInstance.setStatus(processId1, ProcessStatus.PAUSED)
                    await tx.wait()
                    throw new Error("The transaction should have thrown an error but didn't")
                }
                catch (err) {
                    expect(err.message).to.match(/revert Invalid entity/, "The transaction threw an unexpected error:\n" + err.message)
                }

                const processData3 = unwrapProcessState(await contractInstance.get(processId1))
                expect(processData3.mode).to.eq(mode)
                expect(processData3.entityAddress).to.eq(entityAccount.address)
                expect(processData3.status).to.eq(ProcessStatus.READY, "The process should remain ready")

                // Try to set it back to paused from an oracle
                try {
                    contractInstance = contractInstance.connect(authorizedOracleAccount1.wallet) as ProcessContractMethods & Contract
                    tx = await contractInstance.setStatus(processId1, ProcessStatus.PAUSED)
                    await tx.wait()
                    throw new Error("The transaction should have thrown an error but didn't")
                }
                catch (err) {
                    expect(err.message).to.match(/revert Invalid entity/, "The transaction threw an unexpected error:\n" + err.message)
                }

                const processData4 = unwrapProcessState(await contractInstance.get(processId1))
                expect(processData4.mode).to.eq(mode)
                expect(processData4.entityAddress).to.eq(entityAccount.address)
                expect(processData4.status).to.eq(ProcessStatus.READY, "The process should remain ready")
            })

            it("should reject any other status update", async () => {
                // non-interruptible
                let mode = ProcessMode.make({ autoStart: true, interruptible: false })
                contractInstance = await new ProcessBuilder().withMode(mode).build()
                const processId1 = await contractInstance.getProcessId(entityAccount.address, 0)
                // one is already created by the builder

                const processData0 = unwrapProcessState(await contractInstance.get(processId1))
                expect(processData0.status).to.eq(ProcessStatus.READY, "The process should be ready")

                // Try to set it to ready (it already is)
                try {
                    contractInstance = contractInstance.connect(entityAccount.wallet) as ProcessContractMethods & Contract
                    tx = await contractInstance.setStatus(processId1, ProcessStatus.READY)
                    await tx.wait()
                    throw new Error("The transaction should have thrown an error but didn't")
                }
                catch (err) {
                    expect(err.message).to.match(/revert Not interruptible/, "The transaction threw an unexpected error:\n" + err.message)
                }

                const processData2 = unwrapProcessState(await contractInstance.get(processId1))
                expect(processData2.mode).to.eq(mode)
                expect(processData2.entityAddress).to.eq(entityAccount.address)
                expect(processData2.status).to.eq(ProcessStatus.READY, "The process should remain ready")

                // Try to set it to paused
                try {
                    contractInstance = contractInstance.connect(entityAccount.wallet) as ProcessContractMethods & Contract
                    tx = await contractInstance.setStatus(processId1, ProcessStatus.PAUSED)
                    await tx.wait()
                    throw new Error("The transaction should have thrown an error but didn't")
                }
                catch (err) {
                    expect(err.message).to.match(/revert Not interruptible/, "The transaction threw an unexpected error:\n" + err.message)
                }

                const processData3 = unwrapProcessState(await contractInstance.get(processId1))
                expect(processData3.mode).to.eq(mode)
                expect(processData3.entityAddress).to.eq(entityAccount.address)
                expect(processData3.status).to.eq(ProcessStatus.READY, "The process should remain ready")

                // Try to set it to ended
                try {
                    contractInstance = contractInstance.connect(entityAccount.wallet) as ProcessContractMethods & Contract
                    tx = await contractInstance.setStatus(processId1, ProcessStatus.ENDED)
                    await tx.wait()
                    throw new Error("The transaction should have thrown an error but didn't")
                }
                catch (err) {
                    expect(err.message).to.match(/revert Not interruptible/, "The transaction threw an unexpected error:\n" + err.message)
                }

                const processData4 = unwrapProcessState(await contractInstance.get(processId1))
                expect(processData4.mode).to.eq(mode)
                expect(processData4.entityAddress).to.eq(entityAccount.address)
                expect(processData4.status).to.eq(ProcessStatus.READY, "The process should remain ready")

                // Try to set it to canceled
                try {
                    contractInstance = contractInstance.connect(entityAccount.wallet) as ProcessContractMethods & Contract
                    tx = await contractInstance.setStatus(processId1, ProcessStatus.CANCELED)
                    await tx.wait()
                    throw new Error("The transaction should have thrown an error but didn't")
                }
                catch (err) {
                    expect(err.message).to.match(/revert Not interruptible/, "The transaction threw an unexpected error:\n" + err.message)
                }

                const processData5 = unwrapProcessState(await contractInstance.get(processId1))
                expect(processData5.mode).to.eq(mode)
                expect(processData5.entityAddress).to.eq(entityAccount.address)
                expect(processData5.status).to.eq(ProcessStatus.READY, "The process should remain ready")

                // Try to set it to results
                try {
                    contractInstance = contractInstance.connect(entityAccount.wallet) as ProcessContractMethods & Contract
                    tx = await contractInstance.setStatus(processId1, ProcessStatus.RESULTS)
                    await tx.wait()
                    throw new Error("The transaction should have thrown an error but didn't")
                }
                catch (err) {
                    expect(err.message).to.match(/revert Invalid status code/, "The transaction threw an unexpected error:\n" + err.message)
                }

                const processData6 = unwrapProcessState(await contractInstance.get(processId1))
                expect(processData6.mode).to.eq(mode)
                expect(processData6.entityAddress).to.eq(entityAccount.address)
                expect(processData6.status).to.eq(ProcessStatus.READY, "The process should remain ready")
            })
        })
        describe("interruptible", () => {
            describe("from ready", () => {
                it("should fail if setting to ready", async () => {
                    // interruptible
                    let mode = ProcessMode.make({ autoStart: true, interruptible: true })
                    contractInstance = await new ProcessBuilder().withMode(mode).build()
                    const processId1 = await contractInstance.getProcessId(entityAccount.address, 0)
                    // one is already created by the builder

                    const processData0 = unwrapProcessState(await contractInstance.get(processId1))
                    expect(processData0.status).to.eq(ProcessStatus.READY, "The process should be ready")

                    // Try to set it to Ready (it already is)
                    try {
                        tx = await contractInstance.setStatus(processId1, ProcessStatus.READY)
                        await tx.wait()
                        throw new Error("The transaction should have thrown an error but didn't")
                    }
                    catch (err) {
                        expect(err.message).to.match(/revert Status must change/, "The transaction threw an unexpected error:\n" + err.message)
                    }

                    const processData2 = unwrapProcessState(await contractInstance.get(processId1))
                    expect(processData2.mode).to.eq(mode)
                    expect(processData2.entityAddress).to.eq(entityAccount.address)
                    expect(processData2.status).to.eq(ProcessStatus.READY, "The process should remain ready")
                })

                it("should allow to set to paused", async () => {
                    // interruptible
                    let mode = ProcessMode.make({ autoStart: true, interruptible: true })
                    contractInstance = await new ProcessBuilder().withMode(mode).build()
                    const processId1 = await contractInstance.getProcessId(entityAccount.address, 0)
                    // one is already created by the builder

                    const processData0 = unwrapProcessState(await contractInstance.get(processId1))
                    expect(processData0.status).to.eq(ProcessStatus.READY, "The process should be ready")

                    // Set it to paused
                    tx = await contractInstance.setStatus(processId1, ProcessStatus.PAUSED)
                    await tx.wait()

                    const processData1 = unwrapProcessState(await contractInstance.get(processId1))
                    expect(processData1.mode).to.eq(mode)
                    expect(processData1.entityAddress).to.eq(entityAccount.address)
                    expect(processData1.status).to.eq(ProcessStatus.PAUSED, "The process should be paused")

                    // Set back to ready
                    tx = await contractInstance.setStatus(processId1, ProcessStatus.READY)
                    await tx.wait()

                    const processData2 = unwrapProcessState(await contractInstance.get(processId1))
                    expect(processData2.mode).to.eq(mode)
                    expect(processData2.entityAddress).to.eq(entityAccount.address)
                    expect(processData2.status).to.eq(ProcessStatus.READY, "The process should be ready")
                })

                it("should allow to set to ended", async () => {
                    // interruptible
                    let mode = ProcessMode.make({ autoStart: true, interruptible: true })
                    contractInstance = await new ProcessBuilder().withMode(mode).build()
                    const processId1 = await contractInstance.getProcessId(entityAccount.address, 0)
                    // one is already created by the builder

                    const processData0 = unwrapProcessState(await contractInstance.get(processId1))
                    expect(processData0.status).to.eq(ProcessStatus.READY, "The process should be ready")

                    // Set it to ended
                    tx = await contractInstance.setStatus(processId1, ProcessStatus.ENDED)
                    await tx.wait()

                    const processData1 = unwrapProcessState(await contractInstance.get(processId1))
                    expect(processData1.mode).to.eq(mode)
                    expect(processData1.entityAddress).to.eq(entityAccount.address)
                    expect(processData1.status).to.eq(ProcessStatus.ENDED, "The process should be ended")

                    // Try to set it back to ready
                    try {
                        tx = await contractInstance.setStatus(processId1, ProcessStatus.READY)
                        await tx.wait()
                        throw new Error("The transaction should have thrown an error but didn't")
                    }
                    catch (err) {
                        expect(err.message).to.match(/revert Process terminated/, "The transaction threw an unexpected error:\n" + err.message)
                    }

                    const processData2 = unwrapProcessState(await contractInstance.get(processId1))
                    expect(processData2.mode).to.eq(mode)
                    expect(processData2.entityAddress).to.eq(entityAccount.address)
                    expect(processData2.status).to.eq(ProcessStatus.ENDED, "The process should remain ended")
                })

                it("should allow to set to canceled", async () => {
                    // interruptible
                    let mode = ProcessMode.make({ autoStart: true, interruptible: true })
                    contractInstance = await new ProcessBuilder().withMode(mode).build()
                    const processId1 = await contractInstance.getProcessId(entityAccount.address, 0)
                    // one is already created by the builder

                    const processData0 = unwrapProcessState(await contractInstance.get(processId1))
                    expect(processData0.status).to.eq(ProcessStatus.READY, "The process should be ready")

                    // Set it to canceled
                    tx = await contractInstance.setStatus(processId1, ProcessStatus.CANCELED)
                    await tx.wait()

                    const processData1 = unwrapProcessState(await contractInstance.get(processId1))
                    expect(processData1.mode).to.eq(mode)
                    expect(processData1.entityAddress).to.eq(entityAccount.address)
                    expect(processData1.status).to.eq(ProcessStatus.CANCELED, "The process should be canceled")

                    // Try to set it back to ready
                    try {
                        tx = await contractInstance.setStatus(processId1, ProcessStatus.READY)
                        await tx.wait()
                        throw new Error("The transaction should have thrown an error but didn't")
                    }
                    catch (err) {
                        expect(err.message).to.match(/revert Process terminated/, "The transaction threw an unexpected error:\n" + err.message)
                    }

                    const processData2 = unwrapProcessState(await contractInstance.get(processId1))
                    expect(processData2.mode).to.eq(mode)
                    expect(processData2.entityAddress).to.eq(entityAccount.address)
                    expect(processData2.status).to.eq(ProcessStatus.CANCELED, "The process should remain canceled")
                })

                it("should fail if setting to results", async () => {
                    // interruptible
                    let mode = ProcessMode.make({ autoStart: true, interruptible: true })
                    contractInstance = await new ProcessBuilder().withMode(mode).build()
                    const processId1 = await contractInstance.getProcessId(entityAccount.address, 0)
                    // one is already created by the builder

                    const processData0 = unwrapProcessState(await contractInstance.get(processId1))
                    expect(processData0.status).to.eq(ProcessStatus.READY, "The process should be ready")

                    // Try to set it back to results
                    try {
                        tx = await contractInstance.setStatus(processId1, ProcessStatus.RESULTS)
                        await tx.wait()
                        throw new Error("The transaction should have thrown an error but didn't")
                    }
                    catch (err) {
                        expect(err.message).to.match(/revert Invalid status code/, "The transaction threw an unexpected error:\n" + err.message)
                    }

                    const processData2 = unwrapProcessState(await contractInstance.get(processId1))
                    expect(processData2.mode).to.eq(mode)
                    expect(processData2.entityAddress).to.eq(entityAccount.address)
                    expect(processData2.status).to.eq(ProcessStatus.READY, "The process should remain ready")
                })

                it("should fail if someone else tries to update the status", async () => {
                    for (let account of [randomAccount1, randomAccount2, authorizedOracleAccount1]) {
                        // interruptible
                        let mode = ProcessMode.make({ autoStart: true, interruptible: true })
                        contractInstance = await new ProcessBuilder().withMode(mode).build()
                        const processId1 = await contractInstance.getProcessId(entityAccount.address, 0)
                        // one is already created by the builder

                        const processData0 = unwrapProcessState(await contractInstance.get(processId1))
                        expect(processData0.status).to.eq(ProcessStatus.READY, "The process should be ready")

                        // even if the account is an oracle
                        contractInstance = contractInstance.connect(deployAccount.wallet) as any
                        tx = await contractInstance.addOracle(account.address)
                        await tx.wait()

                        // Try to set it to ready (it already is)
                        try {
                            contractInstance = contractInstance.connect(account.wallet) as ProcessContractMethods & Contract
                            tx = await contractInstance.setStatus(processId1, ProcessStatus.READY)
                            await tx.wait()
                            throw new Error("The transaction should have thrown an error but didn't")
                        }
                        catch (err) {
                            expect(err.message).to.match(/revert Invalid entity/, "The transaction threw an unexpected error:\n" + err.message)
                        }

                        const processData2 = unwrapProcessState(await contractInstance.get(processId1))
                        expect(processData2.mode).to.eq(mode)
                        expect(processData2.entityAddress).to.eq(entityAccount.address)
                        expect(processData2.status).to.eq(ProcessStatus.READY, "The process should remain ready")

                        // Try to set it to paused
                        try {
                            contractInstance = contractInstance.connect(account.wallet) as ProcessContractMethods & Contract
                            tx = await contractInstance.setStatus(processId1, ProcessStatus.PAUSED)
                            await tx.wait()
                            throw new Error("The transaction should have thrown an error but didn't")
                        }
                        catch (err) {
                            expect(err.message).to.match(/revert Invalid entity/, "The transaction threw an unexpected error:\n" + err.message)
                        }

                        const processData3 = unwrapProcessState(await contractInstance.get(processId1))
                        expect(processData3.mode).to.eq(mode)
                        expect(processData3.entityAddress).to.eq(entityAccount.address)
                        expect(processData3.status).to.eq(ProcessStatus.READY, "The process should remain ready")

                        // Try to set it to ended
                        try {
                            contractInstance = contractInstance.connect(account.wallet) as ProcessContractMethods & Contract
                            tx = await contractInstance.setStatus(processId1, ProcessStatus.ENDED)
                            await tx.wait()
                            throw new Error("The transaction should have thrown an error but didn't")
                        }
                        catch (err) {
                            expect(err.message).to.match(/revert Invalid entity/, "The transaction threw an unexpected error:\n" + err.message)
                        }

                        const processData4 = unwrapProcessState(await contractInstance.get(processId1))
                        expect(processData4.mode).to.eq(mode)
                        expect(processData4.entityAddress).to.eq(entityAccount.address)
                        expect(processData4.status).to.eq(ProcessStatus.READY, "The process should remain ready")

                        // Try to set it to canceled
                        try {
                            contractInstance = contractInstance.connect(account.wallet) as ProcessContractMethods & Contract
                            tx = await contractInstance.setStatus(processId1, ProcessStatus.CANCELED)
                            await tx.wait()
                            throw new Error("The transaction should have thrown an error but didn't")
                        }
                        catch (err) {
                            expect(err.message).to.match(/revert Invalid entity/, "The transaction threw an unexpected error:\n" + err.message)
                        }

                        const processData5 = unwrapProcessState(await contractInstance.get(processId1))
                        expect(processData5.mode).to.eq(mode)
                        expect(processData5.entityAddress).to.eq(entityAccount.address)
                        expect(processData5.status).to.eq(ProcessStatus.READY, "The process should remain ready")

                        // Try to set it to results
                        try {
                            contractInstance = contractInstance.connect(account.wallet) as ProcessContractMethods & Contract
                            tx = await contractInstance.setStatus(processId1, ProcessStatus.RESULTS)
                            await tx.wait()
                            throw new Error("The transaction should have thrown an error but didn't")
                        }
                        catch (err) {
                            expect(err.message).to.match(/revert Invalid entity/, "The transaction threw an unexpected error:\n" + err.message)
                        }

                        const processData6 = unwrapProcessState(await contractInstance.get(processId1))
                        expect(processData6.mode).to.eq(mode)
                        expect(processData6.entityAddress).to.eq(entityAccount.address)
                        expect(processData6.status).to.eq(ProcessStatus.READY, "The process should remain ready")
                    }
                }).timeout(4000)
            })

            describe("from paused", () => {
                it("should allow to set to ready", async () => {
                    // interruptible
                    let mode = ProcessMode.make({ autoStart: false, interruptible: true })
                    contractInstance = await new ProcessBuilder().withMode(mode).build()
                    const processId1 = await contractInstance.getProcessId(entityAccount.address, 0)
                    // one is already created by the builder

                    const processData0 = unwrapProcessState(await contractInstance.get(processId1))
                    expect(processData0.status).to.eq(ProcessStatus.PAUSED, "The process should be paused")

                    // Set it to ready
                    tx = await contractInstance.setStatus(processId1, ProcessStatus.READY)
                    await tx.wait()

                    const processData1 = unwrapProcessState(await contractInstance.get(processId1))
                    expect(processData1.mode).to.eq(mode)
                    expect(processData1.entityAddress).to.eq(entityAccount.address)
                    expect(processData1.status).to.eq(ProcessStatus.READY, "The process should be ready")

                    // Set back to paused
                    tx = await contractInstance.setStatus(processId1, ProcessStatus.PAUSED)
                    await tx.wait()

                    const processData2 = unwrapProcessState(await contractInstance.get(processId1))
                    expect(processData2.mode).to.eq(mode)
                    expect(processData2.entityAddress).to.eq(entityAccount.address)
                    expect(processData2.status).to.eq(ProcessStatus.PAUSED, "The process should be paused")
                })

                it("should fail if setting to paused", async () => {
                    // interruptible
                    let mode = ProcessMode.make({ autoStart: false, interruptible: true })
                    contractInstance = await new ProcessBuilder().withMode(mode).build()
                    const processId1 = await contractInstance.getProcessId(entityAccount.address, 0)
                    // one is already created by the builder

                    const processData0 = unwrapProcessState(await contractInstance.get(processId1))
                    expect(processData0.status).to.eq(ProcessStatus.PAUSED, "The process should be paused")

                    // Try to set it to paused (it already is)
                    try {
                        tx = await contractInstance.setStatus(processId1, ProcessStatus.PAUSED)
                        await tx.wait()
                        throw new Error("The transaction should have thrown an error but didn't")
                    }
                    catch (err) {
                        expect(err.message).to.match(/revert Status must change/, "The transaction threw an unexpected error:\n" + err.message)
                    }

                    const processData2 = unwrapProcessState(await contractInstance.get(processId1))
                    expect(processData2.mode).to.eq(mode)
                    expect(processData2.entityAddress).to.eq(entityAccount.address)
                    expect(processData2.status).to.eq(ProcessStatus.PAUSED, "The process should remain paused")
                })

                it("should allow to set to ended", async () => {
                    // interruptible
                    let mode = ProcessMode.make({ autoStart: false, interruptible: true })
                    contractInstance = await new ProcessBuilder().withMode(mode).build()
                    const processId1 = await contractInstance.getProcessId(entityAccount.address, 0)
                    // one is already created by the builder

                    const processData0 = unwrapProcessState(await contractInstance.get(processId1))
                    expect(processData0.status).to.eq(ProcessStatus.PAUSED, "The process should be paused")

                    // Set it to ended
                    tx = await contractInstance.setStatus(processId1, ProcessStatus.ENDED)
                    await tx.wait()

                    const processData1 = unwrapProcessState(await contractInstance.get(processId1))
                    expect(processData1.mode).to.eq(mode)
                    expect(processData1.entityAddress).to.eq(entityAccount.address)
                    expect(processData1.status).to.eq(ProcessStatus.ENDED, "The process should be ended")

                    // Try to set it back to paused
                    try {
                        tx = await contractInstance.setStatus(processId1, ProcessStatus.PAUSED)
                        await tx.wait()
                        throw new Error("The transaction should have thrown an error but didn't")
                    }
                    catch (err) {
                        expect(err.message).to.match(/revert Process terminated/, "The transaction threw an unexpected error:\n" + err.message)
                    }

                    const processData2 = unwrapProcessState(await contractInstance.get(processId1))
                    expect(processData2.mode).to.eq(mode)
                    expect(processData2.entityAddress).to.eq(entityAccount.address)
                    expect(processData2.status).to.eq(ProcessStatus.ENDED, "The process should remain ended")
                })

                it("should allow to set to canceled", async () => {
                    // interruptible
                    let mode = ProcessMode.make({ autoStart: false, interruptible: true })
                    contractInstance = await new ProcessBuilder().withMode(mode).build()
                    const processId1 = await contractInstance.getProcessId(entityAccount.address, 0)
                    // one is already created by the builder

                    const processData0 = unwrapProcessState(await contractInstance.get(processId1))
                    expect(processData0.status).to.eq(ProcessStatus.PAUSED, "The process should be paused")

                    // Set it to canceled
                    tx = await contractInstance.setStatus(processId1, ProcessStatus.CANCELED)
                    await tx.wait()

                    const processData1 = unwrapProcessState(await contractInstance.get(processId1))
                    expect(processData1.mode).to.eq(mode)
                    expect(processData1.entityAddress).to.eq(entityAccount.address)
                    expect(processData1.status).to.eq(ProcessStatus.CANCELED, "The process should be canceled")

                    // Try to set it back to paused
                    try {
                        tx = await contractInstance.setStatus(processId1, ProcessStatus.PAUSED)
                        await tx.wait()
                        throw new Error("The transaction should have thrown an error but didn't")
                    }
                    catch (err) {
                        expect(err.message).to.match(/revert Process terminated/, "The transaction threw an unexpected error:\n" + err.message)
                    }

                    const processData2 = unwrapProcessState(await contractInstance.get(processId1))
                    expect(processData2.mode).to.eq(mode)
                    expect(processData2.entityAddress).to.eq(entityAccount.address)
                    expect(processData2.status).to.eq(ProcessStatus.CANCELED, "The process should remain canceled")
                })

                it("should fail if setting to results", async () => {
                    // interruptible
                    let mode = ProcessMode.make({ autoStart: false, interruptible: true })
                    contractInstance = await new ProcessBuilder().withMode(mode).build()
                    const processId1 = await contractInstance.getProcessId(entityAccount.address, 0)
                    // one is already created by the builder

                    const processData0 = unwrapProcessState(await contractInstance.get(processId1))
                    expect(processData0.status).to.eq(ProcessStatus.PAUSED, "The process should be paused")

                    // Try to set it back to results
                    try {
                        tx = await contractInstance.setStatus(processId1, ProcessStatus.RESULTS)
                        await tx.wait()
                        throw new Error("The transaction should have thrown an error but didn't")
                    }
                    catch (err) {
                        expect(err.message).to.match(/revert Invalid status code/, "The transaction threw an unexpected error:\n" + err.message)
                    }

                    const processData2 = unwrapProcessState(await contractInstance.get(processId1))
                    expect(processData2.mode).to.eq(mode)
                    expect(processData2.entityAddress).to.eq(entityAccount.address)
                    expect(processData2.status).to.eq(ProcessStatus.PAUSED, "The process should remain paused")
                })

                it("should fail if someone else tries to update the status", async () => {
                    for (let account of [randomAccount1, randomAccount2, authorizedOracleAccount1]) {
                        // interruptible
                        let mode = ProcessMode.make({ autoStart: false, interruptible: true })
                        contractInstance = await new ProcessBuilder().withMode(mode).build()
                        const processId1 = await contractInstance.getProcessId(entityAccount.address, 0)
                        // one is already created by the builder

                        const processData0 = unwrapProcessState(await contractInstance.get(processId1))
                        expect(processData0.status).to.eq(ProcessStatus.PAUSED, "The process should be paused")

                        // even if the account is an oracle
                        contractInstance = contractInstance.connect(deployAccount.wallet) as any
                        tx = await contractInstance.addOracle(account.address)
                        await tx.wait()

                        // Try to set it to ready (it already is)
                        try {
                            contractInstance = contractInstance.connect(account.wallet) as ProcessContractMethods & Contract
                            tx = await contractInstance.setStatus(processId1, ProcessStatus.READY)
                            await tx.wait()
                            throw new Error("The transaction should have thrown an error but didn't")
                        }
                        catch (err) {
                            expect(err.message).to.match(/revert Invalid entity/, "The transaction threw an unexpected error:\n" + err.message)
                        }

                        const processData2 = unwrapProcessState(await contractInstance.get(processId1))
                        expect(processData2.mode).to.eq(mode)
                        expect(processData2.entityAddress).to.eq(entityAccount.address)
                        expect(processData2.status).to.eq(ProcessStatus.PAUSED, "The process should remain paused")

                        // Try to set it to paused
                        try {
                            contractInstance = contractInstance.connect(account.wallet) as ProcessContractMethods & Contract
                            tx = await contractInstance.setStatus(processId1, ProcessStatus.PAUSED)
                            await tx.wait()
                            throw new Error("The transaction should have thrown an error but didn't")
                        }
                        catch (err) {
                            expect(err.message).to.match(/revert Invalid entity/, "The transaction threw an unexpected error:\n" + err.message)
                        }

                        const processData3 = unwrapProcessState(await contractInstance.get(processId1))
                        expect(processData3.mode).to.eq(mode)
                        expect(processData3.entityAddress).to.eq(entityAccount.address)
                        expect(processData3.status).to.eq(ProcessStatus.PAUSED, "The process should remain paused")

                        // Try to set it to ended
                        try {
                            contractInstance = contractInstance.connect(account.wallet) as ProcessContractMethods & Contract
                            tx = await contractInstance.setStatus(processId1, ProcessStatus.ENDED)
                            await tx.wait()
                            throw new Error("The transaction should have thrown an error but didn't")
                        }
                        catch (err) {
                            expect(err.message).to.match(/revert Invalid entity/, "The transaction threw an unexpected error:\n" + err.message)
                        }

                        const processData4 = unwrapProcessState(await contractInstance.get(processId1))
                        expect(processData4.mode).to.eq(mode)
                        expect(processData4.entityAddress).to.eq(entityAccount.address)
                        expect(processData4.status).to.eq(ProcessStatus.PAUSED, "The process should remain paused")

                        // Try to set it to canceled
                        try {
                            contractInstance = contractInstance.connect(account.wallet) as ProcessContractMethods & Contract
                            tx = await contractInstance.setStatus(processId1, ProcessStatus.CANCELED)
                            await tx.wait()
                            throw new Error("The transaction should have thrown an error but didn't")
                        }
                        catch (err) {
                            expect(err.message).to.match(/revert Invalid entity/, "The transaction threw an unexpected error:\n" + err.message)
                        }

                        const processData5 = unwrapProcessState(await contractInstance.get(processId1))
                        expect(processData5.mode).to.eq(mode)
                        expect(processData5.entityAddress).to.eq(entityAccount.address)
                        expect(processData5.status).to.eq(ProcessStatus.PAUSED, "The process should remain paused")

                        // Try to set it to results
                        try {
                            contractInstance = contractInstance.connect(account.wallet) as ProcessContractMethods & Contract
                            tx = await contractInstance.setStatus(processId1, ProcessStatus.RESULTS)
                            await tx.wait()
                            throw new Error("The transaction should have thrown an error but didn't")
                        }
                        catch (err) {
                            expect(err.message).to.match(/revert Invalid entity/, "The transaction threw an unexpected error:\n" + err.message)
                        }

                        const processData6 = unwrapProcessState(await contractInstance.get(processId1))
                        expect(processData6.mode).to.eq(mode)
                        expect(processData6.entityAddress).to.eq(entityAccount.address)
                        expect(processData6.status).to.eq(ProcessStatus.PAUSED, "The process should remain paused")
                    }
                }).timeout(4000)
            })

            describe("from ended", () => {
                it("should never allow the status to be updated [creator]", async () => {
                    // interruptible
                    let mode = ProcessMode.make({ autoStart: false, interruptible: true })
                    contractInstance = await new ProcessBuilder().withMode(mode).build()
                    const processId1 = await contractInstance.getProcessId(entityAccount.address, 0)
                    // one is already created by the builder

                    const processData0 = unwrapProcessState(await contractInstance.get(processId1))
                    expect(processData0.status).to.eq(ProcessStatus.PAUSED, "The process should be paused")

                    // Set it to ended
                    tx = await contractInstance.setStatus(processId1, ProcessStatus.ENDED)
                    await tx.wait()

                    const processData1 = unwrapProcessState(await contractInstance.get(processId1))
                    expect(processData1.mode).to.eq(mode)
                    expect(processData1.entityAddress).to.eq(entityAccount.address)
                    expect(processData1.status).to.eq(ProcessStatus.ENDED, "The process should be ended")

                    // Try to set it to ready
                    try {
                        tx = await contractInstance.setStatus(processId1, ProcessStatus.READY)
                        await tx.wait()
                        throw new Error("The transaction should have thrown an error but didn't")
                    }
                    catch (err) {
                        expect(err.message).to.match(/revert Process terminated/, "The transaction threw an unexpected error:\n" + err.message)
                    }

                    const processData2 = unwrapProcessState(await contractInstance.get(processId1))
                    expect(processData2.entityAddress).to.eq(entityAccount.address)
                    expect(processData2.status).to.eq(ProcessStatus.ENDED, "The process should remain ended")

                    // Try to set it to paused
                    try {
                        tx = await contractInstance.setStatus(processId1, ProcessStatus.PAUSED)
                        await tx.wait()
                        throw new Error("The transaction should have thrown an error but didn't")
                    }
                    catch (err) {
                        expect(err.message).to.match(/revert Process terminated/, "The transaction threw an unexpected error:\n" + err.message)
                    }

                    const processData3 = unwrapProcessState(await contractInstance.get(processId1))
                    expect(processData3.entityAddress).to.eq(entityAccount.address)
                    expect(processData3.status).to.eq(ProcessStatus.ENDED, "The process should remain ended")

                    // Try to set it to canceled
                    try {
                        tx = await contractInstance.setStatus(processId1, ProcessStatus.CANCELED)
                        await tx.wait()
                        throw new Error("The transaction should have thrown an error but didn't")
                    }
                    catch (err) {
                        expect(err.message).to.match(/revert Process terminated/, "The transaction threw an unexpected error:\n" + err.message)
                    }

                    const processData4 = unwrapProcessState(await contractInstance.get(processId1))
                    expect(processData4.entityAddress).to.eq(entityAccount.address)
                    expect(processData4.status).to.eq(ProcessStatus.ENDED, "The process should remain ended")

                    // Try to set it to results
                    try {
                        tx = await contractInstance.setStatus(processId1, ProcessStatus.RESULTS)
                        await tx.wait()
                        throw new Error("The transaction should have thrown an error but didn't")
                    }
                    catch (err) {
                        expect(err.message).to.match(/revert Invalid status code/, "The transaction threw an unexpected error:\n" + err.message)
                    }

                    const processData5 = unwrapProcessState(await contractInstance.get(processId1))
                    expect(processData5.entityAddress).to.eq(entityAccount.address)
                    expect(processData5.status).to.eq(ProcessStatus.ENDED, "The process should remain ended")
                })

                it("should never allow the status to be updated [other account]", async () => {
                    for (let account of [authorizedOracleAccount1, randomAccount1]) {
                        // interruptible
                        let mode = ProcessMode.make({ autoStart: false, interruptible: true })
                        contractInstance = await new ProcessBuilder().withMode(mode).build()
                        const processId1 = await contractInstance.getProcessId(entityAccount.address, 0)
                        // one is already created by the builder

                        const processData0 = unwrapProcessState(await contractInstance.get(processId1))
                        expect(processData0.status).to.eq(ProcessStatus.PAUSED, "The process should be paused")

                        // Set it to ended
                        tx = await contractInstance.setStatus(processId1, ProcessStatus.ENDED)
                        await tx.wait()

                        const processData1 = unwrapProcessState(await contractInstance.get(processId1))
                        expect(processData1.mode).to.eq(mode)
                        expect(processData1.entityAddress).to.eq(entityAccount.address)
                        expect(processData1.status).to.eq(ProcessStatus.ENDED, "The process should be ended")

                        // even if the account is an oracle
                        contractInstance = contractInstance.connect(deployAccount.wallet) as any
                        tx = await contractInstance.addOracle(account.address)
                        await tx.wait()

                        contractInstance = contractInstance.connect(account.wallet) as Contract & ProcessContractMethods

                        // Try to set it to ready
                        try {
                            tx = await contractInstance.setStatus(processId1, ProcessStatus.READY)
                            await tx.wait()
                            throw new Error("The transaction should have thrown an error but didn't")
                        }
                        catch (err) {
                            expect(err.message).to.match(/revert Invalid entity/, "The transaction threw an unexpected error:\n" + err.message)
                        }

                        const processData2 = unwrapProcessState(await contractInstance.get(processId1))
                        expect(processData2.entityAddress).to.eq(entityAccount.address)
                        expect(processData2.status).to.eq(ProcessStatus.ENDED, "The process should remain ended")

                        // Try to set it to paused
                        try {
                            tx = await contractInstance.setStatus(processId1, ProcessStatus.PAUSED)
                            await tx.wait()
                            throw new Error("The transaction should have thrown an error but didn't")
                        }
                        catch (err) {
                            expect(err.message).to.match(/revert Invalid entity/, "The transaction threw an unexpected error:\n" + err.message)
                        }

                        const processData3 = unwrapProcessState(await contractInstance.get(processId1))
                        expect(processData3.entityAddress).to.eq(entityAccount.address)
                        expect(processData3.status).to.eq(ProcessStatus.ENDED, "The process should remain ended")

                        // Try to set it to canceled
                        try {
                            tx = await contractInstance.setStatus(processId1, ProcessStatus.CANCELED)
                            await tx.wait()
                            throw new Error("The transaction should have thrown an error but didn't")
                        }
                        catch (err) {
                            expect(err.message).to.match(/revert Invalid entity/, "The transaction threw an unexpected error:\n" + err.message)
                        }

                        const processData4 = unwrapProcessState(await contractInstance.get(processId1))
                        expect(processData4.entityAddress).to.eq(entityAccount.address)
                        expect(processData4.status).to.eq(ProcessStatus.ENDED, "The process should remain ended")

                        // Try to set it to results
                        try {
                            tx = await contractInstance.setStatus(processId1, ProcessStatus.RESULTS)
                            await tx.wait()
                            throw new Error("The transaction should have thrown an error but didn't")
                        }
                        catch (err) {
                            expect(err.message).to.match(/revert Invalid entity/, "The transaction threw an unexpected error:\n" + err.message)
                        }

                        const processData5 = unwrapProcessState(await contractInstance.get(processId1))
                        expect(processData5.entityAddress).to.eq(entityAccount.address)
                        expect(processData5.status).to.eq(ProcessStatus.ENDED, "The process should remain ended")
                    }
                })
            })

            describe("from canceled", () => {
                it("should never allow the status to be updated [creator]", async () => {
                    // interruptible
                    let mode = ProcessMode.make({ autoStart: false, interruptible: true })
                    contractInstance = await new ProcessBuilder().withMode(mode).build()
                    const processId1 = await contractInstance.getProcessId(entityAccount.address, 0)
                    // one is already created by the builder

                    const processData0 = unwrapProcessState(await contractInstance.get(processId1))
                    expect(processData0.status).to.eq(ProcessStatus.PAUSED, "The process should be paused")

                    // Set it to canceled
                    tx = await contractInstance.setStatus(processId1, ProcessStatus.CANCELED)
                    await tx.wait()

                    const processData1 = unwrapProcessState(await contractInstance.get(processId1))
                    expect(processData1.mode).to.eq(mode)
                    expect(processData1.entityAddress).to.eq(entityAccount.address)
                    expect(processData1.status).to.eq(ProcessStatus.CANCELED, "The process should be canceled")

                    // Try to set it to ready
                    try {
                        tx = await contractInstance.setStatus(processId1, ProcessStatus.READY)
                        await tx.wait()
                        throw new Error("The transaction should have thrown an error but didn't")
                    }
                    catch (err) {
                        expect(err.message).to.match(/revert Process terminated/, "The transaction threw an unexpected error:\n" + err.message)
                    }

                    const processData2 = unwrapProcessState(await contractInstance.get(processId1))
                    expect(processData2.entityAddress).to.eq(entityAccount.address)
                    expect(processData2.status).to.eq(ProcessStatus.CANCELED, "The process should remain canceled")

                    // Try to set it to paused
                    try {
                        tx = await contractInstance.setStatus(processId1, ProcessStatus.PAUSED)
                        await tx.wait()
                        throw new Error("The transaction should have thrown an error but didn't")
                    }
                    catch (err) {
                        expect(err.message).to.match(/revert Process terminated/, "The transaction threw an unexpected error:\n" + err.message)
                    }

                    const processData3 = unwrapProcessState(await contractInstance.get(processId1))
                    expect(processData3.entityAddress).to.eq(entityAccount.address)
                    expect(processData3.status).to.eq(ProcessStatus.CANCELED, "The process should remain canceled")

                    // Try to set it to ended
                    try {
                        tx = await contractInstance.setStatus(processId1, ProcessStatus.ENDED)
                        await tx.wait()
                        throw new Error("The transaction should have thrown an error but didn't")
                    }
                    catch (err) {
                        expect(err.message).to.match(/revert Process terminated/, "The transaction threw an unexpected error:\n" + err.message)
                    }

                    const processData4 = unwrapProcessState(await contractInstance.get(processId1))
                    expect(processData4.entityAddress).to.eq(entityAccount.address)
                    expect(processData4.status).to.eq(ProcessStatus.CANCELED, "The process should remain canceled")

                    // Try to set it to results
                    try {
                        tx = await contractInstance.setStatus(processId1, ProcessStatus.RESULTS)
                        await tx.wait()
                        throw new Error("The transaction should have thrown an error but didn't")
                    }
                    catch (err) {
                        expect(err.message).to.match(/revert Invalid status code/, "The transaction threw an unexpected error:\n" + err.message)
                    }

                    const processData5 = unwrapProcessState(await contractInstance.get(processId1))
                    expect(processData5.entityAddress).to.eq(entityAccount.address)
                    expect(processData5.status).to.eq(ProcessStatus.CANCELED, "The process should remain canceled")
                })

                it("should never allow the status to be updated [other account]", async () => {
                    for (let account of [authorizedOracleAccount1, randomAccount1]) {
                        // interruptible
                        let mode = ProcessMode.make({ autoStart: false, interruptible: true })
                        contractInstance = await new ProcessBuilder().withMode(mode).build()
                        const processId1 = await contractInstance.getProcessId(entityAccount.address, 0)
                        // one is already created by the builder

                        const processData0 = unwrapProcessState(await contractInstance.get(processId1))
                        expect(processData0.status).to.eq(ProcessStatus.PAUSED, "The process should be paused")

                        // Set it to canceled
                        tx = await contractInstance.setStatus(processId1, ProcessStatus.CANCELED)
                        await tx.wait()

                        const processData1 = unwrapProcessState(await contractInstance.get(processId1))
                        expect(processData1.mode).to.eq(mode)
                        expect(processData1.entityAddress).to.eq(entityAccount.address)
                        expect(processData1.status).to.eq(ProcessStatus.CANCELED, "The process should be canceled")

                        // even if the account is an oracle
                        contractInstance = contractInstance.connect(deployAccount.wallet) as any
                        tx = await contractInstance.addOracle(account.address)
                        await tx.wait()

                        contractInstance = contractInstance.connect(account.wallet) as Contract & ProcessContractMethods

                        // Try to set it to ready
                        try {
                            tx = await contractInstance.setStatus(processId1, ProcessStatus.READY)
                            await tx.wait()
                            throw new Error("The transaction should have thrown an error but didn't")
                        }
                        catch (err) {
                            expect(err.message).to.match(/revert Invalid entity/, "The transaction threw an unexpected error:\n" + err.message)
                        }

                        const processData2 = unwrapProcessState(await contractInstance.get(processId1))
                        expect(processData2.entityAddress).to.eq(entityAccount.address)
                        expect(processData2.status).to.eq(ProcessStatus.CANCELED, "The process should remain canceled")

                        // Try to set it to paused
                        try {
                            tx = await contractInstance.setStatus(processId1, ProcessStatus.PAUSED)
                            await tx.wait()
                            throw new Error("The transaction should have thrown an error but didn't")
                        }
                        catch (err) {
                            expect(err.message).to.match(/revert Invalid entity/, "The transaction threw an unexpected error:\n" + err.message)
                        }

                        const processData3 = unwrapProcessState(await contractInstance.get(processId1))
                        expect(processData3.entityAddress).to.eq(entityAccount.address)
                        expect(processData3.status).to.eq(ProcessStatus.CANCELED, "The process should remain canceled")

                        // Try to set it to ended
                        try {
                            tx = await contractInstance.setStatus(processId1, ProcessStatus.ENDED)
                            await tx.wait()
                            throw new Error("The transaction should have thrown an error but didn't")
                        }
                        catch (err) {
                            expect(err.message).to.match(/revert Invalid entity/, "The transaction threw an unexpected error:\n" + err.message)
                        }

                        const processData4 = unwrapProcessState(await contractInstance.get(processId1))
                        expect(processData4.entityAddress).to.eq(entityAccount.address)
                        expect(processData4.status).to.eq(ProcessStatus.CANCELED, "The process should remain canceled")

                        // Try to set it to results
                        try {
                            tx = await contractInstance.setStatus(processId1, ProcessStatus.RESULTS)
                            await tx.wait()
                            throw new Error("The transaction should have thrown an error but didn't")
                        }
                        catch (err) {
                            expect(err.message).to.match(/revert Invalid entity/, "The transaction threw an unexpected error:\n" + err.message)
                        }

                        const processData5 = unwrapProcessState(await contractInstance.get(processId1))
                        expect(processData5.entityAddress).to.eq(entityAccount.address)
                        expect(processData5.status).to.eq(ProcessStatus.CANCELED, "The process should remain canceled")
                    }
                })
            })

            describe("from results", () => {
                it("should never allow the status to be updated [creator]", async () => {
                    // interruptible
                    let mode = ProcessMode.make({ autoStart: false, interruptible: true })
                    contractInstance = await new ProcessBuilder().withMode(mode).build()
                    const processId1 = await contractInstance.getProcessId(entityAccount.address, 0)
                    // one is already created by the builder

                    const processData0 = unwrapProcessState(await contractInstance.get(processId1))
                    expect(processData0.status).to.eq(ProcessStatus.PAUSED, "The process should be paused")

                    // Set it to RESULTS (oracle)
                    contractInstance = contractInstance.connect(deployAccount.wallet) as any
                    tx = await contractInstance.addOracle(authorizedOracleAccount1.address)
                    await tx.wait()
                    contractInstance = contractInstance.connect(authorizedOracleAccount1.wallet) as any
                    tx = await contractInstance.setResults(processId1, "1234")
                    await tx.wait()

                    const processData1 = unwrapProcessState(await contractInstance.get(processId1))
                    expect(processData1.mode).to.eq(mode)
                    expect(processData1.entityAddress).to.eq(entityAccount.address)
                    expect(processData1.status).to.eq(ProcessStatus.RESULTS, "The process should be in results")

                    // (entity)
                    contractInstance = contractInstance.connect(entityAccount.wallet) as any

                    // Try to set it to ready
                    try {
                        tx = await contractInstance.setStatus(processId1, ProcessStatus.READY)
                        await tx.wait()
                        throw new Error("The transaction should have thrown an error but didn't")
                    }
                    catch (err) {
                        expect(err.message).to.match(/revert Process terminated/, "The transaction threw an unexpected error:\n" + err.message)
                    }

                    const processData2 = unwrapProcessState(await contractInstance.get(processId1))
                    expect(processData2.entityAddress).to.eq(entityAccount.address)
                    expect(processData2.status).to.eq(ProcessStatus.RESULTS, "The process should remain in results")

                    // Try to set it to paused
                    try {
                        tx = await contractInstance.setStatus(processId1, ProcessStatus.PAUSED)
                        await tx.wait()
                        throw new Error("The transaction should have thrown an error but didn't")
                    }
                    catch (err) {
                        expect(err.message).to.match(/revert Process terminated/, "The transaction threw an unexpected error:\n" + err.message)
                    }

                    const processData3 = unwrapProcessState(await contractInstance.get(processId1))
                    expect(processData3.entityAddress).to.eq(entityAccount.address)
                    expect(processData3.status).to.eq(ProcessStatus.RESULTS, "The process should remain in results")

                    // Try to set it to ended
                    try {
                        tx = await contractInstance.setStatus(processId1, ProcessStatus.ENDED)
                        await tx.wait()
                        throw new Error("The transaction should have thrown an error but didn't")
                    }
                    catch (err) {
                        expect(err.message).to.match(/revert Process terminated/, "The transaction threw an unexpected error:\n" + err.message)
                    }

                    const processData4 = unwrapProcessState(await contractInstance.get(processId1))
                    expect(processData4.entityAddress).to.eq(entityAccount.address)
                    expect(processData4.status).to.eq(ProcessStatus.RESULTS, "The process should remain in results")

                    // Try to set it to canceled
                    try {
                        tx = await contractInstance.setStatus(processId1, ProcessStatus.CANCELED)
                        await tx.wait()
                        throw new Error("The transaction should have thrown an error but didn't")
                    }
                    catch (err) {
                        expect(err.message).to.match(/revert Process terminated/, "The transaction threw an unexpected error:\n" + err.message)
                    }

                    const processData5 = unwrapProcessState(await contractInstance.get(processId1))
                    expect(processData5.entityAddress).to.eq(entityAccount.address)
                    expect(processData5.status).to.eq(ProcessStatus.RESULTS, "The process should remain in results")
                })

                it("should never allow the status to be updated [other account]", async () => {
                    for (let account of [randomAccount1, randomAccount2]) {
                        let mode = ProcessMode.make({ autoStart: false, interruptible: true })
                        contractInstance = await new ProcessBuilder().withMode(mode).build()
                        const processId1 = await contractInstance.getProcessId(entityAccount.address, 0)
                        // one is already created by the builder

                        const processData0 = unwrapProcessState(await contractInstance.get(processId1))
                        expect(processData0.status).to.eq(ProcessStatus.PAUSED, "The process should be paused")

                        // Set it to RESULTS (oracle)
                        contractInstance = contractInstance.connect(deployAccount.wallet) as any
                        tx = await contractInstance.addOracle(authorizedOracleAccount1.address)
                        await tx.wait()
                        contractInstance = contractInstance.connect(authorizedOracleAccount1.wallet) as any
                        tx = await contractInstance.setResults(processId1, "1234")
                        await tx.wait()

                        const processData1 = unwrapProcessState(await contractInstance.get(processId1))
                        expect(processData1.mode).to.eq(mode)
                        expect(processData1.entityAddress).to.eq(entityAccount.address)
                        expect(processData1.status).to.eq(ProcessStatus.RESULTS, "The process should be in results")

                        // even if the account is an oracle
                        contractInstance = contractInstance.connect(deployAccount.wallet) as any
                        tx = await contractInstance.addOracle(account.address)
                        await tx.wait()

                        // random account
                        contractInstance = contractInstance.connect(account.wallet) as Contract & ProcessContractMethods

                        // Try to set it to ready
                        try {
                            tx = await contractInstance.setStatus(processId1, ProcessStatus.READY)
                            await tx.wait()
                            throw new Error("The transaction should have thrown an error but didn't")
                        }
                        catch (err) {
                            expect(err.message).to.match(/revert Invalid entity/, "The transaction threw an unexpected error:\n" + err.message)
                        }

                        const processData2 = unwrapProcessState(await contractInstance.get(processId1))
                        expect(processData2.entityAddress).to.eq(entityAccount.address)
                        expect(processData2.status).to.eq(ProcessStatus.RESULTS, "The process should remain in results")

                        // Try to set it to paused
                        try {
                            tx = await contractInstance.setStatus(processId1, ProcessStatus.PAUSED)
                            await tx.wait()
                            throw new Error("The transaction should have thrown an error but didn't")
                        }
                        catch (err) {
                            expect(err.message).to.match(/revert Invalid entity/, "The transaction threw an unexpected error:\n" + err.message)
                        }

                        const processData3 = unwrapProcessState(await contractInstance.get(processId1))
                        expect(processData3.entityAddress).to.eq(entityAccount.address)
                        expect(processData3.status).to.eq(ProcessStatus.RESULTS, "The process should remain in results")

                        // Try to set it to ended
                        try {
                            tx = await contractInstance.setStatus(processId1, ProcessStatus.ENDED)
                            await tx.wait()
                            throw new Error("The transaction should have thrown an error but didn't")
                        }
                        catch (err) {
                            expect(err.message).to.match(/revert Invalid entity/, "The transaction threw an unexpected error:\n" + err.message)
                        }

                        const processData4 = unwrapProcessState(await contractInstance.get(processId1))
                        expect(processData4.entityAddress).to.eq(entityAccount.address)
                        expect(processData4.status).to.eq(ProcessStatus.RESULTS, "The process should remain in results")

                        // Try to set it to canceled
                        try {
                            tx = await contractInstance.setStatus(processId1, ProcessStatus.CANCELED)
                            await tx.wait()
                            throw new Error("The transaction should have thrown an error but didn't")
                        }
                        catch (err) {
                            expect(err.message).to.match(/revert Invalid entity/, "The transaction threw an unexpected error:\n" + err.message)
                        }

                        const processData5 = unwrapProcessState(await contractInstance.get(processId1))
                        expect(processData5.entityAddress).to.eq(entityAccount.address)
                        expect(processData5.status).to.eq(ProcessStatus.RESULTS, "The process should remain in results")
                    }
                })
            })

            describe("only the oracle", () => {
                it("can set the results", async () => {
                    for (let account of [authorizedOracleAccount1, authorizedOracleAccount2]) {
                        let mode = ProcessMode.make({ autoStart: true, interruptible: true })
                        contractInstance = await new ProcessBuilder().withMode(mode).build()
                        const processId1 = await contractInstance.getProcessId(entityAccount.address, 0)
                        // one is already created by the builder

                        const processData0 = unwrapProcessState(await contractInstance.get(processId1))
                        expect(processData0.status).to.eq(ProcessStatus.READY, "The process should be ready")

                        // Try to set the results (fail)
                        try {
                            tx = await contractInstance.setResults(processId1, "1234")
                            await tx.wait()
                            throw new Error("The transaction should have thrown an error but didn't")
                        }
                        catch (err) {
                            expect(err.message).to.match(/revert onlyOracle/, "The transaction threw an unexpected error:\n" + err.message)
                        }

                        const processData5 = unwrapProcessState(await contractInstance.get(processId1))
                        expect(processData5.entityAddress).to.eq(entityAccount.address)
                        expect(processData5.status).to.eq(ProcessStatus.READY, "The process should be ready")

                        // Set the RESULTS (now oracle)
                        contractInstance = contractInstance.connect(deployAccount.wallet) as any
                        tx = await contractInstance.addOracle(account.address)
                        await tx.wait()
                        contractInstance = contractInstance.connect(account.wallet) as any
                        tx = await contractInstance.setResults(processId1, "1234")
                        await tx.wait()

                        const processData1 = unwrapProcessState(await contractInstance.get(processId1))
                        expect(processData1.mode).to.eq(mode)
                        expect(processData1.entityAddress).to.eq(entityAccount.address)
                        expect(processData1.status).to.eq(ProcessStatus.RESULTS, "The process should be in results")
                    }
                })
            })
        })

        it("should emit events")
    })

    describe("Process Results", () => {
        const results = '{"results":{"A":1234,"B":2345,"C":3456}}'

        it("should be accepted when the sender is a registered oracle", async () => {
            const processId = await contractInstance.getProcessId(entityAccount.address, 0)

            // One is already created by the builder

            // Attempt to publish the results by someone else
            try {
                contractInstance = contractInstance.connect(randomAccount1.wallet) as any
                tx = await contractInstance.setResults(processId, results)
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert/, "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get results
            const result2 = await contractInstance.getResults(processId)
            expect(result2).to.eq("", "There should be no results")

            // Register an oracle
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addOracle(authorizedOracleAccount1.address)
            await tx.wait()

            // Publish the results
            contractInstance = contractInstance.connect(authorizedOracleAccount1.wallet) as any
            tx = await contractInstance.setResults(processId, results)

            // Get results
            const result4 = await contractInstance.getResults(processId)
            expect(result4).to.eq(results, "The results should match")
        }).timeout(6000)

        it("should be accepted when the processId exists", async () => {
            const nonExistingProcessId1 = "0x0123456789012345678901234567890123456789012345678901234567890123"
            const nonExistingProcessId2 = "0x1234567890123456789012345678901234567890123456789012345678901234"

            // Register an oracle
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addOracle(authorizedOracleAccount1.address)
            await tx.wait()

            try {
                // Try to publish
                contractInstance = contractInstance.connect(authorizedOracleAccount1.wallet) as any
                tx = await contractInstance.setResults(nonExistingProcessId1, results)
                await tx.wait()
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert/, "The transaction threw an unexpected error:\n" + err.message)
            }

            try {
                // Try to publish
                contractInstance = contractInstance.connect(authorizedOracleAccount1.wallet) as any
                tx = await contractInstance.setResults(nonExistingProcessId2, results)
                await tx.wait()
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert/, "The transaction threw an unexpected error:\n" + err.message)
            }
        })

        it("should not be accepted when the process is canceled", async () => {
            contractInstance = await new ProcessBuilder().withMode(ProcessMode.make({ interruptible: true })).build()
            const processId = await contractInstance.getProcessId(entityAccount.address, 0)

            // One is already created by the builder

            // Cancel the process
            tx = await contractInstance.setStatus(processId, ProcessStatus.CANCELED)
            await tx.wait()

            // Register an oracle
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addOracle(authorizedOracleAccount1.address)
            await tx.wait()

            // Attempt to publish the results after canceling
            try {
                contractInstance = contractInstance.connect(authorizedOracleAccount1.wallet) as any
                tx = await contractInstance.setResults(processId, results)
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert/, "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get results
            const result4 = await contractInstance.getResults(processId)
            expect(result4).to.eq("", "There should be no results")
        }).timeout(5000)

        it("should retrieve the submited results", async () => {
            const processId = await contractInstance.getProcessId(entityAccount.address, 0)

            // One is already created by the builder

            // Register an oracle
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addOracle(authorizedOracleAccount1.address)
            await tx.wait()

            // Publish the results
            contractInstance = contractInstance.connect(authorizedOracleAccount1.wallet) as any
            tx = await contractInstance.setResults(processId, results)

            // Get results
            const result3 = await contractInstance.getResults(processId)
            expect(result3).to.eq(results, "The results should match")

        }).timeout(5000)

        it("allow oracles to set the results", async () => {
            for (let account of [authorizedOracleAccount1, authorizedOracleAccount2]) {
                let mode = ProcessMode.make({ autoStart: true, interruptible: true })
                contractInstance = await new ProcessBuilder().withMode(mode).build()
                const processId1 = await contractInstance.getProcessId(entityAccount.address, 0)
                // one is already created by the builder

                const processData0 = unwrapProcessState(await contractInstance.get(processId1))
                expect(processData0.status).to.eq(ProcessStatus.READY, "The process should be ready")

                // Try to set the results (fail)
                try {
                    tx = await contractInstance.setResults(processId1, "1234")
                    await tx.wait()
                    throw new Error("The transaction should have thrown an error but didn't")
                }
                catch (err) {
                    expect(err.message).to.match(/revert onlyOracle/, "The transaction threw an unexpected error:\n" + err.message)
                }

                const processData5 = unwrapProcessState(await contractInstance.get(processId1))
                expect(processData5.entityAddress).to.eq(entityAccount.address)
                expect(processData5.status).to.eq(ProcessStatus.READY, "The process should be ready")

                // Set the RESULTS (now oracle)
                contractInstance = contractInstance.connect(deployAccount.wallet) as any
                tx = await contractInstance.addOracle(account.address)
                await tx.wait()
                contractInstance = contractInstance.connect(account.wallet) as any
                tx = await contractInstance.setResults(processId1, "1234")
                await tx.wait()

                const processData1 = unwrapProcessState(await contractInstance.get(processId1))
                expect(processData1.mode).to.eq(mode)
                expect(processData1.entityAddress).to.eq(entityAccount.address)
                expect(processData1.status).to.eq(ProcessStatus.RESULTS, "The process should be in results")
            }
        })

        it("should prevent publishing twice", async () => {
            const originalResults = "SOMETHING_DIFFERENT_HERE"
            const processId = await contractInstance.getProcessId(entityAccount.address, 0)

            // One is already created by the builder

            // Register an oracle
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addOracle(authorizedOracleAccount1.address)
            await tx.wait()

            // publish results
            contractInstance = contractInstance.connect(authorizedOracleAccount1.wallet) as any
            tx = await contractInstance.setResults(processId, originalResults)

            // Get results
            const result3 = await contractInstance.getResults(processId)
            expect(result3).to.eq(originalResults, "The results should match")

            const processData1 = unwrapProcessState(await contractInstance.get(processId))
            expect(processData1.entityAddress).to.eq(entityAccount.address)
            expect(processData1.status).to.eq(ProcessStatus.RESULTS, "The process should be in results")

            // Try update the results
            try {
                contractInstance = contractInstance.connect(authorizedOracleAccount1.wallet) as any
                tx = await contractInstance.setResults(processId, results)
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert/, "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get results
            const result4 = await contractInstance.getResults(processId)
            expect(result4).to.eq(originalResults, "The results should stay the same")

            const processData2 = unwrapProcessState(await contractInstance.get(processId))
            expect(processData2.entityAddress).to.eq(entityAccount.address)
            expect(processData2.status).to.eq(ProcessStatus.RESULTS, "The process should be in results")
        }).timeout(5000)

        it("should emit an event", async () => {
            const processId1 = await contractInstance.getProcessId(entityAccount.address, 0)

            // Register an oracle
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addOracle(authorizedOracleAccount1.address)
            await tx.wait()

            // one is already created by the builder

            contractInstance = contractInstance.connect(authorizedOracleAccount1.wallet) as any
            const result: { processId: string, results: string } = await new Promise((resolve, reject) => {
                contractInstance.on("ResultsAvailable", (processId: string, results: string) => {
                    resolve({ processId, results })
                })
                contractInstance.setResults(processId1, results).then(tx => tx.wait()).catch(reject)
            })

            expect(result).to.be.ok
            expect(result.processId).to.equal(processId1)
            expect(result.results).to.equal(results)
        }).timeout(5000)
    })

    describe("Dynamic Census", () => {
        it("Should keep the census read-only by default")

        it("Should allow to update the census in dynamic census mode")

        it("Should emit an event")
    })

    describe("Serial envelope", () => {
        it("The question index should be read-only by default")

        it("The question index can be incremented in multi-envelope mode")

        it("Should fail if questionCount is zero")

        it("Should end a process after the last question has been incremented")

        it("Should emit an event when the current question is incremented")

        it("Should emit an event when question increment ends the process")
    })
})

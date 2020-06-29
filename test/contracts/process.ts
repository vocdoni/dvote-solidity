
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
let chainId: string
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
        processId = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE)
    })

    it("should deploy the contract", async () => {
        const contractFactory = new ContractFactory(votingProcessAbi, votingProcessByteCode, entityAccount.wallet)
        const localInstance1: Contract & ProcessContractMethods = await contractFactory.deploy() as Contract & ProcessContractMethods

        expect(localInstance1).to.be.ok
        expect(localInstance1.address).to.match(/^0x[0-9a-fA-F]{40}$/)

        const localInstance2: Contract & ProcessContractMethods = await contractFactory.deploy(234) as Contract & ProcessContractMethods

        expect(localInstance2).to.be.ok
        expect(localInstance2.address).to.match(/^0x[0-9a-fA-F]{40}$/)
        expect(localInstance2.address).to.not.eq(localInstance1.address)
    })

    it("should compute a processId based on the entity address the process index and the namespace", async () => {
        expect(contractInstance.getProcessId).to.be.ok
        expect(contractInstance.getProcessId.call).to.be.ok

        const proc1 = await contractInstance.getProcessId(accounts[0].address, 0, DEFAULT_NAMESPACE)
        const proc2 = await contractInstance.getProcessId(accounts[0].address, 0, DEFAULT_NAMESPACE)

        const proc3 = await contractInstance.getProcessId(accounts[0].address, 1, DEFAULT_NAMESPACE)
        const proc4 = await contractInstance.getProcessId(accounts[0].address, 1, DEFAULT_NAMESPACE)

        const proc5 = await contractInstance.getProcessId(accounts[0].address, 2, DEFAULT_NAMESPACE)
        const proc6 = await contractInstance.getProcessId(accounts[0].address, 3, DEFAULT_NAMESPACE)

        const proc7 = await contractInstance.getProcessId(accounts[1].address, 0, DEFAULT_NAMESPACE)
        const proc8 = await contractInstance.getProcessId(accounts[1].address, 1, DEFAULT_NAMESPACE)

        const proc9 = await contractInstance.getProcessId(accounts[1].address, 0, 10)
        const proc10 = await contractInstance.getProcessId(accounts[1].address, 0, 20)

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

        expect(proc9).to.not.eq(proc7)
        expect(proc10).to.not.eq(proc7)
    })

    it("should compute the next processId", async () => {
        // The entity already has 1 process at the moment
        const count1 = await contractInstance.getEntityProcessCount(entityAccount.address)
        expect(count1.toNumber()).to.eq(1)
        const processId1Expected = await contractInstance.getProcessId(entityAccount.address, count1.toNumber(), DEFAULT_NAMESPACE)
        const processId1Actual = await contractInstance.getNextProcessId(entityAccount.address, DEFAULT_NAMESPACE)

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
        const processId2Expected = await contractInstance.getProcessId(entityAccount.address, 2, DEFAULT_NAMESPACE)
        const processId2Actual = await contractInstance.getNextProcessId(entityAccount.address, DEFAULT_NAMESPACE)

        expect(processId1Actual).to.not.eq(processId2Actual)
        expect(processId2Actual).to.eq(processId2Expected)

        // 
        const count3 = await contractInstance.getEntityProcessCount(entityAccount.address)
        expect(count3.toNumber()).to.eq(2)
        const processId3Expected = await contractInstance.getProcessId(entityAccount.address, count3.toNumber(), 10)
        const processId3Actual = await contractInstance.getNextProcessId(entityAccount.address, 10)

        expect(processId3Expected).to.eq(processId3Actual)
    })

    describe("Namespace management", () => {
        it("should set a whole namespace at once", async () => {
            contractInstance = contractInstance.connect(deployAccount.wallet) as any

            const namespaceData0 = await contractInstance.getNamespace(10)
            expect(namespaceData0[0]).to.eq("")
            expect(namespaceData0[1]).to.eq("")
            expect(namespaceData0[2]).to.deep.eq([])
            expect(namespaceData0[3]).to.deep.eq([])
            expect(await contractInstance.isValidator(10, "0x1")).to.be.false
            expect(await contractInstance.isValidator(10, "0x2")).to.be.false
            expect(await contractInstance.isValidator(10, "0x3")).to.be.false
            expect(await contractInstance.isValidator(10, "0x4")).to.be.false

            await contractInstance.setNamespace(10, "cid", "gen", ["0x1", "0x2", "0x3"], [authorizedOracleAccount1.address, authorizedOracleAccount2.address])

            const namespaceData1 = await contractInstance.getNamespace(10)
            expect(namespaceData1[0]).to.eq("cid")
            expect(namespaceData1[1]).to.eq("gen")
            expect(namespaceData1[2]).to.deep.eq(["0x1", "0x2", "0x3"])
            expect(namespaceData1[3]).to.deep.eq([authorizedOracleAccount1.address, authorizedOracleAccount2.address])
            expect(await contractInstance.isValidator(10, "0x1")).to.be.true
            expect(await contractInstance.isValidator(10, "0x2")).to.be.true
            expect(await contractInstance.isValidator(10, "0x3")).to.be.true
            expect(await contractInstance.isValidator(10, "0x4")).to.be.false
            expect(await contractInstance.isOracle(10, authorizedOracleAccount1.address)).to.be.true
            expect(await contractInstance.isOracle(10, authorizedOracleAccount2.address)).to.be.true
            expect(await contractInstance.isOracle(10, randomAccount1.address)).to.be.false
            expect(await contractInstance.isOracle(10, randomAccount2.address)).to.be.false

            // 2
            await contractInstance.setNamespace(10, "chain-id", "genesis-here", ["0x1000", "0x2000", "0x3000"], [randomAccount1.address, randomAccount2.address])

            const namespaceData2 = await contractInstance.getNamespace(10)
            expect(namespaceData2[0]).to.eq("chain-id")
            expect(namespaceData2[1]).to.eq("genesis-here")
            expect(namespaceData2[2]).to.deep.eq(["0x1000", "0x2000", "0x3000"])
            expect(namespaceData2[3]).to.deep.eq([randomAccount1.address, randomAccount2.address])
            expect(await contractInstance.isValidator(10, "0x1000")).to.be.true
            expect(await contractInstance.isValidator(10, "0x2000")).to.be.true
            expect(await contractInstance.isValidator(10, "0x3000")).to.be.true
            expect(await contractInstance.isValidator(10, "0x4000")).to.be.false
            expect(await contractInstance.isOracle(10, randomAccount1.address)).to.be.true
            expect(await contractInstance.isOracle(10, randomAccount2.address)).to.be.true
            expect(await contractInstance.isOracle(10, authorizedOracleAccount1.address)).to.be.false
            expect(await contractInstance.isOracle(10, authorizedOracleAccount2.address)).to.be.false

            // 3
            await contractInstance.setNamespace(25, "cid", "gen", ["0x1", "0x2", "0x3"], [authorizedOracleAccount1.address, authorizedOracleAccount2.address])

            const namespaceData3 = await contractInstance.getNamespace(25)
            expect(namespaceData3[0]).to.eq("cid")
            expect(namespaceData3[1]).to.eq("gen")
            expect(namespaceData3[2]).to.deep.eq(["0x1", "0x2", "0x3"])
            expect(namespaceData3[3]).to.deep.eq([authorizedOracleAccount1.address, authorizedOracleAccount2.address])
            expect(await contractInstance.isValidator(25, "0x1")).to.be.true
            expect(await contractInstance.isValidator(25, "0x2")).to.be.true
            expect(await contractInstance.isValidator(25, "0x3")).to.be.true
            expect(await contractInstance.isValidator(25, "0x4")).to.be.false
            expect(await contractInstance.isOracle(25, authorizedOracleAccount1.address)).to.be.true
            expect(await contractInstance.isOracle(25, authorizedOracleAccount2.address)).to.be.true
            expect(await contractInstance.isOracle(25, randomAccount1.address)).to.be.false
            expect(await contractInstance.isOracle(25, randomAccount2.address)).to.be.false

            // 4
            await contractInstance.setNamespace(25, "chain-id", "genesis-here", ["0x1000", "0x2000", "0x3000"], [randomAccount1.address, randomAccount2.address])

            const namespaceData4 = await contractInstance.getNamespace(25)
            expect(namespaceData4[0]).to.eq("chain-id")
            expect(namespaceData4[1]).to.eq("genesis-here")
            expect(namespaceData4[2]).to.deep.eq(["0x1000", "0x2000", "0x3000"])
            expect(namespaceData4[3]).to.deep.eq([randomAccount1.address, randomAccount2.address])
            expect(await contractInstance.isValidator(25, "0x1000")).to.be.true
            expect(await contractInstance.isValidator(25, "0x2000")).to.be.true
            expect(await contractInstance.isValidator(25, "0x3000")).to.be.true
            expect(await contractInstance.isValidator(25, "0x4000")).to.be.false
            expect(await contractInstance.isOracle(25, randomAccount1.address)).to.be.true
            expect(await contractInstance.isOracle(25, randomAccount2.address)).to.be.true
            expect(await contractInstance.isOracle(25, authorizedOracleAccount1.address)).to.be.false
            expect(await contractInstance.isOracle(25, authorizedOracleAccount2.address)).to.be.false
        })

        it("should allow only the contract creator to update a namespace", async () => {
            contractInstance = contractInstance.connect(randomAccount1.wallet) as any

            try {
                await contractInstance.setNamespace(10, "cid", "gen", ["0x1", "0x2", "0x3"], [authorizedOracleAccount1.address, authorizedOracleAccount2.address])
                await tx.wait()
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert onlyContractOwner/, "The transaction threw an unexpected error:\n" + err.message)
            }

            const namespaceData0 = await contractInstance.getNamespace(10)
            expect(namespaceData0[0]).to.eq("")
            expect(namespaceData0[1]).to.eq("")
            expect(namespaceData0[2]).to.deep.eq([])
            expect(namespaceData0[3]).to.deep.eq([])
        })

        it("should emit an event", async () => {
            contractInstance = contractInstance.connect(deployAccount.wallet) as any

            const result: { namespace: number } = await new Promise((resolve, reject) => {
                contractInstance.on("NamespaceUpdated", (namespace: number) => resolve({ namespace }))

                contractInstance.setNamespace(DEFAULT_NAMESPACE, "cid", "gen", ["0x1", "0x2", "0x3"], [authorizedOracleAccount1.address, "0x1234567890123456789012345678901234567890"]).then(tx => tx.wait()).catch(reject)
            })

            expect(result).to.be.ok
            expect(result.namespace).to.equal(DEFAULT_NAMESPACE)
        }).timeout(7000)
    })

    describe("ChainID updates", () => {
        it("only contract creator", async () => {
            try {
                contractInstance = contractInstance.connect(randomAccount1.wallet) as any
                tx = await contractInstance.setChainId(DEFAULT_NAMESPACE, chainId)
                await tx.wait()
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert onlyContractOwner/, "The transaction threw an unexpected error:\n" + err.message)
            }
        })

        it("should persist", async () => {
            const newChainId = "new-chain-id-100"
            contractInstance = contractInstance.connect(deployAccount.wallet) as any

            tx = await contractInstance.setChainId(DEFAULT_NAMESPACE, newChainId)
            await tx.wait()

            let currentNamespace = await contractInstance.getNamespace(DEFAULT_NAMESPACE)
            expect(currentNamespace[0]).to.eq(newChainId, "ChainId should match")
        })

        it("should fail if duplicated", async () => {
            contractInstance = contractInstance.connect(deployAccount.wallet) as any

            tx = await contractInstance.setChainId(DEFAULT_NAMESPACE, "a-chain-id")
            await tx.wait()

            try {
                // same that it already is
                tx = await contractInstance.setChainId(DEFAULT_NAMESPACE, "a-chain-id")
                await tx.wait()

                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert Must differ/, "The transaction threw an unexpected error:\n" + err.message)
            }
        })

        it("should emit an event", async () => {
            const newChainId = "new-chain-id-200"
            contractInstance = contractInstance.connect(deployAccount.wallet) as any

            const result: { chainId: string, namespace: number } = await new Promise((resolve, reject) => {
                contractInstance.on("ChainIdUpdated", (chainId: string, namespace: number) => resolve({ chainId, namespace }))

                contractInstance.setChainId(DEFAULT_NAMESPACE, newChainId).then(tx => tx.wait()).catch(reject)
            })

            expect(result).to.be.ok
            expect(result.chainId).to.equal(newChainId)
            expect(result.namespace).to.equal(DEFAULT_NAMESPACE)
        }).timeout(7000)
    })

    describe("Genesis updates", () => {
        let genesis
        beforeEach(() => {
            genesis = "0x1234567890123456789012345678901234567890123123123"
        })

        it("only contract creator", async () => {
            try {
                contractInstance = contractInstance.connect(randomAccount1.wallet) as any
                tx = await contractInstance.setGenesis(DEFAULT_NAMESPACE, genesis)
                await tx.wait()
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert onlyContractOwner/, "The transaction threw an unexpected error:\n" + err.message)
            }
        })

        it("should persist", async () => {
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.setGenesis(DEFAULT_NAMESPACE, genesis)
            await tx.wait()

            let currentNamespace = await contractInstance.getNamespace(DEFAULT_NAMESPACE)
            expect(currentNamespace[1]).to.eq(genesis, "Gensis should match")

            // Another genesis value
            tx = await contractInstance.setGenesis(DEFAULT_NAMESPACE, "1234")
            await tx.wait()

            currentNamespace = await contractInstance.getNamespace(DEFAULT_NAMESPACE)
            expect(currentNamespace[1]).to.eq("1234", "Gensis should match")
        })

        it("should fail if duplicated", async () => {
            contractInstance = contractInstance.connect(deployAccount.wallet) as any

            tx = await contractInstance.setGenesis(DEFAULT_NAMESPACE, "a-genesis")
            await tx.wait()

            try {
                // same that it already is
                tx = await contractInstance.setGenesis(DEFAULT_NAMESPACE, "a-genesis")
                await tx.wait()

                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert Must differ/, "The transaction threw an unexpected error:\n" + err.message)
            }
        })

        it("should emit an event", async () => {
            contractInstance = contractInstance.connect(deployAccount.wallet) as any

            const result: { genesis: string, namespace: number } = await new Promise((resolve, reject) => {
                contractInstance.on("GenesisUpdated", (genesis: string, namespace: number) => resolve({ genesis, namespace }))

                contractInstance.setGenesis(DEFAULT_NAMESPACE, genesis).then(tx => tx.wait()).catch(reject)
            })

            expect(result).to.be.ok
            expect(result.genesis).to.equal(genesis)
            expect(result.namespace).to.equal(DEFAULT_NAMESPACE)
        }).timeout(7000)
    })

    describe("Validator inclusion", () => {
        const validatorPublicKey = "0x1234"
        const validatorPublicKey2 = "0x4321"

        it("only when the contract owner requests it", async () => {
            expect(await contractInstance.isValidator(DEFAULT_NAMESPACE, validatorPublicKey)).to.be.false

            // Register a validator
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addValidator(DEFAULT_NAMESPACE, validatorPublicKey)
            await tx.wait()

            // Get validator list
            expect((await contractInstance.getNamespace(DEFAULT_NAMESPACE))[2]).to.deep.eq([validatorPublicKey])

            // Check validator
            expect(await contractInstance.isValidator(DEFAULT_NAMESPACE, validatorPublicKey)).to.be.true

            // Attempt to add a validator by someone else
            try {
                contractInstance = contractInstance.connect(randomAccount1.wallet) as any
                tx = await contractInstance.addValidator(DEFAULT_NAMESPACE, validatorPublicKey2)
                await tx.wait()
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert onlyContractOwner/, "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get validator list
            expect((await contractInstance.getNamespace(DEFAULT_NAMESPACE))[2]).to.deep.eq([validatorPublicKey])

            // Check validator
            expect(await contractInstance.isValidator(DEFAULT_NAMESPACE, validatorPublicKey2)).to.be.false
        })

        it("should add the validator public key to the validator list", async () => {
            // Register validator 1
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addValidator(DEFAULT_NAMESPACE, validatorPublicKey)
            await tx.wait()

            // Get validator list
            expect((await contractInstance.getNamespace(DEFAULT_NAMESPACE))[2]).to.deep.eq([validatorPublicKey])

            // Check validator
            expect(await contractInstance.isValidator(DEFAULT_NAMESPACE, validatorPublicKey)).to.be.true

            // Adding validator #2
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addValidator(DEFAULT_NAMESPACE, validatorPublicKey2)
            await tx.wait()

            // Get validator list
            expect((await contractInstance.getNamespace(DEFAULT_NAMESPACE))[2]).to.deep.eq([validatorPublicKey, validatorPublicKey2])

            // Check validator
            expect(await contractInstance.isValidator(DEFAULT_NAMESPACE, validatorPublicKey2)).to.be.true
        })

        it("should add the validator to the right namespace", async () => {
            expect(await contractInstance.isValidator(5, validatorPublicKey)).to.be.false
            contractInstance = contractInstance.connect(deployAccount.wallet) as any

            // Register on namespace 5

            tx = await contractInstance.addValidator(5, validatorPublicKey)
            await tx.wait()

            // Check validator
            expect(await contractInstance.isValidator(5, validatorPublicKey)).to.be.true
            expect(await contractInstance.isValidator(10, validatorPublicKey)).to.be.false

            // 2
            expect(await contractInstance.isValidator(10, validatorPublicKey2)).to.be.false

            tx = await contractInstance.addValidator(10, validatorPublicKey2)
            await tx.wait()

            // Check validator
            expect(await contractInstance.isValidator(10, validatorPublicKey2)).to.be.true
        })

        it("should emit an event", async () => {
            // Register validator
            contractInstance = contractInstance.connect(deployAccount.wallet) as any

            const result: { validatorPublicKey: string } = await new Promise((resolve, reject) => {
                contractInstance.on("ValidatorAdded", (validatorPublicKey: string) => {
                    resolve({ validatorPublicKey })
                })
                contractInstance.addValidator(DEFAULT_NAMESPACE, validatorPublicKey).then(tx => tx.wait()).catch(reject)
            })

            expect(result).to.be.ok
            expect(result.validatorPublicKey).to.equal(validatorPublicKey)
        }).timeout(7000)
    })

    describe("Validator removal", () => {

        const validatorPublicKey = "0x1234"

        it("only when the contract owner account requests it", async () => {
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addValidator(DEFAULT_NAMESPACE, validatorPublicKey)
            await tx.wait()

            // Get validator list
            expect((await contractInstance.getNamespace(DEFAULT_NAMESPACE))[2]).to.deep.eq([validatorPublicKey])

            // Attempt to disable the validator from someone else
            try {
                contractInstance = contractInstance.connect(randomAccount1.wallet) as any
                tx = await contractInstance.removeValidator(DEFAULT_NAMESPACE, 0, validatorPublicKey)
                await tx.wait()
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert onlyContractOwner/, "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get validator list
            expect((await contractInstance.getNamespace(DEFAULT_NAMESPACE))[2]).to.deep.eq([validatorPublicKey])

            // Check validator
            expect(await contractInstance.isValidator(DEFAULT_NAMESPACE, validatorPublicKey)).to.be.true

            // Disable validator from the owner
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.removeValidator(DEFAULT_NAMESPACE, 0, validatorPublicKey)
            await tx.wait()

            // Get validator list
            expect((await contractInstance.getNamespace(DEFAULT_NAMESPACE))[2]).to.deep.eq([])
        })

        it("should fail if the idx does not match validatorPublicKey", async () => {
            const nonExistingValidatorPublicKey = "0x123123"

            contractInstance = contractInstance.connect(deployAccount.wallet) as any

            // Register a validator
            tx = await contractInstance.addValidator(DEFAULT_NAMESPACE, validatorPublicKey)
            await tx.wait()

            // Attempt to disable mismatching validator
            try {
                tx = await contractInstance.removeValidator(DEFAULT_NAMESPACE, 0, nonExistingValidatorPublicKey)
                await tx.wait()
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert Index-key mismatch/, "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get validator list
            expect((await contractInstance.getNamespace(DEFAULT_NAMESPACE))[2]).to.deep.eq([validatorPublicKey])

            // Check validators
            expect(await contractInstance.isValidator(DEFAULT_NAMESPACE, validatorPublicKey)).to.be.true
            expect(await contractInstance.isValidator(DEFAULT_NAMESPACE, nonExistingValidatorPublicKey)).to.be.false

            // Attempt to disable non-existing validator
            try {
                tx = await contractInstance.removeValidator(DEFAULT_NAMESPACE, 5, validatorPublicKey)
                await tx.wait()
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert Invalid index/, "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get validator list
            expect((await contractInstance.getNamespace(DEFAULT_NAMESPACE))[2]).to.deep.eq([validatorPublicKey])

            // Check validator
            expect(await contractInstance.isValidator(DEFAULT_NAMESPACE, validatorPublicKey)).to.be.true
        })

        it("should remove from the right namespace", async () => {
            contractInstance = contractInstance.connect(deployAccount.wallet) as any

            // Register a validator on namespace 5
            tx = await contractInstance.addValidator(5, validatorPublicKey)
            await tx.wait()

            // Attempt to disable from the wrong namespace
            try {
                tx = await contractInstance.removeValidator(10, 0, validatorPublicKey)
                await tx.wait()
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert Invalid index/, "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get validator list
            expect((await contractInstance.getNamespace(5))[2]).to.deep.eq([validatorPublicKey])

            // Check validators
            expect(await contractInstance.isValidator(5, validatorPublicKey)).to.be.true

            // Disable from the right namespace
            tx = await contractInstance.removeValidator(5, 0, validatorPublicKey)
            await tx.wait()

            // Get validator list
            expect((await contractInstance.getNamespace(5))[2]).to.deep.eq([])

            // Check validator
            expect(await contractInstance.isValidator(5, validatorPublicKey)).to.be.false
        })

        it("should emit an event", async () => {
            // Register validator
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addValidator(DEFAULT_NAMESPACE, validatorPublicKey)
            await tx.wait()

            const result: { validatorPublicKey: string } = await new Promise((resolve, reject) => {
                contractInstance.on("ValidatorRemoved", (validatorPublicKey: string) => {
                    resolve({ validatorPublicKey })
                })
                contractInstance.removeValidator(DEFAULT_NAMESPACE, 0, validatorPublicKey).then(tx => tx.wait()).catch(reject)
            })

            expect(result).to.be.ok
            expect(result.validatorPublicKey).to.equal(validatorPublicKey)
        }).timeout(7000)
    })

    describe("Oracle inclusion", () => {

        it("only when the contract owner requests it", async () => {
            // Check validator
            expect(await contractInstance.isOracle(DEFAULT_NAMESPACE, authorizedOracleAccount1.address)).to.be.false

            // Register a oracle
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addOracle(DEFAULT_NAMESPACE, authorizedOracleAccount1.address)
            await tx.wait()

            // Get oracle list
            expect((await contractInstance.getNamespace(DEFAULT_NAMESPACE))[3]).to.deep.eq([authorizedOracleAccount1.address])

            // Check oracle
            expect(await contractInstance.isOracle(DEFAULT_NAMESPACE, authorizedOracleAccount1.address)).to.be.true

            // Attempt to add a oracle by someone else
            try {
                contractInstance = contractInstance.connect(randomAccount2.wallet) as any
                tx = await contractInstance.addOracle(DEFAULT_NAMESPACE, authorizedOracleAccount2.address)
                await tx.wait()
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert/, "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get oracle list
            expect((await contractInstance.getNamespace(DEFAULT_NAMESPACE))[3]).to.deep.eq([authorizedOracleAccount1.address])

            // Check oracle
            expect(await contractInstance.isOracle(DEFAULT_NAMESPACE, authorizedOracleAccount1.address)).to.be.true
            expect(await contractInstance.isOracle(DEFAULT_NAMESPACE, authorizedOracleAccount2.address)).to.be.false
        })

        it("should add the oracle address to the oracle list", async () => {
            // Register oracle 1
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addOracle(DEFAULT_NAMESPACE, authorizedOracleAccount1.address)
            await tx.wait()

            // Get oracle list
            expect((await contractInstance.getNamespace(DEFAULT_NAMESPACE))[3]).to.deep.eq([authorizedOracleAccount1.address])

            // Check oracle
            expect(await contractInstance.isOracle(DEFAULT_NAMESPACE, authorizedOracleAccount1.address)).to.be.true

            // Adding oracle #2
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addOracle(DEFAULT_NAMESPACE, authorizedOracleAccount2.address)
            await tx.wait()

            // Get oracle list
            expect((await contractInstance.getNamespace(DEFAULT_NAMESPACE))[3]).to.deep.eq([authorizedOracleAccount1.address, authorizedOracleAccount2.address])

            // Check oracle
            expect(await contractInstance.isOracle(DEFAULT_NAMESPACE, authorizedOracleAccount1.address)).to.be.true
            expect(await contractInstance.isOracle(DEFAULT_NAMESPACE, authorizedOracleAccount2.address)).to.be.true
        })

        it("should add the validator to the right namespace", async () => {
            expect(await contractInstance.isOracle(5, authorizedOracleAccount1.address)).to.be.false
            contractInstance = contractInstance.connect(deployAccount.wallet) as any

            // Register on namespace 5

            tx = await contractInstance.addOracle(5, authorizedOracleAccount1.address)
            await tx.wait()

            // Check validator
            expect(await contractInstance.isOracle(5, authorizedOracleAccount1.address)).to.be.true
            expect(await contractInstance.isOracle(10, authorizedOracleAccount1.address)).to.be.false

            // 2
            expect(await contractInstance.isOracle(10, authorizedOracleAccount2.address)).to.be.false

            tx = await contractInstance.addOracle(10, authorizedOracleAccount2.address)
            await tx.wait()

            // Check validator
            expect(await contractInstance.isOracle(10, authorizedOracleAccount2.address)).to.be.true
        })

        it("should emit an event", async () => {
            contractInstance = contractInstance.connect(deployAccount.wallet) as any

            const result: { oracleAddress: string } = await new Promise((resolve, reject) => {
                contractInstance.on("OracleAdded", (oracleAddress: string) => {
                    resolve({ oracleAddress })
                })
                contractInstance.addOracle(DEFAULT_NAMESPACE, authorizedOracleAccount1.address).then(tx => tx.wait()).catch(reject)
            })

            expect(result).to.be.ok
            expect(result.oracleAddress).to.equal(authorizedOracleAccount1.address)
        }).timeout(7000)
    })

    describe("Oracle removal", () => {

        it("only when the contract owner requests it", async () => {
            // Check oracle
            expect(await contractInstance.isOracle(DEFAULT_NAMESPACE, authorizedOracleAccount1.address)).to.be.false

            // Register oracle
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addOracle(DEFAULT_NAMESPACE, authorizedOracleAccount1.address)
            await tx.wait()

            // Check oracle
            expect(await contractInstance.isOracle(DEFAULT_NAMESPACE, authorizedOracleAccount1.address)).to.be.true

            // Attempt to disable the oracle from someone else
            try {
                contractInstance = contractInstance.connect(randomAccount2.wallet) as any
                tx = await contractInstance.removeOracle(DEFAULT_NAMESPACE, 0, authorizedOracleAccount1.address)
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert/, "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get oracle list
            expect((await contractInstance.getNamespace(DEFAULT_NAMESPACE))[3]).to.deep.eq([authorizedOracleAccount1.address])

            // Check oracle
            expect(await contractInstance.isOracle(DEFAULT_NAMESPACE, authorizedOracleAccount1.address)).to.be.true

            // Disable oracle from the creator
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            const result3 = await contractInstance.removeOracle(DEFAULT_NAMESPACE, 0, authorizedOracleAccount1.address)

            // Get oracle list
            expect((await contractInstance.getNamespace(DEFAULT_NAMESPACE))[3]).to.deep.eq([])

            // Check oracle
            expect(await contractInstance.isOracle(DEFAULT_NAMESPACE, authorizedOracleAccount1.address)).to.be.false
        })

        it("should fail if the idx is not valid", async () => {
            // Check oracle
            expect(await contractInstance.isOracle(DEFAULT_NAMESPACE, authorizedOracleAccount1.address)).to.be.false

            // Register a oracle
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addOracle(DEFAULT_NAMESPACE, authorizedOracleAccount1.address)
            await tx.wait()

            // Register a oracle
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addOracle(DEFAULT_NAMESPACE, authorizedOracleAccount2.address)
            await tx.wait()

            // Attempt to disable non-existing oracle
            try {
                contractInstance = contractInstance.connect(deployAccount.wallet) as any
                tx = await contractInstance.removeOracle(DEFAULT_NAMESPACE, 5, authorizedOracleAccount2.address)
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert/, "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get oracle list
            expect((await contractInstance.getNamespace(DEFAULT_NAMESPACE))[3]).to.deep.eq([authorizedOracleAccount1.address, authorizedOracleAccount2.address])

            // Check oracle
            expect(await contractInstance.isOracle(DEFAULT_NAMESPACE, authorizedOracleAccount1.address)).to.be.true
            expect(await contractInstance.isOracle(DEFAULT_NAMESPACE, authorizedOracleAccount1.address)).to.be.true
        })

        it("should fail if the idx does not match oracleAddress", async () => {
            // Register a oracle
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addOracle(DEFAULT_NAMESPACE, authorizedOracleAccount1.address)
            await tx.wait()

            // Register a oracle
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addOracle(DEFAULT_NAMESPACE, authorizedOracleAccount2.address)
            await tx.wait()

            // Attempt to disable non-existing oracle
            try {
                contractInstance = contractInstance.connect(deployAccount.wallet) as any
                tx = await contractInstance.removeOracle(DEFAULT_NAMESPACE, 1, randomAccount2.address)
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert/, "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get oracle list
            expect((await contractInstance.getNamespace(DEFAULT_NAMESPACE))[3]).to.deep.eq([authorizedOracleAccount1.address, authorizedOracleAccount2.address])

            // Check oracle
            expect(await contractInstance.isOracle(DEFAULT_NAMESPACE, authorizedOracleAccount1.address)).to.be.true
            expect(await contractInstance.isOracle(DEFAULT_NAMESPACE, authorizedOracleAccount1.address)).to.be.true
        })

        it("should remove from the right namespace", async () => {
            contractInstance = contractInstance.connect(deployAccount.wallet) as any

            // Register an oracle on namespace 5
            tx = await contractInstance.addOracle(5, authorizedOracleAccount1.address)
            await tx.wait()

            // Attempt to disable from the wrong namespace
            try {
                tx = await contractInstance.removeOracle(10, 0, authorizedOracleAccount1.address)
                await tx.wait()
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert Invalid index/, "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get oracle list
            expect((await contractInstance.getNamespace(5))[3]).to.deep.eq([authorizedOracleAccount1.address])

            // Check oracles
            expect(await contractInstance.isOracle(5, authorizedOracleAccount1.address)).to.be.true

            // Disable from the right namespace
            tx = await contractInstance.removeOracle(5, 0, authorizedOracleAccount1.address)
            await tx.wait()

            // Get oracle list
            expect((await contractInstance.getNamespace(5))[3]).to.deep.eq([])

            // Check oracles
            expect(await contractInstance.isOracle(5, authorizedOracleAccount1.address)).to.be.false
        })

        it("should emit an event", async () => {
            contractInstance = contractInstance.connect(deployAccount.wallet) as any

            // Register oracle
            tx = await contractInstance.addOracle(DEFAULT_NAMESPACE, authorizedOracleAccount1.address)
            await tx.wait()

            const result: { oracleAddress: string } = await new Promise((resolve, reject) => {
                contractInstance.on("OracleRemoved", (oracleAddress: string) => {
                    resolve({ oracleAddress })
                })
                contractInstance.removeOracle(DEFAULT_NAMESPACE, 0, authorizedOracleAccount1.address).then(tx => tx.wait()).catch(reject)
            })

            expect(result).to.be.ok
            expect(result.oracleAddress).to.equal(authorizedOracleAccount1.address)
        }).timeout(7000)
    })

    describe("Process Creation", () => {
        it("should allow anyone to create a process", async () => {
            expect(contractInstance.create).to.be.ok

            // one is already created by the builder

            let processIdExpected = await contractInstance.getProcessId(entityAccount.address, 1, DEFAULT_NAMESPACE)
            let processIdActual = await contractInstance.getNextProcessId(entityAccount.address, DEFAULT_NAMESPACE)
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

            processIdExpected = await contractInstance.getProcessId(randomAccount1.address, 1, DEFAULT_NAMESPACE)
            processIdActual = await contractInstance.getNextProcessId(randomAccount1.address, DEFAULT_NAMESPACE)
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

            processIdExpected = await contractInstance.getProcessId(randomAccount2.address, 1, DEFAULT_NAMESPACE)
            processIdActual = await contractInstance.getNextProcessId(randomAccount2.address, DEFAULT_NAMESPACE)
            expect(processIdExpected).to.eq(processIdActual)
        })

        it("retrieved metadata should match the one submitted", async () => {
            contractInstance = await new ProcessBuilder().build(0)
            let nextProcessId: string
            let created = 0
            let mode: number, envelopeType: number, nonce: number
            expect((await contractInstance.getEntityProcessCount(entityAccount.address)).toNumber()).to.eq(0, "Should be empty")

            // Loop process creation
            for (let idx = 0; idx < 10; idx+=2) {
                for (let namespace = 5; namespace <= 10; namespace += 5) {
                    expect((await contractInstance.getEntityProcessCount(entityAccount.address)).toNumber()).to.eq(created, "Pre count mismatch")
                    nextProcessId = await contractInstance.getNextProcessId(entityAccount.address, namespace)

                    expect(() => {
                        return contractInstance.get(nextProcessId)
                    }).to.throw

                    // Create nextProcessId
                    nonce = idx * namespace
                    mode = ProcessMode.make({autoStart: true})
                    envelopeType = ProcessEnvelopeType.make({encryptedVotes: true})
                    tx = await contractInstance.create(
                        [mode, envelopeType],
                        [`0x10${idx}${namespace}`, `0x20${idx}${namespace}`, `0x30${idx}${namespace}`],
                        10 + nonce,
                        11 + nonce,
                        [12 + nonce, 13 + nonce, 14 + nonce],
                        idx % 4 == 0,
                        [15 + nonce, 16 + nonce],
                        namespace,
                        DEFAULT_PARAMS_SIGNATURE
                    )
                    await tx.wait()
                    created++

                    const params = await contractInstance.get(nextProcessId)
                    expect(params).to.be.ok
                    expect(params[0]).to.deep.eq([mode, envelopeType])
                    expect(params[1]).to.eq(entityAccount.address)
                    expect(params[2]).to.deep.eq([`0x10${idx}${namespace}`, `0x20${idx}${namespace}`, `0x30${idx}${namespace}`])
                    expect(params[3].toNumber()).to.eq(10 + nonce)
                    expect(params[4]).to.eq(11 + nonce)
                    expect(params[6][0]).to.eq(0)
                    expect(params[6][1]).to.eq(12 + nonce)
                    expect(params[6][2]).to.eq(13 + nonce)
                    expect(params[6][3]).to.eq(14 + nonce)
                    expect(params[7]).to.eq(idx % 4 == 0)
                    expect(params[8][0]).to.eq(15 + nonce)
                    expect(params[8][1]).to.eq(16 + nonce)
                    expect(params[9]).to.eq(namespace)

                    expect((await contractInstance.getEntityProcessCount(entityAccount.address)).toNumber()).to.eq(created, "Count mismatch")
                    expect(await contractInstance.getNextProcessId(entityAccount.address, namespace)).to.not.eq(nextProcessId)
                }
            }
        }).timeout(15000)

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
            let processId = await contractInstance.getProcessId(entityAccount.address, count - 1, DEFAULT_NAMESPACE)

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
            processId = await contractInstance.getProcessId(entityAccount.address, count - 1, newNamespace)

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

            // 3
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
            processId = await contractInstance.getProcessId(entityAccount.address, count - 1, newNamespace)

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

        it("should emit an event", async () => {
            const expectedProcessId = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE)

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
    })

    describe("Process Status", () => {
        beforeEach(async () => {
            contractInstance = await new ProcessBuilder().withMode(ProcessMode.make({ autoStart: true })).build()
        })

        it("should create paused processes by default", async () => {
            contractInstance = await new ProcessBuilder().withMode(ProcessMode.make({ autoStart: false })).build()
            const processId1 = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE)

            // one is already created by the builder

            const processData1 = unwrapProcessState(await contractInstance.get(processId1))
            expect(processData1.status).to.eq(ProcessStatus.PAUSED, "The process should be paused")
        })

        it("should create processes in ready status when autoStart is set", async () => {
            contractInstance = await new ProcessBuilder().withMode(ProcessMode.make({ autoStart: true })).build()
            const processId1 = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE)

            const processData1 = unwrapProcessState(await contractInstance.get(processId1))
            expect(processData1.status).to.eq(ProcessStatus.READY, "The process should be ready")
        })

        it("should reject invalid status codes", async () => {
            // interruptible
            let mode = ProcessMode.make({ autoStart: true, interruptible: true })
            contractInstance = await new ProcessBuilder().withMode(mode).build()
            const processId1 = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE)
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

        describe("Not interruptible", () => {
            it("should allow paused => ready (the first time) if autoStart is not set", async () => {
                // non-interruptible
                let mode = ProcessMode.make({ autoStart: false, interruptible: false })
                contractInstance = await new ProcessBuilder().withMode(mode).build()
                const processId1 = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE)
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
                const processId1 = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE)
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
        describe("Interruptible", () => {
            describe("from ready", () => {
                it("should fail if setting to ready", async () => {
                    // interruptible
                    let mode = ProcessMode.make({ autoStart: true, interruptible: true })
                    contractInstance = await new ProcessBuilder().withMode(mode).build()
                    const processId1 = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE)
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
                    const processId1 = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE)
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
                    const processId1 = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE)
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
                    const processId1 = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE)
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
                    const processId1 = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE)
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
                        const processId1 = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE)
                        // one is already created by the builder

                        const processData0 = unwrapProcessState(await contractInstance.get(processId1))
                        expect(processData0.status).to.eq(ProcessStatus.READY, "The process should be ready")

                        // even if the account is an oracle
                        contractInstance = contractInstance.connect(deployAccount.wallet) as any
                        tx = await contractInstance.addOracle(DEFAULT_NAMESPACE, account.address)
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
                    const processId1 = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE)
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
                    const processId1 = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE)
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
                    const processId1 = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE)
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
                    const processId1 = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE)
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
                    const processId1 = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE)
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
                        const processId1 = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE)
                        // one is already created by the builder

                        const processData0 = unwrapProcessState(await contractInstance.get(processId1))
                        expect(processData0.status).to.eq(ProcessStatus.PAUSED, "The process should be paused")

                        // even if the account is an oracle
                        contractInstance = contractInstance.connect(deployAccount.wallet) as any
                        tx = await contractInstance.addOracle(DEFAULT_NAMESPACE, account.address)
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
                    const processId1 = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE)
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
                        const processId1 = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE)
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
                        tx = await contractInstance.addOracle(DEFAULT_NAMESPACE, account.address)
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
                    const processId1 = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE)
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
                        const processId1 = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE)
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
                        tx = await contractInstance.addOracle(DEFAULT_NAMESPACE, account.address)
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
                    const processId1 = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE)
                    // one is already created by the builder

                    const processData0 = unwrapProcessState(await contractInstance.get(processId1))
                    expect(processData0.status).to.eq(ProcessStatus.PAUSED, "The process should be paused")

                    // Set it to RESULTS (oracle)
                    contractInstance = contractInstance.connect(deployAccount.wallet) as any
                    tx = await contractInstance.addOracle(DEFAULT_NAMESPACE, authorizedOracleAccount1.address)
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
                        const processId1 = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE)
                        // one is already created by the builder

                        const processData0 = unwrapProcessState(await contractInstance.get(processId1))
                        expect(processData0.status).to.eq(ProcessStatus.PAUSED, "The process should be paused")

                        // Set it to RESULTS (oracle)
                        contractInstance = contractInstance.connect(deployAccount.wallet) as any
                        tx = await contractInstance.addOracle(DEFAULT_NAMESPACE, authorizedOracleAccount1.address)
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
                        tx = await contractInstance.addOracle(DEFAULT_NAMESPACE, account.address)
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
                        const processId1 = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE)
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
                            expect(err.message).to.match(/revert Not oracle/, "The transaction threw an unexpected error:\n" + err.message)
                        }

                        const processData5 = unwrapProcessState(await contractInstance.get(processId1))
                        expect(processData5.entityAddress).to.eq(entityAccount.address)
                        expect(processData5.status).to.eq(ProcessStatus.READY, "The process should be ready")

                        // Set the RESULTS (now oracle)
                        contractInstance = contractInstance.connect(deployAccount.wallet) as any
                        tx = await contractInstance.addOracle(DEFAULT_NAMESPACE, account.address)
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

        it("should emit an event")
    })

    describe("Serial envelope", () => {
        it("The question index should be read-only by default")

        it("The question index can be incremented in multi-envelope mode")

        it("Should fail if questionCount is zero")

        it("Should end a process after the last question has been incremented")

        it("Should emit an event when the current question is incremented")

        it("Should emit an event when question increment ends the process")
    })

    describe("Dynamic Census", () => {
        it("Should keep the census read-only by default", async () => {
            let mode = ProcessMode.make({ autoStart: true, dynamicCensus: false })
            contractInstance = await new ProcessBuilder().withMode(mode).build()
            processId = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE)
            // one is already created by the builder

            const processData0 = unwrapProcessState(await contractInstance.get(processId))
            expect(processData0.status).to.eq(ProcessStatus.READY, "The process should be ready")

            // Try to update it
            try {
                tx = await contractInstance.setCensus(processId, "new-merkle-root", "new-merkle-tree")
                await tx.wait()
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert Read-only census/, "The transaction threw an unexpected error:\n" + err.message)
            }

            const processData1 = unwrapProcessState(await contractInstance.get(processId))
            expect(processData1.mode).to.eq(mode)
            expect(processData1.entityAddress).to.eq(entityAccount.address)
            expect(processData1.censusMerkleRoot).to.eq(DEFAULT_MERKLE_ROOT)
            expect(processData1.censusMerkleTree).to.eq(DEFAULT_MERKLE_TREE_CONTENT_HASHED_URI)

            // 2

            mode = ProcessMode.make({ autoStart: false, dynamicCensus: false })
            contractInstance = await new ProcessBuilder().withMode(mode).build()
            processId = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE)
            // one is already created by the builder

            const processData2 = unwrapProcessState(await contractInstance.get(processId))
            expect(processData2.status).to.eq(ProcessStatus.PAUSED, "The process should be paused")

            // Try to update it
            try {
                tx = await contractInstance.setCensus(processId, "123412341234", "345634563456")
                await tx.wait()
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert Read-only census/, "The transaction threw an unexpected error:\n" + err.message)
            }

            const processData3 = unwrapProcessState(await contractInstance.get(processId))
            expect(processData3.mode).to.eq(mode)
            expect(processData3.entityAddress).to.eq(entityAccount.address)
            expect(processData3.censusMerkleRoot).to.eq(DEFAULT_MERKLE_ROOT)
            expect(processData3.censusMerkleTree).to.eq(DEFAULT_MERKLE_TREE_CONTENT_HASHED_URI)
        })

        it("Should allow to update the census in dynamic census mode", async () => {
            let mode = ProcessMode.make({ autoStart: true, dynamicCensus: true })
            contractInstance = await new ProcessBuilder().withMode(mode).build()
            processId = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE)
            // one is already created by the builder

            const processData0 = unwrapProcessState(await contractInstance.get(processId))
            expect(processData0.status).to.eq(ProcessStatus.READY, "The process should be ready")

            // Update it
            tx = await contractInstance.setCensus(processId, "new-merkle-root", "new-merkle-tree")
            await tx.wait()

            const processData1 = unwrapProcessState(await contractInstance.get(processId))
            expect(processData1.mode).to.eq(mode)
            expect(processData1.entityAddress).to.eq(entityAccount.address)
            expect(processData1.censusMerkleRoot).to.eq("new-merkle-root")
            expect(processData1.censusMerkleTree).to.eq("new-merkle-tree")

            // 2

            mode = ProcessMode.make({ autoStart: false, dynamicCensus: true })
            contractInstance = await new ProcessBuilder().withMode(mode).build()
            processId = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE)
            // one is already created by the builder

            const processData2 = unwrapProcessState(await contractInstance.get(processId))
            expect(processData2.status).to.eq(ProcessStatus.PAUSED, "The process should be paused")

            // Update it
            tx = await contractInstance.setCensus(processId, "123412341234", "345634563456")
            await tx.wait()

            const processData3 = unwrapProcessState(await contractInstance.get(processId))
            expect(processData3.mode).to.eq(mode)
            expect(processData3.entityAddress).to.eq(entityAccount.address)
            expect(processData3.censusMerkleRoot).to.eq("123412341234")
            expect(processData3.censusMerkleTree).to.eq("345634563456")
        })

        it("Should only allow the creator to update the census", async () => {
            let mode = ProcessMode.make({ autoStart: true, dynamicCensus: true })
            contractInstance = await new ProcessBuilder().withMode(mode).build()
            const processId1 = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE)
            // one is already created by the builder

            const processData0 = unwrapProcessState(await contractInstance.get(processId1))
            expect(processData0.status).to.eq(ProcessStatus.READY, "The process should be ready")

            for (let account of [randomAccount1, randomAccount2]) {
                contractInstance = contractInstance.connect(account.wallet) as any

                // Try to set it to invalid values
                try {
                    tx = await contractInstance.setCensus(processId, "123412341234", "345634563456")
                    await tx.wait()
                    throw new Error("The transaction should have thrown an error but didn't")
                }
                catch (err) {
                    expect(err.message).to.match(/revert Invalid entity/, "The transaction threw an unexpected error:\n" + err.message)
                }

                const processData1 = unwrapProcessState(await contractInstance.get(processId1))
                expect(processData1.entityAddress).to.eq(entityAccount.address)
                expect(processData1.censusMerkleRoot).to.eq(DEFAULT_MERKLE_ROOT)
                expect(processData1.censusMerkleTree).to.eq(DEFAULT_MERKLE_TREE_CONTENT_HASHED_URI)
            }
        })

        it("Should fail updating the census on terminated processes", async () => {
            // 1 - ENDED
            let mode = ProcessMode.make({ interruptible: true, dynamicCensus: true })
            contractInstance = await new ProcessBuilder().withMode(mode).build()
            processId = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE)
            // one is already created by the builder

            const processData0 = unwrapProcessState(await contractInstance.get(processId))
            expect(processData0.status).to.eq(ProcessStatus.PAUSED, "The process should be paused")

            tx = await contractInstance.setStatus(processId, ProcessStatus.ENDED)
            await tx.wait()

            // Try to update it
            try {
                tx = await contractInstance.setCensus(processId, "new-merkle-root", "new-merkle-tree")
                await tx.wait()
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert Process terminated/, "The transaction threw an unexpected error:\n" + err.message)
            }

            const processData1 = unwrapProcessState(await contractInstance.get(processId))
            expect(processData1.mode).to.eq(mode)
            expect(processData1.status).to.eq(ProcessStatus.ENDED, "The process should be ended")
            expect(processData1.entityAddress).to.eq(entityAccount.address)
            expect(processData1.censusMerkleRoot).to.eq(DEFAULT_MERKLE_ROOT)
            expect(processData1.censusMerkleTree).to.eq(DEFAULT_MERKLE_TREE_CONTENT_HASHED_URI)

            // 2 - CANCELED

            mode = ProcessMode.make({ interruptible: true, dynamicCensus: true })
            contractInstance = await new ProcessBuilder().withMode(mode).build()
            processId = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE)
            // one is already created by the builder

            const processData2 = unwrapProcessState(await contractInstance.get(processId))
            expect(processData2.status).to.eq(ProcessStatus.PAUSED, "The process should be paused")

            tx = await contractInstance.setStatus(processId, ProcessStatus.CANCELED)
            await tx.wait()

            // Try to update it
            try {
                tx = await contractInstance.setCensus(processId, "123412341234", "345634563456")
                await tx.wait()
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert Process terminated/, "The transaction threw an unexpected error:\n" + err.message)
            }

            const processData3 = unwrapProcessState(await contractInstance.get(processId))
            expect(processData3.mode).to.eq(mode)
            expect(processData3.status).to.eq(ProcessStatus.CANCELED, "The process should be canceled")
            expect(processData3.entityAddress).to.eq(entityAccount.address)
            expect(processData3.censusMerkleRoot).to.eq(DEFAULT_MERKLE_ROOT)
            expect(processData3.censusMerkleTree).to.eq(DEFAULT_MERKLE_TREE_CONTENT_HASHED_URI)

            // 3 - RESULTS

            mode = ProcessMode.make({ interruptible: true, dynamicCensus: true })
            contractInstance = await new ProcessBuilder().withMode(mode).build()
            processId = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE)
            // one is already created by the builder

            const processData4 = unwrapProcessState(await contractInstance.get(processId))
            expect(processData4.status).to.eq(ProcessStatus.PAUSED, "The process should be paused")

            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addOracle(DEFAULT_NAMESPACE, authorizedOracleAccount1.address)
            await tx.wait()

            contractInstance = contractInstance.connect(authorizedOracleAccount1.wallet) as any
            tx = await contractInstance.setResults(processId, "{}")
            await tx.wait()

            contractInstance = contractInstance.connect(entityAccount.wallet) as any

            // Try to update it
            try {
                tx = await contractInstance.setCensus(processId, "123412341234", "345634563456")
                await tx.wait()
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert Process terminated/, "The transaction threw an unexpected error:\n" + err.message)
            }

            const processData5 = unwrapProcessState(await contractInstance.get(processId))
            expect(processData5.mode).to.eq(mode)
            expect(processData5.status).to.eq(ProcessStatus.RESULTS, "The process should have results")
            expect(processData5.entityAddress).to.eq(entityAccount.address)
            expect(processData5.censusMerkleRoot).to.eq(DEFAULT_MERKLE_ROOT)
            expect(processData5.censusMerkleTree).to.eq(DEFAULT_MERKLE_TREE_CONTENT_HASHED_URI)
        })

        it("Should emit an event")
    })

    describe("Process Results", () => {
        const results = '{"results":{"A":1234,"B":2345,"C":3456}}'

        it("should be accepted when the sender is a registered oracle", async () => {
            const processId = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE)

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
            tx = await contractInstance.addOracle(DEFAULT_NAMESPACE, authorizedOracleAccount1.address)
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
            tx = await contractInstance.addOracle(DEFAULT_NAMESPACE, authorizedOracleAccount1.address)
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
            const processId = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE)

            // One is already created by the builder

            // Cancel the process
            tx = await contractInstance.setStatus(processId, ProcessStatus.CANCELED)
            await tx.wait()

            // Register an oracle
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addOracle(DEFAULT_NAMESPACE, authorizedOracleAccount1.address)
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
            const processId = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE)

            // One is already created by the builder

            // Register an oracle
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addOracle(DEFAULT_NAMESPACE, authorizedOracleAccount1.address)
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
                const processId1 = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE)
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
                    expect(err.message).to.match(/revert Not oracle/, "The transaction threw an unexpected error:\n" + err.message)
                }

                const processData5 = unwrapProcessState(await contractInstance.get(processId1))
                expect(processData5.entityAddress).to.eq(entityAccount.address)
                expect(processData5.status).to.eq(ProcessStatus.READY, "The process should be ready")

                // Set the RESULTS (now oracle)
                contractInstance = contractInstance.connect(deployAccount.wallet) as any
                tx = await contractInstance.addOracle(DEFAULT_NAMESPACE, account.address)
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
            const processId = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE)

            // One is already created by the builder

            // Register an oracle
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addOracle(DEFAULT_NAMESPACE, authorizedOracleAccount1.address)
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
            const processId1 = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE)

            // Register an oracle
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addOracle(DEFAULT_NAMESPACE, authorizedOracleAccount1.address)
            await tx.wait()

            // one is already created by the builder

            contractInstance = contractInstance.connect(authorizedOracleAccount1.wallet) as any
            const result: { processId: string } = await new Promise((resolve, reject) => {
                contractInstance.on("ResultsAvailable", (processId: string) => resolve({ processId }))
                contractInstance.setResults(processId1, results).then(tx => tx.wait()).catch(reject)
            })

            expect(result).to.be.ok
            expect(result.processId).to.equal(processId1)
        }).timeout(5000)
    })

})

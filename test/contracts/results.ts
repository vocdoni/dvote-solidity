import "mocha" // using @types/mocha
import { expect } from "chai"
import { Contract, ContractFactory, ContractTransaction } from "ethers"
import { addCompletionHooks } from "../utils/mocha-hooks"
import { getAccounts, TestAccount } from "../utils"
import { GenesisContractMethods, ProcessContractMethods, ProcessContractParameters, ProcessMode, ProcessStatus, ResultsContractMethods } from "../../lib"

import ProcessBuilder, { DEFAULT_RESULTS_HEIGHT, DEFAULT_RESULTS_TALLY, DEFAULT_ETH_CHAIN_ID } from "../builders/process"
import ResultsBuilder from "../builders/results"
import GenesisBuilder from "../builders/genesis"
import { abi as resultsAbi, bytecode as resultsByteCode } from "../../build/results.json"

const DEFAULT_VOCHAIN_ID = 0

let accounts: TestAccount[]
let deployAccount: TestAccount
let entityAccount: TestAccount
let randomAccount1: TestAccount
let randomAccount2: TestAccount
let authorizedOracleAccount1: TestAccount
let authorizedOracleAccount2: TestAccount
let contractInstance: ResultsContractMethods & Contract
let tx: ContractTransaction

let processesInstance: Contract & ProcessContractMethods

addCompletionHooks()

const emptyArray: Array<number> = []


describe("Results contract", () => {
    beforeEach(async () => {
        accounts = getAccounts()
        deployAccount = accounts[0]
        entityAccount = accounts[1]
        randomAccount1 = accounts[2]
        randomAccount2 = accounts[3]
        authorizedOracleAccount1 = accounts[4]
        authorizedOracleAccount2 = accounts[5]

        tx = null

        const genesisInstance = await new GenesisBuilder().withOracles([authorizedOracleAccount1.address, authorizedOracleAccount2.address]).build()
        contractInstance = await new ResultsBuilder().withGenesisAddress(genesisInstance.address).build()
        processesInstance = await new ProcessBuilder().withMode(ProcessMode.make({ autoStart: true, interruptible: true })).build()
        tx = await contractInstance.setProcessesAddress(processesInstance.address)
        await tx.wait()
    })

    it("should deploy the contract", async () => {
        const genesisInstance = await new GenesisBuilder().build()
        const contractFactory = new ContractFactory(resultsAbi, resultsByteCode)
        const localInstance1: Contract & GenesisContractMethods = await contractFactory.deploy(genesisInstance.address) as Contract & GenesisContractMethods

        expect(localInstance1).to.be.ok
        expect(localInstance1.address).to.match(/^0x[0-9a-fA-F]{40}$/)

        const localInstance2: Contract & GenesisContractMethods = await contractFactory.deploy(genesisInstance.address) as Contract & GenesisContractMethods

        expect(localInstance2).to.be.ok
        expect(localInstance2.address).to.match(/^0x[0-9a-fA-F]{40}$/)
        expect(localInstance2.address).to.not.eq(localInstance1.address)
    })

    it("should only allow the creator to update the process contract address", async () => {
        let oldAddress = processesInstance.address
        expect(await contractInstance.processesAddress()).to.eq(oldAddress)

        // should fail to update
        processesInstance = await new ProcessBuilder().build()
        expect(processesInstance.address).to.not.eq(oldAddress)
        expect(() => contractInstance.setProcessesAddress(processesInstance.address)).to.throw

        // Should remain
        expect(await contractInstance.processesAddress()).to.eq(oldAddress)

        // As Oracle
        contractInstance = contractInstance.connect(randomAccount1.wallet) as any
        tx = await contractInstance.setProcessesAddress(processesInstance.address)
        await tx.wait()

        // Should have changed
        expect(await contractInstance.processesAddress()).to.eq(processesInstance.address)
    })

    it("should reject publishing results without a valid processes contract defined", async () => {
        contractInstance = await new ResultsBuilder().build()

        // no processes contract
        contractInstance = contractInstance.connect(authorizedOracleAccount1.wallet) as any

        const processId = await processesInstance.getProcessId(entityAccount.address, 0, DEFAULT_VOCHAIN_ID, DEFAULT_ETH_CHAIN_ID)

        try {
            tx = await contractInstance.setResults(processId, DEFAULT_RESULTS_TALLY, DEFAULT_RESULTS_HEIGHT, DEFAULT_VOCHAIN_ID)
            throw new Error("The transaction should have thrown an error but didn't")
        }
        catch (err) {
            expect(err.message).to.match(/revert Invalid processesAddr/, "The transaction threw an unexpected error:\n" + err.message)
        }
    })

    it("getting the results of a non-existent process should fail", async () => {
        for (let i = 0; i < 5; i++) {
            const procId = await processesInstance.getProcessId("0x0000000000000000000000000000000000000000", 10000, 100, 100)

            try {
                await contractInstance.getResults(procId)
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert Not found/, "The transaction threw an unexpected error:\n" + err.message)
            }
        }
    })

    it("setting results on a non-existent process should fail", async () => {
        contractInstance = contractInstance.connect(authorizedOracleAccount1.wallet) as any

        for (let i = 0; i < 5; i++) {
            const procId = await processesInstance.getProcessId("0x0000000000000000000000000000000000000000", 10000, 100, 100)

            try {
                await contractInstance.setResults(procId, DEFAULT_RESULTS_TALLY, DEFAULT_RESULTS_HEIGHT, DEFAULT_VOCHAIN_ID)
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert Not found/, "The transaction threw an unexpected error:\n" + err.message)
            }
        }
    })

    it("should be accepted when the sender is a registered oracle", async () => {
        const genesisInstance = await new GenesisBuilder().withOracles([authorizedOracleAccount1.address, authorizedOracleAccount2.address]).build()
        contractInstance = await new ResultsBuilder().withGenesisAddress(genesisInstance.address).build()
        processesInstance = await new ProcessBuilder().build()
        tx = await contractInstance.setProcessesAddress(processesInstance.address)
        await tx.wait()

        const processId = await processesInstance.getProcessId(entityAccount.address, 0, DEFAULT_VOCHAIN_ID, DEFAULT_ETH_CHAIN_ID)

        // One is already created by the builder

        // Attempt to publish the results by someone else
        try {
            contractInstance = contractInstance.connect(randomAccount1.wallet) as any
            tx = await contractInstance.setResults(processId, DEFAULT_RESULTS_TALLY, DEFAULT_RESULTS_HEIGHT, DEFAULT_VOCHAIN_ID)
            throw new Error("The transaction should have thrown an error but didn't")
        }
        catch (err) {
            expect(err.message).to.match(/revert Not oracle/, "The transaction threw an unexpected error:\n" + err.message)
        }

        // Get results
        const result2 = await contractInstance.getResults(processId)
        expect(result2.tally).to.deep.eq(emptyArray, "There should be no results")
        expect(result2.height).to.eq(0, "There should be no votes")

        // Register an oracle
        tx = await genesisInstance.addOracle(DEFAULT_VOCHAIN_ID, randomAccount1.address)
        await tx.wait()

        // Publish the results
        contractInstance = contractInstance.connect(randomAccount1.wallet) as any
        tx = await contractInstance.setResults(processId, DEFAULT_RESULTS_TALLY, DEFAULT_RESULTS_HEIGHT, DEFAULT_VOCHAIN_ID)
        await tx.wait()

        // Get results
        const result4 = await contractInstance.getResults(processId)
        expect(result4.tally).to.deep.eq(DEFAULT_RESULTS_TALLY, "The results should match")
        expect(result4.height).to.eq(DEFAULT_RESULTS_HEIGHT, "The results should match")
    }).timeout(6000)

    it("should be accepted only if the processId exists", async () => {
        const nonExistingProcessId1 = "0x0123456789012345678901234567890123456789012345678901234567890123"
        const nonExistingProcessId2 = "0x1234567890123456789012345678901234567890123456789012345678901234"

        try {
            // Try to publish
            contractInstance = contractInstance.connect(authorizedOracleAccount1.wallet) as any
            tx = await contractInstance.setResults(nonExistingProcessId1, DEFAULT_RESULTS_TALLY, DEFAULT_RESULTS_HEIGHT, DEFAULT_VOCHAIN_ID)
            await tx.wait()
            throw new Error("The transaction should have thrown an error but didn't")
        }
        catch (err) {
            expect(err.message).to.match(/revert Not found/, "The transaction threw an unexpected error:\n" + err.message)
        }

        try {
            // Try to publish
            contractInstance = contractInstance.connect(authorizedOracleAccount1.wallet) as any
            tx = await contractInstance.setResults(nonExistingProcessId2, DEFAULT_RESULTS_TALLY, DEFAULT_RESULTS_HEIGHT, DEFAULT_VOCHAIN_ID)
            await tx.wait()
            throw new Error("The transaction should have thrown an error but didn't")
        }
        catch (err) {
            expect(err.message).to.match(/revert Not found/, "The transaction threw an unexpected error:\n" + err.message)
        }
    })

    it("should not be accepted when the process is canceled", async () => {
        const processId = await processesInstance.getProcessId(entityAccount.address, 0, DEFAULT_VOCHAIN_ID, DEFAULT_ETH_CHAIN_ID)

        // One is already created by the builder

        // Cancel the process
        contractInstance = contractInstance.connect(entityAccount.wallet) as any
        tx = await processesInstance.setStatus(processId, ProcessStatus.CANCELED)
        await tx.wait()

        // Attempt to publish the results after canceling
        try {
            contractInstance = contractInstance.connect(authorizedOracleAccount1.wallet) as any
            tx = await contractInstance.setResults(processId, DEFAULT_RESULTS_TALLY, DEFAULT_RESULTS_HEIGHT, DEFAULT_ETH_CHAIN_ID)
            throw new Error("The transaction should have thrown an error but didn't")
        }
        catch (err) {
            expect(err.message).to.match(/revert Canceled/, "The transaction threw an unexpected error:\n" + err.message)
        }

        // Get results
        const result4 = await contractInstance.getResults(processId)
        expect(result4.tally).to.deep.eq(emptyArray, "There should be no results")
        expect(result4.height).to.eq(0, "There should be no votes")
    }).timeout(5000)

    it("should retrieve the submited results", async () => {
        const processId = await processesInstance.getProcessId(entityAccount.address, 0, DEFAULT_VOCHAIN_ID, DEFAULT_ETH_CHAIN_ID)

        // One is already created by the builder

        // Publish the results
        contractInstance = contractInstance.connect(authorizedOracleAccount1.wallet) as any
        tx = await contractInstance.setResults(processId, DEFAULT_RESULTS_TALLY, DEFAULT_RESULTS_HEIGHT, DEFAULT_VOCHAIN_ID)

        // Get results
        const result3 = await contractInstance.getResults(processId)
        expect(result3.tally).to.deep.eq(DEFAULT_RESULTS_TALLY, "The tally of the results should match")
        expect(result3.height).to.eq(DEFAULT_RESULTS_HEIGHT, "The height of the results should match")

    }).timeout(5000)

    it("should allow oracles to set the results", async () => {
        for (let account of [authorizedOracleAccount1, authorizedOracleAccount2]) {
            const processesInstance = await new ProcessBuilder().withMode(ProcessMode.make({ autoStart: true, interruptible: true })).build()
            const processId1 = await processesInstance.getProcessId(entityAccount.address, 0, DEFAULT_VOCHAIN_ID, DEFAULT_ETH_CHAIN_ID)
            // one is already created by the builder

            const processData0 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
            expect(processData0.status.value).to.eq(ProcessStatus.READY, "The process should be ready")

            // Try to set the results (fail)
            try {
                contractInstance = contractInstance.connect(randomAccount1.wallet) as any
                tx = await contractInstance.setResults(processId1, DEFAULT_RESULTS_TALLY, DEFAULT_RESULTS_HEIGHT, DEFAULT_VOCHAIN_ID)
                await tx.wait()
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert Not oracle/, "The transaction threw an unexpected error:\n" + err.message)
            }

            const processData5 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
            expect(processData5.entityAddress).to.eq(entityAccount.address)
            expect(processData5.status.value).to.eq(ProcessStatus.READY, "The process should be ready")

            // Set the RESULTS (now oracle)
            contractInstance = contractInstance.connect(account.wallet) as any
            tx = await contractInstance.setResults(processId1, DEFAULT_RESULTS_TALLY, DEFAULT_RESULTS_HEIGHT, DEFAULT_VOCHAIN_ID)
            await tx.wait()

            const processData1 = ProcessContractParameters.fromContract(await processesInstance.get(processId1))
            expect(processData1.entityAddress).to.eq(entityAccount.address)
            expect(processData1.status.value).to.eq(ProcessStatus.RESULTS, "The process should be in results")
        }
    })

    it("should prevent publishing twice", async () => {
        const processId = await processesInstance.getProcessId(entityAccount.address, 0, DEFAULT_VOCHAIN_ID, DEFAULT_ETH_CHAIN_ID)

        // One is already created by the builder

        // publish results
        contractInstance = contractInstance.connect(authorizedOracleAccount1.wallet) as any
        tx = await contractInstance.setResults(processId, DEFAULT_RESULTS_TALLY, DEFAULT_RESULTS_HEIGHT, DEFAULT_VOCHAIN_ID)

        // Get results
        const result3 = await contractInstance.getResults(processId)
        expect(result3.tally).to.deep.eq(DEFAULT_RESULTS_TALLY, "The tally of the results should match")
        expect(result3.height).to.eq(DEFAULT_RESULTS_HEIGHT, "The height of the results should match")

        const processData1 = ProcessContractParameters.fromContract(await processesInstance.get(processId))
        expect(processData1.entityAddress).to.eq(entityAccount.address)
        expect(processData1.status.value).to.eq(ProcessStatus.RESULTS, "The process should be in results")

        // Try update the results
        try {
            contractInstance = contractInstance.connect(authorizedOracleAccount1.wallet) as any
            tx = await contractInstance.setResults(processId, DEFAULT_RESULTS_TALLY, DEFAULT_RESULTS_HEIGHT, DEFAULT_VOCHAIN_ID)
            throw new Error("The transaction should have thrown an error but didn't")
        }
        catch (err) {
            expect(err.message).to.match(/revert Already set/, "The transaction threw an unexpected error:\n" + err.message)
        }

        // Get results
        const result4 = await contractInstance.getResults(processId)
        expect(result4.tally).to.deep.eq(DEFAULT_RESULTS_TALLY, "The tally of the results should match")
        expect(result4.height).to.eq(DEFAULT_RESULTS_HEIGHT, "The height of the results should match")

        const processData2 = ProcessContractParameters.fromContract(await processesInstance.get(processId))
        expect(processData2.entityAddress).to.eq(entityAccount.address)
        expect(processData2.status.value).to.eq(ProcessStatus.RESULTS, "The process should be in results")
    }).timeout(5000)

    it("should emit an event", async () => {
        const processId1 = await processesInstance.getProcessId(entityAccount.address, 0, DEFAULT_VOCHAIN_ID, DEFAULT_ETH_CHAIN_ID)

        // one is already created by the builder

        contractInstance = contractInstance.connect(authorizedOracleAccount1.wallet) as any
        const result: { processId: string } = await new Promise((resolve, reject) => {
            contractInstance.on("ResultsAvailable", (processId: string) => resolve({ processId }))
            contractInstance.setResults(processId1, DEFAULT_RESULTS_TALLY, DEFAULT_RESULTS_HEIGHT, DEFAULT_VOCHAIN_ID).then(tx => tx.wait()).catch(reject)
        })

        expect(result).to.be.ok
        expect(result.processId).to.equal(processId1)
    }).timeout(5000)
})


import "mocha" // using @types/mocha
import { expect } from "chai"
import { Contract, Wallet, ContractFactory, ContractTransaction, utils } from "ethers"
import { addCompletionHooks } from "../utils/mocha-hooks"
import { getAccounts, TestAccount } from "../utils"
import { ProcessContractMethods, ProcessStatus, ProcessEnvelopeType, ProcessMode, ProcessContractParameters, ProcessResults, NamespaceContractMethods, ProcessCensusOrigin } from "../../lib"

import ProcessBuilder, { DEFAULT_NAMESPACE, DEFAULT_PARAMS_SIGNATURE, DEFAULT_RESULTS_HEIGHT, DEFAULT_RESULTS_TALLY } from "../builders/process"
import NamespaceBuilder from "../builders/namespace"
import TokenStorageProofBuilder from "../builders/token-storage-proof"

import { abi as processAbi, bytecode as processByteCode } from "../../build/processes.json"

let accounts: TestAccount[]
let deployAccount: TestAccount
let entityAccount: TestAccount
let randomAccount1: TestAccount
let randomAccount2: TestAccount
let authorizedOracleAccount1: TestAccount
let authorizedOracleAccount1Signature: string
let authorizedOracleAccount2: TestAccount
let processId: string
let contractInstance: ProcessContractMethods & Contract
let tx: ContractTransaction

const nullAddress = "0x0000000000000000000000000000000000000000"
const emptyArray: Array<number> = []

addCompletionHooks()

describe("Chainable Process contract", () => {
    beforeEach(async () => {
        accounts = getAccounts()
        deployAccount = accounts[0]
        entityAccount = accounts[1]
        randomAccount1 = accounts[2]
        randomAccount2 = accounts[3]
        authorizedOracleAccount1 = accounts[4]
        authorizedOracleAccount2 = accounts[5]

        tx = null

        contractInstance = await new ProcessBuilder().build()
        processId = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE)
    })

    it("should fail deploying if the predecessor address is not a contract", async () => {
        const namespaceInstance = await new NamespaceBuilder().build()
        const storageProofAddress = (await new TokenStorageProofBuilder().build()).address

        const contractFactory = new ContractFactory(processAbi, processByteCode, entityAccount.wallet)

        try {
            await contractFactory.deploy(Wallet.createRandom().address, namespaceInstance.address, storageProofAddress) as Contract & ProcessContractMethods

            throw new Error("The transaction should have thrown an error but didn't")
        }
        catch (err) {
            expect(err.message).to.match(/revert Invalid predecessor/, "The transaction threw an unexpected error:\n" + err.message)
        }

        try {
            await contractFactory.deploy(Wallet.createRandom().address, namespaceInstance.address, storageProofAddress) as Contract & ProcessContractMethods

            throw new Error("The transaction should have thrown an error but didn't")
        }
        catch (err) {
            expect(err.message).to.match(/revert Invalid predecessor/, "The transaction threw an unexpected error:\n" + err.message)
        }
    })

    describe("Instance forking", () => {
        it("should allow to deploy a contract with no predecessorAddress", async () => {
            const namespaceInstance1 = await new NamespaceBuilder().build()
            const storageProofAddress = (await new TokenStorageProofBuilder().build()).address

            const contractFactory = new ContractFactory(processAbi, processByteCode, entityAccount.wallet)
            const localInstance1: Contract & ProcessContractMethods = await contractFactory.deploy(nullAddress, namespaceInstance1.address, storageProofAddress) as Contract & ProcessContractMethods

            expect(localInstance1).to.be.ok
            expect(localInstance1.address).to.match(/^0x[0-9a-fA-F]{40}$/)
            expect(await localInstance1.predecessorAddress()).to.eq(nullAddress)
        })

        it("should not allow to deploy with itself as a predecessor", async () => {
            const namespaceInstance1 = await new NamespaceBuilder().build()
            const storageProofAddress = (await new TokenStorageProofBuilder().build()).address

            // Compute the address that the next contract deployed will get
            const nextContractDeployAddress = utils.getContractAddress({
                from: entityAccount.address,
                nonce: await contractInstance.provider.getTransactionCount(entityAccount.address)
            })

            const contractFactory = new ContractFactory(processAbi, processByteCode, entityAccount.wallet)

            // Try to deploy with ourselves as the parent
            try {
                await contractFactory.deploy(nextContractDeployAddress, namespaceInstance1.address, storageProofAddress) as Contract & ProcessContractMethods

                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert Can't be itself/, "The transaction threw an unexpected error:\n" + err.message)
            }
        })

        it("should retrieve the predecessorAddress if set", async () => {
            const predecessorAddress = (await new ProcessBuilder().build()).address
            const storageProofAddress = (await new TokenStorageProofBuilder().build()).address

            expect(contractInstance).to.be.ok
            expect(contractInstance.address).to.match(/^0x[0-9a-fA-F]{40}$/)
            expect(await contractInstance.predecessorAddress()).to.eq(nullAddress)

            // create manually
            const namespaceInstance1 = await new NamespaceBuilder().build()
            const contractFactory = new ContractFactory(processAbi, processByteCode, entityAccount.wallet)
            contractInstance = await contractFactory.deploy(predecessorAddress, namespaceInstance1.address, storageProofAddress) as Contract & ProcessContractMethods

            expect(contractInstance).to.be.ok
            expect(contractInstance.address).to.match(/^0x[0-9a-fA-F]{40}$/)
            expect(await contractInstance.predecessorAddress()).to.eq(predecessorAddress)
        })

        it("should retrieve the successorAddress if set", async () => {
            expect(await contractInstance.predecessorAddress()).to.eq(nullAddress)

            const processInstanceOld = (await new ProcessBuilder().build()).connect(deployAccount.wallet) as Contract & ProcessContractMethods
            const processInstanceNew = await new ProcessBuilder().withPredecessor(processInstanceOld.address).build(0)

            await processInstanceOld.activateSuccessor(processInstanceNew.address)

            expect(await processInstanceOld.successorAddress()).to.eq(processInstanceNew.address)
            expect(await processInstanceNew.predecessorAddress()).to.eq(processInstanceOld.address)
        })

        it("should have no successor by default", async () => {
            const predecessorAddress = (await new ProcessBuilder().build()).address
            const storageProofAddress = (await new TokenStorageProofBuilder().build()).address

            expect(contractInstance).to.be.ok
            expect(contractInstance.address).to.match(/^0x[0-9a-fA-F]{40}$/)
            expect(await contractInstance.successorAddress()).to.eq(nullAddress)

            // create manually
            const namespaceInstance1 = await new NamespaceBuilder().build()
            const contractFactory = new ContractFactory(processAbi, processByteCode, entityAccount.wallet)
            contractInstance = await contractFactory.deploy(predecessorAddress, namespaceInstance1.address, storageProofAddress) as Contract & ProcessContractMethods

            expect(contractInstance).to.be.ok
            expect(contractInstance.address).to.match(/^0x[0-9a-fA-F]{40}$/)
            expect(await contractInstance.successorAddress()).to.eq(nullAddress)
        })

        it("should allow to read processes on the old instance from the new one", async () => {
            // make 3 processes on the old one
            const processInstanceOld = (await new ProcessBuilder().build(3)).connect(deployAccount.wallet) as Contract & ProcessContractMethods
            const processInstanceNew = await new ProcessBuilder().withPredecessor(processInstanceOld.address).build(0)

            await processInstanceOld.activateSuccessor(processInstanceNew.address)

            expect(await processInstanceOld.successorAddress()).to.eq(processInstanceNew.address)
            expect(await processInstanceNew.predecessorAddress()).to.eq(processInstanceOld.address)

            for (let idx of [0, 1, 2]) {
                const processId1 = await processInstanceOld.getProcessId(entityAccount.address, idx, DEFAULT_NAMESPACE)
                const processId2 = await processInstanceNew.getProcessId(entityAccount.address, idx, DEFAULT_NAMESPACE)
                expect(processId1).to.eq(processId2)

                // fetch from the new instance
                await processInstanceNew.get(processId1) // expect no err
                expect(await processInstanceNew.getParamsSignature(processId1)).to.eq(DEFAULT_PARAMS_SIGNATURE)
            }
        }).timeout(5000)

        it("should get the instance address where a process was originally created", async () => {
            const mode = ProcessMode.make({ interruptible: true, dynamicCensus: true })

            // make 3 processes on the old one
            const processInstanceOld = await new ProcessBuilder().withMode(mode).build(3) as Contract & ProcessContractMethods
            const processInstanceNew = await new ProcessBuilder().withPredecessor(processInstanceOld.address).build(0)

            // connect just now as the deployAccount
            tx = await processInstanceOld.connect(deployAccount.wallet).activateSuccessor(processInstanceNew.address)
            await tx.wait()
            // back to entityAccount

            expect(await processInstanceOld.successorAddress()).to.eq(processInstanceNew.address)
            expect(await processInstanceNew.predecessorAddress()).to.eq(processInstanceOld.address)
            expect((await processInstanceNew.activationBlock()).toNumber()).to.be.gt(0)

            for (let idx of [0, 1, 2]) {
                const processId = await processInstanceOld.getProcessId(entityAccount.address, idx, DEFAULT_NAMESPACE)

                // Check the process holder
                expect(await processInstanceNew.getCreationInstance(processId)).to.eq(processInstanceOld.address)

                // try to update it (will fail because msg.sender is no processInstanceNew.address and not entityWallet.address)
                try {
                    tx = await processInstanceNew.setStatus(processId, ProcessStatus.READY)
                    await tx.wait()
                    throw new Error("The transaction should have thrown an error but didn't")
                }
                catch (err) {
                    expect(err.message).to.match(/revert Not found: Try on predecessor/, "The transaction threw an unexpected error:\n" + err.message)
                }

                // update from processInstanceOld itself
                const state1 = ProcessContractParameters.fromContract(await processInstanceOld.get(processId))
                expect(state1.status.value).to.eq(ProcessStatus.PAUSED)

                tx = await processInstanceOld.setStatus(processId, ProcessStatus.READY)
                await tx.wait()

                const state2 = ProcessContractParameters.fromContract(await processInstanceOld.get(processId))
                expect(state2.status.value).to.eq(ProcessStatus.READY)

                tx = await processInstanceOld.setStatus(processId, ProcessStatus.ENDED)
                await tx.wait()

                const state3 = ProcessContractParameters.fromContract(await processInstanceOld.get(processId))
                expect(state3.status.value).to.eq(ProcessStatus.ENDED)
            }
        }).timeout(7000)

        it("reading from non-existing processes should fail the same from a forked instance", async () => {
            const nonExistingProcessId1 = "0x0123456789012345678901234567890123456789012345678901234567890123"
            const nonExistingProcessId2 = "0x1234567890123456789012345678901234567890123456789012345678901234"

            const processInstanceOld = await new ProcessBuilder().build() as Contract & ProcessContractMethods
            const processInstanceNew = await new ProcessBuilder().withPredecessor(processInstanceOld.address).build(0)

            // connect just now as the deployAccount
            tx = await processInstanceOld.connect(deployAccount.wallet).activateSuccessor(processInstanceNew.address)
            await tx.wait()
            // back to entityAccount

            expect(await processInstanceOld.successorAddress()).to.eq(processInstanceNew.address)
            expect(await processInstanceNew.predecessorAddress()).to.eq(processInstanceOld.address)
            expect((await processInstanceNew.activationBlock()).toNumber()).to.be.gt(0)

            try {
                // Try to read
                await processInstanceOld.get(nonExistingProcessId1)
                throw new Error("The request should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert Not found/, "The request threw an unexpected error:\n" + err.message)
            }

            try {
                // Try to read
                await processInstanceNew.get(nonExistingProcessId1)
                throw new Error("The request should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert Not found/, "The request threw an unexpected error:\n" + err.message)
            }

            try {
                // Try to read
                await processInstanceOld.get(nonExistingProcessId2)
                throw new Error("The request should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert Not found/, "The request threw an unexpected error:\n" + err.message)
            }

            try {
                // Try to read
                await processInstanceNew.get(nonExistingProcessId2)
                throw new Error("The request should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert Not found/, "The request threw an unexpected error:\n" + err.message)
            }

            await processInstanceOld.get(processId) // should work
            await processInstanceNew.get(processId) // should work
        })

        it("getEntityProcessCount should count both new and old processes", async () => {
            const processInstance1 = await new ProcessBuilder().build(3)
            const processInstance2 = await new ProcessBuilder().withPredecessor(processInstance1.address).build(0)
            const processInstance3 = await new ProcessBuilder().withPredecessor(processInstance2.address).build(0)

            expect((await processInstance1.getEntityProcessCount(entityAccount.address)).toNumber()).to.eq(3)
            expect((await processInstance2.getEntityProcessCount(entityAccount.address)).toNumber()).to.eq(3)
            expect((await processInstance3.getEntityProcessCount(entityAccount.address)).toNumber()).to.eq(3)

            // connect just now as the deployAccount to activate 2
            tx = await processInstance1.connect(deployAccount.wallet).activateSuccessor(processInstance2.address)
            await tx.wait()
            // back to entityAccount

            expect((await processInstance1.getEntityProcessCount(entityAccount.address)).toNumber()).to.eq(3)
            expect((await processInstance2.getEntityProcessCount(entityAccount.address)).toNumber()).to.eq(3)
            expect((await processInstance3.getEntityProcessCount(entityAccount.address)).toNumber()).to.eq(3)

            // Create two processes on processInstance2
            await ProcessBuilder.createDefaultProcess(processInstance2)
            await ProcessBuilder.createDefaultProcess(processInstance2)

            expect((await processInstance1.getEntityProcessCount(entityAccount.address)).toNumber()).to.eq(3)
            expect((await processInstance2.getEntityProcessCount(entityAccount.address)).toNumber()).to.eq(5)
            expect((await processInstance3.getEntityProcessCount(entityAccount.address)).toNumber()).to.eq(5)

            // connect just now as the deployAccount to activate 3
            tx = await processInstance2.connect(deployAccount.wallet).activateSuccessor(processInstance3.address)
            await tx.wait()
            // back to entityAccount

            expect((await processInstance1.getEntityProcessCount(entityAccount.address)).toNumber()).to.eq(3)
            expect((await processInstance2.getEntityProcessCount(entityAccount.address)).toNumber()).to.eq(5)
            expect((await processInstance3.getEntityProcessCount(entityAccount.address)).toNumber()).to.eq(5)

            // Create four processes on processInstance3
            await ProcessBuilder.createDefaultProcess(processInstance3)
            await ProcessBuilder.createDefaultProcess(processInstance3)
            await ProcessBuilder.createDefaultProcess(processInstance3)
            await ProcessBuilder.createDefaultProcess(processInstance3)

            expect((await processInstance1.getEntityProcessCount(entityAccount.address)).toNumber()).to.eq(3)
            expect((await processInstance2.getEntityProcessCount(entityAccount.address)).toNumber()).to.eq(5)
            expect((await processInstance3.getEntityProcessCount(entityAccount.address)).toNumber()).to.eq(9)
        }).timeout(7000)

        it("namespace data should stay the same after a fork", async () => {
            // This does not contribute to the code coverage, but nice to test anyway

            const namespaceInstance = await new NamespaceBuilder().withNamespace(DEFAULT_NAMESPACE).withOracles([authorizedOracleAccount1.address]).build()
            expect(await namespaceInstance.isOracle(DEFAULT_NAMESPACE, authorizedOracleAccount1.address)).to.be.true

            const processInstanceOld = await new ProcessBuilder().withNamespaceInstance(namespaceInstance.address).build() as Contract & ProcessContractMethods
            const processInstanceNew = await new ProcessBuilder().withNamespaceInstance(namespaceInstance.address).withPredecessor(processInstanceOld.address).build(0)

            // connect just now as the deployAccount
            tx = await processInstanceOld.connect(deployAccount.wallet).activateSuccessor(processInstanceNew.address)
            await tx.wait()
            // back to entityAccount

            expect(await processInstanceOld.namespaceAddress()).to.eq(namespaceInstance.address)
            expect(await processInstanceNew.namespaceAddress()).to.eq(namespaceInstance.address)

            expect(await namespaceInstance.isOracle(DEFAULT_NAMESPACE, authorizedOracleAccount1.address)).to.be.true
        })
    })

    describe("Instance activation", () => {
        // Make a dummy contract that can call the target
        const source = `
            // SPDX-License-Identifier: AGPL-3.0-or-later
            pragma solidity ^0.6.9;

            contract Caller {
                function activateSuccessor(address successor) public {
                    DummyProcess p = DummyProcess(successor);
                    p.activate();
                }
            }
            contract DummyProcess { function activate() public {} }
        `
        const solc = require("solc")
        const output = solc.compile(JSON.stringify({
            language: "Solidity",
            sources: { "dummy.sol": { content: source } },
            settings: { outputSelection: { "*": { "*": ["*"] } } }
        }))
        const { contracts } = JSON.parse(output)
        const callerAbi = contracts["dummy.sol"].Caller.abi
        const callerBytecode = contracts["dummy.sol"].Caller.evm.bytecode.object

        it("should retrieve the activationBlock if set", async () => {
            const predecessorAddress = (await new ProcessBuilder().build()).address
            const storageProofAddress = (await new TokenStorageProofBuilder().build()).address

            expect(await contractInstance.predecessorAddress()).to.eq(nullAddress)
            expect((await contractInstance.activationBlock()).toNumber()).to.be.gt(0)

            // create manually
            const namespaceInstance1 = await new NamespaceBuilder().build()
            const contractFactory = new ContractFactory(processAbi, processByteCode, entityAccount.wallet)
            contractInstance = await contractFactory.deploy(predecessorAddress, namespaceInstance1.address, storageProofAddress) as Contract & ProcessContractMethods

            expect(contractInstance).to.be.ok
            expect(contractInstance.address).to.match(/^0x[0-9a-fA-F]{40}$/)
            expect(await contractInstance.predecessorAddress()).to.eq(predecessorAddress)
            expect((await contractInstance.activationBlock()).toNumber()).to.eq(0)
        })

        it("should not allow to create new processes before it has been activated", async () => {
            // Create a successor
            const processInstanceOld = await new ProcessBuilder().build() as Contract & ProcessContractMethods
            const processInstanceNew = await new ProcessBuilder().withPredecessor(processInstanceOld.address).build(0)

            // try to create (not active yet)
            try {
                await ProcessBuilder.createDefaultProcess(processInstanceNew)

                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert Inactive/, "The transaction threw an unexpected error:\n" + err.message)
            }
        })

        it("should allow to create new processes after the predecessor activates it", async () => {
            // Create a successor
            const processInstanceOld = await new ProcessBuilder().build() as Contract & ProcessContractMethods
            const processInstanceNew = await new ProcessBuilder().withPredecessor(processInstanceOld.address).build(0)

            // connect just now as the deployAccount
            tx = await processInstanceOld.connect(deployAccount.wallet).activateSuccessor(processInstanceNew.address)
            await tx.wait()
            // back to entityAccount

            expect(await processInstanceOld.successorAddress()).to.eq(processInstanceNew.address)
            expect(await processInstanceNew.predecessorAddress()).to.eq(processInstanceOld.address)
            expect((await processInstanceNew.activationBlock()).toNumber()).to.be.gt(0)

            await ProcessBuilder.createDefaultProcess(processInstanceNew) // should work fine
        })

        it("should not allow to create new processes after a successor has been activated", async () => {
            // Create a successor
            const processInstanceOld = await new ProcessBuilder().build() as Contract & ProcessContractMethods
            const processInstanceNew = await new ProcessBuilder().withPredecessor(processInstanceOld.address).build(0)

            // connect just now as the deployAccount
            tx = await processInstanceOld.connect(deployAccount.wallet).activateSuccessor(processInstanceNew.address)
            await tx.wait()
            // back to entityAccount

            expect(await processInstanceOld.successorAddress()).to.eq(processInstanceNew.address)
            expect(await processInstanceNew.predecessorAddress()).to.eq(processInstanceOld.address)
            expect((await processInstanceNew.activationBlock()).toNumber()).to.be.gt(0)

            // try to create (a successor is live)
            try {
                await ProcessBuilder.createDefaultProcess(processInstanceOld)

                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert Inactive/, "The transaction threw an unexpected error:\n" + err.message)
            }
        })

        it("should not allow to update the census after a successor has been activated", async () => {
            const mode = ProcessMode.make({ dynamicCensus: true })

            // Create a successor
            const processInstanceOld = await new ProcessBuilder().withMode(mode).build() as Contract & ProcessContractMethods
            const processInstanceNew = await new ProcessBuilder().withPredecessor(processInstanceOld.address).build(0)

            // connect just now as the deployAccount
            tx = await processInstanceOld.connect(deployAccount.wallet).activateSuccessor(processInstanceNew.address)
            await tx.wait()
            // back to entityAccount

            expect(await processInstanceOld.successorAddress()).to.eq(processInstanceNew.address)
            expect(await processInstanceNew.predecessorAddress()).to.eq(processInstanceOld.address)
            expect((await processInstanceNew.activationBlock()).toNumber()).to.be.gt(0)

            // try to update (a successor is live)
            try {
                tx = await processInstanceOld.setCensus(processId, "some-census", "more-merkle-data")
                await tx.wait()

                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert Inactive/, "The transaction threw an unexpected error:\n" + err.message)
            }
        })

        it("should allow to update the status, questionIndex and results after a successor has been activated", async () => {
            const mode = ProcessMode.make({ interruptible: true, dynamicCensus: true })
            const envelopeType = ProcessEnvelopeType.SERIAL

            // Create a successor
            const processInstanceOld = await new ProcessBuilder().withMode(mode).withEnvelopeType(envelopeType).withOracle(authorizedOracleAccount1.address).build() as Contract & ProcessContractMethods
            const processInstanceNew = await new ProcessBuilder().withPredecessor(processInstanceOld.address).build(0)

            // connect just now as the deployAccount
            tx = await processInstanceOld.connect(deployAccount.wallet).activateSuccessor(processInstanceNew.address)
            await tx.wait()
            // back to entityAccount

            expect(await processInstanceOld.successorAddress()).to.eq(processInstanceNew.address)
            expect(await processInstanceNew.predecessorAddress()).to.eq(processInstanceOld.address)
            expect((await processInstanceNew.activationBlock()).toNumber()).to.be.gt(0)

            // perform updates on the old instance
            tx = await processInstanceOld.setStatus(processId, ProcessStatus.READY) // should work fine
            await tx.wait()
            tx = await processInstanceOld.incrementQuestionIndex(processId) // should work fine
            await tx.wait()
            // connect just now as the oracle1
            tx = await processInstanceOld.connect(authorizedOracleAccount1.wallet).setResults(processId, DEFAULT_RESULTS_TALLY, DEFAULT_RESULTS_HEIGHT) // should work fine
            await tx.wait()

            expect(await (await processInstanceOld.getResults(processId)).tally).to.deep.eq(DEFAULT_RESULTS_TALLY)
        })

        it("only the predecessor should be able to activate a new contract", async () => {
            // Create a predecessor + successor and two random extras
            const processInstanceOld = await new ProcessBuilder().build() as Contract & ProcessContractMethods
            const processInstanceNew = await new ProcessBuilder().withPredecessor(processInstanceOld.address).build(0)

            const processInstanceRandom = await new ProcessBuilder().build() as Contract & ProcessContractMethods

            const randomCallerFactory = new ContractFactory(callerAbi, callerBytecode, deployAccount.wallet)
            const randomCallerInstance = await randomCallerFactory.deploy() as Contract & { activateSuccessor(addr: string): Promise<ContractTransaction> }

            // try to activate from a random wallet
            try {
                tx = await processInstanceOld.connect(randomAccount1.wallet).activate()
                await tx.wait()

                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert Unauthorized/, "The transaction threw an unexpected error:\n" + err.message)
            }

            expect(await processInstanceOld.successorAddress()).to.eq(nullAddress)
            expect(await processInstanceNew.predecessorAddress()).to.eq(processInstanceOld.address)
            expect((await processInstanceNew.activationBlock()).toNumber()).to.eq(0)

            // try to activate from a random contract
            try {
                tx = await processInstanceOld.connect(deployAccount.wallet).activateSuccessor(processInstanceRandom.address)
                await tx.wait()

                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert Unauthorized/, "The transaction threw an unexpected error:\n" + err.message)
            }

            expect(await processInstanceOld.successorAddress()).to.eq(nullAddress)
            expect(await processInstanceNew.predecessorAddress()).to.eq(processInstanceOld.address)
            expect((await processInstanceNew.activationBlock()).toNumber()).to.eq(0)

            // try to activate from a random contract
            try {
                tx = await randomCallerInstance.activateSuccessor(processInstanceNew.address)
                await tx.wait()

                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert Unauthorized/, "The transaction threw an unexpected error:\n" + err.message)
            }

            expect(await processInstanceOld.successorAddress()).to.eq(nullAddress)
            expect(await processInstanceNew.predecessorAddress()).to.eq(processInstanceOld.address)
            expect((await processInstanceNew.activationBlock()).toNumber()).to.eq(0)

            // connect just now as the deployAccount
            // call old.activateSuccessor() => new.activate()
            tx = await processInstanceOld.connect(deployAccount.wallet).activateSuccessor(processInstanceNew.address)
            await tx.wait()
            // back to entityAccount

            expect(await processInstanceOld.successorAddress()).to.eq(processInstanceNew.address)
            expect(await processInstanceNew.predecessorAddress()).to.eq(processInstanceOld.address)
            expect((await processInstanceNew.activationBlock()).toNumber()).to.be.gt(0)
        }).timeout(6000)

        it("only the contract owner should be able to call activateSuccessor contract", async () => {
            // Create a successor
            const processInstanceOld = await new ProcessBuilder().build() as Contract & ProcessContractMethods
            const processInstanceNew = await new ProcessBuilder().withPredecessor(processInstanceOld.address).build(0)

            for (let account of [randomAccount1, randomAccount2]) {
                // try to activate
                try {
                    tx = await processInstanceOld.connect(account.wallet).activateSuccessor(processInstanceNew.address)
                    await tx.wait()

                    throw new Error("The transaction should have thrown an error but didn't")
                }
                catch (err) {
                    expect(err.message).to.match(/revert onlyContractOwner/, "The transaction threw an unexpected error:\n" + err.message)
                }
            }

            // connect just now as the deployAccount
            tx = await processInstanceOld.connect(deployAccount.wallet).activateSuccessor(processInstanceNew.address)
            await tx.wait()
            // back to entityAccount

            expect(await processInstanceOld.successorAddress()).to.eq(processInstanceNew.address)
            expect(await processInstanceNew.predecessorAddress()).to.eq(processInstanceOld.address)
            expect((await processInstanceNew.activationBlock()).toNumber()).to.be.gt(0)
        })

        it("should not allow to activate itself as a successor", async () => {
            const processInstance = await new ProcessBuilder().build()

            // try to activate ourselves
            try {
                tx = await processInstance.connect(deployAccount.wallet).activateSuccessor(processInstance.address)
                await tx.wait()

                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert Can't be itself/, "The transaction threw an unexpected error:\n" + err.message)
            }

            expect(await processInstance.successorAddress()).to.eq(nullAddress)
            expect((await processInstance.activationBlock()).toNumber()).to.be.gt(0)
        })

        it("should not allow to activate if not active itself", async () => {
            const processInstance1 = await new ProcessBuilder().build()
            const processInstance2 = await new ProcessBuilder().withPredecessor(processInstance1.address).build(0)
            const processInstance3 = await new ProcessBuilder().withPredecessor(processInstance2.address).build(0)

            // try to 3 from 2 (inactive)
            try {
                tx = await processInstance2.connect(deployAccount.wallet).activateSuccessor(processInstance3.address)
                await tx.wait()

                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert Must be active/, "The transaction threw an unexpected error:\n" + err.message)
            }
        })

        it("should fail activating with no predecessor defined", async () => {
            // Create a successor
            const processInstanceOld = await new ProcessBuilder().build() as Contract & ProcessContractMethods
            const processInstanceNew = await new ProcessBuilder().withPredecessor(nullAddress).build()

            // try to activate from the old instance to the new
            try {
                tx = await processInstanceOld.connect(deployAccount.wallet).activateSuccessor(processInstanceNew.address)
                await tx.wait()

                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert Unauthorized/, "The transaction threw an unexpected error:\n" + err.message)
            }
        })

        it("can only be deactivated once", async () => {
            // Create a successor
            const processInstanceOld = await new ProcessBuilder().build() as Contract & ProcessContractMethods
            const processInstanceNew = await new ProcessBuilder().withPredecessor(processInstanceOld.address).build(0)

            // connect just now as the deployAccount
            tx = await processInstanceOld.connect(deployAccount.wallet).activateSuccessor(processInstanceNew.address)
            await tx.wait()
            // back to entityAccount

            expect(await processInstanceOld.successorAddress()).to.eq(processInstanceNew.address)
            expect(await processInstanceNew.predecessorAddress()).to.eq(processInstanceOld.address)
            expect((await processInstanceNew.activationBlock()).toNumber()).to.be.gt(0)

            // try to deactivate the old one again
            try {
                tx = await processInstanceOld.connect(deployAccount.wallet).activateSuccessor(processInstanceNew.address)
                await tx.wait()

                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert Already inactive/, "The transaction threw an unexpected error:\n" + err.message)
            }

            expect(await processInstanceOld.successorAddress()).to.eq(processInstanceNew.address)
            expect(await processInstanceNew.predecessorAddress()).to.eq(processInstanceOld.address)
            expect((await processInstanceNew.activationBlock()).toNumber()).to.be.gt(0)
        })

        it("can only be activated once", async () => {
            const callerFactory = new ContractFactory(callerAbi, callerBytecode, deployAccount.wallet)
            const callerInstance = await callerFactory.deploy() as Contract & { activateSuccessor(addr: string): Promise<ContractTransaction> }

            // Create a successor of callerInstance
            const processInstanceNew = await new ProcessBuilder().withPredecessor(callerInstance.address).build(0)

            tx = await callerInstance.activateSuccessor(processInstanceNew.address) // should not throw
            await tx.wait()

            expect(await processInstanceNew.predecessorAddress()).to.eq(callerInstance.address)
            expect((await processInstanceNew.activationBlock()).toNumber()).to.be.gt(0)

            // try to activate again
            try {
                tx = await callerInstance.activateSuccessor(processInstanceNew.address)
                await tx.wait()

                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert Already active/, "The transaction threw an unexpected error:\n" + err.message)
            }

            expect(await processInstanceNew.predecessorAddress()).to.eq(callerInstance.address)
            expect((await processInstanceNew.activationBlock()).toNumber()).to.be.gt(0)
        }).timeout(7000)
    })
}).timeout(4000)

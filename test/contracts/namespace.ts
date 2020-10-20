
import "mocha" // using @types/mocha
import { expect } from "chai"
import { Contract, ContractFactory, ContractTransaction } from "ethers"
import { addCompletionHooks } from "../utils/mocha-hooks"
import { getAccounts, TestAccount } from "../utils"
import { NamespaceContractMethods } from "../../lib"

import NamespaceBuilder, { DEFAULT_NAMESPACE, DEFAULT_CHAIN_ID, DEFAULT_GENESIS, DEFAULT_VALIDATORS, DEFAULT_ORACLES } from "../builders/namespace"

import { abi as namespaceAbi, bytecode as namespaceByteCode } from "../../build/namespaces.json"

let accounts: TestAccount[]
let deployAccount: TestAccount
let entityAccount: TestAccount
let randomAccount1: TestAccount
let randomAccount2: TestAccount
let authorizedOracleAccount1: TestAccount
let authorizedOracleAccount2: TestAccount
let contractInstance: NamespaceContractMethods & Contract
let tx: ContractTransaction

addCompletionHooks()

describe("Namespace contract", () => {
    beforeEach(async () => {
        accounts = getAccounts()
        deployAccount = accounts[0]
        entityAccount = accounts[1]
        randomAccount1 = accounts[2]
        randomAccount2 = accounts[3]
        authorizedOracleAccount1 = accounts[4]
        authorizedOracleAccount2 = accounts[5]

        tx = null

        contractInstance = await new NamespaceBuilder().build()
    })

    it("should deploy the contract", async () => {
        const contractFactory = new ContractFactory(namespaceAbi, namespaceByteCode, entityAccount.wallet)
        const localInstance1: Contract & NamespaceContractMethods = await contractFactory.deploy() as Contract & NamespaceContractMethods

        expect(localInstance1).to.be.ok
        expect(localInstance1.address).to.match(/^0x[0-9a-fA-F]{40}$/)

        const localInstance2: Contract & NamespaceContractMethods = await contractFactory.deploy() as Contract & NamespaceContractMethods

        expect(localInstance2).to.be.ok
        expect(localInstance2.address).to.match(/^0x[0-9a-fA-F]{40}$/)
        expect(localInstance2.address).to.not.eq(localInstance1.address)
    })

    describe("Namespace management", () => {
        it("should set a whole namespace at once", async () => {
            expect(await contractInstance.getNamespace(DEFAULT_NAMESPACE)).to.deep.eq([DEFAULT_CHAIN_ID, DEFAULT_GENESIS, DEFAULT_VALIDATORS, DEFAULT_ORACLES])

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
            const chainId = "hello-chain"
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
            contractInstance = await new NamespaceBuilder().withValidators([]).build() as any
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
            contractInstance = await new NamespaceBuilder().withValidators([]).build() as any

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

        it("should fail if it is already present", async () => {
            contractInstance = await new NamespaceBuilder().withValidators([]).build() as any

            expect(await contractInstance.isValidator(DEFAULT_NAMESPACE, validatorPublicKey)).to.be.false

            // Register a validator
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addValidator(DEFAULT_NAMESPACE, validatorPublicKey)
            await tx.wait()

            // Get validator list
            expect((await contractInstance.getNamespace(DEFAULT_NAMESPACE))[2]).to.deep.eq([validatorPublicKey])

            // Check validator
            expect(await contractInstance.isValidator(DEFAULT_NAMESPACE, validatorPublicKey)).to.be.true

            // Attempt to add the validator again
            try {
                tx = await contractInstance.addValidator(DEFAULT_NAMESPACE, validatorPublicKey)
                await tx.wait()
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert Already present/, "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get validator list
            expect((await contractInstance.getNamespace(DEFAULT_NAMESPACE))[2]).to.deep.eq([validatorPublicKey])

            // Check validator
            expect(await contractInstance.isValidator(DEFAULT_NAMESPACE, validatorPublicKey)).to.be.true
        })

        it("should add the validator to the right namespace", async () => {
            contractInstance = await new NamespaceBuilder().withValidators([]).build() as any

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
            contractInstance = await new NamespaceBuilder().withValidators([]).build() as any

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

            contractInstance = await new NamespaceBuilder().withValidators([]).build() as any
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
            contractInstance = await new NamespaceBuilder().withValidators([]).build() as any
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
            // 3 by default
            expect((await contractInstance.getNamespace(DEFAULT_NAMESPACE))[2].length).to.eq(3)

            // Register validator
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addValidator(DEFAULT_NAMESPACE, validatorPublicKey)
            await tx.wait()

            const result: { validatorPublicKey: string } = await new Promise((resolve, reject) => {
                contractInstance.on("ValidatorRemoved", (validatorPublicKey: string) => {
                    resolve({ validatorPublicKey })
                })
                contractInstance.removeValidator(DEFAULT_NAMESPACE, 3, validatorPublicKey).then(tx => tx.wait()).catch(reject)
            })

            expect(result).to.be.ok
            expect(result.validatorPublicKey).to.equal(validatorPublicKey)
        }).timeout(7000)
    })

    describe("Oracle inclusion", () => {

        it("only when the contract owner requests it", async () => {
            contractInstance = await new NamespaceBuilder().withOracles([]).build() as any

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
                expect(err.message).to.match(/revert onlyContractOwner/, "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get oracle list
            expect((await contractInstance.getNamespace(DEFAULT_NAMESPACE))[3]).to.deep.eq([authorizedOracleAccount1.address])

            // Check oracle
            expect(await contractInstance.isOracle(DEFAULT_NAMESPACE, authorizedOracleAccount1.address)).to.be.true
            expect(await contractInstance.isOracle(DEFAULT_NAMESPACE, authorizedOracleAccount2.address)).to.be.false
        })

        it("should add the oracle address to the oracle list", async () => {
            contractInstance = await new NamespaceBuilder().withOracles([]).build() as any

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

        it("should fail if it is already present", async () => {
            contractInstance = await new NamespaceBuilder().withOracles([]).build() as any
            expect(await contractInstance.isOracle(DEFAULT_NAMESPACE, authorizedOracleAccount1.address)).to.be.false

            // Register the oracle
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addOracle(DEFAULT_NAMESPACE, authorizedOracleAccount1.address)
            await tx.wait()

            // Get oracle list
            expect((await contractInstance.getNamespace(DEFAULT_NAMESPACE))[3]).to.deep.eq([authorizedOracleAccount1.address])

            // Check oracle
            expect(await contractInstance.isOracle(DEFAULT_NAMESPACE, authorizedOracleAccount1.address)).to.be.true

            // Attempt to add the oracle again
            try {
                tx = await contractInstance.addOracle(DEFAULT_NAMESPACE, authorizedOracleAccount1.address)
                await tx.wait()
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert Already present/, "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get oracle list
            expect((await contractInstance.getNamespace(DEFAULT_NAMESPACE))[3]).to.deep.eq([authorizedOracleAccount1.address])

            // Check oracle
            expect(await contractInstance.isOracle(DEFAULT_NAMESPACE, authorizedOracleAccount1.address)).to.be.true
        })

        it("should add the validator to the right namespace", async () => {
            contractInstance = await new NamespaceBuilder().withOracles([]).build() as any
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
            contractInstance = await new NamespaceBuilder().withOracles([]).build() as any
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
            contractInstance = await new NamespaceBuilder().withOracles([]).build() as any

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
                expect(err.message).to.match(/revert onlyContractOwner/, "The transaction threw an unexpected error:\n" + err.message)
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
            contractInstance = await new NamespaceBuilder().withOracles([]).build() as any

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
                expect(err.message).to.match(/revert Invalid index/, "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get oracle list
            expect((await contractInstance.getNamespace(DEFAULT_NAMESPACE))[3]).to.deep.eq([authorizedOracleAccount1.address, authorizedOracleAccount2.address])

            // Check oracle
            expect(await contractInstance.isOracle(DEFAULT_NAMESPACE, authorizedOracleAccount1.address)).to.be.true
            expect(await contractInstance.isOracle(DEFAULT_NAMESPACE, authorizedOracleAccount1.address)).to.be.true
        })

        it("should fail if the idx does not match oracleAddress", async () => {
            contractInstance = await new NamespaceBuilder().withOracles([]).build() as any

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
                expect(err.message).to.match(/revert Index-key mismatch/, "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get oracle list
            expect((await contractInstance.getNamespace(DEFAULT_NAMESPACE))[3]).to.deep.eq([authorizedOracleAccount1.address, authorizedOracleAccount2.address])

            // Check oracle
            expect(await contractInstance.isOracle(DEFAULT_NAMESPACE, authorizedOracleAccount1.address)).to.be.true
            expect(await contractInstance.isOracle(DEFAULT_NAMESPACE, authorizedOracleAccount1.address)).to.be.true
        })

        it("should remove from the right namespace", async () => {
            contractInstance = await new NamespaceBuilder().withOracles([]).build() as any
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

            // 3 by default
            expect((await contractInstance.getNamespace(DEFAULT_NAMESPACE))[3].length).to.eq(3)

            // Register oracle
            tx = await contractInstance.addOracle(DEFAULT_NAMESPACE, authorizedOracleAccount1.address)
            await tx.wait()

            const result: { oracleAddress: string } = await new Promise((resolve, reject) => {
                contractInstance.on("OracleRemoved", (oracleAddress: string) => {
                    resolve({ oracleAddress })
                })
                contractInstance.removeOracle(DEFAULT_NAMESPACE, 3, authorizedOracleAccount1.address).then(tx => tx.wait()).catch(reject)
            })

            expect(result).to.be.ok
            expect(result.oracleAddress).to.equal(authorizedOracleAccount1.address)
        }).timeout(7000)
    })
}).timeout(4000)

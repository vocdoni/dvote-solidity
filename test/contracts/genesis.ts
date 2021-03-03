
import "mocha" // using @types/mocha
import { expect } from "chai"
import { Contract, ContractFactory, ContractTransaction } from "ethers"
import { addCompletionHooks } from "../utils/mocha-hooks"
import { getAccounts, TestAccount } from "../utils"
import { GenesisContractMethods } from "../../lib"

import GenesisBuilder, { DEFAULT_GENESIS, DEFAULT_VALIDATORS, DEFAULT_ORACLES } from "../builders/genesis"

import { abi as genesisAbi, bytecode as genesisByteCode } from "../../build/genesis.json"

let accounts: TestAccount[]
let deployAccount: TestAccount
let entityAccount: TestAccount
let randomAccount1: TestAccount
let randomAccount2: TestAccount
let authorizedOracleAccount1: TestAccount
let authorizedOracleAccount2: TestAccount
let contractInstance: GenesisContractMethods & Contract
let tx: ContractTransaction

addCompletionHooks()

const DEFAULT_CHAIN_ID = 0

describe("Genesis contract", () => {
    beforeEach(async () => {
        accounts = getAccounts()
        deployAccount = accounts[0]
        entityAccount = accounts[1]
        randomAccount1 = accounts[2]
        randomAccount2 = accounts[3]
        authorizedOracleAccount1 = accounts[4]
        authorizedOracleAccount2 = accounts[5]

        tx = null

        contractInstance = await new GenesisBuilder().build()
    })

    it("should deploy the contract", async () => {
        const contractFactory = new ContractFactory(genesisAbi, genesisByteCode, entityAccount.wallet)
        const localInstance1: Contract & GenesisContractMethods = await contractFactory.deploy() as Contract & GenesisContractMethods

        expect(localInstance1).to.be.ok
        expect(localInstance1.address).to.match(/^0x[0-9a-fA-F]{40}$/)

        const localInstance2: Contract & GenesisContractMethods = await contractFactory.deploy() as Contract & GenesisContractMethods

        expect(localInstance2).to.be.ok
        expect(localInstance2.address).to.match(/^0x[0-9a-fA-F]{40}$/)
        expect(localInstance2.address).to.not.eq(localInstance1.address)
    })

    describe("Chain management", () => {
        it("should register a new chain", async () => {
            const defChainData = await contractInstance.get(0)
            expect(defChainData.genesis).to.eq(DEFAULT_GENESIS)
            expect(defChainData.validators).to.deep.eq(DEFAULT_VALIDATORS)
            expect(defChainData.oracles).to.deep.eq(DEFAULT_ORACLES)
            expect(await contractInstance.isValidator(0, DEFAULT_VALIDATORS[0])).to.be.true
            expect(await contractInstance.isOracle(0, DEFAULT_ORACLES[0])).to.be.true


            contractInstance = contractInstance.connect(deployAccount.wallet) as any

            // 1
            expect(() => contractInstance.get(1)).to.throw
            tx = await contractInstance.newChain("genesis", ["0x10", "0x20"], [authorizedOracleAccount1.address])
            await tx.wait()

            const chainData1 = await contractInstance.get(1)
            expect(chainData1.genesis).to.eq("genesis")
            expect(chainData1.validators).to.deep.eq(["0x10", "0x20"])
            expect(chainData1.oracles).to.deep.eq([authorizedOracleAccount1.address])
            expect(await contractInstance.isValidator(1, "0x10")).to.be.true
            expect(await contractInstance.isValidator(1, "0x20")).to.be.true
            expect(await contractInstance.isValidator(1, "0x30")).to.be.false
            expect(await contractInstance.isValidator(1, "0x40")).to.be.false
            expect(await contractInstance.isValidator(1, authorizedOracleAccount1.address)).to.be.true
            expect(await contractInstance.isValidator(1, authorizedOracleAccount2.address)).to.be.false

            // 2
            expect(() => contractInstance.get(2)).to.throw
            tx = await contractInstance.newChain("genesis", ["0x1234", "0x2345"], [authorizedOracleAccount2.address])
            await tx.wait()

            const chainData2 = await contractInstance.get(2)
            expect(chainData2.genesis).to.eq("genesis")
            expect(chainData2.validators).to.deep.eq(["0x1234", "0x2345"])
            expect(chainData2.oracles).to.deep.eq([authorizedOracleAccount2.address])
            expect(await contractInstance.isValidator(2, "0x1234")).to.be.true
            expect(await contractInstance.isValidator(2, "0x2345")).to.be.true
            expect(await contractInstance.isValidator(2, "0x10")).to.be.false
            expect(await contractInstance.isValidator(2, "0x20")).to.be.false
            expect(await contractInstance.isValidator(2, authorizedOracleAccount2.address)).to.be.true
            expect(await contractInstance.isValidator(2, authorizedOracleAccount1.address)).to.be.false
        })

        it("should allow only the contract creator to update a chain", async () => {
            contractInstance = contractInstance.connect(randomAccount1.wallet) as any

            try {
                await contractInstance.setNamespace(10, "cid", "gen", ["0x1", "0x2", "0x3"], [authorizedOracleAccount1.address, authorizedOracleAccount2.address])
                await tx.wait()
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert onlyContractOwner/, "The transaction threw an unexpected error:\n" + err.message)
            }

            const chainData0 = await contractInstance.get(10)
            expect(chainData0[0]).to.eq("")
            expect(chainData0[1]).to.eq("")
            expect(chainData0[2]).to.deep.eq([])
            expect(chainData0[3]).to.deep.eq([])
        })

        it("should emit an event", async () => {
            contractInstance = contractInstance.connect(deployAccount.wallet) as any

            const result: { chainId: number } = await new Promise((resolve, reject) => {
                contractInstance.on("ChainRegistered", (chainId: number) => resolve({ chainId }))

                contractInstance.newChain("gen", ["0x1", "0x2", "0x3"], [authorizedOracleAccount1.address, "0x1234567890123456789012345678901234567890"]).then(tx => tx.wait()).catch(reject)
            })

            expect(result).to.be.ok
            expect(result.chainId).to.equal(1)
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
                tx = await contractInstance.setGenesis(DEFAULT_CHAIN_ID, genesis)
                await tx.wait()
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert onlyContractOwner/, "The transaction threw an unexpected error:\n" + err.message)
            }
        })

        it("should persist", async () => {
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.setGenesis(DEFAULT_CHAIN_ID, genesis)
            await tx.wait()

            let currentNamespace = await contractInstance.get(DEFAULT_CHAIN_ID)
            expect(currentNamespace[1]).to.eq(genesis, "Gensis should match")

            // Another genesis value
            tx = await contractInstance.setGenesis(DEFAULT_CHAIN_ID, "1234")
            await tx.wait()

            currentNamespace = await contractInstance.get(DEFAULT_CHAIN_ID)
            expect(currentNamespace[1]).to.eq("1234", "Gensis should match")
        })

        it("should fail if duplicated", async () => {
            contractInstance = contractInstance.connect(deployAccount.wallet) as any

            tx = await contractInstance.setGenesis(DEFAULT_CHAIN_ID, "a-genesis")
            await tx.wait()

            try {
                // same that it already is
                tx = await contractInstance.setGenesis(DEFAULT_CHAIN_ID, "a-genesis")
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

                contractInstance.setGenesis(DEFAULT_CHAIN_ID, genesis).then(tx => tx.wait()).catch(reject)
            })

            expect(result).to.be.ok
            expect(result.genesis).to.equal(genesis)
            expect(result.namespace).to.equal(DEFAULT_CHAIN_ID)
        }).timeout(7000)
    })

    describe("Validator inclusion", () => {
        const validatorPublicKey = "0x1234"
        const validatorPublicKey2 = "0x4321"

        it("only when the contract owner requests it", async () => {
            contractInstance = await new GenesisBuilder().withValidators([]).build() as any
            expect(await contractInstance.isValidator(DEFAULT_CHAIN_ID, validatorPublicKey)).to.be.false

            // Register a validator
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addValidator(DEFAULT_CHAIN_ID, validatorPublicKey)
            await tx.wait()

            // Get validator list
            expect((await contractInstance.get(DEFAULT_CHAIN_ID))[2]).to.deep.eq([validatorPublicKey])

            // Check validator
            expect(await contractInstance.isValidator(DEFAULT_CHAIN_ID, validatorPublicKey)).to.be.true

            // Attempt to add a validator by someone else
            try {
                contractInstance = contractInstance.connect(randomAccount1.wallet) as any
                tx = await contractInstance.addValidator(DEFAULT_CHAIN_ID, validatorPublicKey2)
                await tx.wait()
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert onlyContractOwner/, "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get validator list
            expect((await contractInstance.get(DEFAULT_CHAIN_ID))[2]).to.deep.eq([validatorPublicKey])

            // Check validator
            expect(await contractInstance.isValidator(DEFAULT_CHAIN_ID, validatorPublicKey2)).to.be.false
        })

        it("should add the validator public key to the validator list", async () => {
            contractInstance = await new GenesisBuilder().withValidators([]).build() as any

            // Register validator 1
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addValidator(DEFAULT_CHAIN_ID, validatorPublicKey)
            await tx.wait()

            // Get validator list
            expect((await contractInstance.get(DEFAULT_CHAIN_ID))[2]).to.deep.eq([validatorPublicKey])

            // Check validator
            expect(await contractInstance.isValidator(DEFAULT_CHAIN_ID, validatorPublicKey)).to.be.true

            // Adding validator #2
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addValidator(DEFAULT_CHAIN_ID, validatorPublicKey2)
            await tx.wait()

            // Get validator list
            expect((await contractInstance.get(DEFAULT_CHAIN_ID))[2]).to.deep.eq([validatorPublicKey, validatorPublicKey2])

            // Check validator
            expect(await contractInstance.isValidator(DEFAULT_CHAIN_ID, validatorPublicKey2)).to.be.true
        })

        it("should fail if it is already present", async () => {
            contractInstance = await new GenesisBuilder().withValidators([]).build() as any

            expect(await contractInstance.isValidator(DEFAULT_CHAIN_ID, validatorPublicKey)).to.be.false

            // Register a validator
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addValidator(DEFAULT_CHAIN_ID, validatorPublicKey)
            await tx.wait()

            // Get validator list
            expect((await contractInstance.get(DEFAULT_CHAIN_ID))[2]).to.deep.eq([validatorPublicKey])

            // Check validator
            expect(await contractInstance.isValidator(DEFAULT_CHAIN_ID, validatorPublicKey)).to.be.true

            // Attempt to add the validator again
            try {
                tx = await contractInstance.addValidator(DEFAULT_CHAIN_ID, validatorPublicKey)
                await tx.wait()
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert Already present/, "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get validator list
            expect((await contractInstance.get(DEFAULT_CHAIN_ID))[2]).to.deep.eq([validatorPublicKey])

            // Check validator
            expect(await contractInstance.isValidator(DEFAULT_CHAIN_ID, validatorPublicKey)).to.be.true
        })

        it("should add the validator to the right namespace", async () => {
            contractInstance = await new GenesisBuilder().withValidators([]).build() as any

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
                contractInstance.addValidator(DEFAULT_CHAIN_ID, validatorPublicKey).then(tx => tx.wait()).catch(reject)
            })

            expect(result).to.be.ok
            expect(result.validatorPublicKey).to.equal(validatorPublicKey)
        }).timeout(7000)
    })

    describe("Validator removal", () => {

        const validatorPublicKey = "0x1234"

        it("only when the contract owner account requests it", async () => {
            contractInstance = await new GenesisBuilder().withValidators([]).build() as any

            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addValidator(DEFAULT_CHAIN_ID, validatorPublicKey)
            await tx.wait()

            // Get validator list
            expect((await contractInstance.get(DEFAULT_CHAIN_ID))[2]).to.deep.eq([validatorPublicKey])

            // Attempt to disable the validator from someone else
            try {
                contractInstance = contractInstance.connect(randomAccount1.wallet) as any
                tx = await contractInstance.removeValidator(DEFAULT_CHAIN_ID, 0, validatorPublicKey)
                await tx.wait()
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert onlyContractOwner/, "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get validator list
            expect((await contractInstance.get(DEFAULT_CHAIN_ID))[2]).to.deep.eq([validatorPublicKey])

            // Check validator
            expect(await contractInstance.isValidator(DEFAULT_CHAIN_ID, validatorPublicKey)).to.be.true

            // Disable validator from the owner
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.removeValidator(DEFAULT_CHAIN_ID, 0, validatorPublicKey)
            await tx.wait()

            // Get validator list
            expect((await contractInstance.get(DEFAULT_CHAIN_ID))[2]).to.deep.eq([])
        })

        it("should fail if the idx does not match validatorPublicKey", async () => {
            const nonExistingValidatorPublicKey = "0x123123"

            contractInstance = await new GenesisBuilder().withValidators([]).build() as any
            contractInstance = contractInstance.connect(deployAccount.wallet) as any

            // Register a validator
            tx = await contractInstance.addValidator(DEFAULT_CHAIN_ID, validatorPublicKey)
            await tx.wait()

            // Attempt to disable mismatching validator
            try {
                tx = await contractInstance.removeValidator(DEFAULT_CHAIN_ID, 0, nonExistingValidatorPublicKey)
                await tx.wait()
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert Index-key mismatch/, "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get validator list
            expect((await contractInstance.get(DEFAULT_CHAIN_ID))[2]).to.deep.eq([validatorPublicKey])

            // Check validators
            expect(await contractInstance.isValidator(DEFAULT_CHAIN_ID, validatorPublicKey)).to.be.true
            expect(await contractInstance.isValidator(DEFAULT_CHAIN_ID, nonExistingValidatorPublicKey)).to.be.false

            // Attempt to disable non-existing validator
            try {
                tx = await contractInstance.removeValidator(DEFAULT_CHAIN_ID, 5, validatorPublicKey)
                await tx.wait()
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert Invalid index/, "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get validator list
            expect((await contractInstance.get(DEFAULT_CHAIN_ID))[2]).to.deep.eq([validatorPublicKey])

            // Check validator
            expect(await contractInstance.isValidator(DEFAULT_CHAIN_ID, validatorPublicKey)).to.be.true
        })

        it("should remove from the right namespace", async () => {
            contractInstance = await new GenesisBuilder().withValidators([]).build() as any
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
            expect((await contractInstance.get(5))[2]).to.deep.eq([validatorPublicKey])

            // Check validators
            expect(await contractInstance.isValidator(5, validatorPublicKey)).to.be.true

            // Disable from the right namespace
            tx = await contractInstance.removeValidator(5, 0, validatorPublicKey)
            await tx.wait()

            // Get validator list
            expect((await contractInstance.get(5))[2]).to.deep.eq([])

            // Check validator
            expect(await contractInstance.isValidator(5, validatorPublicKey)).to.be.false
        })

        it("should emit an event", async () => {
            // 3 by default
            expect((await contractInstance.get(DEFAULT_CHAIN_ID))[2].length).to.eq(3)

            // Register validator
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addValidator(DEFAULT_CHAIN_ID, validatorPublicKey)
            await tx.wait()

            const result: { validatorPublicKey: string } = await new Promise((resolve, reject) => {
                contractInstance.on("ValidatorRemoved", (validatorPublicKey: string) => {
                    resolve({ validatorPublicKey })
                })
                contractInstance.removeValidator(DEFAULT_CHAIN_ID, 3, validatorPublicKey).then(tx => tx.wait()).catch(reject)
            })

            expect(result).to.be.ok
            expect(result.validatorPublicKey).to.equal(validatorPublicKey)
        }).timeout(7000)
    })

    describe("Oracle inclusion", () => {

        it("only when the contract owner requests it", async () => {
            contractInstance = await new GenesisBuilder().withOracles([]).build() as any

            // Check validator
            expect(await contractInstance.isOracle(DEFAULT_CHAIN_ID, authorizedOracleAccount1.address)).to.be.false

            // Register a oracle
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addOracle(DEFAULT_CHAIN_ID, authorizedOracleAccount1.address)
            await tx.wait()

            // Get oracle list
            expect((await contractInstance.get(DEFAULT_CHAIN_ID))[3]).to.deep.eq([authorizedOracleAccount1.address])

            // Check oracle
            expect(await contractInstance.isOracle(DEFAULT_CHAIN_ID, authorizedOracleAccount1.address)).to.be.true

            // Attempt to add a oracle by someone else
            try {
                contractInstance = contractInstance.connect(randomAccount2.wallet) as any
                tx = await contractInstance.addOracle(DEFAULT_CHAIN_ID, authorizedOracleAccount2.address)
                await tx.wait()
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert onlyContractOwner/, "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get oracle list
            expect((await contractInstance.get(DEFAULT_CHAIN_ID))[3]).to.deep.eq([authorizedOracleAccount1.address])

            // Check oracle
            expect(await contractInstance.isOracle(DEFAULT_CHAIN_ID, authorizedOracleAccount1.address)).to.be.true
            expect(await contractInstance.isOracle(DEFAULT_CHAIN_ID, authorizedOracleAccount2.address)).to.be.false
        })

        it("should add the oracle address to the oracle list", async () => {
            contractInstance = await new GenesisBuilder().withOracles([]).build() as any

            // Register oracle 1
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addOracle(DEFAULT_CHAIN_ID, authorizedOracleAccount1.address)
            await tx.wait()

            // Get oracle list
            expect((await contractInstance.get(DEFAULT_CHAIN_ID))[3]).to.deep.eq([authorizedOracleAccount1.address])

            // Check oracle
            expect(await contractInstance.isOracle(DEFAULT_CHAIN_ID, authorizedOracleAccount1.address)).to.be.true

            // Adding oracle #2
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addOracle(DEFAULT_CHAIN_ID, authorizedOracleAccount2.address)
            await tx.wait()

            // Get oracle list
            expect((await contractInstance.get(DEFAULT_CHAIN_ID))[3]).to.deep.eq([authorizedOracleAccount1.address, authorizedOracleAccount2.address])

            // Check oracle
            expect(await contractInstance.isOracle(DEFAULT_CHAIN_ID, authorizedOracleAccount1.address)).to.be.true
            expect(await contractInstance.isOracle(DEFAULT_CHAIN_ID, authorizedOracleAccount2.address)).to.be.true
        })

        it("should fail if it is already present", async () => {
            contractInstance = await new GenesisBuilder().withOracles([]).build() as any
            expect(await contractInstance.isOracle(DEFAULT_CHAIN_ID, authorizedOracleAccount1.address)).to.be.false

            // Register the oracle
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addOracle(DEFAULT_CHAIN_ID, authorizedOracleAccount1.address)
            await tx.wait()

            // Get oracle list
            expect((await contractInstance.get(DEFAULT_CHAIN_ID))[3]).to.deep.eq([authorizedOracleAccount1.address])

            // Check oracle
            expect(await contractInstance.isOracle(DEFAULT_CHAIN_ID, authorizedOracleAccount1.address)).to.be.true

            // Attempt to add the oracle again
            try {
                tx = await contractInstance.addOracle(DEFAULT_CHAIN_ID, authorizedOracleAccount1.address)
                await tx.wait()
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert Already present/, "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get oracle list
            expect((await contractInstance.get(DEFAULT_CHAIN_ID))[3]).to.deep.eq([authorizedOracleAccount1.address])

            // Check oracle
            expect(await contractInstance.isOracle(DEFAULT_CHAIN_ID, authorizedOracleAccount1.address)).to.be.true
        })

        it("should add the validator to the right namespace", async () => {
            contractInstance = await new GenesisBuilder().withOracles([]).build() as any
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
            contractInstance = await new GenesisBuilder().withOracles([]).build() as any
            contractInstance = contractInstance.connect(deployAccount.wallet) as any

            const result: { oracleAddress: string } = await new Promise((resolve, reject) => {
                contractInstance.on("OracleAdded", (oracleAddress: string) => {
                    resolve({ oracleAddress })
                })
                contractInstance.addOracle(DEFAULT_CHAIN_ID, authorizedOracleAccount1.address).then(tx => tx.wait()).catch(reject)
            })

            expect(result).to.be.ok
            expect(result.oracleAddress).to.equal(authorizedOracleAccount1.address)
        }).timeout(7000)
    })

    describe("Oracle removal", () => {

        it("only when the contract owner requests it", async () => {
            contractInstance = await new GenesisBuilder().withOracles([]).build() as any

            // Check oracle
            expect(await contractInstance.isOracle(DEFAULT_CHAIN_ID, authorizedOracleAccount1.address)).to.be.false

            // Register oracle
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addOracle(DEFAULT_CHAIN_ID, authorizedOracleAccount1.address)
            await tx.wait()

            // Check oracle
            expect(await contractInstance.isOracle(DEFAULT_CHAIN_ID, authorizedOracleAccount1.address)).to.be.true

            // Attempt to disable the oracle from someone else
            try {
                contractInstance = contractInstance.connect(randomAccount2.wallet) as any
                tx = await contractInstance.removeOracle(DEFAULT_CHAIN_ID, 0, authorizedOracleAccount1.address)
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert onlyContractOwner/, "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get oracle list
            expect((await contractInstance.get(DEFAULT_CHAIN_ID))[3]).to.deep.eq([authorizedOracleAccount1.address])

            // Check oracle
            expect(await contractInstance.isOracle(DEFAULT_CHAIN_ID, authorizedOracleAccount1.address)).to.be.true

            // Disable oracle from the creator
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            const result3 = await contractInstance.removeOracle(DEFAULT_CHAIN_ID, 0, authorizedOracleAccount1.address)

            // Get oracle list
            expect((await contractInstance.get(DEFAULT_CHAIN_ID))[3]).to.deep.eq([])

            // Check oracle
            expect(await contractInstance.isOracle(DEFAULT_CHAIN_ID, authorizedOracleAccount1.address)).to.be.false
        })

        it("should fail if the idx is not valid", async () => {
            contractInstance = await new GenesisBuilder().withOracles([]).build() as any

            // Check oracle
            expect(await contractInstance.isOracle(DEFAULT_CHAIN_ID, authorizedOracleAccount1.address)).to.be.false

            // Register a oracle
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addOracle(DEFAULT_CHAIN_ID, authorizedOracleAccount1.address)
            await tx.wait()

            // Register a oracle
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addOracle(DEFAULT_CHAIN_ID, authorizedOracleAccount2.address)
            await tx.wait()

            // Attempt to disable non-existing oracle
            try {
                contractInstance = contractInstance.connect(deployAccount.wallet) as any
                tx = await contractInstance.removeOracle(DEFAULT_CHAIN_ID, 5, authorizedOracleAccount2.address)
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert Invalid index/, "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get oracle list
            expect((await contractInstance.get(DEFAULT_CHAIN_ID))[3]).to.deep.eq([authorizedOracleAccount1.address, authorizedOracleAccount2.address])

            // Check oracle
            expect(await contractInstance.isOracle(DEFAULT_CHAIN_ID, authorizedOracleAccount1.address)).to.be.true
            expect(await contractInstance.isOracle(DEFAULT_CHAIN_ID, authorizedOracleAccount1.address)).to.be.true
        })

        it("should fail if the idx does not match oracleAddress", async () => {
            contractInstance = await new GenesisBuilder().withOracles([]).build() as any

            // Register a oracle
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addOracle(DEFAULT_CHAIN_ID, authorizedOracleAccount1.address)
            await tx.wait()

            // Register a oracle
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.addOracle(DEFAULT_CHAIN_ID, authorizedOracleAccount2.address)
            await tx.wait()

            // Attempt to disable non-existing oracle
            try {
                contractInstance = contractInstance.connect(deployAccount.wallet) as any
                tx = await contractInstance.removeOracle(DEFAULT_CHAIN_ID, 1, randomAccount2.address)
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert Index-key mismatch/, "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get oracle list
            expect((await contractInstance.get(DEFAULT_CHAIN_ID))[3]).to.deep.eq([authorizedOracleAccount1.address, authorizedOracleAccount2.address])

            // Check oracle
            expect(await contractInstance.isOracle(DEFAULT_CHAIN_ID, authorizedOracleAccount1.address)).to.be.true
            expect(await contractInstance.isOracle(DEFAULT_CHAIN_ID, authorizedOracleAccount1.address)).to.be.true
        })

        it("should remove from the right namespace", async () => {
            contractInstance = await new GenesisBuilder().withOracles([]).build() as any
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
            expect((await contractInstance.get(5))[3]).to.deep.eq([authorizedOracleAccount1.address])

            // Check oracles
            expect(await contractInstance.isOracle(5, authorizedOracleAccount1.address)).to.be.true

            // Disable from the right namespace
            tx = await contractInstance.removeOracle(5, 0, authorizedOracleAccount1.address)
            await tx.wait()

            // Get oracle list
            expect((await contractInstance.get(5))[3]).to.deep.eq([])

            // Check oracles
            expect(await contractInstance.isOracle(5, authorizedOracleAccount1.address)).to.be.false
        })

        it("should emit an event", async () => {
            contractInstance = contractInstance.connect(deployAccount.wallet) as any

            // 3 by default
            expect((await contractInstance.get(DEFAULT_CHAIN_ID))[3].length).to.eq(3)

            // Register oracle
            tx = await contractInstance.addOracle(DEFAULT_CHAIN_ID, authorizedOracleAccount1.address)
            await tx.wait()

            const result: { oracleAddress: string } = await new Promise((resolve, reject) => {
                contractInstance.on("OracleRemoved", (oracleAddress: string) => {
                    resolve({ oracleAddress })
                })
                contractInstance.removeOracle(DEFAULT_CHAIN_ID, 3, authorizedOracleAccount1.address).then(tx => tx.wait()).catch(reject)
            })

            expect(result).to.be.ok
            expect(result.oracleAddress).to.equal(authorizedOracleAccount1.address)
        }).timeout(7000)
    })
}).timeout(4000)

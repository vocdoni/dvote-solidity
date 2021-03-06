import { expect } from "chai"
import { BigNumber, Contract, ContractFactory, ContractTransaction, utils } from "ethers"
import "mocha" // using @types/mocha
import { abi as tokenStorageProofAbi, bytecode as tokenStorageProofByteCode } from "../../build/token-storage-proof.json"
import { abi as trieProofTestAbi, bytecode as trieProofTestByteCode } from "../../build/test/trie-proof.json"
import { Erc20StorageProofContractMethods, TrieProofTestContractMethods  } from "../../lib"
import ERC20MockBuilder from "../builders/erc20Mock"
import TokenStorageProofBuilder from "../builders/token-storage-proof"
import { TrieProofTestBuilder } from "../builders/token-storage-proof"
import { getAccounts, TestAccount } from "../utils"
import { addCompletionHooks } from "../utils/mocha-hooks"
import { testProofs } from "../vectors/token-storage-proof"

let accounts: TestAccount[]
let deployAccount: TestAccount
let randomAccount1: TestAccount
let contractInstance: Erc20StorageProofContractMethods & Contract
let tx: ContractTransaction

addCompletionHooks()

describe("TokenStorageProof contract", () => {
    beforeEach(async () => {
        accounts = getAccounts()
        deployAccount = accounts[0]
        randomAccount1 = accounts[2]
        tx = null
    })

    it("should deploy the contract", async () => {
        const storageProofContractInstance = await new TokenStorageProofBuilder().build()
        expect(storageProofContractInstance.address).to.match(/^0x[0-9a-fA-F]{40}$/)

        const contractFactory = new ContractFactory(tokenStorageProofAbi, tokenStorageProofByteCode, deployAccount.wallet)
        const localInstance: Contract & Erc20StorageProofContractMethods = await contractFactory.deploy() as Contract & Erc20StorageProofContractMethods

        expect(localInstance).to.be.ok
        expect(localInstance.address).to.match(/^0x[0-9a-fA-F]{40}$/)
    })

    it("should register a token contract with registerToken() if the registrant is holder", async () => {
        const dummyTokenInstance = await new ERC20MockBuilder().build()

        contractInstance = await new TokenStorageProofBuilder().build()

        const tokenData = await contractInstance.tokens(dummyTokenInstance.address)
        expect(tokenData[0]).to.be.false
        expect(tokenData[1]).to.be.false

        expect(await contractInstance.tokenCount()).to.eq(0)
        expect(() => contractInstance.tokenAddresses(0)).to.throw

        await contractInstance.connect(deployAccount.wallet).registerToken(
            dummyTokenInstance.address,
            0,
        )

        const tokenData2 = await contractInstance.tokens(dummyTokenInstance.address)
        expect(tokenData2[0]).to.be.true
        expect(tokenData2[1]).to.be.false
        expect(await contractInstance.tokenCount()).to.eq(1)
        expect(await contractInstance.tokenAddresses(0)).to.deep.eq(dummyTokenInstance.address)
    })

    it("should fail registering a token contract with registerToken() if the registrant is not holder", async () => {
        const dummyTokenInstance = await new ERC20MockBuilder().build()

        contractInstance = await new TokenStorageProofBuilder().build()

        const tokenData = await contractInstance.tokens(dummyTokenInstance.address)
        expect(tokenData[0]).to.be.false
        expect(tokenData[1]).to.be.false

        expect(await contractInstance.tokenCount()).to.eq(0)
        expect(() => contractInstance.tokenAddresses(0)).to.throw

        try {
            await contractInstance.connect(randomAccount1.wallet).registerToken(dummyTokenInstance.address, 0)
            throw new Error("The transaction should have thrown an error but didn't")
        } catch (err) {
            expect(err.message).to.match(/revert NOT_ENOUGH_FUNDS/)
        }

        const tokenData2 = await contractInstance.tokens(dummyTokenInstance.address)
        expect(tokenData2[0]).to.be.false
        expect(tokenData2[1]).to.be.false
        expect(await contractInstance.tokenCount()).to.eq(0)
    })

    it("should set the balance mapping position only if the sender is token holder and the mapping position is not verified", async() => {
        const dummyTokenInstance = await new ERC20MockBuilder().build()

        contractInstance = await new TokenStorageProofBuilder().build()

        const tokenData = await contractInstance.tokens(dummyTokenInstance.address)
        expect(tokenData[0]).to.be.false
        expect(tokenData[1]).to.be.false

        expect(await contractInstance.tokenCount()).to.eq(0)
        expect(() => contractInstance.tokenAddresses(0)).to.throw

        await contractInstance.registerToken(
            dummyTokenInstance.address,
            0,
        )

        await contractInstance.setBalanceMappingPosition(dummyTokenInstance.address, 5)
        const tokenData2 = await contractInstance.tokens(dummyTokenInstance.address)
        expect(tokenData2[0]).to.be.true
        expect(tokenData2[1]).to.be.false
        
        // TODO: @jordipainan Check with verified 

        // should fail if same balance mapping position
        try {
            await contractInstance.setBalanceMappingPosition(dummyTokenInstance.address, 5)
            throw new Error("The transaction should have thrown an error but didn't")
        } catch (err) {
            expect(err.message).to.match(/revert SAME_VALUE/)
        }

        // should fail if not holder
        try {
            await contractInstance.connect(randomAccount1.wallet).setBalanceMappingPosition(dummyTokenInstance.address, 6)
            throw new Error("The transaction should have thrown an error but didn't")
        } catch (err) {
            expect(err.message).to.match(/revert NOT_ENOUGH_FUNDS/)
        }
    })

    it("should emit an event when the balance mapping position of the token is changed", async() => {
        const dummyTokenInstance = await new ERC20MockBuilder().build()

        contractInstance = await new TokenStorageProofBuilder().build()
        await contractInstance.connect(deployAccount.wallet).registerToken(
            dummyTokenInstance.address,
            0,
        )
        await contractInstance.setBalanceMappingPosition(dummyTokenInstance.address, 5)

        const result: { tokenAddress: string, balanceMappingPosition: number | BigNumber } = await new Promise((resolve, reject) => {
            contractInstance.on("BalanceMappingPositionUpdated", (tokenAddress: string, balanceMappingPosition: number | BigNumber) => {
                resolve({ tokenAddress, balanceMappingPosition })
            })
        })
        expect(result).to.be.ok
        expect(result.tokenAddress).to.equal(dummyTokenInstance.address)
        expect(result.balanceMappingPosition).to.be.deep.equal(BigNumber.from(5))
    })
})

describe("TrieProof library", () => {
    beforeEach(async () => {
        accounts = getAccounts()
        deployAccount = accounts[0]
    })

    it("should deploy the contract", async () => {
        const trieProofTestContractInstance = await new TrieProofTestBuilder().build()
        expect(trieProofTestContractInstance.address).to.match(/^0x[0-9a-fA-F]{40}$/)

        const contractFactory = new ContractFactory(trieProofTestAbi, trieProofTestByteCode, deployAccount.wallet)
        const localInstance: Contract & TrieProofTestContractMethods = await contractFactory.deploy() as Contract & TrieProofTestContractMethods

        expect(localInstance).to.be.ok
        expect(localInstance.address).to.match(/^0x[0-9a-fA-F]{40}$/)
    })

    it("should verify the proofs", async () => {
        const trieProofTestContractInstance = await new TrieProofTestBuilder().build()
        for (let i = 0; i < testProofs.length; i++) {
            const p = testProofs[i]

            const proofRaw = p.proofs.map(node => utils.RLP.decode(node))
            const proof = utils.RLP.encode(proofRaw)
            const rootHash = utils.keccak256(utils.RLP.encode(proofRaw[0]))
            const key = utils.keccak256(p.key)
            const value = await trieProofTestContractInstance.verify(proof, rootHash, key)
            if (p.value.length % 2 != 0) {
                p.value = `0x0${p.value.slice(2)}` // make value even-length
            }
            if (p.verify) {
                expect(value).to.equal(p.value)
            } else {
                expect(value).to.not.equal(p.value)
            }
        }
    })
})

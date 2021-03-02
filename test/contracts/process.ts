
import "mocha" // using @types/mocha
import { expect } from "chai"
import { Contract, Wallet, ContractFactory, ContractTransaction, utils, BigNumber, ethers } from "ethers"
import { addCompletionHooks } from "../utils/mocha-hooks"
import { getAccounts, getProvider, TestAccount } from "../utils"
import { ProcessContractMethods, ProcessStatus, ProcessEnvelopeType, ProcessMode, ProcessContractParameters, ProcessResults, NamespaceContractMethods, ProcessCensusOrigin, TokenStorageProofContractMethods } from "../../lib"

import ProcessBuilder, { DEFAULT_METADATA_CONTENT_HASHED_URI, DEFAULT_CENSUS_ROOT, DEFAULT_CENSUS_TREE_CONTENT_HASHED_URI, DEFAULT_START_BLOCK, DEFAULT_BLOCK_COUNT, DEFAULT_QUESTION_COUNT, DEFAULT_CHAIN_ID, DEFAULT_MAX_VOTE_OVERWRITES, DEFAULT_MAX_COUNT, DEFAULT_MAX_VALUE, DEFAULT_MAX_TOTAL_COST, DEFAULT_COST_EXPONENT, DEFAULT_NAMESPACE, DEFAULT_PARAMS_SIGNATURE, DEFAULT_RESULTS_TALLY, DEFAULT_RESULTS_HEIGHT, DEFAULT_CENSUS_ORIGIN, DEFAULT_EVM_BLOCK_HEIGHT, DEFAULT_PROCESS_PRICE } from "../builders/process"
import NamespaceBuilder from "../builders/namespace"
import TokenStorageProofBuilder from "../builders/token-storage-proof"

import { abi as processAbi, bytecode as processByteCode } from "../../build/processes.json"
import { abi as namespaceAbi, bytecode as namespaceByteCode } from "../../build/namespaces.json"
import { abi as tokenStorageProofsAbi } from "../../build/token-storage-proof.json"
const solc = require("solc")

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
const ethChainId = 0

const dummyErc20Contract = `
// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

contract ERC20 {
    mapping (address => uint256) private _balances;

    mapping (address => mapping (address => uint256)) private _allowances;

    uint256 private _totalSupply;

    string private _name;
    string private _symbol;
    uint8 private _decimals;
    constructor (string memory name, string memory symbol) public {
        _name = name;
        _symbol = symbol;
        _decimals = 18;
        _balances[msg.sender] = 1000000000000000000;
        _totalSupply = 1000000000000000000;
    }
    function name() public view returns (string memory) {
        return _name;
    }
    function symbol() public view returns (string memory) {
        return _symbol;
    }
    function decimals() public view returns (uint8) {
        return _decimals;
    }
    function totalSupply() public view returns (uint256) {
        return _totalSupply;
    }
    function balanceOf(address account) public view returns (uint256) {
        return _balances[account];
    }
    function transfer(address recipient, uint256 amount) public virtual returns (bool) {
        return true;
    }
    function allowance(address owner, address spender) public view virtual returns (uint256) {
        return _allowances[owner][spender];
    }
    function approve(address spender, uint256 amount) public virtual returns (bool) {
        return true;
    }
    function transferFrom(address sender, address recipient, uint256 amount) public virtual returns (bool) {
        return true;
    }
    function increaseAllowance(address spender, uint256 addedValue) public virtual returns (bool) {
        return true;
    }
    function decreaseAllowance(address spender, uint256 subtractedValue) public virtual returns (bool) {
        return true;
    }
}
`

addCompletionHooks()

describe("Process contract", () => {
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
        processId = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE, DEFAULT_CHAIN_ID)
    })

    it("should deploy the contract", async () => {
        const namespaceInstance1 = await new NamespaceBuilder().build()
        const namespaceInstance2 = await new NamespaceBuilder().build()
        const somePredecessorAddr = (await new ProcessBuilder().build()).address
        const storageProofAddress = (await new TokenStorageProofBuilder().build()).address
        const contractFactory1 = new ContractFactory(processAbi, processByteCode, entityAccount.wallet)
        const localInstance1: Contract & ProcessContractMethods = await contractFactory1.deploy(nullAddress, namespaceInstance1.address, storageProofAddress, ethChainId, DEFAULT_PROCESS_PRICE) as Contract & ProcessContractMethods

        expect(localInstance1).to.be.ok
        expect(localInstance1.address).to.match(/^0x[0-9a-fA-F]{40}$/)
        expect(await localInstance1.predecessorAddress()).to.eq(nullAddress)
        expect(await localInstance1.namespaceAddress()).to.eq(namespaceInstance1.address)
        expect(await localInstance1.tokenStorageProofAddress()).to.eq(storageProofAddress)

        const contractFactory2 = new ContractFactory(processAbi, processByteCode, entityAccount.wallet)
        const localInstance2: Contract & ProcessContractMethods = await contractFactory2.deploy(somePredecessorAddr, namespaceInstance2.address, storageProofAddress, ethChainId, DEFAULT_PROCESS_PRICE) as Contract & ProcessContractMethods

        expect(localInstance2).to.be.ok
        expect(localInstance2.address).to.match(/^0x[0-9a-fA-F]{40}$/)
        expect(localInstance2.address).to.not.eq(localInstance1.address)
        expect(await localInstance2.predecessorAddress()).to.eq(somePredecessorAddr)
        expect(await localInstance2.namespaceAddress()).to.eq(namespaceInstance2.address)
        expect(await localInstance2.tokenStorageProofAddress()).to.eq(storageProofAddress)
    })

    it("should fail deploying if the namespace address is not a contract", async () => {
        const noParentAddr = "0x0000000000000000000000000000000000000000"
        const somePredecessorAddr = (await new ProcessBuilder().build()).address
        const storageProofAddress = (await new TokenStorageProofBuilder().build()).address

        const contractFactory = new ContractFactory(processAbi, processByteCode, entityAccount.wallet)

        try {
            const randomAddress = Wallet.createRandom().address
            await contractFactory.deploy(noParentAddr, randomAddress, storageProofAddress, ethChainId, DEFAULT_PROCESS_PRICE) as Contract & ProcessContractMethods

            throw new Error("The transaction should have thrown an error but didn't")
        }
        catch (err) {
            expect(err.message).to.match(/revert Invalid namespace/, "The transaction threw an unexpected error:\n" + err.message)
        }

        try {
            const randomAddress = Wallet.createRandom().address
            await contractFactory.deploy(somePredecessorAddr, randomAddress, storageProofAddress, ethChainId, DEFAULT_PROCESS_PRICE) as Contract & ProcessContractMethods

            throw new Error("The transaction should have thrown an error but didn't")
        }
        catch (err) {
            expect(err.message).to.match(/revert Invalid namespace/, "The transaction threw an unexpected error:\n" + err.message)
        }
    })


    it("should compute a processId from the entity address, index and namespace", async () => {
        expect(contractInstance.getProcessId).to.be.ok
        expect(contractInstance.getProcessId.call).to.be.ok

        const proc1 = await contractInstance.getProcessId(accounts[0].address, 0, DEFAULT_NAMESPACE, DEFAULT_CHAIN_ID)
        const proc2 = await contractInstance.getProcessId(accounts[0].address, 0, DEFAULT_NAMESPACE, DEFAULT_CHAIN_ID)

        const proc3 = await contractInstance.getProcessId(accounts[0].address, 1, DEFAULT_NAMESPACE, DEFAULT_CHAIN_ID)
        const proc4 = await contractInstance.getProcessId(accounts[0].address, 1, DEFAULT_NAMESPACE, DEFAULT_CHAIN_ID)

        const proc5 = await contractInstance.getProcessId(accounts[0].address, 2, DEFAULT_NAMESPACE, DEFAULT_CHAIN_ID)
        const proc6 = await contractInstance.getProcessId(accounts[0].address, 3, DEFAULT_NAMESPACE, DEFAULT_CHAIN_ID)

        const proc7 = await contractInstance.getProcessId(accounts[1].address, 0, DEFAULT_NAMESPACE, DEFAULT_CHAIN_ID)
        const proc8 = await contractInstance.getProcessId(accounts[1].address, 1, DEFAULT_NAMESPACE, DEFAULT_CHAIN_ID)

        const proc9 = await contractInstance.getProcessId(accounts[1].address, 0, 10, DEFAULT_CHAIN_ID)
        const proc10 = await contractInstance.getProcessId(accounts[1].address, 0, 20, DEFAULT_CHAIN_ID)

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

    it("different chain Id's should produce different process Id's", async () => {
        expect(contractInstance.getProcessId).to.be.ok
        expect(contractInstance.getProcessId.call).to.be.ok

        const proc1 = await contractInstance.getProcessId(accounts[0].address, 0, DEFAULT_NAMESPACE, 10)
        const proc2 = await contractInstance.getProcessId(accounts[0].address, 0, DEFAULT_NAMESPACE, 10)

        const proc3 = await contractInstance.getProcessId(accounts[0].address, 1, DEFAULT_NAMESPACE, 20)
        const proc4 = await contractInstance.getProcessId(accounts[0].address, 1, DEFAULT_NAMESPACE, 20)

        const proc5 = await contractInstance.getProcessId(accounts[0].address, 2, DEFAULT_NAMESPACE, DEFAULT_CHAIN_ID)
        const proc6 = await contractInstance.getProcessId(accounts[0].address, 3, DEFAULT_NAMESPACE, DEFAULT_CHAIN_ID)

        const proc7 = await contractInstance.getProcessId(accounts[1].address, 0, DEFAULT_NAMESPACE, DEFAULT_CHAIN_ID + 1)
        const proc8 = await contractInstance.getProcessId(accounts[1].address, 1, DEFAULT_NAMESPACE, DEFAULT_CHAIN_ID + 1)

        const proc9 = await contractInstance.getProcessId(accounts[1].address, 0, DEFAULT_NAMESPACE, DEFAULT_CHAIN_ID + 10)
        const proc10 = await contractInstance.getProcessId(accounts[1].address, 0, DEFAULT_NAMESPACE, DEFAULT_CHAIN_ID + 20)

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
        const processId1Expected = await contractInstance.getProcessId(entityAccount.address, count1.toNumber(), DEFAULT_NAMESPACE, DEFAULT_CHAIN_ID)
        const processId1Actual = await contractInstance.getNextProcessId(entityAccount.address, DEFAULT_NAMESPACE)

        expect(processId1Actual).to.eq(processId1Expected)

        tx = await contractInstance.newProcess(
            [ProcessMode.make({ autoStart: true }), ProcessEnvelopeType.make(), ProcessCensusOrigin.OFF_CHAIN_TREE],
            nullAddress, // token/entity ID
            [DEFAULT_METADATA_CONTENT_HASHED_URI, DEFAULT_CENSUS_ROOT, DEFAULT_CENSUS_TREE_CONTENT_HASHED_URI],
            [DEFAULT_START_BLOCK, DEFAULT_BLOCK_COUNT],
            [DEFAULT_QUESTION_COUNT, DEFAULT_MAX_COUNT, DEFAULT_MAX_VALUE, DEFAULT_MAX_VOTE_OVERWRITES],
            [DEFAULT_MAX_TOTAL_COST, DEFAULT_COST_EXPONENT, DEFAULT_NAMESPACE],
            DEFAULT_EVM_BLOCK_HEIGHT,
            DEFAULT_PARAMS_SIGNATURE
        )
        await tx.wait()

        // The entity has 2 processes now
        // So the next process index is 2
        const processId2Expected = await contractInstance.getProcessId(entityAccount.address, 2, DEFAULT_NAMESPACE, DEFAULT_CHAIN_ID)
        const processId2Actual = await contractInstance.getNextProcessId(entityAccount.address, DEFAULT_NAMESPACE)

        expect(processId1Actual).to.not.eq(processId2Actual)
        expect(processId2Actual).to.eq(processId2Expected)

        // 
        const count3 = await contractInstance.getEntityProcessCount(entityAccount.address)
        expect(count3.toNumber()).to.eq(2)
        const processId3Expected = await contractInstance.getProcessId(entityAccount.address, count3.toNumber(), 10, DEFAULT_CHAIN_ID)
        const processId3Actual = await contractInstance.getNextProcessId(entityAccount.address, 10)

        expect(processId3Expected).to.eq(processId3Actual)
    })

    describe("Process Creation", () => {
        it("should allow anyone to create a process", async () => {
            expect(contractInstance.newProcess).to.be.ok

            // one is already created by the builder

            let processIdExpected = await contractInstance.getProcessId(entityAccount.address, 1, DEFAULT_NAMESPACE, DEFAULT_CHAIN_ID)
            let processIdActual = await contractInstance.getNextProcessId(entityAccount.address, DEFAULT_NAMESPACE)
            expect(processIdExpected).to.eq(processIdActual)

            // 2
            contractInstance = contractInstance.connect(randomAccount1.wallet) as any
            tx = await contractInstance.newProcess(
                [ProcessMode.make({ autoStart: true }), ProcessEnvelopeType.make(), ProcessCensusOrigin.OFF_CHAIN_TREE],
                nullAddress, // token/entity ID
                [DEFAULT_METADATA_CONTENT_HASHED_URI, DEFAULT_CENSUS_ROOT, DEFAULT_CENSUS_TREE_CONTENT_HASHED_URI],
                [DEFAULT_START_BLOCK, DEFAULT_BLOCK_COUNT],
                [DEFAULT_QUESTION_COUNT, DEFAULT_MAX_COUNT, DEFAULT_MAX_VALUE, DEFAULT_MAX_VOTE_OVERWRITES],
                [DEFAULT_MAX_TOTAL_COST, DEFAULT_COST_EXPONENT, DEFAULT_NAMESPACE],
                DEFAULT_EVM_BLOCK_HEIGHT,
                DEFAULT_PARAMS_SIGNATURE
            )
            await tx.wait()

            processIdExpected = await contractInstance.getProcessId(randomAccount1.address, 1, DEFAULT_NAMESPACE, DEFAULT_CHAIN_ID)
            processIdActual = await contractInstance.getNextProcessId(randomAccount1.address, DEFAULT_NAMESPACE)
            expect(processIdExpected).to.eq(processIdActual)

            contractInstance = contractInstance.connect(randomAccount2.wallet) as any
            tx = await contractInstance.newProcess(
                [ProcessMode.make({ autoStart: true }), ProcessEnvelopeType.make(), ProcessCensusOrigin.OFF_CHAIN_TREE],
                nullAddress, // token/entity ID
                [DEFAULT_METADATA_CONTENT_HASHED_URI, DEFAULT_CENSUS_ROOT, DEFAULT_CENSUS_TREE_CONTENT_HASHED_URI],
                [DEFAULT_START_BLOCK, DEFAULT_BLOCK_COUNT],
                [DEFAULT_QUESTION_COUNT, DEFAULT_MAX_COUNT, DEFAULT_MAX_VALUE, DEFAULT_MAX_VOTE_OVERWRITES],
                [DEFAULT_MAX_TOTAL_COST, DEFAULT_COST_EXPONENT, DEFAULT_NAMESPACE],
                DEFAULT_EVM_BLOCK_HEIGHT,
                DEFAULT_PARAMS_SIGNATURE
            )
            await tx.wait()

            processIdExpected = await contractInstance.getProcessId(randomAccount2.address, 1, DEFAULT_NAMESPACE, DEFAULT_CHAIN_ID)
            processIdActual = await contractInstance.getNextProcessId(randomAccount2.address, DEFAULT_NAMESPACE)
            expect(processIdExpected).to.eq(processIdActual)
        })

        it("should not create a process if msg.value provided is less than processPrice of the contract", async() => {
            const namespaceInstance1 = await new NamespaceBuilder().build()
            const storageProofAddress = (await new TokenStorageProofBuilder().build()).address
            const contractFactory1 = new ContractFactory(processAbi, processByteCode, entityAccount.wallet)
            const localInstance1: Contract & ProcessContractMethods = await contractFactory1.deploy(nullAddress, namespaceInstance1.address, storageProofAddress, ethChainId, utils.parseUnits("1", "ether")) as Contract & ProcessContractMethods

            expect(localInstance1).to.be.ok
            expect(localInstance1.address).to.match(/^0x[0-9a-fA-F]{40}$/)
            expect(await localInstance1.predecessorAddress()).to.eq(nullAddress)
            expect(await localInstance1.namespaceAddress()).to.eq(namespaceInstance1.address)
            expect(await localInstance1.tokenStorageProofAddress()).to.eq(storageProofAddress)
            expect(await localInstance1.processPrice()).to.be.deep.eq(utils.parseUnits("1", "ether"))

            let processIdExpected = await contractInstance.getProcessId(entityAccount.address, 1, DEFAULT_NAMESPACE, DEFAULT_CHAIN_ID)
            let processIdActual = await contractInstance.getNextProcessId(entityAccount.address, DEFAULT_NAMESPACE)
            expect(processIdExpected).to.eq(processIdActual)

            contractInstance = contractInstance.connect(entityAccount.wallet) as any
            tx = await contractInstance.newProcess(
                [ProcessMode.make({ autoStart: true }), ProcessEnvelopeType.make(), ProcessCensusOrigin.OFF_CHAIN_TREE],
                nullAddress, // token/entity ID
                [DEFAULT_METADATA_CONTENT_HASHED_URI, DEFAULT_CENSUS_ROOT, DEFAULT_CENSUS_TREE_CONTENT_HASHED_URI],
                [DEFAULT_START_BLOCK, DEFAULT_BLOCK_COUNT],
                [DEFAULT_QUESTION_COUNT, DEFAULT_MAX_COUNT, DEFAULT_MAX_VALUE, DEFAULT_MAX_VOTE_OVERWRITES],
                [DEFAULT_MAX_TOTAL_COST, DEFAULT_COST_EXPONENT, DEFAULT_NAMESPACE],
                DEFAULT_EVM_BLOCK_HEIGHT,
                DEFAULT_PARAMS_SIGNATURE,
                {value: utils.parseUnits("10000000000000000", "wei")} // 0.01 ether
            )
            try {
                await tx.wait()
                throw new Error("The transaction should have thrown an error but didn't")
            } catch (err) {
                expect(processIdExpected).to.eq(processIdActual)
            }

            processIdExpected = await contractInstance.getProcessId(entityAccount.address, 1, DEFAULT_NAMESPACE, DEFAULT_CHAIN_ID)
            tx = await contractInstance.newProcess(
                [ProcessMode.make({ autoStart: true }), ProcessEnvelopeType.make(), ProcessCensusOrigin.OFF_CHAIN_TREE],
                nullAddress, // token/entity ID
                [DEFAULT_METADATA_CONTENT_HASHED_URI, DEFAULT_CENSUS_ROOT, DEFAULT_CENSUS_TREE_CONTENT_HASHED_URI],
                [DEFAULT_START_BLOCK, DEFAULT_BLOCK_COUNT],
                [DEFAULT_QUESTION_COUNT, DEFAULT_MAX_COUNT, DEFAULT_MAX_VALUE, DEFAULT_MAX_VOTE_OVERWRITES],
                [DEFAULT_MAX_TOTAL_COST, DEFAULT_COST_EXPONENT, DEFAULT_NAMESPACE],
                DEFAULT_EVM_BLOCK_HEIGHT,
                DEFAULT_PARAMS_SIGNATURE,
                {value: utils.parseUnits("2", "ether")}
            )
            
            await tx.wait()
            expect(processIdExpected).to.eq(processIdActual)
        })

        it("retrieved metadata should match the one submitted (off chain census)", async () => {
            contractInstance = await new ProcessBuilder().build(0)
            let nextProcessId: string
            let created = 0
            let mode: number, envelopeType: number, censusOrigin: number, nonce: number
            expect((await contractInstance.getEntityProcessCount(entityAccount.address)).toNumber()).to.eq(0, "Should be empty")

            // Loop process creation
            for (let idx = 0; idx < 10; idx += 2) {
                for (let namespace = 5; namespace <= 10; namespace += 5) {
                    expect((await contractInstance.getEntityProcessCount(entityAccount.address)).toNumber()).to.eq(created, "Pre count mismatch")
                    nextProcessId = await contractInstance.getNextProcessId(entityAccount.address, namespace)

                    expect(() => {
                        return contractInstance.get(nextProcessId)
                    }).to.throw

                    // Create nextProcessId
                    nonce = idx * namespace
                    mode = ProcessMode.make({ autoStart: true })
                    envelopeType = ProcessEnvelopeType.make({ encryptedVotes: true })
                    censusOrigin = ProcessCensusOrigin.OFF_CHAIN_TREE
                    tx = await contractInstance.newProcess(
                        [mode, envelopeType, censusOrigin],
                        nullAddress, // token/entity ID
                        [`0x10${idx}${namespace}`, `0x20${idx}${namespace}`, `0x30${idx}${namespace}`],
                        [10 + nonce, 11 + nonce],
                        [12 + nonce, 13 + nonce, 14 + nonce, 15 + nonce],
                        [16 + nonce, 17 + nonce, namespace],
                        DEFAULT_EVM_BLOCK_HEIGHT,
                        DEFAULT_PARAMS_SIGNATURE
                    )
                    await tx.wait()
                    created++

                    const params = await contractInstance.get(nextProcessId)
                    expect(params).to.be.ok
                    expect(params[0]).to.deep.eq([mode, envelopeType, censusOrigin])
                    expect(params[1]).to.eq(entityAccount.address)
                    expect(params[2]).to.deep.eq([`0x10${idx}${namespace}`, `0x20${idx}${namespace}`, `0x30${idx}${namespace}`])
                    expect(params[3][0]).to.eq(10 + nonce)
                    expect(params[3][1]).to.eq(11 + nonce)
                    expect(params[4]).to.eq(0)
                    expect(params[5][1]).to.eq(12 + nonce)
                    expect(params[5][2]).to.eq(13 + nonce)
                    expect(params[5][3]).to.eq(14 + nonce)
                    expect(params[5][4]).to.eq(15 + nonce)
                    expect(params[6][0]).to.eq(16 + nonce)
                    expect(params[6][1]).to.eq(17 + nonce)
                    expect(params[6][2]).to.eq(namespace)

                    expect((await contractInstance.getEntityProcessCount(entityAccount.address)).toNumber()).to.eq(created, "Count mismatch")
                    expect(await contractInstance.getNextProcessId(entityAccount.address, namespace)).to.not.eq(nextProcessId)
                }
            }
        }).timeout(15000)

        it("retrieved metadata should match the one submitted (EVM census)", async () => {
            contractInstance = await new ProcessBuilder().build(0)
            let nextProcessId: string
            let created = 0
            let mode: number, envelopeType: number, censusOrigin: number, nonce: number
            expect((await contractInstance.getEntityProcessCount(entityAccount.address)).toNumber()).to.eq(0, "Should be empty")

            // ERC TOKEN CONTRACT
            const output = solc.compile(JSON.stringify({
                language: "Solidity",
                sources: { "dummy.sol": { content: dummyErc20Contract } },
                settings: { outputSelection: { "*": { "*": ["*"] } } }
            }))
            const { contracts } = JSON.parse(output)
            const erc20Abi = contracts["dummy.sol"].ERC20.abi
            const erc20Bytecode = contracts["dummy.sol"].ERC20.evm.bytecode.object

            const dummyTokenFactory = new ContractFactory(erc20Abi, erc20Bytecode, deployAccount.wallet)
            const dummyTokenInstance = await dummyTokenFactory.deploy("Dummy Token", "DUM") as Contract

            const proofsAddress = await contractInstance.tokenStorageProofAddress()
            const proofsInstance = new Contract(proofsAddress, tokenStorageProofsAbi, deployAccount.wallet) as Contract & TokenStorageProofContractMethods

            expect(await proofsInstance.isRegistered(dummyTokenInstance.address)).to.eq(false)
            await proofsInstance.connect(deployAccount.wallet).registerToken(
                dummyTokenInstance.address,
                0,
                await proofsInstance.provider.getBlockNumber(),
                Buffer.from("00000000000000000000000000000000000000000000000000", "hex"),
                Buffer.from("000000000000000000000000000000000000000000000000000000", "hex"),
                Buffer.from("0000000000000000000000000000000000000000000000000000000000", "hex")
            )

            expect(await proofsInstance.isRegistered(dummyTokenInstance.address)).to.eq(true)


            // Create processes and check
            for (let idx = 0; idx < 10; idx += 2) {
                for (let namespace = 5; namespace <= 10; namespace += 5) {
                    expect((await contractInstance.getEntityProcessCount(dummyTokenInstance.address)).toNumber()).to.eq(created, "Pre count mismatch")
                    nextProcessId = await contractInstance.getNextProcessId(dummyTokenInstance.address, namespace)

                    expect(() => {
                        return contractInstance.get(nextProcessId)
                    }).to.throw

                    // Create nextProcessId
                    nonce = idx * namespace
                    mode = ProcessMode.make({ autoStart: true })
                    envelopeType = ProcessEnvelopeType.make({ encryptedVotes: true })
                    censusOrigin = ProcessCensusOrigin.ERC20
                    tx = await contractInstance.connect(deployAccount.wallet).newProcess(
                        [mode, envelopeType, censusOrigin],
                        dummyTokenInstance.address,
                        [`0x10${idx}${namespace}`, `0x20${idx}${namespace}`, `_SHOULD_BE_IGNORED_`],
                        [10 + nonce, 11 + nonce],
                        [12 + nonce, 13 + nonce, 14 + nonce, 15 + nonce],
                        [16 + nonce, 17 + nonce, namespace],
                        DEFAULT_EVM_BLOCK_HEIGHT,
                        DEFAULT_PARAMS_SIGNATURE
                    )
                    const receipt = await tx.wait()
                    created++

                    expect(receipt.events[0].args.processId).to.eq(nextProcessId)
                    expect((await contractInstance.getEntityProcessCount(dummyTokenInstance.address)).toNumber()).to.eq(created, "Count mismatch")

                    const params = await contractInstance.get(nextProcessId)
                    expect(params).to.be.ok
                    expect(params[0]).to.deep.eq([mode, envelopeType, censusOrigin])
                    expect(params[1]).to.eq(dummyTokenInstance.address)
                    expect(params[2]).to.deep.eq([`0x10${idx}${namespace}`, `0x20${idx}${namespace}`, ""])
                    expect(params[3][0]).to.eq(10 + nonce)
                    expect(params[3][1]).to.eq(11 + nonce)
                    expect(params[4]).to.eq(0)
                    expect(params[5][1]).to.eq(12 + nonce)
                    expect(params[5][2]).to.eq(13 + nonce)
                    expect(params[5][3]).to.eq(14 + nonce)
                    expect(params[5][4]).to.eq(15 + nonce)
                    expect(params[6][0]).to.eq(16 + nonce)
                    expect(params[6][1]).to.eq(17 + nonce)
                    expect(params[6][2]).to.eq(namespace)

                    expect(await contractInstance.getNextProcessId(dummyTokenInstance.address, namespace)).to.not.eq(nextProcessId)
                }
            }
        })// .timeout(15000)

        it("getting a non-existent process should fail", async () => {
            for (let i = 0; i < 5; i++) {
                const randomProcessId = "0x" + (Math.random().toString().substr(2) + Math.random().toString().substr(2) + Math.random().toString().substr(2) + Math.random().toString().substr(2) + Math.random().toString().substr(2)).substr(-64)

                try {
                    await contractInstance.get(randomProcessId)
                    throw new Error("The transaction should have thrown an error but didn't")
                }
                catch (err) {
                    expect(err.message).to.match(/revert Not found/, "The transaction threw an unexpected error:\n" + err.message)
                }
            }
        })

        it("unwrapped metadata should match the unwrapped response", async () => {
            // 1
            const params1 = ProcessContractParameters.fromParams({
                mode: ProcessMode.make({}),
                envelopeType: ProcessEnvelopeType.make({}),
                censusOrigin: DEFAULT_CENSUS_ORIGIN,
                // tokenAddress: "",
                metadata: DEFAULT_METADATA_CONTENT_HASHED_URI,
                censusRoot: DEFAULT_CENSUS_ROOT,
                censusUri: DEFAULT_CENSUS_TREE_CONTENT_HASHED_URI,
                startBlock: DEFAULT_START_BLOCK,
                blockCount: DEFAULT_BLOCK_COUNT,
                questionCount: DEFAULT_QUESTION_COUNT,
                maxCount: DEFAULT_MAX_COUNT,
                maxValue: DEFAULT_MAX_VALUE,
                maxVoteOverwrites: DEFAULT_MAX_VOTE_OVERWRITES,
                maxTotalCost: DEFAULT_MAX_TOTAL_COST,
                costExponent: DEFAULT_COST_EXPONENT,
                namespace: DEFAULT_NAMESPACE,
                paramsSignature: DEFAULT_PARAMS_SIGNATURE
            }).toContractParams()
            tx = await contractInstance.newProcess(...params1)
            await tx.wait()

            let count = (await contractInstance.getEntityProcessCount(entityAccount.address)).toNumber()
            let processId = await contractInstance.getProcessId(entityAccount.address, count - 1, DEFAULT_NAMESPACE, DEFAULT_CHAIN_ID)

            const processData1 = ProcessContractParameters.fromContract(await contractInstance.get(processId))

            expect(processData1.mode.value).to.eq(ProcessMode.make({}))
            expect(processData1.envelopeType.value).to.eq(ProcessEnvelopeType.make({}))
            expect(processData1.entityAddress).to.eq(entityAccount.address)
            expect(processData1.metadata).to.eq(DEFAULT_METADATA_CONTENT_HASHED_URI)
            expect(processData1.censusRoot).to.eq(DEFAULT_CENSUS_ROOT)
            expect(processData1.censusUri).to.eq(DEFAULT_CENSUS_TREE_CONTENT_HASHED_URI)
            expect(processData1.startBlock).to.eq(DEFAULT_START_BLOCK)
            expect(processData1.blockCount).to.eq(DEFAULT_BLOCK_COUNT)
            expect(processData1.status.value).to.eq(ProcessStatus.PAUSED, "The process should start paused")
            expect(processData1.questionIndex).to.eq(0)
            expect(processData1.questionCount).to.eq(DEFAULT_QUESTION_COUNT)
            expect(processData1.maxCount).to.eq(DEFAULT_MAX_COUNT)
            expect(processData1.maxValue).to.eq(DEFAULT_MAX_VALUE)
            expect(processData1.maxVoteOverwrites).to.eq(DEFAULT_MAX_VOTE_OVERWRITES)
            expect(processData1.maxTotalCost).to.eq(DEFAULT_MAX_TOTAL_COST)
            expect(processData1.costExponent).to.eq(DEFAULT_COST_EXPONENT)
            expect(processData1.namespace).to.eq(DEFAULT_NAMESPACE)

            // 2
            let newMode = ProcessMode.make({ autoStart: true })
            let newEnvelopeType = ProcessEnvelopeType.make({ encryptedVotes: true })
            let newCensusOrigin = ProcessCensusOrigin.OFF_CHAIN_TREE
            let newMetadata = "ipfs://ipfs/more-hash-there!sha3-hash"
            let newCensusRoot = "0x00000001111122222333334444"
            let newCensusUri = "ipfs://ipfs/more-hash-somewthere!sha3-hash-there"
            let newStartBlock = 1111111
            let newBlockCount = 22222
            let newQuestionCount = 10
            let newMaxCount = 11
            let newMaxValue = 12
            let newMaxVoteOverwrites = 13
            let newMaxTotalCost = 14
            let newCostExponent = 15
            let newNamespace = 16
            let newParamsSignature = "0x91ba691fb296ba519623fb59163919baf19b26ba91fea9be61b92fab19dbf9df"

            const params2 = ProcessContractParameters.fromParams({
                mode: newMode,
                envelopeType: newEnvelopeType,
                censusOrigin: newCensusOrigin,
                metadata: newMetadata,
                censusRoot: newCensusRoot,
                censusUri: newCensusUri,
                startBlock: newStartBlock,
                blockCount: newBlockCount,
                questionCount: newQuestionCount,
                maxCount: newMaxCount,
                maxValue: newMaxValue,
                maxVoteOverwrites: newMaxVoteOverwrites,
                maxTotalCost: newMaxTotalCost,
                costExponent: newCostExponent,
                namespace: newNamespace,
                paramsSignature: newParamsSignature
            }).toContractParams()
            tx = await contractInstance.newProcess(...params2)
            await tx.wait()

            count = (await contractInstance.getEntityProcessCount(entityAccount.address)).toNumber()
            processId = await contractInstance.getProcessId(entityAccount.address, count - 1, newNamespace, DEFAULT_CHAIN_ID)

            const processData2 = ProcessContractParameters.fromContract(await contractInstance.get(processId))

            expect(processData2.mode.value).to.eq(newMode)
            expect(processData2.envelopeType.value).to.eq(newEnvelopeType)
            expect(processData2.censusOrigin.value).to.eq(newCensusOrigin)
            expect(processData2.entityAddress).to.eq(entityAccount.address)
            expect(processData2.metadata).to.eq(newMetadata)
            expect(processData2.censusRoot).to.eq(newCensusRoot)
            expect(processData2.censusUri).to.eq(newCensusUri)
            expect(processData2.startBlock).to.eq(newStartBlock)
            expect(processData2.blockCount).to.eq(newBlockCount)
            expect(processData2.status.value).to.eq(ProcessStatus.READY, "The process should start ready")
            expect(processData2.questionIndex).to.eq(0)
            expect(processData2.questionCount).to.eq(newQuestionCount)
            expect(processData2.maxCount).to.eq(newMaxCount)
            expect(processData2.maxValue).to.eq(newMaxValue)
            expect(processData2.maxVoteOverwrites).to.eq(newMaxVoteOverwrites)
            expect(processData2.maxTotalCost).to.eq(newMaxTotalCost)
            expect(processData2.costExponent).to.eq(newCostExponent)
            expect(processData2.namespace).to.eq(newNamespace)

            // 3
            newMode = ProcessMode.make({ autoStart: true })
            newEnvelopeType = ProcessEnvelopeType.make({ encryptedVotes: true })
            newCensusOrigin = ProcessCensusOrigin.OFF_CHAIN_TREE
            newMetadata = "ipfs://ipfs/more-hash-there!sha3-hash"
            newCensusRoot = "0x00000001111122222333334444"
            newCensusUri = "ipfs://ipfs/more-hash-somewthere!sha3-hash-there"
            newStartBlock = 1111111
            newBlockCount = 22222
            newQuestionCount = 15
            newMaxCount = 90
            newMaxValue = 100
            newMaxVoteOverwrites = 110
            newMaxTotalCost = 120
            newCostExponent = 130
            newNamespace = 140
            newParamsSignature = "0x91ba691fb296ba519623fb59163919baf19b26ba91fea9be61b92fab19dbf9df"

            const params3 = ProcessContractParameters.fromParams({
                mode: newMode,
                envelopeType: newEnvelopeType,
                censusOrigin: newCensusOrigin,
                metadata: newMetadata,
                censusRoot: newCensusRoot,
                censusUri: newCensusUri,
                startBlock: newStartBlock,
                blockCount: newBlockCount,
                questionCount: newQuestionCount,
                maxCount: newMaxCount,
                maxValue: newMaxValue,
                maxVoteOverwrites: newMaxVoteOverwrites,
                maxTotalCost: newMaxTotalCost,
                costExponent: newCostExponent,
                namespace: newNamespace,
                paramsSignature: newParamsSignature
            }).toContractParams()
            tx = await contractInstance.newProcess(...params3)
            await tx.wait()

            count = (await contractInstance.getEntityProcessCount(entityAccount.address)).toNumber()
            processId = await contractInstance.getProcessId(entityAccount.address, count - 1, newNamespace, DEFAULT_CHAIN_ID)

            const processData3 = ProcessContractParameters.fromContract(await contractInstance.get(processId))

            expect(processData3.mode.value).to.eq(newMode)
            expect(processData3.envelopeType.value).to.eq(newEnvelopeType)
            expect(processData2.censusOrigin.value).to.eq(newCensusOrigin)
            expect(processData3.entityAddress).to.eq(entityAccount.address)
            expect(processData3.metadata).to.eq(newMetadata)
            expect(processData3.censusRoot).to.eq(newCensusRoot)
            expect(processData3.censusUri).to.eq(newCensusUri)
            expect(processData3.startBlock).to.eq(newStartBlock)
            expect(processData3.blockCount).to.eq(newBlockCount)
            expect(processData3.status.value).to.eq(ProcessStatus.READY, "The process should start ready")
            expect(processData3.questionIndex).to.eq(0)
            expect(processData3.questionCount).to.eq(newQuestionCount)
            expect(processData3.maxCount).to.eq(newMaxCount)
            expect(processData3.maxValue).to.eq(newMaxValue)
            expect(processData3.maxVoteOverwrites).to.eq(newMaxVoteOverwrites)
            expect(processData3.maxTotalCost).to.eq(newMaxTotalCost)
            expect(processData3.costExponent).to.eq(newCostExponent)
            expect(processData3.namespace).to.eq(newNamespace)
        })

        it("paramsSignature should match the given one", async () => {
            const signature0 = await contractInstance.getParamsSignature(processId)
            expect(signature0).to.eq(DEFAULT_PARAMS_SIGNATURE)

            // 1
            const params1 = ProcessContractParameters.fromParams({
                mode: ProcessMode.make({}),
                envelopeType: ProcessEnvelopeType.make({}),
                censusOrigin: ProcessCensusOrigin.OFF_CHAIN_TREE,
                metadata: DEFAULT_METADATA_CONTENT_HASHED_URI,
                censusRoot: DEFAULT_CENSUS_ROOT,
                censusUri: DEFAULT_CENSUS_TREE_CONTENT_HASHED_URI,
                startBlock: DEFAULT_START_BLOCK,
                blockCount: DEFAULT_BLOCK_COUNT,
                questionCount: DEFAULT_QUESTION_COUNT,
                maxCount: DEFAULT_MAX_COUNT,
                maxValue: DEFAULT_MAX_VALUE,
                maxVoteOverwrites: DEFAULT_MAX_VOTE_OVERWRITES,
                maxTotalCost: DEFAULT_MAX_TOTAL_COST,
                costExponent: DEFAULT_COST_EXPONENT,
                namespace: DEFAULT_NAMESPACE,
                paramsSignature: "0x1234567890123456789012345678901234567890123456789012345678901234"
            }).toContractParams()
            tx = await contractInstance.newProcess(...params1)
            await tx.wait()

            let count = (await contractInstance.getEntityProcessCount(entityAccount.address)).toNumber()
            processId = await contractInstance.getProcessId(entityAccount.address, count - 1, DEFAULT_NAMESPACE, DEFAULT_CHAIN_ID)

            const signature1 = await contractInstance.getParamsSignature(processId)
            expect(signature1).to.eq("0x1234567890123456789012345678901234567890123456789012345678901234")

            // 2
            let newMode = ProcessMode.make({ autoStart: true }),
                newEnvelopeType = ProcessEnvelopeType.make({ encryptedVotes: true }),
                newCensusOrigin = ProcessCensusOrigin.OFF_CHAIN_TREE,
                newMetadata = "ipfs://ipfs/more-hash-there!sha3-hash",
                newCensusRoot = "0x00000001111122222333334444",
                newCensusUri = "ipfs://ipfs/more-hash-somewthere!sha3-hash-there",
                newStartBlock = 1111111,
                newBlockCount = 22222,
                newQuestionCount = 10,
                newMaxCount = 11,
                newMaxValue = 12,
                newMaxVoteOverwrites = 13,
                newMaxTotalCost = 14,
                newCostExponent = 15,
                newNamespace = 16,
                newParamsSignature = "0x91ba691fb296ba519623fb59163919baf19b26ba91fea9be61b92fab19dbf9df"

            const params2 = ProcessContractParameters.fromParams({
                mode: newMode,
                envelopeType: newEnvelopeType,
                censusOrigin: newCensusOrigin,
                metadata: newMetadata,
                censusRoot: newCensusRoot,
                censusUri: newCensusUri,
                startBlock: newStartBlock,
                blockCount: newBlockCount,
                questionCount: newQuestionCount,
                maxCount: newMaxCount,
                maxValue: newMaxValue,
                maxVoteOverwrites: newMaxVoteOverwrites,
                maxTotalCost: newMaxTotalCost,
                costExponent: newCostExponent,
                namespace: newNamespace,
                paramsSignature: newParamsSignature
            }).toContractParams()
            tx = await contractInstance.newProcess(...params2)
            await tx.wait()

            count = (await contractInstance.getEntityProcessCount(entityAccount.address)).toNumber()
            processId = await contractInstance.getProcessId(entityAccount.address, count - 1, newNamespace, DEFAULT_CHAIN_ID)

            const signature2 = await contractInstance.getParamsSignature(processId)
            expect(signature2).to.eq(newParamsSignature)

            // 3
            newMode = ProcessMode.make({ autoStart: true })
            newEnvelopeType = ProcessEnvelopeType.make({ encryptedVotes: true })
            newCensusOrigin = ProcessCensusOrigin.OFF_CHAIN_TREE
            newMetadata = "ipfs://ipfs/more-hash-there!sha3-hash"
            newCensusRoot = "0x00000001111122222333334444"
            newCensusUri = "ipfs://ipfs/more-hash-somewthere!sha3-hash-there"
            newStartBlock = 1111111
            newBlockCount = 22222
            newQuestionCount = 21
            newMaxCount = 22
            newMaxValue = 23
            newMaxVoteOverwrites = 24
            newMaxTotalCost = 25
            newCostExponent = 26
            newNamespace = 27
            newParamsSignature = "0x00ba691fb296ba519623fb59163919baf19b26ba91fea9be61b92fab19dbf9df"

            const params3 = ProcessContractParameters.fromParams({
                mode: newMode,
                envelopeType: newEnvelopeType,
                censusOrigin: newCensusOrigin,
                metadata: newMetadata,
                censusRoot: newCensusRoot,
                censusUri: newCensusUri,
                startBlock: newStartBlock,
                blockCount: newBlockCount,
                questionCount: newQuestionCount,
                maxCount: newMaxCount,
                maxValue: newMaxValue,
                maxVoteOverwrites: newMaxVoteOverwrites,
                maxTotalCost: newMaxTotalCost,
                costExponent: newCostExponent,
                namespace: newNamespace,
                paramsSignature: newParamsSignature
            }).toContractParams()
            tx = await contractInstance.newProcess(...params3)
            await tx.wait()

            count = (await contractInstance.getEntityProcessCount(entityAccount.address)).toNumber()
            processId = await contractInstance.getProcessId(entityAccount.address, count - 1, newNamespace, DEFAULT_CHAIN_ID)

            const signature3 = await contractInstance.getParamsSignature(processId)
            expect(signature3).to.eq(newParamsSignature)
        })

        it("should increment the processCount of the entity on success", async () => {
            const prev = (await contractInstance.getEntityProcessCount(entityAccount.address)).toNumber()
            expect(prev).to.eq(1)

            tx = await contractInstance.newProcess(
                [ProcessMode.make({ autoStart: true }), ProcessEnvelopeType.make(), ProcessCensusOrigin.OFF_CHAIN_TREE],
                nullAddress, // token/entity ID
                [DEFAULT_METADATA_CONTENT_HASHED_URI, DEFAULT_CENSUS_ROOT, DEFAULT_CENSUS_TREE_CONTENT_HASHED_URI],
                [DEFAULT_START_BLOCK, DEFAULT_BLOCK_COUNT],
                [DEFAULT_QUESTION_COUNT, DEFAULT_MAX_COUNT, DEFAULT_MAX_VALUE, DEFAULT_MAX_VOTE_OVERWRITES],
                [DEFAULT_MAX_TOTAL_COST, DEFAULT_COST_EXPONENT, DEFAULT_NAMESPACE],
                DEFAULT_EVM_BLOCK_HEIGHT,
                DEFAULT_PARAMS_SIGNATURE
            )
            await tx.wait()

            const current = (await contractInstance.getEntityProcessCount(entityAccount.address)).toNumber()

            expect(current).to.eq(prev + 1, "processCount should have incrementd by 1")
        })

        it("should fail with auto start set and startBlock being zero", () => {
            expect(() => {
                return contractInstance.newProcess(
                    [ProcessMode.make({ autoStart: true }), ProcessEnvelopeType.make(), ProcessCensusOrigin.OFF_CHAIN_TREE],
                    nullAddress, // token/entity ID
                    [DEFAULT_METADATA_CONTENT_HASHED_URI, DEFAULT_CENSUS_ROOT, DEFAULT_CENSUS_TREE_CONTENT_HASHED_URI],
                    [0, DEFAULT_BLOCK_COUNT],
                    [DEFAULT_QUESTION_COUNT, DEFAULT_MAX_COUNT, DEFAULT_MAX_VALUE, DEFAULT_MAX_VOTE_OVERWRITES],
                    [DEFAULT_MAX_TOTAL_COST, DEFAULT_COST_EXPONENT, DEFAULT_NAMESPACE],
                    DEFAULT_EVM_BLOCK_HEIGHT,
                    DEFAULT_PARAMS_SIGNATURE
                )
            }).to.throw
        })

        it("should fail if not interruptible and blockCount is zero", () => {
            expect(() => {
                return contractInstance.newProcess(
                    [ProcessMode.make({ interruptible: false }), ProcessEnvelopeType.make({})],
                    nullAddress, // token/entity ID
                    [DEFAULT_METADATA_CONTENT_HASHED_URI, DEFAULT_CENSUS_ROOT, DEFAULT_CENSUS_TREE_CONTENT_HASHED_URI],
                    [DEFAULT_START_BLOCK, 0],
                    [DEFAULT_QUESTION_COUNT, DEFAULT_MAX_COUNT, DEFAULT_MAX_VALUE, DEFAULT_MAX_VOTE_OVERWRITES],
                    [DEFAULT_MAX_TOTAL_COST, DEFAULT_COST_EXPONENT, DEFAULT_NAMESPACE],
                    DEFAULT_EVM_BLOCK_HEIGHT,
                    DEFAULT_PARAMS_SIGNATURE
                )
            }).to.throw
        })

        it("should fail if the metadata or census references are empty", () => {
            expect(() => {
                return contractInstance.newProcess(
                    [ProcessMode.make({}), ProcessEnvelopeType.make({}), ProcessCensusOrigin.OFF_CHAIN_TREE],
                    nullAddress, // token/entity ID
                    ["", DEFAULT_CENSUS_ROOT, DEFAULT_CENSUS_TREE_CONTENT_HASHED_URI],
                    [DEFAULT_START_BLOCK, DEFAULT_BLOCK_COUNT],
                    [DEFAULT_QUESTION_COUNT, DEFAULT_MAX_COUNT, DEFAULT_MAX_VALUE, DEFAULT_MAX_VOTE_OVERWRITES],
                    [DEFAULT_MAX_TOTAL_COST, DEFAULT_COST_EXPONENT, DEFAULT_NAMESPACE],
                    DEFAULT_EVM_BLOCK_HEIGHT,
                    DEFAULT_PARAMS_SIGNATURE
                )
            }).to.throw

            expect(() => {
                return contractInstance.newProcess(
                    [ProcessMode.make({}), ProcessEnvelopeType.make({}), ProcessCensusOrigin.OFF_CHAIN_TREE],
                    nullAddress, // token/entity ID
                    [DEFAULT_METADATA_CONTENT_HASHED_URI, "", DEFAULT_CENSUS_TREE_CONTENT_HASHED_URI],
                    [DEFAULT_START_BLOCK, DEFAULT_BLOCK_COUNT],
                    [DEFAULT_QUESTION_COUNT, DEFAULT_MAX_COUNT, DEFAULT_MAX_VALUE, DEFAULT_MAX_VOTE_OVERWRITES],
                    [DEFAULT_MAX_TOTAL_COST, DEFAULT_COST_EXPONENT, DEFAULT_NAMESPACE],
                    DEFAULT_EVM_BLOCK_HEIGHT,
                    DEFAULT_PARAMS_SIGNATURE
                )
            }).to.throw

            expect(() => {
                return contractInstance.newProcess(
                    [ProcessMode.make({}), ProcessEnvelopeType.make({}), ProcessCensusOrigin.OFF_CHAIN_TREE],
                    nullAddress, // token/entity ID
                    [DEFAULT_METADATA_CONTENT_HASHED_URI, DEFAULT_CENSUS_ROOT, ""],
                    [DEFAULT_START_BLOCK, DEFAULT_BLOCK_COUNT],
                    [DEFAULT_QUESTION_COUNT, DEFAULT_MAX_COUNT, DEFAULT_MAX_VALUE, DEFAULT_MAX_VOTE_OVERWRITES],
                    [DEFAULT_MAX_TOTAL_COST, DEFAULT_COST_EXPONENT, DEFAULT_NAMESPACE],
                    DEFAULT_EVM_BLOCK_HEIGHT,
                    DEFAULT_PARAMS_SIGNATURE
                )
            }).to.throw
        })

        it("should fail if questionCount is zero", async () => {
            try {
                tx = await contractInstance.newProcess(
                    [ProcessMode.make({}), ProcessEnvelopeType.make({}), ProcessCensusOrigin.OFF_CHAIN_TREE],
                    nullAddress, // token/entity ID
                    [DEFAULT_METADATA_CONTENT_HASHED_URI, DEFAULT_CENSUS_ROOT, DEFAULT_CENSUS_TREE_CONTENT_HASHED_URI],
                    [DEFAULT_START_BLOCK, DEFAULT_BLOCK_COUNT],
                    [0, DEFAULT_MAX_COUNT, DEFAULT_MAX_VALUE, DEFAULT_MAX_VOTE_OVERWRITES],
                    [DEFAULT_MAX_TOTAL_COST, DEFAULT_COST_EXPONENT, DEFAULT_NAMESPACE],
                    DEFAULT_EVM_BLOCK_HEIGHT,
                    DEFAULT_PARAMS_SIGNATURE
                )
                await tx.wait()
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert No questionCount/, "The transaction threw an unexpected error:\n" + err.message)
            }
        })

        it("should fail if maxCount is zero or above 100", async () => {
            try {
                tx = await contractInstance.newProcess(
                    [ProcessMode.make({}), ProcessEnvelopeType.make({}), ProcessCensusOrigin.OFF_CHAIN_TREE],
                    nullAddress, // token/entity ID
                    [DEFAULT_METADATA_CONTENT_HASHED_URI, DEFAULT_CENSUS_ROOT, DEFAULT_CENSUS_TREE_CONTENT_HASHED_URI],
                    [DEFAULT_START_BLOCK, DEFAULT_BLOCK_COUNT],
                    [DEFAULT_QUESTION_COUNT, 0, DEFAULT_MAX_VALUE, DEFAULT_MAX_VOTE_OVERWRITES],
                    [DEFAULT_MAX_TOTAL_COST, DEFAULT_COST_EXPONENT, DEFAULT_NAMESPACE],
                    DEFAULT_EVM_BLOCK_HEIGHT,
                    DEFAULT_PARAMS_SIGNATURE
                )
                await tx.wait()
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert Invalid maxCount/, "The transaction threw an unexpected error:\n" + err.message)
            }

            try {
                tx = await contractInstance.newProcess(
                    [ProcessMode.make({}), ProcessEnvelopeType.make({}), ProcessCensusOrigin.OFF_CHAIN_TREE],
                    nullAddress, // token/entity ID
                    [DEFAULT_METADATA_CONTENT_HASHED_URI, DEFAULT_CENSUS_ROOT, DEFAULT_CENSUS_TREE_CONTENT_HASHED_URI],
                    [DEFAULT_START_BLOCK, DEFAULT_BLOCK_COUNT],
                    [DEFAULT_QUESTION_COUNT, 101, DEFAULT_MAX_VALUE, DEFAULT_MAX_VOTE_OVERWRITES],
                    [DEFAULT_MAX_TOTAL_COST, DEFAULT_COST_EXPONENT, DEFAULT_NAMESPACE],
                    DEFAULT_EVM_BLOCK_HEIGHT,
                    DEFAULT_PARAMS_SIGNATURE
                )
                await tx.wait()
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert Invalid maxCount/, "The transaction threw an unexpected error:\n" + err.message)
            }
        })

        it("should fail if maxValue is zero", async () => {
            try {
                tx = await contractInstance.newProcess(
                    [ProcessMode.make({}), ProcessEnvelopeType.make({}), ProcessCensusOrigin.OFF_CHAIN_TREE],
                    nullAddress, // token/entity ID
                    [DEFAULT_METADATA_CONTENT_HASHED_URI, DEFAULT_CENSUS_ROOT, DEFAULT_CENSUS_TREE_CONTENT_HASHED_URI],
                    [DEFAULT_START_BLOCK, DEFAULT_BLOCK_COUNT],
                    [DEFAULT_QUESTION_COUNT, DEFAULT_MAX_COUNT, 0, DEFAULT_MAX_VOTE_OVERWRITES],
                    [DEFAULT_MAX_TOTAL_COST, DEFAULT_COST_EXPONENT, DEFAULT_NAMESPACE],
                    DEFAULT_EVM_BLOCK_HEIGHT,
                    DEFAULT_PARAMS_SIGNATURE
                )
                await tx.wait()
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert No maxValue/, "The transaction threw an unexpected error:\n" + err.message)
            }
        })

        it("should not increment the processCount of the entity on error", async () => {
            const prev = (await contractInstance.getEntityProcessCount(entityAccount.address)).toNumber()
            expect(prev).to.eq(1)

            try {
                tx = await contractInstance.newProcess(
                    [ProcessMode.make({}), ProcessEnvelopeType.make({}), ProcessCensusOrigin.OFF_CHAIN_TREE],
                    nullAddress, // token/entity ID
                    ["", "", ""],
                    [0, 0],
                    [0, 0, 0, 0],
                    [DEFAULT_MAX_TOTAL_COST, DEFAULT_COST_EXPONENT, DEFAULT_NAMESPACE],
                    DEFAULT_EVM_BLOCK_HEIGHT,
                    DEFAULT_PARAMS_SIGNATURE
                )
                await tx.wait()

                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert/, "The transaction threw an unexpected error:\n" + err.message)
            }

            const current = (await contractInstance.getEntityProcessCount(entityAccount.address)).toNumber()

            expect(current).to.eq(prev, "processCount should not have changed")
        })

        it("should emit an event", async () => {
            expect((await contractInstance.getEntityProcessCount(entityAccount.address)).toNumber()).to.eq(1)
            const expectedProcessId = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE, DEFAULT_CHAIN_ID)

            // One has already been created by the builder

            const result: { processId: string, namespace: number } = await new Promise((resolve, reject) => {
                contractInstance.on("NewProcess", (processId: string, namespace: number) => {
                    resolve({ namespace, processId })
                })
                // contractInstance.newProcess(
                //     [ProcessMode.make({ autoStart: true }), ProcessEnvelopeType.make(), ProcessCensusOrigin.OFF_CHAIN_TREE],
                //     nullAddress, // token/entity ID
                //     [DEFAULT_METADATA_CONTENT_HASHED_URI, DEFAULT_CENSUS_ROOT, DEFAULT_CENSUS_TREE_CONTENT_HASHED_URI],
                //     [DEFAULT_START_BLOCK, DEFAULT_BLOCK_COUNT],
                //     [DEFAULT_QUESTION_COUNT, DEFAULT_MAX_COUNT, DEFAULT_MAX_VALUE, DEFAULT_MAX_VOTE_OVERWRITES],
                //     [DEFAULT_MAX_TOTAL_COST, DEFAULT_COST_EXPONENT, DEFAULT_NAMESPACE],
                //     DEFAULT_PARAMS_SIGNATURE
                // ).then(tx => tx.wait()).catch(reject)
            })

            expect(result).to.be.ok
            expect(result.processId).to.equal(expectedProcessId)
            expect(result.namespace).to.equal(DEFAULT_NAMESPACE)
        }).timeout(10000)
    })

    describe("Process Status", () => {
        beforeEach(async () => {
            contractInstance = await new ProcessBuilder().withMode(ProcessMode.make({ autoStart: true })).build()
        })

        it("setting the status of a non-existent process should fail", async () => {
            for (let status of [ProcessStatus.READY, ProcessStatus.ENDED, ProcessStatus.CANCELED, ProcessStatus.PAUSED]) {
                const randomProcessId = "0x" + (Math.random().toString().substr(2) + Math.random().toString().substr(2) + Math.random().toString().substr(2) + Math.random().toString().substr(2) + Math.random().toString().substr(2)).substr(-64)

                try {
                    await contractInstance.setStatus(randomProcessId, status)
                    throw new Error("The transaction should have thrown an error but didn't")
                }
                catch (err) {
                    expect(err.message).to.match(/revert Not found/, "The transaction threw an unexpected error:\n" + err.message)
                }
            }
        })

        it("should create paused processes by default", async () => {
            contractInstance = await new ProcessBuilder().withMode(ProcessMode.make({ autoStart: false })).build()
            const processId1 = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE, DEFAULT_CHAIN_ID)

            // one is already created by the builder

            const processData1 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
            expect(processData1.status.value).to.eq(ProcessStatus.PAUSED, "The process should be paused")
        })

        it("should create processes in ready status when autoStart is set", async () => {
            contractInstance = await new ProcessBuilder().withMode(ProcessMode.make({ autoStart: true })).build()
            const processId1 = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE, DEFAULT_CHAIN_ID)

            const processData1 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
            expect(processData1.status.value).to.eq(ProcessStatus.READY, "The process should be ready")
        })

        it("should reject invalid status codes", async () => {
            // interruptible
            let mode = ProcessMode.make({ autoStart: true, interruptible: true })
            contractInstance = await new ProcessBuilder().withMode(mode).build()
            const processId1 = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE, DEFAULT_CHAIN_ID)
            // one is already created by the builder

            const processData0 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
            expect(processData0.status.value).to.eq(ProcessStatus.READY, "The process should be ready")

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

                const processData1 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                expect(processData1.mode.value).to.eq(mode)
                expect(processData1.entityAddress).to.eq(entityAccount.address)
                expect(processData1.status.value).to.eq(ProcessStatus.READY, "The process should remain ready")
            }
        })

        describe("Not interruptible", () => {
            it("should allow paused => ready (the first time) if autoStart is not set", async () => {
                // non-interruptible
                let mode = ProcessMode.make({ autoStart: false, interruptible: false })
                contractInstance = await new ProcessBuilder().withMode(mode).build()
                const processId1 = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE, DEFAULT_CHAIN_ID)
                // one is already created by the builder

                const processData0 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                expect(processData0.status.value).to.eq(ProcessStatus.PAUSED, "The process should be paused")

                // Set it to ready
                tx = await contractInstance.setStatus(processId1, ProcessStatus.READY)
                await tx.wait()

                const processData1 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                expect(processData1.mode.value).to.eq(mode)
                expect(processData1.entityAddress).to.eq(entityAccount.address)
                expect(processData1.status.value).to.eq(ProcessStatus.READY, "The process should be ready")

                // Try to set it back to paused
                try {
                    tx = await contractInstance.setStatus(processId1, ProcessStatus.PAUSED)
                    await tx.wait()
                    throw new Error("The transaction should have thrown an error but didn't")
                }
                catch (err) {
                    expect(err.message).to.match(/revert Not interruptible/, "The transaction threw an unexpected error:\n" + err.message)
                }

                const processData2 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                expect(processData2.mode.value).to.eq(mode)
                expect(processData2.entityAddress).to.eq(entityAccount.address)
                expect(processData2.status.value).to.eq(ProcessStatus.READY, "The process should remain ready")

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

                const processData3 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                expect(processData3.mode.value).to.eq(mode)
                expect(processData3.entityAddress).to.eq(entityAccount.address)
                expect(processData3.status.value).to.eq(ProcessStatus.READY, "The process should remain ready")

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

                const processData4 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                expect(processData4.mode.value).to.eq(mode)
                expect(processData4.entityAddress).to.eq(entityAccount.address)
                expect(processData4.status.value).to.eq(ProcessStatus.READY, "The process should remain ready")
            })

            it("should reject any other status update", async () => {
                // non-interruptible
                let mode = ProcessMode.make({ autoStart: true, interruptible: false })
                contractInstance = await new ProcessBuilder().withMode(mode).build()
                const processId1 = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE, DEFAULT_CHAIN_ID)
                // one is already created by the builder

                const processData0 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                expect(processData0.status.value).to.eq(ProcessStatus.READY, "The process should be ready")

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

                const processData2 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                expect(processData2.mode.value).to.eq(mode)
                expect(processData2.entityAddress).to.eq(entityAccount.address)
                expect(processData2.status.value).to.eq(ProcessStatus.READY, "The process should remain ready")

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

                const processData3 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                expect(processData3.mode.value).to.eq(mode)
                expect(processData3.entityAddress).to.eq(entityAccount.address)
                expect(processData3.status.value).to.eq(ProcessStatus.READY, "The process should remain ready")

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

                const processData4 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                expect(processData4.mode.value).to.eq(mode)
                expect(processData4.entityAddress).to.eq(entityAccount.address)
                expect(processData4.status.value).to.eq(ProcessStatus.READY, "The process should remain ready")

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

                const processData5 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                expect(processData5.mode.value).to.eq(mode)
                expect(processData5.entityAddress).to.eq(entityAccount.address)
                expect(processData5.status.value).to.eq(ProcessStatus.READY, "The process should remain ready")

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

                const processData6 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                expect(processData6.mode.value).to.eq(mode)
                expect(processData6.entityAddress).to.eq(entityAccount.address)
                expect(processData6.status.value).to.eq(ProcessStatus.READY, "The process should remain ready")
            })
        })
        describe("Interruptible", () => {
            describe("from ready", () => {
                it("should fail if setting to ready", async () => {
                    // interruptible
                    let mode = ProcessMode.make({ autoStart: true, interruptible: true })
                    contractInstance = await new ProcessBuilder().withMode(mode).build()
                    const processId1 = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE, DEFAULT_CHAIN_ID)
                    // one is already created by the builder

                    const processData0 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                    expect(processData0.status.value).to.eq(ProcessStatus.READY, "The process should be ready")

                    // Try to set it to Ready (it already is)
                    try {
                        tx = await contractInstance.setStatus(processId1, ProcessStatus.READY)
                        await tx.wait()
                        throw new Error("The transaction should have thrown an error but didn't")
                    }
                    catch (err) {
                        expect(err.message).to.match(/revert Must differ/, "The transaction threw an unexpected error:\n" + err.message)
                    }

                    const processData2 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                    expect(processData2.mode.value).to.eq(mode)
                    expect(processData2.entityAddress).to.eq(entityAccount.address)
                    expect(processData2.status.value).to.eq(ProcessStatus.READY, "The process should remain ready")
                })

                it("should allow to set to paused", async () => {
                    // interruptible
                    let mode = ProcessMode.make({ autoStart: true, interruptible: true })
                    contractInstance = await new ProcessBuilder().withMode(mode).build()
                    const processId1 = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE, DEFAULT_CHAIN_ID)
                    // one is already created by the builder

                    const processData0 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                    expect(processData0.status.value).to.eq(ProcessStatus.READY, "The process should be ready")

                    // Set it to paused
                    tx = await contractInstance.setStatus(processId1, ProcessStatus.PAUSED)
                    await tx.wait()

                    const processData1 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                    expect(processData1.mode.value).to.eq(mode)
                    expect(processData1.entityAddress).to.eq(entityAccount.address)
                    expect(processData1.status.value).to.eq(ProcessStatus.PAUSED, "The process should be paused")

                    // Set back to ready
                    tx = await contractInstance.setStatus(processId1, ProcessStatus.READY)
                    await tx.wait()

                    const processData2 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                    expect(processData2.mode.value).to.eq(mode)
                    expect(processData2.entityAddress).to.eq(entityAccount.address)
                    expect(processData2.status.value).to.eq(ProcessStatus.READY, "The process should be ready")
                })

                it("should allow to set to ended", async () => {
                    // interruptible
                    let mode = ProcessMode.make({ autoStart: true, interruptible: true })
                    contractInstance = await new ProcessBuilder().withMode(mode).build()
                    const processId1 = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE, DEFAULT_CHAIN_ID)
                    // one is already created by the builder

                    const processData0 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                    expect(processData0.status.value).to.eq(ProcessStatus.READY, "The process should be ready")

                    // Set it to ended
                    tx = await contractInstance.setStatus(processId1, ProcessStatus.ENDED)
                    await tx.wait()

                    const processData1 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                    expect(processData1.mode.value).to.eq(mode)
                    expect(processData1.entityAddress).to.eq(entityAccount.address)
                    expect(processData1.status.value).to.eq(ProcessStatus.ENDED, "The process should be ended")

                    // Try to set it back to ready
                    try {
                        tx = await contractInstance.setStatus(processId1, ProcessStatus.READY)
                        await tx.wait()
                        throw new Error("The transaction should have thrown an error but didn't")
                    }
                    catch (err) {
                        expect(err.message).to.match(/revert Process terminated/, "The transaction threw an unexpected error:\n" + err.message)
                    }

                    const processData2 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                    expect(processData2.mode.value).to.eq(mode)
                    expect(processData2.entityAddress).to.eq(entityAccount.address)
                    expect(processData2.status.value).to.eq(ProcessStatus.ENDED, "The process should remain ended")
                })

                it("should allow to set to canceled", async () => {
                    // interruptible
                    let mode = ProcessMode.make({ autoStart: true, interruptible: true })
                    contractInstance = await new ProcessBuilder().withMode(mode).build()
                    const processId1 = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE, DEFAULT_CHAIN_ID)
                    // one is already created by the builder

                    const processData0 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                    expect(processData0.status.value).to.eq(ProcessStatus.READY, "The process should be ready")

                    // Set it to canceled
                    tx = await contractInstance.setStatus(processId1, ProcessStatus.CANCELED)
                    await tx.wait()

                    const processData1 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                    expect(processData1.mode.value).to.eq(mode)
                    expect(processData1.entityAddress).to.eq(entityAccount.address)
                    expect(processData1.status.value).to.eq(ProcessStatus.CANCELED, "The process should be canceled")

                    // Try to set it back to ready
                    try {
                        tx = await contractInstance.setStatus(processId1, ProcessStatus.READY)
                        await tx.wait()
                        throw new Error("The transaction should have thrown an error but didn't")
                    }
                    catch (err) {
                        expect(err.message).to.match(/revert Process terminated/, "The transaction threw an unexpected error:\n" + err.message)
                    }

                    const processData2 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                    expect(processData2.mode.value).to.eq(mode)
                    expect(processData2.entityAddress).to.eq(entityAccount.address)
                    expect(processData2.status.value).to.eq(ProcessStatus.CANCELED, "The process should remain canceled")
                })

                it("should fail if setting to results", async () => {
                    // interruptible
                    let mode = ProcessMode.make({ autoStart: true, interruptible: true })
                    contractInstance = await new ProcessBuilder().withMode(mode).build()
                    const processId1 = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE, DEFAULT_CHAIN_ID)
                    // one is already created by the builder

                    const processData0 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                    expect(processData0.status.value).to.eq(ProcessStatus.READY, "The process should be ready")

                    // Try to set it back to results
                    try {
                        tx = await contractInstance.setStatus(processId1, ProcessStatus.RESULTS)
                        await tx.wait()
                        throw new Error("The transaction should have thrown an error but didn't")
                    }
                    catch (err) {
                        expect(err.message).to.match(/revert Invalid status code/, "The transaction threw an unexpected error:\n" + err.message)
                    }

                    const processData2 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                    expect(processData2.mode.value).to.eq(mode)
                    expect(processData2.entityAddress).to.eq(entityAccount.address)
                    expect(processData2.status.value).to.eq(ProcessStatus.READY, "The process should remain ready")
                })

                it("should fail if someone else tries to update the status", async () => {
                    const namespaceAddress = await contractInstance.namespaceAddress()
                    expect(namespaceAddress).to.match(/^0x[0-9a-fA-F]{40}$/)

                    for (let account of [authorizedOracleAccount1, authorizedOracleAccount2]) {
                        // interruptible
                        let mode = ProcessMode.make({ autoStart: true, interruptible: true })
                        contractInstance = await new ProcessBuilder().withMode(mode).build()
                        const processId1 = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE, DEFAULT_CHAIN_ID)
                        // one is already created by the builder

                        const processData0 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                        expect(processData0.status.value).to.eq(ProcessStatus.READY, "The process should be ready")

                        // even if the account is an oracle
                        const namespaceInstance = new Contract(namespaceAddress, namespaceAbi, deployAccount.wallet) as Contract & NamespaceContractMethods
                        tx = await namespaceInstance.addOracle(DEFAULT_NAMESPACE, account.address)
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

                        const processData2 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                        expect(processData2.mode.value).to.eq(mode)
                        expect(processData2.entityAddress).to.eq(entityAccount.address)
                        expect(processData2.status.value).to.eq(ProcessStatus.READY, "The process should remain ready")

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

                        const processData3 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                        expect(processData3.mode.value).to.eq(mode)
                        expect(processData3.entityAddress).to.eq(entityAccount.address)
                        expect(processData3.status.value).to.eq(ProcessStatus.READY, "The process should remain ready")

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

                        const processData4 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                        expect(processData4.mode.value).to.eq(mode)
                        expect(processData4.entityAddress).to.eq(entityAccount.address)
                        expect(processData4.status.value).to.eq(ProcessStatus.READY, "The process should remain ready")

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

                        const processData5 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                        expect(processData5.mode.value).to.eq(mode)
                        expect(processData5.entityAddress).to.eq(entityAccount.address)
                        expect(processData5.status.value).to.eq(ProcessStatus.READY, "The process should remain ready")

                        // Try to set it to results
                        try {
                            contractInstance = contractInstance.connect(account.wallet) as ProcessContractMethods & Contract
                            tx = await contractInstance.setStatus(processId1, ProcessStatus.RESULTS)
                            await tx.wait()
                            throw new Error("The transaction should have thrown an error but didn't")
                        }
                        catch (err) {
                            expect(err.message).to.match(/revert Invalid status code/, "The transaction threw an unexpected error:\n" + err.message)
                        }

                        const processData6 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                        expect(processData6.mode.value).to.eq(mode)
                        expect(processData6.entityAddress).to.eq(entityAccount.address)
                        expect(processData6.status.value).to.eq(ProcessStatus.READY, "The process should remain ready")
                    }
                }).timeout(4000)
            })

            describe("from paused", () => {
                it("should allow to set to ready", async () => {
                    // interruptible
                    let mode = ProcessMode.make({ autoStart: false, interruptible: true })
                    contractInstance = await new ProcessBuilder().withMode(mode).build()
                    const processId1 = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE, DEFAULT_CHAIN_ID)
                    // one is already created by the builder

                    const processData0 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                    expect(processData0.status.value).to.eq(ProcessStatus.PAUSED, "The process should be paused")

                    // Set it to ready
                    tx = await contractInstance.setStatus(processId1, ProcessStatus.READY)
                    await tx.wait()

                    const processData1 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                    expect(processData1.mode.value).to.eq(mode)
                    expect(processData1.entityAddress).to.eq(entityAccount.address)
                    expect(processData1.status.value).to.eq(ProcessStatus.READY, "The process should be ready")

                    // Set back to paused
                    tx = await contractInstance.setStatus(processId1, ProcessStatus.PAUSED)
                    await tx.wait()

                    const processData2 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                    expect(processData2.mode.value).to.eq(mode)
                    expect(processData2.entityAddress).to.eq(entityAccount.address)
                    expect(processData2.status.value).to.eq(ProcessStatus.PAUSED, "The process should be paused")
                })

                it("should fail if setting to paused", async () => {
                    // interruptible
                    let mode = ProcessMode.make({ autoStart: false, interruptible: true })
                    contractInstance = await new ProcessBuilder().withMode(mode).build()
                    const processId1 = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE, DEFAULT_CHAIN_ID)
                    // one is already created by the builder

                    const processData0 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                    expect(processData0.status.value).to.eq(ProcessStatus.PAUSED, "The process should be paused")

                    // Try to set it to paused (it already is)
                    try {
                        tx = await contractInstance.setStatus(processId1, ProcessStatus.PAUSED)
                        await tx.wait()
                        throw new Error("The transaction should have thrown an error but didn't")
                    }
                    catch (err) {
                        expect(err.message).to.match(/revert Must differ/, "The transaction threw an unexpected error:\n" + err.message)
                    }

                    const processData2 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                    expect(processData2.mode.value).to.eq(mode)
                    expect(processData2.entityAddress).to.eq(entityAccount.address)
                    expect(processData2.status.value).to.eq(ProcessStatus.PAUSED, "The process should remain paused")
                })

                it("should allow to set to ended", async () => {
                    // interruptible
                    let mode = ProcessMode.make({ autoStart: false, interruptible: true })
                    contractInstance = await new ProcessBuilder().withMode(mode).build()
                    const processId1 = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE, DEFAULT_CHAIN_ID)
                    // one is already created by the builder

                    const processData0 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                    expect(processData0.status.value).to.eq(ProcessStatus.PAUSED, "The process should be paused")

                    // Set it to ended
                    tx = await contractInstance.setStatus(processId1, ProcessStatus.ENDED)
                    await tx.wait()

                    const processData1 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                    expect(processData1.mode.value).to.eq(mode)
                    expect(processData1.entityAddress).to.eq(entityAccount.address)
                    expect(processData1.status.value).to.eq(ProcessStatus.ENDED, "The process should be ended")

                    // Try to set it back to paused
                    try {
                        tx = await contractInstance.setStatus(processId1, ProcessStatus.PAUSED)
                        await tx.wait()
                        throw new Error("The transaction should have thrown an error but didn't")
                    }
                    catch (err) {
                        expect(err.message).to.match(/revert Process terminated/, "The transaction threw an unexpected error:\n" + err.message)
                    }

                    const processData2 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                    expect(processData2.mode.value).to.eq(mode)
                    expect(processData2.entityAddress).to.eq(entityAccount.address)
                    expect(processData2.status.value).to.eq(ProcessStatus.ENDED, "The process should remain ended")
                })

                it("should allow to set to canceled", async () => {
                    // interruptible
                    let mode = ProcessMode.make({ autoStart: false, interruptible: true })
                    contractInstance = await new ProcessBuilder().withMode(mode).build()
                    const processId1 = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE, DEFAULT_CHAIN_ID)
                    // one is already created by the builder

                    const processData0 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                    expect(processData0.status.value).to.eq(ProcessStatus.PAUSED, "The process should be paused")

                    // Set it to canceled
                    tx = await contractInstance.setStatus(processId1, ProcessStatus.CANCELED)
                    await tx.wait()

                    const processData1 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                    expect(processData1.mode.value).to.eq(mode)
                    expect(processData1.entityAddress).to.eq(entityAccount.address)
                    expect(processData1.status.value).to.eq(ProcessStatus.CANCELED, "The process should be canceled")

                    // Try to set it back to paused
                    try {
                        tx = await contractInstance.setStatus(processId1, ProcessStatus.PAUSED)
                        await tx.wait()
                        throw new Error("The transaction should have thrown an error but didn't")
                    }
                    catch (err) {
                        expect(err.message).to.match(/revert Process terminated/, "The transaction threw an unexpected error:\n" + err.message)
                    }

                    const processData2 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                    expect(processData2.mode.value).to.eq(mode)
                    expect(processData2.entityAddress).to.eq(entityAccount.address)
                    expect(processData2.status.value).to.eq(ProcessStatus.CANCELED, "The process should remain canceled")
                })

                it("should fail if setting to results", async () => {
                    // interruptible
                    let mode = ProcessMode.make({ autoStart: false, interruptible: true })
                    contractInstance = await new ProcessBuilder().withMode(mode).build()
                    const processId1 = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE, DEFAULT_CHAIN_ID)
                    // one is already created by the builder

                    const processData0 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                    expect(processData0.status.value).to.eq(ProcessStatus.PAUSED, "The process should be paused")

                    // Try to set it back to results
                    try {
                        tx = await contractInstance.setStatus(processId1, ProcessStatus.RESULTS)
                        await tx.wait()
                        throw new Error("The transaction should have thrown an error but didn't")
                    }
                    catch (err) {
                        expect(err.message).to.match(/revert Invalid status code/, "The transaction threw an unexpected error:\n" + err.message)
                    }

                    const processData2 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                    expect(processData2.mode.value).to.eq(mode)
                    expect(processData2.entityAddress).to.eq(entityAccount.address)
                    expect(processData2.status.value).to.eq(ProcessStatus.PAUSED, "The process should remain paused")
                })

                it("should fail if someone else tries to update the status", async () => {
                    const namespaceAddress = await contractInstance.namespaceAddress()
                    expect(namespaceAddress).to.match(/^0x[0-9a-fA-F]{40}$/)

                    for (let account of [randomAccount1, randomAccount2, authorizedOracleAccount1]) {
                        // interruptible
                        let mode = ProcessMode.make({ autoStart: false, interruptible: true })
                        contractInstance = await new ProcessBuilder().withMode(mode).build()
                        const processId1 = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE, DEFAULT_CHAIN_ID)
                        // one is already created by the builder

                        const processData0 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                        expect(processData0.status.value).to.eq(ProcessStatus.PAUSED, "The process should be paused")

                        // even if the account is an oracle
                        const namespaceInstance = new Contract(namespaceAddress, namespaceAbi, deployAccount.wallet) as Contract & NamespaceContractMethods
                        tx = await namespaceInstance.addOracle(DEFAULT_NAMESPACE, account.address)
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

                        const processData2 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                        expect(processData2.mode.value).to.eq(mode)
                        expect(processData2.entityAddress).to.eq(entityAccount.address)
                        expect(processData2.status.value).to.eq(ProcessStatus.PAUSED, "The process should remain paused")

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

                        const processData3 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                        expect(processData3.mode.value).to.eq(mode)
                        expect(processData3.entityAddress).to.eq(entityAccount.address)
                        expect(processData3.status.value).to.eq(ProcessStatus.PAUSED, "The process should remain paused")

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

                        const processData4 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                        expect(processData4.mode.value).to.eq(mode)
                        expect(processData4.entityAddress).to.eq(entityAccount.address)
                        expect(processData4.status.value).to.eq(ProcessStatus.PAUSED, "The process should remain paused")

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

                        const processData5 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                        expect(processData5.mode.value).to.eq(mode)
                        expect(processData5.entityAddress).to.eq(entityAccount.address)
                        expect(processData5.status.value).to.eq(ProcessStatus.PAUSED, "The process should remain paused")

                        // Try to set it to results
                        try {
                            contractInstance = contractInstance.connect(account.wallet) as ProcessContractMethods & Contract
                            tx = await contractInstance.setStatus(processId1, ProcessStatus.RESULTS)
                            await tx.wait()
                            throw new Error("The transaction should have thrown an error but didn't")
                        }
                        catch (err) {
                            expect(err.message).to.match(/revert Invalid status code/, "The transaction threw an unexpected error:\n" + err.message)
                        }

                        const processData6 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                        expect(processData6.mode.value).to.eq(mode)
                        expect(processData6.entityAddress).to.eq(entityAccount.address)
                        expect(processData6.status.value).to.eq(ProcessStatus.PAUSED, "The process should remain paused")
                    }
                }).timeout(5000)
            })

            describe("from ended", () => {
                it("should never allow the status to be updated [creator]", async () => {
                    // interruptible
                    let mode = ProcessMode.make({ autoStart: false, interruptible: true })
                    contractInstance = await new ProcessBuilder().withMode(mode).build()
                    const processId1 = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE, DEFAULT_CHAIN_ID)
                    // one is already created by the builder

                    const processData0 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                    expect(processData0.status.value).to.eq(ProcessStatus.PAUSED, "The process should be paused")

                    // Set it to ended
                    tx = await contractInstance.setStatus(processId1, ProcessStatus.ENDED)
                    await tx.wait()

                    const processData1 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                    expect(processData1.mode.value).to.eq(mode)
                    expect(processData1.entityAddress).to.eq(entityAccount.address)
                    expect(processData1.status.value).to.eq(ProcessStatus.ENDED, "The process should be ended")

                    // Try to set it to ready
                    try {
                        tx = await contractInstance.setStatus(processId1, ProcessStatus.READY)
                        await tx.wait()
                        throw new Error("The transaction should have thrown an error but didn't")
                    }
                    catch (err) {
                        expect(err.message).to.match(/revert Process terminated/, "The transaction threw an unexpected error:\n" + err.message)
                    }

                    const processData2 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                    expect(processData2.entityAddress).to.eq(entityAccount.address)
                    expect(processData2.status.value).to.eq(ProcessStatus.ENDED, "The process should remain ended")

                    // Try to set it to paused
                    try {
                        tx = await contractInstance.setStatus(processId1, ProcessStatus.PAUSED)
                        await tx.wait()
                        throw new Error("The transaction should have thrown an error but didn't")
                    }
                    catch (err) {
                        expect(err.message).to.match(/revert Process terminated/, "The transaction threw an unexpected error:\n" + err.message)
                    }

                    const processData3 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                    expect(processData3.entityAddress).to.eq(entityAccount.address)
                    expect(processData3.status.value).to.eq(ProcessStatus.ENDED, "The process should remain ended")

                    // Try to set it to canceled
                    try {
                        tx = await contractInstance.setStatus(processId1, ProcessStatus.CANCELED)
                        await tx.wait()
                        throw new Error("The transaction should have thrown an error but didn't")
                    }
                    catch (err) {
                        expect(err.message).to.match(/revert Process terminated/, "The transaction threw an unexpected error:\n" + err.message)
                    }

                    const processData4 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                    expect(processData4.entityAddress).to.eq(entityAccount.address)
                    expect(processData4.status.value).to.eq(ProcessStatus.ENDED, "The process should remain ended")

                    // Try to set it to results
                    try {
                        tx = await contractInstance.setStatus(processId1, ProcessStatus.RESULTS)
                        await tx.wait()
                        throw new Error("The transaction should have thrown an error but didn't")
                    }
                    catch (err) {
                        expect(err.message).to.match(/revert Invalid status code/, "The transaction threw an unexpected error:\n" + err.message)
                    }

                    const processData5 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                    expect(processData5.entityAddress).to.eq(entityAccount.address)
                    expect(processData5.status.value).to.eq(ProcessStatus.ENDED, "The process should remain ended")
                })

                it("should never allow the status to be updated [other account]", async () => {
                    const namespaceAddress = await contractInstance.namespaceAddress()
                    expect(namespaceAddress).to.match(/^0x[0-9a-fA-F]{40}$/)

                    for (let account of [authorizedOracleAccount1, authorizedOracleAccount2]) {
                        // interruptible
                        let mode = ProcessMode.make({ autoStart: false, interruptible: true })
                        contractInstance = await new ProcessBuilder().withMode(mode).build()
                        const processId1 = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE, DEFAULT_CHAIN_ID)
                        // one is already created by the builder

                        const processData0 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                        expect(processData0.status.value).to.eq(ProcessStatus.PAUSED, "The process should be paused")

                        // Set it to ended
                        tx = await contractInstance.setStatus(processId1, ProcessStatus.ENDED)
                        await tx.wait()

                        const processData1 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                        expect(processData1.mode.value).to.eq(mode)
                        expect(processData1.entityAddress).to.eq(entityAccount.address)
                        expect(processData1.status.value).to.eq(ProcessStatus.ENDED, "The process should be ended")

                        // even if the account is an oracle
                        const namespaceInstance = new Contract(namespaceAddress, namespaceAbi, deployAccount.wallet) as Contract & NamespaceContractMethods
                        tx = await namespaceInstance.addOracle(DEFAULT_NAMESPACE, account.address)
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

                        const processData2 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                        expect(processData2.entityAddress).to.eq(entityAccount.address)
                        expect(processData2.status.value).to.eq(ProcessStatus.ENDED, "The process should remain ended")

                        // Try to set it to paused
                        try {
                            tx = await contractInstance.setStatus(processId1, ProcessStatus.PAUSED)
                            await tx.wait()
                            throw new Error("The transaction should have thrown an error but didn't")
                        }
                        catch (err) {
                            expect(err.message).to.match(/revert Invalid entity/, "The transaction threw an unexpected error:\n" + err.message)
                        }

                        const processData3 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                        expect(processData3.entityAddress).to.eq(entityAccount.address)
                        expect(processData3.status.value).to.eq(ProcessStatus.ENDED, "The process should remain ended")

                        // Try to set it to canceled
                        try {
                            tx = await contractInstance.setStatus(processId1, ProcessStatus.CANCELED)
                            await tx.wait()
                            throw new Error("The transaction should have thrown an error but didn't")
                        }
                        catch (err) {
                            expect(err.message).to.match(/revert Invalid entity/, "The transaction threw an unexpected error:\n" + err.message)
                        }

                        const processData4 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                        expect(processData4.entityAddress).to.eq(entityAccount.address)
                        expect(processData4.status.value).to.eq(ProcessStatus.ENDED, "The process should remain ended")

                        // Try to set it to results
                        try {
                            tx = await contractInstance.setStatus(processId1, ProcessStatus.RESULTS)
                            await tx.wait()
                            throw new Error("The transaction should have thrown an error but didn't")
                        }
                        catch (err) {
                            expect(err.message).to.match(/revert Invalid status code/, "The transaction threw an unexpected error:\n" + err.message)
                        }

                        const processData5 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                        expect(processData5.entityAddress).to.eq(entityAccount.address)
                        expect(processData5.status.value).to.eq(ProcessStatus.ENDED, "The process should remain ended")
                    }
                }).timeout(5000)
            })

            describe("from canceled", () => {
                it("should never allow the status to be updated [creator]", async () => {
                    // interruptible
                    let mode = ProcessMode.make({ autoStart: false, interruptible: true })
                    contractInstance = await new ProcessBuilder().withMode(mode).build()
                    const processId1 = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE, DEFAULT_CHAIN_ID)
                    // one is already created by the builder

                    const processData0 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                    expect(processData0.status.value).to.eq(ProcessStatus.PAUSED, "The process should be paused")

                    // Set it to canceled
                    tx = await contractInstance.setStatus(processId1, ProcessStatus.CANCELED)
                    await tx.wait()

                    const processData1 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                    expect(processData1.mode.value).to.eq(mode)
                    expect(processData1.entityAddress).to.eq(entityAccount.address)
                    expect(processData1.status.value).to.eq(ProcessStatus.CANCELED, "The process should be canceled")

                    // Try to set it to ready
                    try {
                        tx = await contractInstance.setStatus(processId1, ProcessStatus.READY)
                        await tx.wait()
                        throw new Error("The transaction should have thrown an error but didn't")
                    }
                    catch (err) {
                        expect(err.message).to.match(/revert Process terminated/, "The transaction threw an unexpected error:\n" + err.message)
                    }

                    const processData2 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                    expect(processData2.entityAddress).to.eq(entityAccount.address)
                    expect(processData2.status.value).to.eq(ProcessStatus.CANCELED, "The process should remain canceled")

                    // Try to set it to paused
                    try {
                        tx = await contractInstance.setStatus(processId1, ProcessStatus.PAUSED)
                        await tx.wait()
                        throw new Error("The transaction should have thrown an error but didn't")
                    }
                    catch (err) {
                        expect(err.message).to.match(/revert Process terminated/, "The transaction threw an unexpected error:\n" + err.message)
                    }

                    const processData3 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                    expect(processData3.entityAddress).to.eq(entityAccount.address)
                    expect(processData3.status.value).to.eq(ProcessStatus.CANCELED, "The process should remain canceled")

                    // Try to set it to ended
                    try {
                        tx = await contractInstance.setStatus(processId1, ProcessStatus.ENDED)
                        await tx.wait()
                        throw new Error("The transaction should have thrown an error but didn't")
                    }
                    catch (err) {
                        expect(err.message).to.match(/revert Process terminated/, "The transaction threw an unexpected error:\n" + err.message)
                    }

                    const processData4 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                    expect(processData4.entityAddress).to.eq(entityAccount.address)
                    expect(processData4.status.value).to.eq(ProcessStatus.CANCELED, "The process should remain canceled")

                    // Try to set it to results
                    try {
                        tx = await contractInstance.setStatus(processId1, ProcessStatus.RESULTS)
                        await tx.wait()
                        throw new Error("The transaction should have thrown an error but didn't")
                    }
                    catch (err) {
                        expect(err.message).to.match(/revert Invalid status code/, "The transaction threw an unexpected error:\n" + err.message)
                    }

                    const processData5 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                    expect(processData5.entityAddress).to.eq(entityAccount.address)
                    expect(processData5.status.value).to.eq(ProcessStatus.CANCELED, "The process should remain canceled")
                })

                it("should never allow the status to be updated [other account]", async () => {
                    const namespaceAddress = await contractInstance.namespaceAddress()
                    expect(namespaceAddress).to.match(/^0x[0-9a-fA-F]{40}$/)

                    for (let account of [authorizedOracleAccount1, authorizedOracleAccount2]) {
                        // interruptible
                        let mode = ProcessMode.make({ autoStart: false, interruptible: true })
                        contractInstance = await new ProcessBuilder().withMode(mode).build()
                        const processId1 = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE, DEFAULT_CHAIN_ID)
                        // one is already created by the builder

                        const processData0 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                        expect(processData0.status.value).to.eq(ProcessStatus.PAUSED, "The process should be paused")

                        // Set it to canceled
                        tx = await contractInstance.setStatus(processId1, ProcessStatus.CANCELED)
                        await tx.wait()

                        const processData1 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                        expect(processData1.mode.value).to.eq(mode)
                        expect(processData1.entityAddress).to.eq(entityAccount.address)
                        expect(processData1.status.value).to.eq(ProcessStatus.CANCELED, "The process should be canceled")

                        // even if the account is an oracle
                        const namespaceInstance = new Contract(namespaceAddress, namespaceAbi, deployAccount.wallet) as Contract & NamespaceContractMethods
                        tx = await namespaceInstance.addOracle(DEFAULT_NAMESPACE, account.address)
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

                        const processData2 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                        expect(processData2.entityAddress).to.eq(entityAccount.address)
                        expect(processData2.status.value).to.eq(ProcessStatus.CANCELED, "The process should remain canceled")

                        // Try to set it to paused
                        try {
                            tx = await contractInstance.setStatus(processId1, ProcessStatus.PAUSED)
                            await tx.wait()
                            throw new Error("The transaction should have thrown an error but didn't")
                        }
                        catch (err) {
                            expect(err.message).to.match(/revert Invalid entity/, "The transaction threw an unexpected error:\n" + err.message)
                        }

                        const processData3 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                        expect(processData3.entityAddress).to.eq(entityAccount.address)
                        expect(processData3.status.value).to.eq(ProcessStatus.CANCELED, "The process should remain canceled")

                        // Try to set it to ended
                        try {
                            tx = await contractInstance.setStatus(processId1, ProcessStatus.ENDED)
                            await tx.wait()
                            throw new Error("The transaction should have thrown an error but didn't")
                        }
                        catch (err) {
                            expect(err.message).to.match(/revert Invalid entity/, "The transaction threw an unexpected error:\n" + err.message)
                        }

                        const processData4 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                        expect(processData4.entityAddress).to.eq(entityAccount.address)
                        expect(processData4.status.value).to.eq(ProcessStatus.CANCELED, "The process should remain canceled")

                        // Try to set it to results
                        try {
                            tx = await contractInstance.setStatus(processId1, ProcessStatus.RESULTS)
                            await tx.wait()
                            throw new Error("The transaction should have thrown an error but didn't")
                        }
                        catch (err) {
                            expect(err.message).to.match(/revert Invalid status code/, "The transaction threw an unexpected error:\n" + err.message)
                        }

                        const processData5 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                        expect(processData5.entityAddress).to.eq(entityAccount.address)
                        expect(processData5.status.value).to.eq(ProcessStatus.CANCELED, "The process should remain canceled")
                    }
                }).timeout(5000)
            })

            describe("from results", () => {
                //authorizedOracleAccount1.wallet.signMessage(JSON.stringify({tally: DEFAULT_RESULTS_TALLY, height: DEFAULT_RESULTS_HEIGHT}))
                //.then((sig) => { authorizedOracleAccount1Signature = sig })

                it("should never allow the status to be updated [creator]", async () => {
                    // interruptible
                    let mode = ProcessMode.make({ autoStart: false, interruptible: true })
                    contractInstance = await new ProcessBuilder().withMode(mode).withOracle(authorizedOracleAccount1.address).build() as any
                    const processId1 = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE, DEFAULT_CHAIN_ID)
                    // one is already created by the builder

                    const processData0 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                    expect(processData0.status.value).to.eq(ProcessStatus.PAUSED, "The process should be paused")

                    // Set it to RESULTS (oracle)
                    contractInstance = contractInstance.connect(authorizedOracleAccount1.wallet) as any
                    tx = await contractInstance.setResults(processId1, DEFAULT_RESULTS_TALLY, DEFAULT_RESULTS_HEIGHT)
                    await tx.wait()
                    const processData1 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                    expect(processData1.mode.value).to.eq(mode)
                    expect(processData1.entityAddress).to.eq(entityAccount.address)
                    expect(processData1.status.value).to.eq(ProcessStatus.RESULTS, "The process should be in results")

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

                    const processData2 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                    expect(processData2.entityAddress).to.eq(entityAccount.address)
                    expect(processData2.status.value).to.eq(ProcessStatus.RESULTS, "The process should remain in results")

                    // Try to set it to paused
                    try {
                        tx = await contractInstance.setStatus(processId1, ProcessStatus.PAUSED)
                        await tx.wait()
                        throw new Error("The transaction should have thrown an error but didn't")
                    }
                    catch (err) {
                        expect(err.message).to.match(/revert Process terminated/, "The transaction threw an unexpected error:\n" + err.message)
                    }

                    const processData3 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                    expect(processData3.entityAddress).to.eq(entityAccount.address)
                    expect(processData3.status.value).to.eq(ProcessStatus.RESULTS, "The process should remain in results")

                    // Try to set it to ended
                    try {
                        tx = await contractInstance.setStatus(processId1, ProcessStatus.ENDED)
                        await tx.wait()
                        throw new Error("The transaction should have thrown an error but didn't")
                    }
                    catch (err) {
                        expect(err.message).to.match(/revert Process terminated/, "The transaction threw an unexpected error:\n" + err.message)
                    }

                    const processData4 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                    expect(processData4.entityAddress).to.eq(entityAccount.address)
                    expect(processData4.status.value).to.eq(ProcessStatus.RESULTS, "The process should remain in results")

                    // Try to set it to canceled
                    try {
                        tx = await contractInstance.setStatus(processId1, ProcessStatus.CANCELED)
                        await tx.wait()
                        throw new Error("The transaction should have thrown an error but didn't")
                    }
                    catch (err) {
                        expect(err.message).to.match(/revert Process terminated/, "The transaction threw an unexpected error:\n" + err.message)
                    }

                    const processData5 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                    expect(processData5.entityAddress).to.eq(entityAccount.address)
                    expect(processData5.status.value).to.eq(ProcessStatus.RESULTS, "The process should remain in results")
                })

                it("should never allow the status to be updated [other account]", async () => {
                    const namespaceAddress = await contractInstance.namespaceAddress()
                    expect(namespaceAddress).to.match(/^0x[0-9a-fA-F]{40}$/)

                    for (let account of [randomAccount1, randomAccount2]) {
                        let mode = ProcessMode.make({ autoStart: false, interruptible: true })
                        contractInstance = await new ProcessBuilder().withMode(mode).withOracle(authorizedOracleAccount1.address).build() as any

                        const processId1 = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE, DEFAULT_CHAIN_ID)
                        // one is already created by the builder

                        const processData0 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                        expect(processData0.status.value).to.eq(ProcessStatus.PAUSED, "The process should be paused")

                        // Set it to RESULTS (oracle)
                        contractInstance = contractInstance.connect(authorizedOracleAccount1.wallet) as any
                        tx = await contractInstance.setResults(processId1, DEFAULT_RESULTS_TALLY, DEFAULT_RESULTS_HEIGHT)
                        await tx.wait()

                        const processData1 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                        expect(processData1.mode.value).to.eq(mode)
                        expect(processData1.entityAddress).to.eq(entityAccount.address)
                        expect(processData1.status.value).to.eq(ProcessStatus.RESULTS, "The process should be in results")

                        // even if the account is an oracle
                        const namespaceInstance = new Contract(namespaceAddress, namespaceAbi, deployAccount.wallet) as Contract & NamespaceContractMethods
                        tx = await namespaceInstance.addOracle(DEFAULT_NAMESPACE, account.address)
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

                        const processData2 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                        expect(processData2.entityAddress).to.eq(entityAccount.address)
                        expect(processData2.status.value).to.eq(ProcessStatus.RESULTS, "The process should remain in results")

                        // Try to set it to paused
                        try {
                            tx = await contractInstance.setStatus(processId1, ProcessStatus.PAUSED)
                            await tx.wait()
                            throw new Error("The transaction should have thrown an error but didn't")
                        }
                        catch (err) {
                            expect(err.message).to.match(/revert Invalid entity/, "The transaction threw an unexpected error:\n" + err.message)
                        }

                        const processData3 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                        expect(processData3.entityAddress).to.eq(entityAccount.address)
                        expect(processData3.status.value).to.eq(ProcessStatus.RESULTS, "The process should remain in results")

                        // Try to set it to ended
                        try {
                            tx = await contractInstance.setStatus(processId1, ProcessStatus.ENDED)
                            await tx.wait()
                            throw new Error("The transaction should have thrown an error but didn't")
                        }
                        catch (err) {
                            expect(err.message).to.match(/revert Invalid entity/, "The transaction threw an unexpected error:\n" + err.message)
                        }

                        const processData4 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                        expect(processData4.entityAddress).to.eq(entityAccount.address)
                        expect(processData4.status.value).to.eq(ProcessStatus.RESULTS, "The process should remain in results")

                        // Try to set it to canceled
                        try {
                            tx = await contractInstance.setStatus(processId1, ProcessStatus.CANCELED)
                            await tx.wait()
                            throw new Error("The transaction should have thrown an error but didn't")
                        }
                        catch (err) {
                            expect(err.message).to.match(/revert Invalid entity/, "The transaction threw an unexpected error:\n" + err.message)
                        }

                        const processData5 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                        expect(processData5.entityAddress).to.eq(entityAccount.address)
                        expect(processData5.status.value).to.eq(ProcessStatus.RESULTS, "The process should remain in results")
                    }
                }).timeout(4000)
            })

            describe("only the oracle", () => {
                it("can set the results", async () => {
                    const namespaceAddress = await contractInstance.namespaceAddress()
                    expect(namespaceAddress).to.match(/^0x[0-9a-fA-F]{40}$/)

                    for (let account of [authorizedOracleAccount1, authorizedOracleAccount2]) {
                        let mode = ProcessMode.make({ autoStart: true, interruptible: true })
                        contractInstance = await new ProcessBuilder().withNamespaceInstance(namespaceAddress).withMode(mode).build()
                        const processId1 = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE, DEFAULT_CHAIN_ID)
                        // one is already created by the builder

                        const processData0 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                        expect(processData0.status.value).to.eq(ProcessStatus.READY, "The process should be ready")

                        // Try to set the results (fail)
                        try {
                            tx = await contractInstance.setResults(processId1, DEFAULT_RESULTS_TALLY, DEFAULT_RESULTS_HEIGHT)
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
                        const namespaceInstance = new Contract(namespaceAddress, namespaceAbi, deployAccount.wallet) as Contract & NamespaceContractMethods
                        tx = await namespaceInstance.addOracle(DEFAULT_NAMESPACE, account.address)
                        await tx.wait()

                        contractInstance = contractInstance.connect(account.wallet) as any
                        tx = await contractInstance.setResults(processId1, DEFAULT_RESULTS_TALLY, DEFAULT_RESULTS_HEIGHT)
                        await tx.wait()

                        const processData1 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                        expect(processData1.mode.value).to.eq(mode)
                        expect(processData1.entityAddress).to.eq(entityAccount.address)
                        expect(processData1.status.value).to.eq(ProcessStatus.RESULTS, "The process should be in results")
                    }
                })
            })
        })

        it("should emit an event", async () => {
            const scenarios = [
                { mode: ProcessMode.make({ autoStart: false, interruptible: true }), status: ProcessStatus.READY },
                { mode: ProcessMode.make({ autoStart: true, interruptible: true }), status: ProcessStatus.PAUSED },
                { mode: ProcessMode.make({ interruptible: true }), status: ProcessStatus.ENDED },
                { mode: ProcessMode.make({ interruptible: true }), status: ProcessStatus.CANCELED },
            ]
            for (let scenario of scenarios) {
                const contractInstance = await new ProcessBuilder().withMode(scenario.mode).build()
                const processId = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE, DEFAULT_CHAIN_ID)

                // One has already been created by the builder

                const result: { processId: string, namespace: number, newStatus: number } = await new Promise((resolve, reject) => {
                    contractInstance.on("StatusUpdated", (processId: string, namespace: number, newStatus: number) => {
                        resolve({ namespace, processId, newStatus })
                    })
                    contractInstance.setStatus(processId, scenario.status).then(tx => tx.wait()).catch(reject)
                })

                expect(result).to.be.ok
                expect(result.processId).to.equal(processId)
                expect(result.namespace).to.equal(DEFAULT_NAMESPACE)
                expect(result.newStatus).to.equal(scenario.status)
            }
        }).timeout(20000)
    })

    describe("Serial envelope", () => {
        it("incrementing the question index of a non-existent process should fail", async () => {
            for (let i = 0; i < 5; i++) {
                const randomProcessId = "0x" + (Math.random().toString().substr(2) + Math.random().toString().substr(2) + Math.random().toString().substr(2) + Math.random().toString().substr(2) + Math.random().toString().substr(2)).substr(-64)

                try {
                    await contractInstance.incrementQuestionIndex(randomProcessId)
                    throw new Error("The transaction should have thrown an error but didn't")
                }
                catch (err) {
                    expect(err.message).to.match(/revert Not found/, "The transaction threw an unexpected error:\n" + err.message)
                }
            }
        })

        it("The question index should be read-only by default", async () => {
            contractInstance = await new ProcessBuilder()
                .withMode(ProcessMode.make({ autoStart: true })) // status = ready
                .withEnvelopeType(ProcessEnvelopeType.make({ serial: false }))
                .withQuestionCount(5)
                .build()

            const processData0 = ProcessContractParameters.fromContract(await contractInstance.get(processId))
            expect(processData0.questionIndex).to.eq(0, "The process should be at question 0")

            // Try to increment (fail)
            try {
                tx = await contractInstance.incrementQuestionIndex(processId)
                await tx.wait()
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert Process not serial/, "The transaction threw an unexpected error:\n" + err.message)
            }

            const processData1 = ProcessContractParameters.fromContract(await contractInstance.get(processId))
            expect(processData1.entityAddress).to.eq(entityAccount.address)
            expect(processData1.questionIndex).to.eq(0, "The process should remain at question 0")
        })

        it("The question index can be incremented in serial envelope mode", async () => {
            contractInstance = await new ProcessBuilder()
                .withMode(ProcessMode.make({ autoStart: true })) // status = ready
                .withEnvelopeType(ProcessEnvelopeType.make({ serial: true }))
                .withQuestionCount(5)
                .build()

            const processData0 = ProcessContractParameters.fromContract(await contractInstance.get(processId))
            expect(processData0.envelopeType.value).to.eq(ProcessEnvelopeType.make({ serial: true }))
            expect(processData0.questionIndex).to.eq(0, "The process should be at question 0")

            tx = await contractInstance.incrementQuestionIndex(processId)
            await tx.wait()

            const processData1 = ProcessContractParameters.fromContract(await contractInstance.get(processId))
            expect(processData1.entityAddress).to.eq(entityAccount.address)
            expect(processData1.questionIndex).to.eq(1, "The process should now be at question 1")

            tx = await contractInstance.incrementQuestionIndex(processId)
            await tx.wait()

            const processData2 = ProcessContractParameters.fromContract(await contractInstance.get(processId))
            expect(processData2.entityAddress).to.eq(entityAccount.address)
            expect(processData2.questionIndex).to.eq(2, "The process should now be at question 2")
        })

        it("Should only allow the process creator to increment", async () => {
            contractInstance = await new ProcessBuilder()
                .withMode(ProcessMode.make({ autoStart: true })) // status = ready
                .withEnvelopeType(ProcessEnvelopeType.make({ serial: true }))
                .withQuestionCount(5)
                .build()

            const processData0 = ProcessContractParameters.fromContract(await contractInstance.get(processId))
            expect(processData0.questionIndex).to.eq(0, "The process should be at question 0")

            for (let account of [randomAccount1, randomAccount2]) {
                contractInstance = contractInstance.connect(account.wallet) as any

                // Try to increment (fail)
                try {
                    tx = await contractInstance.incrementQuestionIndex(processId)
                    await tx.wait()
                    throw new Error("The transaction should have thrown an error but didn't")
                }
                catch (err) {
                    expect(err.message).to.match(/revert Invalid entity/, "The transaction threw an unexpected error:\n" + err.message)
                }
            }

            const processData1 = ProcessContractParameters.fromContract(await contractInstance.get(processId))
            expect(processData1.entityAddress).to.eq(entityAccount.address)
            expect(processData1.questionIndex).to.eq(0, "The process should remain at question 0")
        })

        it("Should fail if the process is paused", async () => {
            contractInstance = await new ProcessBuilder()
                .withMode(ProcessMode.make({ autoStart: true, interruptible: true }))
                .withEnvelopeType(ProcessEnvelopeType.make({ serial: true }))
                .withQuestionCount(5)
                .build()

            const processData0 = ProcessContractParameters.fromContract(await contractInstance.get(processId))
            expect(processData0.status.value).to.eq(ProcessStatus.READY, "Should be ready")
            expect(processData0.questionIndex).to.eq(0, "The process should be at question 0")

            tx = await contractInstance.setStatus(processId, ProcessStatus.PAUSED)
            await tx.wait()

            // Try to increment (fail)
            try {
                tx = await contractInstance.incrementQuestionIndex(processId)
                await tx.wait()
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert Process not ready/, "The transaction threw an unexpected error:\n" + err.message)
            }

            const processData2 = ProcessContractParameters.fromContract(await contractInstance.get(processId))
            expect(processData2.entityAddress).to.eq(entityAccount.address)
            expect(processData0.status.value).to.eq(ProcessStatus.READY, "Should remain ready")
            expect(processData2.questionIndex).to.eq(0, "The process should remain at question 0")
        }).timeout(7000)

        it("Should fail if the process is terminated", async () => {
            // ENDED, CANCELED
            for (let status of [ProcessStatus.ENDED, ProcessStatus.CANCELED]) {
                contractInstance = await new ProcessBuilder()
                    .withMode(ProcessMode.make({ autoStart: true, interruptible: true }))
                    .withEnvelopeType(ProcessEnvelopeType.make({ serial: true }))
                    .withQuestionCount(5)
                    .build()

                const processData0 = ProcessContractParameters.fromContract(await contractInstance.get(processId))
                expect(processData0.questionIndex).to.eq(0, "The process should be at question 0")

                tx = await contractInstance.setStatus(processId, status)
                await tx.wait()

                // Try to increment (fail)
                try {
                    tx = await contractInstance.incrementQuestionIndex(processId)
                    await tx.wait()
                    throw new Error("The transaction should have thrown an error but didn't")
                }
                catch (err) {
                    expect(err.message).to.match(/revert Process not ready/, "The transaction threw an unexpected error:\n" + err.message)
                }
            }

            // RESULTS

            contractInstance = await new ProcessBuilder()
                .withMode(ProcessMode.make({ autoStart: true })) // status = ready
                .withEnvelopeType(ProcessEnvelopeType.make({ serial: true }))
                .withQuestionCount(5)
                .withOracle(authorizedOracleAccount1.address)
                .build()

            const processData1 = ProcessContractParameters.fromContract(await contractInstance.get(processId))
            expect(processData1.questionIndex).to.eq(0, "The process should be at question 0")

            // set some results
            contractInstance = contractInstance.connect(authorizedOracleAccount1.wallet) as any
            tx = await contractInstance.setResults(processId, [[9, 8], [7, 6], [5, 4], [3, 2], [1, 0]], 10)
            await tx.wait()

            contractInstance = contractInstance.connect(entityAccount.wallet) as any

            // Try to increment (fail)
            try {
                tx = await contractInstance.incrementQuestionIndex(processId)
                await tx.wait()
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert Process not ready/, "The transaction threw an unexpected error:\n" + err.message)
            }

            const processData2 = ProcessContractParameters.fromContract(await contractInstance.get(processId))
            expect(processData2.entityAddress).to.eq(entityAccount.address)
            expect(processData2.questionIndex).to.eq(0, "The process should remain at question 0")
        }).timeout(7000)

        it("Should end a process after the last question has been incremented", async () => {
            contractInstance = await new ProcessBuilder()
                .withMode(ProcessMode.make({ autoStart: true })) // status = ready
                .withEnvelopeType(ProcessEnvelopeType.make({ serial: true }))
                .withQuestionCount(5)
                .build()

            const processData0 = ProcessContractParameters.fromContract(await contractInstance.get(processId))
            expect(processData0.questionIndex).to.eq(0, "The process should be at question 0")

            for (let idx = 0; idx < 4; idx++) {
                tx = await contractInstance.incrementQuestionIndex(processId)
                await tx.wait()

                const processData1 = ProcessContractParameters.fromContract(await contractInstance.get(processId))
                expect(processData1.questionIndex).to.eq(idx + 1, "The process should be at question " + (idx + 1))
            }

            // last increment
            tx = await contractInstance.incrementQuestionIndex(processId)
            await tx.wait()

            const processData2 = ProcessContractParameters.fromContract(await contractInstance.get(processId))
            expect(processData2.status.value).to.eq(ProcessStatus.ENDED, "The process should be ended")
        }).timeout(6000)

        it("Should emit an event when the current question is incremented", async () => {
            contractInstance = await new ProcessBuilder()
                .withMode(ProcessMode.make({ autoStart: true }))
                .withEnvelopeType(ProcessEnvelopeType.make({ serial: true }))
                .withQuestionCount(5)
                .build()

            const expectedProcessId = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE, DEFAULT_CHAIN_ID)

            // One has already been created by the builder

            const result: { processId: string, namespace: number, nextId: number } = await new Promise((resolve, reject) => {
                contractInstance.on("QuestionIndexUpdated", (processId: string, namespace: number, nextId: number) => {
                    resolve({ namespace, processId, nextId })
                })
                contractInstance.incrementQuestionIndex(processId).then(tx => tx.wait()).catch(reject)
            })

            expect(result).to.be.ok
            expect(result.processId).to.equal(expectedProcessId)
            expect(result.namespace).to.equal(DEFAULT_NAMESPACE)
            expect(result.nextId).to.equal(1)
        }).timeout(7000)

        it("Should emit an event when question increment ends the process", async () => {
            contractInstance = await new ProcessBuilder()
                .withMode(ProcessMode.make({ autoStart: true }))
                .withEnvelopeType(ProcessEnvelopeType.make({ serial: true }))
                .withQuestionCount(2)
                .build()

            const expectedProcessId = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE, DEFAULT_CHAIN_ID)

            // One has already been created by the builder

            const result: { processId: string, namespace: number, newStatus: number } = await new Promise((resolve, reject) => {
                contractInstance.on("StatusUpdated", (processId: string, namespace: number, newStatus: number) => {
                    resolve({ namespace, processId, newStatus })
                })
                // 2x
                contractInstance.incrementQuestionIndex(processId).then(tx => tx.wait())
                    .then(() => contractInstance.incrementQuestionIndex(processId).then(tx => tx.wait()))
                    .catch(reject)
            })

            expect(result).to.be.ok
            expect(result.processId).to.equal(expectedProcessId)
            expect(result.namespace).to.equal(DEFAULT_NAMESPACE)
            expect(result.newStatus).to.equal(ProcessStatus.ENDED)

            const processData1 = ProcessContractParameters.fromContract(await contractInstance.get(processId))
            expect(processData1.status.value).to.eq(ProcessStatus.ENDED, "The process should be ended")
        }).timeout(8000)
    })

    describe("Dynamic Census", () => {
        it("setting the census of a non-existent process should fail", async () => {
            for (let i = 0; i < 5; i++) {
                const randomProcessId = "0x" + (Math.random().toString().substr(2) + Math.random().toString().substr(2) + Math.random().toString().substr(2) + Math.random().toString().substr(2) + Math.random().toString().substr(2)).substr(-64)

                try {
                    await contractInstance.setCensus(randomProcessId, Math.random().toString(), Math.random().toString())
                    throw new Error("The transaction should have thrown an error but didn't")
                }
                catch (err) {
                    expect(err.message).to.match(/revert Not found/, "The transaction threw an unexpected error:\n" + err.message)
                }
            }
        })

        it("Should keep the census read-only by default", async () => {
            let mode = ProcessMode.make({ autoStart: true, dynamicCensus: false })
            contractInstance = await new ProcessBuilder().withMode(mode).build()
            processId = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE, DEFAULT_CHAIN_ID)
            // one is already created by the builder

            const processData0 = ProcessContractParameters.fromContract(await contractInstance.get(processId))
            expect(processData0.status.value).to.eq(ProcessStatus.READY, "The process should be ready")

            // Try to update it
            try {
                tx = await contractInstance.setCensus(processId, "new-census-root", "new-census-tree")
                await tx.wait()
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert Read-only census/, "The transaction threw an unexpected error:\n" + err.message)
            }

            const processData1 = ProcessContractParameters.fromContract(await contractInstance.get(processId))
            expect(processData1.mode.value).to.eq(mode)
            expect(processData1.entityAddress).to.eq(entityAccount.address)
            expect(processData1.censusRoot).to.eq(DEFAULT_CENSUS_ROOT)
            expect(processData1.censusUri).to.eq(DEFAULT_CENSUS_TREE_CONTENT_HASHED_URI)

            // 2

            mode = ProcessMode.make({ autoStart: false, dynamicCensus: false })
            contractInstance = await new ProcessBuilder().withMode(mode).build()
            processId = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE, DEFAULT_CHAIN_ID)
            // one is already created by the builder

            const processData2 = ProcessContractParameters.fromContract(await contractInstance.get(processId))
            expect(processData2.status.value).to.eq(ProcessStatus.PAUSED, "The process should be paused")

            // Try to update it
            try {
                tx = await contractInstance.setCensus(processId, "123412341234", "345634563456")
                await tx.wait()
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert Read-only census/, "The transaction threw an unexpected error:\n" + err.message)
            }

            const processData3 = ProcessContractParameters.fromContract(await contractInstance.get(processId))
            expect(processData3.mode.value).to.eq(mode)
            expect(processData3.entityAddress).to.eq(entityAccount.address)
            expect(processData3.censusRoot).to.eq(DEFAULT_CENSUS_ROOT)
            expect(processData3.censusUri).to.eq(DEFAULT_CENSUS_TREE_CONTENT_HASHED_URI)
        })

        it("Should allow to update the census in dynamic census mode", async () => {
            let mode = ProcessMode.make({ autoStart: true, dynamicCensus: true })
            contractInstance = await new ProcessBuilder().withMode(mode).build()
            processId = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE, DEFAULT_CHAIN_ID)
            // one is already created by the builder

            const processData0 = ProcessContractParameters.fromContract(await contractInstance.get(processId))
            expect(processData0.status.value).to.eq(ProcessStatus.READY, "The process should be ready")

            // Update it
            tx = await contractInstance.setCensus(processId, "new-census-root", "new-census-tree")
            await tx.wait()

            const processData1 = ProcessContractParameters.fromContract(await contractInstance.get(processId))
            expect(processData1.mode.value).to.eq(mode)
            expect(processData1.entityAddress).to.eq(entityAccount.address)
            expect(processData1.censusRoot).to.eq("new-census-root")
            expect(processData1.censusUri).to.eq("new-census-tree")

            // 2

            mode = ProcessMode.make({ autoStart: false, dynamicCensus: true })
            contractInstance = await new ProcessBuilder().withMode(mode).build()
            processId = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE, DEFAULT_CHAIN_ID)
            // one is already created by the builder

            const processData2 = ProcessContractParameters.fromContract(await contractInstance.get(processId))
            expect(processData2.status.value).to.eq(ProcessStatus.PAUSED, "The process should be paused")

            // Update it
            tx = await contractInstance.setCensus(processId, "123412341234", "345634563456")
            await tx.wait()

            const processData3 = ProcessContractParameters.fromContract(await contractInstance.get(processId))
            expect(processData3.mode.value).to.eq(mode)
            expect(processData3.entityAddress).to.eq(entityAccount.address)
            expect(processData3.censusRoot).to.eq("123412341234")
            expect(processData3.censusUri).to.eq("345634563456")
        })

        it("Should only allow the creator to update the census", async () => {
            let mode = ProcessMode.make({ autoStart: true, dynamicCensus: true })
            contractInstance = await new ProcessBuilder().withMode(mode).build()
            const processId1 = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE, DEFAULT_CHAIN_ID)
            // one is already created by the builder

            const processData0 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
            expect(processData0.status.value).to.eq(ProcessStatus.READY, "The process should be ready")

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

                const processData1 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                expect(processData1.entityAddress).to.eq(entityAccount.address)
                expect(processData1.censusRoot).to.eq(DEFAULT_CENSUS_ROOT)
                expect(processData1.censusUri).to.eq(DEFAULT_CENSUS_TREE_CONTENT_HASHED_URI)
            }
        })

        it("Should fail updating the census on terminated processes", async () => {
            // 1 - ENDED
            let mode = ProcessMode.make({ interruptible: true, dynamicCensus: true })
            contractInstance = await new ProcessBuilder().withMode(mode).build()
            processId = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE, DEFAULT_CHAIN_ID)
            // one is already created by the builder

            const processData0 = ProcessContractParameters.fromContract(await contractInstance.get(processId))
            expect(processData0.status.value).to.eq(ProcessStatus.PAUSED, "The process should be paused")

            tx = await contractInstance.setStatus(processId, ProcessStatus.ENDED)
            await tx.wait()

            // Try to update it
            try {
                tx = await contractInstance.setCensus(processId, "new-census-root", "new-census-tree")
                await tx.wait()
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert Process terminated/, "The transaction threw an unexpected error:\n" + err.message)
            }

            const processData1 = ProcessContractParameters.fromContract(await contractInstance.get(processId))
            expect(processData1.mode.value).to.eq(mode)
            expect(processData1.status.value).to.eq(ProcessStatus.ENDED, "The process should be ended")
            expect(processData1.entityAddress).to.eq(entityAccount.address)
            expect(processData1.censusRoot).to.eq(DEFAULT_CENSUS_ROOT)
            expect(processData1.censusUri).to.eq(DEFAULT_CENSUS_TREE_CONTENT_HASHED_URI)

            // 2 - CANCELED

            mode = ProcessMode.make({ interruptible: true, dynamicCensus: true })
            contractInstance = await new ProcessBuilder().withMode(mode).build()
            processId = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE, DEFAULT_CHAIN_ID)
            // one is already created by the builder

            const processData2 = ProcessContractParameters.fromContract(await contractInstance.get(processId))
            expect(processData2.status.value).to.eq(ProcessStatus.PAUSED, "The process should be paused")

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

            const processData3 = ProcessContractParameters.fromContract(await contractInstance.get(processId))
            expect(processData3.mode.value).to.eq(mode)
            expect(processData3.status.value).to.eq(ProcessStatus.CANCELED, "The process should be canceled")
            expect(processData3.entityAddress).to.eq(entityAccount.address)
            expect(processData3.censusRoot).to.eq(DEFAULT_CENSUS_ROOT)
            expect(processData3.censusUri).to.eq(DEFAULT_CENSUS_TREE_CONTENT_HASHED_URI)

            // 3 - RESULTS

            mode = ProcessMode.make({ interruptible: true, dynamicCensus: true })
            contractInstance = await new ProcessBuilder().withMode(mode).withOracle(authorizedOracleAccount1.address).build()
            processId = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE, DEFAULT_CHAIN_ID)
            // one is already created by the builder

            const processData4 = ProcessContractParameters.fromContract(await contractInstance.get(processId))
            expect(processData4.status.value).to.eq(ProcessStatus.PAUSED, "The process should be paused")

            contractInstance = contractInstance.connect(authorizedOracleAccount1.wallet) as any
            tx = await contractInstance.setResults(processId, DEFAULT_RESULTS_TALLY, DEFAULT_RESULTS_HEIGHT)
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

            const processData5 = ProcessContractParameters.fromContract(await contractInstance.get(processId))
            expect(processData5.mode.value).to.eq(mode)
            expect(processData5.status.value).to.eq(ProcessStatus.RESULTS, "The process should have results")
            expect(processData5.entityAddress).to.eq(entityAccount.address)
            expect(processData5.censusRoot).to.eq(DEFAULT_CENSUS_ROOT)
            expect(processData5.censusUri).to.eq(DEFAULT_CENSUS_TREE_CONTENT_HASHED_URI)
        }).timeout(4000)

        it("should emit an event", async () => {
            const contractInstance = await new ProcessBuilder().withMode(ProcessMode.make({ dynamicCensus: true })).build()
            const processId = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE, DEFAULT_CHAIN_ID)

            // One has already been created by the builder

            const result: { processId: string, namespace: number } = await new Promise((resolve, reject) => {
                contractInstance.on("CensusUpdated", (processId: string, namespace: number) => {
                    resolve({ namespace, processId })
                })
                contractInstance.setCensus(processId, "new-census-root", "new-census-tree-uri").then(tx => tx.wait()).catch(reject)
            })

            expect(result).to.be.ok
            expect(result.processId).to.equal(processId)
            expect(result.namespace).to.equal(DEFAULT_NAMESPACE)
        }).timeout(7000)
    })

    describe("Process Results", () => {
        //authorizedOracleAccount1.wallet.signMessage(JSON.stringify({tally: DEFAULT_RESULTS_TALLY, height: DEFAULT_RESULTS_HEIGHT}))
        //        .then((sig) => { authorizedOracleAccount1Signature = sig })

        it("getting the results of a non-existent process should fail", async () => {
            for (let i = 0; i < 5; i++) {
                const randomProcessId = "0x" + (Math.random().toString().substr(2) + Math.random().toString().substr(2) + Math.random().toString().substr(2) + Math.random().toString().substr(2) + Math.random().toString().substr(2)).substr(-64)

                try {
                    await contractInstance.getResults(randomProcessId)
                    throw new Error("The transaction should have thrown an error but didn't")
                }
                catch (err) {
                    expect(err.message).to.match(/revert Not found/, "The transaction threw an unexpected error:\n" + err.message)
                }
            }
        })

        it("setting results on a non-existent process should fail", async () => {
            contractInstance = await new ProcessBuilder().withOracle(authorizedOracleAccount1.address).build() as any

            contractInstance = contractInstance.connect(authorizedOracleAccount1.wallet) as any

            for (let i = 0; i < 5; i++) {
                const randomProcessId = "0x" + (Math.random().toString().substr(2) + Math.random().toString().substr(2) + Math.random().toString().substr(2) + Math.random().toString().substr(2) + Math.random().toString().substr(2)).substr(-64)

                try {
                    await contractInstance.setResults(randomProcessId, DEFAULT_RESULTS_TALLY, DEFAULT_RESULTS_HEIGHT)
                    throw new Error("The transaction should have thrown an error but didn't")
                }
                catch (err) {
                    expect(err.message).to.match(/revert Not found/, "The transaction threw an unexpected error:\n" + err.message)
                }
            }
        })

        it("should be accepted when the sender is a registered oracle", async () => {
            const namespaceAddress = await contractInstance.namespaceAddress()
            expect(namespaceAddress).to.match(/^0x[0-9a-fA-F]{40}$/)

            const processId = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE, DEFAULT_CHAIN_ID)

            // One is already created by the builder

            // Attempt to publish the results by someone else
            try {
                contractInstance = contractInstance.connect(randomAccount1.wallet) as any
                tx = await contractInstance.setResults(processId, DEFAULT_RESULTS_TALLY, DEFAULT_RESULTS_HEIGHT)
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
            const namespaceInstance = new Contract(namespaceAddress, namespaceAbi, deployAccount.wallet) as Contract & NamespaceContractMethods
            tx = await namespaceInstance.addOracle(DEFAULT_NAMESPACE, authorizedOracleAccount1.address)
            await tx.wait()

            // Publish the results
            contractInstance = contractInstance.connect(authorizedOracleAccount1.wallet) as any
            tx = await contractInstance.setResults(processId, DEFAULT_RESULTS_TALLY, DEFAULT_RESULTS_HEIGHT)

            // Get results
            const result4 = await contractInstance.getResults(processId)
            expect(result4.tally).to.deep.eq(DEFAULT_RESULTS_TALLY, "The results should match")
            expect(result4.height).to.eq(DEFAULT_RESULTS_HEIGHT, "The results should match")
        }).timeout(6000)

        it("should be accepted when the processId exists", async () => {
            const nonExistingProcessId1 = "0x0123456789012345678901234567890123456789012345678901234567890123"
            const nonExistingProcessId2 = "0x1234567890123456789012345678901234567890123456789012345678901234"

            contractInstance = await new ProcessBuilder().withOracle(authorizedOracleAccount1.address).build() as any

            try {
                // Try to publish
                contractInstance = contractInstance.connect(authorizedOracleAccount1.wallet) as any
                tx = await contractInstance.setResults(nonExistingProcessId1, DEFAULT_RESULTS_TALLY, DEFAULT_RESULTS_HEIGHT)
                await tx.wait()
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert Not found/, "The transaction threw an unexpected error:\n" + err.message)
            }

            try {
                // Try to publish
                contractInstance = contractInstance.connect(authorizedOracleAccount1.wallet) as any
                tx = await contractInstance.setResults(nonExistingProcessId2, DEFAULT_RESULTS_TALLY, DEFAULT_RESULTS_HEIGHT)
                await tx.wait()
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert Not found/, "The transaction threw an unexpected error:\n" + err.message)
            }
        })

        it("should not be accepted when the process is canceled", async () => {
            contractInstance = await new ProcessBuilder().withMode(ProcessMode.make({ interruptible: true })).withOracle(authorizedOracleAccount1.address).build()
            processId = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE, DEFAULT_CHAIN_ID)

            // One is already created by the builder

            // Cancel the process
            tx = await contractInstance.setStatus(processId, ProcessStatus.CANCELED)
            await tx.wait()

            // Attempt to publish the results after canceling
            try {
                contractInstance = contractInstance.connect(authorizedOracleAccount1.wallet) as any
                tx = await contractInstance.setResults(processId, DEFAULT_RESULTS_TALLY, DEFAULT_RESULTS_HEIGHT)
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert Canceled or already set/, "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get results
            const result4 = await contractInstance.getResults(processId)
            expect(result4.tally).to.deep.eq(emptyArray, "There should be no results")
            expect(result4.height).to.eq(0, "There should be no votes")
        }).timeout(5000)

        it("should retrieve the submited results", async () => {
            contractInstance = await new ProcessBuilder().withOracle(authorizedOracleAccount1.address).build()

            const processId = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE, DEFAULT_CHAIN_ID)

            // One is already created by the builder

            // Publish the results
            contractInstance = contractInstance.connect(authorizedOracleAccount1.wallet) as any
            tx = await contractInstance.setResults(processId, DEFAULT_RESULTS_TALLY, DEFAULT_RESULTS_HEIGHT)

            // Get results
            const result3 = await contractInstance.getResults(processId)
            expect(result3.tally).to.deep.eq(DEFAULT_RESULTS_TALLY, "The tally of the results should match")
            expect(result3.height).to.eq(DEFAULT_RESULTS_HEIGHT, "The height of the results should match")

        }).timeout(5000)

        it("should allow oracles to set the results", async () => {
            const namespaceAddress = await contractInstance.namespaceAddress()
            expect(namespaceAddress).to.match(/^0x[0-9a-fA-F]{40}$/)

            for (let account of [authorizedOracleAccount1, authorizedOracleAccount2]) {
                let mode = ProcessMode.make({ autoStart: true, interruptible: true })
                contractInstance = await new ProcessBuilder().withNamespaceInstance(namespaceAddress).withMode(mode).build()
                const processId1 = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE, DEFAULT_CHAIN_ID)
                // one is already created by the builder

                const processData0 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                expect(processData0.status.value).to.eq(ProcessStatus.READY, "The process should be ready")

                // Try to set the results (fail)
                try {
                    tx = await contractInstance.setResults(processId1, DEFAULT_RESULTS_TALLY, DEFAULT_RESULTS_HEIGHT)
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
                const namespaceInstance = new Contract(namespaceAddress, namespaceAbi, deployAccount.wallet) as Contract & NamespaceContractMethods
                tx = await namespaceInstance.addOracle(DEFAULT_NAMESPACE, account.address)
                await tx.wait()

                contractInstance = contractInstance.connect(account.wallet) as any
                tx = await contractInstance.setResults(processId1, DEFAULT_RESULTS_TALLY, DEFAULT_RESULTS_HEIGHT)
                await tx.wait()

                const processData1 = ProcessContractParameters.fromContract(await contractInstance.get(processId1))
                expect(processData1.mode.value).to.eq(mode)
                expect(processData1.entityAddress).to.eq(entityAccount.address)
                expect(processData1.status.value).to.eq(ProcessStatus.RESULTS, "The process should be in results")
            }
        })

        it("should prevent publishing twice", async () => {
            contractInstance = await new ProcessBuilder().withOracle(authorizedOracleAccount1.address).build()

            const processId = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE, DEFAULT_CHAIN_ID)

            // One is already created by the builder

            // publish results
            contractInstance = contractInstance.connect(authorizedOracleAccount1.wallet) as any
            tx = await contractInstance.setResults(processId, DEFAULT_RESULTS_TALLY, DEFAULT_RESULTS_HEIGHT)

            // Get results
            const result3 = await contractInstance.getResults(processId)
            expect(result3.tally).to.deep.eq(DEFAULT_RESULTS_TALLY, "The tally of the results should match")
            expect(result3.height).to.eq(DEFAULT_RESULTS_HEIGHT, "The height of the results should match")

            const processData1 = ProcessContractParameters.fromContract(await contractInstance.get(processId))
            expect(processData1.entityAddress).to.eq(entityAccount.address)
            expect(processData1.status.value).to.eq(ProcessStatus.RESULTS, "The process should be in results")

            // Try update the results
            try {
                contractInstance = contractInstance.connect(authorizedOracleAccount1.wallet) as any
                tx = await contractInstance.setResults(processId, DEFAULT_RESULTS_TALLY, DEFAULT_RESULTS_HEIGHT)
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert Canceled or already set/, "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get results
            const result4 = await contractInstance.getResults(processId)
            expect(result4.tally).to.deep.eq(DEFAULT_RESULTS_TALLY, "The tally of the results should match")
            expect(result4.height).to.eq(DEFAULT_RESULTS_HEIGHT, "The height of the results should match")

            const processData2 = ProcessContractParameters.fromContract(await contractInstance.get(processId))
            expect(processData2.entityAddress).to.eq(entityAccount.address)
            expect(processData2.status.value).to.eq(ProcessStatus.RESULTS, "The process should be in results")
        }).timeout(5000)

        it("should emit an event", async () => {
            contractInstance = await new ProcessBuilder().withOracle(authorizedOracleAccount1.address).build()

            const processId1 = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE, DEFAULT_CHAIN_ID)

            // one is already created by the builder

            contractInstance = contractInstance.connect(authorizedOracleAccount1.wallet) as any
            const result: { processId: string } = await new Promise((resolve, reject) => {
                contractInstance.on("ResultsAvailable", (processId: string) => resolve({ processId }))
                contractInstance.setResults(processId1, DEFAULT_RESULTS_TALLY, DEFAULT_RESULTS_HEIGHT).then(tx => tx.wait()).catch(reject)
            })

            expect(result).to.be.ok
            expect(result.processId).to.equal(processId1)
        }).timeout(5000)
    })

    describe("Namespace management", () => {
        it("should allow to retrieve the current namespace contract address", async () => {
            const newNamespaceInstance = await new NamespaceBuilder().build()
            contractInstance = await new ProcessBuilder().withNamespaceInstance(newNamespaceInstance.address).build()

            const namespaceAddress = await contractInstance.namespaceAddress()
            expect(namespaceAddress).to.match(/^0x[0-9a-fA-F]{40}$/)
            expect(namespaceAddress).to.eq(newNamespaceInstance.address)

            // Attach
            const namespaceInstance = new Contract(namespaceAddress, namespaceAbi, deployAccount.wallet) as Contract & NamespaceContractMethods
            expect(await namespaceInstance.getNamespace(DEFAULT_NAMESPACE)).to.be.ok
        })

        it("should allow the contract creator to update the namespace contract address", async () => {
            const prevNamespaceAddress = await contractInstance.namespaceAddress()

            contractInstance = contractInstance.connect(deployAccount.wallet) as any

            // update it
            const newNamespaceInstance = await new NamespaceBuilder().build()
            tx = await contractInstance.setNamespaceAddress(newNamespaceInstance.address)
            await tx.wait()

            // check that it changed
            expect(await contractInstance.namespaceAddress()).to.eq(newNamespaceInstance.address)
            expect(await contractInstance.namespaceAddress()).to.not.eq(prevNamespaceAddress)
        })

        it("should fail if someone else attempts to update the namespace contract address", async () => {
            const prevNamespaceAddress = await contractInstance.namespaceAddress()

            for (let account of [randomAccount1, randomAccount2]) {
                contractInstance = contractInstance.connect(account.wallet) as any

                // try to update it
                const newNamespaceInstance = await new NamespaceBuilder().build()
                try {
                    tx = await contractInstance.setNamespaceAddress(newNamespaceInstance.address)
                    await tx.wait()
                    throw new Error("The transaction should have thrown an error but didn't")
                }
                catch (err) {
                    expect(err.message).to.match(/revert onlyContractOwner/, "The transaction threw an unexpected error:\n" + err.message)
                }

                // check that it didn't change
                expect(await contractInstance.namespaceAddress()).to.eq(prevNamespaceAddress)
                expect(await contractInstance.namespaceAddress()).to.not.eq(newNamespaceInstance.address)
            }
        })

        it("should stop allowing setResults from an oracle that no longer belongs to the new instance", async () => {
            contractInstance = await new ProcessBuilder().withOracle(authorizedOracleAccount1.address).build()
            const namespaceAddress1 = await contractInstance.namespaceAddress()
            const namespaceInstance1 = new Contract(namespaceAddress1, namespaceAbi, entityAccount.wallet) as Contract & NamespaceContractMethods
            expect(await namespaceInstance1.isOracle(DEFAULT_NAMESPACE, authorizedOracleAccount1.address)).to.be.true

            // Set a new namespace instance without the Oracle
            const newNamespaceInstance = await new NamespaceBuilder().withOracles([]).build()
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            tx = await contractInstance.setNamespaceAddress(newNamespaceInstance.address)
            await tx.wait()

            const namespaceAddress2 = await contractInstance.namespaceAddress()
            expect(namespaceAddress2).to.eq(newNamespaceInstance.address)
            expect(namespaceAddress2).to.not.eq(namespaceAddress1)
            const namespaceInstance2 = new Contract(namespaceAddress2, namespaceAbi, entityAccount.wallet) as Contract & NamespaceContractMethods

            expect(await namespaceInstance2.isOracle(DEFAULT_NAMESPACE, authorizedOracleAccount1.address)).to.be.false

            // Try to publish results
            try {
                contractInstance = contractInstance.connect(authorizedOracleAccount1.wallet) as any
                tx = await contractInstance.setResults(processId, DEFAULT_RESULTS_TALLY, DEFAULT_RESULTS_HEIGHT)
                throw new Error("The transaction should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.match(/revert Not oracle/, "The transaction threw an unexpected error:\n" + err.message)
            }

            // Get results
            const result2 = await contractInstance.getResults(processId)
            expect(result2.tally).to.deep.eq(emptyArray, "There should be no results")

            // Get status
            const processData1 = ProcessContractParameters.fromContract(await contractInstance.get(processId))
            expect(processData1.status.value).to.eq(ProcessStatus.PAUSED, "The process should be paused")
        }).timeout(4000)

        it("should emit an event", async () => {
            contractInstance = contractInstance.connect(deployAccount.wallet) as any
            const newNamespaceInstance = await new NamespaceBuilder().build()

            const result: { namespaceAddress: string } = await new Promise((resolve, reject) => {
                contractInstance.on("NamespaceAddressUpdated", (namespaceAddress: string) => resolve({ namespaceAddress }))

                contractInstance.setNamespaceAddress(newNamespaceInstance.address).then(tx => tx.wait()).catch(reject)
            })

            expect(result).to.be.ok
            expect(result.namespaceAddress).to.equal(newNamespaceInstance.address)
        }).timeout(7000)
    })

    describe("Process price & Withdraw", () => {
        it("should change the process price only if owner", async() => {
            const namespaceInstance1 = await new NamespaceBuilder().build()
            const storageProofAddress = (await new TokenStorageProofBuilder().build()).address
            const contractFactory1 = new ContractFactory(processAbi, processByteCode, deployAccount.wallet)
            const localInstance1: Contract & ProcessContractMethods = await contractFactory1.deploy(nullAddress, namespaceInstance1.address, storageProofAddress, ethChainId, DEFAULT_PROCESS_PRICE) as Contract & ProcessContractMethods

            // owner should pass
            const actualPrice = await localInstance1.processPrice()
            const tx = await localInstance1.setProcessPrice(utils.parseUnits("2", "ether"))
            await tx.wait()
            const newPrice = await localInstance1.processPrice()
            expect(actualPrice).to.not.be.deep.equal(newPrice)
            expect(actualPrice).to.be.deep.equal(utils.parseUnits("0", "ether"))
            expect(newPrice).to.be.deep.equal(utils.parseUnits("2", "ether"))

            // random account should fail
            const localInstanceNotOwner = localInstance1.connect(randomAccount2.wallet) as any
            try {
                const tx2 = await localInstanceNotOwner.setProcessPrice(utils.parseUnits("0", "ether"))
                await tx2.wait()
                throw new Error("The transaction should have thrown an error but didn't")
            } catch (err) {
                expect(err.message).to.match(/revert onlyContractOwner/, "The transaction threw an unexpected error:\n" + err.message)
            }
            const newPrice2 = await localInstanceNotOwner.processPrice()
            expect(newPrice2).to.be.deep.equal(utils.parseUnits("2", "ether"))
        })

        it("should not change the process price if the new value is the same as the actual", async() => {
            const namespaceInstance1 = await new NamespaceBuilder().build()
            const storageProofAddress = (await new TokenStorageProofBuilder().build()).address
            const contractFactory1 = new ContractFactory(processAbi, processByteCode, deployAccount.wallet)
            const localInstance1: Contract & ProcessContractMethods = await contractFactory1.deploy(nullAddress, namespaceInstance1.address, storageProofAddress, ethChainId, DEFAULT_PROCESS_PRICE) as Contract & ProcessContractMethods

            // same process price should fail
            const actualPrice = await localInstance1.processPrice()
            try {
                const tx = await localInstance1.setProcessPrice(utils.parseUnits("0", "ether"))
                await tx.wait()
                throw new Error("The transaction should have thrown an error but didn't")
            } catch (err) {
                expect(err.message).to.match(/revert Process price cannot be the same/, "The transaction threw an unexpected error:\n" + err.message)
            }
            expect(actualPrice).to.be.deep.equal(utils.parseUnits("0", "ether"))
        })

        it("should emit an event when price changed", async() => {
            const namespaceInstance1 = await new NamespaceBuilder().build()
            const storageProofAddress = (await new TokenStorageProofBuilder().build()).address
            const contractFactory1 = new ContractFactory(processAbi, processByteCode, deployAccount.wallet)
            const localInstance1: Contract & ProcessContractMethods = await contractFactory1.deploy(nullAddress, namespaceInstance1.address, storageProofAddress, ethChainId, DEFAULT_PROCESS_PRICE) as Contract & ProcessContractMethods

            // owner should pass
            const actualPrice = await localInstance1.processPrice()

            const result: { processPrice: number | BigNumber } = await new Promise((resolve, reject) => {
                localInstance1.on("ProcessPriceUpdated", (processPrice: number | BigNumber) => {
                    resolve({ processPrice })
                })
                localInstance1.setProcessPrice(utils.parseUnits("1", "ether")).then(tx => tx.wait()).catch(reject)
            })

            expect(result).to.be.ok
            const newPrice = await localInstance1.processPrice()
            expect(actualPrice).to.not.be.deep.equal(newPrice)
            expect(actualPrice).to.be.deep.equal(utils.parseUnits("0", "ether"))
            expect(newPrice).to.be.deep.equal(utils.parseUnits("1", "ether"))
        })

        it("should allow to withdraw only if owner", async() => {
            const namespaceInstance1 = await new NamespaceBuilder().build()
            const storageProofAddress = (await new TokenStorageProofBuilder().build()).address
            const contractFactory1 = new ContractFactory(processAbi, processByteCode, deployAccount.wallet)
            const localInstance1: Contract & ProcessContractMethods = await contractFactory1.deploy(nullAddress, namespaceInstance1.address, storageProofAddress, ethChainId, DEFAULT_PROCESS_PRICE) as Contract & ProcessContractMethods

            const txProcess = await localInstance1.newProcess(
                [ProcessMode.make({ autoStart: true }), ProcessEnvelopeType.make(), ProcessCensusOrigin.OFF_CHAIN_TREE],
                deployAccount.address, // token/entity ID
                [DEFAULT_METADATA_CONTENT_HASHED_URI, DEFAULT_CENSUS_ROOT, DEFAULT_CENSUS_TREE_CONTENT_HASHED_URI],
                [DEFAULT_START_BLOCK, DEFAULT_BLOCK_COUNT],
                [DEFAULT_QUESTION_COUNT, DEFAULT_MAX_COUNT, DEFAULT_MAX_VALUE, DEFAULT_MAX_VOTE_OVERWRITES],
                [DEFAULT_MAX_TOTAL_COST, DEFAULT_COST_EXPONENT, DEFAULT_NAMESPACE],
                DEFAULT_EVM_BLOCK_HEIGHT,
                DEFAULT_PARAMS_SIGNATURE,
                {value: utils.parseUnits("2", "ether")}
            )
            
            await txProcess.wait()
            const provider = getProvider()
            expect(await provider.getBalance(localInstance1.address)).to.be.deep.equal(utils.parseUnits("2", "ether"))

            // owner should pass
            const randomAccount1Balance = await randomAccount1.wallet.getBalance()
            const tx = await localInstance1.withdraw(randomAccount1.address, utils.parseUnits("1000", "wei"))
            await tx.wait()
            const randomAccount1BalanceNew = await randomAccount1.wallet.getBalance()
            expect(randomAccount1BalanceNew).to.be.deep.equal(randomAccount1Balance.add(utils.parseUnits("1000", "wei")))
            
            // random account should fail
            const localInstanceNotOwner = localInstance1.connect(randomAccount2.wallet) as any
            try {
                const tx2 = await localInstanceNotOwner.withdraw(randomAccount1.address, utils.parseUnits("1000", "wei"))
                await tx2.wait()
                throw new Error("The transaction should have thrown an error but didn't")
            } catch (err) {
                expect(err.message).to.match(/revert onlyContractOwner/, "The transaction threw an unexpected error:\n" + err.message)
            }
        })

        it("should allow to withdraw only if balance is higher than the requested amount", async() => {
            const namespaceInstance1 = await new NamespaceBuilder().build()
            const storageProofAddress = (await new TokenStorageProofBuilder().build()).address
            const contractFactory1 = new ContractFactory(processAbi, processByteCode, deployAccount.wallet)
            const localInstance1: Contract & ProcessContractMethods = await contractFactory1.deploy(nullAddress, namespaceInstance1.address, storageProofAddress, ethChainId, DEFAULT_PROCESS_PRICE) as Contract & ProcessContractMethods

            const txProcess = await localInstance1.newProcess(
                [ProcessMode.make({ autoStart: true }), ProcessEnvelopeType.make(), ProcessCensusOrigin.OFF_CHAIN_TREE],
                deployAccount.address, // token/entity ID
                [DEFAULT_METADATA_CONTENT_HASHED_URI, DEFAULT_CENSUS_ROOT, DEFAULT_CENSUS_TREE_CONTENT_HASHED_URI],
                [DEFAULT_START_BLOCK, DEFAULT_BLOCK_COUNT],
                [DEFAULT_QUESTION_COUNT, DEFAULT_MAX_COUNT, DEFAULT_MAX_VALUE, DEFAULT_MAX_VOTE_OVERWRITES],
                [DEFAULT_MAX_TOTAL_COST, DEFAULT_COST_EXPONENT, DEFAULT_NAMESPACE],
                DEFAULT_EVM_BLOCK_HEIGHT,
                DEFAULT_PARAMS_SIGNATURE,
                {value: utils.parseUnits("2", "ether")}
            )
            
            await txProcess.wait()

            // should pass
            const randomAccount1Balance = await randomAccount1.wallet.getBalance()
            const tx = await localInstance1.withdraw(randomAccount1.address, utils.parseUnits("1", "ether"))
            await tx.wait()
            const randomAccount1BalanceNew = await randomAccount1.wallet.getBalance()
            expect(randomAccount1BalanceNew).to.be.deep.equal(randomAccount1Balance.add(utils.parseUnits("1", "ether")))
            
            // insufficient balance should fail
            try {
                const tx2 = await localInstance1.withdraw(randomAccount1.address, utils.parseUnits("10", "ether"))
                await tx2.wait()
                throw new Error("The transaction should have thrown an error but didn't")
            } catch (err) {
                expect(err.message).to.match(/revert Insufficient funds to withdraw/, "The transaction threw an unexpected error:\n" + err.message)
            }
        })

        it("should allow to withdraw only to valid addresses", async() => {
            const namespaceInstance1 = await new NamespaceBuilder().build()
            const storageProofAddress = (await new TokenStorageProofBuilder().build()).address
            const contractFactory1 = new ContractFactory(processAbi, processByteCode, deployAccount.wallet)
            const localInstance1: Contract & ProcessContractMethods = await contractFactory1.deploy(nullAddress, namespaceInstance1.address, storageProofAddress, ethChainId, DEFAULT_PROCESS_PRICE) as Contract & ProcessContractMethods

            const txProcess = await localInstance1.newProcess(
                [ProcessMode.make({ autoStart: true }), ProcessEnvelopeType.make(), ProcessCensusOrigin.OFF_CHAIN_TREE],
                deployAccount.address, // token/entity ID
                [DEFAULT_METADATA_CONTENT_HASHED_URI, DEFAULT_CENSUS_ROOT, DEFAULT_CENSUS_TREE_CONTENT_HASHED_URI],
                [DEFAULT_START_BLOCK, DEFAULT_BLOCK_COUNT],
                [DEFAULT_QUESTION_COUNT, DEFAULT_MAX_COUNT, DEFAULT_MAX_VALUE, DEFAULT_MAX_VOTE_OVERWRITES],
                [DEFAULT_MAX_TOTAL_COST, DEFAULT_COST_EXPONENT, DEFAULT_NAMESPACE],
                DEFAULT_EVM_BLOCK_HEIGHT,
                DEFAULT_PARAMS_SIGNATURE,
                {value: utils.parseUnits("2", "ether")}
            )
            
            await txProcess.wait()

            // should pass
            const randomAccount1Balance = await randomAccount1.wallet.getBalance()
            const tx = await localInstance1.withdraw(randomAccount1.address, utils.parseUnits("1", "ether"))
            await tx.wait()
            const randomAccount1BalanceNew = await randomAccount1.wallet.getBalance()
            expect(randomAccount1BalanceNew).to.be.deep.equal(randomAccount1Balance.add(utils.parseUnits("1", "ether")))
            
            // invalid address should fail
            try {
                const tx2 = await localInstance1.withdraw(nullAddress, utils.parseUnits("0.5", "ether"))
                await tx2.wait()
                throw new Error("The transaction should have thrown an error but didn't")
            } catch (err) {
                expect(err.message).to.match(/revert Invalid address to send/, "The transaction threw an unexpected error:\n" + err.message)
            }
        })

        it("should emit an event when withdraw", async() => {
            const namespaceInstance1 = await new NamespaceBuilder().build()
            const storageProofAddress = (await new TokenStorageProofBuilder().build()).address
            const contractFactory1 = new ContractFactory(processAbi, processByteCode, deployAccount.wallet)
            const localInstance1: Contract & ProcessContractMethods = await contractFactory1.deploy(nullAddress, namespaceInstance1.address, storageProofAddress, ethChainId, DEFAULT_PROCESS_PRICE) as Contract & ProcessContractMethods

            const txProcess = await localInstance1.newProcess(
                [ProcessMode.make({ autoStart: true }), ProcessEnvelopeType.make(), ProcessCensusOrigin.OFF_CHAIN_TREE],
                deployAccount.address, // token/entity ID
                [DEFAULT_METADATA_CONTENT_HASHED_URI, DEFAULT_CENSUS_ROOT, DEFAULT_CENSUS_TREE_CONTENT_HASHED_URI],
                [DEFAULT_START_BLOCK, DEFAULT_BLOCK_COUNT],
                [DEFAULT_QUESTION_COUNT, DEFAULT_MAX_COUNT, DEFAULT_MAX_VALUE, DEFAULT_MAX_VOTE_OVERWRITES],
                [DEFAULT_MAX_TOTAL_COST, DEFAULT_COST_EXPONENT, DEFAULT_NAMESPACE],
                DEFAULT_EVM_BLOCK_HEIGHT,
                DEFAULT_PARAMS_SIGNATURE,
                {value: utils.parseUnits("2", "ether")}
            )
            
            await txProcess.wait()

            const result: { to: string, amount: number | BigNumber } = await new Promise((resolve, reject) => {
                localInstance1.on("Withdraw", (to: string, amount: number | BigNumber) => {
                    resolve({ to, amount })
                })
                localInstance1.withdraw(randomAccount1.address, utils.parseUnits("0.5", "ether")).then(tx => tx.wait()).catch(reject)
            })

            expect(result).to.be.ok
        })
    })

}).timeout(4000)

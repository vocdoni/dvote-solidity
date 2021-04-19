import { expect } from "chai"
import { Contract, ContractFactory, ContractTransaction } from "ethers"
import "mocha" // using @types/mocha
import { abi as tokenStorageProofAbi, bytecode as tokenStorageProofByteCode } from "../../build/token-storage-proof.json"
import { Erc20StorageProofContractMethods } from "../../lib"
import TokenStorageProofBuilder from "../builders/token-storage-proof"
import { getAccounts, TestAccount } from "../utils"
import { addCompletionHooks } from "../utils/mocha-hooks"



let accounts: TestAccount[]
let deployAccount: TestAccount
let randomAccount1: TestAccount
let randomAccount2: TestAccount
let contractInstance: Erc20StorageProofContractMethods & Contract
let tx: ContractTransaction

const nullAddress = "0x0000000000000000000000000000000000000000"
const emptyArray: Array<number> = []

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

describe("StorageProofTest contract", () => {
    beforeEach(async () => {
        accounts = getAccounts()
        deployAccount = accounts[0]
        randomAccount1 = accounts[2]
        randomAccount2 = accounts[3]
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

    /*
    it("should register a token contract with registerToken()", async () => {
        const solc = require("solc")
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

        // register
        contractInstance = await new TokenStorageProofBuilder().build()

        expect(await contractInstance.isRegistered(dummyTokenInstance.address)).to.eq(false)
        expect(await contractInstance.isVerified(dummyTokenInstance.address)).to.eq(false)

        expect(await contractInstance.tokenCount()).to.eq(0)
        expect(() => contractInstance.tokenAddresses(0)).to.throw

        const blockNumber = await contractInstance.provider.getBlockNumber()
        await contractInstance.connect(deployAccount.wallet).registerToken(
            dummyTokenInstance.address,
            0,
        )

        expect(await contractInstance.isRegistered(dummyTokenInstance.address)).to.eq(true)
        expect(await contractInstance.tokenCount()).to.eq(1)
        expect(await contractInstance.tokenAddresses(0)).to.deep.eq(dummyTokenInstance.address)
    })
    */
})
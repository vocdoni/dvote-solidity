
import { expect } from "chai"
import { Contract, ContractFactory, ContractTransaction } from "ethers"
import "mocha" // using @types/mocha
import { abi as namespaceAbi, bytecode as namespaceByteCode } from "../../build/namespaces.json"
import { NamespacesContractMethods } from "../../lib"
import NamespaceBuilder, { DEFAULT_NAMESPACE } from "../builders/namespace"
import ProcessBuilder from "../builders/process"
import { getAccounts, TestAccount } from "../utils"
import { addCompletionHooks } from "../utils/mocha-hooks"



let accounts: TestAccount[]
let deployAccount: TestAccount
let entityAccount: TestAccount
let randomAccount1: TestAccount
let randomAccount2: TestAccount
let authorizedOracleAccount1: TestAccount
let authorizedOracleAccount2: TestAccount
let contractInstance: NamespacesContractMethods & Contract
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

        contractInstance = await new NamespaceBuilder().build()
    })

    it("should deploy the contract", async () => {
        const contractFactory = new ContractFactory(namespaceAbi, namespaceByteCode, entityAccount.wallet)
        const localInstance1: Contract & NamespacesContractMethods = await contractFactory.deploy() as Contract & NamespacesContractMethods

        expect(localInstance1).to.be.ok
        expect(localInstance1.address).to.match(/^0x[0-9a-fA-F]{40}$/)

        const localInstance2: Contract & NamespacesContractMethods = await contractFactory.deploy() as Contract & NamespacesContractMethods

        expect(localInstance2).to.be.ok
        expect(localInstance2.address).to.match(/^0x[0-9a-fA-F]{40}$/)
        expect(localInstance2.address).to.not.eq(localInstance1.address)
    })

    it("should have zero entries by default", async () => {
        expect(await contractInstance.namespaceCount()).to.eq(0)
    })

    it("should register a contract and increment the index", async () => {
        expect(await contractInstance.namespaceCount()).to.eq(0)

        // 1
        let processInstance = await new ProcessBuilder().withNamespaceAddress(contractInstance.address).build()

        expect(await contractInstance.namespaceCount()).to.eq(1)
        expect(await processInstance.namespaceAddress()).to.eq(contractInstance.address)

        expect(await contractInstance.processContractAt(DEFAULT_NAMESPACE)).to.eq(processInstance.address)

        // 2
        processInstance = await new ProcessBuilder().withNamespaceAddress(contractInstance.address).build()

        expect(await contractInstance.namespaceCount()).to.eq(2)
        expect(await processInstance.namespaceAddress()).to.eq(contractInstance.address)

        expect(await contractInstance.processContractAt(DEFAULT_NAMESPACE + 1)).to.eq(processInstance.address)
    })
})

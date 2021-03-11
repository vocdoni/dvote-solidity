import { NamespaceContractMethods } from "../../lib/index"
import { Contract, ContractFactory } from "ethers"
import { getAccounts, TestAccount } from "../utils"

import { abi as namespaceAbi, bytecode as namespaceByteCode } from "../../build/namespaces.json"

export const DEFAULT_NAMESPACE = 1  // The id that the first process contract will be assigned to

// BUILDER
export default class NamespaceBuilder {
    accounts: TestAccount[]

    entityAccount: TestAccount

    constructor() {
        this.accounts = getAccounts()
        this.entityAccount = this.accounts[1]
    }

    async build(): Promise<Contract & NamespaceContractMethods> {
        const deployAccount = this.accounts[0]
        const contractFactory = new ContractFactory(namespaceAbi, namespaceByteCode, deployAccount.wallet)
        let contractInstance = await contractFactory.deploy() as Contract & NamespaceContractMethods

        return contractInstance.connect(this.entityAccount.wallet) as Contract & NamespaceContractMethods
    }
}

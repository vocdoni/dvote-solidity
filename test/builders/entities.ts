import { Contract, ContractFactory, utils } from "ethers"
import { EnsPublicResolverContractMethods } from "../../lib/index"
import { getAccounts, TestAccount } from "../utils"

const { abi: ensPublicResolverAbi, bytecode: ensPublicResolverByteCode } = require("../../build/ens-public-resolver.json")

// DEFAULT VALUES
export const DEFAULT_NAME = "Organizer Entity Name"

const emptyAddress = "0x0000000000000000000000000000000000000000"

// BUILDER
export default class EntityResolverBuilder {
    accounts: TestAccount[]
    entityAccount: TestAccount

    name: string = DEFAULT_NAME

    constructor() {
        this.accounts = getAccounts()
        this.entityAccount = this.accounts[1]
    }

    async build(): Promise<EnsPublicResolverContractMethods & Contract> {
        const resolverFactory = new ContractFactory(ensPublicResolverAbi, ensPublicResolverByteCode, this.entityAccount.wallet)
        const contractInstance = await resolverFactory.deploy(emptyAddress) as EnsPublicResolverContractMethods & Contract

        // const entityId = utils.keccak256(this.entityAccount.address)
        // await contractInstance.setText(entityId, "key-name", this.name)
        return contractInstance
    }

    // custom modifiers
    withEntityAccount(entityAccount: TestAccount) {
        this.entityAccount = entityAccount
        return this
    }
    withName(name: string) {
        this.name = name
        return this
    }
}

import { Contract, ContractFactory, utils } from "ethers"
import { EntityResolverContractMethods } from "../../lib/index"
import { getAccounts, TestAccount } from "../utils"

const { abi: entityResolverAbi, bytecode: entityResolverByteCode } = require("../../build/entity-resolver.json")

// DEFAULT VALUES
export const DEFAULT_NAME = "Organizer Entity Name"

// BUILDER
export default class EntityResolverBuilder {
    accounts: TestAccount[]
    entityAccount: TestAccount

    name: string = DEFAULT_NAME

    constructor() {
        this.accounts = getAccounts()
        this.entityAccount = this.accounts[1]
    }

    async build(): Promise<EntityResolverContractMethods & Contract> {
        const resolverFactory = new ContractFactory(entityResolverAbi, entityResolverByteCode, this.entityAccount.wallet)
        const contractInstance = await resolverFactory.deploy() as EntityResolverContractMethods & Contract

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

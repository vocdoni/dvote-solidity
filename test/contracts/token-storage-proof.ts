import "mocha" // using @types/mocha
import { expect } from "chai"
import { Contract, Wallet, ContractFactory, ContractTransaction, utils, BigNumber } from "ethers"
import { addCompletionHooks } from "../utils/mocha-hooks"
import { getAccounts, TestAccount } from "../utils"
import { TokenStorageProofTestContractMethods } from "../../lib"

import { TokenStorageProofTestBuilder, STORAGE_PROOFS_USDT_11328124 as proofs } from "../builders/token-storage-proof"
import { abi as tokenStorageProofTestAbi, bytecode as tokenStorageProofTestByteCode} from "../../build/token-storage-proof-test.json"


let accounts: TestAccount[]
let deployAccount: TestAccount
let randomAccount1: TestAccount
let randomAccount2: TestAccount
let contractInstance: TokenStorageProofTestContractMethods & Contract
let tx: ContractTransaction

const nullAddress = "0x0000000000000000000000000000000000000000"
const emptyArray: Array<number> = []

// const block3723000 = { // from aragon-evm
//     "hash": "0x26ecbc6551f3eb70e5545a1c2305e4c7a990eecfd37005c8805bf00dfe2c9b90",
//     "headerRLP": "0xf90210a0caecd067af69890f2119cd1541bcf375e02ca1032546474d9d9cda4102bce5e0a01dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d493479461c808d82a3ac53231750dadc13c777b59310bd9a07832c80d7614d34cfbebda3dd546816c1747be6c79b134a333c98ac856d7e661a0e071f88785ba0bf71dd14e15f14686eadcd163e8933211f4eaf88e97bd170857a06866f942aa996ff3365f402fbed9ea9d03b880441cb6bb14858fb775f025aba5b9010000800000000000000002000000000000000000000401000000022000010000000000000000000000000800000000000000000000000000000020000000000000000000000000008000000008000200000000000000000000000000000000000000000000020000000000000000000800000000000000000400000010002000000800000000000000000000000000000000000000000000000000200000000004000000000000000040000000000000000000000000000000000000000000000000000002000000000000000000000000000000000002000004100000000020000000000000000000000020000000000000000000000000000000000000000000870175fb04fc22958338cef8834160508308804e84591c96228fe4b883e5bda9e7a59ee4bb99e9b1bca06d4a200307c457247710132226e279594a4c5c88fff2079d5b75a453410c4e908855dcafe813d61059",
//     "stateRoot": "0x7832c80d7614d34cfbebda3dd546816c1747be6c79b134a333c98ac856d7e661"
// }

addCompletionHooks()

describe("StorageProofTest contract", () => {
    beforeEach(async () => {
        accounts = getAccounts()
        deployAccount = accounts[0]
        randomAccount1 = accounts[2]
        randomAccount2 = accounts[3]
        tx = null
        contractInstance = await new TokenStorageProofTestBuilder().build()
    })

    it("should deploy the contract", async() => {
        const storageProofTestContractInstance = await new TokenStorageProofTestBuilder().build()
        const storageProofAddress = storageProofTestContractInstance.address
        const contractFactory = new ContractFactory(tokenStorageProofTestAbi, tokenStorageProofTestByteCode, deployAccount.wallet)
        const localInstance: Contract & TokenStorageProofTestContractMethods = await contractFactory.deploy() as Contract & TokenStorageProofTestContractMethods
        
        expect(localInstance).to.be.ok
        expect(localInstance.address).to.match(/^0x[0-9a-fA-F]{40}$/)
    })

    it ("should verify inclusion", async() => {
        expect(contractInstance.testVerify).to.be.ok

        const verifiedData = await contractInstance.testVerify()
        expect(verifiedData).to.deep.equal(BigNumber.from(0x12))
    })

    it ("should verify exclusion", async() => {
        expect(contractInstance.testExclusion).to.be.ok

        const exclusion = await contractInstance.testExclusion()
        expect(exclusion).to.eq("0x")
    })
})

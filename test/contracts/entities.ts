
import "mocha" // using @types/mocha
import { expect } from "chai"
import { Contract, ContractFactory, utils, ContractTransaction } from "ethers"
import { addCompletionHooks } from "../utils/mocha-hooks"
import { getAccounts, incrementTimestamp, TestAccount } from "../utils"
import { EntityResolverContractMethods } from "../../lib"
import EntityResolverBuilder from "../builders/entities"
import { BigNumber } from "ethers/utils"

const { abi: entityResolverAbi, bytecode: entityResolverByteCode } = require("../../build/entity-resolver.json")

let accounts: TestAccount[]
let baseAccount: TestAccount
let entityAccount: TestAccount
let randomAccount: TestAccount
let randomAccount1: TestAccount
let randomAccount2: TestAccount
let contractInstance: EntityResolverContractMethods & Contract
let entityId: string
let tx: ContractTransaction

addCompletionHooks()

describe('Entity Resolver', function () {
    const textRecordKey1 = "vnd.vocdoni.record1"
    const listRecordKey1 = "vnd.vocdoni.push-list"

    beforeEach(async () => {
        accounts = getAccounts()
        baseAccount = accounts[0]
        entityAccount = accounts[1]
        randomAccount = accounts[2]
        randomAccount1 = accounts[3]
        randomAccount2 = accounts[4]
        tx = null

        entityId = utils.keccak256(entityAccount.address)
        contractInstance = await new EntityResolverBuilder().build()
    })

    it("Should deploy the contract", async () => {
        const resolverFactory = new ContractFactory(entityResolverAbi, entityResolverByteCode, entityAccount.wallet)
        const localInstance = await resolverFactory.deploy()

        expect(localInstance).to.be.ok
        expect(localInstance.address.match(/^0x[0-9a-fA-F]{40}$/)).to.be.ok
    })

    it("Should compute the ID of an entity by its address", async () => {
        const data = [
            { address: "0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1", id: "0xe7fb8f3e702fd22bf02391cc16c6b4bc465084468f1627747e6e21e2005f880e" },
            { address: "0xffcf8fdee72ac11b5c542428b35eef5769c409f0", id: "0x92eba8bf099a58b316e6c8743101585f4a71b45d87c571440553b6e74671ac5a" },
            { address: "0x22d491bde2303f2f43325b2108d26f1eaba1e32b", id: "0x9f225659836e74be7309b140ad0fee340ce09db633a8d42b85540955c987123b" },
            { address: "0xe11ba2b4d45eaed5996cd0823791e0c93114882d", id: "0xd6604a251934bff7fe961c233a6f8dbd5fb55e6e98cf893237c9608e746e2807" },
            { address: "0xd03ea8624c8c5987235048901fb614fdca89b117", id: "0xa6e02fa9ce046b7970daab05320d7355d28f9e9bc7889121b0d9d90b441f360c" },
            { address: "0x95ced938f7991cd0dfcb48f0a06a40fa1af46ebc", id: "0xee97003d4805070a87a8bd486f4894fbfce48844710a9b46df867f7f64f9a174" },
            { address: "0x3e5e9111ae8eb78fe1cc3bb8915d5d461f3ef9a9", id: "0xaca9367e5113a27f3873ddf78ada8a6af283849bb14cc313cadf63ae03ea52b3" },
            { address: "0x28a8746e75304c0780e011bed21c72cd78cd535e", id: "0xa17b99060235fa80368a12707574ab6381d0fc9aa7cb3a6a116d0f04564980fe" },
            { address: "0xaca94ef8bd5ffee41947b4585a84bda5a3d3da6e", id: "0xb1ec3484f6bdfce3b18264a4e83a5e99fc43641f8e15a3079a9e6872b5d6cace" },
            { address: "0x1df62f291b2e969fb0849d99d9ce41e2f137006e", id: "0x0c3a882b5cad48337e5a74659c514c6e0d5490bdc7ec8898d7d2a924da96c720" },
        ]

        await Promise.all(data.map(entity => {
            return contractInstance.getEntityId(entity.address)
                .then(entityId => {
                    expect(entityId).to.eq(entity.id)
                })
        }))
    })

    describe("Text Records", () => {

        it("Should set a Text record and keep the right value", async () => {
            const result1 = await contractInstance.text(entityId, textRecordKey1)
            expect(result1).to.eq("")

            const inputValue = "Text record string 1"
            tx = await contractInstance.setText(entityId, textRecordKey1, inputValue)
            expect(tx).to.be.ok
            await tx.wait()

            const result2 = await contractInstance.text(entityId, textRecordKey1)
            expect(result2).to.eq(inputValue, "Values should match")
        })

        it("Should override an existing Text record", async () => {
            const inputValue2 = "Text record string 2"
            tx = await contractInstance.setText(entityId, textRecordKey1, inputValue2)
            await tx.wait()

            const value = await contractInstance.text(entityId, textRecordKey1)
            expect(value).to.eq(inputValue2, "Values should match")
        })

        it("Should reject updates from extraneous accounts", async () => {
            contractInstance = await new EntityResolverBuilder().withEntityAccount(randomAccount1).build()

            const result1 = await contractInstance.text(entityId, textRecordKey1)
            expect(result1).to.eq("")

            try {
                tx = await contractInstance.setText(entityId, "name", "Evil coorp")
                await tx.wait()

                throw new Error("The transaction should have thrown an error")
            }
            catch (err) {
                expect(err.message.match(/revert/)).to.be.ok // ("The transaction threw an unexpected error:\n" + err.message)
            }

            try {
                tx = await contractInstance.setText(entityId, textRecordKey1, "Evil value")
                await tx.wait()

                throw new Error("The transaction should have thrown an error")
            }
            catch (err) {
                expect(err.message.match(/revert/)).to.be.ok // ("The transaction threw an unexpected error:\n" + err.message)
            }

            const result2 = await contractInstance.text(entityId, "name")
            expect(result2).to.eq("")

            const result3 = await contractInstance.text(entityId, textRecordKey1)
            expect(result3).to.eq("")
        })

        it("Should override the entity name", async () => {
            const name1 = "Entity Name"
            const name2 = "New Entity Name"

            tx = await contractInstance.setText(entityId, "name", name1)
            await tx.wait()
            let entityName = await contractInstance.text(entityId, "name")
            expect(entityName).to.eq(name1, "The name should be set")

            tx = await contractInstance.setText(entityId, "name", name2)
            await tx.wait()
            entityName = await contractInstance.text(entityId, "name")
            expect(entityName).to.eq(name2, "The name should be updated")
        })

        it("Should emit an event", async () => {
            const inputValue = "Text record string 1"

            const result: { node: string, key: string, value: string } = await new Promise((resolve, reject) => {
                contractInstance.on("TextChanged", (node: string, key: string, value: string) => {
                    resolve({ node, key, value })
                })
                contractInstance.setText(entityId, textRecordKey1, inputValue).then(tx => tx.wait()).catch(reject)
            })

            expect(result.node).to.equal(entityId)
            expect(result.key).to.equal(textRecordKey1)
            expect(result.value).to.equal(inputValue)
        }).timeout(8000)
    })

    describe("Text List records", () => {
        it("Push a Text List record", async () => {
            const inputValue1 = "List record string 1"
            const inputValue2 = "List record string 2"
            tx = await contractInstance.pushListText(entityId, listRecordKey1, inputValue1)
            await tx.wait()

            tx = await contractInstance.pushListText(entityId, listRecordKey1, inputValue2)
            await tx.wait()

            const list = await contractInstance.list(entityId, listRecordKey1)
            expect(list).to.deep.eq([inputValue1, inputValue2], "List records should match")

            const value1 = await contractInstance.listText(entityId, listRecordKey1, 0)
            expect(value1).to.deep.eq(inputValue1, "List record should match")

            const value2 = await contractInstance.listText(entityId, listRecordKey1, 1)
            expect(value2).to.deep.eq(inputValue2, "List record should match")

            try {
                // Non existing index should be empty
                await contractInstance.listText(entityId, listRecordKey1, 2)

                throw new Error("The transaction should have thrown an error")
            }
            catch (err) {
                expect(err.message.match(/invalid opcode/)).to.be.ok // ("The transaction threw an unexpected error:\n" + err.message)
            }
        })

        it("Set a Text List record", async () => {
            const text1 = "List record string 1"
            const text2 = "List record string 2"

            tx = await contractInstance.pushListText(entityId, listRecordKey1, text1)
            await tx.wait()
            tx = await contractInstance.setListText(entityId, listRecordKey1, 0, text2)
            await tx.wait()

            tx = await contractInstance.pushListText(entityId, listRecordKey1, text2)
            await tx.wait()
            tx = await contractInstance.setListText(entityId, listRecordKey1, 1, text1)
            await tx.wait()

            const list = await contractInstance.list(entityId, listRecordKey1)
            expect(list).to.deep.eq([text2, text1], "List records should match")
        })

        it("Remove a Text List record", async () => {
            const text1 = "List record string 1"
            const text2 = "List record string 2"
            const text3 = "List record string 3"
            const text4 = "List record string 4"
            const text5 = "List record string 5"

            tx = await contractInstance.pushListText(entityId, listRecordKey1, text1)
            await tx.wait()
            tx = await contractInstance.pushListText(entityId, listRecordKey1, text2)
            await tx.wait()
            tx = await contractInstance.pushListText(entityId, listRecordKey1, text3)
            await tx.wait()
            tx = await contractInstance.pushListText(entityId, listRecordKey1, text4)
            await tx.wait()
            tx = await contractInstance.pushListText(entityId, listRecordKey1, text5)
            await tx.wait()

            const list = await contractInstance.list(entityId, listRecordKey1)
            expect(list).to.deep.eq([text1, text2, text3, text4, text5], "List records should match")

            // Remove in the middle
            tx = await contractInstance.removeListIndex(entityId, listRecordKey1, 2)
            await tx.wait()

            const list2 = await contractInstance.list(entityId, listRecordKey1)
            expect(list2).to.deep.eq([text1, text2, text5, text4], "List records should match")

            // Remove the last
            tx = await contractInstance.removeListIndex(entityId, listRecordKey1, 3)
            await tx.wait()

            const list3 = await contractInstance.list(entityId, listRecordKey1)
            expect(list3).to.deep.eq([text1, text2, text5], "List records should match")

            // Remove the first
            tx = await contractInstance.removeListIndex(entityId, listRecordKey1, 0)
            await tx.wait()

            const list4 = await contractInstance.list(entityId, listRecordKey1)
            expect(list4).to.deep.eq([text5, text2], "List records should match")
        })

        it("Should fail updating non-existing indexes", async () => {
            const inputValue = "List record string 2"
            try {
                await contractInstance.setListText(entityId, listRecordKey1, 0, inputValue)
                await tx.wait()

                throw new Error("The transaction should have thrown an error")
            }
            catch (err) {
                expect(err.message.match(/revert/)).to.be.ok // ("The transaction threw an unexpected error:\n" + err.message)
            }

            const list = await contractInstance.list(entityId, listRecordKey1)
            expect(list).to.deep.eq([], "List record should be empty")
        })

        it("Should fail removing non-existing indexes", async () => {
            const text1 = "List record string 1"
            const text2 = "List record string 2"
            const text3 = "List record string 3"
            const text4 = "List record string 4"
            const text5 = "List record string 5"

            tx = await contractInstance.pushListText(entityId, listRecordKey1, text1)
            await tx.wait()
            tx = await contractInstance.pushListText(entityId, listRecordKey1, text2)
            await tx.wait()
            tx = await contractInstance.pushListText(entityId, listRecordKey1, text3)
            await tx.wait()
            tx = await contractInstance.pushListText(entityId, listRecordKey1, text4)
            await tx.wait()
            tx = await contractInstance.pushListText(entityId, listRecordKey1, text5)
            await tx.wait()

            const list = await contractInstance.list(entityId, listRecordKey1)
            expect(list).to.deep.eq([text1, text2, text3, text4, text5], "List records should match")

            // Try to remove beyond the boundaries
            try {
                tx = await contractInstance.removeListIndex(entityId, listRecordKey1, 5)
                await tx.wait()

                throw new Error("The transaction should have thrown an error")
            }
            catch (err) {
                expect(err.message.match(/revert/)).to.be.ok // ("The transaction threw an unexpected error:\n" + err.message)
            }
            try {
                tx = await contractInstance.removeListIndex(entityId, listRecordKey1, 6)
                await tx.wait()

                throw new Error("The transaction should have thrown an error")
            }
            catch (err) {
                expect(err.message.match(/revert/)).to.be.ok // ("The transaction threw an unexpected error:\n" + err.message)
            }
            try {
                tx = await contractInstance.removeListIndex(entityId, listRecordKey1, 10)
                await tx.wait()

                throw new Error("The transaction should have thrown an error")
            }
            catch (err) {
                expect(err.message.match(/revert/)).to.be.ok // ("The transaction threw an unexpected error:\n" + err.message)
            }
        })

        it("Should reject pushing values from extraneous accounts", async () => {
            contractInstance = await new EntityResolverBuilder().withEntityAccount(randomAccount1).build()
            const inputValue = "List record string 3"

            try {
                tx = await contractInstance.pushListText(entityId, listRecordKey1, inputValue)
                await tx.wait()

                throw new Error("The transaction should have thrown an error")
            }
            catch (err) {
                expect(err.message.match(/revert/)).to.be.ok // ("The transaction threw an unexpected error:\n" + err.message)
            }

            const list = await contractInstance.list(entityId, listRecordKey1)
            expect(list).to.deep.eq([], "The list should be empty")
        })

        it("Should reject setting values from extraneous accounts", async () => {
            const text1 = "Random text"
            const text2 = "Malicious text"

            try {
                contractInstance = contractInstance.connect(entityAccount.wallet) as any
                tx = await contractInstance.pushListText(entityId, listRecordKey1, text1)
                await tx.wait()

                contractInstance = contractInstance.connect(randomAccount1.wallet) as any
                tx = await contractInstance.setListText(entityId, listRecordKey1, 0, text2)
                await tx.wait()

                throw new Error("The transaction should have thrown an error")
            }
            catch (err) {
                expect(err.message.match(/revert/)).to.be.ok // ("The transaction threw an unexpected error:\n" + err.message)
            }

            const list1 = await contractInstance.list(entityId, listRecordKey1)
            expect(list1).to.deep.eq([text1], "List records should match")

            try {
                contractInstance = contractInstance.connect(entityAccount.wallet) as any
                tx = await contractInstance.pushListText(entityId, listRecordKey1, text2)
                await tx.wait()

                contractInstance = contractInstance.connect(randomAccount1.wallet) as any
                tx = await contractInstance.setListText(entityId, listRecordKey1, 0, text1)
                await tx.wait()

                throw new Error("The transaction should have thrown an error")
            }
            catch (err) {
                expect(err.message.match(/revert/)).to.be.ok // ("The transaction threw an unexpected error:\n" + err.message)
            }

            const list2 = await contractInstance.list(entityId, listRecordKey1)
            expect(list2).to.deep.eq([text1, text2], "List records should match")
        })

        it("Should emit events on push", async () => {
            const inputValue = "Text record string 1"

            // 1
            const result1: { node: string, key: string, index: BigNumber } = await new Promise((resolve, reject) => {
                contractInstance.on("ListItemChanged", (node: string, key: string, index: BigNumber) => {
                    resolve({ node, key, index })
                })
                contractInstance.pushListText(entityId, listRecordKey1, inputValue).then(tx => tx.wait()).catch(reject)
            })

            expect(result1.node).to.equal(entityId)
            expect(result1.key).to.equal(listRecordKey1)
            expect(result1.index.toString()).to.equal("0")
        }).timeout(8000)

        it("Should emit events on update", async () => {
            const inputValue = "Text record string 1"
            const inputValue2 = "Text record string 2"

            tx = await contractInstance.pushListText(entityId, listRecordKey1, inputValue)
            await tx.wait()

            const result2: { node: string, key: string, index: BigNumber } = await new Promise((resolve, reject) => {
                contractInstance.on("ListItemChanged", (node: string, key: string, index: BigNumber) => {
                    resolve({ node, key, index })
                })
                contractInstance.setListText(entityId, listRecordKey1, 0, inputValue2).then(tx => tx.wait()).catch(reject)
            })

            expect(result2.node).to.equal(entityId)
            expect(result2.key).to.equal(listRecordKey1)
            expect(result2.index.toString()).to.equal("0")
        }).timeout(8000)

        it("Should emit events on remove", async () => {
            const inputValue = "Text record string 1"

            tx = await contractInstance.pushListText(entityId, listRecordKey1, inputValue)
            await tx.wait()

            const result3: { node: string, key: string, index: BigNumber } = await new Promise((resolve, reject) => {
                contractInstance.on("ListItemChanged", (node: string, key: string, index: BigNumber) => {
                    resolve({ node, key, index })
                })
                contractInstance.removeListIndex(entityId, listRecordKey1, 0).then(tx => tx.wait()).catch(reject)
            })

            expect(result3.node).to.equal(entityId)
            expect(result3.key).to.equal(listRecordKey1)
            expect(result3.index.toString()).to.equal("0")
        }).timeout(8000)
    })
}).timeout(4000)

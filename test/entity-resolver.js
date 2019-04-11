const assert = require("assert")
const Web3Utils = require("web3-utils")

const { getWeb3, deployEntityResolver } = require("../lib/util")

const web3 = getWeb3()

let accounts
let instance

let entityAddress, maliciousEntityAddress, randomAddress2
let entityId

describe('EntityResolver', function () {

    const textRecordKey1 = "vnd.vocdoni.record1"
    const listRecordKey1 = "vnd.vocdoni.push-list"

    beforeEach(async () => {
        accounts = await web3.eth.getAccounts()

        entityAddress = accounts[1]
        maliciousEntityAddress = accounts[2]
        randomAddress2 = accounts[3]
        entityId = Web3Utils.soliditySha3(entityAddress)

        instance = await deployEntityResolver()
    })

    it("Should deploy the contract", async () => {
        const localInstance = await deployEntityResolver()

        assert.ok(localInstance)
        assert.ok(localInstance.options)
        assert.ok(localInstance.options.address.match(/^0x[0-9a-fA-F]{40}$/))
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
            return instance.methods.getEntityId(entity.address).call()
                .then(entityId => {
                    assert.equal(entityId, entity.id)
                })
        }))
    })

    describe("Text Records", () => {

        it("Should set a Text record and keep the right value", async () => {
            const result1 = await instance.methods.text(entityId, textRecordKey1).call()
            assert.equal(result1, "")

            const inputValue = "Text record string 1"
            const tx = await instance.methods.setText(entityId, textRecordKey1, inputValue).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            assert.ok(tx)
            assert.ok(tx.transactionHash)
            assert.ok(tx.events)
            assert.ok(tx.events.TextChanged)

            const result2 = await instance.methods.text(entityId, textRecordKey1).call()
            assert.equal(result2, inputValue, "Values should match")
        })

        it("Should override an existing Text record", async () => {
            const inputValue2 = "Text record string 2"
            await instance.methods.setText(entityId, textRecordKey1, inputValue2).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            const value = await instance.methods.text(entityId, textRecordKey1).call()
            assert.equal(value, inputValue2, "Values should match")
        })

        it("Should reject updates from extraneous accounts", async () => {
            const result1 = await instance.methods.text(entityId, textRecordKey1).call()
            assert.equal(result1, "")

            try {
                await instance.methods.setText(entityId, "name", "Evil coorp").send({
                    from: maliciousEntityAddress,
                    nonce: await web3.eth.getTransactionCount(maliciousEntityAddress)
                })

                assert.fail("The transaction should have thrown an error")
            }
            catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }

            try {
                await instance.methods.setText(entityId, textRecordKey1, "Evil value").send({
                    from: maliciousEntityAddress,
                    nonce: await web3.eth.getTransactionCount(maliciousEntityAddress)
                })

                assert.fail("The transaction should have thrown an error")
            }
            catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }

            const result2 = await instance.methods.text(entityId, "name").call()
            assert.equal(result2, "")

            const result3 = await instance.methods.text(entityId, textRecordKey1).call()
            assert.equal(result3, "")
        })

        it("Should override the entity name", async () => {
            const name1 = "Entity Name"
            const name2 = "New Entity Name"
            await instance.methods.setText(entityId, "name", name1).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })
            await instance.methods.setText(entityId, "name", name2).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            const entityName = await instance.methods.text(entityId, "name").call()
            assert.equal(entityName, name2, "The name should be updated")
        })

        it("Should emit an event", async () => {
            const inputValue = "Text record string 1"
            const tx = await instance.methods.setText(entityId, textRecordKey1, inputValue).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            assert.ok(tx)
            assert.ok(tx.transactionHash)
            assert.ok(tx.events)
            assert.ok(tx.events.TextChanged)
            assert.ok(tx.events.TextChanged.returnValues)
            assert.equal(tx.events.TextChanged.event, "TextChanged")
            assert.equal(tx.events.TextChanged.returnValues.indexedKey, textRecordKey1)
        })
    })

    describe("Text List records", () => {
        it("Push a Text List record", async () => {
            const inputValue1 = "List record string 1"
            const inputValue2 = "List record string 2"
            await instance.methods.pushListText(entityId, listRecordKey1, inputValue1).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })
            await instance.methods.pushListText(entityId, listRecordKey1, inputValue2).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            const list = await instance.methods.list(entityId, listRecordKey1).call()
            assert.deepEqual(list, [inputValue1, inputValue2], "List records should match")

            const value1 = await instance.methods.listText(entityId, listRecordKey1, 0).call()
            assert.deepEqual(value1, inputValue1, "List record should match")

            const value2 = await instance.methods.listText(entityId, listRecordKey1, 1).call()
            assert.deepEqual(value2, inputValue2, "List record should match")

            try {
                // Non existing index should be empty
                await instance.methods.listText(entityId, listRecordKey1, 2).call()

                assert.fail("The transaction should have thrown an error")
            }
            catch (err) {
                assert(err.message.match(/invalid opcode/), "The transaction threw an unexpected error:\n" + err.message)
            }
        })

        it("Set a Text List record", async () => {
            const text1 = "List record string 1"
            const text2 = "List record string 2"

            await instance.methods.pushListText(entityId, listRecordKey1, text1).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })
            await instance.methods.setListText(entityId, listRecordKey1, 0, text2).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            await instance.methods.pushListText(entityId, listRecordKey1, text2).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })
            await instance.methods.setListText(entityId, listRecordKey1, 1, text1).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            const list = await instance.methods.list(entityId, listRecordKey1).call()
            assert.deepEqual(list, [text2, text1], "List records should match")
        })

        it("Remove a Text List record", async () => {
            const text1 = "List record string 1"
            const text2 = "List record string 2"
            const text3 = "List record string 3"
            const text4 = "List record string 4"
            const text5 = "List record string 5"

            await instance.methods.pushListText(entityId, listRecordKey1, text1).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })
            await instance.methods.pushListText(entityId, listRecordKey1, text2).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })
            await instance.methods.pushListText(entityId, listRecordKey1, text3).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })
            await instance.methods.pushListText(entityId, listRecordKey1, text4).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })
            await instance.methods.pushListText(entityId, listRecordKey1, text5).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            const list = await instance.methods.list(entityId, listRecordKey1).call()
            assert.deepEqual(list, [text1, text2, text3, text4, text5], "List records should match")

            // Remove in the middle
            await instance.methods.removeListIndex(entityId, listRecordKey1, 2).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            const list2 = await instance.methods.list(entityId, listRecordKey1).call()
            assert.deepEqual(list2, [text1, text2, text5, text4], "List records should match")

            // Remove the last
            await instance.methods.removeListIndex(entityId, listRecordKey1, 3).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            const list3 = await instance.methods.list(entityId, listRecordKey1).call()
            assert.deepEqual(list3, [text1, text2, text5], "List records should match")

            // Remove the first
            await instance.methods.removeListIndex(entityId, listRecordKey1, 0).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            const list4 = await instance.methods.list(entityId, listRecordKey1).call()
            assert.deepEqual(list4, [text5, text2], "List records should match")
        })

        it("Should fail updating non-existing indexes", async () => {
            const inputValue = "List record string 2"
            try {
                await instance.methods.setListText(entityId, listRecordKey1, 0, inputValue).send({
                    from: entityAddress,
                    nonce: await web3.eth.getTransactionCount(entityAddress)
                })

                assert.fail("The transaction should have thrown an error")
            }
            catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }

            const list = await instance.methods.list(entityId, listRecordKey1).call()
            assert.deepEqual(list, [], "List record should be empty")
        })

        it("Should fail removing non-existing indexes", async () => {
            const text1 = "List record string 1"
            const text2 = "List record string 2"
            const text3 = "List record string 3"
            const text4 = "List record string 4"
            const text5 = "List record string 5"

            await instance.methods.pushListText(entityId, listRecordKey1, text1).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })
            await instance.methods.pushListText(entityId, listRecordKey1, text2).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })
            await instance.methods.pushListText(entityId, listRecordKey1, text3).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })
            await instance.methods.pushListText(entityId, listRecordKey1, text4).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })
            await instance.methods.pushListText(entityId, listRecordKey1, text5).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            const list = await instance.methods.list(entityId, listRecordKey1).call()
            assert.deepEqual(list, [text1, text2, text3, text4, text5], "List records should match")

            // Try to remove beyond the boundaries
            try {
                await instance.methods.removeListIndex(entityId, listRecordKey1, 5).send({
                    from: entityAddress,
                    nonce: await web3.eth.getTransactionCount(entityAddress)
                })

                assert.fail("The transaction should have thrown an error")
            }
            catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }
            try {
                await instance.methods.removeListIndex(entityId, listRecordKey1, 6).send({
                    from: entityAddress,
                    nonce: await web3.eth.getTransactionCount(entityAddress)
                })

                assert.fail("The transaction should have thrown an error")
            }
            catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }
            try {
                await instance.methods.removeListIndex(entityId, listRecordKey1, 10).send({
                    from: entityAddress,
                    nonce: await web3.eth.getTransactionCount(entityAddress)
                })

                assert.fail("The transaction should have thrown an error")
            }
            catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }
        })

        it("Should reject pushing values from extraneous accounts", async () => {
            const inputValue = "List record string 3"

            try {
                await instance.methods.pushListText(entityId, listRecordKey1, inputValue).send({
                    from: maliciousEntityAddress,
                    nonce: await web3.eth.getTransactionCount(maliciousEntityAddress)
                })

                assert.fail("The transaction should have thrown an error")
            }
            catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }

            const list = await instance.methods.list(entityId, listRecordKey1).call()
            assert.deepEqual(list, [], "The list should be empty")
        })

        it("Should reject setting values from extraneous accounts", async () => {
            const text1 = "Random text"
            const text2 = "Malicious text"

            try {
                await instance.methods.pushListText(entityId, listRecordKey1, text1).send({
                    from: entityAddress,
                    nonce: await web3.eth.getTransactionCount(entityAddress)
                })
                await instance.methods.setListText(entityId, listRecordKey1, 0, text2).send({
                    from: maliciousEntityAddress,
                    nonce: await web3.eth.getTransactionCount(maliciousEntityAddress)
                })

                assert.fail("The transaction should have thrown an error")
            }
            catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }

            const list1 = await instance.methods.list(entityId, listRecordKey1).call()
            assert.deepEqual(list1, [text1], "List records should match")

            try {
                await instance.methods.pushListText(entityId, listRecordKey1, text2).send({
                    from: entityAddress,
                    nonce: await web3.eth.getTransactionCount(entityAddress)
                })
                await instance.methods.setListText(entityId, listRecordKey1, 0, text1).send({
                    from: maliciousEntityAddress,
                    nonce: await web3.eth.getTransactionCount(maliciousEntityAddress)
                })

                assert.fail("The transaction should have thrown an error")
            }
            catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }

            const list2 = await instance.methods.list(entityId, listRecordKey1).call()
            assert.deepEqual(list2, [text1, text2], "List records should match")
        })

        it("Should emit events on push, update and remove", async () => {
            const inputValue = "Text record string 1"
            const inputValue2 = "Text record string 2"
            const tx = await instance.methods.pushListText(entityId, listRecordKey1, inputValue).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            assert.ok(tx)
            assert.ok(tx.transactionHash)
            assert.ok(tx.events)
            assert.ok(tx.events.ListItemChanged)
            assert.ok(tx.events.ListItemChanged.returnValues)
            assert.equal(tx.events.ListItemChanged.event, "ListItemChanged")
            assert.equal(tx.events.ListItemChanged.returnValues.key, listRecordKey1)
            assert.equal(tx.events.ListItemChanged.returnValues.index, 0)

            const tx2 = await instance.methods.setListText(entityId, listRecordKey1, 0, inputValue2).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            assert.ok(tx2)
            assert.ok(tx2.transactionHash)
            assert.ok(tx2.events)
            assert.ok(tx2.events.ListItemChanged)
            assert.ok(tx2.events.ListItemChanged.returnValues)
            assert.equal(tx2.events.ListItemChanged.event, "ListItemChanged")
            assert.equal(tx2.events.ListItemChanged.returnValues.key, listRecordKey1)
            assert.equal(tx2.events.ListItemChanged.returnValues.index, 0)

            const tx3 = await instance.methods.removeListIndex(entityId, listRecordKey1, 0).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            assert.ok(tx3)
            assert.ok(tx3.transactionHash)
            assert.ok(tx3.events)
            assert.ok(tx3.events.ListItemRemoved)
            assert.ok(tx3.events.ListItemRemoved.returnValues)
            assert.equal(tx3.events.ListItemRemoved.event, "ListItemRemoved")
            assert.equal(tx3.events.ListItemRemoved.returnValues.key, listRecordKey1)
            assert.equal(tx3.events.ListItemRemoved.returnValues.index, 0)
        })
    })
})

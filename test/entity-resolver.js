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

        it("Should fail writing to non-existing indexes", async () => {
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

        it("Should emit events on push and update", async () => {
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
        })
    })
})

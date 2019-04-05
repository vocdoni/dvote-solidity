const assert = require("assert")
const Web3Utils = require("web3-utils")

const { getWeb3, deployEntityResolver } = require("../lib/util")

const web3 = getWeb3()

let accounts
let instance

let entityAddress, maliciousEntityAddress, randomAddress2
let entityId

describe('EntityResolver', function () {

    const textRecordKey1 = "textKey1"
    const listRecordKey1 = "list1"

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

    it("Should set a Text record and keep the right value", async () => {
        const inputValue = "Text record string 1"
        let tx = await instance.methods.setText(entityId, textRecordKey1, inputValue).send({ from: entityAddress })

        assert.ok(tx)
        assert.ok(tx.transactionHash)
        assert.ok(tx.events)
        assert.ok(tx.events.TextChanged)

        let value = await instance.methods.text(entityId, textRecordKey1).call()
        assert.equal(value, inputValue, "Values should match")
    })

    it("Should override an existing Text record", async () => {
        const inputValue2 = "Text record string 2"
        await instance.methods.setText(entityId, textRecordKey1, inputValue2).send({ from: entityAddress })

        let value = await instance.methods.text(entityId, textRecordKey1).call()
        assert.equal(value, inputValue2, "Values should match")
    })

    it("Should reject updates from extraneous accounts", async () => {
        try {
            await instance.methods.setText(entityId, "name", "Evil coorp").send({ from: maliciousEntityAddress })

            assert.fail("The transaction should have thrown an error")
        }
        catch (err) {
            assert(err.message.match(/revert/), "The transaction should be reverted")
        }
    })

    it("Should override the entity name", async () => {
        const newEntityName = "Different Entity Name"
        await instance.methods.setText(entityId, "name", newEntityName).send({ from: entityAddress })

        let entityName = await instance.methods.text(entityId, "name").call()
        assert.equal(entityName, newEntityName, "Names should match")
    })

    it("Push a Text List record", async () => {
        const inputValue = "List record string 1"
        await instance.methods.pushListText(entityId, listRecordKey1, inputValue).send({ from: entityAddress })

        let list = await instance.methods.list(entityId, listRecordKey1).call()

        assert.equal(list[0], inputValue, "List record should match")
    })

    it("Set a Text List record", async () => {
        const inputValue = "List record string 2"
        await instance.methods.setListText(entityId, listRecordKey1, 0, inputValue).send({ from: entityAddress })

        let list = await instance.methods.list(entityId, listRecordKey1).call()

        assert.equal(list[0], inputValue, "List record should match")
    })

    it("Different entity can't push a text", async () => {
        const listRecordKey2 = "listB"
        const inputValue = "List record string 3"

        try {
            await instance.methods.setListText(entityId, listRecordKey2, inputValue).send({ from: maliciousEntityAddress })

            assert.fail("The transaction should have thrown an error")
        }
        catch (err) {
            assert(err.message.match(/revert/), "The transaction should be reverted")
        }
    })

    it("Different entity can't set  a text", async () => {
        const inputValue = "Random text"

        try {
            await instance.methods.setListText(entityId, listRecordKey1, inputValue).send({ from: maliciousEntityAddress })

            assert.fail("The transaction should have thrown an error")
        }
        catch (err) {
            assert(err.message.match(/revert/), "The transaction should be reverted")
        }
    })


})

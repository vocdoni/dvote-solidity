var EntityResolver = artifacts.require("EntityResolver")
const Web3Utils = require("web3-utils")

getEntityId = (entityAddress) => {
    return Web3Utils.soliditySha3(entityAddress)
}

contract('EntityResolver', function (accounts) {
    it("Deploys contract", async () => {
        let instance = await EntityResolver.deployed()
        global.console.log("EntityResolver contract address: " + instance.address)
    })

    const entityAddress = accounts[0]
    const entityId = Web3Utils.soliditySha3(entityAddress)
    
    it("Sets a text record", async () => {
        const inputValue = "A text record string"
        const inputKey = "textA"
        let instance = await EntityResolver.deployed()
        let t = await instance.setText(entityId, inputKey, inputValue, { from: entityAddress })

        console.log("text record ", t);

        let value = await instance.text(entityId, inputKey)
        assert.equal(value, inputValue, "Values should match")
    })

    const maliciousEntityAddress = accounts[1]

    it("Different entity can't set the name", async () => {

        let instance = await EntityResolver.deployed()
        let error = null
        try {
            await instance.setText(entityId, "name", "Evil coorp", { from: maliciousEntityAddress })

        }
        catch (_error) {
            error = _error
        }

        assert.isNotNull(error, "Only record creator can edit a text record")
    })

    it("Can override entity name", async () => {
        const newEntityName = "Different Entity Name"
        let instance = await EntityResolver.deployed()
        await instance.setText(entityId, "name", newEntityName, { from: entityAddress })

        let entityName = await instance.text(entityId, "name")
        assert.equal(entityName, newEntityName, "Names should match")
    })

    const inputKeyA = "listA"
    it("Push a list text record", async () => {
        const inputValue = "A text record string"
        let instance = await EntityResolver.deployed()
        let t = await instance.pushListText(entityId, inputKeyA, inputValue, { from: entityAddress })
        console.log("list record ", t);
        let list = await instance.list(entityId, inputKeyA)
        console.log("hello", list)
        assert.equal(list[0], inputValue, "List record should match")
    })

    it("Set a list text record", async () => {
        const inputValue = "A different text record string"
        let instance = await EntityResolver.deployed()
        let t = await instance.setListText(entityId, inputKeyA,0, inputValue, { from: entityAddress })
        console.log("list record ", t);
        let list = await instance.list(entityId, inputKeyA)
        console.log("hello", list)
        assert.equal(list[0], inputValue, "List record should match")
    })

    it("Different entity can't push a text", async () => {
        const inputKey = "listB"
        const inputValue = "Random text"
        let instance = await EntityResolver.deployed()
        let error = null
        try {
            await instance.setListText(entityId, inputKey , inputValue, { from: maliciousEntityAddress })
        }
        catch (_error) {
            error = _error
        }

        assert.isNotNull(error, "Only record creator can edit a list text record")
    })

    it("Different entity can't set  a text", async () => {
       
        const inputValue = "Random text"
        let instance = await EntityResolver.deployed()
        let error = null
        try {
            await instance.setListText(entityId, inputKeyA , inputValue, { from: maliciousEntityAddress })
        }
        catch (_error) {
            error = _error
        }

        assert.isNotNull(error, "Only record creator can edit a list text record")
    })

})

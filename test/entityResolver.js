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
    const inputEntityName = "The entity"

    it("Sets entity name", async () => {
        let instance = await EntityResolver.deployed()
        await instance.setText(entityId, "name", inputEntityName, { from: entityAddress })

        let entityName = await instance.text(entityId, "name")
        assert.equal(entityName, inputEntityName, "Names should match")
    })

    it("Different entity can't set the name", async () => {

        const maliciousEntityAddress = accounts[1]

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

})

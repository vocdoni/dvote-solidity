var VotingEntity = artifacts.require("VotingEntity")
contract('VotingEntity', function (accounts) {
    it("Checks no entity exists", async () => {
        let instance = await VotingEntity.deployed();
        global.console.log("VotingEntity contract address: " + instance.address);
        let entitiesLength = await instance.getEntitiesLength({ from: accounts[0] });
        assert.equal(entitiesLength.valueOf(), 0, "Entities index should be empty");
    });

    const entityInput = {
        name: "The Entity",
        censusRequestUrl: "http://organization.testnet.vocdoni.io/census-register/"
    };

    it("Creates a new entity and checks its data", async () => {
        let instance = await VotingEntity.deployed();
        await instance.createEntity(entityInput.name, entityInput.censusRequestUrl, { from: accounts[0] });
        
        let entitiesLength = await instance.getEntitiesLength();
        assert.equal(entitiesLength.valueOf(), 1, "Only one entity exists");
    });

    it("Entity data is stored correctly", async () => {
        let instance = await VotingEntity.deployed();
        let entity = await instance.getEntity(accounts[0]);

        assert.equal(entityInput.name, entity.name, "The name should match the input");
        assert.equal(entityInput.censusRequestUrl, entity.censusRequestUrl, "The census URL should match the input");
    });

    it("Can't create/override the same entity again", async () => {
        let instance = await VotingEntity.deployed();

        try {
            await instance.createEntity(entityInput.name, entityInput.censusRequestUrl, { from: accounts[0] });
        }catch(_error){
            error = _error
        }

        assert.isNotNull(error, "If entity already exists should fail")
    });
});

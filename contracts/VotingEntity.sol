pragma solidity ^0.5.0;

contract VotingEntity {

    struct Entity {
        bool exists;
        string name;
        string censusRequestUrl;
    }

    mapping (address => Entity) public entities;
    address[] public entitiesIndex;

    constructor() public {
    }

    function createEntity(string memory _name, string memory _url) public {
        require(entities[msg.sender].exists == false, "Entity already exists");

        entities[msg.sender] = Entity(true, _name, _url);
        entitiesIndex.push(msg.sender);
    }

    function getEntity(address _address) 
        public view 
        returns(string memory name, bool exists, string memory censusRequestUrl){

        return (entities[_address].name, entities[_address].exists, entities[_address].censusRequestUrl);
    }

    function getEntitiesLength() public view
        returns (uint256)
    {
        return entitiesIndex.length;
    }
}
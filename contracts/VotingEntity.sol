pragma solidity ^0.5.0;

contract VotingEntity {

    struct Entity {
        bool exists;
        string name;
    }

    mapping (address => Entity) public entities;
    address[] public entitiesIndex;

    constructor() public {
    }

    function createEntity(string memory _name) public {
        require(entities[msg.sender].exists == false, "Entity already exists");

        entities[msg.sender] = Entity(true, _name);
        entitiesIndex.push(msg.sender);
    }

    function getEntity(address _address) public view returns(string memory name, bool exists){
        return (entities[_address].name, entities[_address].exists);
    }

    function getEntitiesLength() public view
        returns (uint256)
    {
        return entitiesIndex.length;
    }
}
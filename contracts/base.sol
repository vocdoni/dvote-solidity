// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity >=0.6.0 <0.7.0;

import "./lib.sol";

contract Owned {
    address internal contractOwner;

    /// @notice Creates a new instance of the contract and sets the contract owner.
    constructor() public {
        contractOwner = msg.sender;
    }

    /// @notice Fails if the sender is not the contract owner
    modifier onlyContractOwner {
        require(msg.sender == contractOwner, "onlyContractOwner");
        _;
    }
}

contract Chained is Owned {
    address public predecessorAddress; // Instance that we forked
    address public successorAddress; // Instance that forked from us (only when activated)
    uint256 public activationBlock; // Block after which the contract operates. Zero means still inactive.

    event Activated(uint256 blockNumber);
    event ActivatedSuccessor(uint256 blockNumber, address successor);

    /// @notice Fails if the contract is not yet active or if a successor has been activated
    modifier onlyIfActive {
        require(
            activationBlock > 0 && successorAddress == address(0),
            "Inactive"
        );
        _;
    }

    /// @notice When the contract is created, sets the predecessor (if any). Otherwise, sets the contract as active.
    /// @param predecessor The address of the predecessor instance (if any). `0x0` means no predecessor.
    function setUp(address predecessor) internal onlyContractOwner {
        require(
            predecessorAddress == address(0x0),
            "Already has a predecessor"
        );
        require(activationBlock == 0, "Already activated");

        if (predecessor != address(0)) {
            require(predecessor != address(this), "Can't be itself");
            require(
                ContractSupport.isContract(predecessor),
                "Invalid predecessor"
            );

            // Set the predecessor instance and leave ourselves inactive
            predecessorAddress = predecessor;
        } else {
            // Set no predecessor and activate ourselves now
            activationBlock = block.number;
        }
    }

    /// @notice Sets the activation block of the instance, so that it can start operating
    function activate() public {
        require(msg.sender == predecessorAddress, "Unauthorized");
        require(activationBlock == 0, "Already active");

        activationBlock = block.number;

        emit Activated(block.number);
    }

    /// @notice invokes `activate()` on the successor contract and deactivates itself
    function activateSuccessor(address successor) public onlyContractOwner {
        require(activationBlock > 0, "Must be active"); // we can't activate someone else before being active ourselves
        require(successorAddress == address(0), "Already inactive"); // we can't do it twice
        require(successor != address(this), "Can't be itself");
        require(ContractSupport.isContract(successor), "Not a contract"); // we can't activate a non-contract

        // Attach to the instance that will become active
        Chained succInstance = Chained(successor);
        succInstance.activate();
        successorAddress = successor;

        emit ActivatedSuccessor(block.number, successor);
    }
}

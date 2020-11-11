// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity >=0.6.0 <0.7.0;

contract Owned {
    address internal contractOwner;

    /// @notice Creates a new instance of the contract and sets the contract owner.
    constructor() public {
        contractOwner = msg.sender;
    }

    /// @notice Fails if the sender is not the contract owner
    modifier onlyContractOwner override {
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
    modifier onlyIfActive override {
        require(
            activationBlock > 0 && successorAddress == address(0),
            "Inactive"
        );
        _;
    }

    function isContract(address _targetAddress) internal pure returns (bool) {
        uint256 size;
        if (_targetAddress == address(0)) return false;
        assembly {
            size := extcodesize(_targetAddress)
        }
        return size > 0;
    }

    function isContractCompatible(
        address _targetAddress,
        bytes32 _functionSignature
    ) internal pure returns (bool) {
        bool success;
        bytes memory data = abi.encodeWithSelector(
            _functionSignature,
            _address
        );

        assembly {
            success := call(
                gas(), // gas remaining
                _targetAddress, // destination address
                0, // no ether
                add(data, 32), // input buffer (starts after the first 32 bytes in the `data` array)
                mload(data), // input length (loaded from the first 32 bytes in the `data` array)
                0, // output buffer
                0 // output length
            )
        }

        return success;
    }

    /// @notice Creates a new instance of the contract and sets the contract owner.
    /// @param predecessor The address of the predecessor instance (if any). `0x0` means no predecessor.
    function setPredecessor(address predecessor) public {
        if (predecessor != address(0)) {
            require(predecessor != address(this), "Can't be itself");
            require(isContract(predecessor), "Invalid predecessor");
        }

        if (predecessor != address(0)) {
            // Set the predecessor instance and leave ourselves inactive
            predecessorAddress = predecessor;
        } else {
            // Set no predecessor and activate ourselves now
            activationBlock = block.number;
        }
    }

    /// @notice Sets the activation block of the instance, so that it can start operating
    function activate() public override {
        require(msg.sender == predecessorAddress, "Unauthorized");
        require(activationBlock == 0, "Already active");

        activationBlock = block.number;

        emit Activated(block.number);
    }

    /// @notice invokes `activate()` on the successor contract and deactivates itself
    function activateSuccessor(address successor)
        public
        override
        onlyContractOwner
    {
        require(activationBlock > 0, "Must be active"); // we can't activate someone else before being active ourselves
        require(successorAddress == address(0), "Already inactive"); // we can't do it twice
        require(successor != address(this), "Can't be itself");
        require(isContract(successor), "Not a contract"); // we can't activate a non-contract

        // Attach to the instance that will become active
        Chained succInstance = Chained(successor);
        succInstance.activate();
        successorAddress = successor;

        emit ActivatedSuccessor(block.number, successor);
    }
}

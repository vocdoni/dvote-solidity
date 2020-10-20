// SPDX-License-Identifier: BSD-2-Clause
pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;


import "registry/ENS.sol";
import "resolver/profiles/ABIResolver.sol";
import "resolver/profiles/AddrResolver.sol";
import "resolver/profiles/ContentHashResolver.sol";
import "resolver/profiles/InterfaceResolver.sol";
import "resolver/profiles/NameResolver.sol";
import "resolver/profiles/PubkeyResolver.sol";
import "resolver/profiles/TextResolver.sol";
import "resolver/profiles/TextListResolver.sol";
/**
 * A simple resolver anyone can use; only allows the owner of a node to set its
 * address.
 */
contract PublicResolver is
    ABIResolver,
    AddrResolver,
    ContentHashResolver,
    InterfaceResolver,
    NameResolver,
    PubkeyResolver,
    TextResolver,
    TextListResolver {
    ENS ens;

    /**
     * A mapping of authorisations. An address that is authorised for a name
     * may make any changes to the name that the owner could, but may not update
     * the set of authorisations.
     * (node, owner, caller) => isAuthorised
     */
    mapping(bytes32=>mapping(address=>mapping(address=>bool))) public authorisations;

    event AuthorisationChanged(bytes32 indexed node, address indexed owner, address indexed target, bool isAuthorised);

    constructor(ENS _ens) public {
        ens = _ens;
    }

    function supportsInterface(bytes4 interfaceID)
        public
        pure
        override(
            ABIResolver,
            AddrResolver,
            ContentHashResolver,
            InterfaceResolver,
            NameResolver,
            PubkeyResolver,
            TextResolver,
            TextListResolver
        )
        returns(bool) {
        return super.supportsInterface(interfaceID);
    }

    /**
     * @dev Sets or clears an authorisation.
     * Authorisations are specific to the caller. Any account can set an authorisation
     * for any name, but the authorisation that is checked will be that of the
     * current owner of a name. Thus, transferring a name effectively clears any
     * existing authorisations, and new authorisations can be set in advance of
     * an ownership transfer if desired.
     *
     * @param node The name to change the authorisation on.
     * @param target The address that is to be authorised or deauthorised.
     * @param isAuthorised True if the address should be authorised, or false if it should be deauthorised.
     */
    function setAuthorisation(bytes32 node, address target, bool isAuthorised) external {
        authorisations[node][msg.sender][target] = isAuthorised;
        emit AuthorisationChanged(node, msg.sender, target, isAuthorised);
    }

    function isAuthorised(bytes32 node)
        internal
        view
        override
        returns(bool) {
        if (address(ens) != address(0)) {
            address owner = ens.owner(node);
            if (owner == msg.sender || authorisations[node][owner][msg.sender]) {
                return true;
            }
        }
        return keccak256(abi.encodePacked(msg.sender)) == node;
    }

    function multicall(bytes[] calldata data) external returns(bytes[] memory results) {
        results = new bytes[](data.length);
        for(uint i = 0; i < data.length; i++) {
            (bool success, bytes memory result) = address(this).delegatecall(data[i]);
            require(success, "failed delegatecall");
            results[i] = result;
        }
        return results;
    }
}
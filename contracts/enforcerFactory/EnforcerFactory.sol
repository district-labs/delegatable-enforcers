// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "../DistrictERC20PermitSubscriptionsEnforcer.sol";

contract EnforcerFactory {
    // Returns the address of the newly deployed contract
    function deploySubscriptions(
        uint _salt
    ) public payable returns (address) {
        return address(new DistrictERC20PermitSubscriptionsEnforcer{salt: bytes32(_salt)}());
    }
    // Get bytecode of contract 
    function getBytecodeSubscriptions()
        public
        view
        returns (bytes memory)
    {
        bytes memory bytecode = type(DistrictERC20PermitSubscriptionsEnforcer).creationCode;
        return abi.encodePacked(bytecode);
    }
    // Compute the address of the contract to be deployed
    function getAddress(uint256 _salt)
        public
        view
        returns (address)
    {
        // Get a hash concatenating args passed to encodePacked
        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0xff), // 0
                address(this), // address of factory contract
                _salt, // a random salt
                keccak256(getBytecodeSubscriptions()) // the contract bytecode
            )
        );
        // Cast last 20 bytes of hash to address
        return address(uint160(uint256(hash)));
    }
}
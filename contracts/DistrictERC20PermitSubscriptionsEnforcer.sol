//SPDX-License-Identifier: MIT
pragma solidity 0.8.15;

import { BytesLib } from "@delegatable/delegatable-sol/contracts/libraries/BytesLib.sol";
import { CaveatEnforcer, Transaction } from "@delegatable/delegatable-sol/contracts/CaveatEnforcer.sol";
import "@delegatable/delegatable-sol/contracts/Delegatable.sol";

interface IVerifier {
  function getSubPeriod() external returns (uint64);
}

contract DistrictERC20PermitSubscriptionsEnforcer is
  CaveatEnforcer,
  Delegatable("DistrictERC20PermitSubscriptionsEnforcer", "1")
{
  mapping(bytes32 => bool) public isCanceled;
  mapping(bytes32 => uint256) public lastTimestamp;

  function enforceCaveat(
    bytes calldata terms,
    Transaction calldata transaction,
    bytes32 delegationHash
  ) public override returns (bool) {
    require(
      !isCanceled[delegationHash],
      "DistrictERC20SubscriptionsEnforcer:canceled-subscription"
    );
    bytes4 targetSig = bytes4(transaction.data[0:4]);
    bytes4 _allowedSig = 0x97e18d6e;
    require(targetSig == _allowedSig, "DistrictERC20SubscriptionsEnforcer:invalid-method");
    address _verifier = BytesLib.toAddress(terms, 0);
    uint64 _subPeriod = IVerifier(_verifier).getSubPeriod();
    uint64 _currentTime = uint64(block.timestamp);
    require(
      lastTimestamp[delegationHash] + _subPeriod < _currentTime,
      "DistrictERC20SubscriptionsEnforcer:invalid-subscritpion-time"
    );

    if (lastTimestamp[delegationHash] == 0) {
      lastTimestamp[delegationHash] = _currentTime;
      return true;
    }
    lastTimestamp[delegationHash] += _subPeriod;
    return true;
  }

  function encodeTerms(address verifier, uint8 salt) external pure returns (bytes memory) {
    return abi.encodePacked(verifier, salt);
  }

  function cancelSubscription(SignedDelegation calldata signedDelegation, bytes32 domainHash)
    external
  {
    address signer = verifyExternalDelegationSignature(signedDelegation, domainHash);
    address sender = _msgSender();
    require(signer == sender, "DistrictERC20SubscriptionsEnforcer:no-cancel-permission");
    bytes32 delegationHash = GET_SIGNEDDELEGATION_PACKETHASH(signedDelegation);
    isCanceled[delegationHash] = true;
  }

  function verifyExternalDelegationSignature(
    SignedDelegation memory signedDelegation,
    bytes32 domainHash
  ) public view virtual returns (address) {
    Delegation memory delegation = signedDelegation.delegation;
    bytes32 sigHash = getExternalDelegationTypedDataHash(delegation, domainHash);
    address recoveredSignatureSigner = recover(sigHash, signedDelegation.signature);
    return recoveredSignatureSigner;
  }

  function getExternalDelegationTypedDataHash(Delegation memory delegation, bytes32 domainHash)
    public
    pure
    returns (bytes32)
  {
    bytes32 digest = keccak256(
      abi.encodePacked("\x19\x01", domainHash, GET_DELEGATION_PACKETHASH(delegation))
    );
    return digest;
  }

  function _msgSender() internal view override returns (address sender) {
    if (msg.sender == address(this)) {
      bytes memory array = msg.data;
      uint256 index = msg.data.length;
      assembly {
        // Load the 32 bytes word from memory with the address on the lower 20 bytes, and mask those.
        sender := and(mload(add(array, index)), 0xffffffffffffffffffffffffffffffffffffffff)
      }
    } else {
      sender = msg.sender;
    }
    return sender;
  }
}

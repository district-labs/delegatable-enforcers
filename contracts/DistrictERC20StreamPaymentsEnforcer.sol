//SPDX-License-Identifier: MIT
pragma solidity 0.8.15;

import { BytesLib } from "@delegatable/delegatable-sol/contracts/libraries/BytesLib.sol";
import { CaveatEnforcer, Transaction } from "@delegatable/delegatable-sol/contracts/CaveatEnforcer.sol";
import "@delegatable/delegatable-sol/contracts/Delegatable.sol";

interface IVerifier {
  function getToken() external returns (address);
}

contract DistrictERC20StreamPaymentsEnforcer is
  CaveatEnforcer,
  Delegatable("DistrictERC20PermitSubscriptionsEnforcer", "1")
{
  mapping(bytes32 => bool) public isCanceled;
  mapping(bytes32 => uint256) public latestTimestamp;
  mapping(bytes32 => uint256) public endTimestamp;
  mapping(bytes32 => uint256) public amountRemaining; //
  mapping(bytes32 => uint256) public unclaimedAmounts; //

  function enforceCaveat(
    bytes calldata terms,
    Transaction calldata transaction,
    bytes32 delegationHash
  ) public override returns (bool) {
    require(
      !isCanceled[delegationHash],
      "DistrictERC20StreamPaymentsEnforcer:canceled-subscription"
    );
    bytes4 targetSig = bytes4(transaction.data[0:4]);
    bytes4 _allowedSig = 0x9293e590;
    require(targetSig == _allowedSig, "DistrictERC20StreamPaymentsEnforcer:invalid-method");
    // decode delegator terms
    uint256 _streamEndTimestamp = endTimestamp[delegationHash];
    if (_streamEndTimestamp == 0) {
      // stream just started, set the variables
      uint256 _startStreamTimestamp = BytesLib.toUint256(terms, 0);
      uint256 _endStreamTimestamp = BytesLib.toUint256(terms, 32);
      uint256 _startAmount = BytesLib.toUint256(terms, 64);
      latestTimestamp[delegationHash] = _startStreamTimestamp;
      endTimestamp[delegationHash] = _endStreamTimestamp;
      amountRemaining[delegationHash] = _startAmount;
    }

    uint256 _latestWithdrawal = latestTimestamp[delegationHash];
    uint256 _timeRemaining = _streamEndTimestamp - _latestWithdrawal;
    require(_timeRemaining > 0, "stream-ended"); // redundant, should auto-revert if negative
    uint256 _currentTimestamp = block.timestamp;
    require(_currentTimestamp > _latestWithdrawal, "stream-early");
    uint256 _timeElapsed = _currentTimestamp - _latestWithdrawal;
    if (_timeElapsed > _timeRemaining) {
      _timeElapsed = _timeRemaining;
    }
    uint256 _unclaimedAmount = (amountRemaining[delegationHash] * _timeRemaining) / _timeElapsed;
    // update mappings
    unclaimedAmounts[delegationHash] = _unclaimedAmount;
    amountRemaining[delegationHash] -= _unclaimedAmount;
    latestTimestamp[delegationHash] = _currentTimestamp;
    return true;
  }

  function getUnclaimedAmount(bytes32 delegationHash) public returns (uint256) {
    return unclaimedAmounts[delegationHash];
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

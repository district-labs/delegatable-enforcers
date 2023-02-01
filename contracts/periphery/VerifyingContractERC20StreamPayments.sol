//SPDX-License-Identifier: MIT
pragma solidity 0.8.15;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@delegatable/delegatable-sol/contracts/Delegatable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "hardhat/console.sol";

contract VerifyingContractERC20StreamPayments is Delegatable, Ownable {
  mapping(bytes32 => uint256) public latestTimestamp;
  mapping(bytes32 => uint256) public endTimestamp;
  mapping(bytes32 => uint256) public amountRemaining; //

  constructor(string memory name) Delegatable(name, "1") {}

  function streamToDate(
    address recipient,
    address token,
    uint256 startStreamTimestamp,
    uint256 endStreamTimestamp,
    uint256 amount,
    bytes32 delegationHash
  ) external {
    require(msg.sender == address(this), "VerifyingContract:invalid-sender");
    uint256 _streamEndTimestamp = endTimestamp[delegationHash];
    if (_streamEndTimestamp == 0) {
      // stream just started, set the variables
      latestTimestamp[delegationHash] = startStreamTimestamp;
      endTimestamp[delegationHash] = endStreamTimestamp;
      amountRemaining[delegationHash] = amount;
      _streamEndTimestamp = endTimestamp[delegationHash];
    }
    // find unclaimed amount
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
    amountRemaining[delegationHash] -= _unclaimedAmount;
    latestTimestamp[delegationHash] = _currentTimestamp;
    // transfer tokens
    IERC20(token).transferFrom(_msgSender(), recipient, _unclaimedAmount);
  }

  function _msgSender() internal view override(DelegatableCore, Context) returns (address sender) {
    if (msg.sender == address(this)) {
      bytes memory array = msg.data;
      uint256 index = msg.data.length;
      assembly {
        sender := and(mload(add(array, index)), 0xffffffffffffffffffffffffffffffffffffffff)
      }
    } else {
      sender = msg.sender;
    }
    return sender;
  }
}

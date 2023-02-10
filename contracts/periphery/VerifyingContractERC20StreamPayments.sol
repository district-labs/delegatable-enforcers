//SPDX-License-Identifier: MIT
pragma solidity 0.8.15;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@delegatable/delegatable-sol/contracts/Delegatable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract VerifyingContractERC20StreamPayments is Delegatable, Ownable {
  uint256 public immutable tokensPerSecond;
  address public immutable token;

  constructor(
    string memory name,
    uint256 _tokensPerSecond,
    address _token
  ) Delegatable(name, "1") {
    tokensPerSecond = _tokensPerSecond;
    token = _token;
  }

  function getTokensPerSecond() external returns (uint256) {
    return tokensPerSecond;
  }

  function getTokenAddress() external returns (address) {
    return token;
  }

  function withdrawFromStream(address recipient, uint256 tokensRequested) external {
    require(msg.sender == address(this), "verifier:invalid-sender");
    IERC20(token).transferFrom(_msgSender(), recipient, tokensRequested);
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

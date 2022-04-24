pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ERC20Pig is ERC20("PigToken", "Pig"){
  constructor (){
    _mint(msg.sender, 1e25);
  }
}
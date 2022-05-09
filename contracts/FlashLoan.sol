pragma solidity 0.6.12;

import "@aave/protocol-v2/contracts/flashloan/base/FlashLoanReceiverBase.sol";
import "@aave/protocol-v2/contracts/interfaces/ILendingPoolAddressesProvider.sol";
import "@aave/core-v3/contracts/dependencies/weth/WETH9.sol";
import "hardhat/console.sol";
import "./FlashLoanInterface.sol";

contract FlashLoan is FlashLoanReceiverBase {
    WETH9 public weth;
    CErc20Delegator public cToken;
    CEther public cEther;

    address public borrower;
    uint256 public repayAmount;
    address public cTokenCollateral;

    constructor(
        address poolAddress,
        address wethAddress,
        address cEtherAddress,
        address cTokenAddress
    ) public FlashLoanReceiverBase(ILendingPoolAddressesProvider(poolAddress)) {
        weth = WETH9(payable(wethAddress));
        cToken = CErc20Delegator(payable(cTokenAddress));
        cEther = CEther(payable(cEtherAddress));
    }

    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external override returns (bool) {
        console.log("我借的 token 數量: %s 顆 WETH", amounts[0] / 1 ether);
        console.log(
            "利息為: %s 顆 WETH/10000",
            (premiums[0] * 10000) / 1 ether
        );

        weth.approve(address(cToken), repayAmount);

        uint256 err = cToken.liquidateBorrow(
            borrower,
            repayAmount,
            cTokenCollateral
        );
        require(err == 0, "liquidateBorrow failed");

        uint256 cTokenAmount = cEther.balanceOf(address(this));

        weth.approve(address(LENDING_POOL), amounts[0] + premiums[0]);
        return true;
    }

    function flashLoan(uint256 amount, address asset)
        external
        returns (uint16 status)
    {
        address[] memory assets = new address[](1);
        uint256[] memory amounts = new uint256[](1);
        uint256[] memory modes = new uint256[](1);

        assets[0] = asset;
        amounts[0] = amount;
        modes[0] = 0;

        bytes memory params = "";

        uint16 referralCode = 0;

        LENDING_POOL.flashLoan(
            address(this),
            assets,
            amounts,
            modes,
            address(this),
            params,
            referralCode
        );

        return uint16(1);
    }

    receive() external payable {}

    function depositWETH(uint256 amount) external returns (bool) {
        weth.deposit{value: amount}();
        return true;
    }

    function setLiquidateBorrowParams(
        address _borrower,
        uint256 _repayAmount,
        address _cTokenCollateral
    ) external {
        borrower = _borrower;
        repayAmount = _repayAmount;
        cTokenCollateral = _cTokenCollateral;
    }
}

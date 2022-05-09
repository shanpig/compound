pragma solidity ^0.5.16;

import "../CTokenInterfaces.sol";

contract CERC721Interface {
    address public underlying;

    mapping(address => uint8) public underlyingNFTOfUser;

    bool public constant isCErc721 = true;

    string public name;
    string public symbol;
    bool internal _notEntered = true;

    function seize(
        address liquidator,
        address borrower,
        uint8 tokenId
    ) external returns (uint256);
}

contract IERC721 {
    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    ) external;
}

contract CERC721 is CERC721Interface, CTokenInterface {
    address public underlying;

    mapping(address => uint8) public underlyingNFTOfUser;

    bool public constant isCErc721 = true;

    string public name;
    string public symbol;
    bool internal _notEntered = true;

    modifier nonReentrant() {
        require(_notEntered, "re-entered");
        _notEntered = false;
        _;
        _notEntered = true; // get a gas-refund post-Istanbul
    }

    constructor(
        address underlying_,
        string memory name_,
        string memory symbol_
    ) public {
        name = name_;
        symbol = symbol_;
        underlying = underlying_;
    }

    function mint(uint8 tokenId) external returns (uint256) {
        (uint256 err, ) = mintInternal(tokenId);
        return err;
    }

    function mintInternal(uint8 tokenId)
        internal
        nonReentrant
        returns (uint256, uint8)
    {
        // mintFresh emits the actual Mint event if successful and logs on errors, so we don't need to
        return mintFresh(msg.sender, tokenId);
    }

    function mintFresh(address minter, uint8 tokenId)
        internal
        returns (uint256, uint8)
    {
        /*
         *  We call `doTransferIn` for the minter and the mintAmount.
         *  Note: The cToken must handle variations between ERC-20 and ETH underlying.
         *  `doTransferIn` reverts if anything goes wrong, since we can't be sure if
         *  side-effects occurred. The function returns the amount actually transferred,
         *  in case of a fee. On success, the cToken holds an additional `actualMintAmount`
         *  of cash.
         */
        doTransferIn(minter, tokenId);

        require(
            underlyingNFTOfUser[minter] <= uint8(0),
            "user already has NFT"
        );

        underlyingNFTOfUser[minter] = tokenId;

        /* We call the defense hook */
        // unused function
        // comptroller.mintVerify(address(this), minter, vars.actualMintAmount, vars.mintTokens);

        return (uint256(0), tokenId);
    }

    function doTransferIn(address from, uint256 tokenId) internal {
        IERC721 nft = IERC721(underlying);
        nft.transferFrom(from, address(this), tokenId);
    }

    function redeem(uint8 tokenId) external returns (uint256) {
        return redeemInternal(tokenId);
    }

    function redeemInternal(uint8 tokenId)
        internal
        nonReentrant
        returns (uint256)
    {
        // redeemFresh emits redeem-specific logs on errors, so we don't need to
        return redeemFresh(msg.sender, tokenId);
    }

    function redeemFresh(address redeemer, uint8 tokenId)
        internal
        returns (uint256)
    {
        doTransferOut(redeemer, tokenId);

        underlyingNFTOfUser[redeemer] = uint8(0);

        return uint256(0);
    }

    function doTransferOut(address to, uint8 tokenId) internal {
        IERC721 nft = IERC721(underlying);
        nft.transferFrom(address(this), to, tokenId);
    }

    function seize(
        address liquidator,
        address borrower,
        uint8 tokenId
    ) external nonReentrant returns (uint256) {
        return seizeInternal(msg.sender, liquidator, borrower, tokenId);
    }

    function seize(
        address liquidator,
        address borrower,
        uint256 seizeTokens
    ) external returns (uint256) {
        return uint256(0);
    }

    function seizeInternal(
        address seizerToken,
        address liquidator,
        address borrower,
        uint8 tokenId
    ) internal returns (uint256) {
        underlyingNFTOfUser[borrower] = uint8(0);
        underlyingNFTOfUser[liquidator] = tokenId;
        return uint256(0);
    }

    function transfer(address dst, uint256 amount) external returns (bool) {
        return true;
    }

    function transferFrom(
        address src,
        address dst,
        uint256 amount
    ) external returns (bool) {
        uint8 tokenId = underlyingNFTOfUser[src];
        underlyingNFTOfUser[src] = uint8(0);
        underlyingNFTOfUser[dst] = tokenId;
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        return true;
    }

    function allowance(address owner, address spender)
        external
        view
        returns (uint256)
    {
        return uint256(0);
    }

    function balanceOf(address owner) external view returns (uint256) {
        return uint256(0);
    }

    function balanceOfUnderlying(address owner) external returns (uint256) {
        return uint256(0);
    }

    function getAccountSnapshot(address account)
        external
        view
        returns (
            uint256,
            uint256,
            uint256,
            uint256
        )
    {
        if (underlyingNFTOfUser[account] > 0) {
            return (0, 1, 0, 1 ether);
        } else return (0, 0, 0, 1 ether);
    }

    function borrowRatePerBlock() external view returns (uint256) {
        return uint256(0);
    }

    function supplyRatePerBlock() external view returns (uint256) {
        return uint256(0);
    }

    function totalBorrowsCurrent() external returns (uint256) {
        return uint256(0);
    }

    function borrowBalanceCurrent(address account) external returns (uint256) {
        return uint256(0);
    }

    function borrowBalanceStored(address account)
        public
        view
        returns (uint256)
    {
        return uint256(0);
    }

    function exchangeRateCurrent() public returns (uint256) {
        return uint256(1);
    }

    function exchangeRateStored() public view returns (uint256) {
        return uint256(1);
    }

    function getCash() external view returns (uint256) {
        return uint256(0);
    }

    function accrueInterest() public returns (uint256) {
        return uint256(0);
    }

    /*** Admin Functions ***/

    function _setPendingAdmin(address payable newPendingAdmin)
        external
        returns (uint256)
    {
        return uint256(0);
    }

    function _acceptAdmin() external returns (uint256) {
        return uint256(0);
    }

    function _setComptroller(ComptrollerInterface newComptroller)
        public
        returns (uint256)
    {
        return uint256(0);
    }

    function _setReserveFactor(uint256 newReserveFactorMantissa)
        external
        returns (uint256)
    {
        return uint256(0);
    }

    function _reduceReserves(uint256 reduceAmount) external returns (uint256) {
        return uint256(0);
    }

    function _setInterestRateModel(InterestRateModel newInterestRateModel)
        public
        returns (uint256)
    {
        return uint256(0);
    }
}

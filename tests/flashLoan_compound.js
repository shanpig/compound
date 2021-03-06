const { expect } = require('chai');
const { ethers } = require('hardhat');
const { accounts, poolProviderAddress, wethAddress } = require('../constant');

const AliceAccount = accounts[0].address;
const BobAccount = accounts[1].address;

const ETHPrice = ethers.utils.parseEther('1000');
const ETHPriceNew = ethers.utils.parseEther('800');

const maxAssets = 12;
const scale = ethers.utils.parseEther('1');
const collateralFactor = ethers.utils.parseEther('0.8');
const exchangeRate = ethers.utils.parseEther('1');
const closeFactor = ethers.utils.parseEther('1').div(2);
const liquidationIncentive = ethers.utils.parseEther('1');

const BobMintWETHAmount = ethers.utils.parseEther('100');
const BobMintCWETHAmount = ethers.utils.parseEther('100');
const BobMintCETHAmount = ethers.utils.parseEther('100');

const AliceMintCETHAmount = ethers.utils.parseEther('100');
const AliceBorrowCWETHAmount = ethers.utils.parseEther('70');

const flashLoanMintWETHAmount = ethers.utils.parseEther('50');

const scaleDown = (bigNumber) => {
  return bigNumber.div(ethers.utils.parseEther('1'));
};

const deployComptroller = async () => {
  const Comptroller = await ethers.getContractFactory('ComptrollerG1');
  const comptroller = await Comptroller.deploy();
  await comptroller.deployed();
  return comptroller;
};

const deployInterestRateModel = async () => {
  const InterestRateModel = await ethers.getContractFactory(
    'WhitePaperInterestRateModel'
  );
  const interestRateModel = await InterestRateModel.deploy(0, 0);
  await interestRateModel.deployed();
  return interestRateModel;
};

const deployCEther = async (comptrollerAddress, interestRateModelAddress) => {
  const CEther = await ethers.getContractFactory('contracts/CEther.sol:CEther');
  const cEther = await CEther.deploy(
    comptrollerAddress,
    interestRateModelAddress,
    exchangeRate,
    'CEther',
    'cETH',
    18,
    AliceAccount
  );
  await cEther.deployed();
  return cEther;
};

const deployOracle = async () => {
  const Oracle = await ethers.getContractFactory('SimplePriceOracle');
  const oracle = await Oracle.deploy();
  await oracle.deployed();
  return oracle;
};

const attachWETH = async () => {
  const WETH = await ethers.getContractFactory('WETH9');
  const weth = WETH.attach(wethAddress);
  return weth;
};

const deployDelegate = async () => {
  const ERCDelegate = await ethers.getContractFactory('CErc20Delegate');
  const delegate = await ERCDelegate.deploy();
  await delegate.deployed();
  return delegate;
};

const deployDelegator = async (
  wethAddress,
  comptrollerAddress,
  interestRateModelAddress,
  adminAddress,
  delegateAddress
) => {
  const ERCDelegator = await ethers.getContractFactory(
    'contracts/CErc20Delegator.sol:CErc20Delegator'
  );
  const delegator = await ERCDelegator.deploy(
    wethAddress,
    comptrollerAddress,
    interestRateModelAddress,
    exchangeRate,
    'a cToken for wrapped ether',
    'cWETH',
    1,
    adminAddress,
    delegateAddress,
    0x00
  );
  await delegator.deployed();
  return delegator;
};

const deployFlashLoan = async (cEther, cToken) => {
  const FlashLoan = await ethers.getContractFactory('FlashLoan');
  const flashLoan = await FlashLoan.deploy(
    poolProviderAddress,
    wethAddress,
    cEther.address,
    cToken.address
  );
  return flashLoan;
};

describe('??? flash loan ??????????????? compound', async () => {
  let comptroller;
  let oracle;
  let interestRateModel;
  let cEther;
  let weth;
  let delegate;
  let delegator;
  let flashLoan;

  before('Deploy contracts: ', async () => {
    comptroller = await deployComptroller();
    interestRateModel = await deployInterestRateModel();
    cEther = await deployCEther(comptroller.address, interestRateModel.address);
    oracle = await deployOracle();
    weth = await attachWETH();
    delegate = await deployDelegate();
    delegator = await deployDelegator(
      weth.address,
      comptroller.address,
      interestRateModel.address,
      AliceAccount,
      delegate.address
    );
    flashLoan = await deployFlashLoan(cEther, delegator);

    await comptroller._setCloseFactor(closeFactor);
    await comptroller._setPriceOracle(oracle.address);
    await comptroller._setMaxAssets(maxAssets);
    await comptroller._setLiquidationIncentive(liquidationIncentive);
  });

  it('?????? contract ?????????????????????: ', async () => {
    expect(comptroller.address).to.be.a('string');
    expect(interestRateModel.address).to.be.a('string');
    expect(cEther.address).to.be.a('string');
    expect(oracle.address).to.be.a('string');
    expect(weth.address).to.be.a('string');
    expect(delegate.address).to.be.a('string');
    expect(delegator.address).to.be.a('string');
    expect(flashLoan.address).to.be.a('string');
  });

  it('?????? flashLoan ??? cToken ?????????', async () => {
    const cToken = await flashLoan.cToken();

    expect(cToken).to.equal(delegator.address);
  });

  describe('????????????: ', async () => {
    it('?????? Ether ????????? 1000U', async () => {
      await oracle.setUnderlyingPrice(cEther.address, ETHPrice);

      const cEtherPrice = await oracle.getUnderlyingPrice(cEther.address);
      expect(cEtherPrice.eq(ETHPrice)).to.be.true;
    });

    it('?????? WETH ????????? 1000U', async () => {
      await oracle.setUnderlyingPrice(delegator.address, ETHPrice);

      const cWETHPrice = await oracle.getUnderlyingPrice(delegator.address);
      expect(cWETHPrice.eq(ETHPrice)).to.be.true;
    });
  });

  describe('comptroller ??????: ', async () => {
    let cEtherMarket;
    let cWETHMarket;

    before('?????? comptroller ????????? token ????????????', async () => {
      await comptroller._supportMarket(cEther.address);
      await comptroller._supportMarket(delegator.address);

      await comptroller._setCollateralFactor(cEther.address, collateralFactor);
      await comptroller._setCollateralFactor(
        delegator.address,
        collateralFactor
      );

      cEtherMarket = await comptroller.markets(cEther.address);
      cWETHMarket = await comptroller.markets(delegator.address);
    });

    it('comptroller ?????? cEther ??? cWETH', async () => {
      expect(cEtherMarket.isListed).to.be.true;
      expect(cWETHMarket.isListed).to.be.true;
    });

    it(`??????????????? ${ethers.utils.formatEther(collateralFactor)}`, async () => {
      expect(cEtherMarket.collateralFactorMantissa.eq(collateralFactor)).to.be
        .true;
      expect(cWETHMarket.collateralFactorMantissa.eq(collateralFactor)).to.be
        .true;
    });
  });

  describe('Bob ?????????????????? compound', async () => {
    let Bob;
    let cEtherForBob;
    let wethForBob;
    let cWETHForBob;
    let comptrollerForBob;

    before('?????? Bob ????????? contract', async () => {
      Bob = await ethers.getSigner(BobAccount);
      cEtherForBob = await cEther.connect(Bob);
      wethForBob = await weth.connect(Bob);
      cWETHForBob = await delegator.connect(Bob);
      comptrollerForBob = await comptroller.connect(Bob);
    });

    it('Bob mint 100 ??? cEther', async () => {
      await cEtherForBob.mint({ value: BobMintCETHAmount.toString() });

      const BobCEtherBalance = await cEtherForBob.balanceOf(BobAccount);
      expect(BobCEtherBalance.eq(BobMintCETHAmount)).to.be.true;
    });

    it('Bob mint 100 ??? cWETH', async () => {
      await wethForBob.deposit({ value: BobMintWETHAmount.toString() });

      await wethForBob.approve(delegator.address, BobMintCWETHAmount);
      await cWETHForBob.mint(BobMintCWETHAmount);

      const BobCWETHBalance = await delegator.balanceOf(BobAccount);
      expect(BobCWETHBalance.eq(BobMintCWETHAmount)).to.be.true;
    });

    it('Bob ?????? cEther ??? cWETH ???????????????', async () => {
      await comptrollerForBob.enterMarkets([delegator.address, cEther.address]);

      const BobAssetsInPool = await comptrollerForBob.getAssetsIn(Bob.address);
      expect(BobAssetsInPool)
        .to.contain(cEther.address)
        .and.contain(delegator.address);
    });
  });

  describe('Alice ?????? 100 ETH????????? 80 ETH ??? liquidity', async () => {
    before('Alice ??? mint 100 cEther', async () => {
      await cEther.mint({ value: AliceMintCETHAmount.toString() });
    });

    it('Alice ????????? 100 cEther', async () => {
      const AliceCEtherBalance = await cEther.balanceOf(AliceAccount);
      expect(AliceCEtherBalance.eq(AliceMintCETHAmount)).to.be.true;
    });

    it('Alice ?????? cEther ??? cWETH ?????????', async () => {
      await comptroller.enterMarkets([delegator.address, cEther.address]);

      const AliceAssetsInPool = await comptroller.getAssetsIn(AliceAccount);
      expect(AliceAssetsInPool)
        .to.contain(cEther.address)
        .and.contain(delegator.address);
    });

    it('Alice ????????? liquidity ?????? 80 WETH', async () => {
      const AliceLiquidity = await comptroller.getAccountLiquidity(
        AliceAccount
      );

      expect(
        AliceLiquidity[1].eq(
          AliceMintCETHAmount.mul(collateralFactor)
            .div(scale)
            .mul(scaleDown(ETHPrice))
        )
      ).to.be.true;
    });
  });

  describe('Alice ?????? 70 WETH', async () => {
    it('Alice ?????? 70 WETH', async () => {
      const AliceWETHBalance = await weth.balanceOf(AliceAccount);

      await delegator.borrow(AliceBorrowCWETHAmount);

      const AliceWETHBalanceNew = await weth.balanceOf(AliceAccount);

      expect(
        AliceWETHBalanceNew.eq(AliceWETHBalance.add(AliceBorrowCWETHAmount))
      ).to.be.true;
    });
  });

  describe('ETH ??????????????? 800U', async () => {
    it('?????? ETH ????????? 800U', async () => {
      await oracle.setUnderlyingPrice(cEther.address, ETHPriceNew);
      const cEtherPriceNew = await oracle.getUnderlyingPrice(cEther.address);
      expect(cEtherPriceNew.eq(ETHPriceNew)).to.be.true;
    });
  });

  describe('Alice ????????? liquidity ?????? 64 WETH', async () => {
    it('Alice liquidity ?????? 64 WETH?????????????????? 70 WETH???????????? 6 WETH', async () => {
      const AliceLiquidityNew = await comptroller.getAccountLiquidity(
        AliceAccount
      );

      const AliceBorrowedLiquidityValue = AliceBorrowCWETHAmount.mul(
        scaleDown(ETHPrice)
      );
      const AliceLiquidityNewExpected = AliceMintCETHAmount.mul(
        collateralFactor
      )
        .div(scale)
        .mul(scaleDown(ETHPriceNew));

      expect(
        AliceLiquidityNew[2].eq(
          AliceBorrowedLiquidityValue.sub(AliceLiquidityNewExpected)
        )
      ).to.be.true;
    });
  });

  describe('liquidator ??? aave ?????? 70 WETH?????? compound ?????? liquidateBorrow', async () => {
    before('?????? flashLoan contract mint ?????? WETH', async () => {
      await flashLoan.fallback({
        value: flashLoanMintWETHAmount,
      });
      await flashLoan.depositWETH(flashLoanMintWETHAmount);
    });

    before('?????????????????????????????????????????????????????? cToken', async () => {
      await flashLoan.setLiquidateBorrowParams(
        AliceAccount,
        AliceBorrowCWETHAmount.div(2),
        cEther.address
      );

      const liquidateBorrowBorrower = await flashLoan.borrower();
      const liquidateBorrowRepayAmount = await flashLoan.repayAmount();
      const liquidateBorrowCollateral = await flashLoan.cTokenCollateral();

      expect(liquidateBorrowBorrower.toLowerCase()).to.equal(
        AliceAccount.toLowerCase()
      );
      expect(liquidateBorrowRepayAmount.eq(AliceBorrowCWETHAmount.div(2))).to.be
        .true;
      expect(liquidateBorrowCollateral.toLowerCase()).to.equal(
        cEther.address.toLowerCase()
      );
    });

    it('flashLoan contract ??????????????? WETH', async () => {
      const flashLoanWETHBalance = await weth.balanceOf(flashLoan.address);
      expect(flashLoanWETHBalance.eq(flashLoanMintWETHAmount)).to.be.true;
    });
  });

  describe('?????? flashLoan ??? flashLoan function?????????????????????', async () => {
    let flashLoanWETHBalance;
    let flashLoanCEtherBalance;
    let flashLoanWETHBalanceNew;
    let flashLoanCEtherBalanceNew;
    let flashLoanActualCEtherReward;
    let spentWETH;

    before('??????????????????????????????', async () => {
      flashLoanCEtherBalance = await cEther.balanceOf(flashLoan.address);
      flashLoanWETHBalance = await weth.balanceOf(flashLoan.address);

      await flashLoan.flashLoan(AliceBorrowCWETHAmount.div(2), weth.address);

      flashLoanCEtherBalanceNew = await cEther.balanceOf(flashLoan.address);
    });

    it('flash loan contract ????????? cEther ?????????', async () => {
      expect(flashLoanCEtherBalanceNew.gt(flashLoanCEtherBalance)).to.be.true;
    });

    it('????????? cEther ????????? WETH ?????? Alice ???????????????????????????', async () => {
      flashLoanActualCEtherReward = flashLoanCEtherBalanceNew.sub(
        flashLoanCEtherBalance
      );

      const flashLoanCEtherReward = flashLoanActualCEtherReward
        .mul(1000)
        .div(972);

      const flashLoanEtherReward = flashLoanCEtherReward
        .mul(ETHPriceNew)
        .div(ETHPrice);

      console.table({
        'flashLoan ????????? CEther': flashLoanActualCEtherReward.toString(),
        'flashLoan ?????? compound 2.8% ??????': flashLoanCEtherReward.toString(),
        '????????????????????? cEther ??????????????? WETH ??????':
          flashLoanEtherReward.toString(),
        'Alice ?????? WETH ?????????': AliceBorrowCWETHAmount.toString(),
      });

      expect(
        flashLoanEtherReward.eq(
          AliceBorrowCWETHAmount.div(2).mul(liquidationIncentive).div(scale)
        )
      ).to.be.true;
    });

    it('?????? flash loan ????????????', async () => {
      flashLoanWETHBalanceNew = await weth.balanceOf(flashLoan.address);
      spentWETH = flashLoanWETHBalance.sub(flashLoanWETHBalanceNew);

      expect(spentWETH.eq(AliceBorrowCWETHAmount.div(2).mul(10009).div(10000)))
        .to.be.true;
    });

    after('?????? flash loan ????????????', async () => {
      const netIncome = flashLoanActualCEtherReward.mul(scaleDown(ETHPriceNew));
      const netSpend = spentWETH.mul(scaleDown(ETHPrice));
      const flashLoanTotalReward = netIncome.sub(netSpend);

      console.table({
        '??????(U)': scaleDown(netIncome).toString(),
        '??????(U)': scaleDown(netSpend).toString(),
        '??????(U)': scaleDown(flashLoanTotalReward).toString(),
      });
    });
  });
});

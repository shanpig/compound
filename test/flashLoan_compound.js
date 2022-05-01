const { expect } = require('chai');
const { ethers, network } = require('hardhat');
const { accounts, poolProviderAddress, wethAddress } = require('../constant');

const AliceAccount = accounts[0].address;
const BobAccount = accounts[1].address;
const CharlieAccount = accounts[2].address;

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

const scaleUp = (bigNumber) => {
  return bigNumber.mul(ethers.utils.parseEther('1'));
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

describe('用 flash loan 去借錢還給 compound', async () => {
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

  it('確認 contract 都有部署或連接: ', async () => {
    expect(comptroller.address).to.be.a('string');
    expect(interestRateModel.address).to.be.a('string');
    expect(cEther.address).to.be.a('string');
    expect(oracle.address).to.be.a('string');
    expect(weth.address).to.be.a('string');
    expect(delegate.address).to.be.a('string');
    expect(delegator.address).to.be.a('string');
    expect(flashLoan.address).to.be.a('string');
  });

  it('確認 flashLoan 的 cToken 有接上', async () => {
    const cToken = await flashLoan.cToken();

    expect(cToken).to.equal(delegator.address);
  });

  describe('設定價格: ', async () => {
    it('設定 Ether 價格為 1000U', async () => {
      await oracle.setUnderlyingPrice(cEther.address, ETHPrice);

      const cEtherPrice = await oracle.getUnderlyingPrice(cEther.address);
      expect(cEtherPrice.eq(ETHPrice)).to.be.true;
    });

    it('設定 WETH 價格為 1000U', async () => {
      await oracle.setUnderlyingPrice(delegator.address, ETHPrice);

      const cWETHPrice = await oracle.getUnderlyingPrice(delegator.address);
      expect(cWETHPrice.eq(ETHPrice)).to.be.true;
    });
  });

  describe('comptroller 設定: ', async () => {
    let cEtherMarket;
    let cWETHMarket;

    before('設定 comptroller 的支援 token 和抵押率', async () => {
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

    it('comptroller 支援 cEther 和 cWETH', async () => {
      expect(cEtherMarket.isListed).to.be.true;
      expect(cWETHMarket.isListed).to.be.true;
    });

    it(`抵押率皆為 ${ethers.utils.formatEther(collateralFactor)}`, async () => {
      expect(cEtherMarket.collateralFactorMantissa.eq(collateralFactor)).to.be
        .true;
      expect(cWETHMarket.collateralFactorMantissa.eq(collateralFactor)).to.be
        .true;
    });
  });

  describe('Bob 提供流動性到 compound', async () => {
    let Bob;
    let cEtherForBob;
    let wethForBob;
    let cWETHForBob;
    let comptrollerForBob;

    before('設定 Bob 要用的 contract', async () => {
      Bob = await ethers.getSigner(BobAccount);
      cEtherForBob = await cEther.connect(Bob);
      wethForBob = await weth.connect(Bob);
      cWETHForBob = await delegator.connect(Bob);
      comptrollerForBob = await comptroller.connect(Bob);
    });

    it('Bob mint 100 個 cEther', async () => {
      await cEtherForBob.mint({ value: BobMintCETHAmount.toString() });

      const BobCEtherBalance = await cEtherForBob.balanceOf(BobAccount);
      expect(BobCEtherBalance.eq(BobMintCETHAmount)).to.be.true;
    });

    it('Bob mint 100 個 cWETH', async () => {
      await wethForBob.deposit({ value: BobMintWETHAmount.toString() });

      await wethForBob.approve(delegator.address, BobMintCWETHAmount);
      await cWETHForBob.mint(BobMintCWETHAmount);

      const BobCWETHBalance = await delegator.balanceOf(BobAccount);
      expect(BobCWETHBalance.eq(BobMintCWETHAmount)).to.be.true;
    });

    it('Bob 提供 cEther 和 cWETH 作為抵押物', async () => {
      await comptrollerForBob.enterMarkets([delegator.address, cEther.address]);

      const BobAssetsInPool = await comptrollerForBob.getAssetsIn(Bob.address);
      expect(BobAssetsInPool)
        .to.contain(cEther.address)
        .and.contain(delegator.address);
    });
  });

  describe('Alice 抵押 100 ETH，得到 80 ETH 的 liquidity', async () => {
    before('Alice 先 mint 100 cEther', async () => {
      await cEther.mint({ value: AliceMintCETHAmount.toString() });
    });

    it('Alice 現在有 100 cEther', async () => {
      const AliceCEtherBalance = await cEther.balanceOf(AliceAccount);
      expect(AliceCEtherBalance.eq(AliceMintCETHAmount)).to.be.true;
    });

    it('Alice 進入 cEther 和 cWETH 的市場', async () => {
      await comptroller.enterMarkets([delegator.address, cEther.address]);

      const AliceAssetsInPool = await comptroller.getAssetsIn(AliceAccount);
      expect(AliceAssetsInPool)
        .to.contain(cEther.address)
        .and.contain(delegator.address);
    });

    it('Alice 現在的 liquidity 等於 80 WETH', async () => {
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

  describe('Alice 借出 70 WETH', async () => {
    it('Alice 借出 70 WETH', async () => {
      const AliceWETHBalance = await weth.balanceOf(AliceAccount);

      await delegator.borrow(AliceBorrowCWETHAmount);

      const AliceWETHBalanceNew = await weth.balanceOf(AliceAccount);

      expect(
        AliceWETHBalanceNew.eq(AliceWETHBalance.add(AliceBorrowCWETHAmount))
      ).to.be.true;
    });
  });

  describe('ETH 價格大跌到 800U', async () => {
    it('設定 ETH 價格為 800U', async () => {
      await oracle.setUnderlyingPrice(cEther.address, ETHPriceNew);
      const cEtherPriceNew = await oracle.getUnderlyingPrice(cEther.address);
      expect(cEtherPriceNew.eq(ETHPriceNew)).to.be.true;
    });
  });

  describe('Alice 現在的 liquidity 變成 64 WETH', async () => {
    it('Alice liquidity 等於 64 WETH，扣掉借出的 70 WETH，會負債 6 WETH', async () => {
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

  describe('liquidator 向 aave 借出 70 WETH，對 compound 發出 liquidateBorrow', async () => {
    before('先讓 flashLoan contract mint 一些 WETH', async () => {
      await flashLoan.fallback({
        value: flashLoanMintWETHAmount,
      });
      await flashLoan.depositWETH(flashLoanMintWETHAmount);
    });

    before('設定要清算的對象、清算額度和要收割的 cToken', async () => {
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

    it('flashLoan contract 應該有一些 WETH', async () => {
      const flashLoanWETHBalance = await weth.balanceOf(flashLoan.address);
      expect(flashLoanWETHBalance.eq(flashLoanMintWETHAmount)).to.be.true;
    });

    it('呼叫 flashLoan 的 flashLoan function，開始執行清算', async () => {
      const flashLoanCEtherBalance = await cEther.balanceOf(flashLoan.address);

      await flashLoan.flashLoan(AliceBorrowCWETHAmount.div(2), weth.address);

      const flashLoanCEtherBalanceNew = await cEther.balanceOf(
        flashLoan.address
      );
      console.log(
        'flashLoan 得到的 cEther 獎勵: ',
        flashLoanCEtherBalance,
        '->',
        flashLoanCEtherBalanceNew
      );

      expect(flashLoanCEtherBalanceNew.gt(flashLoanCEtherBalance)).to.be.true;
    });
  });
});

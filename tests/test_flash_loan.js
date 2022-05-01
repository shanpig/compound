const { expect } = require('chai');
const { ethers, network } = require('hardhat');
const { poolProviderAddress, wethAddress } = require('../constant');

const AliceAccount = '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266';
const BobAccount = '0x70997970c51812dc3a010c7d01b50e0d17dc79c8';

const connectWETH = async () => {
  const WETH = await ethers.getContractFactory('WETH9');
  const weth = WETH.attach(wethAddress);
  console.log('weth attached at: ', weth.address);
  return weth;
};

const deployFlashLoan = async () => {
  const FlashLoan = await ethers.getContractFactory('FlashLoan');
  const flashLoan = await FlashLoan.deploy(poolProviderAddress, wethAddress);
  console.log('flash loan deployed at: ', flashLoan.address);
  return flashLoan;
};

describe('testing', async () => {
  let flashLoan;
  let weth;

  describe('deploying contracts', async () => {
    it('deploying flash loan', async () => {
      flashLoan = await deployFlashLoan();
      expect(flashLoan.address).to.be.a('string');
    });

    it('connecting weth', async () => {
      weth = await connectWETH();
      expect(weth.address).to.be.a('string');
    });
  });

  describe('testing weth functionality', async () => {
    let aliceInitialWETH = '100';
    let amountApprovedToBob = '10';
    let Bob;
    let wethForBob;

    before(async () => {
      Bob = await ethers.getSigner(BobAccount);
      wethForBob = await ethers.getContractAt('WETH9', weth.address, Bob);
    });

    it('deposit some WETH for Alice', async () => {
      const balance = await weth.balanceOf(AliceAccount);
      await weth.deposit({
        value: ethers.utils.parseEther(aliceInitialWETH),
        from: AliceAccount,
      });
      const newBalance = await weth.balanceOf(AliceAccount);

      expect(newBalance.gt(balance)).to.be.true;
    });

    it('approve Bob for some weth', async () => {
      await weth.approve(
        BobAccount,
        ethers.utils.parseEther(amountApprovedToBob)
      );

      await wethForBob.transferFrom(
        AliceAccount,
        BobAccount,
        ethers.utils.parseEther(amountApprovedToBob)
      );

      const newAllowance = await weth.allowance(AliceAccount, BobAccount);

      expect(newAllowance.eq(0)).to.be.true;
    });

    it('transfer some ETH for flashLoan contract', async () => {
      let amountETHForFlashLoan = '10';
      await flashLoan.fallback({
        value: ethers.utils.parseEther(amountETHForFlashLoan),
      });
      const balance = await ethers.provider.getBalance(flashLoan.address);

      expect(balance.gt(0)).to.be.true;
    });

    it('deposit some WETH for flashLoan contract', async () => {
      let amountWETHForFlashLoan = '5';
      await flashLoan.depositWETH(
        ethers.utils.parseEther(amountWETHForFlashLoan)
      );

      const balance = await weth.balanceOf(flashLoan.address);

      expect(balance.gt(0)).to.be.true;
    });

    it('testing flashLoan functionality', async () => {
      let amountLoan = '10';
      await flashLoan.flashLoan(
        ethers.utils.parseEther(amountLoan),
        weth.address
      );

      expect(true).to.be.true;
    });
  });
});

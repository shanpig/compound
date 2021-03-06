const { expect } = require('chai');
const { ethers } = require('hardhat');
const { BAPAddress_mainnet, accounts } = require('../constant');

const AliceAccount = accounts[0].address;

const maxAssets = 12;
const scale = ethers.utils.parseEther('1');
const collateralFactor = ethers.utils.parseEther('0.9');

const exchangeRate = ethers.utils.parseEther('1');
const closeFactor = ethers.utils.parseEther('1').div(2);
const liquidationIncentive = ethers.utils.parseEther('1');

const EtherPrice = ethers.utils.parseEther('1000');
const NFTPrice = ethers.utils.parseEther('560000');

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

const deployInterestRateModel = async () => {
  const InterestRateModel = await ethers.getContractFactory(
    'WhitePaperInterestRateModel'
  );
  const interestRateModel = await InterestRateModel.deploy(0, 0);
  await interestRateModel.deployed();
  return interestRateModel;
};

const attachNFT = async () => {
  const NFT = await ethers.getContractFactory('ERC721');
  const nft = NFT.attach(BAPAddress_mainnet);

  console.log('NFT attached');
  return nft;
};

const deployCNFT = async (nftAddress, name, symbol) => {
  const CNFT = await ethers.getContractFactory('CERC721');
  const cNFT = await CNFT.deploy(nftAddress, name, symbol);
  await cNFT.deployed();
  console.log('cNFT deployed', cNFT.address);
  return cNFT;
};

const deployComptroller = async () => {
  const Comptroller = await ethers.getContractFactory('ComptrollerG1');
  const comptroller = await Comptroller.deploy();
  await comptroller.deployed();
  return comptroller;
};

describe('?????? NFT ?????????', async () => {
  let nft;
  let cNFT;
  let oracle;
  let interestRateModel;
  let comptroller;
  let cEther;

  before(async () => {
    nft = await attachNFT();
    comptroller = await deployComptroller();
    oracle = await deployOracle();
    interestRateModel = await deployInterestRateModel();
    cEther = await deployCEther(comptroller.address, interestRateModel.address);
    cNFT = await deployCNFT(nft.address, 'bored ape cToken', 'cBAP');

    await comptroller._setCloseFactor(closeFactor);
    await comptroller._setPriceOracle(oracle.address);
    await comptroller._setMaxAssets(maxAssets);
    await comptroller._setLiquidationIncentive(liquidationIncentive);

    await comptroller._supportMarket(cEther.address);
    await comptroller._supportMarket(cNFT.address);

    await oracle.setUnderlyingPrice(cEther.address, EtherPrice);
    await oracle.setUnderlyingPrice(cNFT.address, NFTPrice);

    await comptroller._setCollateralFactor(cEther.address, collateralFactor);
    await comptroller._setCollateralFactor(cNFT.address, collateralFactor);
  });

  describe('?????? NFT ??????????????????', async () => {
    it('?????????????????????????????????', async () => {
      const name = await nft.name();
      expect(name).to.equal('BoredApeYachtClub');
    });

    it('???????????????????????? NFT ??? url', async () => {
      const url = await nft.tokenURI(1);
      expect(url).to.be.string;
    });
  });

  describe('??????????????? impersonate NFT ??????????????? NFT', async () => {
    let nftForOwner;
    let ownerOfNFT;

    before('????????????????????? ETH ????????????????????????????????????', async () => {
      ownerOfNFT = await nft.ownerOf(1);
      const whale = await ethers.getSigner(accounts[5].address);

      await whale.sendTransaction({
        to: ownerOfNFT,
        value: ethers.utils.parseEther('1000'),
      });
    });

    before('??? NFT ??????????????????????????? Alice', async () => {
      ownerOfNFT = await nft.ownerOf(1);
      await hre.network.provider.request({
        method: 'hardhat_impersonateAccount',
        params: [ownerOfNFT],
      });

      const owner = await ethers.getSigner(ownerOfNFT);
      nftForOwner = await nft.connect(owner);

      await nftForOwner.approve(AliceAccount, 1);
    });

    it('?????????????????? NFT', async () => {
      await nft.transferFrom(ownerOfNFT, AliceAccount, 1);
      const newOwnerOfNFT = await nft.ownerOf(1);
      expect(newOwnerOfNFT.toLowerCase()).to.equal(AliceAccount.toLowerCase());
    });
  });

  describe('????????? NFT ?????? cNFT ??????', async () => {
    it('??? NFT ?????? mint cNFT', async () => {
      await nft.approve(cNFT.address, 1);
      await cNFT.mint(1);
      const nftId = await cNFT.underlyingNFTOfUser(AliceAccount);

      expect(nftId).to.be.greaterThan(0);
    });

    it('??? nft enterMarket', async () => {
      await comptroller.enterMarkets([cEther.address, cNFT.address]);

      const assets = await comptroller.getAssetsIn(AliceAccount);

      const result = await comptroller.getAccountLiquidity(AliceAccount);
      console.log(result);
      expect(assets).to.contain(cEther.address).and.contain(cNFT.address);
    });
  });
});

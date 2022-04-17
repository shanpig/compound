const { ethers } = require('hardhat');
const fs = require('fs');

const deploy = async () => {
  console.log('Deploying...');
  const Comptroller = await ethers.getContractFactory('CEther');

  const comptroller = await Comptroller.deploy();
  console.log('ctoken deployed');
  // use fs to write comptroller address to file 'deployments'
  fs.writeFileSync(
    'deployments.json',
    JSON.stringify({ cTokenAddress: comptroller.address })
  );
};

deploy();

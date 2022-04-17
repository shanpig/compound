const { ethers } = require('hardhat');
const fs = require('fs');

const deploy = async () => {
  console.log('Deploying...');
  const Comptroller = await ethers.getContractFactory('ComptrollerG1');

  const comptroller = await Comptroller.deploy();
  console.log('deployed');
  // use fs to write comptroller address to file 'deployments'
  fs.writeFileSync(
    'deployments.json',
    JSON.stringify({ comptrollerAddress: comptroller.address })
  );
};

deploy();

const { ethers } = require('hardhat');
const {
  readDeploymentData,
  writeDeploymentData,
} = require('./deploymentDataManipulation');

const deploy = async (cTokenContractName) => {
  console.log('Deploying...');
  const CToken = await ethers.getContractFactory(cTokenContractName);

  const deploymentData = await readDeploymentData();
  const { comptrollerAddress, interestRateModelAddress } = deploymentData;
  console.log(comptrollerAddress, interestRateModelAddress);

  const cToken = await CToken.deploy(
    comptrollerAddress,
    interestRateModelAddress,
    1,
    'CEther',
    'cETH',
    18,
    '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266'
  );

  deploymentData.cTokenAddresses = {
    ...deploymentData.cTokenAddresses,
    [cTokenContractName]: cToken.address,
  };

  console.log('ctoken deployed at: ', cToken.address);

  writeDeploymentData(deploymentData);
};

deploy('CEther').catch((error) => console.log(error));

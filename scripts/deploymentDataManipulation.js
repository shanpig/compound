const fs = require('fs');
const path = require('path');

const readDeploymentData = async () => {
  const deploymentsBytes = await fs.readFileSync(
    path.resolve(__dirname, '../deployments.json')
  );

  const deployments = JSON.parse(deploymentsBytes.toString());

  return deployments;
};

const writeDeploymentData = async (data) => {
  fs.writeFileSync('deployments.json', JSON.stringify(data));
};

module.exports = {
  readDeploymentData,
  writeDeploymentData,
};

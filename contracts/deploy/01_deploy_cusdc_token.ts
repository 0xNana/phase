import type { HardhatRuntimeEnvironment } from "hardhat/types";
import type { DeployFunction } from "hardhat-deploy/types";

const deployCUSDCToken: DeployFunction = async function deployCUSDCToken(
  hre: HardhatRuntimeEnvironment,
) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy("CUSDCToken", {
    from: deployer,
    args: [deployer, "https://phase.cash/contracts/cusdc"],
    log: true,
  });
};

deployCUSDCToken.tags = ["CUSDCToken"];

export default deployCUSDCToken;

import type { HardhatRuntimeEnvironment } from "hardhat/types";
import type { DeployFunction } from "hardhat-deploy/types";

const deployCUSDCFaucet: DeployFunction = async function deployCUSDCFaucet(
  hre: HardhatRuntimeEnvironment,
) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, get } = deployments;
  const { deployer } = await getNamedAccounts();
  const token = await get("CUSDCToken");

  await deploy("CUSDCFaucet", {
    from: deployer,
    args: [deployer, token.address],
    log: true,
  });
};

deployCUSDCFaucet.tags = ["CUSDCFaucet"];
deployCUSDCFaucet.dependencies = ["CUSDCToken"];

export default deployCUSDCFaucet;

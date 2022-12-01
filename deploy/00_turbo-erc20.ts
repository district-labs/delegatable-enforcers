import { HardhatRuntimeEnvironment } from "hardhat/types";

export default async function deploy(hardhat: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hardhat;

  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  await deploy("TurboERC20", {
    contract: "MintableERC20",
    from: deployer,
    args: ["Turbo ERC20", "TRBO"],
    skipIfAlreadyDeployed: false,
    log: true,
  });
}

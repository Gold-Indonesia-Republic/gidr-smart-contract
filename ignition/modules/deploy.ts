import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("GIDR", (m) => {
  const token = m.contract("GIDR", []);

  return { token };
});
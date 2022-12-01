import { ethers, network, artifacts } from 'hardhat';
import { expect } from 'chai';
import { Provider } from '@ethersproject/providers';
import { Contract, ContractFactory, Wallet } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

// @ts-ignore
import { generateUtil } from 'eth-delegatable-utils';
import { getPrivateKeys } from '../utils/getPrivateKeys';
import { generateDelegation } from './utils';
import { deployMockContract, MockContract } from 'ethereum-waffle';

const { getSigners } = ethers;

describe('DistrictUniswapV3TwapAboveEnforcer', () => {
  const CONTACT_NAME = 'ERC20Delegatable';
  let CONTRACT_INFO: any;
  let delegatableUtils: any;
  let signer0: SignerWithAddress;
  let wallet0: Wallet;
  let wallet1: Wallet;
  let pk0: string;
  let pk1: string;

  // Smart Contracts
  let DistrictUniswapV3TwapAboveEnforcer: Contract;
  let DistrictUniswapV3TwapAboveEnforcerFactory: ContractFactory;
  let ERC20Delegatable: Contract;
  let ERC20DelegatableFactory: ContractFactory;
  let mockOracle: MockContract;

  before(async () => {
    [signer0] = await getSigners();
    [wallet0, wallet1] = getPrivateKeys(signer0.provider as unknown as Provider);
    ERC20DelegatableFactory = await ethers.getContractFactory('ERC20Delegatable');
    DistrictUniswapV3TwapAboveEnforcerFactory = await ethers.getContractFactory(
      'DistrictUniswapV3TwapAboveEnforcer',
    );
    pk0 = wallet0._signingKey().privateKey;
    pk1 = wallet1._signingKey().privateKey;
  });

  beforeEach(async () => {
    await network.provider.request({
      method: 'hardhat_reset',
      params: [],
    });
    ERC20Delegatable = await ERC20DelegatableFactory.connect(wallet0).deploy(
      CONTACT_NAME,
      'TRUST',
      ethers.utils.parseEther('1'),
    );

    let oracleArtifact = await artifacts.readArtifact('IDistrictUniswapV3Oracle');
    mockOracle = await deployMockContract(wallet0, oracleArtifact.abi);

    DistrictUniswapV3TwapAboveEnforcer = await DistrictUniswapV3TwapAboveEnforcerFactory.connect(
      wallet0,
    ).deploy(mockOracle.address);

    CONTRACT_INFO = {
      chainId: ERC20Delegatable.deployTransaction.chainId,
      verifyingContract: ERC20Delegatable.address,
      name: CONTACT_NAME,
    };
    delegatableUtils = generateUtil(CONTRACT_INFO);
  });

  it('should SUCCEED to INVOKE method if tickThreshold above arithmeticMeanTick', async () => {
    const PK = wallet0._signingKey().privateKey.substring(2);
    expect(await ERC20Delegatable.balanceOf(wallet0.address)).to.eq(ethers.utils.parseEther('1'));

    let secondsAgo = '000003e8'; // is 1000 in decimal
    let tickSign = '01'; // 00 for negative, 01 for positive
    let unisignedTickThreshold = '032337'; // is 205623 in decimal, which corresponds to price ~$1175
    let tokenA = 'C02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'; // weth address on mainnet
    let tokenB = 'A0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'; // usdc address
    let poolFee = '0001F4'; // 500 in decimal - corresponds to uni pool fee 0.05%

    let inputTerms =
      '0x' + secondsAgo + tickSign + unisignedTickThreshold + tokenA + tokenB + poolFee;

    const _delegation = generateDelegation(CONTACT_NAME, ERC20Delegatable, PK, wallet1.address, [
      {
        enforcer: DistrictUniswapV3TwapAboveEnforcer.address,
        terms: inputTerms,
      },
    ]);
    const INVOCATION_MESSAGE = {
      replayProtection: {
        nonce: '0x01',
        queue: '0x00',
      },
      batch: [
        {
          authority: [_delegation],
          transaction: {
            to: ERC20Delegatable.address,
            gasLimit: '210000000000000000',
            data: (
              await ERC20Delegatable.populateTransaction.transfer(
                wallet1.address,
                ethers.utils.parseEther('0.5'),
              )
            ).data,
          },
        },
      ],
    };
    const invocation = delegatableUtils.signInvocation(INVOCATION_MESSAGE, pk1);

    await mockOracle.mock.getPoolArithmeticMeanTick.returns(0);

    await ERC20Delegatable.invoke([
      {
        signature: invocation.signature,
        invocations: invocation.invocations,
      },
    ]);
    expect(await ERC20Delegatable.balanceOf(wallet0.address)).to.eq(ethers.utils.parseEther('0.5'));
  });
  it('should FAIL to INVOKE method if tickThreshold below arithmeticMeanTick', async () => {
    const PK = wallet0._signingKey().privateKey.substring(2);
    expect(await ERC20Delegatable.balanceOf(wallet0.address)).to.eq(ethers.utils.parseEther('1'));

    let secondsAgo = '000003e8'; // is 1000 in decimal
    let tickSign = '01'; // 00 for negative, 01 for positive
    let unisignedTickThreshold = '032337'; // is 205623 in decimal, which corresponds to price ~$1175
    let tokenA = 'C02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'; // weth address on mainnet
    let tokenB = 'A0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'; // usdc address
    let poolFee = '0001F4'; // 500 in decimal - corresponds to uni pool fee 0.05%

    let inputTerms =
      '0x' + secondsAgo + tickSign + unisignedTickThreshold + tokenA + tokenB + poolFee;

    const _delegation = generateDelegation(CONTACT_NAME, ERC20Delegatable, PK, wallet1.address, [
      {
        enforcer: DistrictUniswapV3TwapAboveEnforcer.address,
        terms: inputTerms,
      },
    ]);
    const INVOCATION_MESSAGE = {
      replayProtection: {
        nonce: '0x01',
        queue: '0x00',
      },
      batch: [
        {
          authority: [_delegation],
          transaction: {
            to: ERC20Delegatable.address,
            gasLimit: '210000000000000000',
            data: (
              await ERC20Delegatable.populateTransaction.transfer(
                wallet1.address,
                ethers.utils.parseEther('0.5'),
              )
            ).data,
          },
        },
      ],
    };
    const invocation = delegatableUtils.signInvocation(INVOCATION_MESSAGE, pk1);

    await mockOracle.mock.getPoolArithmeticMeanTick.returns(1000000);

    await expect(
      ERC20Delegatable.invoke([
        {
          signature: invocation.signature,
          invocations: invocation.invocations,
        },
      ]),
    ).to.be.revertedWith('DistrictUniswapV3TwapAboveEnforcer:tickThreshold <= uniswapTwapTick');
  });

  it('should FAIL to INVOKE method if wrong tickSign (not 0, or 1) provided', async () => {
    const PK = wallet0._signingKey().privateKey.substring(2);
    expect(await ERC20Delegatable.balanceOf(wallet0.address)).to.eq(ethers.utils.parseEther('1'));

    let secondsAgo = '000003e8'; // is 1000 in decimal
    let tickSign = '10'; // 00 for negative, 01 for positive, all else revert
    let unisignedTickThreshold = '032337'; // is 205623 in decimal, which corresponds to price ~$1175
    let tokenA = 'C02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'; // weth address on mainnet
    let tokenB = 'A0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'; // usdc address
    let poolFee = '0001F4'; // 500 in decimal - corresponds to uni pool fee 0.05%

    let inputTerms =
      '0x' + secondsAgo + tickSign + unisignedTickThreshold + tokenA + tokenB + poolFee;

    const _delegation = generateDelegation(CONTACT_NAME, ERC20Delegatable, PK, wallet1.address, [
      {
        enforcer: DistrictUniswapV3TwapAboveEnforcer.address,
        terms: inputTerms,
      },
    ]);
    const INVOCATION_MESSAGE = {
      replayProtection: {
        nonce: '0x01',
        queue: '0x00',
      },
      batch: [
        {
          authority: [_delegation],
          transaction: {
            to: ERC20Delegatable.address,
            gasLimit: '210000000000000000',
            data: (
              await ERC20Delegatable.populateTransaction.transfer(
                wallet1.address,
                ethers.utils.parseEther('0.5'),
              )
            ).data,
          },
        },
      ],
    };
    const invocation = delegatableUtils.signInvocation(INVOCATION_MESSAGE, pk1);

    await mockOracle.mock.getPoolArithmeticMeanTick.returns(1000000);

    await expect(
      ERC20Delegatable.invoke([
        {
          signature: invocation.signature,
          invocations: invocation.invocations,
        },
      ]),
    ).to.be.revertedWith(
      'DistrictUniswapV3TwapAboveEnforcer:tickSign MUST be 0 (negative), or 1 (positive)',
    );
  });
});

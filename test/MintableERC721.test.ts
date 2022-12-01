import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { Contract, ContractFactory } from 'ethers';
import { ethers } from 'hardhat';

const { getSigners, utils } = ethers;
const { parseEther: toWei } = utils;

describe('MintableERC721', () => {
  let wallet0: SignerWithAddress;
  let wallet1: SignerWithAddress;
  let wallet2: SignerWithAddress;
  let MintableERC721: Contract;
  let MintableERC721Factory: ContractFactory;

  before(async () => {
    [wallet0, wallet1, wallet2] = await getSigners();
    MintableERC721Factory = await ethers.getContractFactory('MintableERC721');
  });

  beforeEach(async () => {
    MintableERC721 = await MintableERC721Factory.deploy('Collectable', 'NFT');
  });

  describe('mint(address to, uint256 amount)', () => {
    it('should SUCCEED to mint NFT #1', async () => {
      await MintableERC721.mint(wallet0.address, 1);
      expect(await MintableERC721.ownerOf(1)).to.be.equal(wallet0.address);
    });
  });
});

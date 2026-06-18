import { expect } from "chai";
import { ethers } from "hardhat";

describe("PhaseCampaignRegistry", function () {
  async function deployFixture() {
    const [creator, observer, airdrop, token] = await ethers.getSigners();
    const registry = (await ethers.deployContract("PhaseCampaignRegistry")) as any;
    const now = Math.floor(Date.now() / 1000);
    const campaignId = ethers.keccak256(ethers.toUtf8Bytes("campaign"));

    return {
      registry,
      creator,
      observer,
      airdrop,
      token,
      now,
      campaignId,
    };
  }

  it("registers only public metadata", async function () {
    const { registry, creator, airdrop, token, now, campaignId } = await deployFixture();

    await expect(
      registry.registerCampaign(
        campaignId,
        airdrop.address,
        token.address,
        now + 60,
        now + 86400,
        1000,
        "ipfs://phase/campaign",
      ),
    )
      .to.emit(registry, "CampaignRegistered")
      .withArgs(
        campaignId,
        creator.address,
        airdrop.address,
        token.address,
        now + 60,
        now + 86400,
        1000,
        "ipfs://phase/campaign",
      );

    const campaign = await registry.getCampaign(campaignId);
    expect(campaign.creator).to.equal(creator.address);
    expect(campaign.recipientCount).to.equal(1000);
    expect(campaign.claimCount).to.equal(0);
    expect(campaign.metadataURI).to.equal("ipfs://phase/campaign");
  });

  it("rejects invalid windows and empty recipient counts", async function () {
    const { registry, airdrop, token, now, campaignId } = await deployFixture();

    await expect(
      registry.registerCampaign(campaignId, airdrop.address, token.address, now + 2, now + 1, 100, ""),
    ).to.be.revertedWithCustomError(registry, "InvalidWindow");

    await expect(
      registry.registerCampaign(campaignId, airdrop.address, token.address, now + 1, now + 2, 0, ""),
    ).to.be.revertedWithCustomError(registry, "InvalidRecipientCount");
  });

  it("records claim proofs without storing amounts", async function () {
    const { registry, creator, observer, airdrop, token, now, campaignId } = await deployFixture();
    const claimProof = ethers.keccak256(ethers.toUtf8Bytes("claim:0x1111"));

    await registry.registerCampaign(
      campaignId,
      airdrop.address,
      token.address,
      now + 60,
      now + 86400,
      1000,
      "ipfs://phase/campaign",
    );

    await expect(registry.connect(observer).recordClaim(campaignId, claimProof)).to.be.revertedWithCustomError(
      registry,
      "NotCampaignOperator",
    );

    await expect(registry.connect(creator).recordClaim(campaignId, claimProof))
      .to.emit(registry, "ClaimObserved")
      .withArgs(campaignId, claimProof, 1);

    await expect(registry.connect(airdrop).recordClaim(campaignId, claimProof)).to.be.revertedWithCustomError(
      registry,
      "ClaimProofUsed",
    );
  });
});

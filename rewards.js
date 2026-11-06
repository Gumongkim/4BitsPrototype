// 보상 추첨과 적용. 보상 데이터는 CONFIG.REWARDS에 있다.

const Rewards = {
  clampStat(stat, value) {
    const limit = CONFIG.STAT_LIMITS[stat] || {};
    if (limit.min !== undefined) value = Math.max(limit.min, value);
    if (limit.max !== undefined) value = Math.min(limit.max, value);
    return Math.round(value * 1000) / 1000;
  },

  // 수치가 이미 한계에 닿아 효과가 없는 보상은 나오지 않는다.
  isUseful(reward, stats) {
    return reward.effects.some((e) => this.clampStat(e.stat, stats[e.stat] + e.add) !== stats[e.stat]);
  },

  // Perfect 비율(0~1)에 따른 등급별 가중치
  rarityWeights(ratio) {
    const weights = {};
    for (const [rarity, w] of Object.entries(CONFIG.RARITY_WEIGHTS)) {
      weights[rarity] = w.low + (w.high - w.low) * ratio;
    }
    return weights;
  },

  // 남은 후보 중 등급을 먼저 뽑고, 그 등급 안에서 한 장을 뽑는다.
  drawOne(pool, ratio) {
    const weights = this.rarityWeights(ratio);
    const rarities = Object.keys(weights).filter((r) => pool.some((c) => c.rarity === r));
    let roll = Math.random() * rarities.reduce((sum, r) => sum + weights[r], 0);
    let chosen = rarities[rarities.length - 1];
    for (const rarity of rarities) {
      roll -= weights[rarity];
      if (roll < 0) {
        chosen = rarity;
        break;
      }
    }
    return pickRandom(pool.filter((c) => c.rarity === chosen));
  },

  // 무기 교체 카드. 카드에는 무기 데이터로 범위 그림과 리듬 막대를 그린다.
  weaponCard(kind) {
    const weapon = CONFIG.WEAPONS[kind];
    return {
      id: `weapon_${kind}`,
      name: weapon.name,
      desc: '',
      rarity: 'weapon',
      weapon: kind,
      effects: [],
    };
  },

  // 지금 웨이브까지 열린 티어 중 Perfect 비율에 따른 가중치로 티어를 뽑고, 그 티어에서 지금 무기가 아닌 것 하나를 고른다.
  drawWeaponKind(ratio, wave, currentKind) {
    const kinds = Object.keys(CONFIG.WEAPONS).filter((kind) => kind !== currentKind);
    const tiers = Object.keys(CONFIG.WEAPON_TIER_WEIGHTS).map(Number)
      .filter((tier) => wave >= CONFIG.WEAPON_TIER_UNLOCK_WAVE[tier])
      .filter((tier) => kinds.some((kind) => CONFIG.WEAPONS[kind].tier === tier));
    const weightOf = (tier) => {
      const w = CONFIG.WEAPON_TIER_WEIGHTS[tier];
      return w.low + (w.high - w.low) * ratio;
    };
    let roll = Math.random() * tiers.reduce((sum, tier) => sum + weightOf(tier), 0);
    let chosen = tiers[tiers.length - 1];
    for (const tier of tiers) {
      roll -= weightOf(tier);
      if (roll < 0) {
        chosen = tier;
        break;
      }
    }
    return pickRandom(kinds.filter((kind) => CONFIG.WEAPONS[kind].tier === chosen));
  },

  draw(ratio, player, wave) {
    const pool = CONFIG.REWARDS.filter((r) => this.isUseful(r, player.stats));
    const cards = [];
    while (cards.length < CONFIG.REWARD_CARD_COUNT && pool.length) {
      const card = this.drawOne(pool, ratio);
      cards.push(card);
      pool.splice(pool.indexOf(card), 1);
    }
    if (Math.random() < CONFIG.WEAPON_CARD_CHANCE) {
      const kind = this.drawWeaponKind(ratio, wave, player.weaponKind);
      cards[Math.min(cards.length, CONFIG.REWARD_CARD_COUNT - 1)] = this.weaponCard(kind);
    }
    return cards;
  },

  apply(reward, player) {
    if (reward.weapon) player.setWeapon(reward.weapon);
    for (const effect of reward.effects) {
      player.stats[effect.stat] = this.clampStat(effect.stat, player.stats[effect.stat] + effect.add);
    }
    if (reward.heal) player.hp = Math.min(player.stats.maxHp, player.hp + reward.heal);
  },
};

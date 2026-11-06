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

  // 무기 교체 카드. 내용은 무기 데이터에서 만든다.
  weaponCard(kind) {
    const weapon = CONFIG.WEAPONS[kind];
    return {
      id: `weapon_${kind}`,
      name: weapon.name,
      desc: `리듬 ${weapon.intervals.join(' ')}\n${weaponDamageText(weapon)}\n${weapon.rangeDesc}`,
      rarity: 'weapon',
      weapon: kind,
      effects: [],
    };
  },

  draw(ratio, player) {
    const pool = CONFIG.REWARDS.filter((r) => this.isUseful(r, player.stats));
    const cards = [];
    while (cards.length < CONFIG.REWARD_CARD_COUNT && pool.length) {
      const card = this.drawOne(pool, ratio);
      cards.push(card);
      pool.splice(pool.indexOf(card), 1);
    }
    if (Math.random() < CONFIG.WEAPON_CARD_CHANCE) {
      const others = Object.keys(CONFIG.WEAPONS).filter((kind) => kind !== player.weaponKind);
      cards[Math.min(cards.length, CONFIG.REWARD_CARD_COUNT - 1)] = this.weaponCard(pickRandom(others));
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

// 보상 추첨과 적용. 지금 보상은 무기 교체뿐이다.
// 웨이브를 클리어하면 무기 카드 REWARD_WEAPON_CARDS장과 '지금 무기 유지' 카드가 나온다.
// 능력치 효과(effects, heal)를 적용하는 코드는 능력치 유물이 생기면 쓰려고 남겨 두었다.
// 유물 보상은 relics.js에 있다.

const Rewards = {
  clampStat(stat, value) {
    const limit = CONFIG.STAT_LIMITS[stat] || {};
    if (limit.min !== undefined) value = Math.max(limit.min, value);
    if (limit.max !== undefined) value = Math.min(limit.max, value);
    return Math.round(value * 1000) / 1000;
  },

  // 수치가 이미 한계에 닿아 효과가 없는지. effects = [{ stat, add }, ...]
  isUseful(reward, stats) {
    return reward.effects.some((e) => this.clampStat(e.stat, stats[e.stat] + e.add) !== stats[e.stat]);
  },

  // 무기 교체 카드. 카드에는 무기 데이터로 범위 그림과 리듬 막대를 그린다.
  weaponCard(kind) {
    return { id: `weapon_${kind}`, name: CONFIG.WEAPONS[kind].name, weapon: kind, effects: [] };
  },

  // 지금 무기를 그대로 쓰는 카드
  keepCard(kind) {
    return { id: 'keep', name: CONFIG.WEAPONS[kind].name, keep: kind, effects: [] };
  },

  // 지금 웨이브까지 열린 티어 중 고정 가중치로 티어를 뽑고, 그 티어에서 excluded에 없는 무기 하나를 고른다.
  // 고를 무기가 없으면 null이다.
  drawWeaponKind(wave, excluded) {
    const kinds = Object.keys(CONFIG.WEAPONS).filter((kind) => !excluded.includes(kind));
    const tiers = Object.keys(CONFIG.WEAPON_TIER_WEIGHTS).map(Number)
      .filter((tier) => wave >= CONFIG.WEAPON_TIER_UNLOCK_WAVE[tier])
      .filter((tier) => kinds.some((kind) => CONFIG.WEAPONS[kind].tier === tier));
    if (!tiers.length) return null;
    const weightOf = (tier) => CONFIG.WEAPON_TIER_WEIGHTS[tier];
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

  // 서로 다르고 무기 슬롯에 없는 무기 카드들, 맨 끝에 유지 카드
  draw(player, wave) {
    const excluded = [...player.weapons];
    const cards = [];
    while (cards.length < CONFIG.REWARD_WEAPON_CARDS) {
      const kind = this.drawWeaponKind(wave, excluded);
      if (!kind) break;
      excluded.push(kind);
      cards.push(this.weaponCard(kind));
    }
    cards.push(this.keepCard(player.weaponKind));
    return cards;
  },

  // 능력치 효과와 회복을 적용한다. 무기 카드를 슬롯에 넣는 일은 game.selectReward가 한다.
  apply(reward, player) {
    for (const effect of reward.effects || []) {
      player.stats[effect.stat] = this.clampStat(effect.stat, player.stats[effect.stat] + effect.add);
    }
    if (reward.heal) player.hp = Math.min(player.stats.maxHp, player.hp + reward.heal);
  },
};

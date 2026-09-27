<template>
  <article class="reward-card card" :class="[`rarity-${reward.rarity}`, { redeemed: status.redeemed, locked: !status.unlocked }]">
    <div class="rc-head">
      <span class="rc-icon">{{ reward.icon || '🎁' }}</span>
      <div class="rc-title-box">
        <div class="row gap6 wrap">
          <h3 class="rc-name">{{ reward.name }}</h3>
          <span class="rarity-tag" :style="{ color: rarity.color, borderColor: rarity.color }">{{ rarity.label }}</span>
        </div>
        <p v-if="reward.desc" class="rc-desc muted">{{ reward.desc }}</p>
      </div>
      <span class="rc-state" :class="stateClass">{{ stateText }}</span>
    </div>

    <div v-if="reward.previewImage" class="rc-preview">
      <img :src="reward.previewImage" :alt="`${reward.name} 预览`" />
    </div>
    <p v-if="reward.previewNote" class="rc-note muted">{{ reward.previewNote }}</p>

    <div class="rc-cond">
      <div class="row-between cond-line">
        <span class="cond-text">{{ status.conditionText }}</span>
        <span class="muted cond-num">{{ progress.current }}{{ progress.unit }} / {{ progress.target }}{{ progress.unit }}</span>
      </div>
      <ProgressBar :value="pct" />
      <p v-if="status.period.text" class="muted mini period">{{ status.period.text }}</p>
      <button
        v-if="reward.conditionType === 'custom' && !progress.met"
        type="button"
        class="link-btn"
        @click="$emit('toggle-met', reward)"
      >
        手动标记为已达成
      </button>
    </div>

    <div class="rc-foot">
      <span class="cost"><b>{{ reward.cost }}</b> 金币</span>
      <span v-if="status.reason" class="reason">{{ status.reason }}</span>
      <div class="row gap6 acts">
        <button type="button" class="mini-btn" title="编辑" @click="$emit('edit', reward)">
          <Icon name="edit" :size="14" />
        </button>
        <button type="button" class="mini-btn danger" title="删除" @click="$emit('remove', reward)">
          <Icon name="trash" :size="14" />
        </button>
        <button type="button" class="btn btn-sm" :class="canRedeem ? 'btn-primary' : 'btn-outline'" :disabled="!canRedeem" @click="$emit('redeem', reward)">
          {{ redeemText }}
        </button>
      </div>
    </div>
  </article>
</template>

<script setup>
import { computed } from 'vue'
import ProgressBar from '../ui/ProgressBar.vue'
import Icon from '../ui/Icon.vue'
import { store } from '../../store.js'
import { rewardStatus } from '../../selectors.js'
import { rarityMeta } from '../../rewardMeta.js'

const props = defineProps({
  reward: { type: Object, required: true },
})
defineEmits(['redeem', 'edit', 'remove', 'toggle-met'])

const status = computed(() => rewardStatus(store.state, props.reward, Date.now()))
const rarity = computed(() => rarityMeta(props.reward.rarity))
const progress = computed(() => status.value.progress)
const pct = computed(() => {
  const { current, target } = progress.value
  if (!target) return progress.value.met ? 100 : 0
  return Math.max(0, Math.min(100, Math.round((current / target) * 100)))
})

const canRedeem = computed(() => status.value.unlocked && status.value.affordable)

const stateText = computed(() => {
  if (status.value.redeemed) return '已兑换'
  if (!status.value.period.ok) return '未到时间'
  if (!progress.value.met) return '未解锁'
  if (!status.value.affordable) return '金币不足'
  return '可兑换'
})

const stateClass = computed(() => ({
  ok: canRedeem.value,
  warn: !status.value.redeemed && status.value.unlocked && !status.value.affordable,
  done: status.value.redeemed,
}))

const redeemText = computed(() => {
  if (status.value.redeemed) return '已兑换'
  if (!status.value.period.ok) return '未到时间'
  if (!progress.value.met) return '未解锁'
  if (!status.value.affordable) return '金币不足'
  return '兑换'
})
</script>

<style scoped>
.reward-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 13px 14px;
  border-left: 3px solid var(--line);
}

.reward-card.rarity-common {
  border-left-color: #64748b;
}

.reward-card.rarity-rare {
  border-left-color: #3b82f6;
}

.reward-card.rarity-epic {
  border-left-color: #7c3aed;
}

.reward-card.rarity-legend {
  border-left-color: #e8a33d;
}

.reward-card.redeemed {
  opacity: 0.68;
}

.rc-head {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.rc-icon {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  font-size: 20px;
  background: color-mix(in srgb, var(--line) 45%, transparent);
  flex: none;
}

.rc-title-box {
  flex: 1;
  min-width: 0;
}

.rc-name {
  margin: 0;
  font-size: 15px;
  font-weight: 800;
}

.rarity-tag {
  font-size: 10.5px;
  font-weight: 800;
  border: 1px solid currentColor;
  border-radius: 999px;
  padding: 0 7px;
  flex: none;
}

.rc-desc {
  margin: 3px 0 0;
  font-size: 12.5px;
  line-height: 1.45;
}

.rc-state {
  font-size: 11px;
  font-weight: 800;
  border-radius: 999px;
  padding: 2px 9px;
  flex: none;
  color: var(--muted);
  background: color-mix(in srgb, var(--line) 50%, transparent);
}

.rc-state.ok {
  color: #fff;
  background: var(--primary-deep);
}

.rc-state.warn {
  color: var(--warn);
  background: color-mix(in srgb, var(--warn) 15%, transparent);
}

.rc-state.done {
  color: var(--accent-deep);
  background: color-mix(in srgb, var(--accent) 15%, transparent);
}

.rc-preview {
  border-radius: 12px;
  overflow: hidden;
  max-height: 150px;
}

.rc-preview img {
  width: 100%;
  height: 100%;
  max-height: 150px;
  object-fit: cover;
  display: block;
}

.rc-note {
  margin: 0;
  font-size: 12px;
}

.rc-cond {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.cond-line {
  align-items: baseline;
}

.cond-text {
  font-size: 12.5px;
  font-weight: 600;
}

.cond-num {
  font-size: 11.5px;
}

.mini {
  font-size: 11.5px;
  margin: 0;
}

.link-btn {
  align-self: flex-start;
  color: var(--accent-deep);
  font-weight: 700;
  font-size: 12px;
  text-decoration: underline;
}

.rc-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  border-top: 1px dashed var(--line);
  padding-top: 9px;
}

.cost {
  font-size: 13px;
}

.cost b {
  font-size: 15px;
  color: var(--accent-deep);
}

.reason {
  flex: 1;
  min-width: 0;
  font-size: 11.5px;
  color: var(--warn);
}

.acts {
  margin-left: auto;
}

.mini-btn {
  width: 30px;
  height: 30px;
  border-radius: 9px;
  display: grid;
  place-items: center;
  color: var(--text-dim);
  border: 1px solid var(--line);
}

.mini-btn.danger {
  color: var(--danger, #dc2626);
}
</style>

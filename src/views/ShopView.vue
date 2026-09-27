<template>
  <div class="shop-view">
    <section ref="walletEl" class="card wallet">
      <div class="row-between wallet-top">
        <div class="row gap8">
          <span class="coin-icon"><Icon name="sparkles" :size="18" /></span>
          <div class="coin-box">
            <span class="coin-num">{{ balance }}</span>
            <span class="muted coin-unit">金币可用</span>
          </div>
        </div>
        <button type="button" class="btn btn-primary btn-sm" @click="openCreate">
          <Icon name="plus" :size="14" /> 新增奖励
        </button>
      </div>
      <p class="muted wallet-sub">
        累计产出 {{ income.coins }} 金币 = 专注 {{ income.focusMin }} 分钟 × {{ income.rate.coinPerFocusMin }}
        + 完成任务 {{ income.todoCount }} 个 × {{ income.rate.coinPerTodo }}
        <template v-if="spent">，已兑换消耗 {{ spent }} 金币</template>
      </p>
      <SegControl :model-value="tab" :options="tabOptions" @update:model-value="tab = $event" />
    </section>

    <div v-if="visible.length" class="reward-list">
      <RewardCard
        v-for="r in visible"
        :key="r.id"
        :reward="r"
        @redeem="onRedeem"
        @edit="openEdit"
        @remove="onRemove"
        @toggle-met="onToggleMet"
      />
    </div>
    <EmptyState v-else icon="sparkles" :text="emptyText" hint="先给自己定一个值得期待的奖励吧" />

    <RewardFormModal :open="formOpen" :reward="editing" @close="closeForm" />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import SegControl from '../components/ui/SegControl.vue'
import EmptyState from '../components/ui/EmptyState.vue'
import Icon from '../components/ui/Icon.vue'
import RewardCard from '../components/reward/RewardCard.vue'
import RewardFormModal from '../components/reward/RewardFormModal.vue'
import { store } from '../store.js'
import { shopBalance, shopIncome, shopSpent, rewardStatus } from '../selectors.js'
import { askConfirm, showToast, fireConfetti } from '../ui.js'

const tab = ref('all')
const formOpen = ref(false)
const editing = ref(null)
const walletEl = ref(null)

const statusOf = (r) => rewardStatus(store.state, r, Date.now())

const income = computed(() => shopIncome(store.state))
const spent = computed(() => shopSpent(store.state))
const balance = computed(() => shopBalance(store.state))

const rewards = computed(() => store.state.rewards || [])
const available = computed(() => rewards.value.filter((r) => statusOf(r).unlocked && statusOf(r).affordable))
const locked = computed(() => rewards.value.filter((r) => !statusOf(r).redeemed && !(statusOf(r).unlocked && statusOf(r).affordable)))
const redeemedList = computed(() => rewards.value.filter((r) => statusOf(r).redeemed))

const tabOptions = computed(() => [
  { label: `全部（${rewards.value.length}）`, value: 'all' },
  { label: `可兑换（${available.value.length}）`, value: 'available' },
  { label: `未解锁（${locked.value.length}）`, value: 'locked' },
  { label: `已兑换（${redeemedList.value.length}）`, value: 'redeemed' },
])

const visible = computed(() => {
  if (tab.value === 'available') return available.value
  if (tab.value === 'locked') return locked.value
  if (tab.value === 'redeemed') return redeemedList.value
  return [...rewards.value].sort((a, b) => (a.redeemed ? 1 : 0) - (b.redeemed ? 1 : 0) || (a.order || 0) - (b.order || 0))
})

const emptyText = computed(() => {
  if (rewards.value.length === 0) return '还没有兑换奖励'
  if (tab.value === 'available') return '暂时没有可兑换的奖励'
  if (tab.value === 'locked') return '没有未解锁的奖励'
  if (tab.value === 'redeemed') return '还没有兑换过奖励'
  return '还没有兑换奖励'
})

function openCreate() {
  editing.value = null
  formOpen.value = true
}
function openEdit(r) {
  editing.value = r
  formOpen.value = true
}
function closeForm() {
  formOpen.value = false
  editing.value = null
}

function onRedeem(r) {
  const res = store.redeemReward(r.id)
  if (!res.ok) {
    showToast(res.text, 'err')
    return
  }
  showToast(`已兑换「${r.name}」，花费 ${res.cost} 金币`)
  fireConfetti(walletEl.value)
}

function onToggleMet(r) {
  store.setRewardCustomMet(r.id, !r.customMet)
}

async function onRemove(r) {
  const ok = await askConfirm({
    title: '删除奖励',
    message: `确定删除「${r.name}」吗？`,
    detail: '删除后该奖励的解锁条件与记录都会移除。',
    danger: true,
  })
  if (!ok) return
  store.deleteReward(r.id)
  showToast('奖励已删除')
}
</script>

<style scoped>
.shop-view {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.wallet {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.wallet-top {
  align-items: center;
}

.coin-icon {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, var(--primary-deep), var(--accent));
  color: #fff;
  flex: none;
}

.coin-box {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.coin-num {
  font-size: 24px;
  font-weight: 800;
  color: var(--accent-deep);
}

.coin-unit {
  font-size: 12px;
}

.wallet-sub {
  margin: 0;
  font-size: 11.5px;
  line-height: 1.5;
}

.reward-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>

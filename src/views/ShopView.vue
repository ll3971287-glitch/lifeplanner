<template>
  <div class="shop-view">
    <section ref="walletEl" class="card wallet">
      <div class="row-between wallet-top">
        <div class="row gap8">
          <span class="coin-icon"><Icon name="sparkles" :size="18" /></span>
          <div class="coin-box">
            <span class="coin-num" :class="{ owe: balance < 0 }">{{ balance }}</span>
            <span class="muted coin-unit">{{ balance < 0 ? '金币（欠）' : '金币可用' }}</span>
          </div>
        </div>
        <button type="button" class="btn btn-primary btn-sm" @click="openCreate">
          <Icon name="plus" :size="14" /> 新增奖励
        </button>
      </div>
      <p class="muted wallet-sub">
        累计产出 {{ income.coins }} 金币 = 专注 {{ income.focusMin }} 分钟 × {{ income.rate.coinPerFocusMin }}
        + 完成任务 {{ income.todoCount }} 个 × {{ income.rate.coinPerTodo }}
        + 打卡 {{ income.checkinCount }} 次 × {{ income.rate.coinPerCheckin }}
        + 打卡专注 {{ income.checkinFocusMin }} 分钟 × {{ income.rate.coinPerFocusMin }}
        + 复盘 {{ income.reviewCount }} 次 × {{ income.rate.coinPerReview }}
        <template v-if="spent">，已兑换消耗 {{ spent }} 金币</template>
      </p>
      <p class="wallet-budget">
        <Icon name="tag" :size="13" />
        预估预算合计 <b>{{ moneyText(budgetTotal) }}</b>
        <span class="muted">（奖励 {{ moneyText(rewardBudgetTotal) }} + 其他 {{ moneyText(otherBudgetTotal) }}，仅记录展示）</span>
      </p>
      <SegControl :model-value="tab" :options="tabOptions" @update:model-value="tab = $event" />
    </section>

    <!-- 其他预算：与奖励分开单独一栏，金额计入顶部总预算 -->
    <section class="card other-budget">
      <div class="row-between ob-head">
        <span class="ob-title"><Icon name="layers" :size="15" /> 其他预算</span>
        <div class="row gap8 ob-actions">
          <span class="ob-total muted">小计 {{ moneyText(otherBudgetTotal) }}</span>
          <button type="button" class="btn btn-outline btn-sm" @click="openOtherCreate">
            <Icon name="plus" :size="13" /> 新增
          </button>
        </div>
      </div>

      <div v-if="otherBudgets.length" class="ob-list">
        <div v-for="o in otherBudgets" :key="o.id" class="ob-row">
          <div class="ob-main">
            <span class="ob-name">{{ o.name }}</span>
            <span class="ob-sub muted">
              <template v-if="timeHintLabel(o.timeHint)">大致时间：{{ timeHintLabel(o.timeHint) }}</template>
              <template v-if="o.note">{{ timeHintLabel(o.timeHint) ? ' · ' : '' }}{{ o.note }}</template>
            </span>
          </div>
          <span class="ob-amount">{{ moneyText(o.amount) }}</span>
          <button type="button" class="mini-btn" title="编辑" @click="openOtherEdit(o)">
            <Icon name="edit" :size="13" />
          </button>
          <button type="button" class="mini-btn danger" title="删除" @click="onRemoveOther(o)">
            <Icon name="trash" :size="13" />
          </button>
        </div>
      </div>
      <p v-else class="muted ob-empty">还没有其他预算，点「新增」记录房租、通勤等不绑定奖励的支出。</p>
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
    <OtherBudgetModal :open="otherFormOpen" :item="editingOther" @close="closeOtherForm" />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import SegControl from '../components/ui/SegControl.vue'
import EmptyState from '../components/ui/EmptyState.vue'
import Icon from '../components/ui/Icon.vue'
import RewardCard from '../components/reward/RewardCard.vue'
import RewardFormModal from '../components/reward/RewardFormModal.vue'
import OtherBudgetModal from '../components/reward/OtherBudgetModal.vue'
import { store } from '../store.js'
import {
  shopBalance,
  shopIncome,
  shopSpent,
  shopRewardBudgetTotal,
  shopOtherBudgetTotal,
  shopBudgetTotal,
  rewardStatus,
} from '../selectors.js'
import { moneyText, timeHintLabel } from '../rewardMeta.js'
import { askConfirm, showToast, fireConfetti } from '../ui.js'

const tab = ref('all')
const formOpen = ref(false)
const editing = ref(null)
const walletEl = ref(null)
const otherFormOpen = ref(false)
const editingOther = ref(null)

const statusOf = (r) => rewardStatus(store.state, r, Date.now())

const income = computed(() => shopIncome(store.state))
const spent = computed(() => shopSpent(store.state))
const balance = computed(() => shopBalance(store.state))
const budgetTotal = computed(() => shopBudgetTotal(store.state))
const rewardBudgetTotal = computed(() => shopRewardBudgetTotal(store.state))
const otherBudgetTotal = computed(() => shopOtherBudgetTotal(store.state))
const otherBudgets = computed(() => store.state.otherBudgets || [])

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

function openOtherCreate() {
  editingOther.value = null
  otherFormOpen.value = true
}
function openOtherEdit(o) {
  editingOther.value = o
  otherFormOpen.value = true
}
function closeOtherForm() {
  otherFormOpen.value = false
  editingOther.value = null
}

async function onRemoveOther(o) {
  const ok = await askConfirm({
    title: '删除其他预算',
    message: `确定删除「${o.name}」吗？`,
    danger: true,
  })
  if (!ok) return
  store.deleteOtherBudget(o.id)
  showToast('已删除')
}

function onRedeem(r) {
  const res = store.redeemReward(r.id)
  if (!res.ok) {
    showToast(res.text, 'err')
    return
  }
  showToast(res.debt > 0 ? `已兑换「${r.name}」，花费 ${res.cost} 金币（欠 ${res.debt}）` : `已兑换「${r.name}」，花费 ${res.cost} 金币`)
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

.coin-num.owe {
  color: var(--warn);
}

.coin-unit {
  font-size: 12px;
}

.wallet-sub {
  margin: 0;
  font-size: 11.5px;
  line-height: 1.5;
}

.wallet-budget {
  display: flex;
  align-items: center;
  gap: 5px;
  margin: 0;
  font-size: 12.5px;
  color: var(--text-dim);
}

.wallet-budget b {
  font-size: 15px;
  color: var(--accent-deep);
}

.reward-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.other-budget {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ob-head {
  align-items: center;
  gap: 8px;
}

.ob-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 800;
}

.ob-actions {
  flex-wrap: wrap;
  justify-content: flex-end;
}

.ob-total {
  font-size: 12px;
}

.ob-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ob-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--line) 28%, transparent);
}

.ob-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.ob-name {
  font-size: 13.5px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ob-sub {
  font-size: 11.5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ob-amount {
  font-size: 13.5px;
  font-weight: 800;
  color: var(--accent-deep);
  flex: none;
}

.mini-btn {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  color: var(--text-dim);
  border: 1px solid var(--line);
  flex: none;
}

.mini-btn.danger {
  color: var(--danger, #dc2626);
}

.ob-empty {
  margin: 0;
  font-size: 12px;
}
</style>

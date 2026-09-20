import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from './views/HomeView.vue'
import TodosView from './views/TodosView.vue'
import ProjectsView from './views/ProjectsView.vue'
import ProjectDetailView from './views/ProjectDetailView.vue'
import CalendarView from './views/CalendarView.vue'
import CheckinsView from './views/CheckinsView.vue'
import CheckinDetailView from './views/CheckinDetailView.vue'
import FocusView from './views/FocusView.vue'
import TagsView from './views/TagsView.vue'
import TagDetailView from './views/TagDetailView.vue'
import ReviewsView from './views/ReviewsView.vue'
import BlueprintsView from './views/BlueprintsView.vue'
import RelationsView from './views/RelationsView.vue'
import GoalsView from './views/GoalsView.vue'
import MediaView from './views/MediaView.vue'
import FoodView from './views/FoodView.vue'
import SettingsView from './views/SettingsView.vue'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView, meta: { title: '首页' } },
    { path: '/todos', name: 'todos', component: TodosView, meta: { title: '待办' } },
    { path: '/projects', name: 'projects', component: ProjectsView, meta: { title: '项目' } },
    { path: '/projects/:id', name: 'project-detail', component: ProjectDetailView, meta: { title: '项目详情' } },
    { path: '/calendar', name: 'calendar', component: CalendarView, meta: { title: '日历' } },
    { path: '/checkins', name: 'checkins', component: CheckinsView, meta: { title: '打卡' } },
    { path: '/checkins/:id', name: 'checkin-detail', component: CheckinDetailView, meta: { title: '打卡详情' } },
    { path: '/focus', name: 'focus', component: FocusView, meta: { title: '专注' } },
    { path: '/tags', name: 'tags', component: TagsView, meta: { title: '标签' } },
    { path: '/tags/:id', name: 'tag-detail', component: TagDetailView, meta: { title: '标签详情' } },
    { path: '/reviews', name: 'reviews', component: ReviewsView, meta: { title: '复盘' } },
    { path: '/blueprints', name: 'blueprints', component: BlueprintsView, meta: { title: '未来蓝图' } },
    { path: '/relations', name: 'relations', component: RelationsView, meta: { title: '关系' } },
    { path: '/goals', name: 'goals', component: GoalsView, meta: { title: '目标' } },
    { path: '/media', name: 'media', component: MediaView, meta: { title: '书影音' } },
    { path: '/food', name: 'food', component: FoodView, meta: { title: '食物储存' } },
    { path: '/settings', name: 'settings', component: SettingsView, meta: { title: '设置' } },
  ],
  scrollBehavior() {
    return { top: 0 }
  },
})

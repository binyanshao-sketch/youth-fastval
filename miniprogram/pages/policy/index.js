// pages/policy/index.js
const app = getApp()

Page({
  data: {
    currentCategory: '',
    categories: [
      { id: 'employment', name: '就业创业' },
      { id: 'education', name: '教育培训' },
      { id: 'housing', name: '住房保障' },
      { id: 'subsidy', name: '补贴申领' },
      { id: 'other', name: '其他福利' }
    ],
    policies: [
      {
        id: 1,
        icon: '💼',
        title: '青年就业见习补贴',
        summary: '为高校毕业生提供就业见习岗位，给予见习补贴',
        tags: ['毕业生', '补贴'],
        category: 'employment'
      },
      {
        id: 2,
        icon: '🎓',
        title: '创业担保贷款',
        summary: '为创业青年提供最高20万元创业担保贷款',
        tags: ['创业', '贷款'],
        category: 'employment'
      },
      {
        id: 3,
        icon: '🏠',
        title: '青年人才公寓',
        summary: '为青年人才提供租赁住房补贴和人才公寓',
        tags: ['住房', '补贴'],
        category: 'housing'
      },
      {
        id: 4,
        icon: '📚',
        title: '技能培训补贴',
        summary: '参加职业技能培训可申请培训补贴',
        tags: ['培训', '技能'],
        category: 'education'
      },
      {
        id: 5,
        icon: '💰',
        title: '一次性吸纳就业补贴',
        summary: '招用应届毕业生可享受一次性补贴',
        tags: ['就业', '补贴'],
        category: 'subsidy'
      },
      {
        id: 6,
        icon: '🏥',
        title: '青年医疗互助计划',
        summary: '为青年提供医疗互助保障',
        tags: ['医疗', '互助'],
        category: 'other'
      }
    ]
  },

  onLoad() {
    // 可以从服务器加载政策列表
    // this.loadPolicies()
  },

  switchCategory(e) {
    const category = e.currentTarget.dataset.category
    this.setData({ currentCategory: category })
    // this.loadPolicies()
  },

  viewPolicy(e) {
    const id = e.currentTarget.dataset.id
    // 跳转到政策详情页
    wx.navigateTo({
      url: `/pages/policy/detail?id=${id}`
    })
  }
})

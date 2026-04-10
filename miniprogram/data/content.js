const activityRules = [
  '每位青年用户限领 1 次青春福袋，拆袋后红包金额随机发放。',
  '红包将通过小程序或公众号通道发放至微信零钱，请留意到账提醒。',
  '消费券和政策福利会同步进入你的权益页，可随时查看和使用。',
  '福袋开启后可继续参与抽奖，抽奖结果以页面展示内容为准。'
];

const serviceInfo = {
  phone: '08311234567',
  organizer: '共青团宜宾市委',
  technicalSupport: '戎琛网络'
};

const policyCategories = [
  { id: '', name: '全部' },
  { id: 'employment', name: '就业创业' },
  { id: 'education', name: '成长培训' },
  { id: 'housing', name: '住房安居' },
  { id: 'subsidy', name: '专项补贴' },
  { id: 'service', name: '综合服务' }
];

const policies = [
  {
    id: 'employment-001',
    category: 'employment',
    icon: '岗',
    title: '青年就业见习补贴',
    summary: '面向高校毕业生和青年求职者，按见习岗位和服务周期给予补贴支持。',
    tags: ['就业', '补贴', '见习'],
    sections: [
      { title: '适用人群', content: '离校未就业高校毕业生、登记失业青年以及重点就业群体。' },
      { title: '申请方式', content: '通过人社服务平台提交见习单位证明及个人信息后审核发放。' },
      { title: '建议动作', content: '优先联系就近青年驿站或就业服务站，获取本地岗位清单。' }
    ]
  },
  {
    id: 'employment-002',
    category: 'employment',
    icon: '创',
    title: '青年创业担保贷款',
    summary: '符合条件的创业青年可申请创业担保贷款和贴息支持，减轻创业早期压力。',
    tags: ['创业', '贷款', '贴息'],
    sections: [
      { title: '支持内容', content: '提供创业担保贷款额度、贴息政策和创业指导服务。' },
      { title: '准备材料', content: '营业执照、个人身份证明、项目计划书和征信材料。' },
      { title: '办理提醒', content: '建议先到创业服务大厅做项目咨询，再准备正式申报材料。' }
    ]
  },
  {
    id: 'education-001',
    category: 'education',
    icon: '学',
    title: '技能提升培训补贴',
    summary: '参加职业技能培训并通过评价后，可按培训项目申请补贴。',
    tags: ['培训', '技能', '认证'],
    sections: [
      { title: '补贴范围', content: '职业技能等级培训、专项能力培训、创业培训等项目。' },
      { title: '申领条件', content: '完成培训、通过考核，并在规定时间内提交申报。' },
      { title: '使用建议', content: '优先选择与本地就业岗位匹配度高的培训方向。' }
    ]
  },
  {
    id: 'housing-001',
    category: 'housing',
    icon: '住',
    title: '青年人才安居支持',
    summary: '面向来宜就业创业青年提供租房补贴、人才公寓和安居咨询服务。',
    tags: ['住房', '人才', '安居'],
    sections: [
      { title: '支持内容', content: '租房补贴、人才公寓申请、入住绿色通道。' },
      { title: '申请步骤', content: '先完成人才认定，再提交安居申请和租赁证明。' },
      { title: '配套服务', content: '部分区域可同步享受落户、就业和创业咨询服务。' }
    ]
  },
  {
    id: 'subsidy-001',
    category: 'subsidy',
    icon: '补',
    title: '一次性吸纳就业补贴',
    summary: '企业招用高校毕业生、登记失业青年并稳定就业，可申请吸纳就业补贴。',
    tags: ['企业', '吸纳', '补贴'],
    sections: [
      { title: '适用对象', content: '吸纳青年就业并缴纳社保的本地企业和市场主体。' },
      { title: '申报节点', content: '满足稳定就业时长后，在政策规定期内线上提交材料。' },
      { title: '注意事项', content: '人员信息、社保缴纳记录和合同信息需保持一致。' }
    ]
  },
  {
    id: 'service-001',
    category: 'service',
    icon: '服',
    title: '青年综合服务清单',
    summary: '整合就业、安居、培训、法律、心理咨询等青年服务入口，方便一站直达。',
    tags: ['服务', '咨询', '一站式'],
    sections: [
      { title: '服务内容', content: '就业咨询、政策答疑、法律援助、心理咨询、城市生活服务。' },
      { title: '使用方式', content: '通过青年服务窗口、小程序专区或线下活动点位咨询办理。' },
      { title: '适配场景', content: '初来宜宾、求职、创业、租房和技能成长阶段都可使用。' }
    ]
  }
];

const privacyPolicy = {
  id: 'privacy',
  title: '隐私说明',
  summary: '手机号仅用于发放微信红包、核销消费券和必要的活动联系，不做额外用途。',
  tags: ['隐私', '授权'],
  sections: [
    { title: '我们会收集什么', content: '仅收集参与活动所需的手机号、登录态和权益使用信息。' },
    { title: '为什么收集', content: '用于红包发放、消费券核销、防止重复领取和保障活动安全。' },
    { title: '如何使用', content: '仅限本次青春福袋活动使用，不会用于与你无关的商业营销。' }
  ]
};

const merchantCategories = [
  { id: '', name: '全部' },
  { id: '餐饮', name: '餐饮' },
  { id: '文旅', name: '文旅' },
  { id: '零售', name: '零售' },
  { id: '服务', name: '服务' }
];

const merchantFallbacks = [
  {
    id: 'fallback-1',
    name: '青年能量咖啡',
    category: '餐饮',
    address: '宜宾市叙州区青年路 18 号',
    distanceText: '1.2km',
    contactName: '门店客服',
    contactPhone: '08311234567',
    businessHours: '10:00 - 22:00',
    description: '主打青年社交场景的复合咖啡空间，支持消费券和青年主题活动打卡。'
  },
  {
    id: 'fallback-2',
    name: '青春文旅站',
    category: '文旅',
    address: '宜宾市翠屏区滨江广场 2 层',
    distanceText: '2.6km',
    contactName: '服务台',
    contactPhone: '08317654321',
    businessHours: '09:30 - 21:00',
    description: '聚合本地旅游、文化展览和青年打卡路线的文旅服务站。'
  },
  {
    id: 'fallback-3',
    name: '青年优选集合店',
    category: '零售',
    address: '宜宾市临港经开区创新大道 66 号',
    distanceText: '4.0km',
    contactName: '导购台',
    contactPhone: '08319876543',
    businessHours: '10:00 - 21:30',
    description: '集合文创、日用品和青年周边的零售空间，适合消费券核销。'
  }
];

module.exports = {
  activityRules,
  merchantCategories,
  merchantFallbacks,
  policies,
  policyCategories,
  privacyPolicy,
  serviceInfo
};

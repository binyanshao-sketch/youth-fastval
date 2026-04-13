const { policies, policyCategories } = require('../../data/content');

Page({
  data: {
    currentCategory: '',
    categories: policyCategories,
    policies,
    displayPolicies: policies
  },

  switchCategory(event) {
    const currentCategory = event.currentTarget.dataset.category;
    this.setData({
      currentCategory,
      displayPolicies: currentCategory
        ? policies.filter((item) => item.category === currentCategory)
        : policies
    });
  },

  viewPolicy(event) {
    wx.navigateTo({
      url: `/pages/policy/detail?id=${event.currentTarget.dataset.id}`
    });
  }
});

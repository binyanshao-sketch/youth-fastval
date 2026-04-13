const { policies, privacyPolicy } = require('../../data/content');

Page({
  data: {
    policy: null
  },

  onLoad(options) {
    const policy = options.id === 'privacy'
      ? privacyPolicy
      : policies.find((item) => item.id === options.id);

    this.setData({
      policy: policy || privacyPolicy
    });
  }
});

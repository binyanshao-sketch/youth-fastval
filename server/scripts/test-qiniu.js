require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const qiniu = require('qiniu');
const fs = require('fs');
const https = require('https');
const http = require('http');

const QiniuService = require('../src/services/QiniuService');

async function testQiniu() {
  if (!QiniuService.isConfigured()) {
    console.error('❌ 七牛云 (QINIU_*) 环境及秘钥尚未配置在 server/.env，中断测试。请将其补充完整后再重试。');
    process.exit(1);
  }

  console.log('✅ 读取到基本七牛云配置，准备执行上传测试...');
  
  try {
    // 1. 模拟申请 Token
    const prefix = 'test-upload/debug-';
    const { token, key, domain } = QiniuService.getUploadToken({ prefix });
    console.log(`[1] 已成功获取上传凭证 (Token)`);
    console.log(`[1] 预备上传目标 Key: ${key}`);

    // 2. 生成一张测试的本地文件
    const tmpFilePath = '/tmp/qiniu_test_' + Date.now() + '.png';
    const contentToUpload = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
    fs.writeFileSync(tmpFilePath, contentToUpload);

    // 3. 构建七牛直传实例进行上传
    const config = new qiniu.conf.Config();
    const formUploader = new qiniu.form_up.FormUploader(config);
    const putExtra = new qiniu.form_up.PutExtra();
    putExtra.mimeType = 'image/png';

    console.log(`[2] 本地文件已生成，开始触发直传七牛云...`);
    formUploader.putFile(token, key, tmpFilePath, putExtra, (respErr, respBody, respInfo) => {
      if (respErr) {
        console.error('❌ SDK 级上传错误:', respErr);
        return;
      }
      
      if (respInfo.statusCode === 200) {
        console.log('✅ [2] 直传成功，七牛云响应:', respBody);
        
        // 4. 读取上云的文件看数据是否对得上（即下载测试）
        const finalUrl = `${domain.replace(/\/$/, '')}/${respBody.key}`;
        console.log(`[3] 尝试公网拉取 CDN 地址: ${finalUrl}`);
        
        const client = finalUrl.startsWith('https') ? https : http;
        client.get(finalUrl, (res) => {
          let chunks = [];
          res.on('data', chunk => chunks.push(chunk));
          res.on('end', () => {
             const buffer = Buffer.concat(chunks);
             if (buffer.equals(contentToUpload)) {
               console.log('🎉 【上传/下载 整体连通性测试通过】PNG 图片双向一致！');
             } else {
               console.log('⚠️ 读取返回的内容和上传的内容不一致。');
             }
             fs.unlinkSync(tmpFilePath);
          });
        }).on('error', (err) => {
           console.error('❌ 下载拉取验证失败:', err.message);
        });

      } else {
        console.error(`❌ 上传失败! HTTP 状态码: ${respInfo.statusCode}`);
        console.error(respBody);
      }
    });

  } catch (err) {
    console.error('❌ 执行错误:', err);
  }
}

testQiniu();

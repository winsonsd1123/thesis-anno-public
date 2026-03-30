/**
 * 测试 OpenRouter API Key
 * 使用原生 fetch 调用 OpenRouter API
 */

const API_KEY = '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';
const API_URL = 'https://openrouter.ai/api/v1/auth/key';

async function testApiKey() {
  console.log('正在测试 OpenRouter API Key...\n');

  try {
    const response = await fetch(API_URL, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`请求失败: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error(`错误详情: ${errorText}`);
      return;
    }

    const data = await response.json();
    console.log('✅ API Key 验证成功！\n');
    console.log('返回数据:');
    console.log(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('❌ 请求出错:', error);
  }
}

testApiKey();

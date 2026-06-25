/**
 * 家长简报服务 - 简化版 v4
 * 获取所有记录后在JS中过滤，避免API参数问题
 * 直连飞书 Open API
 */

const express = require('express');
const https = require('https');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3456;

const FEISHU_APP_ID = process.env.FEISHU_APP_ID || 'cli_aab61518b6789cd2';
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET || '65sZxbOWkCMpZ7blI2S8xxo23mfBChzY';

const BASE_TOKEN = 'ETkAbO98zaY8oTsoFoZc7THNnic';
const TABLE_ID = 'tblu9qUtoYmb2iG2';

let tenantToken = null;
let tokenExpiresAt = 0;
let recordsCache = null;
let cacheExpiresAt = 0;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// ===================== Feishu API =====================

function feishuGet(apiPath) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'open.feishu.cn',
      path: apiPath,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tenantToken}`
      },
      timeout: 15000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`Parse error: ${data.substring(0, 200)}`)); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

function feishuPost(apiPath, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'open.feishu.cn',
      path: apiPath,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`Parse error: ${data.substring(0, 200)}`)); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(JSON.stringify(body));
    req.end();
  });
}

async function getToken() {
  const now = Date.now();
  if (tenantToken && now < tokenExpiresAt - 60000) return tenantToken;

  const result = await feishuPost('/open-apis/auth/v3/tenant_access_token/internal', {
    app_id: FEISHU_APP_ID,
    app_secret: FEISHU_APP_SECRET
  });

  if (result.code !== 0) throw new Error(`Token error: ${result.msg}`);
  
  tenantToken = result.tenant_access_token;
  tokenExpiresAt = now + (result.expire || 7200) * 1000;
  console.log(`[Token] OK, expires in ${result.expire}s`);
  return tenantToken;
}

async function fetchAllRecords() {
  await getToken();
  
  const result = await feishuGet(
    `/open-apis/bitable/v1/apps/${BASE_TOKEN}/tables/${TABLE_ID}/records?page_size=200`
  );

  if (result.code !== 0) {
    throw new Error(`API error: ${result.msg} (code=${result.code})`);
  }

  return (result.data && result.data.items) || [];
}

async function getCachedRecords() {
  const now = Date.now();
  if (recordsCache && now < cacheExpiresAt) return recordsCache;

  recordsCache = await fetchAllRecords();
  cacheExpiresAt = now + 5 * 60 * 1000; // Cache 5 minutes
  console.log(`[Cache] Loaded ${recordsCache.length} records`);
  return recordsCache;
}

// ===================== API Routes =====================

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', cached: !!recordsCache, time: new Date().toISOString() });
});

app.get('/api/briefing', async (req, res) => {
  const name = (req.query.name || '').trim();
  if (!name) return res.status(400).json({ ok: false, error: '请输入学生姓名' });

  try {
    const all = await getCachedRecords();
    const matched = all.filter(item => {
      const sf = item.fields['涉及学生'] || '';
      return sf.includes(name);
    });

    const records = matched.map(item => {
      const f = item.fields;
      return {
        date: (() => {
          const d = f['日期'];
          if (!d) return '';
          // Handle timestamp (number) or string
          const ts = typeof d === 'number' ? d : new Date(d).getTime();
          return new Date(ts).toISOString().split('T')[0];
        })(),
        subject: f['科目'] || '',
        grade: f['年级'] || '',
        className: f['班级'] || '',
        content: f['教学内容'] || '',
        performance: f['课堂表现'] || '',
        observation: f['学生观察'] || '',
        homework: f['作业布置'] || '',
        nextPlan: f['下节课计划'] || ''
      };
    }).sort((a, b) => b.date.localeCompare(a.date));

    res.json({ ok: true, data: { name, total: records.length, records } });
  } catch (err) {
    console.error('Briefing error:', err.message);
    res.status(500).json({ ok: false, error: err.message, data: { name, total: 0, records: [] } });
  }
});

app.get('/api/search', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json({ ok: true, data: [] });

  try {
    const all = await getCachedRecords();
    const set = new Set();
    for (const item of all) {
      const sf = item.fields['涉及学生'] || '';
      sf.split(/[,，、\s]+/).forEach(s => {
        const t = s.trim();
        if (t && t.includes(q)) set.add(t);
      });
    }
    res.json({ ok: true, data: Array.from(set).slice(0, 20) });
  } catch (err) {
    console.error('Search error:', err.message);
    res.json({ ok: true, data: [] });
  }
});

app.listen(PORT, () => {
  console.log(`家长简报服务启动 - 端口 ${PORT}`);
  console.log(`Base: ${BASE_TOKEN}`);
});

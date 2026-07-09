// ================================================================
// netcheck-worker.js — 网络分流检测 · 网页版（独立 Worker，不影响主 Worker）
//
// 域名规划（均为本 Worker 的 Custom Domain，部署时自动建 DNS）：
//   check.william.nyc.mn             检测页 + 「日常上网」探针（无规则命中 → 兜底机场线）
//   claude-check.william.nyc.mn      「AI 专线」探针：域名含 claude，命中成员配置的
//                                    DOMAIN-KEYWORD claude 规则 → 走 AI 专线（新旧配置通吃）
//   googlevideo-check.william.nyc.mn 「YouTube 泄漏」探针：旧配置 DOMAIN-KEYWORD google
//                                    命中 → 走 AI 专线（报警）；新配置落兜底（正常）
//
// 注：新建 Custom Domain 后边缘证书需几分钟签发，期间握手被重置属正常，等一会即可。
// AI 专线探针偶发不可用时，判定引擎自动降级为「AI 站点连通性」推断，页面仍可用。
//
// 路由：GET /probe → 回显出口 IP + 地理信息（CORS 全开）；其余 → 检测页
// ================================================================

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

function handleProbe(request) {
  const cf = request.cf || {};
  const body = JSON.stringify({
    ip: request.headers.get('cf-connecting-ip') || '',
    cc: cf.country || '',
    city: cf.city || '',
    region: cf.region || '',
    colo: cf.colo || '',
    org: cf.asOrganization || '',
    asn: cf.asn || 0,
  });
  return new Response(body, {
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }
    if (url.pathname === '/probe') {
      return handleProbe(request);
    }
    return new Response(PAGE_HTML, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  },
};

// ================================================================
// 检测页（移动端优先；页内脚本刻意不用模板字符串，避免嵌套反引号）
// ================================================================
const PAGE_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="robots" content="noindex">
<title>网络分流检测 · 威廉的 AI Club</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🌐</text></svg>">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  background-image:
    radial-gradient(circle at 10% 20%, rgba(0, 168, 255, 0.15), transparent 45%),
    radial-gradient(circle at 90% 85%, rgba(255, 23, 68, 0.1), transparent 45%),
    linear-gradient(150deg, #090c1f 0%, #060813 100%);
  background-attachment: fixed;
  color: #e0e0e6;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 20px 16px calc(24px + env(safe-area-inset-bottom));
  max-width: 560px;
  margin: 0 auto;
  width: 100%;
}
.head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
h1 { font-size: 19px; color: #fff; display: flex; align-items: center; gap: 8px; }
.sub { font-size: 12px; color: #8b95ab; margin-top: 6px; }
.card {
  border: 1px solid rgba(97, 175, 239, 0.22);
  border-radius: 12px;
  background: rgba(97, 175, 239, 0.08);
  padding: 12px 14px;
  font-size: 13px;
  line-height: 1.6;
  color: #d5e4f8;
  margin-bottom: 14px;
}
.summary {
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  padding: 12px 14px;
  margin-bottom: 14px;
}
.headline { font-size: 14px; font-weight: 700; line-height: 1.5; }
.headline.ok { color: #7ed99a; }
.headline.warn { color: #ffd27a; }
.dot { flex-shrink: 0; width: 8px; height: 8px; border-radius: 50%; background: rgba(255,255,255,0.12); }
.dot.on { box-shadow: 0 0 6px currentColor; }
.groups { margin-bottom: 16px; }
.group {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 4px 14px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2), inset 0 1px 1px rgba(255, 255, 255, 0.08);
  margin-bottom: 12px;
}
.group:last-child { margin-bottom: 0; }
.item { display: flex; align-items: center; gap: 10px; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
.item:last-child { border-bottom: none; }
/* 固定行高：待检测/检测中/出结果三种状态高度一致，重新检测时页面不跳动 */
.item.parent { min-height: 96px; }
.item.child { min-height: 52px; }
.item.child { margin-left: 14px; padding-left: 14px; border-left: 2px solid rgba(97, 175, 239, 0.22); }
.item.child .name { font-size: 13px; }
.info { flex: 1; min-width: 0; }
.name { font-size: 14px; font-weight: 600; color: #c0c0d0; display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap; }
.host { font-size: 10px; font-weight: 400; color: #6b6b80; }
.result { margin-top: 4px; font-size: 12px; line-height: 1.5; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; }
.result:empty { display: none; }
.pending { color: #6b6b80; }
.ipv { font-family: 'SF Mono', Menlo, Consolas, monospace; color: #9fd2ff; }
/* 地区/ISP 单行省略，长运营商名不折行 */
.geo { color: #aab4cc; flex: 1 1 auto; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.item.parent .name { font-size: 15px; color: #e0e0e6; }
.item.parent .ipv { font-size: 14px; }
.okonly { color: #8b95ab; }
.fail { color: #ffb4aa; }
.note { width: 100%; font-size: 11px; color: #7b8499; }
.note.ok { color: #7ed99a; }
.note.warn { color: #ffd27a; }
.lat { flex-shrink: 0; font-size: 12px; font-family: 'SF Mono', Menlo, Consolas, monospace; }
.lat.fast { color: #66bb6a; } .lat.mid { color: #f0c040; } .lat.slow { color: #e8a030; }
.btn {
  border: none; cursor: pointer; flex-shrink: 0;
  background: linear-gradient(135deg, #FF1744, #D50000);
  color: #fff; padding: 10px 20px; border-radius: 9px;
  font-size: 14px; font-weight: 700; white-space: nowrap;
}
.btn:disabled { opacity: 0.6; }
.foot { margin-top: auto; padding-top: 28px; font-size: 11px; color: #6b6b80; line-height: 1.7; text-align: center; }
.foot a { color: #61afef; text-decoration: none; }
.foot-pc { display: none; } /* 插件推荐仅在电脑端显示 */
/* 平板：加宽版心、放大字号（布局仍为单列） */
@media (min-width: 768px) {
  body { max-width: 760px; padding: 44px 36px; }
  h1 { font-size: 26px; }
  .sub { font-size: 14px; margin-top: 8px; }
  .head { margin-bottom: 22px; }
  .btn { padding: 12px 26px; font-size: 15px; }
  .card { font-size: 14px; padding: 16px 20px; line-height: 1.7; }
  .summary { padding: 16px 20px; }
  .headline { font-size: 16px; }
  .group { padding: 6px 18px; }
  .item { padding: 14px 0; }
  .name { font-size: 15px; }
  .item.child .name { font-size: 14px; }
  .host { font-size: 11px; }
  .result { font-size: 13px; }
  .note { font-size: 12px; }
  .lat { font-size: 13px; }
  .foot { font-size: 12px; }
  .foot-pc { display: block; }
}
/* 桌面：三条线路排成三栏等高卡片；三张卡片本身已含全部线路信息，
   汇总区只保留一句结论，不再重复线路明细 */
@media (min-width: 1000px) {
  body { max-width: 1160px; padding: 48px 44px; }
  .groups {
    display: grid;
    /* minmax(0,1fr) 强制三列严格等宽：长地区/ISP 文本收缩省略，而不是撑宽所在列 */
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
  }
  .group { margin-bottom: 0; padding: 8px 20px; }
  .item.child { margin-left: 8px; padding-left: 14px; }
  .summary { margin-bottom: 18px; }
}
</style>
</head>
<body>
<div class="head">
  <div>
    <h1>🌐 网络分流检测</h1>
    <div class="sub">威廉的 AI Club · 手机 / 电脑 / 软路由下的任意设备均可检测</div>
  </div>
  <button class="btn" id="run">开始检测</button>
</div>
<div class="card">从当前设备直接访问各探测点，真实经过你的分流规则。<br>增强版应为三线分流：AI 站点走「静态住宅IP」，普通国外网站走「日常上网」，国内网站直连。</div>
<div class="summary" id="summary"><div class="headline">检测中…</div></div>
<div class="groups" id="list"></div>
<div class="foot">
  <div>检测基于「威廉的 AI Club」配置规则，第三方配置仅供参考</div>
  <div class="foot-pc">电脑端可安装 <a href="https://chromewebstore.google.com/search/%E5%A8%81%E5%BB%89%E7%9A%84%20AI%20Club" target="_blank">AI 工具箱浏览器插件</a>，一键生成分流配置</div>
</div>
<script>
var TIMEOUT = 10000;
var TARGETS = [
  { id: 'ai',      name: 'AI 专线出口',     host: 'claude-check.william.nyc.mn',      type: 'echo', url: 'https://claude-check.william.nyc.mn/probe' },
  { id: 'claude',  name: 'Claude',          host: 'claude.ai',   parent: 'ai',        type: 'ping', url: 'https://claude.ai/cdn-cgi/trace' },
  { id: 'chatgpt', name: 'ChatGPT',         host: 'chatgpt.com', parent: 'ai',        type: 'ping', url: 'https://chatgpt.com/cdn-cgi/trace' },
  { id: 'google',  name: 'Google / Gemini', host: 'google.com',  parent: 'ai',        type: 'ping', url: 'https://www.google.com/generate_204' },
  { id: 'daily',   name: '日常上网出口',     host: 'check.william.nyc.mn',             type: 'echo', url: 'https://check.william.nyc.mn/probe' },
  // host 仅用于展示：显示真实的视频域名，探针域名是内部实现
  { id: 'youtube', name: 'YouTube 视频流量', host: 'googlevideo.com', parent: 'daily', type: 'echo', url: 'https://googlevideo-check.william.nyc.mn/probe' },
  // 日常上网的子站点须选「不在任何规则分类里」的域名（GitHub/X 等可被用户勾进 AI 专线）
  { id: 'wiki',    name: '维基百科',         host: 'wikipedia.org', parent: 'daily',   type: 'ping', url: 'https://www.wikipedia.org/static/favicon/wikipedia.ico' },
  { id: 'netflix', name: 'Netflix',          host: 'netflix.com',   parent: 'daily',   type: 'ping', url: 'https://www.netflix.com/favicon.ico' },
  { id: 'cn',      name: '国内直连出口',     host: 'myip.ipip.net',                    type: 'cn' },
  { id: 'baidu',   name: '百度',             host: 'baidu.com',    parent: 'cn',       type: 'ping', url: 'https://www.baidu.com/favicon.ico' },
  { id: 'taobao',  name: '淘宝',             host: 'taobao.com',   parent: 'cn',       type: 'ping', url: 'https://www.taobao.com/favicon.ico' },
  { id: 'bili',    name: '哔哩哔哩',         host: 'bilibili.com', parent: 'cn',       type: 'ping', url: 'https://www.bilibili.com/favicon.ico' }
];
var COLORS = ['#61afef', '#66bb6a', '#f0c040', '#e06c75', '#c678dd', '#56b6c2'];
var running = false;

function $(id) { return document.getElementById(id); }
var regionNames = null;
try { regionNames = new Intl.DisplayNames(['zh-CN'], { type: 'region' }); } catch (e) {}
function flagEmoji(cc) {
  if (!cc || !/^[A-Za-z]{2}$/.test(cc)) return '';
  var u = cc.toUpperCase();
  return String.fromCodePoint(0x1F1E6 + u.charCodeAt(0) - 65, 0x1F1E6 + u.charCodeAt(1) - 65);
}
function regionLabel(cc) {
  if (!cc) return '';
  var name = cc;
  try { name = (regionNames && regionNames.of(cc.toUpperCase())) || cc; } catch (e) {}
  return (flagEmoji(cc) + ' ' + name).trim();
}
function lineKey(ip) {
  if (ip.indexOf(':') >= 0) return ip.toLowerCase().split(':').slice(0, 4).join(':');
  return ip.split('.').slice(0, 3).join('.');
}
function fetchT(url, opt, ms) {
  var c = new AbortController();
  var t = setTimeout(function () { c.abort(); }, ms || TIMEOUT);
  opt = opt || {};
  opt.cache = 'no-store';
  opt.signal = c.signal;
  return fetch(url, opt).finally(function () { clearTimeout(t); });
}

// 预热：先发一次不计时的请求把 TCP/TLS 连接建好（长链路首连要 2-3 秒），
// 正式测量复用连接，显示的延迟即线路的稳定往返速度
async function warm(url, opt) {
  try { await fetchT(url, opt, 8000); } catch (e) {}
}
async function probeEcho(url) {
  await warm(url);
  var t0 = performance.now();
  var r = await fetchT(url);
  var lat = Math.round(performance.now() - t0);
  if (!r.ok) return { ok: true, limited: true, latency: lat };
  var d = await r.json();
  if (!d.ip) return { ok: true, limited: true, latency: lat };
  return {
    ok: true, ip: d.ip, latency: lat, cc: (d.cc || '').toUpperCase(),
    region: (regionLabel(d.cc) + ' ' + (d.city || '')).trim(),
    detail: d.org || ''
  };
}
async function probePing(url) {
  await warm(url, { mode: 'no-cors' });
  var t0 = performance.now();
  await fetchT(url, { mode: 'no-cors' });
  return { ok: true, pingOnly: true, latency: Math.round(performance.now() - t0) };
}
async function probeCn() {
  var NON_MAINLAND = ['香港', '澳门', '台湾'];
  try {
    var t0 = performance.now();
    var r = await fetchT('https://myip.ipip.net/json', {}, 5000);
    var lat = Math.round(performance.now() - t0);
    if (r.ok) {
      var d = await r.json();
      var loc = (d.data && d.data.location) || [];
      var mainland = loc[0] === '中国' && NON_MAINLAND.indexOf(loc[1]) < 0;
      if (d.data && d.data.ip) {
        return {
          ok: true, ip: d.data.ip, latency: lat,
          cc: loc[0] ? (mainland ? 'CN' : 'OTHER') : '',
          region: (mainland ? '🇨🇳 ' : '') + [loc[0], loc[1], loc[2]].filter(Boolean).join(' '),
          detail: loc[4] || ''
        };
      }
    }
  } catch (e) {}
  var t1 = performance.now();
  var r2 = await fetchT('https://api-v3.speedtest.cn/ip');
  var lat2 = Math.round(performance.now() - t1);
  if (!r2.ok) return { ok: true, limited: true, latency: lat2 };
  var j = await r2.json();
  var dd = j.data || {};
  if (!dd.ip) return { ok: true, limited: true, latency: lat2 };
  var mainland2 = (dd.countryCode || '').toUpperCase() === 'CN' && NON_MAINLAND.indexOf(dd.province) < 0;
  return {
    ok: true, ip: dd.ip, latency: lat2,
    cc: dd.countryCode ? (mainland2 ? 'CN' : 'OTHER') : '',
    region: (mainland2 ? '🇨🇳 ' : '') + [dd.country, dd.province, dd.city].filter(Boolean).join(' '),
    detail: dd.operator || dd.isp || ''
  };
}
async function probe(t) {
  try {
    if (t.type === 'echo') return await probeEcho(t.url);
    if (t.type === 'cn') return await probeCn();
    return await probePing(t.url);
  } catch (e) {
    return { ok: false, error: e.name === 'AbortError' ? '超时' : '无法连接' };
  }
}

function latCls(ms) { return ms < 200 ? 'fast' : ms < 500 ? 'mid' : 'slow'; }
function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

function renderRows() {
  // 每个无 parent 的目标开启一个线路分组卡片，其子目标归入同组
  var html = '';
  var opened = false;
  TARGETS.forEach(function (t) {
    if (!t.parent) {
      if (opened) html += '</div>';
      html += '<div class="group">';
      opened = true;
    }
    // 父行不展示探针域名（内部实现细节）；子行展示真实站点域名
    html += '<div class="item' + (t.parent ? ' child' : ' parent') + '"><span class="dot" id="dot-' + t.id + '"></span><div class="info">'
      + '<div class="name">' + esc(t.name) + (t.parent ? '<span class="host">' + esc(t.host) + '</span>' : '') + '</div>'
      + '<div class="result" id="res-' + t.id + '"></div>'
      + '</div><span class="lat" id="lat-' + t.id + '"></span></div>';
  });
  if (opened) html += '</div>';
  $('list').innerHTML = html;
}

function setPending(t) {
  // 清空态不放文字行（避免比完成态更高导致行高变化），「检测中」由汇总条统一表达
  $('res-' + t.id).innerHTML = '';
  $('lat-' + t.id).textContent = '';
  var d = $('dot-' + t.id);
  d.style.background = '';
  d.classList.remove('on');
}

function setResult(t, r) {
  var el = $('res-' + t.id);
  var latEl = $('lat-' + t.id);
  // 新结果就位，解除清空阶段冻结的行高
  var row = el.closest('.item');
  if (row) row.style.minHeight = '';
  if (!r.ok) {
    el.innerHTML = '<span class="fail">\\u2715 ' + esc(r.error) + '</span>';
    return;
  }
  if (r.latency !== undefined) {
    latEl.textContent = r.latency + 'ms';
    latEl.className = 'lat ' + latCls(r.latency);
  }
  if (r.ip) {
    var parts = [r.region, r.detail].filter(Boolean).join(' \\u00b7 ');
    el.innerHTML = '<span class="ipv">' + esc(r.ip) + '</span><span class="geo">' + esc(parts) + '</span>';
  } else if (r.limited) {
    el.innerHTML = '<span class="okonly">\\u5df2\\u8fde\\u901a\\uff08\\u8bfb\\u53d6\\u53d7\\u9650\\uff09</span>';
  } else {
    // 连通性子行：绿色圆点 + 延迟已足够表达成功，不再堆「已连通」文字
    el.innerHTML = '';
  }
}

function addNote(id, text, cls) {
  var el = $('res-' + id);
  if (!el) return;
  var n = document.createElement('div');
  n.className = 'note' + (cls ? ' ' + cls : '');
  n.textContent = text;
  el.appendChild(n);
}

function verdict(byId) {
  var summary = $('summary');
  // 首选 claude-check 探针读取 AI 专线出口 IP（域名含 claude，命中
  // DOMAIN-KEYWORD claude 规则）；探针偶发不可用时降级为 AI 站点连通性推断
  var ai = byId.ai && byId.ai.ip ? byId.ai : null;
  var daily = byId.daily && byId.daily.ip ? byId.daily : null;
  var cn = byId.cn && byId.cn.ip ? byId.cn : null;
  var yt = byId.youtube && byId.youtube.ip ? byId.youtube : null;
  var aiOk = ['claude', 'chatgpt'].some(function (id) { return byId[id] && byId[id].ok && !byId[id].error; });
  var aiK = ai && lineKey(ai.ip), dailyK = daily && lineKey(daily.ip), cnK = cn && lineKey(cn.ip), ytK = yt && lineKey(yt.ip);

  // 线路汇总（按 /24 网段归并）
  var exits = {}; var order = [];
  [['ai', ai], ['youtube', yt], ['daily', daily], ['cn', cn]].forEach(function (p) {
    var r = p[1];
    if (!r) return;
    var k = lineKey(r.ip);
    if (!exits[k]) { exits[k] = { region: r.region, cc: r.cc, ips: {}, names: [] }; order.push(k); }
    exits[k].ips[r.ip] = 1;
    exits[k].names.push(TARGETS.filter(function (t) { return t.id === p[0]; })[0].name);
  });

  var directMode = (ai && ai.cc === 'CN') || (daily && daily.cc === 'CN') || (!ai && !daily && cn && cn.cc === 'CN');
  var cnProxied = !directMode && cn && cn.cc && cn.cc !== 'CN';
  var globalMode = cnProxied && dailyK && dailyK === cnK && (!aiK || aiK === dailyK);
  var headline, cls;

  if (order.length === 0) {
    headline = (cn || (byId.cn && byId.cn.ok))
      ? '⚠ 未能读取到出口 IP，请稍后重试'
      : '⚠ 检测失败：连国内网站都无法访问。请检查设备网络，或代理客户端是否卡死';
    cls = 'warn';
  } else if (directMode) {
    headline = '⚠ 未检测到代理：流量直连国内网络，AI 站点无法正常使用。请先开启代理客户端再检测';
    cls = 'warn';
  } else if (globalMode) {
    headline = '所有流量（含国内网站）走同一国外出口——基础版配置，或客户端开了「全局」模式。升级增强版可三线分流';
    cls = 'warn';
  } else if (cnProxied) {
    headline = '⚠ 国内网站没有直连（出口在境外）。请确认客户端处于「规则」模式，或重新生成配置';
    cls = 'warn';
  } else if (aiK && dailyK && aiK === dailyK) {
    if (!cn) {
      headline = '国外流量统一出口，且国内网站无法访问——大概率是「全局」模式或基础版配置。日常使用请切回「规则」模式';
      cls = 'warn';
    } else {
      headline = '✓ 国外流量统一走住宅IP、国内直连——「锁定住宅IP」模式生效中';
      cls = 'ok';
    }
  } else if (aiK && dailyK && cnK && cnK !== dailyK) {
    headline = '✓ 三线分流已生效：AI 专线 / 日常上网 / 国内直连';
    cls = 'ok';
  } else if (!aiK && dailyK && cnK && aiOk) {
    // AI 探针偶发失败但 AI 站点连通：降级判定
    headline = '✓ 分流工作正常：国外走代理、国内直连，AI 站点连通正常（AI 专线出口读取失败，可重试）';
    cls = 'ok';
  } else if (order.length > 1) {
    headline = '✓ 检测到 ' + order.length + ' 个不同出口，分流已生效';
    cls = 'ok';
  } else {
    headline = '! 所有可读取的站点走同一出口，未检测到分流';
    cls = 'warn';
  }

  function rank(k) { return k === aiK ? 0 : k === dailyK ? 1 : k === cnK ? 2 : 3; }

  // 汇总只展示一句结论；线路明细由下方三张卡片承载，这里只负责给圆点按线路上色
  order.sort(function (a, b) { return rank(a) - rank(b); }).forEach(function (k, i) {
    [['ai', ai], ['youtube', yt], ['daily', daily], ['cn', cn]].forEach(function (p) {
      if (p[1] && lineKey(p[1].ip) === k) {
        var d = $('dot-' + p[0]);
        d.style.background = COLORS[i % COLORS.length];
        d.classList.add('on');
      }
    });
  });
  summary.innerHTML = '<div class="headline ' + cls + '">' + headline + '</div>';
  summary.style.display = 'block';

  // 子行圆点继承父行线路颜色（连通性子行本身不带 IP）
  TARGETS.forEach(function (t) {
    if (!t.parent || !byId[t.id] || !byId[t.id].ok) return;
    var pd = $('dot-' + t.parent);
    var d = $('dot-' + t.id);
    if (pd && d && pd.classList.contains('on') && pd.style.background) {
      d.style.background = pd.style.background;
      d.classList.add('on');
    }
  });

  // 行级标注（未走代理 / 全局模式下不适用）
  if (!directMode && !globalMode && !(aiK && dailyK && aiK === dailyK)) {
    if (!ai && aiOk) {
      addNote('ai', 'AI 专线探针暂时不可用，不影响 AI 站点使用；可点「重新检测」重试', 'warn');
    }
    // YouTube 泄漏检查：视频流量应走日常上网线路，不应与 AI 专线同出口
    if (ytK && aiK && ytK === aiK) {
      addNote('youtube', '⚠ 视频流量正在消耗静态住宅IP流量（旧版配置），请重新生成并更新配置', 'warn');
    } else if (ytK && dailyK && ytK === dailyK) {
      // 与父行同线路时不重复展示 IP/ISP，整行只留一句绿色结论
      var ytRes = $('res-youtube');
      if (ytRes) ytRes.innerHTML = '';
      addNote('youtube', '✓ 走「日常上网」线路，不消耗住宅IP流量', 'ok');
    }
  }
}

async function runCheck() {
  if (running) return;
  running = true;
  var btn = $('run');
  btn.disabled = true;
  btn.textContent = '\\u68c0\\u6d4b\\u4e2d\\u2026';
  // 汇总区不隐藏（避免页面高度跳动），显示检测中占位
  var s = $('summary');
  s.innerHTML = '<div class="headline">检测中…</div>';
  // 清空前把每行高度冻结在当前值，新结果填入时再解冻——重新检测全程零跳动
  document.querySelectorAll('.item').forEach(function (el) {
    el.style.minHeight = el.getBoundingClientRect().height + 'px';
  });
  TARGETS.forEach(setPending);
  var byId = {};
  await Promise.all(TARGETS.map(async function (t) {
    var r = await probe(t);
    byId[t.id] = r;
    setResult(t, r);
  }));
  verdict(byId);
  btn.disabled = false;
  btn.textContent = '\\u91cd\\u65b0\\u68c0\\u6d4b';
  running = false;
}

renderRows();
$('run').addEventListener('click', runCheck);
setTimeout(runCheck, 50);
</script>
</body>
</html>`;

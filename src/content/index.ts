console.log('[AutoChrome] Content script loaded');

// 元素定位
function findElement(selector: string): Element | null {
  try { return document.querySelector(selector); } catch { return null; }
}

// 高亮元素
function highlight(element: Element, duration = 2000, color = '#ff6b6b') {
  const orig = element.getAttribute('style');
  element.setAttribute('style', `${orig || ''}; outline: 3px solid ${color} !important; outline-offset: 2px;`);
  setTimeout(() => {
    if (orig) element.setAttribute('style', orig);
    else element.removeAttribute('style');
  }, duration);
}

// 生成选择器
function generateSelector(element: Element): string {
  if (element.id) return `#${element.id}`;
  if (element.className && String(element.className).trim()) {
    const cls = String(element.className).split(' ').filter(Boolean)[0];
    if (cls) return `${element.tagName.toLowerCase()}.${cls}`;
  }
  const path: string[] = [];
  let cur: Element | null = element;
  while (cur && cur.nodeType === Node.ELEMENT_NODE) {
    let sel = cur.tagName.toLowerCase();
    if (cur.id) { sel = `#${cur.id}`; path.unshift(sel); break; }
    let sib = cur.previousElementSibling;
    let idx = 1;
    while (sib) { if (sib.tagName === cur.tagName) idx++; sib = sib.previousElementSibling; }
    if (idx > 1) sel += `:nth-of-type(${idx})`;
    path.unshift(sel);
    cur = cur.parentElement;
  }
  return path.join(' > ');
}

// 动作录制
let isRecording = false;
const actions: any[] = [];

function startRecording() { isRecording = true; actions.length = 0; }
function stopRecording() { isRecording = false; return actions; }

// 监听点击
document.addEventListener('click', (e) => {
  if (!isRecording) return;
  const target = e.target as Element;
  if (!target) return;
  const el = target as HTMLElement;
  const selector = el.id ? `#${el.id}` : el.className ? `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}` : el.tagName.toLowerCase();
  actions.push({ type: 'click', selector, text: target.textContent?.trim().slice(0, 20), url: window.location.href, time: Date.now() });
  highlight(target);
});

// 监听输入
document.addEventListener('input', (e) => {
  if (!isRecording) return;
  const target = e.target as HTMLInputElement;
  if (!target || !target.value) return;
  const selector = target.id ? `#${target.id}` : target.tagName.toLowerCase();
  actions.push({ type: 'type', selector, value: target.value.slice(0, 50), url: window.location.href, time: Date.now() });
});

// 元素选择器模式
let pickerMode = false;
let pickerCallback: ((selector: string, text: string) => void) | null = null;
let highlightedEl: Element | null = null;

function startPicker() {
  pickerMode = true;
  document.body.style.cursor = 'crosshair';
  
  document.addEventListener('mouseover', mouseOverHandler);
  document.addEventListener('click', clickHandler);
  document.addEventListener('keydown', keyHandler);
}

function stopPicker() {
  pickerMode = false;
  document.body.style.cursor = '';
  if (highlightedEl) highlight(highlightedEl, 500, '#9ca3af');
  highlightedEl = null;
  
  document.removeEventListener('mouseover', mouseOverHandler);
  document.removeEventListener('click', clickHandler);
  document.removeEventListener('keydown', keyHandler);
}

function mouseOverHandler(e: MouseEvent) {
  if (!pickerMode) return;
  e.stopPropagation();
  
  const target = e.target as Element;
  if (!target || target === document.body) return;
  
  if (highlightedEl) highlight(highlightedEl, 500, '#9ca3af');
  highlightedEl = target;
  highlight(target, 500, '#3b82f6');
}

function clickHandler(e: MouseEvent) {
  if (!pickerMode || !pickerCallback) return;
  e.preventDefault();
  e.stopPropagation();
  
  const target = e.target as Element;
  if (!target) return;
  
  const selector = generateSelector(target);
  const text = target.textContent?.trim().slice(0, 50) || '';
  const tagName = target.tagName.toLowerCase();
  
  pickerCallback(selector, text, tagName);
  stopPicker();
}

function keyHandler(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    stopPicker();
    chrome.runtime.sendMessage({ type: 'PICKER_CANCEL' });
  }
}

// 数据抓取功能
function extractData(rules: any[]) {
  const results: any[] = [];
  for (const rule of rules) {
    const el = findElement(rule.selector);
    if (!el) continue;
    
    let value: string | string[] = '';
    if (rule.type === 'text') value = el.textContent?.trim() || '';
    else if (rule.type === 'html') value = el.innerHTML;
    else if (rule.type === 'attribute') value = el.getAttribute(rule.attribute || 'href') || '';
    else if (rule.type === 'image') value = el.getAttribute('src') || '';
    
    results.push({ field: rule.field, value });
  }
  return results;
}

// 抓取列表数据
function extractList(itemSelector: string, rules: any[]) {
  const items = document.querySelectorAll(itemSelector);
  const results: any[] = [];
  
  items.forEach(item => {
    const row: any = {};
    rules.forEach(rule => {
      const el = item.querySelector(rule.selector);
      if (!el) return;
      
      let value: string = '';
      if (rule.type === 'text') value = el.textContent?.trim() || '';
      else if (rule.type === 'attribute') value = el.getAttribute(rule.attribute || 'href') || '';
      else if (rule.type === 'image') value = el.getAttribute('src') || '';
      
      row[rule.field] = value;
    });
    results.push(row);
  });
  
  return results;
}

// 消息处理
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_RECORDING') { startRecording(); sendResponse({ status: 'started' }); }
  else if (message.type === 'STOP_RECORDING') { sendResponse({ actions: stopRecording() }); }
  else if (message.type === 'PLAYBACK') { playbackActions(message.actions); sendResponse({ status: 'playing' }); }
  else if (message.type === 'FIND_ELEMENT') { const el = findElement(message.selector); if (el) { highlight(el); sendResponse({ found: true }); } else { sendResponse({ found: false }); } }
  else if (message.type === 'EXTRACT_DATA') { const results = extractData(message.rules); sendResponse({ data: results }); }
  else if (message.type === 'EXTRACT_LIST') { const results = extractList(message.itemSelector, message.rules); sendResponse({ data: results }); }
  else if (message.type === 'START_PICKER') {
    startPicker();
    pickerCallback = (selector: string, text: string, tagName: string) => {
      chrome.runtime.sendMessage({ type: 'ELEMENT_PICKED', selector, text, tagName });
    };
    sendResponse({ status: 'started' });
  }
  else if (message.type === 'STOP_PICKER') { stopPicker(); sendResponse({ status: 'stopped' }); }
  else { sendResponse({ error: 'Unknown' }); }
  return true;
});

// 动作回放
async function playbackActions(list: any[]) {
  for (const action of list) {
    const el = findElement(action.selector);
    if (!el) continue;
    highlight(el, 500);
    if (action.type === 'click') (el as HTMLElement).click();
    else if (action.type === 'type' && action.value) { (el as HTMLInputElement).value = action.value; el.dispatchEvent(new Event('input', { bubbles: true })); }
    await new Promise(r => setTimeout(r, 1000));
  }
}

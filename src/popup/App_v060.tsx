import { useState, useEffect } from 'react';

interface Action { type: string; selector: string; text?: string; value?: string; url: string; time: number; }
interface ExtractRule { field: string; selector: string; type: string; }

export default function App() {
  const [tab, setTab] = useState<'record' | 'extract'>('record');
  const [recording, setRecording] = useState(false);
  const [status, setStatus] = useState('就绪');
  const [actions, setActions] = useState<Action[]>([]);
  const [extractRules, setExtractRules] = useState<ExtractRule[]>([{ field: '', selector: '', type: 'text' }]);
  const [extractResult, setExtractResult] = useState<any>(null);
  const [isListMode, setIsListMode] = useState(false);
  const [itemSelector, setItemSelector] = useState('');

  useEffect(() => { const r = async () => { const result = await chrome.storage.local.get(['actions']); setActions(result.actions || []); }; r(); }, []);

  const toggleRecording = async () => {
    const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!t.id) return;
    if (!recording) {
      await chrome.tabs.sendMessage(t.id, { type: 'START_RECORDING' });
      setRecording(true); setStatus('🔴 录制中...');
    } else {
      const res = await chrome.tabs.sendMessage(t.id, { type: 'STOP_RECORDING' });
      const newActions = res.actions || [];
      setActions(newActions);
      await chrome.storage.local.set({ actions: newActions });
      setRecording(false); setStatus(`✅ 已录制 ${newActions.length} 个动作`);
    }
  };

  const playback = async () => {
    if (actions.length === 0) { setStatus('⚠️ 无动作'); return; }
    const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!t.id) return;
    setStatus('▶️ 回放中...');
    try { await chrome.tabs.sendMessage(t.id, { type: 'PLAYBACK', actions }); setTimeout(() => setStatus('✅ 完成'), 3000); }
    catch { setStatus('❌ 失败'); }
  };

  const addRule = () => setExtractRules([...extractRules, { field: '', selector: '', type: 'text' }]);
  const updateRule = (i: number, k: keyof ExtractRule, v: string) => { const n = [...extractRules]; n[i][k] = v; setExtractRules(n); };
  const deleteRule = (i: number) => setExtractRules(extractRules.filter((_, x) => x !== i));

  const startExtract = async () => {
    const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!t.id) return;
    setStatus('🔍 抓取中...');
    try {
      const msg = isListMode ? { type: 'EXTRACT_LIST', itemSelector, rules: extractRules.filter(r => r.selector) } : { type: 'EXTRACT_DATA', rules: extractRules.filter(r => r.selector) };
      const res = await chrome.tabs.sendMessage(t.id, msg);
      setExtractResult(res.data);
      setStatus(`✅ 抓取 ${Array.isArray(res.data) ? res.data.length : 1} 条`);
    } catch { setStatus('❌ 失败'); }
  };

  const exportData = (fmt: 'json' | 'csv') => {
    if (!extractResult) return;
    let content = '', mime = '', ext = '';
    if (fmt === 'json') { content = JSON.stringify(extractResult, null, 2); mime = 'application/json'; ext = 'json'; }
    else {
      const data = Array.isArray(extractResult) ? extractResult : [extractResult];
      if (data.length === 0) return;
      const headers = Object.keys(data[0]);
      content = [headers
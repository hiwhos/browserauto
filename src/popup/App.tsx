import { useState, useEffect } from 'react';

interface Action { type: string; selector: string; text?: string; value?: string; url: string; time: number; }
interface ExtractRule { field: string; selector: string; type: string; }
interface ScheduledJob { id: string; name: string; url: string; schedule: any; nextRun: number; runCount: number; enabled: boolean; }
interface GrabResult { jobId: string; jobName: string; timestamp: number; recordCount: number; }

export default function App() {
  const [tab, setTab] = useState<'record' | 'extract' | 'schedule'>('record');
  const [recording, setRecording] = useState(false);
  const [status, setStatus] = useState('就绪');
  const [actions, setActions] = useState<Action[]>([]);
  const [extractRules, setExtractRules] = useState<ExtractRule[]>([{ field: '', selector: '', type: 'text' }]);
  const [extractResult, setExtractResult] = useState<any>(null);
  const [isListMode, setIsListMode] = useState(false);
  const [itemSelector, setItemSelector] = useState('');
  const [jobs, setJobs] = useState<ScheduledJob[]>([]);
  const [results, setResults] = useState<GrabResult[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [newJob, setNewJob] = useState({ name: '', url: '', scheduleType: 'hour', scheduleInterval: 1, hour: 9, minute: 0 });

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    const r1 = await chrome.storage.local.get(['actions']);
    setActions(r1.actions || []);
    const r2 = await chrome.runtime.sendMessage({ type: 'GET_SCHEDULED_JOBS' });
    setJobs(r2.jobs || []);
    const r3 = await chrome.runtime.sendMessage({ type: 'GET_GRAB_RESULTS' });
    setResults(r3.results || []);
  };

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
      content = [headers.join(','), ...data.map((r: any) => headers.map(h => `"${String(r[h]||'').replace(/"/g,'""')}"`).join(','))].join('\n');
      mime = 'text/csv'; ext = 'csv';
    }
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `data_${Date.now()}.${ext}`; a.click();
    URL.revokeObjectURL(url);
    setStatus(`✅ 已导出 ${fmt.toUpperCase()}`);
  };

  const createJob = async () => {
    const job = {
      name: newJob.name,
      url: newJob.url,
      isList: isListMode,
      itemSelector,
      rules: extractRules.filter(r => r.selector),
      schedule: { type: newJob.scheduleType, interval: newJob.scheduleInterval, hour: newJob.hour, minute: newJob.minute }
    };
    await chrome.runtime.sendMessage({ type: 'CREATE_SCHEDULED_JOB', job });
    setShowForm(false);
    setNewJob({ name: '', url: '', scheduleType: 'hour', scheduleInterval: 1, hour: 9, minute: 0 });
    setStatus('✅ 定时任务已创建');
    loadAll();
  };

  const deleteJob = async (id: string) => {
    await chrome.runtime.sendMessage({ type: 'DELETE_SCHEDULED_JOB', jobId: id });
    setStatus('🗑️ 已删除任务');
    loadAll();
  };

  const formatTime = (ts: number) => new Date(ts).toLocaleString('zh-CN');

  return (
    <div style={{ padding: '16px', width: '380px', fontFamily: 'system-ui', maxHeight: '600px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <h2 style={{ margin: '0 0 12px', fontSize: '18px', display: 'flex', justifyContent: 'space-between' }}>
        <span>🔧 AutoChrome</span>
        <span style={{ fontSize: '12px', color: '#666' }}>v0.6.0</span>
      </h2>

      <div style={{ display: 'flex', marginBottom: '16px', background: '#f3f4f6', borderRadius: '6px', padding: '4px' }}>
        {['record', 'extract', 'schedule'].map(t => (
          <button key={t} onClick={() => setTab(t as any)} style={{ flex: 1, padding: '8px', background: tab === t ? 'white' : 'transparent', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: tab === t ? '600' : '400' }}>
            {t === 'record' ? '📼 录制' : t === 'extract' ? '📊 抓取' : '⏰ 定时'}
          </button>
        ))}
      </div>

      {tab === 'record' && (
        <>
          <div style={{ marginBottom: '12px', display: 'flex', gap: '8px' }}>
            <button onClick={toggleRecording} style={{ flex: 1, padding: '10px', background: recording ? '#ef4444' : '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>
              {recording ? '⏹️ 停止' : '🔴 录制'}
            </button>
            <button onClick={playback} style={{ flex: 1, padding: '10px', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>▶️ 回放</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '8px' }}>
            {actions.length === 0 ? <p style={{ color: '#9ca3af', textAlign: 'center', padding: '20px' }}>暂无动作</p> : actions.map((a, i) => (
              <div key={i} style={{ padding: '8px', marginBottom: '8px', background: '#f9fafb', borderRadius: '4px', fontSize: '13px' }}>
                <div style={{ fontWeight: '600' }}>{a.type === 'click' ? '🖱️' : '⌨️'} {a.text || a.value ? `"${a.text || a.value}"` : ''}</div>
                <div style={{ fontSize: '11px', color: '#6b7280' }}>{a.selector}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'extract' && (
        <>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: '13px' }}>
            <input type="checkbox" checked={isListMode} onChange={(e) => setIsListMode(e.target.checked)} /> 列表模式
          </label>
          {isListMode && <input placeholder="列表项选择器" value={itemSelector} onChange={(e) => setItemSelector(e.target.value)} style={{ width: '100%', padding: '8px', marginBottom: '8px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' }} />}
          <div style={{ flex: 1, overflowY: 'auto', marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontWeight: '600', fontSize: '14px' }}>抓取规则</span>
              <button onClick={addRule} style={{ padding: '4px 8px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>+ 添加</button>
            </div>
            {extractRules.map((r, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: '8px', marginBottom: '8px' }}>
                <input placeholder="字段" value={r.field} onChange={(e) => updateRule(i, 'field', e.target.value)} style={{ padding: '6px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' }} />
                <input placeholder="选择器" value={r.selector} onChange={(e) => updateRule(i, 'selector', e.target.value)} style={{ padding: '6px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' }} />
                <select value={r.type} onChange={(e) => updateRule(i, 'type', e.target.value)} style={{ padding: '6px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' }}>
                  <option value="text">文本</option>
                  <option value="html">HTML</option>
                  <option value="attribute">属性</option>
                  <option value="image">图片</option>
                </select>
                <button onClick={() => deleteRule(i)} style={{ padding: '6px', background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>×</button>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <button onClick={startExtract} style={{ flex: 1, padding: '10px', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>🔍 开始抓取</button>
            {extractResult && <>
              <button onClick={() => exportData('json')} style={{ padding: '10px', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>JSON</button>
              <button onClick={() => exportData('csv')} style={{ padding: '10px', background: '#06b6d4', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>CSV</button>
            </>}
          </div>
          {extractResult && <div style={{ padding: '8px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '6px', fontSize: '12px', maxHeight: '100px', overflowY: 'auto' }}><pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{JSON.stringify(extractResult, null, 2)}</pre></div>}
        </>
      )}

      {tab === 'schedule' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontWeight: '600', fontSize: '14px' }}>⏰ 定时任务 ({jobs.length})</span>
            <button onClick={() => setShowForm(!showForm)} style={{ padding: '6px 12px', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>{showForm ? '取消' : '+ 新建'}</button>
          </div>
          
          {showForm && (
            <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '6px', marginBottom: '12px' }}>
              <input placeholder="任务名称" value={newJob.name} onChange={(e) => setNewJob({...newJob, name: e.target.value})} style={{ width: '100%', padding: '8px', marginBottom: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }} />
              <input placeholder="目标 URL" value={newJob.url} onChange={(e) => setNewJob({...newJob, url: e.target.value})} style={{ width: '100%', padding: '8px', marginBottom: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }} />
              <div style={{ marginBottom: '8px' }}>
                <label style={{ fontSize: '13px', marginRight: '8px' }}>频率:</label>
                <select value={newJob.scheduleType} onChange={(e) => setNewJob({...newJob, scheduleType: e.target.value})} style={{ padding: '6px', marginRight: '8px' }}>
                  <option value="minute">每分钟</option>
                  <option value="hour">每小时</option>
                  <option value="day">每天</option>
                  <option value="week">每周</option>
                </select>
                <input type="number" min="1" value={newJob.scheduleInterval} onChange={(e) => setNewJob({...newJob, scheduleInterval: parseInt(e.target.value) || 1})} style={{ width: '60px', padding: '6px' }} />
                <span style={{ fontSize: '13px' }}>次</span>
              </div>
              {(newJob.scheduleType === 'day' || newJob.scheduleType === 'week') && (
                <div style={{ marginBottom: '8px' }}>
                  <label style={{ fontSize: '13px', marginRight: '8px' }}>时间:</label>
                  <input type="number" min="0" max="23" value={newJob.hour} onChange={(e) => setNewJob({...newJob, hour: parseInt(e.target.value) || 0})} style={{ width: '50px', padding: '6px' }} />
                  <span style={{ fontSize: '13px' }}>:</span>
                  <input type="number" min="0" max="59" value={newJob.minute} onChange={(e) => setNewJob({...newJob, minute: parseInt(e.target.value) || 0})} style={{ width: '50px', padding: '6px' }} />
                </div>
              )}
              <button onClick={createJob} style={{ width: '100%', padding: '10px', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>✅ 创建任务</button>
            </div>
          )}

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {jobs.length === 0 ? (
              <p style={{ color: '#9ca3af', textAlign: 'center', padding: '20px' }}>暂无定时任务<br/>点击"+ 新建"创建</p>
            ) : jobs.map(job => (
              <div key={job.id} style={{ padding: '12px', marginBottom: '8px', background: job.enabled ? '#f0fdf4' : '#fef2f2', border: `1px solid ${job.enabled ? '#86efac' : '#fca5a5'}`, borderRadius: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontWeight: '600', fontSize: '14px' }}>{job.name}</span>
                  <button onClick={() => deleteJob(job.id)} style={{ padding: '4px 8px', background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>删除</button>
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>
                  <div>🌐 {job.url}</div>
                  <div>⏰ 下次：{formatTime(job.nextRun)}</div>
                  <div>📊 已运行：{job.runCount} 次</div>
                </div>
              </div>
            ))}
          </div>

          {results.length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '8px' }}>📊 最近抓取记录</div>
              {results.slice(0, 5).map((r, i) => (
                <div key={i} style={{ padding: '8px', marginBottom: '4px', background: '#f9fafb', borderRadius: '4px', fontSize: '12px' }}>
                  <span style={{ fontWeight: '600' }}>{r.jobName}</span> - {formatTime(r.timestamp)} - {r.recordCount} 条
                </div>
              ))}
            </div>
          )}
        </>
      )}


      <div style={{ marginTop: 'auto', padding: '8px', background: '#f3f4f6', borderRadius: '4px', fontSize: '13px', textAlign: 'center' }}>
        状态：{status}
      </div>
    </div>
  );
}

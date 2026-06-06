console.log('[AutoChrome] Service Worker started');

// 定时任务存储
let scheduledTasks: any[] = [];

// 初始化
chrome.runtime.onInstalled.addListener(async () => {
  console.log('[AutoChrome] Extension installed');
  await chrome.storage.local.set({ 
    settings: { autoScroll: true, highlightElements: true },
    tasks: [],
    scheduledJobs: []
  });
  
  // 创建定时闹钟
  await chrome.alarms.create('checkScheduledTasks', { periodInMinutes: 1 });
});

// 监听闹钟事件
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'checkScheduledTasks') {
    await checkAndRunScheduledTasks();
  }
});

// 检查并执行定时任务
async function checkAndRunScheduledTasks() {
  const result = await chrome.storage.local.get(['scheduledJobs']);
  const jobs = result.scheduledJobs || [];
  const now = Date.now();
  
  for (const job of jobs) {
    if (!job.enabled) continue;
    
    const nextRun = job.nextRun || job.createdAt;
    if (nextRun <= now) {
      console.log('[AutoChrome] 执行定时任务:', job.name);
      
      // 发送通知
      await chrome.notifications.create({
        type: 'basic',
        iconUrl: 'assets/icons/icon48.png',
        title: 'AutoChrome 定时抓取',
        message: `开始执行：${job.name}`
      });
      
      // 执行抓取任务
      try {
        const [tab] = await chrome.tabs.create({ url: job.url, active: false });
        
        // 等待页面加载
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // 执行抓取
        const response = await chrome.tabs.sendMessage(tab.id, {
          type: job.isList ? 'EXTRACT_LIST' : 'EXTRACT_DATA',
          itemSelector: job.itemSelector,
          rules: job.rules
        });
        
        // 保存结果
        const taskResult = {
          jobId: job.id,
          jobName: job.name,
          timestamp: Date.now(),
          data: response.data,
          recordCount: Array.isArray(response.data) ? response.data.length : 1
        };
        
        // 存储结果
        const results = await chrome.storage.local.get(['grabResults']) || { grabResults: [] };
        results.grabResults.unshift(taskResult);
        await chrome.storage.local.set({ grabResults: results.grabResults.slice(0, 100) });
        
        // 关闭标签页
        await chrome.tabs.remove(tab.id);
        
        // 发送完成通知
        await chrome.notifications.create({
          type: 'basic',
          iconUrl: 'assets/icons/icon48.png',
          title: 'AutoChrome 定时抓取完成',
          message: `任务 "${job.name}" 已完成，抓取 ${taskResult.recordCount} 条数据`
        });
        
        // 更新下次执行时间
        job.nextRun = calculateNextRun(job.schedule, job.nextRun);
        job.lastRun = Date.now();
        job.runCount = (job.runCount || 0) + 1;
        
      } catch (error) {
        console.error('[AutoChrome] 定时任务执行失败:', error);
        await chrome.notifications.create({
          type: 'basic',
          iconUrl: 'assets/icons/icon48.png',
          title: 'AutoChrome 定时抓取失败',
          message: `任务 "${job.name}" 执行失败`
        });
      }
    }
  }
  
  // 保存更新后的任务
  await chrome.storage.local.set({ scheduledJobs: jobs });
}

// 计算下次执行时间
function calculateNextRun(schedule: any, lastRun: number): number {
  const date = new Date(lastRun);
  
  switch (schedule.type) {
    case 'minute':
      return lastRun + schedule.interval * 60 * 1000;
    case 'hour':
      return lastRun + schedule.interval * 60 * 60 * 1000;
    case 'day':
      date.setDate(date.getDate() + schedule.interval);
      date.setHours(schedule.hour || 9, schedule.minute || 0, 0, 0);
      return date.getTime();
    case 'week':
      date.setDate(date.getDate() + schedule.interval * 7);
      date.setHours(schedule.hour || 9, schedule.minute || 0, 0, 0);
      return date.getTime();
    case 'custom':
      return lastRun + schedule.intervalMs;
    default:
      return lastRun + 60 * 60 * 1000; // 默认 1 小时
  }
}

// 监听消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[BG] Message:', message.type);
  
  if (message.type === 'CREATE_SCHEDULED_JOB') {
    createScheduledJob(message.job).then(sendResponse);
    return true;
  }
  
  if (message.type === 'GET_SCHEDULED_JOBS') {
    chrome.storage.local.get(['scheduledJobs']).then(result => {
      sendResponse({ jobs: result.scheduledJobs || [] });
    });
    return true;
  }
  
  if (message.type === 'DELETE_SCHEDULED_JOB') {
    deleteScheduledJob(message.jobId).then(sendResponse);
    return true;
  }
  
  if (message.type === 'GET_GRAB_RESULTS') {
    chrome.storage.local.get(['grabResults']).then(result => {
      sendResponse({ results: result.grabResults || [] });
    });
    return true;
  }
  
  sendResponse({ status: 'ok' });
  return true;
});

// 创建定时任务
async function createScheduledJob(job: any) {
  const jobs = await chrome.storage.local.get(['scheduledJobs']);
  const jobList = jobs.scheduledJobs || [];
  
  const newJob = {
    id: `job_${Date.now()}`,
    name: job.name,
    url: job.url,
    isList: job.isList,
    itemSelector: job.itemSelector,
    rules: job.rules,
    schedule: job.schedule,
    enabled: true,
    createdAt: Date.now(),
    nextRun: calculateNextRun(job.schedule, Date.now()),
    runCount: 0
  };
  
  jobList.push(newJob);
  await chrome.storage.local.set({ scheduledJobs: jobList });
  
  return { success: true, job: newJob };
}

// 删除定时任务
async function deleteScheduledJob(jobId: string) {
  const jobs = await chrome.storage.local.get(['scheduledJobs']);
  const jobList = jobs.scheduledJobs || [];
  const filtered = jobList.filter(j => j.id !== jobId);
  await chrome.storage.local.set({ scheduledJobs: filtered });
  
  return { success: true };
}

console.log('[AutoChrome] Service Worker ready');

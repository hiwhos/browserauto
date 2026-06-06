// 元素定位接口
export interface ElementLocator {
  selector?: string;
  xpath?: string;
  text?: string;
  role?: string;
  label?: string;
  description?: string;
  timeout?: number;
  retryCount?: number;
  fallbackSelectors?: string[];
}

// 录制的动作类型
export type ActionType = 
  | 'click' 
  | 'dblclick'
  | 'type' 
  | 'select' 
  | 'hover' 
  | 'scroll' 
  | 'navigate' 
  | 'wait'
  | 'extract'
  | 'screenshot';

// 录制的动作
export interface RecordedAction {
  id: string;
  type: ActionType;
  target: ElementLocator;
  value?: string;
  options?: {
    delay?: number;
    button?: 'left' | 'middle' | 'right';
    modifiers?: Array<'Shift' | 'Control' | 'Alt' | 'Meta'>;
  };
  timestamp: number;
  metadata: {
    url: string;
    pageTitle: string;
    screenshot?: string;
  };
}

// 数据提取规则
export interface ExtractionRule {
  fieldName: string;
  locator: ElementLocator;
  extractType: 'text' | 'html' | 'attribute' | 'image' | 'link';
  attribute?: string;
}

// 提取的数据
export interface ExtractedData {
  fieldName: string;
  value: string | string[];
  timestamp: number;
}

// 任务步骤
export interface TaskStep {
  id: string;
  action: ActionType;
  target?: ElementLocator;
  value?: string;
  options?: Record<string, any>;
  condition?: {
    type: 'element-visible' | 'element-hidden' | 'url-contains' | 'custom';
    value: string;
  };
  loop?: {
    type: 'for-each' | 'while' | 'until';
    selector?: string;
    maxIterations?: number;
  };
}

// 自动化任务
export interface AutomationTask {
  id: string;
  name: string;
  description?: string;
  steps: TaskStep[];
  createdAt: number;
  updatedAt: number;
  tags?: string[];
  variables?: Record<string, string>;
}

// 录制状态
export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  startTime: number | null;
  actions: RecordedAction[];
  currentUrl: string;
}

// 回放状态
export interface PlaybackState {
  isPlaying: boolean;
  isPaused: boolean;
  currentStepIndex: number;
  totalSteps: number;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'error';
  error?: string;
}

// 插件设置
export interface PluginSettings {
  autoScroll: boolean;
  highlightElements: boolean;
  captureScreenshots: boolean;
  defaultTimeout: number;
  maxRetries: number;
  exportFormat: 'json' | 'csv' | 'excel';
  aiEnabled: boolean;
}

// 消息类型
export type MessageType = 
  | 'START_RECORDING'
  | 'STOP_RECORDING'
  | 'PAUSE_RECORDING'
  | 'RESUME_RECORDING'
  | 'PLAYBACK_START'
  | 'PLAYBACK_PAUSE'
  | 'PLAYBACK_STOP'
  | 'EXTRACT_DATA'
  | 'FIND_ELEMENT'
  | 'HIGHLIGHT_ELEMENT'
  | 'GET_PAGE_INFO'
  | 'SAVE_TASK'
  | 'LOAD_TASK'
  | 'DELETE_TASK'
  | 'GET_SETTINGS'
  | 'UPDATE_SETTINGS';

// 消息接口
export interface Message {
  type: MessageType;
  payload?: any;
  tabId?: number;
}

// 消息响应
export interface MessageResponse {
  success: boolean;
  data?: any;
  error?: string;
}

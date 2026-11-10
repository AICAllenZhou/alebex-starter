import { normalizeEndedReason } from './audio/format';
import type { CallUiState, ErrorCode } from './transport/types';

export function statusText(
  state: CallUiState,
  options: { inCall: boolean; errorCode?: ErrorCode | null; endedReason?: string | null },
): string {
  switch (state) {
    case 'idle':
      return options.inCall ? '已接通，等待中' : '点击下方按钮开始通话';
    case 'connecting':
      return '正在连接…';
    case 'listening':
      return '正在聆听';
    case 'speaking':
      return '正在说话';
    case 'ended':
      return endedText(options.endedReason);
    case 'mic_denied':
      return '浏览器拒绝了麦克风权限，请允许后重新开始。';
    case 'disconnected':
      return '网络已断开，请检查连接后重新开始。';
    case 'error':
      return errorReason(options.errorCode);
    default:
      return '点击下方按钮开始通话';
  }
}

export function endedText(reason?: string | null): string {
  switch (normalizeEndedReason(reason)) {
    case 'user_hangup':
      return '你已结束通话。';
    case 'duration_limit':
      return '通话已因时长上限结束。';
    default:
      return '通话已结束';
  }
}

export function errorReason(code?: ErrorCode | null): string {
  switch (code) {
    case 'token_expired':
      return '令牌已过期，请重新开始。';
    case 'invalid_config':
      return '配置被拒绝，无法开始通话。';
    case 'upstream_closed':
      return '语音服务已断开，请重新开始。';
    case 'limit_reached':
      return '已到达通话时长或额度上限。';
    default:
      return '通话出错，请重新开始。';
  }
}

export function isRecoverableState(state: CallUiState): boolean {
  return (
    state === 'ended' ||
    state === 'error' ||
    state === 'mic_denied' ||
    state === 'disconnected'
  );
}

export function isLiveCallState(state: CallUiState, inCall: boolean): boolean {
  return (
    state === 'connecting' ||
    state === 'listening' ||
    state === 'speaking' ||
    (state === 'idle' && inCall)
  );
}

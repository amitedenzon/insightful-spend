// In-process state for the current scrape job. Single-job assumption: only
// one scrape runs at a time. UI polls /api/scrape/status and posts OTPs to
// /api/scrape/otp; both endpoints read/write this module.

const state = {
  status: 'idle', // idle | running | awaiting_otp | done | failed
  message: '',
  provider: null, // which provider is currently in flight (label)
  startedAt: null,
  finishedAt: null,
  result: null, // {providers, errors, totalTransactions} on success
  // When the scraper hits the OTP form it sets `otpResolver` to a function;
  // the OTP endpoint resolves it with the user-supplied code, unblocking the
  // scraper. Cleared back to null afterwards.
  otpResolver: null,
};

export function getState() {
  const { otpResolver, ...visible } = state;
  return visible;
}

export function isBusy() {
  return state.status === 'running' || state.status === 'awaiting_otp';
}

export function reset() {
  state.status = 'idle';
  state.message = '';
  state.provider = null;
  state.startedAt = null;
  state.finishedAt = null;
  state.result = null;
  state.otpResolver = null;
}

export function setRunning(provider, message = '') {
  state.status = 'running';
  state.provider = provider;
  state.message = message;
  if (!state.startedAt) state.startedAt = new Date().toISOString();
}

export function setMessage(message) {
  state.message = message;
}

export function awaitOtp(provider) {
  state.status = 'awaiting_otp';
  state.provider = provider;
  state.message = `${provider}: ממתין לקוד אימות`;
  return new Promise(resolve => {
    state.otpResolver = (code) => {
      state.otpResolver = null;
      state.status = 'running';
      state.message = `${provider}: ממשיך אחרי קוד אימות`;
      resolve(code);
    };
  });
}

export function submitOtp(code) {
  if (!state.otpResolver) return false;
  state.otpResolver(code);
  return true;
}

export function setDone(result) {
  state.status = 'done';
  state.message = `הושלם · ${result.totalTransactions} עסקאות`;
  state.result = result;
  state.finishedAt = new Date().toISOString();
}

export function setFailed(message) {
  state.status = 'failed';
  state.message = message;
  state.finishedAt = new Date().toISOString();
}

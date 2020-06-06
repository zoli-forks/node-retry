import RetryOperation from './retry_operation'

export function operation (
  options: RetryTimeoutOptions
    & { maxRetryTime?: number }
) {
  var timeouts = createTimeouts(options);
  return new RetryOperation(timeouts, {
      maxRetryTime: options && options.maxRetryTime
  });
};

export type RetryTimeoutOptions = {
  factor?: number,
  maxTimeout?: number,
  minTimeout?: number,
  randomize?: boolean,
  retries?: number,
}

export function createTimeouts (options: RetryTimeoutOptions) {
  var opts = {
    retries: 10,
    factor: 2,
    minTimeout: 1 * 1000,
    maxTimeout: Infinity,
    randomize: false,
    ...options,
  };

  if (opts.minTimeout > opts.maxTimeout) {
    throw new Error('minTimeout is greater than maxTimeout');
  }

  var timeouts = [];
  for (var i = 0; i < opts.retries; i++) {
    timeouts.push(createTimeout(i, opts));
  }

  // sort the array numerically ascending
  timeouts.sort(function(a,b) {
    return a - b;
  });

  return timeouts;
};

export function createTimeout (
  attempt: number,
  opts: Required<Pick<RetryTimeoutOptions, 'randomize' | 'factor' | 'minTimeout' | 'maxTimeout'>>
) {
  var random = (opts.randomize)
    ? (Math.random() + 1)
    : 1;

  var timeout = Math.round(random * opts.minTimeout * Math.pow(opts.factor, attempt));
  timeout = Math.min(timeout, opts.maxTimeout);

  return timeout;
};

